const Database = require('better-sqlite3');
const path = require('path');

// Connect to main database
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

console.log('Creating logging settings table...');

// Create logging settings table
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

// Create index
db.exec(`CREATE INDEX IF NOT EXISTS idx_logging_settings_guild ON logging_settings(guild_id)`);

console.log('✅ Logging settings table created successfully');

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

// Check what we created
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'logging_settings'").all();
console.log('Logging settings table exists:', tables.length > 0);

const settings = db.prepare("SELECT * FROM logging_settings WHERE guild_id = '1368637479653216297'").get();
console.log('Test guild settings:', settings);

db.close();