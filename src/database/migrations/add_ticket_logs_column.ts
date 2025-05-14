import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add ticket_logs_channel_id column to server_settings table
 */
export async function migrateAddTicketLogsColumn(): Promise<void> {
  try {
    // Check if the column already exists
    const columns = db.prepare("PRAGMA table_info(server_settings)").all();
    const hasTicketLogsColumn = columns.some((col: any) => col.name === 'ticket_logs_channel_id');
    
    if (!hasTicketLogsColumn) {
      logInfo('Migration', 'Adding ticket_logs_channel_id column to server_settings table');
      db.exec('ALTER TABLE server_settings ADD COLUMN ticket_logs_channel_id TEXT');
      logInfo('Migration', 'Successfully added ticket_logs_channel_id column');
    } else {
      logInfo('Migration', 'ticket_logs_channel_id column already exists in server_settings table');
    }
  } catch (error) {
    logError('Migration', `Error adding ticket_logs_channel_id column: ${error}`);
    throw error;
  }
} 