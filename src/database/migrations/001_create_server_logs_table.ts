import { Database } from 'better-sqlite3';

export const up = (db: Database) => {
  // Create server_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      user_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      target_id TEXT,
      reason TEXT,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guild_id) REFERENCES server_settings(guild_id) ON DELETE CASCADE
    );
  `);

  // Create indexes for better query performance
  db.exec('CREATE INDEX IF NOT EXISTS idx_server_logs_guild_id ON server_logs(guild_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_server_logs_action_type ON server_logs(action_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_server_logs_created_at ON server_logs(created_at)');
};

export const down = (db: Database) => {
  db.exec('DROP TABLE IF EXISTS server_logs');
};

export default { up, down };
