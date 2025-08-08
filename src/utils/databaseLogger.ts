import { Guild, User, GuildMember } from 'discord.js';
import { logInfo, logError } from './logger';
import { ServerLogService } from '../database/services/sqliteService';
import { ServerSettingsService } from '../database/services/serverSettingsService';
import { formatIsraeliTime } from './time-formatter';

/**
 * Log an event to the database
 */
export async function logToDatabase(options: {
  guildId: string;
  actionType: string;
  userId?: string; // Made optional to handle system-generated events
  targetId?: string;
  channelId?: string;
  messageId?: string;
  reason?: string;
  details?: any;
}): Promise<boolean> {
  try {
    const { guildId, actionType, userId = 'system', targetId, channelId, messageId, reason, details } = options;
    
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
      case 'unban':
        actionType = 'memberUnban';
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
    
    // Create a new log entry with clearer format
    const result = await ServerLogService.create({
      guild_id: guild.id,
      action_type: actionType,
      user_id: moderator.id,     // The moderator who performed the action
      target_id: target.id,      // The target user (the user being acted upon)
      reason: reason,            // Just the actual reason, not formatted string
      details: {
        action,
        targetTag: target.tag,
        moderatorTag: moderator.tag,
        targetUsername: target.username,
        moderatorUsername: moderator.username,
        targetId: target.id,
        moderatorId: moderator.id,
        duration,
        additionalInfo,
        formattedReason: reason
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
  userId?: string; // Made optional to handle system-generated deletions
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
  
  // Skip old server_logs to avoid duplicates - ONLY use dashboard logging for cleaner display
  let mainLogResult = true;
  
  // Log to DashboardLogsService for dashboard display
  try {
    const { DashboardLogsService } = await import('../database/services/dashboardLogsService');
    const { getClient } = await import('../utils/client-utils');
    
    // Get user information for better logging
    let username = 'Unknown User';
    try {
      const client = getClient();
      if (client) {
        const user = await client.users.fetch(userId);
        username = user ? user.username : `User ${userId.slice(-4)}`;
      }
    } catch (userError) {
      // Fallback to userId
      username = `User ${userId.slice(-4)}`;
    }
    
    // Create readable log message based on action type - matching Discord embed format
    let logMessage = '';
    let logDetails = '';
    const formattedTicketNumber = ticketNumber.toString().padStart(4, '0');
    
    // For ticket close, create multiple log entries like in the screenshot
    if (actionType === 'ticketClose') {
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      // 1. First create the "Ticket Transcript" log entry
      await DashboardLogsService.logActivity({
        user_id: userId,
        username: username,
        action_type: 'ticketTranscript',
        page: 'tickets',
        target_type: 'ticket', 
        target_id: ticketNumber.toString(),
        old_value: null,
        new_value: JSON.stringify({ ticketNumber, category: subject, transcriptGenerated: true }),
        details: `📋 **Ticket Transcript | #${formattedTicketNumber}**\n\nYour ticket #${formattedTicketNumber} has been closed.\nA transcript is attached for your records.\n\n📂 **Category**\n${subject || 'question'}\n\n👤 **Closed By**\n@${username}\n\n🕒 **Closed At**\n<t:${Math.floor(Date.now() / 1000)}:f>\n\nMade by Soggra. • Today at ${currentTime} • Yesterday at ${currentTime}`,
        success: true,
        guild_id: guildId
      });
      
      // 2. Then create the "Your Ticket Has Been Closed" log entry
      await DashboardLogsService.logActivity({
        user_id: userId,
        username: username,
        action_type: 'ticketClose',
        page: 'tickets',
        target_type: 'ticket',
        target_id: ticketNumber.toString(),
        old_value: null,
        new_value: JSON.stringify({ ticketNumber, subject, closedBy, note }),
        details: `🔒 **Your Ticket Has Been Closed | #${formattedTicketNumber}**\n\nYour support ticket in **Coding API** has been closed.\n\n📂 **Ticket Number**\n#${formattedTicketNumber}\n\n🏷️ **Category**\n${subject || 'General Question'}\n\n📝 **Reason**\n${note || 'Information Provided'}\n\n🔒 **Closed By**\n@${username}\n\n🕒 **Closed At**\n${currentTime}\n\nMade by Soggra. • ${currentTime} • Yesterday at ${currentTime}`,
        success: true,
        guild_id: guildId
      });
      
      // 3. Finally create the "Rate Your Support Experience" log entry
      await DashboardLogsService.logActivity({
        user_id: userId,
        username: username,
        action_type: 'ticketRatingPrompt',
        page: 'tickets',
        target_type: 'ticket',
        target_id: ticketNumber.toString(),
        old_value: null,
        new_value: JSON.stringify({ ticketNumber, category: subject, ratingPromptSent: true }),
        details: `⭐ **Rate Your Support Experience**\n\nWe value your feedback! Please rate your support experience to help us improve our service.\n\n📂 **Ticket**\n#${formattedTicketNumber}\n\n🏷️ **Category**\n${subject || 'General Question'}\n\nYesterday at ${currentTime}`,
        success: true,
        guild_id: guildId
      });
      
    } else {
      // Handle other ticket actions normally
      switch (actionType) {
        case 'ticketCreate':
          logMessage = `🆕 Ticket Created | #${formattedTicketNumber}`;
          logDetails = `A new support ticket has been created.\n\n📂 **Category**\n${subject || 'General Support'}\n\n👤 **Created By**\n@${username}\n\n📅 **Created At**\n<t:${Math.floor(Date.now() / 1000)}:f>`;
          break;
        case 'ticketDelete':
          logMessage = `🗑️ Ticket Deleted | #${formattedTicketNumber}`;
          logDetails = `Your ticket #${formattedTicketNumber} has been deleted.\nA transcript is attached for your records.\n\n📂 **Category**\n${subject || 'General Support'}\n\n📝 **Reason**\n${note || 'Staff Decision'}\n\n🗑️ **Deleted By**\n@${username}\n\n🕒 **Deleted At**\n<t:${Math.floor(Date.now() / 1000)}:f>\n\n⚠️ This action is permanent and cannot be undone\n\nMade by Soggra. • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
          break;
        case 'ticketReopen':
          logMessage = `🔓 Ticket Reopened | #${formattedTicketNumber}`;
          logDetails = `Your ticket #${formattedTicketNumber} has been reopened.\n\n📂 **Category**\n${subject || 'General Support'}\n\n📝 **Reason**\n${note || 'User Request'}\n\n🔓 **Reopened By**\n@${username}\n\n📅 **Reopened At**\n<t:${Math.floor(Date.now() / 1000)}:f>\n\nMade by Soggra. • Today at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
          break;
        case 'ticketRating':
          logMessage = `⭐ Rate Your Support Experience`;
          logDetails = `We value your feedback! Please rate your support experience to help us improve our service.\n\n📂 **Ticket**\n#${formattedTicketNumber}\n\n🏷️ **Category**\n${subject || 'General Support'}${rating ? `\n\n⭐ **Rating**\n${rating}/5 stars` : ''}${feedback ? `\n\n💬 **Feedback**\n${feedback}` : ''}\n\nYesterday at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
          break;
        default:
          logMessage = `🎫 Ticket Action | #${formattedTicketNumber}`;
          logDetails = `Ticket action performed: ${actionType}\n\n👤 **User**\n@${username}\n\n📅 **Time**\n<t:${Math.floor(Date.now() / 1000)}:f>`;
      }
      
      await DashboardLogsService.logActivity({
        user_id: userId,
        username: username,
        action_type: actionType,
        page: 'tickets',
        target_type: 'ticket',
        target_id: ticketNumber.toString(),
        old_value: null,
        new_value: JSON.stringify({ 
          ticketNumber, 
          subject, 
          priority, 
          rating, 
          feedback,
          closedBy,
          targetUser,
          note 
        }),
        details: logDetails,
        success: true,
        guild_id: guildId
      });
    }
    
    logInfo('Ticket Logger', `Logged ${actionType} to dashboard logs for ticket #${ticketNumber}`);
  } catch (dashboardError) {
    logError('Ticket Logger', `Failed to log to dashboard: ${dashboardError}`);
  }
  
  // Skip old ticket_action_logs and channel logging to avoid old embeds and duplicates
  return true;
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
      logInfo('Ticket Logger', 'No ticket logs channel configured, skipping log message');
      return;
    }
    
    // Get the Discord client
    const { client } = require('../index');
    const { EmbedBuilder, TextChannel } = require('discord.js');
    const { Colors } = require('../utils/embeds');
    
    // Get the guild
    const guild = await client.guilds.fetch(guildId).catch((error: any) => {
      logError('Ticket Logger', `Error fetching guild ${guildId}: ${error}`);
      return null;
    });
    
    if (!guild) {
      logError('Ticket Logger', `Guild ${guildId} not found`);
      return;
    }
    
    // Get the channel with proper error handling
    let logChannel;
    try {
      logChannel = await guild.channels.fetch(settings.ticket_logs_channel_id);
    } catch (channelError: any) {
      if (channelError.code === 10003) {
        // Unknown Channel error - channel was deleted
        logError('Ticket Logger', `Ticket logs channel ${settings.ticket_logs_channel_id} no longer exists (deleted). Please reconfigure ticket logs channel.`);
        
        // Clear the invalid channel ID from settings to prevent future errors
        try {
          delete settings.ticket_logs_channel_id;
          await settingsManager.updateSettings(guildId, settings);
          logInfo('Ticket Logger', 'Cleared invalid ticket logs channel ID from settings');
        } catch (updateError) {
          logError('Ticket Logger', `Error clearing invalid channel ID: ${updateError}`);
        }
      } else {
        logError('Ticket Logger', `Error fetching ticket logs channel: ${channelError}`);
      }
      return;
    }
    
    if (!logChannel || !logChannel.isTextBased()) {
      logError('Ticket Logger', `Ticket logs channel ${settings.ticket_logs_channel_id} is not a text channel`);
      return;
    }
    
    // Get user information
    const user = await client.users.fetch(userId).catch(() => null);
    
    // Format the current time in Israeli timezone
    const timeString = formatIsraeliTime();
    
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
    
    // Send the log embed to the log channel with error handling
    try {
      await logChannel.send({ embeds: [logEmbed] });
      logInfo('Ticket Logger', `Sent ${action} log to ticket logs channel for ticket #${ticketNumber}`);
    } catch (sendError: any) {
      if (sendError.code === 10003) {
        // Channel was deleted while we were processing
        logError('Ticket Logger', `Ticket logs channel was deleted while sending log for ticket #${ticketNumber}`);
      } else {
        logError('Ticket Logger', `Error sending log message: ${sendError}`);
      }
    }
  } catch (error) {
    logError('Ticket Logger', `Error sending log to channel: ${error}`);
  }
}
