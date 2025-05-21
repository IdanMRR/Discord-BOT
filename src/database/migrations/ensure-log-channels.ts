import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Ensures the log_channels table exists and has the correct structure
 */
export async function ensureLogChannelsTable() {
  try {
    // Check if the table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='log_channels'
    `).get();

    if (!tableExists) {
      logInfo('Migration', 'Creating log_channels table...');
      
      // Create the table
      db.prepare(`
        CREATE TABLE log_channels (
          guild_id TEXT PRIMARY KEY,
          channel_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      
      logInfo('Migration', 'log_channels table created successfully');
    } else {
      logInfo('Migration', 'log_channels table already exists');
    }

    return true;
  } catch (error) {
    logError('Migration', `Error ensuring log_channels table: ${error}`);
    return false;
  }
}

// Run the migration
ensureLogChannelsTable()
  .then(() => {
    logInfo('Migration', 'Completed log_channels table migration');
  })
  .catch(error => {
    logError('Migration', `Failed to run log_channels migration: ${error}`);
  });
