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
    feedback
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
    return true;
  } catch (error) {
    logError('Ticket Logger', `Failed to log to ticket_action_logs: ${error}`);
    // Still return the result of the main log
    return mainLogResult;
  }
}
