import Database from 'better-sqlite3';
import { logInfo, logError } from '../utils/logger';
import path from 'path';
import fs from 'fs';

// Import migrations
import { runMigrations } from './migrations';

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const dbPath = path.join(dataDir, 'discord-bot.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database function
async function initDatabase() {
  // Create server_settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_settings (
      guild_id TEXT PRIMARY KEY,
      name TEXT,
      log_channel_id TEXT,
      mod_log_channel_id TEXT,
      member_log_channel_id TEXT,
      message_log_channel_id TEXT,
      server_log_channel_id TEXT,
      welcome_channel_id TEXT,
      language TEXT DEFAULT 'en',
      welcome_message TEXT,
      ticket_category_id TEXT,
      ticket_panel_channel_id TEXT,
      ticket_panel_message_id TEXT,
      staff_role_ids TEXT,
      auto_mod_enabled INTEGER DEFAULT 0,
      auto_mod_settings TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Check if ticket_panel fields exist, add them if they don't
  try {
    const hasTicketPanelChannel = db.prepare("PRAGMA table_info(server_settings)").all()
      .some((col: any) => col.name === 'ticket_panel_channel_id');
    
    if (!hasTicketPanelChannel) {
      logInfo('SQLite', 'Adding ticket_panel_channel_id column to server_settings table');
      db.exec('ALTER TABLE server_settings ADD COLUMN ticket_panel_channel_id TEXT');
    }
    
    const hasTicketPanelMessage = db.prepare("PRAGMA table_info(server_settings)").all()
      .some((col: any) => col.name === 'ticket_panel_message_id');
    
    if (!hasTicketPanelMessage) {
      logInfo('SQLite', 'Adding ticket_panel_message_id column to server_settings table');
      db.exec('ALTER TABLE server_settings ADD COLUMN ticket_panel_message_id TEXT');
    }
  } catch (error) {
    logError('SQLite', 'Error checking or adding ticket panel columns: ' + error);
  }
  
  // Create warnings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT,
      active INTEGER DEFAULT 1,
      removed_by TEXT,
      removed_at TIMESTAMP,
      removal_reason TEXT,
      case_number INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Check if case_number column exists, add it if it doesn't
  try {
    const hasColumn = db.prepare("PRAGMA table_info(warnings)").all()
      .some((col: any) => col.name === 'case_number');
    
    if (!hasColumn) {
      logInfo('SQLite', 'Adding case_number column to warnings table');
      db.exec('ALTER TABLE warnings ADD COLUMN case_number INTEGER');
    }
  } catch (error) {
    logError('SQLite', 'Error checking or adding case_number column: ' + error);
  }
  
  // Create tickets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      ticket_number INTEGER NOT NULL,
      subject TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP,
      closed_by TEXT,
      last_message_at TIMESTAMP
    )
  `);
  
  // Create server_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      target_id TEXT,
      channel_id TEXT,
      message_id TEXT,
      reason TEXT,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create command_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS command_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      command TEXT NOT NULL,
      options TEXT,
      channel_id TEXT,
      success INTEGER NOT NULL,
      error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create dm_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS dm_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      content TEXT NOT NULL,
      embed_json TEXT,
      components_json TEXT,
      source_command TEXT,
      source_guild_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create ticket_action_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      ticket_id INTEGER,
      ticket_number INTEGER,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create user_settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT,
      setting_key TEXT,
      setting_value TEXT,
      PRIMARY KEY (user_id, setting_key)
    )
  `);
  
  logInfo('SQLite', 'Database initialized successfully');
}

// Initialize the database and run migrations
(async () => {
  try {
    await initDatabase();
    logInfo('Database', 'Database initialized successfully');
    
    // Run migrations after database is initialized
    try {
      await runMigrations();
      logInfo('Database', 'Migrations completed successfully');
    } catch (err) {
      logError('Database', `Failed to run migrations: ${err}`);
    }
  } catch (err) {
    logError('Database', `Failed to initialize database: ${err}`);
  }
})();

// Interface for guild settings
export interface GuildSettings {
  guild_id: string;
  name?: string;
  log_channel_id?: string;
  mod_log_channel_id?: string;
  member_log_channel_id?: string;
  message_log_channel_id?: string;
  server_log_channel_id?: string;
  welcome_channel_id?: string;
  language: string;
  welcome_message?: string;
  ticket_category_id?: string;
  ticket_panel_channel_id?: string;
  ticket_panel_message_id?: string;
  staff_role_ids?: string;
  auto_mod_enabled?: number;
  auto_mod_settings?: string;
  created_at?: string;
  updated_at?: string;
}

// Get guild settings
export function getGuildSettings(guildId: string): GuildSettings | undefined {
  const stmt = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?');
  const result = stmt.get(guildId) as GuildSettings | undefined;
  
  if (result) {
    // Ensure language has a default value
    result.language = result.language || 'en';
  }
  
  return result;
}

// Export the database instance
export { db };
