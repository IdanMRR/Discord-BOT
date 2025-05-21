import { db } from '../sqlite';

// Define interface for database result types
interface CommandLog {
  id: number;
  user_id: string;
  user_name: string;
  guild_id: string;
  command: string;
  options: string;
  created_at: string;
}

/**
 * Logs a command usage to the database
 * @param userId The ID of the user who executed the command
 * @param userName The username of the user who executed the command
 * @param guildId The ID of the guild where the command was executed
 * @param command The name of the command that was executed
 * @param options Any options or arguments passed to the command
 * @returns The ID of the newly created log entry
 */
export function logCommandUsage(
  userId: string,
  userName: string,
  guildId: string,
  command: string,
  options: any = {}
): number {
  try {
    // Convert options to JSON string if it's an object
    const optionsJson = typeof options === 'object' ? JSON.stringify(options) : String(options);
    
    // Insert the command log into the database
    const stmt = db.prepare(
      `INSERT INTO command_logs (user_id, user_name, guild_id, command, options, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    );
    
    const result = stmt.run(userId, userName, guildId, command, optionsJson);
    
    return result.lastInsertRowid as number;
  } catch (error) {
    console.error('Error logging command usage:', error);
    return -1; // Return -1 to indicate an error
  }
}

/**
 * Gets the most recent command logs
 * @param limit The maximum number of logs to retrieve
 * @returns An array of command logs
 */
export function getRecentCommandLogs(limit: number = 10): CommandLog[] {
  try {
    // Query the database for the most recent command logs
    const stmt = db.prepare(
      `SELECT * FROM command_logs ORDER BY created_at DESC LIMIT ?`
    );
    
    const logs = stmt.all(limit) as CommandLog[];
    
    return logs;
  } catch (error) {
    console.error('Error getting recent command logs:', error);
    return []; // Return an empty array in case of error
  }
}

/**
 * Gets command usage analytics
 * @param days The number of days to look back
 * @returns An object with command usage statistics
 */
export function getCommandAnalytics(days: number = 30): {
  total: number;
  byCommand: { command: string; count: number }[];
  period: string;
} {
  try {
    // Query the database for command usage statistics
    const stmt = db.prepare(
      `SELECT command, COUNT(*) as count 
       FROM command_logs 
       WHERE created_at >= datetime('now', '-' || ? || ' days') 
       GROUP BY command 
       ORDER BY count DESC`
    );
    
    const commandStats = stmt.all(days) as { command: string; count: number }[];
    
    // Get total command count
    const totalCount = commandStats.reduce((sum, stat) => sum + stat.count, 0);
    
    return {
      total: totalCount,
      byCommand: commandStats,
      period: `${days} days`
    };
  } catch (error) {
    console.error('Error getting command analytics:', error);
    return {
      total: 0,
      byCommand: [],
      period: `${days} days`
    };
  }
}
