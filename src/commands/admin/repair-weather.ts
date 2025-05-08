import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, EmbedBuilder } from 'discord.js';
import { db } from '../../database/sqlite';

export const data = new SlashCommandBuilder()
    .setName('repair-weather')
    .setDescription('Repair weather configuration by directly updating the database')
    .addStringOption(option =>
        option.setName('channel-id')
            .setDescription('The ID of the channel to use for weather reports')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const channelId = interaction.options.getString('channel-id')!;
        
        console.log(`[WEATHER REPAIR] Attempting to repair weather configuration for guild ${interaction.guildId} with channel ${channelId}`);
        
        // Check if the guild exists in server_settings
        const guild = db.prepare("SELECT guild_id FROM server_settings WHERE guild_id = ?").get(interaction.guildId) as any;
        
        if (guild) {
            // Guild exists, update the existing record
            const updateResult = db.prepare("UPDATE server_settings SET weather_channel_id = ? WHERE guild_id = ?").run(channelId, interaction.guildId);
            
            console.log(`[WEATHER REPAIR] Updated existing guild settings: ${JSON.stringify(updateResult)}`);
        } else {
            // Guild doesn't exist, insert a new record
            const insertResult = db.prepare("INSERT INTO server_settings (guild_id, weather_channel_id) VALUES (?, ?)").run(interaction.guildId, channelId);
            
            console.log(`[WEATHER REPAIR] Inserted new guild settings: ${JSON.stringify(insertResult)}`);
        }
        
        // Verify the change by reading it back
        const verification = db.prepare("SELECT weather_channel_id FROM server_settings WHERE guild_id = ?").get(interaction.guildId) as any;
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Weather Configuration Repaired')
            .setDescription(`Weather channel configuration has been directly updated in the database.`)
            .addFields([
                { name: 'Guild ID', value: interaction.guildId || 'Unknown', inline: true },
                { name: 'Channel ID', value: channelId, inline: true },
                { name: 'Verification', value: verification ? `Channel in DB: ${verification.weather_channel_id}` : 'Failed to verify' }
            ])
            .setFooter({ text: 'Please restart the bot for changes to take effect' });
        
        await interaction.followUp({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
        
        console.log(`[WEATHER REPAIR] Repair completed for guild ${interaction.guildId}`);
    } catch (error) {
        console.error('Error in repair-weather command:', error);
        
        if (interaction.deferred) {
            await interaction.followUp({ 
                content: 'An error occurred while repairing weather configuration.', 
                flags: MessageFlags.Ephemeral
            });
        } else {
            await interaction.reply({ 
                content: 'An error occurred while repairing weather configuration.', 
                flags: MessageFlags.Ephemeral
            });
        }
    }
} 