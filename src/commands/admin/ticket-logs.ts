import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Colors, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { db } from '../../database/sqlite';
import { formatIsraeliDate, formatIsraeliTime } from '../../utils/time-formatter';

/**
 * Command to view ticket action logs
 * This allows staff to see all actions taken on tickets
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-logs')
    .setDescription('View ticket action logs')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Filter logs by action type')
        .setRequired(false)
        .addChoices(
          { name: 'Create', value: 'create' },
          { name: 'Close', value: 'close' },
          { name: 'Delete', value: 'delete' },
          { name: 'Reopen', value: 'reopen' },
          { name: 'Transfer', value: 'transfer' },
          { name: 'Add User', value: 'addUser' },
          { name: 'Remove User', value: 'removeUser' },
          { name: 'Set Priority', value: 'setPriority' }
        ))
    .addIntegerOption(option =>
      option
        .setName('ticket')
        .setDescription('Filter logs by ticket number')
        .setRequired(false)
        .setMinValue(1))
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Filter logs by user who performed the action')
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
      const actionFilter = interaction.options.getString('action');
      const ticketFilter = interaction.options.getInteger('ticket');
      const userFilter = interaction.options.getUser('user');
      const limit = interaction.options.getInteger('limit') || 10;
      
      // Build the query
      let query = `
        SELECT * FROM ticket_action_logs 
        WHERE guild_id = ?
      `;
      
      const queryParams = [interaction.guildId];
      
      if (actionFilter) {
        query += ' AND action = ?';
        queryParams.push(actionFilter);
      }
      
      if (ticketFilter) {
        query += ' AND ticket_number = ?';
        queryParams.push(String(ticketFilter));
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
        action: string;
        ticket_id: number;
        ticket_number: number;
        category: string | null;
        target_user_id: string | null;
        additional_info: string | null;
        created_at: string;
      }[];
      
      if (logs.length === 0) {
        await interaction.reply({
          embeds: [createErrorEmbed(
            'No Logs Found',
            'No ticket action logs were found matching your criteria.'
          )],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Format the current time using the utility
      const now = new Date();
      const timeString = formatIsraeliTime(now);
      
      // Create the embed
      const logsEmbed = new EmbedBuilder()
        .setTitle('🎫 Ticket Action Logs')
        .setColor(Colors.INFO)
        .setDescription(`Showing the last ${logs.length} ticket action logs${actionFilter ? ` for action "${actionFilter}"` : ''}${ticketFilter ? ` for ticket #${ticketFilter.toString().padStart(4, '0')}` : ''}${userFilter ? ` by ${userFilter.username}` : ''}.`)
        .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
      
      // Add fields for each log
      for (const log of logs) {
        const user = await interaction.client.users.fetch(log.user_id).catch(() => null);
        const username = user ? user.username : 'Unknown User';
        
        let targetUsername = 'N/A';
        if (log.target_user_id) {
          const targetUser = await interaction.client.users.fetch(log.target_user_id).catch(() => null);
          targetUsername = targetUser ? targetUser.username : 'Unknown User';
        }
        
        // Format timestamp using the utility
        const timestamp = new Date(log.created_at);
        const formattedDate = formatIsraeliDate(timestamp);
        
        // Get action emoji
        let actionEmoji = '🎫';
        switch (log.action) {
          case 'create': actionEmoji = '🆕'; break;
          case 'close': actionEmoji = '🔒'; break;
          case 'delete': actionEmoji = '🗑️'; break;
          case 'reopen': actionEmoji = '🔓'; break;
          case 'transfer': actionEmoji = '🔄'; break;
          case 'addUser': actionEmoji = '➕'; break;
          case 'removeUser': actionEmoji = '➖'; break;
          case 'setPriority': actionEmoji = '🚨'; break;
        }
        
        // Format action name for display
        const actionName = log.action.charAt(0).toUpperCase() + log.action.slice(1)
          .replace(/([A-Z])/g, ' $1').trim(); // Add spaces before capital letters
        
        logsEmbed.addFields({
          name: `${actionEmoji} ${actionName} | Ticket #${log.ticket_number.toString().padStart(4, '0')}`,
          value: `**User:** ${username} (${log.user_id})\n**When:** ${formattedDate}${log.category ? `\n**Category:** ${log.category}` : ''}${log.target_user_id ? `\n**Target User:** ${targetUsername} (${log.target_user_id})` : ''}${log.additional_info ? `\n**Additional Info:** ${log.additional_info}` : ''}`
        });
      }
      
      // Create pagination buttons if there are more logs
      const totalLogs = db.prepare(`
        SELECT COUNT(*) as count FROM ticket_action_logs 
        WHERE guild_id = ?
        ${actionFilter ? ' AND action = ?' : ''}
        ${ticketFilter ? ' AND ticket_number = ?' : ''}
        ${userFilter ? ' AND user_id = ?' : ''}
      `).get(...queryParams.slice(0, -1)) as { count: number };
      
      const hasMoreLogs = totalLogs.count > limit;
      
      if (hasMoreLogs) {
        const nextButton = new ButtonBuilder()
          .setCustomId(`ticket_logs_next_${limit}_${actionFilter || ''}_${ticketFilter || ''}_${userFilter?.id || ''}`)
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
        command: 'ticket-logs',
        options: {
          action: actionFilter,
          ticket: ticketFilter,
          user: userFilter?.username,
          limit
        },
        channel: interaction.channel!,
        success: true
      });
      
      logInfo('Ticket Logs', `Ticket logs viewed by ${interaction.user.tag} in ${interaction.guild?.name}`);
    } catch (error) {
      logError('Ticket Logs', error);
      
      await interaction.reply({
        embeds: [createErrorEmbed(
          'Command Error',
          'There was an error retrieving ticket action logs. Please try again later.'
        )],
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
