/**
 * This file provides direct database access for the simplified dashboard
 * It allows the frontend to directly access the SQLite database without a backend API
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Function to check if the dashboard is set up and create necessary files
function ensureDashboardSetup() {
  const dashboardDir = path.join(__dirname, 'simple-dashboard');
  
  // Create DatabaseService.js in the dashboard src directory
  const dbServicePath = path.join(dashboardDir, 'src', 'DatabaseService.js');
  const dbServiceContent = `
import Database from 'better-sqlite3';

// Get the database path from environment variables
const dbPath = process.env.REACT_APP_DB_PATH || '../data/discord-bot.db';

// Connect to the database
let db;
try {
  db = new Database(dbPath, { readonly: false });
  console.log('Connected to database:', dbPath);
} catch (error) {
  console.error('Failed to connect to database:', error);
  // Create a mock database for development
  db = new Database(':memory:');
  setupMockData(db);
}

// Function to setup mock data for development
function setupMockData(database) {
  // Create basic tables for development
  database.exec(\`
    CREATE TABLE IF NOT EXISTS server_settings (
      guild_id TEXT PRIMARY KEY,
      guild_name TEXT,
      prefix TEXT DEFAULT '!',
      welcome_channel_id TEXT,
      logs_channel_id TEXT,
      mod_logs_channel_id TEXT,
      ticket_category_id TEXT,
      ticket_logs_channel_id TEXT
    );
    
    CREATE TABLE IF NOT EXISTS warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      user_id TEXT,
      moderator_id TEXT,
      reason TEXT,
      timestamp INTEGER,
      active INTEGER DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      channel_id TEXT,
      user_id TEXT,
      status TEXT DEFAULT 'open',
      created_at INTEGER,
      closed_at INTEGER
    );
  \`);
  
  // Insert sample data
  database.exec(\`
    INSERT INTO server_settings (guild_id, guild_name) VALUES ('123456789', 'Example Server');
    INSERT INTO warnings (guild_id, user_id, moderator_id, reason, timestamp, active) 
      VALUES ('123456789', '111222333', '999888777', 'Sample warning', \${Date.now()}, 1);
    INSERT INTO tickets (guild_id, channel_id, user_id, status, created_at)
      VALUES ('123456789', '555666777', '111222333', 'open', \${Date.now()});
  \`);
  
  console.log('Mock data set up for development');
}

// Server settings functions
export const ServerSettings = {
  getAll: () => {
    const stmt = db.prepare('SELECT * FROM server_settings');
    return stmt.all();
  },
  
  get: (guildId) => {
    const stmt = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?');
    return stmt.get(guildId);
  },
  
  update: (guildId, settings) => {
    const server = ServerSettings.get(guildId);
    if (!server) {
      // Insert new server
      const stmt = db.prepare(\`
        INSERT INTO server_settings (
          guild_id, guild_name, prefix, welcome_channel_id, 
          logs_channel_id, mod_logs_channel_id, ticket_category_id, ticket_logs_channel_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      \`);
      
      stmt.run(
        guildId, 
        settings.guild_name || guildId,
        settings.prefix || '!',
        settings.welcome_channel_id || null,
        settings.logs_channel_id || null,
        settings.mod_logs_channel_id || null,
        settings.ticket_category_id || null,
        settings.ticket_logs_channel_id || null
      );
      
      return ServerSettings.get(guildId);
    } else {
      // Update existing server
      const stmt = db.prepare(\`
        UPDATE server_settings SET
          guild_name = COALESCE(?, guild_name),
          prefix = COALESCE(?, prefix),
          welcome_channel_id = COALESCE(?, welcome_channel_id),
          logs_channel_id = COALESCE(?, logs_channel_id),
          mod_logs_channel_id = COALESCE(?, mod_logs_channel_id),
          ticket_category_id = COALESCE(?, ticket_category_id),
          ticket_logs_channel_id = COALESCE(?, ticket_logs_channel_id)
        WHERE guild_id = ?
      \`);
      
      stmt.run(
        settings.guild_name || null,
        settings.prefix || null,
        settings.welcome_channel_id || null,
        settings.logs_channel_id || null,
        settings.mod_logs_channel_id || null,
        settings.ticket_category_id || null,
        settings.ticket_logs_channel_id || null,
        guildId
      );
      
      return ServerSettings.get(guildId);
    }
  }
};

// Warnings functions
export const Warnings = {
  getAll: (guildId, userId = null, activeOnly = false) => {
    let sql = 'SELECT * FROM warnings WHERE guild_id = ?';
    const params = [guildId];
    
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    
    if (activeOnly) {
      sql += ' AND active = 1';
    }
    
    sql += ' ORDER BY timestamp DESC';
    
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },
  
  add: (guildId, userId, moderatorId, reason) => {
    const stmt = db.prepare(\`
      INSERT INTO warnings (guild_id, user_id, moderator_id, reason, timestamp, active)
      VALUES (?, ?, ?, ?, ?, 1)
    \`);
    
    const result = stmt.run(guildId, userId, moderatorId, reason, Date.now());
    return result.lastInsertRowid;
  },
  
  remove: (warningId) => {
    const stmt = db.prepare('UPDATE warnings SET active = 0 WHERE id = ?');
    return stmt.run(warningId);
  }
};

// Tickets functions
export const Tickets = {
  getAll: (guildId, status = null, userId = null) => {
    let sql = 'SELECT * FROM tickets WHERE guild_id = ?';
    const params = [guildId];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },
  
  get: (ticketId) => {
    const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
    return stmt.get(ticketId);
  },
  
  closeTicket: (ticketId) => {
    const stmt = db.prepare(\`
      UPDATE tickets 
      SET status = 'closed', closed_at = ? 
      WHERE id = ?
    \`);
    
    return stmt.run(Date.now(), ticketId);
  }
};

export default {
  ServerSettings,
  Warnings,
  Tickets
};
`;

  // Create directory if it doesn't exist
  const dbServiceDir = path.dirname(dbServicePath);
  if (!fs.existsSync(dbServiceDir)) {
    fs.mkdirSync(dbServiceDir, { recursive: true });
  }
  
  // Write the file
  fs.writeFileSync(dbServicePath, dbServiceContent);
  console.log('Created DatabaseService.js for direct database access');
}

// If this file is run directly
if (require.main === module) {
  ensureDashboardSetup();
}

module.exports = {
  ensureDashboardSetup
}; 