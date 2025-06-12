import { logInfo, logError } from '../../utils/logger';
import { db } from '../sqlite';

/**
 * Migration to add users table to the database
 */
export async function migrateAddUsersTable(): Promise<void> {
  try {
    logInfo('Database Migration', 'Adding users table...');
    
    // Check if users table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='users'
    `).get();
    
    if (!tableExists) {
      // Create users table
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL UNIQUE,
          username TEXT,
          discriminator TEXT,
          avatar TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      logInfo('Database Migration', 'Users table created successfully');
    } else {
      logInfo('Database Migration', 'Users table already exists');
    }
  } catch (error) {
    logError('Database Migration', `Error creating users table: ${error}`);
    throw error;
  }
}
