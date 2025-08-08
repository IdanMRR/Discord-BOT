import Database from 'better-sqlite3';
import { logInfo, logError } from '../../utils/logger';

export const fixIntegrationWeatherType = {
  version: '011',
  name: 'fix-integration-weather-type',
  up: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Adding weather integration type to database schema...');

      // Since SQLite doesn't support ALTER TABLE to modify CHECK constraints,
      // we need to recreate the table with the updated constraint
      
      // First, create a backup of the current integrations table (drop existing backup if it exists)
      db.exec('DROP TABLE IF EXISTS integrations_backup');
      db.exec(`
        CREATE TABLE integrations_backup AS 
        SELECT * FROM integrations
      `);

      // Drop the old table
      db.exec('DROP TABLE integrations');

      // Create the new table with the updated CHECK constraint including 'weather'
      db.exec(`
        CREATE TABLE integrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          integration_type TEXT NOT NULL CHECK (integration_type IN ('webhook', 'api', 'rss', 'github', 'twitter', 'twitch', 'youtube', 'minecraft', 'steam', 'weather', 'custom')),
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
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sync_interval INTEGER
        )
      `);

      // Restore data from backup with explicit column mapping
      // First check if sync_interval column exists in the backup
      const backupColumns = db.prepare("PRAGMA table_info(integrations_backup)").all() as any[];
      const hasSyncIntervalInBackup = backupColumns.some((col: any) => col.name === 'sync_interval');
      
      if (hasSyncIntervalInBackup) {
        // If backup has sync_interval, restore all columns
        db.exec(`
          INSERT INTO integrations 
          SELECT * FROM integrations_backup
        `);
      } else {
        // If backup doesn't have sync_interval, restore with NULL for that column
        db.exec(`
          INSERT INTO integrations (
            id, guild_id, name, integration_type, provider, config, credentials_encrypted,
            target_channel_id, message_template, embed_template, is_active, sync_frequency,
            last_sync, next_sync, sync_count, error_count, last_error, rate_limit_config,
            retry_config, filter_config, transform_config, created_by, created_at, updated_at,
            sync_interval
          )
          SELECT 
            id, guild_id, name, integration_type, provider, config, credentials_encrypted,
            target_channel_id, message_template, embed_template, is_active, sync_frequency,
            last_sync, next_sync, sync_count, error_count, last_error, rate_limit_config,
            retry_config, filter_config, transform_config, created_by, created_at, updated_at,
            NULL
          FROM integrations_backup
        `);
      }

      // Drop the backup table
      db.exec('DROP TABLE integrations_backup');

      // Recreate the indexes that were lost
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_guild_active ON integrations(guild_id, is_active)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_type_provider ON integrations(integration_type, provider)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_next_sync ON integrations(next_sync) WHERE is_active = 1`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by)`);

      logInfo('Migration', 'Weather integration type added successfully to database schema');
    } catch (error) {
      logError('Migration', `Error adding weather integration type: ${error}`);
      throw error;
    }
  },

  down: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Removing weather integration type from database schema...');

      // Create a backup of the current integrations table (drop existing backup if it exists)
      db.exec('DROP TABLE IF EXISTS integrations_backup');
      db.exec(`
        CREATE TABLE integrations_backup AS 
        SELECT * FROM integrations
      `);

      // Drop the current table
      db.exec('DROP TABLE integrations');

      // Create the table with the original CHECK constraint (without 'weather')
      db.exec(`
        CREATE TABLE integrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          integration_type TEXT NOT NULL CHECK (integration_type IN ('webhook', 'api', 'rss', 'github', 'twitter', 'twitch', 'youtube', 'minecraft', 'steam', 'custom')),
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
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sync_interval INTEGER
        )
      `);

      // Restore data from backup, excluding weather integrations
      // Check if sync_interval column exists in the backup
      const backupColumns = db.prepare("PRAGMA table_info(integrations_backup)").all() as any[];
      const hasSyncIntervalInBackup = backupColumns.some((col: any) => col.name === 'sync_interval');
      
      if (hasSyncIntervalInBackup) {
        // If backup has sync_interval, restore all columns
        db.exec(`
          INSERT INTO integrations 
          SELECT * FROM integrations_backup 
          WHERE integration_type != 'weather'
        `);
      } else {
        // If backup doesn't have sync_interval, restore with NULL for that column
        db.exec(`
          INSERT INTO integrations (
            id, guild_id, name, integration_type, provider, config, credentials_encrypted,
            target_channel_id, message_template, embed_template, is_active, sync_frequency,
            last_sync, next_sync, sync_count, error_count, last_error, rate_limit_config,
            retry_config, filter_config, transform_config, created_by, created_at, updated_at,
            sync_interval
          )
          SELECT 
            id, guild_id, name, integration_type, provider, config, credentials_encrypted,
            target_channel_id, message_template, embed_template, is_active, sync_frequency,
            last_sync, next_sync, sync_count, error_count, last_error, rate_limit_config,
            retry_config, filter_config, transform_config, created_by, created_at, updated_at,
            NULL
          FROM integrations_backup
          WHERE integration_type != 'weather'
        `);
      }

      // Drop the backup table
      db.exec('DROP TABLE integrations_backup');

      // Recreate the indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_guild_active ON integrations(guild_id, is_active)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_type_provider ON integrations(integration_type, provider)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_next_sync ON integrations(next_sync) WHERE is_active = 1`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by)`);

      logInfo('Migration', 'Weather integration type removed from database schema');
    } catch (error) {
      logError('Migration', `Error removing weather integration type: ${error}`);
      throw error;
    }
  }
};

export default fixIntegrationWeatherType;