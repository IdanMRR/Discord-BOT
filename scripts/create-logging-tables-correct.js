const Database = require('better-sqlite3');
const path = require('path');

// Connect to the correct database that the bot uses
const dbPath = path.join(__dirname, '..', 'data', 'discord-bot.db');
console.log('Creating tables in:', dbPath);

const db = new Database(dbPath);

console.log('Creating missing logging tables in correct database...');

// Command logs table
db.exec(`
  CREATE TABLE IF NOT EXISTS command_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    command TEXT NOT NULL,
    channel_id TEXT,
    options TEXT, -- JSON string of command options
    success INTEGER NOT NULL,
    error_message TEXT,
    execution_time INTEGER, -- milliseconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Message logs table (for deleted/edited messages)
db.exec(`
  CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'delete', 'edit', 'create'
    content_before TEXT,
    content_after TEXT,
    attachment_urls TEXT, -- JSON array of attachment URLs
    embed_data TEXT, -- JSON string of embed data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// DM logs table
db.exec(`
  CREATE TABLE IF NOT EXISTS dm_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    content TEXT NOT NULL,
    command TEXT,
    success INTEGER NOT NULL,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Logging settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS logging_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL UNIQUE,
    message_delete_logging INTEGER DEFAULT 1,
    message_edit_logging INTEGER DEFAULT 1,
    command_logging INTEGER DEFAULT 1,
    dm_logging INTEGER DEFAULT 1,
    log_channel_id TEXT,
    message_log_channel_id TEXT,
    command_log_channel_id TEXT,
    dm_log_channel_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Moderation cases table
db.exec(`
  CREATE TABLE IF NOT EXISTS moderation_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    case_number INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    duration INTEGER, -- For timeouts, in milliseconds
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, case_number)
  )
`);

console.log('✅ Logging tables created successfully in correct database');

// Check tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%log%' OR name LIKE '%case%') ORDER BY name").all();
console.log('Created logging tables:', tables.map(t => t.name));

// Add default settings for test guild
try {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO logging_settings (guild_id, message_delete_logging, message_edit_logging, command_logging, dm_logging)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  insertStmt.run('1368637479653216297', 1, 1, 1, 1);
  console.log('✅ Added default settings for test guild');
} catch (error) {
  console.log('ℹ️  Default settings already exist or error:', error.message);
}

// Add test message log
try {
  const testMessage = db.prepare(`
    INSERT INTO message_logs (guild_id, channel_id, message_id, user_id, action, content_before, content_after)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  testMessage.run(
    '1368637479653216297', // guild_id
    '1368637479653216300', // channel_id
    '1368637479653216301', // message_id
    '123456789012345678', // user_id
    'edit',
    'Original message content',
    'Edited message content'
  );
  
  console.log('✅ Test message log added successfully!');
} catch (error) {
  console.log('Error adding test data:', error.message);
}

console.log('Test data added successfully!');
db.close();