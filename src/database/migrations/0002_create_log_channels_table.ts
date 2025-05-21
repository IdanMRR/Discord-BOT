import { Database } from 'better-sqlite3';

export const up = (db: Database) => {
  console.log('Creating log_channels table...');
  
  // Create log_channels table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS log_channels (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  console.log('Created log_channels table');
};

export const down = (db: Database) => {
  console.log('Dropping log_channels table...');
  db.exec('DROP TABLE IF EXISTS log_channels');
  console.log('Dropped log_channels table');
};
