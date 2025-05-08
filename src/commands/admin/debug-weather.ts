import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, EmbedBuilder } from 'discord.js';
import { checkWeatherDatabaseSetup, getWeatherChannel, getCustomCities } from '../../handlers/utility/weather-scheduler';
import { db } from '../../database/sqlite';

export const data = new SlashCommandBuilder()
    .setName('debug-weather')
    .setDescription('Debug the weather system setup')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        // Defer the reply to give us time to run diagnostics
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        console.log(`[WEATHER DEBUG] Running diagnostics for guild ${interaction.guildId}`);
        
        // Check database setup
        await checkWeatherDatabaseSetup();
        
        // Check if this guild has a weather channel configured (from cache)
        const channelId = await getWeatherChannel(interaction.guildId!);
        
        // Check direct database value
        const dbSetting = db.prepare("SELECT weather_channel_id FROM server_settings WHERE guild_id = ?").get(interaction.guildId) as any;
        const dbChannelId = dbSetting?.weather_channel_id || 'not set in database';
        
        // List all channels in database (for all guilds)
        const allWeatherChannels = db.prepare("SELECT guild_id, weather_channel_id FROM server_settings WHERE weather_channel_id IS NOT NULL AND weather_channel_id != ''").all() as any[];
        let allChannelsInfo = '';
        
        if (allWeatherChannels.length > 0) {
            allChannelsInfo = allWeatherChannels.map(record => 
                `Guild ${record.guild_id}: Channel ${record.weather_channel_id}`
            ).join('\n');
        } else {
            allChannelsInfo = 'No weather channels configured in any guild';
        }
        
        // Check if this guild has custom cities configured
        const customCities = await getCustomCities(interaction.guildId!);
        
        // Build city display information
        let cityInfo = '';
        if (customCities.length > 0) {
            customCities.forEach((city, index) => {
                cityInfo += `${index + 1}. **${city.name}, ${city.country}** (${city.lat}, ${city.lon})\n`;
            });
        } else {
            cityInfo = 'Using default cities (Tel Aviv, Jerusalem, Haifa)';
        }
        
        // Create diagnostic report
        const reportEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Weather System Diagnostic')
            .setDescription('Results of the weather system diagnostic check')
            .addFields([
                { 
                    name: 'Weather Channel (Cache)', 
                    value: channelId 
                        ? `Configured in memory cache: <#${channelId}>` 
                        : 'Not configured in memory cache'
                },
                {
                    name: 'Weather Channel (Database)',
                    value: `Value in database: ${dbChannelId}`
                },
                {
                    name: 'Cities Configuration',
                    value: cityInfo || 'No cities configured'
                },
                {
                    name: 'Configuration Command',
                    value: '• `/set-weather-channel` - Set the channel for weather reports and configure custom cities'
                },
                {
                    name: 'All Weather Channels',
                    value: allChannelsInfo
                }
            ])
            .setFooter({ text: 'Weather System Debug • Made By Soggra' });
        
        // Send a more detailed report
        await interaction.followUp({ 
            embeds: [reportEmbed],
            content: 'Check the console logs for more detailed diagnostic information.',
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in debug-weather command:', error);
        
        if (interaction.deferred) {
            await interaction.followUp({ 
                content: 'An error occurred while running weather diagnostics.', 
                flags: MessageFlags.Ephemeral
            });
        } else {
            await interaction.reply({ 
                content: 'An error occurred while running weather diagnostics.', 
                flags: MessageFlags.Ephemeral
            });
        }
    }
} 