import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add the action_type column to ticket_staff_activity table
 */
export async function addActionTypeToStaffActivity() {
  try {
    // Check if db is available
    if (!db) {
      logError('Migration', 'Database connection not available');
      return false;
    }

    // Check if the table exists first
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_staff_activity'
    `).get();
    
    if (!tableExists) {
      logInfo('Migration', 'ticket_staff_activity table does not exist, skipping column addition');
      return true;
    }

    // Check if the column already exists
    const columns = db.pragma('table_info(ticket_staff_activity)') as { name: string }[];
    const columnExists = columns.some(col => col.name === 'action_type');
    
    if (columnExists) {
      logInfo('Migration', 'action_type column already exists in ticket_staff_activity table');
      return true;
    }

    // Add the column
    db.exec(`
      ALTER TABLE ticket_staff_activity
      ADD COLUMN action_type TEXT DEFAULT 'message'
    `);
    
    logInfo('Migration', 'Successfully added action_type column to ticket_staff_activity table');
    return true;
  } catch (error) {
    logError('Migration', `Failed to add action_type column to ticket_staff_activity table: ${error}`);
    return false;
  }
}
