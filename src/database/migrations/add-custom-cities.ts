import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add the custom_cities column to the server_settings table
 * This will store JSON data of city configurations for each server
 */
(async () => {
  try {
    // Check if the column already exists
    const tableInfo = db.prepare("PRAGMA table_info(server_settings)").all() as any[];
    const column = tableInfo.find(col => col.name === 'custom_cities');
    
    if (column) {
      logInfo('Migration', 'custom_cities column already exists in server_settings table');
      return;
    }
    
    // Add the new column
    db.prepare("ALTER TABLE server_settings ADD COLUMN custom_cities TEXT").run();
    logInfo('Migration', 'Added custom_cities column to server_settings table');
  } catch (error) {
    logError('Migration', `Error adding custom_cities column to server_settings table: ${error}`);
  }
})(); 