import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add deleted column to tickets table
 * This enables soft delete functionality instead of hard deletes
 */
export async function addSoftDeleteColumn() {
  try {
    // Check if the tickets table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'"
    ).get();
    
    if (!tableExists) {
      logInfo('Migration', 'Tickets table does not exist yet, will be created with deleted column');
      return true;
    }
    
    // Check if deleted column exists
    const columns = db.pragma('table_info(tickets)') as { name: string }[];
    const hasDeletedColumn = columns.some(col => col.name === 'deleted');
    
    if (!hasDeletedColumn) {
      // Add the deleted column with default value 0 (not deleted)
      db.exec(`ALTER TABLE tickets ADD COLUMN deleted INTEGER DEFAULT 0`);
      logInfo('Migration', 'Added deleted column to tickets table');
      
      // Update existing deleted tickets to have deleted = 1
      const existingDeletedTickets = db.prepare(`
        SELECT id FROM tickets WHERE status = 'deleted'
      `).all() as { id: number }[];
      
      if (existingDeletedTickets.length > 0) {
        const updateStmt = db.prepare(`UPDATE tickets SET deleted = 1 WHERE id = ?`);
        
        for (const ticket of existingDeletedTickets) {
          updateStmt.run(ticket.id);
        }
        
        logInfo('Migration', `Updated ${existingDeletedTickets.length} existing deleted tickets with deleted = 1`);
      }
    } else {
      logInfo('Migration', 'deleted column already exists in tickets table');
    }
    
    logInfo('Migration', 'Successfully completed soft delete migration');
    return true;
  } catch (error) {
    logError('Migration', `Error during soft delete migration: ${error}`);
    return false;
  }
} 