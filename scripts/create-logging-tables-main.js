const Database = require('better-sqlite3');
const path = require('path');

// Connect to main database
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

console.log('Creating missing logging tables in main database...');

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

console.log('Main database logging tables created successfully!');

// Check tables exist and add test data
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%log%' OR name LIKE '%case%') ORDER BY name").all();
console.log('Available logging tables:', tables.map(t => t.name));

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
  
  console.log('Test message log added successfully!');
} catch (error) {
  console.log('Error adding test data:', error.message);
}

db.close();