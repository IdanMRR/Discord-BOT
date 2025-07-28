import Database from 'better-sqlite3';

export const addAnalyticsSystem = {
  version: '009',
  name: 'add-analytics-system',
  up: (db: Database.Database) => {
    console.log('Creating analytics system tables...');

    // Server activity tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS server_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        metric_type TEXT NOT NULL CHECK (metric_type IN ('message_count', 'command_usage', 'member_join', 'member_leave', 'voice_activity', 'reaction_count')),
        channel_id TEXT,
        user_id TEXT,
        command_name TEXT,
        value INTEGER DEFAULT 1,
        metadata TEXT, -- JSON for additional data
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Daily server statistics aggregation
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_server_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        date TEXT NOT NULL, -- YYYY-MM-DD format
        total_messages INTEGER DEFAULT 0,
        total_members INTEGER DEFAULT 0,
        active_members INTEGER DEFAULT 0, -- Members who sent at least 1 message
        total_commands INTEGER DEFAULT 0,
        peak_online INTEGER DEFAULT 0,
        voice_minutes INTEGER DEFAULT 0,
        reactions_given INTEGER DEFAULT 0,
        new_members INTEGER DEFAULT 0,
        left_members INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, date)
      )
    `);

    // Hourly activity patterns
    db.exec(`
      CREATE TABLE IF NOT EXISTS hourly_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
        date TEXT NOT NULL, -- YYYY-MM-DD format
        message_count INTEGER DEFAULT 0,
        command_count INTEGER DEFAULT 0,
        voice_users INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, date, hour)
      )
    `);

    // Channel popularity tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS channel_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        channel_type TEXT NOT NULL, -- text, voice, category, etc.
        date TEXT NOT NULL, -- YYYY-MM-DD format
        message_count INTEGER DEFAULT 0,
        unique_users INTEGER DEFAULT 0,
        voice_minutes INTEGER DEFAULT 0, -- For voice channels
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, channel_id, date)
      )
    `);

    // Command usage analytics
    db.exec(`
      CREATE TABLE IF NOT EXISTS command_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        command_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        success BOOLEAN DEFAULT true,
        execution_time INTEGER, -- milliseconds
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Member engagement tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS member_engagement (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL, -- YYYY-MM-DD format
        messages_sent INTEGER DEFAULT 0,
        commands_used INTEGER DEFAULT 0,
        reactions_given INTEGER DEFAULT 0,
        voice_minutes INTEGER DEFAULT 0,
        first_message_time TEXT, -- HH:MM format
        last_message_time TEXT, -- HH:MM format
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, user_id, date)
      )
    `);

    // Server health metrics
    db.exec(`
      CREATE TABLE IF NOT EXISTS server_health (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        member_count INTEGER NOT NULL,
        online_count INTEGER DEFAULT 0,
        bot_latency INTEGER, -- in milliseconds
        api_response_time INTEGER, -- in milliseconds
        memory_usage INTEGER, -- in MB
        cpu_usage REAL, -- percentage
        uptime INTEGER, -- in seconds
        error_count INTEGER DEFAULT 0
      )
    `);

    // Create indexes for performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_server_analytics_guild_type_date 
      ON server_analytics(guild_id, metric_type, created_at)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_daily_server_stats_guild_date 
      ON daily_server_stats(guild_id, date)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_hourly_activity_guild_date 
      ON hourly_activity(guild_id, date)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_channel_analytics_guild_date 
      ON channel_analytics(guild_id, date)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_command_analytics_guild_command_date 
      ON command_analytics(guild_id, command_name, created_at)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_member_engagement_guild_date 
      ON member_engagement(guild_id, date)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_server_health_guild_timestamp 
      ON server_health(guild_id, timestamp)
    `);

    console.log('Analytics system tables created successfully');
  },

  down: (db: Database.Database) => {
    console.log('Dropping analytics system tables...');
    
    db.exec('DROP INDEX IF EXISTS idx_server_health_guild_timestamp');
    db.exec('DROP INDEX IF EXISTS idx_member_engagement_guild_date');
    db.exec('DROP INDEX IF EXISTS idx_command_analytics_guild_command_date');
    db.exec('DROP INDEX IF EXISTS idx_channel_analytics_guild_date');
    db.exec('DROP INDEX IF EXISTS idx_hourly_activity_guild_date');
    db.exec('DROP INDEX IF EXISTS idx_daily_server_stats_guild_date');
    db.exec('DROP INDEX IF EXISTS idx_server_analytics_guild_type_date');
    
    db.exec('DROP TABLE IF EXISTS server_health');
    db.exec('DROP TABLE IF EXISTS member_engagement');
    db.exec('DROP TABLE IF EXISTS command_analytics');
    db.exec('DROP TABLE IF EXISTS channel_analytics');
    db.exec('DROP TABLE IF EXISTS hourly_activity');
    db.exec('DROP TABLE IF EXISTS daily_server_stats');
    db.exec('DROP TABLE IF EXISTS server_analytics');
    
    console.log('Analytics system tables dropped successfully');
  }
};

export default addAnalyticsSystem;