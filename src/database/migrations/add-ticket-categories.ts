import { logInfo, logError } from '../../utils/logger';
import type Database from 'better-sqlite3';

/**
 * Update the tickets table to include category information
 * Also create ticket_categories table for custom categories per server
 */
export async function addTicketCategoriesSupport(database?: Database.Database) {
  try {
    // If no database provided, import it here to avoid circular dependency issues
    let db = database;
    if (!db) {
      const { db: importedDb } = await import('../sqlite');
      db = importedDb;
    }

    if (!db) {
      throw new Error('Database connection is not available');
    }

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
    }
    
    // Check if the category column exists in tickets table
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
    
    // Check if ticket_categories table exists
    const categoriesTableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_categories'"
    ).get();
    
    if (!categoriesTableExists) {
      // Create the ticket_categories table
      db.prepare(`
        CREATE TABLE ticket_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          category_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          emoji TEXT DEFAULT '📁',
          color INTEGER DEFAULT 0x5865F2,
          priority TEXT DEFAULT 'medium',
          expected_response_time TEXT DEFAULT '24 hours',
          category_type TEXT DEFAULT 'custom',
          discord_category_id TEXT,
          position INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, category_id)
        )
      `).run();
      
      logInfo('Database Migration', 'Created ticket_categories table');
    } else {
      logInfo('Database Migration', 'ticket_categories table already exists');
    }
    
  } catch (error) {
    logError('Database Migration', error);
    throw error;
  }
}
