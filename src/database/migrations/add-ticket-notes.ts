import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add a notes column to the tickets table
 * This allows tracking additional information about tickets, including errors like inaccessible channels
 */
export async function addTicketNotesColumn() {
  try {
    // Check if the tickets table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'"
    ).get();
    
    if (!tableExists) {
      logInfo('Migration', 'Tickets table does not exist yet, will be created with notes column');
      return;
    }
    
    // Check if the notes column already exists
    const columns = db.pragma('table_info(tickets)') as { name: string }[];
    const hasNotesColumn = columns.some(column => column.name === 'notes');
    
    if (!hasNotesColumn) {
      // Add the notes column
      db.exec(`ALTER TABLE tickets ADD COLUMN notes TEXT DEFAULT NULL`);
      logInfo('Migration', 'Added notes column to tickets table');
    } else {
      logInfo('Migration', 'Notes column already exists in tickets table');
    }
  } catch (error) {
    logError('Migration', error);
    throw error;
  }
}
