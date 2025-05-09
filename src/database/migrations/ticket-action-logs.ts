import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to ensure the ticket_action_logs table has all required columns
 */
export async function migrate() {
  try {
    // Check if ticket_action_logs table exists
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_action_logs'");
    const tableExists = tableCheck.get();
    
    if (!tableExists) {
      logInfo('Migration', 'ticket_action_logs table does not exist, will be created by init function');
      return;
    }
    
    // Check if details column exists
    const hasDetailsColumn = db.prepare("PRAGMA table_info(ticket_action_logs)").all()
      .some((col: any) => col.name === 'details');
    
    if (!hasDetailsColumn) {
      logInfo('Migration', 'Adding details column to ticket_action_logs table');
      db.exec('ALTER TABLE ticket_action_logs ADD COLUMN details TEXT');
    }
    
    logInfo('Migration', 'ticket_action_logs table migration completed successfully');
  } catch (error) {
    logError('Migration', `Error in ticket_action_logs migration: ${error}`);
  }
} 