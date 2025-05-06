import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Update the tickets table to include category information
 */
export async function addTicketCategoriesSupport() {
  try {
    // Check if the tickets table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'"
    ).get();
    
    if (!tableExists) {
      // Create the tickets table if it doesn't exist
      db.prepare(`
        CREATE TABLE tickets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          ticket_number INTEGER NOT NULL,
          category TEXT,
          subject TEXT,
          status TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          closed_at TIMESTAMP,
          closed_by TEXT
        )
      `).run();
      
      logInfo('Database Migration', 'Created tickets table with category support');
      return;
    }
    
    // Check if the category column exists
    const hasCategory = db.prepare(
      "PRAGMA table_info(tickets)"
    ).all().some((column: any) => column.name === 'category');
    
    if (!hasCategory) {
      // Add the category column
      db.prepare(
        "ALTER TABLE tickets ADD COLUMN category TEXT"
      ).run();
      
      logInfo('Database Migration', 'Added category column to tickets table');
    } else {
      logInfo('Database Migration', 'Category column already exists in tickets table');
    }
  } catch (error) {
    logError('Database Migration', error);
    throw error;
  }
}

// Run the migration when this file is imported
addTicketCategoriesSupport()
  .then(() => console.log('Ticket categories migration completed successfully'))
  .catch(error => console.error('Failed to run ticket categories migration:', error));
