import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to create the logging_settings table for server-specific logging preferences
 */
export function addLoggingSettings(): void {
  try {
    logInfo('Migration', 'Creating logging_settings table...');
    
    // Create the logging_settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS logging_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL UNIQUE,
        message_delete_logging INTEGER DEFAULT 1,
        message_edit_logging INTEGER DEFAULT 1,
        command_logging INTEGER DEFAULT 1,
        dm_logging INTEGER DEFAULT 0,
        log_channel_id TEXT,
        message_log_channel_id TEXT,
        command_log_channel_id TEXT,
        dm_log_channel_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES server_settings(guild_id) ON DELETE CASCADE
      )
    `);
    
    // Create index for better performance
    db.exec('CREATE INDEX IF NOT EXISTS idx_logging_settings_guild_id ON logging_settings(guild_id)');
    
    logInfo('Migration', 'logging_settings table created successfully');
  } catch (error) {
    logError('Migration', `Error creating logging_settings table: ${error}`);
    throw error;
  }
}