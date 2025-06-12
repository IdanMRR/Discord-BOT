import Database from 'better-sqlite3';
import { logInfo, logError } from '../utils/logger';
import path from 'path';
import fs from 'fs';

// Import migrations
import { runMigrations } from './migrations';
import { seedServerSettings } from './seed-data';

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database synchronously
const dbPath = path.join(dataDir, 'discord-bot.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database function
function initDatabase() {
  try {
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
        ticket_logs_channel_id TEXT,
        staff_role_ids TEXT,
        auto_mod_enabled INTEGER DEFAULT 0,
        auto_mod_settings TEXT,
        log_all_commands INTEGER DEFAULT 1,
        ticket_chatbot_enabled INTEGER DEFAULT 0,
        ticket_chatbot_ai_enabled INTEGER DEFAULT 0,
        goodbye_channel_id TEXT,
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
      
      const hasTicketLogsChannel = db.prepare("PRAGMA table_info(server_settings)").all()
        .some((col: any) => col.name === 'ticket_logs_channel_id');
      
      if (!hasTicketLogsChannel) {
        logInfo('SQLite', 'Adding ticket_logs_channel_id column to server_settings table');
        db.exec('ALTER TABLE server_settings ADD COLUMN ticket_logs_channel_id TEXT');
      }
    } catch (error) {
      logError('SQLite', 'Error checking or adding ticket panel columns: ' + error);
    }
    
    // Check if additional columns exist, add them if they don't
    try {
      const tableInfo = db.prepare("PRAGMA table_info(server_settings)").all();
      const columnNames = tableInfo.map((col: any) => col.name);
      
      const hasLogAllCommands = columnNames.includes('log_all_commands');
      if (!hasLogAllCommands) {
        logInfo('SQLite', 'Adding log_all_commands column to server_settings table');
        db.exec('ALTER TABLE server_settings ADD COLUMN log_all_commands INTEGER DEFAULT 1');
      }
      
      const hasTicketChatbotEnabled = columnNames.includes('ticket_chatbot_enabled');
      if (!hasTicketChatbotEnabled) {
        logInfo('SQLite', 'Adding ticket_chatbot_enabled column to server_settings table');
        db.exec('ALTER TABLE server_settings ADD COLUMN ticket_chatbot_enabled INTEGER DEFAULT 0');
      }
      
      const hasTicketChatbotAiEnabled = columnNames.includes('ticket_chatbot_ai_enabled');
      if (!hasTicketChatbotAiEnabled) {
        logInfo('SQLite', 'Adding ticket_chatbot_ai_enabled column to server_settings table');
        db.exec('ALTER TABLE server_settings ADD COLUMN ticket_chatbot_ai_enabled INTEGER DEFAULT 0');
      }
      
      const hasGoodbyeChannel = columnNames.includes('goodbye_channel_id');
      if (!hasGoodbyeChannel) {
        logInfo('SQLite', 'Adding goodbye_channel_id column to server_settings table');
        db.exec('ALTER TABLE server_settings ADD COLUMN goodbye_channel_id TEXT');
      }
      
      // Add custom welcome message configuration columns
      const hasWelcomeMessageConfig = columnNames.includes('welcome_message_config');
      if (!hasWelcomeMessageConfig) {
        logInfo('SQLite', 'Adding welcome_message_config column to server_settings table');
        db.exec('ALTER TABLE server_settings ADD COLUMN welcome_message_config TEXT');
      }
      
      const hasGoodbyeMessageConfig = columnNames.includes('goodbye_message_config');
      if (!hasGoodbyeMessageConfig) {
        logInfo('SQLite', 'Adding goodbye_message_config column to server_settings table');
        db.exec('ALTER TABLE server_settings ADD COLUMN goodbye_message_config TEXT');
      }
      
      // Add invite tracker message configuration columns
      const hasInviteJoinMessageConfig = columnNames.includes('invite_join_message_config');
      if (!hasInviteJoinMessageConfig) {
        logInfo('SQLite', 'Adding invite_join_message_config column to server_settings table');
        db.exec('ALTER TABLE server_settings ADD COLUMN invite_join_message_config TEXT');
      }
      
      const hasInviteLeaveMessageConfig = columnNames.includes('invite_leave_message_config');
      if (!hasInviteLeaveMessageConfig) {
        logInfo('SQLite', 'Adding invite_leave_message_config column to server_settings table');
        db.exec('ALTER TABLE server_settings ADD COLUMN invite_leave_message_config TEXT');
      }
      
      // Add verification message configuration column
      const hasVerificationMessageConfig = columnNames.includes('verification_message_config');
      if (!hasVerificationMessageConfig) {
        logInfo('SQLite', 'Adding verification_message_config column to server_settings table');
        db.exec('ALTER TABLE server_settings ADD COLUMN verification_message_config TEXT');
      }
      
      // Add ticket panel configuration column
      const hasTicketPanelConfig = columnNames.includes('ticket_panel_config');
      if (!hasTicketPanelConfig) {
        logInfo('SQLite', 'Adding ticket_panel_config column to server_settings table');
        db.exec('ALTER TABLE server_settings ADD COLUMN ticket_panel_config TEXT');
      }
      
      // Log current schema for debugging
      logInfo('SQLite', `Current server_settings columns: ${columnNames.join(', ')}`);
    } catch (error) {
      logError('SQLite', `Error adding missing columns: ${error}`);
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
        case_number INTEGER,
        subject TEXT,
        status TEXT DEFAULT 'open',
        deleted INTEGER DEFAULT 0,
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
    
    // Add verification columns to server_settings table
    try {
      db.exec(`
        ALTER TABLE server_settings ADD COLUMN verification_channel_id TEXT;
      `);
      console.log('[INFO][SQLite] Added verification_channel_id column to server_settings table');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        console.error('[ERROR][SQLite] Error adding verification_channel_id column:', error);
      }
    }

    try {
      db.exec(`
        ALTER TABLE server_settings ADD COLUMN verification_message_id TEXT;
      `);
      console.log('[INFO][SQLite] Added verification_message_id column to server_settings table');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        console.error('[ERROR][SQLite] Error adding verification_message_id column:', error);
      }
    }

    try {
      db.exec(`
        ALTER TABLE server_settings ADD COLUMN verified_role_id TEXT;
      `);
      console.log('[INFO][SQLite] Added verified_role_id column to server_settings table');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        console.error('[ERROR][SQLite] Error adding verified_role_id column:', error);
      }
    }

    try {
      db.exec(`
        ALTER TABLE server_settings ADD COLUMN verification_type TEXT DEFAULT 'none';
      `);
      console.log('[INFO][SQLite] Added verification_type column to server_settings table');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        console.error('[ERROR][SQLite] Error adding verification_type column:', error);
      }
    }
    
    // Create moderation_cases table
    db.exec(`
      CREATE TABLE IF NOT EXISTS moderation_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        case_number INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        additional_info TEXT,
        active INTEGER DEFAULT 1,
        UNIQUE(guild_id, case_number)
      )
    `);
    
    logInfo('SQLite', 'Database initialized successfully');
    return true;
  } catch (error) {
    logError('SQLite', 'Error initializing database: ' + error);
    return false;
  }
}

// Initialize database synchronously
initDatabase();

// Run migrations and seeding asynchronously (non-blocking)
(async () => {
  try {
    logInfo('Database', 'Database initialized successfully');
    
    // Run migrations after database is initialized
    try {
      await runMigrations();
      logInfo('Database', 'Migrations completed successfully');
      
      // Seed server settings with channel IDs (but catch any errors)
      try {
        await seedServerSettings();
      } catch (seedError) {
        logError('Database', `Error seeding server settings: ${seedError}`);
      }
    } catch (err) {
      logError('Database', `Failed to run migrations: ${err}`);
    }
  } catch (err) {
    logError('Database', `Failed to complete database setup: ${err}`);
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
  welcome_message_config?: string; // JSON string of custom welcome message configuration
  goodbye_channel_id?: string;
  goodbye_message_config?: string; // JSON string of custom goodbye message configuration
  invite_join_message_config?: string; // JSON string of custom invite join message configuration
  invite_leave_message_config?: string; // JSON string of custom invite leave message configuration
  verification_message_config?: string; // JSON string of custom verification message configuration
  ticket_panel_config?: string; // JSON string of custom ticket panel configuration
  ticket_category_id?: string;
  ticket_panel_channel_id?: string;
  ticket_panel_message_id?: string;
  ticket_logs_channel_id?: string;
  red_alert_channels?: string; // JSON string of channel IDs
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
