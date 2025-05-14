import { Guild, User, GuildMember } from 'discord.js';
import { logInfo, logError } from './logger';
import { ServerLogService, ServerSettingsService } from '../database/services/sqliteService';

/**
 * Log an event to the database
 */
export async function logToDatabase(options: {
  guildId: string;
  actionType: string;
  userId: string;
  targetId?: string;
  channelId?: string;
  messageId?: string;
  reason?: string;
  details?: any;
}): Promise<boolean> {
  try {
    const { guildId, actionType, userId, targetId, channelId, messageId, reason, details } = options;
    
    // Create a new log entry
    const result = await ServerLogService.create({
      guild_id: guildId,
      action_type: actionType,
      user_id: userId,
      target_id: targetId,
      channel_id: channelId,
      message_id: messageId,
      reason,
      details
    });
    
    if (result) {
      logInfo('Database Logger', `Logged ${actionType} event to database`);
      return true;
    } else {
      logError('Database Logger', 'Failed to create log entry');
      return false;
    }
  } catch (error) {
    logError('Database Logger', error);
    return false;
  }
}

/**
 * Log a moderation action to the database
 */
export async function logModerationToDatabase(options: {
  guild: Guild;
  action: string;
  target: User;
  moderator: User;
  reason: string;
  duration?: string;
  additionalInfo?: string;
}): Promise<boolean> {
  try {
    const { guild, action, target, moderator, reason, duration, additionalInfo } = options;
    
    // Map the action to a database action type
    let actionType = '';
    switch (action.toLowerCase()) {
      case 'ban':
        actionType = 'memberBan';
        break;
      case 'kick':
        actionType = 'memberKick';
        break;
      case 'timeout':
        actionType = 'memberTimeout';
        break;
      case 'warning':
      case 'warn':
        actionType = 'memberWarning';
        break;
      case 'warning removed':
        actionType = 'warningRemoved';
        break;
      default:
        actionType = action.toLowerCase().replace(/\s+/g, '');
    }
    
    // Create a new log entry
    const result = await ServerLogService.create({
      guild_id: guild.id,
      action_type: actionType,
      user_id: moderator.id,
      target_id: target.id,
      reason,
      details: {
        action,
        targetTag: target.tag,
        moderatorTag: moderator.tag,
        duration,
        additionalInfo
      }
    });
    
    if (result) {
      logInfo('Database Logger', `Logged ${action} moderation action to database`);
    } else {
      logError('Database Logger', 'Failed to create moderation log entry');
      return false;
    }
    
    // Ensure server settings exist
    await getOrCreateServerSettings(guild);
    
    return true;
  } catch (error) {
    logError('Database Logger', error);
    return false;
  }
}

/**
 * Get or create server settings
 */
export async function getOrCreateServerSettings(guild: Guild): Promise<any> {
  try {
    // Get or create server settings
    const serverSettings = await ServerSettingsService.getOrCreate(guild.id, guild.name);
    
    if (!serverSettings) {
      logError('Database Logger', 'Failed to get or create server settings');
      return null;
    }
    
    return serverSettings;
  } catch (error) {
    logError('Database Logger', error);
    return null;
  }
}

/**
 * Log a member join event
 */
export async function logMemberJoin(member: GuildMember): Promise<boolean> {
  return logToDatabase({
    guildId: member.guild.id,
    actionType: 'memberJoin',
    userId: member.id,
    details: {
      tag: member.user.tag,
      createdAt: member.user.createdAt,
      joinedAt: member.joinedAt
    }
  });
}

/**
 * Log a member leave event
 */
export async function logMemberLeave(member: GuildMember): Promise<boolean> {
  return logToDatabase({
    guildId: member.guild.id,
    actionType: 'memberLeave',
    userId: member.id,
    details: {
      tag: member.user.tag,
      joinedAt: member.joinedAt,
      roles: member.roles.cache.map(role => role.name)
    }
  });
}

/**
 * Log a message delete event
 */
export async function logMessageDelete(options: {
  guildId: string;
  channelId: string;
  messageId: string;
  userId: string;
  content?: string;
  attachments?: any[];
}): Promise<boolean> {
  const { guildId, channelId, messageId, userId, content, attachments } = options;
  
  return logToDatabase({
    guildId,
    actionType: 'messageDelete',
    userId,
    channelId,
    messageId,
    details: {
      content,
      attachments,
      deletedAt: new Date()
    }
  });
}

/**
 * Log a ticket event
 */
export async function logTicketEvent(options: {
  guildId: string;
  actionType: 'ticketCreate' | 'ticketClose' | 'ticketDelete' | 'ticketReopen' | 'ticketAddUser' | 'ticketRemoveUser' | 'ticketSetPriority' | 'ticketNote' | 'ticketRating';
  userId: string;
  channelId: string;
  ticketNumber: number;
  subject?: string;
  closedBy?: string;
  priority?: string;
  targetUser?: string;
  note?: string;
  rating?: number;
  feedback?: string;
  skipChannelLog?: boolean;
}): Promise<boolean> {
  const { 
    guildId, 
    actionType, 
    userId, 
    channelId, 
    ticketNumber, 
    subject, 
    closedBy, 
    priority, 
    targetUser, 
    note,
    rating,
    feedback,
    skipChannelLog = false
  } = options;
  
  // First save to the server_logs table for general logging
  const mainLogResult = await logToDatabase({
    guildId,
    actionType,
    userId,
    channelId,
    details: {
      ticketNumber,
      subject,
      closedBy,
      priority,
      targetUser,
      note,
      rating,
      feedback,
      timestamp: new Date().toISOString() // Add timestamp for accurate time tracking
    }
  });
  
  // Additionally, save to the ticket_action_logs table for specialized ticket logs
  try {
    // Get the ticket ID from the database if not provided
    let ticketId = null;
    try {
      const { db } = require('../database/sqlite');
      const ticketStmt = db.prepare(`SELECT id FROM tickets WHERE guild_id = ? AND ticket_number = ?`);
      const ticket = ticketStmt.get(guildId, ticketNumber);
      ticketId = ticket ? ticket.id : null;
    } catch (error) {
      logError('Ticket Logger', `Failed to get ticket ID: ${error}`);
    }
    
    // Convert action type to ticket action format
    const action = actionType.replace('ticket', '').toLowerCase();
    
    // Create details JSON
    const details = JSON.stringify({
      subject,
      closedBy,
      priority,
      targetUser,
      note,
      rating,
      feedback,
      channelId
    });
    
    // Insert into ticket_action_logs
    const { db } = require('../database/sqlite');
    const stmt = db.prepare(`
      INSERT INTO ticket_action_logs 
      (guild_id, ticket_id, ticket_number, user_id, action, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      guildId,
      ticketId,
      ticketNumber,
      userId,
      action,
      details
    );
    
    logInfo('Ticket Logger', `Logged ${action} action for ticket #${ticketNumber} to ticket_action_logs`);
    
    // Send log to the ticket logs channel if not skipped
    if (!skipChannelLog) {
      await sendLogToChannel(
        guildId, 
        userId, 
        ticketNumber, 
        actionType, 
        subject, 
        closedBy, 
        targetUser, 
        note,
        rating,
        feedback
      );
    }
    
    return true;
  } catch (error) {
    logError('Ticket Logger', `Failed to log to ticket_action_logs: ${error}`);
    // Still return the result of the main log
    return mainLogResult;
  }
}

/**
 * Send log embed to the ticket logs channel
 */
async function sendLogToChannel(
  guildId: string,
  userId: string,
  ticketNumber: number,
  actionType: string,
  subject?: string,
  closedBy?: string,
  targetUser?: string,
  note?: string,
  rating?: number,
  feedback?: string
): Promise<void> {
  try {
    // Get the ticket logs channel from settings
    const { settingsManager } = require('../utils/settings');
    const settings = await settingsManager.getSettings(guildId);
    
    if (!settings || !settings.ticket_logs_channel_id) {
      return;
    }
    
    // Get the Discord client
    const { client } = require('../index');
    const { EmbedBuilder, TextChannel } = require('discord.js');
    const { Colors } = require('../utils/embeds');
    
    // Get the guild
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return;
    
    // Get the channel
    const logChannel = await guild.channels.fetch(settings.ticket_logs_channel_id);
    if (!logChannel || !logChannel.isTextBased()) {
      return;
    }
    
    // Get user information
    const user = await client.users.fetch(userId).catch(() => null);
    
    // Format the current time
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Get action emoji and color
    let actionEmoji = '🎫';
    let actionColor = Colors.PRIMARY;
    let action = actionType.replace('ticket', '').toLowerCase();
    
    switch (action) {
      case 'create':
        actionEmoji = '🆕';
        actionColor = Colors.SUCCESS;
        break;
      case 'close':
        actionEmoji = '🔒';
        actionColor = Colors.WARNING;
        break;
      case 'delete':
        actionEmoji = '🗑️';
        actionColor = Colors.ERROR;
        break;
      case 'reopen':
        actionEmoji = '🔓';
        actionColor = Colors.SUCCESS;
        break;
      case 'adduser':
        actionEmoji = '➕';
        actionColor = Colors.SUCCESS;
        break;
      case 'removeuser':
        actionEmoji = '➖';
        actionColor = Colors.WARNING;
        break;
      case 'setpriority':
        actionEmoji = '🚨';
        actionColor = Colors.WARNING;
        break;
      case 'note':
        actionEmoji = '📝';
        actionColor = Colors.INFO;
        break;
      case 'rating':
        actionEmoji = '⭐';
        // Set color based on rating
        if (rating) {
          if (rating >= 4) actionColor = Colors.SUCCESS;
          else if (rating === 3) actionColor = Colors.WARNING;
          else if (rating === 2) actionColor = Colors.SECONDARY;
          else actionColor = Colors.ERROR;
        } else {
          actionColor = Colors.INFO;
        }
        break;
    }
    
    // Format action name for display
    const actionName = action.charAt(0).toUpperCase() + action.slice(1);
    const formattedTicketNumber = ticketNumber.toString().padStart(4, '0');
    
    // Create a log embed
    const logEmbed = new EmbedBuilder()
      .setTitle(`${actionEmoji} Ticket ${actionName}`)
      .setColor(actionColor)
      .setDescription(`Ticket #${formattedTicketNumber} was ${action}${action === 'create' ? 'd' : 'ed'} ${user ? `by ${user.username}` : ''}`)
      .addFields([
        { name: '👤 User', value: user ? `${user.username} (${user.id})` : `Unknown (${userId})`, inline: true },
        { name: '🎫 Ticket', value: `#${formattedTicketNumber}`, inline: true }
      ])
      .setFooter({ text: `Made by Soggra. • Today at ${timeString}` });
    
    if (subject) {
      logEmbed.addFields({ name: '📂 Category', value: subject, inline: true });
    }
    
    if (closedBy) {
      const closedByUser = await client.users.fetch(closedBy).catch(() => null);
      if (closedByUser) {
        logEmbed.addFields({ name: '🔒 Closed By', value: `${closedByUser.username} (${closedByUser.id})`, inline: true });
      }
    }
    
    if (targetUser) {
      const targetUserObj = await client.users.fetch(targetUser).catch(() => null);
      if (targetUserObj) {
        logEmbed.addFields({ name: '🎯 Target User', value: `${targetUserObj.username} (${targetUserObj.id})`, inline: true });
      }
    }
    
    if (note) {
      logEmbed.addFields({ name: '📝 Note', value: note });
    }
    
    // For rating actions, show stars and feedback
    if (action === 'rating' && rating) {
      // Generate visual star rating
      const filledStar = '⭐';
      const emptyStar = '☆';
      const starDisplay = filledStar.repeat(rating) + emptyStar.repeat(5 - rating);
      
      // Replace the default description with more detailed info
      logEmbed.setDescription(`Ticket #${formattedTicketNumber} was rated by ${user ? user.username : 'a user'}`);
      
      // Add rating field
      logEmbed.addFields({ name: '⭐ Rating', value: starDisplay, inline: false });
      
      // Add feedback if provided
      if (feedback) {
        logEmbed.addFields({ name: '💬 Feedback', value: feedback });
      }
    }
    
    // Send the log embed to the log channel
    await logChannel.send({ embeds: [logEmbed] });
    logInfo('Ticket Logger', `Sent ${action} log to ticket logs channel for ticket #${ticketNumber}`);
  } catch (error) {
    logError('Ticket Logger', `Error sending log to channel: ${error}`);
  }
}
