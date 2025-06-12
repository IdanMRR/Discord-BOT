import { Database } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the database file
const DB_PATH = path.join(process.cwd(), 'database.sqlite');

// Check if the database file exists
const dbExists = fs.existsSync(DB_PATH);

// Import database connection
const { getDatabase } = await import('../src/database/connection.js');

async function initializeDatabase() {
  console.log('Initializing database...');
  
  try {
    // This will create the database file if it doesn't exist
    const db = getDatabase();
    
    // Create tables if they don't exist
    await createTables(db);
    
    console.log('Database initialization complete!');
    console.log('Database file location:', DB_PATH);
    
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}

async function createTables(db: Database) {
  console.log('Creating database tables...');
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      user_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      target_id TEXT,
      reason TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Create logs table (for backward compatibility)
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      user_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      target_id TEXT,
      reason TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Create server_settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_settings (
      guild_id TEXT PRIMARY KEY,
      log_channel_id TEXT,
      mod_log_channel_id TEXT,
      welcome_channel_id TEXT,
      welcome_message TEXT,
      leave_message TEXT,
      mod_role_id TEXT,
      admin_role_id TEXT,
      mute_role_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Create warnings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guild_id) REFERENCES server_settings(guild_id) ON DELETE CASCADE
    );
  `);
  
  console.log('Created all required tables');
  
  // Create indexes for better performance
  console.log('Creating indexes...');
  
  // Indexes for server_logs
  db.exec('CREATE INDEX IF NOT EXISTS idx_server_logs_guild ON server_logs(guild_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_server_logs_user ON server_logs(user_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_server_logs_channel ON server_logs(channel_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_server_logs_action ON server_logs(action_type);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_server_logs_created ON server_logs(created_at);');
  
  // Indexes for logs (backward compatibility)
  db.exec('CREATE INDEX IF NOT EXISTS idx_logs_guild ON logs(guild_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_logs_channel ON logs(channel_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_logs_action ON logs(action_type);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);');
  
  // Indexes for warnings
  db.exec('CREATE INDEX IF NOT EXISTS idx_warnings_guild ON warnings(guild_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_warnings_moderator ON warnings(moderator_id);');
  
  console.log('Database schema initialized successfully!');
}

// Run the initialization
initializeDatabase()
  .then(success => {
    if (success) {
      console.log('✅ Database initialization completed successfully!');
      process.exit(0);
    } else {
      console.error('❌ Database initialization failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error during database initialization:', error);
    process.exit(1);
  });
