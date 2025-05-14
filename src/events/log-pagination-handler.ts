import { ButtonInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { Colors, createErrorEmbed } from '../utils/embeds';
import { logError } from '../utils/logger';
import { db } from '../database/sqlite';

/**
 * Handle pagination for log viewing commands
 * This allows users to navigate through multiple pages of logs
 */
export async function handleLogPagination(interaction: ButtonInteraction): Promise<void> {
  try {
    const customId = interaction.customId;
    
    // Check if this is a log pagination button
    if (!customId.startsWith('command_logs_') && 
        !customId.startsWith('dm_logs_') && 
        !customId.startsWith('ticket_logs_')) {
      return;
    }
    
    // Only the user who initiated the command can use these buttons
    if (interaction.message.interaction?.user.id !== interaction.user.id) {
      await interaction.reply({ 
        embeds: [createErrorEmbed(
          'Permission Denied',
          'Only the user who ran this command can navigate through the logs.'
        )],
        flags: MessageFlags.Ephemeral
       });
      return;
    }
    
    await interaction.deferUpdate();
    
    // Parse the button ID to get parameters
    const parts = customId.split('_');
    const logType = parts[0]; // 'command', 'dm', or 'ticket'
    const action = parts[2]; // 'next' or 'prev'
    const limit = parseInt(parts[3]);
    const offset = parseInt(parts[4] || '0');
    
    // Additional filters based on log type
    let filters: any = {};
    
    if (logType === 'command') {
      filters.command = parts[5] || null;
      filters.userId = parts[6] || null;
    } else if (logType === 'dm') {
      filters.recipientId = parts[5] || null;
      filters.senderId = parts[6] || null;
      filters.command = parts[7] || null;
    } else if (logType === 'ticket') {
      filters.action = parts[5] || null;
      filters.ticketNumber = parts[6] ? parseInt(parts[6]) : null;
      filters.userId = parts[7] || null;
    }
    
    // Calculate new offset
    const newOffset = action === 'next' ? offset + limit : Math.max(0, offset - limit);
    
    // Build the query based on log type
    let query = '';
    let queryParams: any[] = [interaction.guildId];
    
    if (logType === 'command') {
      query = `
        SELECT * FROM command_logs 
        WHERE guild_id = ?
      `;
      
      if (filters.command) {
        query += ' AND command LIKE ?';
        queryParams.push(`%${filters.command}%`);
      }
      
      if (filters.userId) {
        query += ' AND user_id = ?';
        queryParams.push(filters.userId);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      queryParams.push(limit, newOffset);
    } else if (logType === 'dm') {
      query = `
        SELECT * FROM dm_logs 
        WHERE guild_id = ?
      `;
      
      if (filters.recipientId) {
        query += ' AND recipient_id = ?';
        queryParams.push(filters.recipientId);
      }
      
      if (filters.senderId) {
        query += ' AND sender_id = ?';
        queryParams.push(filters.senderId);
      }
      
      if (filters.command) {
        query += ' AND command LIKE ?';
        queryParams.push(`%${filters.command}%`);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      queryParams.push(limit, newOffset);
    } else if (logType === 'ticket') {
      query = `
        SELECT * FROM ticket_action_logs 
        WHERE guild_id = ?
      `;
      
      if (filters.action) {
        query += ' AND action = ?';
        queryParams.push(filters.action);
      }
      
      if (filters.ticketNumber) {
        query += ' AND ticket_number = ?';
        queryParams.push(filters.ticketNumber);
      }
      
      if (filters.userId) {
        query += ' AND user_id = ?';
        queryParams.push(filters.userId);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      queryParams.push(limit, newOffset);
    }
    
    // Execute the query
    const logs = db.prepare(query).all(...queryParams);
    
    if (logs.length === 0) { await interaction.followUp({
        embeds: [createErrorEmbed(
          'No More Logs',
          'There are no more logs to display.'
        )],
        flags: MessageFlags.Ephemeral
       });
      return;
    }
    
    // Format the current time
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Create the embed based on log type
    let logsEmbed = new EmbedBuilder()
      .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
    
    if (logType === 'command') {
      logsEmbed
        .setTitle('🔍 Command Usage Logs')
        .setColor(Colors.INFO)
        .setDescription(`Showing command logs ${newOffset + 1}-${newOffset + logs.length}${filters.command ? ` for command "${filters.command}"` : ''}${filters.userId ? ` by user ID ${filters.userId}` : ''}.`);
      
      // Add fields for each log
      for (const log of logs as any[]) {
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
    } else if (logType === 'dm') {
      logsEmbed
        .setTitle('💬 Direct Message Logs')
        .setColor(Colors.INFO)
        .setDescription(`Showing DM logs ${newOffset + 1}-${newOffset + logs.length}${filters.recipientId ? ` sent to user ID ${filters.recipientId}` : ''}${filters.senderId ? ` sent by user ID ${filters.senderId}` : ''}${filters.command ? ` triggered by command "${filters.command}"` : ''}.`);
      
      // Add fields for each log
      for (const log of logs as any[]) {
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
    } else if (logType === 'ticket') {
      logsEmbed
        .setTitle('🎫 Ticket Action Logs')
        .setColor(Colors.INFO)
        .setDescription(`Showing ticket action logs ${newOffset + 1}-${newOffset + logs.length}${filters.action ? ` for action "${filters.action}"` : ''}${filters.ticketNumber ? ` for ticket #${filters.ticketNumber.toString().padStart(4, '0')}` : ''}${filters.userId ? ` by user ID ${filters.userId}` : ''}.`);
      
      // Add fields for each log
      for (const log of logs as any[]) {
        const user = await interaction.client.users.fetch(log.user_id).catch(() => null);
        const username = user ? user.username : 'Unknown User';
        
        let targetUsername = 'N/A';
        if (log.target_user_id) {
          const targetUser = await interaction.client.users.fetch(log.target_user_id).catch(() => null);
          targetUsername = targetUser ? targetUser.username : 'Unknown User';
        }
        
        // Format timestamp
        const timestamp = new Date(log.created_at);
        const formattedDate = `${timestamp.getDate().toString().padStart(2, '0')}/${(timestamp.getMonth() + 1).toString().padStart(2, '0')}/${timestamp.getFullYear()} ${timestamp.getHours()}:${timestamp.getMinutes().toString().padStart(2, '0')}`;
        
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
    }
    
    // Count total logs for pagination
    let countQuery = '';
    let countParams = queryParams.slice(0, -2); // Remove limit and offset
    
    if (logType === 'command') {
      countQuery = `
        SELECT COUNT(*) as count FROM command_logs 
        WHERE guild_id = ?
        ${filters.command ? ' AND command LIKE ?' : ''}
        ${filters.userId ? ' AND user_id = ?' : ''}
      `;
    } else if (logType === 'dm') {
      countQuery = `
        SELECT COUNT(*) as count FROM dm_logs 
        WHERE guild_id = ?
        ${filters.recipientId ? ' AND recipient_id = ?' : ''}
        ${filters.senderId ? ' AND sender_id = ?' : ''}
        ${filters.command ? ' AND command LIKE ?' : ''}
      `;
    } else if (logType === 'ticket') {
      countQuery = `
        SELECT COUNT(*) as count FROM ticket_action_logs 
        WHERE guild_id = ?
        ${filters.action ? ' AND action = ?' : ''}
        ${filters.ticketNumber ? ' AND ticket_number = ?' : ''}
        ${filters.userId ? ' AND user_id = ?' : ''}
      `;
    }
    
    const totalLogs = db.prepare(countQuery).get(...countParams) as { count: number };
    
    // Create pagination buttons
    const buttons = [];
    
    // Previous page button
    if (newOffset > 0) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`${logType}_logs_prev_${limit}_${newOffset}_${Object.values(filters).join('_')}`)
          .setLabel('Previous Page')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    }
    
    // Next page button
    if (newOffset + logs.length < totalLogs.count) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`${logType}_logs_next_${limit}_${newOffset}_${Object.values(filters).join('_')}`)
          .setLabel('Next Page')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('➡️')
      );
    }
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
    
    // Update the message with the new embed and buttons
    await interaction.editReply({
      embeds: [logsEmbed],
      components: buttons.length > 0 ? [row] : []
    });
  } catch (error) { logError('Log Pagination', error);
    
    await interaction.followUp({
      embeds: [createErrorEmbed(
        'Pagination Error',
        'There was an error navigating through the logs. Please try again later.'
      )],
      flags: MessageFlags.Ephemeral
     });
  }
}
