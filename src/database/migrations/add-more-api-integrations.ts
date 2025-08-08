import Database from 'better-sqlite3';
import { logInfo, logError } from '../../utils/logger';

export const addMoreApiIntegrations = {
  version: '012',
  name: 'add-more-api-integrations',
  up: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Adding more REST API integration types to database schema...');

      // Create backup of integrations table
      db.exec(`
        CREATE TABLE integrations_backup AS 
        SELECT * FROM integrations
      `);

      // Drop the old table
      db.exec('DROP TABLE integrations');

      // Create the new table with additional integration types
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
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sync_interval INTEGER
        )
      `);

      // Restore data from backup with explicit column mapping
      const backupColumns = db.prepare("PRAGMA table_info(integrations_backup)").all() as any[];
      const hasSyncIntervalInBackup = backupColumns.some((col: any) => col.name === 'sync_interval');
      
      if (hasSyncIntervalInBackup) {
        db.exec(`
          INSERT INTO integrations 
          SELECT * FROM integrations_backup
        `);
      } else {
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

      // Recreate indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_guild_active ON integrations(guild_id, is_active)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_type_provider ON integrations(integration_type, provider)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_next_sync ON integrations(next_sync) WHERE is_active = 1`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by)`);

      logInfo('Migration', 'More REST API integration types added successfully');
    } catch (error) {
      logError('Migration', `Error adding more API integration types: ${error}`);
      throw error;
    }
  },

  down: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Removing additional API integration types from database schema...');

      // Create backup
      db.exec(`
        CREATE TABLE integrations_backup AS 
        SELECT * FROM integrations
      `);

      // Drop current table
      db.exec('DROP TABLE integrations');

      // Create table with previous integration types
      db.exec(`
        CREATE TABLE integrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          integration_type TEXT NOT NULL CHECK (integration_type IN (
            'webhook', 'api', 'rss', 'github', 'twitter', 'twitch', 'youtube', 
            'minecraft', 'steam', 'weather', 'custom'
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
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sync_interval INTEGER
        )
      `);

      // Restore data, excluding new integration types
      const backupColumns = db.prepare("PRAGMA table_info(integrations_backup)").all() as any[];
      const hasSyncIntervalInBackup = backupColumns.some((col: any) => col.name === 'sync_interval');
      
      if (hasSyncIntervalInBackup) {
        db.exec(`
          INSERT INTO integrations 
          SELECT * FROM integrations_backup 
          WHERE integration_type IN ('webhook', 'rest_api', 'rss', 'github', 'weather', 'custom')
        `);
      } else {
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
          WHERE integration_type IN ('webhook', 'rest_api', 'rss', 'github', 'weather', 'custom')
        `);
      }

      // Drop backup
      db.exec('DROP TABLE integrations_backup');

      // Recreate indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_guild_active ON integrations(guild_id, is_active)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_type_provider ON integrations(integration_type, provider)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_next_sync ON integrations(next_sync) WHERE is_active = 1`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by)`);

      logInfo('Migration', 'Additional API integration types removed from database schema');
    } catch (error) {
      logError('Migration', `Error removing additional API integration types: ${error}`);
      throw error;
    }
  }
};

export default addMoreApiIntegrations;