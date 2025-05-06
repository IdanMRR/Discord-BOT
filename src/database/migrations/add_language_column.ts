import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add the language column to the server_settings table
 */
export async function migrateAddLanguageColumn(): Promise<void> {
  try {
    // Check if the language column already exists
    const tableInfo = db.prepare("PRAGMA table_info(server_settings)").all() as any[];
    const languageColumnExists = tableInfo.some(column => column.name === 'language');
    
    if (!languageColumnExists) {
      // Add the language column to the server_settings table
      db.exec("ALTER TABLE server_settings ADD COLUMN language TEXT DEFAULT 'en'");
      
      // Update existing records to have the default language
      db.exec("UPDATE server_settings SET language = 'en' WHERE language IS NULL");
      
      logInfo('Database Migration', 'Added language column to server_settings table');
    } else {
      logInfo('Database Migration', 'Language column already exists in server_settings table');
    }
  } catch (error) {
    logError('Database Migration', `Error adding language column: ${error}`);
    throw error;
  }
}
