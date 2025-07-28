const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

console.log('Creating giveaway tables...');

// Create the main giveaways table
db.exec(`
  CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    prize TEXT NOT NULL,
    winner_count INTEGER NOT NULL DEFAULT 1,
    host_user_id TEXT NOT NULL,
    end_time TIMESTAMP NOT NULL,
    requirements TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create giveaway entries (participants) table
db.exec(`
  CREATE TABLE IF NOT EXISTS giveaway_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    giveaway_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE,
    UNIQUE(giveaway_id, user_id)
  )
`);

// Create giveaway winners table
db.exec(`
  CREATE TABLE IF NOT EXISTS giveaway_winners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    giveaway_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    claimed BOOLEAN DEFAULT FALSE,
    claim_time TIMESTAMP,
    FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE,
    UNIQUE(giveaway_id, user_id)
  )
`);

// Create giveaway requirements table
db.exec(`
  CREATE TABLE IF NOT EXISTS giveaway_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    giveaway_id INTEGER NOT NULL,
    requirement_type TEXT NOT NULL CHECK (requirement_type IN ('role', 'level', 'invite_count', 'server_boost')),
    requirement_value TEXT NOT NULL,
    FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
  )
`);

// Create indexes for better performance
db.exec(`CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_giveaways_end_time ON giveaways(end_time)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway ON giveaway_entries(giveaway_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user ON giveaway_entries(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_giveaway_winners_giveaway ON giveaway_winners(giveaway_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_giveaway_requirements_giveaway ON giveaway_requirements(giveaway_id)`);

console.log('Giveaway tables created successfully!');

// Check tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'giveaway%'").all();
console.log('Created giveaway tables:', tables.map(t => t.name));

// Add a test giveaway
console.log('Adding test giveaway...');
const testGiveaway = db.prepare(`
  INSERT INTO giveaways (guild_id, channel_id, title, prize, winner_count, host_user_id, end_time)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now
const result = testGiveaway.run(
  '1368637479653216297', // guild_id
  '1368637479653216300', // channel_id  
  'Test Giveaway',
  '$100 Discord Nitro',
  1,
  '123456789', // host_user_id
  futureTime
);

console.log('Test giveaway created with ID:', result.lastInsertRowid);

db.close();