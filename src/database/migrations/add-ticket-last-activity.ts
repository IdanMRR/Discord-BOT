import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add last_activity_at column to tickets table
 */
export async function addTicketLastActivityColumn() {
  try {
    // Check if db is available
    if (!db) {
      logError('Migration', 'Database connection not available');
      return false;
    }

    // Check if the tickets table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'
    `).get();
    
    if (!tableExists) {
      logInfo('Migration', 'Tickets table does not exist yet, will be created with last_activity_at column');
      return true;
    }
    
    // Check if last_activity_at column exists
    const columns = db.pragma('table_info(tickets)') as { name: string }[];
    
    if (!columns.some(col => col.name === 'last_activity_at')) {
      // Add the last_activity_at column with a constant default value
      db.exec(`ALTER TABLE tickets ADD COLUMN last_activity_at TEXT DEFAULT NULL`);
      logInfo('Migration', 'Added last_activity_at column to tickets table');
      
      // Update all existing tickets to set last_activity_at to their created_at time
      db.exec(`
        UPDATE tickets 
        SET last_activity_at = created_at 
        WHERE last_activity_at IS NULL
      `);
      logInfo('Migration', 'Updated existing tickets with last_activity_at values');
    } else {
      logInfo('Migration', 'last_activity_at column already exists in tickets table');
    }
    
    logInfo('Migration', 'Successfully completed ticket last_activity migration');
    return true;
  } catch (error) {
    logError('Migration', `Error during last_activity_at migration: ${error}`);
    return false;
  }
} 