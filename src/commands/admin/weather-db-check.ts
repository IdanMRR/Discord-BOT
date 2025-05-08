import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, EmbedBuilder } from 'discord.js';
import { db } from '../../database/sqlite';

export const data = new SlashCommandBuilder()
    .setName('weather-db-check')
    .setDescription('Directly checks the database for weather settings (debug)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        // Defer the reply since database operations might take time
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        // Get all rows from server_settings table
        const rows = db.prepare("SELECT * FROM server_settings").all() as any[];
        
        console.log(`[WEATHER DB CHECK] Found ${rows.length} rows in server_settings table`);
        
        // Create a list of all guilds and their weather channel settings
        let tableData = '';
        
        if (rows.length === 0) {
            tableData = 'No rows found in server_settings table';
        } else {
            for (const row of rows) {
                console.log(`[WEATHER DB CHECK] Row data: ${JSON.stringify(row)}`);
                tableData += `Guild ID: \`${row.guild_id || 'null'}\`\n`;
                tableData += `Weather Channel ID: \`${row.weather_channel_id || 'null'}\`\n`;
                tableData += `Custom Cities: \`${row.custom_cities || 'null'}\`\n\n`;
            }
        }
        
        // Get the specific guild's settings
        const guildSettings = db.prepare("SELECT * FROM server_settings WHERE guild_id = ?").get(interaction.guildId) as any;
        
        let guildData = 'No settings found for this guild';
        
        if (guildSettings) {
            console.log(`[WEATHER DB CHECK] Guild settings: ${JSON.stringify(guildSettings)}`);
            guildData = `Guild ID: \`${guildSettings.guild_id || 'null'}\`\n`;
            guildData += `Weather Channel ID: \`${guildSettings.weather_channel_id || 'null'}\`\n`;
            guildData += `Custom Cities: \`${guildSettings.custom_cities || 'null'}\`\n`;
            
            // Add direct SQL update command
            guildData += '\n**Want to set the weather channel directly?**\n';
            guildData += '```sql\n';
            guildData += `UPDATE server_settings SET weather_channel_id = '123456789' WHERE guild_id = '${interaction.guildId}';\n`;
            guildData += '```\n';
            guildData += 'Replace 123456789 with your channel ID';
        }
        
        // Direct query to check if the column exists
        const columns = db.prepare("PRAGMA table_info(server_settings)").all() as any[];
        const weatherChannelColumn = columns.find((col: any) => col.name === 'weather_channel_id');
        
        let columnInfo = '';
        if (weatherChannelColumn) {
            columnInfo = `Column exists: Name=${weatherChannelColumn.name}, Type=${weatherChannelColumn.type}`;
        } else {
            columnInfo = 'weather_channel_id column does not exist!';
        }
        
        // Create response embed
        const embed = new EmbedBuilder()
            .setColor(0x00BFFF)
            .setTitle('Database Weather Settings Check')
            .setDescription('Direct check of database values')
            .addFields([
                { name: 'Column Info', value: columnInfo, inline: false },
                { name: 'This Guild Settings', value: guildData, inline: false },
                { name: 'All Server Settings', value: tableData, inline: false }
            ])
            .setFooter({ text: 'Database Direct Check • Made By Soggra' });
        
        await interaction.followUp({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in weather-db-check command:', error);
        
        if (interaction.deferred) {
            await interaction.followUp({ 
                content: `An error occurred while checking the database: ${error}`, 
                flags: MessageFlags.Ephemeral
            });
        } else {
            await interaction.reply({ 
                content: `An error occurred while checking the database: ${error}`, 
                flags: MessageFlags.Ephemeral
            });
        }
    }
} 