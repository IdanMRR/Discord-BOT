import { Guild, User, TextChannel, TextBasedChannel, EmbedBuilder } from 'discord.js';
import { logModerationToDatabase } from './databaseLogger';
import { Colors } from './embeds';
import { settingsManager } from './settings';
import { db } from '../database/sqlite';

export interface LogResult {
  success: boolean;
  message?: string;
}

// Console logging functions
export function logInfo(category: string, message: string): void {
  console.log(`[INFO][${category}] ${message}`);
}

export function logWarning(category: string, message: string): void {
  console.warn(`[WARNING][${category}] ${message}`);
}

export function logError(category: string, error: any): void {
  console.error(`[ERROR][${category}]`, error);
}

// Log moderation actions to a specified channel and database
export async function logModeration(options: {
  guild: Guild;
  action: string;
  target: User;
  moderator: User;
  reason: string;
  duration?: string;
  additionalInfo?: string;
}): Promise<LogResult> {
  try {
    // Log to console
    logInfo('Moderation', `${options.action} | Target: ${options.target.tag} | Moderator: ${options.moderator.tag} | Reason: ${options.reason}`);
    
    // Log to database
    const dbResult = await logModerationToDatabase(options);
    
    if (!dbResult) {
      return { 
        success: true, 
        message: 'Action performed, but database logging failed. The action was still recorded in console logs.'
      };
    }
    
    // Get log channel ID from server settings
    // First try mod_log_channel_id, then fall back to log_channel_id
    const settings = await settingsManager.getSettings(options.guild.id);
    const logChannelId = settings?.mod_log_channel_id || settings?.log_channel_id;
    
    if (!logChannelId) {
      logWarning('Moderation', `No log channel set for guild ${options.guild.name} (${options.guild.id}). Skipping channel logging.`);
      // Return a message that can be used to inform the user
      return {
        success: true,
        message: `⚠️ No log channel has been set for this server. Moderation actions are saved in the database but won't be logged to a channel. \nServer administrators can set a log channel using the /setlogchannel command.`
      };
    }
    
    const logChannel = options.guild.channels.cache.get(logChannelId) as TextChannel;
    
    if (!logChannel || !logChannel.isTextBased()) {
      logWarning('Moderation', 'Log channel not found or is not a text channel. Skipping channel logging.');
      return {
        success: true,
        message: `⚠️ The configured log channel could not be found or is not a text channel. Moderation actions are saved in the database but won't be logged to a channel.`
      };
    }
    
    // Get the case number from the database
    const caseNumberStmt = db.prepare(`
      SELECT COUNT(*) as count FROM server_logs WHERE guild_id = ? AND action_type = 'memberWarning'
    `);
    const { count } = caseNumberStmt.get(options.guild.id) as { count: number };
    const caseNumber = count + 1;
    
    // Format the case number with leading zeros (e.g., 0001, 0002)
    const formattedCaseNumber = caseNumber.toString().padStart(4, '0');
    
    // Get emoji based on action type
    let actionEmoji = '⚠️';
    if (options.action.toLowerCase() === 'ban') {
      actionEmoji = '🔨';
    } else if (options.action.toLowerCase() === 'kick') {
      actionEmoji = '👢';
    } else if (options.action.toLowerCase() === 'timeout' || options.action.toLowerCase() === 'mute') {
      actionEmoji = '🔇';
    } else if (options.action.toLowerCase() === 'warning removed') {
      actionEmoji = '✅';
    } else if (options.action.toLowerCase() === 'unban') {
      actionEmoji = '🔓';
    }
    
    // Format the current time
    const now = new Date();
    const formattedTime = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    
    // Create a log embed matching the screenshot format
    const logEmbed = new EmbedBuilder()
      .setTitle(`${actionEmoji} ${options.action.toUpperCase()} | Case #${formattedCaseNumber}`)
      .setColor(getColorForAction(options.action))
      .setDescription(`${options.target} (${options.target.id}) has been ${options.action.toLowerCase() === 'warning' ? 'warned' : options.action.toLowerCase() + 'ed'} by ${options.moderator}.`)
      .setThumbnail(options.target.displayAvatarURL({ size: 256 }))
      .addFields([{ name: 'Reason:', value: options.reason }])
      .addFields([{ name: 'This action was taken on', value: formattedTime }])
      .addFields([
        { name: '👤 User Information', value: `Tag: ${options.target.username}\nID: ${options.target.id}\nCreated: 6 years ago`, inline: false },
        { name: `${actionEmoji} Moderator Information`, value: `Tag: ${options.moderator.username}\nID: ${options.moderator.id}`, inline: false }
      ])
      .addFields([{ name: '📝 Detailed Reason', value: options.reason || 'No reason provided' }]);
    
    // Add the case number, server and warning count fields in a clean row
    const activeWarningsStmt = db.prepare(`
      SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1
    `);
    const { count: warningCount } = activeWarningsStmt.get(options.guild.id, options.target.id) as { count: number };
    
    logEmbed.addFields([
      { name: '🏠 Server', value: options.guild.name, inline: true },
      { name: '⚠️ Warning Count', value: warningCount.toString(), inline: true },
      { name: '📋 Case Number', value: `#${formattedCaseNumber}`, inline: true }
    ]);
    
    // Format the footer with the current time
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    logEmbed.setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
    
    if (options.duration) {
      logEmbed.addFields({ name: '⏱️ Duration', value: options.duration, inline: true });
    }
    
    if (options.additionalInfo) {
      logEmbed.addFields({ name: 'Additional Information', value: options.additionalInfo, inline: false });
    }
    
    // Send the log embed to the log channel
    await logChannel.send({ embeds: [logEmbed] });
    
    return { success: true };
  } catch (error) {
    logError('Moderation', error);
    return { 
      success: false, 
      message: 'Failed to log moderation action. The action was still performed, but it may not have been recorded in all logs.'
    };
  }
}

function getColorForAction(action: string): number {
  switch (action.toLowerCase()) {
    case 'ban':
      return Colors.ERROR;
    case 'kick':
      return Colors.WARNING;
    case 'timeout':
    case 'mute':
      return Colors.WARNING;
    case 'warning':
      return Colors.WARNING;
    case 'warning removed':
      return Colors.SUCCESS;
    case 'unban':
      return Colors.SUCCESS;
    default:
      return Colors.PRIMARY;
  }
}

/**
 * Helper function to get a display name for different channel types
 */
function getChannelName(channel: TextBasedChannel): string {
  if ('name' in channel && channel.name) {
    return channel.name as string;
  } else if ('isDMBased' in channel && typeof channel.isDMBased === 'function' && channel.isDMBased()) {
    return 'Direct Message';
  } else {
    return 'Unknown Channel';
  }
}

/**
 * Log direct messages sent by the bot to users
 * This helps track when and why DMs were sent to users
 */
export async function logDirectMessage(options: {
  guild: Guild;
  sender: User;
  recipient: User;
  content: string;
  command?: string;
  success: boolean;
  error?: string;
}): Promise<LogResult> {
  try {
    // Log to console
    logInfo('DirectMessage', `DM sent by ${options.sender.tag} to ${options.recipient.tag} | Success: ${options.success}`);
    
    // Create the dm_logs table if it doesn't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS dm_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        content TEXT NOT NULL,
        command TEXT,
        success INTEGER NOT NULL,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Log to database
    const stmt = db.prepare(`
      INSERT INTO dm_logs (guild_id, sender_id, recipient_id, content, command, success, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      options.guild.id,
      options.sender.id,
      options.recipient.id,
      options.content,
      options.command || null,
      options.success ? 1 : 0,
      options.error || null
    );
    
    // Get log channel ID from server settings
    const settings = await settingsManager.getSettings(options.guild.id);
    const logChannelId = settings?.log_channel_id || null;
    
    if (!logChannelId) {
      return { success: true };
    }
    
    const logChannel = options.guild.channels.cache.get(logChannelId) as TextChannel;
    
    if (!logChannel || !logChannel.isTextBased()) {
      return { success: true };
    }
    
    // Format the current time
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Create a log embed
    const logEmbed = new EmbedBuilder()
      .setTitle(`💬 Direct Message ${options.success ? 'Sent' : 'Failed'}`)
      .setColor(options.success ? Colors.SUCCESS : Colors.ERROR)
      .setDescription(`A direct message was ${options.success ? 'sent to' : 'attempted to be sent to'} ${options.recipient}.`)
      .addFields([
        { name: '👤 Recipient', value: `${options.recipient.username} (${options.recipient.id})`, inline: true },
        { name: '👮 Sender', value: `${options.sender.username} (${options.sender.id})`, inline: true },
        { name: '🤖 Command', value: options.command || 'Not specified', inline: true },
        { name: '📝 Content', value: options.content.length > 1024 ? options.content.substring(0, 1021) + '...' : options.content }
      ])
      .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
    
    if (!options.success && options.error) {
      logEmbed.addFields({ name: '❌ Error', value: options.error });
    }
    
    // Send the log embed to the log channel
    await logChannel.send({ embeds: [logEmbed] });
    
    return { success: true };
  } catch (error) {
    logError('DirectMessage', error);
    return { success: false };
  }
}

/**
 * Log command usage for auditing and analytics
 */
export async function logCommandUsage(options: {
  guild: Guild;
  user: User;
  command: string;
  options?: Record<string, any>;
  channel: TextBasedChannel | null;
  success: boolean;
  error?: string;
}): Promise<void> {
  try {
    // Log to console
    logInfo('Command', `${options.command} used by ${options.user.tag} in ${options.guild.name} | Success: ${options.success}`);
    
    // Create the command_logs table if it doesn't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS command_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        command TEXT NOT NULL,
        options TEXT,
        channel_id TEXT NOT NULL,
        success INTEGER NOT NULL,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Log to database
    const stmt = db.prepare(`
      INSERT INTO command_logs (guild_id, user_id, command, options, channel_id, success, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      options.guild.id,
      options.user.id,
      options.command,
      options.options ? JSON.stringify(options.options) : null,
      options.channel?.id || null,
      options.success ? 1 : 0,
      options.error || null
    );
    
    // Get log channel ID from server settings
    const settings = await settingsManager.getSettings(options.guild.id);
    const logChannelId = settings?.log_channel_id || null;
    
    // If no log channel is set or we don't want to log all commands, just return
    if (!logChannelId || !settings?.log_all_commands) {
      return;
    }
    
    const logChannel = options.guild.channels.cache.get(logChannelId) as TextChannel;
    
    if (!logChannel || !logChannel.isTextBased()) {
      return;
    }
    
    // Format the current time
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Create a log embed
    const logEmbed = new EmbedBuilder()
      .setTitle(`🔧 Command ${options.success ? 'Used' : 'Failed'}`)
      .setColor(options.success ? Colors.INFO : Colors.ERROR)
      .setDescription(`Command /${options.command} was used by ${options.user}.`)
      .addFields([
        { name: '👤 User', value: `${options.user.username} (${options.user.id})`, inline: true },
        { name: '📝 Command', value: `/${options.command}`, inline: true },
        { name: '📂 Channel', value: options.channel ? `${getChannelName(options.channel)} (${options.channel.id})` : 'Unknown Channel', inline: true }
      ])
      .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
    
    if (options.options && Object.keys(options.options).length > 0) {
      const optionsString = Object.entries(options.options)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      
      logEmbed.addFields({ name: '⚙️ Options', value: optionsString });
    }
    
    if (!options.success && options.error) {
      logEmbed.addFields({ name: '❌ Error', value: options.error });
    }
    
    // Send the log embed to the log channel
    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    logError('Command', error);
  }
}

/**
 * Log ticket actions for auditing
 */
export async function logTicketAction(options: {
  guild: Guild;
  user: User;
  action: 'create' | 'close' | 'delete' | 'reopen' | 'transfer' | 'addUser' | 'removeUser' | 'setPriority';
  ticketNumber: number;
  ticketId: number;
  category?: string;
  targetUser?: User;
  additionalInfo?: string;
}): Promise<void> {
  try {
    // Log to console
    logInfo('Ticket', `${options.action} | Ticket #${options.ticketNumber} | User: ${options.user.tag}`);
    
    // Create the ticket_action_logs table if it doesn't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ticket_action_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        ticket_id INTEGER NOT NULL,
        ticket_number INTEGER NOT NULL,
        category TEXT,
        target_user_id TEXT,
        additional_info TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id)
      )
    `).run();
    
    // Log to database
    const stmt = db.prepare(`
      INSERT INTO ticket_action_logs (guild_id, user_id, action, ticket_id, ticket_number, category, target_user_id, additional_info, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      options.guild.id,
      options.user.id,
      options.action,
      options.ticketId,
      options.ticketNumber,
      options.category || null,
      options.targetUser?.id || null,
      options.additionalInfo || null
    );
    
    // Get log channel ID from server settings
    const settings = await settingsManager.getSettings(options.guild.id);
    const logChannelId = settings?.ticket_logs_channel_id || settings?.log_channel_id || null;
    
    if (!logChannelId) {
      return;
    }
    
    const logChannel = options.guild.channels.cache.get(logChannelId) as TextChannel;
    
    if (!logChannel || !logChannel.isTextBased()) {
      return;
    }
    
    // Format the current time
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Get action emoji and color
    let actionEmoji = '🎫';
    let actionColor = Colors.PRIMARY;
    
    switch (options.action) {
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
      case 'transfer':
        actionEmoji = '🔄';
        actionColor = Colors.INFO;
        break;
      case 'addUser':
        actionEmoji = '➕';
        actionColor = Colors.SUCCESS;
        break;
      case 'removeUser':
        actionEmoji = '➖';
        actionColor = Colors.WARNING;
        break;
      case 'setPriority':
        actionEmoji = '🚨';
        actionColor = Colors.WARNING;
        break;
    }
    
    // Format action name for display
    const actionName = options.action.charAt(0).toUpperCase() + options.action.slice(1);
    
    // Create a log embed
    const logEmbed = new EmbedBuilder()
      .setTitle(`${actionEmoji} Ticket ${actionName}`)
      .setColor(actionColor)
      .setDescription(`Ticket #${options.ticketNumber.toString().padStart(4, '0')} was ${options.action}ed by ${options.user}.`)
      .addFields([
        { name: '👤 User', value: `${options.user.username} (${options.user.id})`, inline: true },
        { name: '🎫 Ticket', value: `#${options.ticketNumber.toString().padStart(4, '0')}`, inline: true }
      ])
      .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
    
    if (options.category) {
      logEmbed.addFields({ name: '📂 Category', value: options.category, inline: true });
    }
    
    if (options.targetUser) {
      logEmbed.addFields({ name: '🎯 Target User', value: `${options.targetUser.username} (${options.targetUser.id})`, inline: true });
    }
    
    if (options.additionalInfo) {
      logEmbed.addFields({ name: '📝 Additional Info', value: options.additionalInfo });
    }
    
    // Send the log embed to the log channel
    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    logError('Ticket', error);
  }
}
