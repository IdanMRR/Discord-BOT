import { Database } from 'better-sqlite3';
import { logInfo, logError } from '../../utils/logger';

export const name = '006_create_message_logs';

export function up(db: Database): void {
  try {
    logInfo('Migration', 'Creating message_logs table...');
    
    // Create message_logs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS message_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('create', 'edit', 'delete')),
        content_before TEXT,
        content_after TEXT,
        attachment_urls TEXT,
        embed_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for better performance
    db.exec('CREATE INDEX IF NOT EXISTS idx_message_logs_guild_id ON message_logs(guild_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_message_logs_channel_id ON message_logs(channel_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_message_logs_user_id ON message_logs(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_message_logs_action ON message_logs(action)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_message_logs_guild_action ON message_logs(guild_id, action)');
    
    logInfo('Migration', 'message_logs table created successfully');
  } catch (error) {
    logError('Migration', `Failed to create message_logs table: ${error}`);
    throw error;
  }
}

export function down(db: Database): void {
  try {
    db.exec('DROP TABLE IF EXISTS message_logs');
    logInfo('Migration', 'message_logs table dropped');
  } catch (error) {
    logError('Migration', `Failed to drop message_logs table: ${error}`);
    throw error;
  }
}