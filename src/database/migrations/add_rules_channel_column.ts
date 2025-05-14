import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add rules_channel_id column to server_settings table
 */
export async function migrateAddRulesChannelColumn(): Promise<void> {
  try {
    // Check if the column already exists
    const columns = db.prepare("PRAGMA table_info(server_settings)").all();
    const hasRulesChannelColumn = columns.some((col: any) => col.name === 'rules_channel_id');
    
    if (!hasRulesChannelColumn) {
      logInfo('Migration', 'Adding rules_channel_id column to server_settings table');
      db.exec('ALTER TABLE server_settings ADD COLUMN rules_channel_id TEXT');
      logInfo('Migration', 'Successfully added rules_channel_id column');
    } else {
      logInfo('Migration', 'rules_channel_id column already exists in server_settings table');
    }
  } catch (error) {
    logError('Migration', `Error adding rules_channel_id column: ${error}`);
    throw error;
  }
}
