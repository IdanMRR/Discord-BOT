const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

console.log('Creating missing logging tables...');

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

// Dashboard logs table
db.exec(`
  CREATE TABLE IF NOT EXISTS dashboard_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    log_type TEXT NOT NULL,
    metadata TEXT, -- JSON string
    success INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Moderation case logs
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

// Create indexes for better performance
console.log('Creating indexes...');

db.exec(`CREATE INDEX IF NOT EXISTS idx_command_logs_guild ON command_logs(guild_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_command_logs_user ON command_logs(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_command_logs_command ON command_logs(command)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_command_logs_created ON command_logs(created_at)`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_dm_logs_guild ON dm_logs(guild_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_dm_logs_sender ON dm_logs(sender_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_dm_logs_recipient ON dm_logs(recipient_id)`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_message_logs_guild ON message_logs(guild_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_message_logs_channel ON message_logs(channel_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_message_logs_message ON message_logs(message_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_message_logs_user ON message_logs(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_message_logs_action ON message_logs(action)`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_dashboard_logs_guild ON dashboard_logs(guild_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_dashboard_logs_user ON dashboard_logs(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_dashboard_logs_action ON dashboard_logs(action)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_dashboard_logs_type ON dashboard_logs(log_type)`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_moderation_cases_guild ON moderation_cases(guild_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_moderation_cases_user ON moderation_cases(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_moderation_cases_number ON moderation_cases(case_number)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_moderation_cases_active ON moderation_cases(active)`);

console.log('Logging tables created successfully!');

// Check tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%log%' OR name LIKE '%case%') ORDER BY name").all();
console.log('Created logging tables:', tables.map(t => t.name));

// Add some test data
console.log('Adding test logging data...');

// Test command log
const testCommand = db.prepare(`
  INSERT INTO command_logs (guild_id, user_id, command, channel_id, options, success, execution_time)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

testCommand.run(
  '1368637479653216297', // guild_id
  '123456789012345678', // user_id
  'help',
  '1368637479653216300', // channel_id
  '{"category": "all"}',
  1, // success
  150 // execution_time
);

// Test message log
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

// Test dashboard log
const testDashboard = db.prepare(`
  INSERT INTO dashboard_logs (guild_id, user_id, action, details, log_type, metadata)
  VALUES (?, ?, ?, ?, ?, ?)
`);

testDashboard.run(
  '1368637479653216297', // guild_id
  '123456789012345678', // user_id
  'giveaway-create',
  'Created giveaway: Test Giveaway',
  'command',
  '{"giveaway_id": 1, "prize": "Discord Nitro"}'
);

console.log('Test data added successfully!');

db.close();