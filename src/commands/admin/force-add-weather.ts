import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, EmbedBuilder, ChannelType, TextChannel } from 'discord.js';
import { db } from '../../database/sqlite';

export const data = new SlashCommandBuilder()
    .setName('force-add-weather')
    .setDescription('Force-add a weather channel to database (emergency fix)')
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to use for weather reports')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const channel = interaction.options.getChannel('channel')!;
        
        // Verify it's a text channel
        if (channel.type !== ChannelType.GuildText) {
            await interaction.followUp({
                content: 'The channel must be a text channel.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }
        
        const channelId = channel.id;
        const guildId = interaction.guildId!;
        
        console.log(`[FORCE ADD] Forcing weather channel ${channelId} for guild ${guildId}`);
        
        // ===== BRUTAL FORCE APPROACH =====
        // Try multiple different approaches to ensure the setting gets saved
        
        try {
            // Method 1: Directly check if record exists and try UPDATE or INSERT
            const checkRecord = db.prepare("SELECT guild_id FROM server_settings WHERE guild_id = ?").get(guildId);
            
            if (checkRecord) {
                // UPDATE existing record
                db.prepare("UPDATE server_settings SET weather_channel_id = ? WHERE guild_id = ?").run(channelId, guildId);
                console.log(`[FORCE ADD] Method 1: Updated existing record for guild ${guildId}`);
            } else {
                // INSERT new record
                db.prepare("INSERT INTO server_settings (guild_id, weather_channel_id) VALUES (?, ?)").run(guildId, channelId);
                console.log(`[FORCE ADD] Method 1: Inserted new record for guild ${guildId}`);
            }
        } catch (method1Error) {
            console.error('[FORCE ADD] Method 1 failed:', method1Error);
        }
        
        try {
            // Method 2: UPDATE or INSERT IGNORE
            db.prepare("INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)").run(guildId);
            db.prepare("UPDATE server_settings SET weather_channel_id = ? WHERE guild_id = ?").run(channelId, guildId);
            console.log(`[FORCE ADD] Method 2: UPDATE or INSERT IGNORE completed for guild ${guildId}`);
        } catch (method2Error) {
            console.error('[FORCE ADD] Method 2 failed:', method2Error);
        }
        
        try {
            // Method 3: REPLACE INTO (worst case, might reset other settings)
            db.prepare("REPLACE INTO server_settings (guild_id, weather_channel_id) VALUES (?, ?)").run(guildId, channelId);
            console.log(`[FORCE ADD] Method 3: REPLACE INTO completed for guild ${guildId}`);
        } catch (method3Error) {
            console.error('[FORCE ADD] Method 3 failed:', method3Error);
        }
        
        // Verify if any method worked
        const verification = db.prepare("SELECT weather_channel_id FROM server_settings WHERE guild_id = ?").get(guildId) as any;
        
        // Load the data into the in-memory cache
        try {
            // This is a direct import to avoid circular dependencies
            const { weatherChannels } = require('../../handlers/utility/weather-scheduler');
            
            if (weatherChannels) {
                weatherChannels[guildId] = channelId;
                console.log(`[FORCE ADD] Updated in-memory cache for guild ${guildId}`);
            }
        } catch (cacheError) {
            console.error('[FORCE ADD] Failed to update in-memory cache:', cacheError);
        }
        
        // Send a test message to the channel
        try {
            const testEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⚠️ Weather Emergency Fix')
                .setDescription('This channel has been force-configured for weather reports using the emergency fix command.')
                .addFields([
                    { name: '⏰ Schedule', value: 'Daily at 8:00 AM Israel time' },
                    { name: '✅ First Report', value: 'You will receive a test report soon after bot restart.' },
                    { name: '🔄 Next Steps', value: 'Please restart the bot for changes to take full effect.' }
                ])
                .setFooter({ text: '• Made By Soggra' });
            
            await (channel as TextChannel).send({ embeds: [testEmbed] });
            console.log(`[FORCE ADD] Sent test message to channel ${channelId}`);
        } catch (messageError) {
            console.error('[FORCE ADD] Error sending test message:', messageError);
        }
        
        const status = verification && verification.weather_channel_id === channelId ? 
            '✅ Success! Channel was saved to database.' : 
            '❌ Failed to verify settings in database.';
        
        const embed = new EmbedBuilder()
            .setColor(0xFF3300)
            .setTitle('Weather Emergency Fix')
            .setDescription(`Attempted to force-add weather channel settings using multiple methods.`)
            .addFields([
                { name: 'Status', value: status, inline: false },
                { name: 'Guild ID', value: guildId, inline: true },
                { name: 'Channel', value: `<#${channelId}>`, inline: true },
                { name: 'Database Value', value: verification ? verification.weather_channel_id : 'No value found', inline: true },
                { name: 'Next Steps', value: 'Please restart the bot for changes to fully take effect.' }
            ]);
        
        await interaction.followUp({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
        
        console.log(`[FORCE ADD] Emergency fix completed for guild ${guildId} using channel ${channelId}`);
    } catch (error) {
        console.error('Error in force-add-weather command:', error);
        
        if (interaction.deferred) {
            await interaction.followUp({ 
                content: 'An error occurred during the emergency fix.', 
                flags: MessageFlags.Ephemeral
            });
        } else {
            await interaction.reply({ 
                content: 'An error occurred during the emergency fix.', 
                flags: MessageFlags.Ephemeral
            });
        }
    }
} 