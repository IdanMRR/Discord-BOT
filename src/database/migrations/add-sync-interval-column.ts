import Database from 'better-sqlite3';
import { logInfo, logError } from '../../utils/logger';

export const addSyncIntervalColumn = {
  version: '013',
  name: 'add-sync-interval-column',
  up: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Adding sync_interval column to integrations table...');

      // Check if the column already exists
      const columns = db.prepare("PRAGMA table_info(integrations)").all();
      const hasSyncInterval = columns.some((col: any) => col.name === 'sync_interval');
      
      if (hasSyncInterval) {
        logInfo('Migration', 'sync_interval column already exists, skipping...');
        return;
      }

      // Add sync_interval column
      db.exec(`
        ALTER TABLE integrations 
        ADD COLUMN sync_interval INTEGER
      `);

      // Update existing records to use sync_frequency value for sync_interval
      // This ensures backward compatibility with existing integrations
      db.exec(`
        UPDATE integrations 
        SET sync_interval = sync_frequency 
        WHERE sync_frequency IS NOT NULL
      `);

      logInfo('Migration', 'sync_interval column added successfully to integrations table');
    } catch (error) {
      logError('Migration', `Error adding sync_interval column: ${error}`);
      throw error;
    }
  },

  down: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Removing sync_interval column from integrations table...');

      // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
      // Create backup of integrations table
      db.exec(`
        CREATE TABLE integrations_backup AS 
        SELECT 
          id, guild_id, name, integration_type, provider, config, 
          credentials_encrypted, target_channel_id, message_template, 
          embed_template, is_active, sync_frequency, last_sync, next_sync, 
          sync_count, error_count, last_error, rate_limit_config, 
          retry_config, filter_config, transform_config, created_by, 
          created_at, updated_at
        FROM integrations
      `);

      // Drop the old table
      db.exec('DROP TABLE integrations');

      // Recreate the table without sync_interval column
      db.exec(`
        CREATE TABLE integrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          integration_type TEXT NOT NULL CHECK (integration_type IN (
            'webhook', 'rest_api', 'rss', 'github', 'weather', 'custom'
          )),
          provider TEXT NOT NULL,
          config TEXT NOT NULL,
          credentials_encrypted TEXT,
          target_channel_id TEXT,
          message_template TEXT,
          embed_template TEXT,
          is_active INTEGER DEFAULT 1,
          sync_frequency INTEGER,
          last_sync TIMESTAMP,
          next_sync TIMESTAMP,
          sync_count INTEGER DEFAULT 0,
          error_count INTEGER DEFAULT 0,
          last_error TEXT,
          rate_limit_config TEXT,
          retry_config TEXT,
          filter_config TEXT,
          transform_config TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Restore data from backup
      db.exec(`
        INSERT INTO integrations 
        SELECT * FROM integrations_backup
      `);

      // Drop the backup table
      db.exec('DROP TABLE integrations_backup');

      // Recreate indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_guild_active ON integrations(guild_id, is_active)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_type_provider ON integrations(integration_type, provider)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_next_sync ON integrations(next_sync) WHERE is_active = 1`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by)`);

      logInfo('Migration', 'sync_interval column removed from integrations table');
    } catch (error) {
      logError('Migration', `Error removing sync_interval column: ${error}`);
      throw error;
    }
  }
};

export default addSyncIntervalColumn;