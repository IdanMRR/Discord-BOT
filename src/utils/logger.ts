import { Guild, User, TextChannel, TextBasedChannel, EmbedBuilder } from 'discord.js';
import { logModerationToDatabase } from './databaseLogger';
import { Colors } from './embeds';
import { settingsManager } from './settings';
import { db } from '../database/sqlite';
import fetch from 'node-fetch';
import { ServerSettingsService } from '../database/services/serverSettingsService';
import { formatIsraeliTime } from './time-formatter';


// Dashboard API configuration - use environment variable or detect the actual port
const DASHBOARD_API_BASE_URL = process.env.API_URL || `http://localhost:${process.env.API_PORT || 3001}`;
const DASHBOARD_API_URL = `${DASHBOARD_API_BASE_URL}/api`;
const DASHBOARD_SYNC_ENABLED = true; // Set to false to disable dashboard syncing
const DASHBOARD_API_KEY = process.env.API_KEY || 'f8e7d6c5b4a3928170615243cba98765'; // Use the same API key as defined in .env

/**
 * Function to push logs to the dashboard API
 * This ensures events from the bot are properly synced with the dashboard
 */
async function pushLogToDashboard(logData: {
  guild_id: string;
  user_id?: string | null;
  action: string;
  details?: string;
  log_type: string;
  metadata?: any;
}): Promise<boolean> {
  if (!DASHBOARD_SYNC_ENABLED) {
    return false;
  }
  
  try {
    // Add safety checks for required data
    if (!logData.guild_id) {
      logError('Dashboard Sync', 'Guild ID is missing in pushLogToDashboard');
      return false;
    }
    
    if (!logData.action) {
      logError('Dashboard Sync', 'Action is missing in pushLogToDashboard');
      return false;
    }

    // Add timeout to the fetch request to prevent long hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    // Use the correct API endpoint for dashboard logs
    const response = await fetch(`${DASHBOARD_API_BASE_URL}/api/dashboard-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': DASHBOARD_API_KEY
      },
      body: JSON.stringify(logData),
      signal: controller.signal as any // Type cast to avoid AbortSignal compatibility issue
    }).catch((err: Error & { name?: string }) => {
      // Handle network errors
      if (err.name === 'AbortError') {
        throw new Error('API request timed out after 3 seconds');
      }
      throw err;
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`API Error: ${response.status} - ${errorData.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data.success;
  } catch (error: any) {
    // Don't log connection errors repeatedly to avoid console spam
    if (error.message && error.message.includes('failed, reason:')) {
      console.log('[Dashboard Sync] API server not available - skipping log sync');
    } else {
      logError('Dashboard Sync', `Failed to push log to dashboard: ${error}`);
    }
    return false;
  }
}

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
  caseNumber?: number; // Accept case number from the warning creation
}): Promise<LogResult> {
  try {
    // Get the current time
    const now = new Date();
    
    // Check if the guild has a log channel set
    const serverSettings = await ServerSettingsService.getOrCreate(options.guild.id, options.guild.name);
    const logChannelId = serverSettings?.member_log_channel_id || serverSettings?.mod_log_channel_id || serverSettings?.log_channel_id;
    
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
      logWarning('Moderation', `Log channel not found or is not a text channel. Channel ID: ${logChannelId}, Guild: ${options.guild.name} (${options.guild.id}). Skipping channel logging.`);
      return {
        success: true,
        message: `⚠️ The configured log channel (ID: ${logChannelId}) could not be found or is not a text channel. Moderation actions are saved in the database but won't be logged to a channel.`
      };
    }
    
    // Use the provided case number or get the next one if not provided
    let caseNumber = options.caseNumber;
    if (!caseNumber) {
      // Only generate a new case number if one isn't provided
      const caseNumberStmt = db.prepare(`
        SELECT MAX(case_number) as max_case FROM warnings WHERE guild_id = ?
      `);
      const { max_case } = caseNumberStmt.get(options.guild.id) as { max_case: number | null };
      caseNumber = (max_case !== null ? max_case + 1 : 1);
    }
    
    // Format the case number with leading zeros (e.g., 0001, 0002)
    const formattedCaseNumber = caseNumber.toString().padStart(4, '0');
    
    // Get emoji based on action type
    let actionEmoji = '⚠️';
    switch (options.action.toLowerCase()) {
      case 'ban':
        actionEmoji = '🔨';
        break;
      case 'kick':
        actionEmoji = '👢';
        break;
      case 'mute':
      case 'timeout':
        actionEmoji = '🔇';
        break;
      case 'warn':
      case 'warning':
        actionEmoji = '⚠️';
        break;
      case 'unban':
        actionEmoji = '🔓';
        break;
      case 'warning removed':
        actionEmoji = '✅';
        break;
      default:
        actionEmoji = '🛡️';
        break;
    }
    
    // Create a rich moderation embed matching the expected format
    const logEmbed = new EmbedBuilder()
      .setTitle(`${actionEmoji} ${options.action.toUpperCase()} | Case #${formattedCaseNumber}`)
      .setColor(getColorForAction(options.action)) // Use dynamic color based on action
      .setThumbnail(options.target.displayAvatarURL({ size: 128 }))
      .setTimestamp(now);
    
    // Add the case number, server and warning count fields in a clean row
    const activeWarningsStmt = db.prepare(`
      SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1
    `);
    let { count: warningCount } = activeWarningsStmt.get(options.guild.id, options.target.id) as { count: number };
    
    // For warning removed actions, the count reflects AFTER removal, so we add 1 to show what it was before
    if (options.action.toLowerCase() === 'warning removed') {
      warningCount += 1;
    }
    
    // Add user information section
    logEmbed.addFields([
      { 
        name: '👤 User Information', 
        value: `**Tag:** ${options.target.tag}\n**ID:** ${options.target.id}\n**Account Created:** <t:${Math.floor(options.target.createdTimestamp / 1000)}:D>`, 
        inline: true 
      },
      { 
        name: '🛡️ Moderator Information', 
        value: `**Tag:** ${options.moderator.tag}\n**ID:** ${options.moderator.id}`, 
        inline: true 
      },
      { name: '\u200B', value: '\u200B', inline: true }, // Spacer for layout
      { name: '🏠 Server', value: options.guild.name, inline: true },
      { name: '⚠️ Warning Count', value: warningCount.toString(), inline: true },
      { name: '📋 Case Number', value: `#${formattedCaseNumber}`, inline: true }
    ]);
    
    // Add reason as a separate field
    logEmbed.addFields([
      { name: '📝 Reason', value: options.reason, inline: false }
    ]);
    
    // Format the footer with the current time in Israeli timezone
    const timeString = formatIsraeliTime(now);
    logEmbed.setFooter({ text: `Made by Soggra. • Today at ${timeString}` });
    
    if (options.duration) {
      logEmbed.addFields({ name: '⏱️ Duration', value: options.duration, inline: true });
    }
    
    if (options.additionalInfo) {
      logEmbed.addFields({ name: 'Additional Information', value: options.additionalInfo, inline: false });
    }
    
    // Send the log embed to the log channel
    logInfo('Moderation', `Attempting to send moderation log to channel ${logChannelId} in guild ${options.guild.name} (${options.guild.id})`);
    await logChannel.send({ embeds: [logEmbed] });
    logInfo('Moderation', `Successfully sent moderation log for ${options.action} action (Case #${formattedCaseNumber})`);
    
    return { success: true };
  } catch (error) {
    logError('Moderation', `Failed to send moderation log to channel ${options.guild.name} (${options.guild.id}): ${error}`);
    return { 
      success: false, 
      message: `Failed to log moderation action to channel. The action was still performed and saved in the database. Error: ${error instanceof Error ? error.message : String(error)}`
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
  caseNumber?: number;
}): Promise<LogResult> {
  try {
    // Log to console
    logInfo('DirectMessage', `DM sent by ${options.sender.tag} to ${options.recipient.tag} | Success: ${options.success}`);
    
    // Check if dm_logs table exists and get its structure
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dm_logs'").get();
    
    if (!tableExists) {
      // Create the table with the new schema if it doesn't exist
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
    } else {
      // Get current table structure
      const columns = db.pragma('table_info(dm_logs)') as { name: string }[];
      const columnNames = columns.map(col => col.name);
      
      // Check if this is a mixed schema (has both old and new columns)
      if (columnNames.includes('user_id') && columnNames.includes('sender_id')) {
        // Mixed schema - fill both old and new columns to avoid NOT NULL constraints
        const stmt = db.prepare(`
          INSERT INTO dm_logs (
            user_id, bot_id, content, embed_json, components_json, 
            source_command, source_guild_id, guild_id, sender_id, 
            recipient_id, command, success, error, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        stmt.run(
          options.sender.id,        // user_id (old column)
          options.recipient.id,     // bot_id (old column)
          options.content,          // content
          null,                     // embed_json
          null,                     // components_json
          options.command || null,  // source_command
          options.guild.id,         // source_guild_id
          options.guild.id,         // guild_id (new column)
          options.sender.id,        // sender_id (new column)
          options.recipient.id,     // recipient_id (new column)
          options.command || null,  // command (new column)
          options.success ? 1 : 0,  // success (new column)
          options.error || null,    // error (new column)
        );
      } else if (columnNames.includes('user_id') && !columnNames.includes('sender_id')) {
        // Pure old schema
        const stmt = db.prepare(`
          INSERT INTO dm_logs (
            user_id, bot_id, content, embed_json, components_json, 
            source_command, source_guild_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        stmt.run(
          options.sender.id,        // user_id (old column)
          options.recipient.id,     // bot_id (old column)
          options.content,          // content
          null,                     // embed_json
          null,                     // components_json
          options.command || null,  // source_command
          options.guild.id,         // source_guild_id
        );
      } else {
        // Pure new schema
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
      }
    }
    
    // Get log channel ID from server settings
    const settings = await settingsManager.getSettings(options.guild.id);
    const logChannelId = settings?.mod_log_channel_id || settings?.log_channel_id || settings?.member_log_channel_id || null;
    
    if (!logChannelId) {
      logWarning('DirectMessage', `No log channel set for guild ${options.guild.name} (${options.guild.id}). DM logged to database only.`);
      return { success: true };
    }
    
    const logChannel = options.guild.channels.cache.get(logChannelId) as TextChannel;
    
    if (!logChannel || !logChannel.isTextBased()) {
      return { success: true };
    }
    
    // Format the current time in Israeli timezone
    const now = new Date();
    const timeString = formatIsraeliTime(now);
    
    // Create a log embed
    const logEmbed = new EmbedBuilder()
      .setTitle(`💬 Direct Message ${options.success ? 'Sent' : 'Failed'}`)
      .setColor(options.success ? Colors.SUCCESS : Colors.ERROR)
      .setDescription(`A direct message was ${options.success ? 'sent to' : 'attempted to be sent to'} ${options.recipient}.`)
      .addFields([
        { name: '👤 Recipient', value: `${options.recipient.username} (${options.recipient.id})`, inline: true },
        { name: '👮 Sender', value: `${options.sender.username} (${options.sender.id})`, inline: true },
        { name: '🤖 Command', value: options.command || 'Not specified', inline: true },
        ...(options.caseNumber ? [{ name: '📋 Case Number', value: `#${options.caseNumber}`, inline: true }] : []),
        { name: '📝 Content', value: options.content.length > 1024 ? options.content.substring(0, 1021) + '...' : options.content }
      ])
      .setFooter({ text: `Made by Soggra. • Today at ${timeString}` });
    
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
    // Add safety checks for required objects
    if (!options.guild) {
      logError('Command Logger', 'Guild is undefined in logCommandUsage');
      return;
    }
    
    if (!options.user) {
      logError('Command Logger', 'User is undefined in logCommandUsage');
      return;
    }

    // Check if command logging is enabled
    try {
      const settingsStmt = db.prepare('SELECT command_logging FROM logging_settings WHERE guild_id = ?');
      const settings = settingsStmt.get(options.guild.id) as { command_logging?: number } | undefined;
      
      if (settings && settings.command_logging === 0) {
        return; // Command logging disabled
      }
    } catch (error) {
      // If no settings table, default to enabled
    }

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
    
    // Also create a log entry in the main server_logs table
    try {
      // Now insert the log entry using server_logs table
      db.prepare(`
        INSERT INTO server_logs (guild_id, user_id, action_type, details, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        options.guild.id,
        options.user.id,
        'command_used',
        `${options.command}${options.options ? ' ' + JSON.stringify(options.options) : ''} - ${options.success ? 'Success' : `Failed: ${options.error || 'Unknown error'}`}`
      );
    } catch (error) {
      console.error('[Logger] Error logging command usage to database:', error);
      // Continue execution - don't let logging errors break command functionality
    }

    // Note: Dashboard API logging removed to prevent duplicates
    // The dashboard reads directly from the command_logs table above

    // Get log channel ID from server settings for Discord channel logging
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
    
    // Format the current time in Israeli timezone
    const now = new Date();
    const timeString = formatIsraeliTime(now);
    
    // Create a log embed for Discord channel
    const logEmbed = new EmbedBuilder()
      .setTitle(`🔧 Command ${options.success ? 'Used' : 'Failed'}`)
      .setColor(options.success ? Colors.INFO : Colors.ERROR)
      .setDescription(`Command /${options.command} was used by ${options.user}.`)
      .addFields([
        { name: '👤 User', value: `${options.user.username} (${options.user.id})`, inline: true },
        { name: '📝 Command', value: `/${options.command}`, inline: true },
        { name: '📂 Channel', value: options.channel ? `${getChannelName(options.channel)} (${options.channel.id})` : 'Unknown Channel', inline: true }
      ])
      .setFooter({ text: `Made by Soggra. • Today at ${timeString}` });
    
    if (options.options && Object.keys(options.options).length > 0) {
      const optionsString = Object.entries(options.options)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      
      logEmbed.addFields({ name: '⚙️ Options', value: optionsString });
    }
    
    if (!options.success && options.error) {
      logEmbed.addFields({ name: '❌ Error', value: options.error });
    }
    
    // Send the log embed to the Discord log channel
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
    // Add safety checks for required objects
    if (!options.guild) {
      logError('Ticket Logger', 'Guild is undefined in logTicketAction');
      return;
    }
    
    if (!options.user) {
      logError('Ticket Logger', 'User is undefined in logTicketAction');
      return;
    }

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
    
    // Format the current time in Israeli timezone
    const now = new Date();
    const timeString = formatIsraeliTime(now);
    
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
      .setFooter({ text: `Made by Soggra. • Today at ${timeString}` });
    
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

// Dashboard logging function
export async function logCommandToDashboard(logData: any): Promise<void> {
  try {
    // Use the dynamic API URL instead of hardcoded localhost:3001
    const apiUrl = process.env.API_URL || `http://localhost:${process.env.API_PORT || 3001}`;
    
    const response = await fetch(`${apiUrl}/api/dashboard/command-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.API_KEY || 'f8e7d6c5b4a3928170615243cba98765'
      },
      body: JSON.stringify(logData),
      timeout: 5000 // 5 second timeout
    });

    if (!response.ok) {
      console.log(`[Dashboard Sync] API server responded with status ${response.status} - skipping log sync`);
      return;
    }

    console.log('[Dashboard Sync] Successfully logged command to dashboard');
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      console.log('[Dashboard Sync] API server not available - skipping log sync');
    } else {
      console.error('[ERROR][Dashboard API] Failed to log command to dashboard:', error.message);
    }
  }
}
