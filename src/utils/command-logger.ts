import { Guild, User, TextBasedChannel } from 'discord.js';
import { db } from '../database/sqlite';
import { logInfo, logError } from './logger';

interface CommandLogOptions {
  guild: Guild;
  user: User;
  command: string;
  options?: Record<string, any>;
  success?: boolean;
  error?: string;
  channel_id?: string;
  channel?: TextBasedChannel | string | null; // Allow channel object, string ID, or null
}

/**
 * Log command usage to the database
 */
export async function logCommandUsage(options: CommandLogOptions): Promise<void> {
  try {
    const { guild, user, command, options: cmdOptions, success = true, error, channel_id, channel } = options;
    
    // Extract channel ID from channel object or use string directly
    let channelId = channel_id;
    if (!channelId && channel) {
      channelId = typeof channel === 'string' ? channel : channel.id;
    }
    
    // Ensure database is available
    if (!db) {
      console.warn('Database not available for command logging');
      return;
    }

    // Prepare the insert statement
    const insertCommand = db.prepare(`
      INSERT INTO command_logs (
        guild_id,
        user_id,
        command,
        channel_id,
        options,
        success,
        error_message,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    // Execute the insert
    insertCommand.run(
      guild.id,
      user.id,
      command,
      channelId || null,
      cmdOptions ? JSON.stringify(cmdOptions) : null,
      success ? 1 : 0,
      error || null
    );

    logInfo('CommandLogger', `Logged command usage: ${command} by ${user.username} in ${guild.name}`);
  } catch (err: any) {
    logError('CommandLogger', `Failed to log command usage: ${err.message}`);
  }
}

/**
 * Get command usage statistics
 */
export async function getCommandStats(guildId: string, days: number = 7): Promise<any[]> {
  try {
    if (!db) {
      return [];
    }

    const stats = db.prepare(`
      SELECT 
        command,
        COUNT(*) as usage_count,
        COUNT(CASE WHEN success = 1 THEN 1 END) as success_count,
        COUNT(CASE WHEN success = 0 THEN 1 END) as error_count
      FROM command_logs 
      WHERE guild_id = ? 
        AND created_at >= datetime('now', '-${days} days')
      GROUP BY command
      ORDER BY usage_count DESC
    `).all(guildId);

    return stats;
  } catch (err: any) {
    logError('CommandLogger', `Failed to get command stats: ${err.message}`);
    return [];
  }
}

/**
 * Get recent command usage logs
 */
export async function getRecentCommands(guildId: string, limit: number = 50): Promise<any[]> {
  try {
    if (!db) {
      return [];
    }

    const logs = db.prepare(`
      SELECT 
        id,
        user_id,
        command,
        channel_id,
        options,
        success,
        error_message,
        created_at
      FROM command_logs 
      WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(guildId, limit);

    return logs;
  } catch (err: any) {
    logError('CommandLogger', `Failed to get recent commands: ${err.message}`);
    return [];
  }
}