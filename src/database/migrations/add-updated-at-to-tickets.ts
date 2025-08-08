import Database from 'better-sqlite3';
import { logInfo } from '../../utils/logger';

export function up(db: Database.Database): void {
  logInfo('Migration', 'Adding updated_at column to tickets table');
  
  // Check if the column already exists
  const columns = db.prepare('PRAGMA table_info(tickets)').all() as { name: string }[];
  const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
  
  if (!hasUpdatedAt) {
    // SQLite doesn't support CURRENT_TIMESTAMP as default for new columns
    // So we add the column without a default first
    db.exec(`
      ALTER TABLE tickets 
      ADD COLUMN updated_at TIMESTAMP
    `);
    
    // Update existing tickets to have updated_at equal to their last_activity_at or created_at
    db.exec(`
      UPDATE tickets 
      SET updated_at = COALESCE(last_activity_at, created_at, datetime('now'))
      WHERE updated_at IS NULL
    `);
    
    logInfo('Migration', 'Successfully added updated_at column to tickets table');
  } else {
    logInfo('Migration', 'Column updated_at already exists in tickets table');
  }
}

export function down(db: Database.Database): void {
  logInfo('Migration', 'Removing updated_at column from tickets table');
  
  // SQLite doesn't support DROP COLUMN directly, so we'd need to recreate the table
  // For safety, we'll just log that this migration cannot be easily reversed
  logInfo('Migration', 'Note: Cannot easily drop column in SQLite. Manual intervention required.');
}