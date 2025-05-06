import Database from 'better-sqlite3';
import { logError, logInfo } from '../../utils/logger';

/**
 * Migration to add templates and active_templates columns to server_settings table
 */
export async function migrate(db: any): Promise<boolean> {
  try {
    // Check if templates column exists
    const templatesColumnExists = db.prepare(
      "SELECT COUNT(*) as count FROM pragma_table_info('server_settings') WHERE name = 'templates'"
    ).get().count > 0;
    
    // Check if active_templates column exists
    const activeTemplatesColumnExists = db.prepare(
      "SELECT COUNT(*) as count FROM pragma_table_info('server_settings') WHERE name = 'active_templates'"
    ).get().count > 0;
    
    // Add templates column if it doesn't exist
    if (!templatesColumnExists) {
      try {
        db.exec(`ALTER TABLE server_settings ADD COLUMN templates TEXT DEFAULT '{}';`);
        logInfo('Migration', 'Added templates column to server_settings table');
      } catch (err: any) {
        logError('Migration', `Error adding templates column: ${err.message}`);
      }
    } else {
      logInfo('Migration', 'templates column already exists in server_settings table');
    }
    
    // Add active_templates column if it doesn't exist
    if (!activeTemplatesColumnExists) {
      try {
        db.exec(`ALTER TABLE server_settings ADD COLUMN active_templates TEXT DEFAULT '{}';`);
        logInfo('Migration', 'Added active_templates column to server_settings table');
      } catch (err: any) {
        logError('Migration', `Error adding active_templates column: ${err.message}`);
      }
    } else {
      logInfo('Migration', 'active_templates column already exists in server_settings table');
    }
    
    return true;
  } catch (err: any) {
    logError('Migration', `Error in migration: ${err.message}`);
    return false;
  }
}
