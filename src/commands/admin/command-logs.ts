import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Colors, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { db } from '../../database/sqlite';

/**
 * Command to view command usage logs
 * This allows staff to see who has been using commands and when
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('command-logs')
    .setDescription('View command usage logs')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Filter logs by command name')
        .setRequired(false))
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Filter logs by user')
        .setRequired(false))
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of logs to show (default: 10, max: 25)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      if (!interaction.guildId) {
        await interaction.reply({
          embeds: [createErrorEmbed(
            'Command Error',
            'This command can only be used in a server.'
          )],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Get filter options
      const commandFilter = interaction.options.getString('command');
      const userFilter = interaction.options.getUser('user');
      const limit = interaction.options.getInteger('limit') || 10;
      
      // Build the query
      let query = `
        SELECT * FROM command_logs 
        WHERE guild_id = ?
      `;
      
      const queryParams = [interaction.guildId];
      
      if (commandFilter) {
        query += ' AND command LIKE ?';
        queryParams.push(`%${commandFilter}%`);
      }
      
      if (userFilter) {
        query += ' AND user_id = ?';
        queryParams.push(userFilter.id);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ?';
      queryParams.push(String(limit));
      
      // Execute the query
      const logs = db.prepare(query).all(...queryParams) as {
        id: number;
        guild_id: string;
        user_id: string;
        command: string;
        options: string | null;
        channel_id: string;
        success: number;
        error: string | null;
        created_at: string;
      }[];
      
      if (logs.length === 0) {
        await interaction.reply({
          embeds: [createErrorEmbed(
            'No Logs Found',
            'No command logs were found matching your criteria.'
          )],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Format the current time
      const now = new Date();
      const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Create the embed
      const logsEmbed = new EmbedBuilder()
        .setTitle('🔍 Command Usage Logs')
        .setColor(Colors.INFO)
        .setDescription(`Showing the last ${logs.length} command logs${commandFilter ? ` for command "${commandFilter}"` : ''}${userFilter ? ` by ${userFilter.username}` : ''}.`)
        .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
      
      // Add fields for each log
      for (const log of logs) {
        const user = await interaction.client.users.fetch(log.user_id).catch(() => null);
        const username = user ? user.username : 'Unknown User';
        
        // Format timestamp
        const timestamp = new Date(log.created_at);
        const formattedDate = `${timestamp.getDate().toString().padStart(2, '0')}/${(timestamp.getMonth() + 1).toString().padStart(2, '0')}/${timestamp.getFullYear()} ${timestamp.getHours()}:${timestamp.getMinutes().toString().padStart(2, '0')}`;
        
        // Format options if available
        let optionsText = '';
        if (log.options) {
          try {
            const options = JSON.parse(log.options);
            optionsText = Object.entries(options)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
          } catch {
            optionsText = log.options;
          }
        }
        
        logsEmbed.addFields({
          name: `/${log.command} ${log.success ? '✅' : '❌'}`,
          value: `**User:** ${username} (${log.user_id})\n**When:** ${formattedDate}${optionsText ? `\n**Options:** ${optionsText}` : ''}${log.error ? `\n**Error:** ${log.error}` : ''}`
        });
      }
      
      // Create pagination buttons if there are more logs
      const totalLogs = db.prepare(`
        SELECT COUNT(*) as count FROM command_logs 
        WHERE guild_id = ?
        ${commandFilter ? ' AND command LIKE ?' : ''}
        ${userFilter ? ' AND user_id = ?' : ''}
      `).get(...queryParams.slice(0, -1)) as { count: number };
      
      const hasMoreLogs = totalLogs.count > limit;
      
      if (hasMoreLogs) {
        const nextButton = new ButtonBuilder()
          .setCustomId(`command_logs_next_${limit}_${commandFilter || ''}_${userFilter?.id || ''}`)
          .setLabel('Next Page')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('➡️');
        
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(nextButton);
        
        await interaction.reply({
          embeds: [logsEmbed],
          components: [row]
        });
      } else {
        await interaction.reply({
          embeds: [logsEmbed]
        });
      }
      
      // Log this command usage
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'command-logs',
        options: {
          command: commandFilter,
          user: userFilter?.username,
          limit
        },
        channel: interaction.channel!,
        success: true
      });
      
      logInfo('Command Logs', `Command logs viewed by ${interaction.user.tag} in ${interaction.guild?.name}`);
    } catch (error) {
      logError('Command Logs', error);
      
      await interaction.reply({
        embeds: [createErrorEmbed(
          'Command Error',
          'There was an error retrieving command logs. Please try again later.'
        )],
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
