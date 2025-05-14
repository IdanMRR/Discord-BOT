import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add the weather_schedule column to the server_settings table
 * This will store JSON data of schedule configurations for each server
 * Format: { frequency: 'daily'|'twice_daily'|'hourly', times: ['05:00', '17:00', ...] }
 */
(async () => {
  try {
    // Check if the column already exists
    const tableInfo = db.prepare("PRAGMA table_info(server_settings)").all() as any[];
    const column = tableInfo.find(col => col.name === 'weather_schedule');
    
    if (column) {
      logInfo('Migration', 'weather_schedule column already exists in server_settings table');
      return;
    }
    
    // Add the new column
    db.prepare("ALTER TABLE server_settings ADD COLUMN weather_schedule TEXT").run();
    logInfo('Migration', 'Added weather_schedule column to server_settings table');
  } catch (error) {
    logError('Migration', `Error adding weather_schedule column to server_settings table: ${error}`);
  }
})(); 