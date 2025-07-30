import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Colors, createErrorEmbed } from '../../utils/embeds';
import { db } from '../../database/sqlite';
import { logCommandUsage } from '../../utils/command-logger';

/**
 * Command to view direct message logs
 * This allows staff to see when and why DMs were sent to users
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm-logs')
    .setDescription('View direct message logs')
    .addUserOption(option =>
      option
        .setName('recipient')
        .setDescription('Filter logs by recipient')
        .setRequired(false))
    .addUserOption(option =>
      option
        .setName('sender')
        .setDescription('Filter logs by sender')
        .setRequired(false))
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Filter logs by command that triggered the DM')
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
      const recipientFilter = interaction.options.getUser('recipient');
      const senderFilter = interaction.options.getUser('sender');
      const commandFilter = interaction.options.getString('command');
      const limit = interaction.options.getInteger('limit') || 10;
      
      // Build the query
      let query = `
        SELECT * FROM dm_logs 
        WHERE guild_id = ?
      `;
      
      const queryParams = [interaction.guildId];
      
      if (recipientFilter) {
        query += ' AND recipient_id = ?';
        queryParams.push(recipientFilter.id);
      }
      
      if (senderFilter) {
        query += ' AND sender_id = ?';
        queryParams.push(senderFilter.id);
      }
      
      if (commandFilter) {
        query += ' AND command LIKE ?';
        queryParams.push(`%${commandFilter}%`);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ?';
      queryParams.push(String(limit));
      
      // Execute the query
      const logs = db.prepare(query).all(...queryParams) as {
        id: number;
        guild_id: string;
        sender_id: string;
        recipient_id: string;
        content: string;
        command: string | null;
        success: number;
        error: string | null;
        created_at: string;
      }[];
      
      if (logs.length === 0) {
        await interaction.reply({
          embeds: [createErrorEmbed(
            'No Logs Found',
            'No direct message logs were found matching your criteria.'
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
        .setTitle('💬 Direct Message Logs')
        .setColor(Colors.INFO)
        .setDescription(`Showing the last ${logs.length} DM logs${recipientFilter ? ` sent to ${recipientFilter.username}` : ''}${senderFilter ? ` sent by ${senderFilter.username}` : ''}${commandFilter ? ` triggered by command "${commandFilter}"` : ''}.`)
        .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
      
      // Add fields for each log
      for (const log of logs) {
        const sender = await interaction.client.users.fetch(log.sender_id).catch(() => null);
        const recipient = await interaction.client.users.fetch(log.recipient_id).catch(() => null);
        
        const senderName = sender ? sender.username : 'Unknown User';
        const recipientName = recipient ? recipient.username : 'Unknown User';
        
        // Format timestamp
        const timestamp = new Date(log.created_at);
        const formattedDate = `${timestamp.getDate().toString().padStart(2, '0')}/${(timestamp.getMonth() + 1).toString().padStart(2, '0')}/${timestamp.getFullYear()} ${timestamp.getHours()}:${timestamp.getMinutes().toString().padStart(2, '0')}`;
        
        logsEmbed.addFields({
          name: `DM ${log.success ? '✅' : '❌'} ${log.command ? `(/${log.command})` : ''}`,
          value: `**From:** ${senderName} (${log.sender_id})\n**To:** ${recipientName} (${log.recipient_id})\n**When:** ${formattedDate}\n**Content:** ${log.content.length > 100 ? log.content.substring(0, 97) + '...' : log.content}${log.error ? `\n**Error:** ${log.error}` : ''}`
        });
      }
      
      // Create pagination buttons if there are more logs
      const totalLogs = db.prepare(`
        SELECT COUNT(*) as count FROM dm_logs 
        WHERE guild_id = ?
        ${recipientFilter ? ' AND recipient_id = ?' : ''}
        ${senderFilter ? ' AND sender_id = ?' : ''}
        ${commandFilter ? ' AND command LIKE ?' : ''}
      `).get(...queryParams.slice(0, -1)) as { count: number };
      
      const hasMoreLogs = totalLogs.count > limit;
      
      if (hasMoreLogs) {
        const nextButton = new ButtonBuilder()
          .setCustomId(`dm_logs_next_${limit}_${recipientFilter?.id || ''}_${senderFilter?.id || ''}_${commandFilter || ''}`)
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
        command: 'dm-logs',
        options: {
          recipient: recipientFilter?.username,
          sender: senderFilter?.username,
          command: commandFilter,
          limit
        },
        channel: interaction.channel!,
        success: true
      });
      
      logInfo('DM Logs', `DM logs viewed by ${interaction.user.tag} in ${interaction.guild?.name}`);
    } catch (error) {
      logError('DM Logs', error);
      
      await interaction.reply({
        embeds: [createErrorEmbed(
          'Command Error',
          'There was an error retrieving direct message logs. Please try again later.'
        )],
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
