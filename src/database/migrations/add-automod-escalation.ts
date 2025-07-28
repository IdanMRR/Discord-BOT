import Database from 'better-sqlite3';

export const addAutomodEscalation = {
  version: '008',
  name: 'add-automod-escalation',
  up: (db: Database.Database) => {
    console.log('Creating automod escalation system tables...');

    // Create automod_escalation_settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS automod_escalation_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 1,
        reset_warnings_after_days INTEGER DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create automod_escalation_rules table
    db.exec(`
      CREATE TABLE IF NOT EXISTS automod_escalation_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        warning_threshold INTEGER NOT NULL,
        punishment_type TEXT NOT NULL CHECK (punishment_type IN ('timeout', 'kick', 'ban', 'role_remove', 'role_add', 'nothing')),
        punishment_duration INTEGER DEFAULT NULL,
        punishment_reason TEXT DEFAULT 'Automatic punishment for exceeding warning threshold',
        role_id TEXT DEFAULT NULL,
        enabled INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES automod_escalation_settings(guild_id) ON DELETE CASCADE
      )
    `);

    // Create automod_escalation_log table for tracking automated actions
    db.exec(`
      CREATE TABLE IF NOT EXISTS automod_escalation_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT DEFAULT 'AUTOMOD',
        rule_id INTEGER NOT NULL,
        warning_count INTEGER NOT NULL,
        punishment_type TEXT NOT NULL,
        punishment_duration INTEGER DEFAULT NULL,
        punishment_reason TEXT,
        success INTEGER NOT NULL,
        error_message TEXT DEFAULT NULL,
        case_number INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rule_id) REFERENCES automod_escalation_rules(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_automod_escalation_settings_guild_id 
      ON automod_escalation_settings(guild_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_automod_escalation_rules_guild_id 
      ON automod_escalation_rules(guild_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_automod_escalation_rules_threshold 
      ON automod_escalation_rules(guild_id, warning_threshold, enabled)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_automod_escalation_log_guild_user 
      ON automod_escalation_log(guild_id, user_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_automod_escalation_log_created_at 
      ON automod_escalation_log(created_at)
    `);

    // Insert default settings for existing guilds that have warnings
    db.exec(`
      INSERT OR IGNORE INTO automod_escalation_settings (guild_id, enabled)
      SELECT DISTINCT guild_id, 0 FROM warnings
      WHERE guild_id IS NOT NULL
    `);

    console.log('Automod escalation system tables created successfully');
  },

  down: (db: Database.Database) => {
    console.log('Dropping automod escalation system tables...');
    
    db.exec('DROP INDEX IF EXISTS idx_automod_escalation_log_created_at');
    db.exec('DROP INDEX IF EXISTS idx_automod_escalation_log_guild_user');
    db.exec('DROP INDEX IF EXISTS idx_automod_escalation_rules_threshold');
    db.exec('DROP INDEX IF EXISTS idx_automod_escalation_rules_guild_id');
    db.exec('DROP INDEX IF EXISTS idx_automod_escalation_settings_guild_id');
    
    db.exec('DROP TABLE IF EXISTS automod_escalation_log');
    db.exec('DROP TABLE IF EXISTS automod_escalation_rules');
    db.exec('DROP TABLE IF EXISTS automod_escalation_settings');
    
    console.log('Automod escalation system tables dropped successfully');
  }
};

export default addAutomodEscalation;