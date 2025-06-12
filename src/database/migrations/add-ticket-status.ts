import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add ticket status fields and modify existing status field
 */
export async function addTicketStatusMigration() {
  try {
    // Check if db is available
    if (!db) {
      logError('Migration', 'Database connection not available');
      return false;
    }

    // Check if status column exists but needs to be modified from 'open|closed|deleted' to include more statuses
    const tableInfo = db.pragma('table_info(tickets)') as { name: string, type: string, dflt_value: string, pk: number }[];
    const statusColumn = tableInfo.find((col) => col.name === 'status');
    
    // If column exists but needs modification
    if (statusColumn) {
      // Add the last_activity_at column if it doesn't exist
      try {
        db.exec(`ALTER TABLE tickets ADD COLUMN last_activity_at TEXT DEFAULT CURRENT_TIMESTAMP`);
        logInfo('Migration', 'Added last_activity_at column to tickets table');
      } catch (error) {
        // Column might already exist, which is fine
        logInfo('Migration', 'last_activity_at column already exists or could not be added');
      }
      
      // We will not modify the existing status column, but adapt our code to use the new values
      logInfo('Migration', 'Status column exists, will use new status values in code');
    } else {
      // If the tickets table exists, add the new columns
      if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'").get()) {
        db.exec(`
          ALTER TABLE tickets ADD COLUMN status TEXT CHECK(status IN ('open', 'in_progress', 'on_hold', 'closed', 'deleted')) DEFAULT 'open';
          ALTER TABLE tickets ADD COLUMN last_activity_at TEXT DEFAULT CURRENT_TIMESTAMP;
        `);
        logInfo('Migration', 'Added status and last_activity_at columns to tickets table');
      } else {
        logInfo('Migration', 'Tickets table does not exist yet, will be created with new columns');
      }
    }
    
    // Create or modify ticket_action_logs table to track status changes if needed
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ticket_action_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          ticket_id INTEGER,
          ticket_number INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          action TEXT NOT NULL,
          details TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      logInfo('Migration', 'Created or verified ticket_action_logs table');
    } catch (error) {
      logError('Migration', `Error creating ticket_action_logs table: ${error}`);
    }
    
    // Create or modify ticket_staff_activity table for tracking staff performance
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ticket_staff_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          ticket_id INTEGER NOT NULL,
          staff_id TEXT NOT NULL,
          action_type TEXT NOT NULL, 
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
        )
      `);
      logInfo('Migration', 'Created or verified ticket_staff_activity table');
    } catch (error) {
      logError('Migration', `Error creating ticket_staff_activity table: ${error}`);
      
      // Try again without foreign key constraint in case that's the issue
      try {
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
        logInfo('Migration', 'Created ticket_staff_activity table without foreign key constraints');
      } catch (retryError) {
        logError('Migration', `Error in retry creating ticket_staff_activity table: ${retryError}`);
      }
    }
    
    logInfo('Migration', 'Successfully completed ticket status migration');
    return true;
  } catch (error) {
    logError('Migration', `Error during migration: ${error}`);
    return false;
  }
} 