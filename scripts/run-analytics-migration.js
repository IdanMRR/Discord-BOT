const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

console.log('Running analytics migration...');

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

console.log('Analytics tables created successfully!');

// Check tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%analytics%' OR name LIKE '%server_health%' OR name LIKE '%daily_server%' OR name LIKE '%hourly_activity%'").all();
console.log('Created analytics tables:', tables.map(t => t.name));

db.close();