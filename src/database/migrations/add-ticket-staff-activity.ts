import { logInfo, logError } from '../../utils/logger';
import type Database from 'better-sqlite3';

/**
 * Migration to create ticket_staff_activity table
 */
export async function createTicketStaffActivityTable(database?: Database.Database) {
  try {
    // If no database provided, import it here to avoid circular dependency issues
    let db = database;
    if (!db) {
      const { db: importedDb } = await import('../sqlite');
      db = importedDb;
    }

    if (!db) {
      logError('Staff Activity Migration', 'Database connection not available');
      return false;
    }

    // Check if the table exists
    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='ticket_staff_activity'
    `).get();
    
    if (!tableCheck) {
      logInfo('Staff Activity Migration', 'Creating missing ticket_staff_activity table');
      // Create the table
      db.exec(`
        CREATE TABLE IF NOT EXISTS ticket_staff_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          ticket_id INTEGER NOT NULL,
          staff_id TEXT NOT NULL,
          action_type TEXT NOT NULL, 
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      logInfo('Staff Activity Migration', 'Successfully created ticket_staff_activity table');
    } else {
      logInfo('Staff Activity Migration', 'ticket_staff_activity table already exists');
    }
    
    logInfo('Staff Activity Migration', 'Migration completed successfully');
    return true;
  } catch (error) {
    logError('Staff Activity Migration', `Error during migration: ${error}`);
    return false;
  }
} 