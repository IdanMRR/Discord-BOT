import { logInfo, logError } from '../../utils/logger';
import { db } from '../sqlite';

/**
 * Migration to add the weather_channel_id column to server_settings table
 */
export async function migrateAddWeatherChannelColumn(): Promise<void> {
  try {
    // Check if the column already exists
    const tableInfo = db.prepare("PRAGMA table_info(server_settings)").all() as any[];
    const columnExists = tableInfo.some(col => col.name === 'weather_channel_id');
    
    if (!columnExists) {
      // Add the column
      db.prepare("ALTER TABLE server_settings ADD COLUMN weather_channel_id TEXT").run();
      logInfo('Database Migration', 'Added weather_channel_id column to server_settings table');
    } else {
      logInfo('Database Migration', 'weather_channel_id column already exists in server_settings table');
    }
  } catch (error) {
    logError('Database Migration', `Error adding weather_channel_id column: ${error}`);
    throw error;
  }
} 