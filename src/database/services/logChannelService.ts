import { Database } from 'better-sqlite3';
import { db } from '../../database/sqlite';

interface LogChannelRow {
  channel_id: string;
}

// Type guard to check if the row has the expected structure
function isLogChannelRow(row: any): row is LogChannelRow {
  return row && typeof row.channel_id === 'string';
}

export const LogChannelService = {
  /**
   * Set or update the log channel for a guild
   */
  setLogChannel: async (guildId: string, channelId: string): Promise<void> => {
    try {
      const stmt = db.prepare(
        `INSERT INTO log_channels (guild_id, channel_id) 
         VALUES (?, ?) 
         ON CONFLICT(guild_id) DO UPDATE SET 
           channel_id = excluded.channel_id,
           updated_at = CURRENT_TIMESTAMP`
      );
      stmt.run(guildId, channelId);
    } catch (error) {
      console.error('Error setting log channel:', error);
      throw error;
    }
  },

  /**
   * Get the log channel for a guild
   */
  getLogChannel: async (guildId: string): Promise<string | null> => {
    try {
      const stmt = db.prepare('SELECT channel_id FROM log_channels WHERE guild_id = ?');
      const row = stmt.get(guildId);
      
      if (!row) return null;
      
      // Ensure the row has the expected structure
      if (isLogChannelRow(row)) {
        return row.channel_id;
      }
      
      console.warn('Unexpected row format in getLogChannel:', row);
      return null;
    } catch (error) {
      console.error('Error getting log channel:', error);
      return null;
    }
  },

  /**
   * Remove the log channel for a guild
   */
  removeLogChannel: async (guildId: string): Promise<void> => {
    try {
      const stmt = db.prepare('DELETE FROM log_channels WHERE guild_id = ?');
      stmt.run(guildId);
    } catch (error) {
      console.error('Error removing log channel:', error);
      throw error;
    }
  },

  /**
   * Check if a guild has logging enabled
   */
  hasLogging: async (guildId: string): Promise<boolean> => {
    try {
      const stmt = db.prepare('SELECT 1 as has_logging FROM log_channels WHERE guild_id = ?');
      const result = stmt.get(guildId) as { has_logging?: number } | undefined;
      return !!result?.has_logging;
    } catch (error) {
      console.error('Error checking if guild has logging:', error);
      return false;
    }
  },
};
