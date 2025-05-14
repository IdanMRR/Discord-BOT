// routes/api.js
const express = require('express');
const router = express.Router();
const path = require('path');
const BetterSqlite3 = require('better-sqlite3');

// Set up database connection to the bot's SQLite database
// Point to the correct location where the database file actually exists
const dbPath = path.resolve('/Users/idanmr/Downloads/Discord-BOT/data/discord-bot.db');
let db;

try {
  // Create the directory if it doesn't exist
  const fs = require('fs');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  db = new BetterSqlite3(dbPath, { readonly: false });
  console.log('Connected to bot database at:', dbPath);
  
  // Ensure required tables exist
  ensureTablesExist();
} catch (error) {
  console.error('Error connecting to database:', error);
  // Fall back to mock data for development
  db = require('../mock/mockDatabase');
  console.log('Using mock database for development');
}

// Function to ensure all required tables exist
function ensureTablesExist() {
  // Create server_settings table if it doesn't exist
  db.prepare(`
    CREATE TABLE IF NOT EXISTS server_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT UNIQUE NOT NULL,
      name TEXT,
      log_channel_id TEXT,
      mod_log_channel_id TEXT,
      member_log_channel_id TEXT,
      message_log_channel_id TEXT,
      server_log_channel_id TEXT,
      welcome_channel_id TEXT,
      welcome_message TEXT,
      welcome_enabled INTEGER DEFAULT 0,
      welcome_image_enabled INTEGER DEFAULT 0,
      welcome_embed_enabled INTEGER DEFAULT 0,
      welcome_embed_color TEXT,
      ticket_category_id TEXT,
      staff_role_ids TEXT,
      auto_mod_enabled INTEGER DEFAULT 0,
      auto_mod_settings TEXT,
      ticket_panel_channel_id TEXT,
      ticket_panel_message_id TEXT,
      language TEXT DEFAULT 'en',
      ticket_logs_channel_id TEXT,
      rules_channel_id TEXT,
      templates TEXT DEFAULT '{}',
      active_templates TEXT DEFAULT '{}',
      member_events_config TEXT,
      weather_channel_id TEXT,
      custom_cities TEXT,
      weather_schedule TEXT,
      red_alert_channels TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

// Middleware to check if user has admin permissions for a guild
const hasGuildPermission = (req, res, next) => {
  const { guildId } = req.params;
  
  // If we're in development mode or using mock data, skip the check
  if (process.env.NODE_ENV === 'development' || !req.user) {
    return next();
  }
  
  // Check if user has admin permissions for this guild
  const guild = req.user.guilds.find(g => g.id === guildId);
  if (!guild || (guild.permissions & 0x20) !== 0x20) {
    return res.status(403).json({ error: 'You do not have permission to access this guild' });
  }
  
  next();
};

// Get all guilds the bot is in
router.get('/guilds', (req, res) => {
  try {
    // Check if server_settings table exists
    let tableExists = true;
    try {
      const tableCheck = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='server_settings'
      `).get();
      
      if (!tableCheck) {
        tableExists = false;
      }
    } catch (e) {
      tableExists = false;
    }
    
    if (!tableExists) {
      // Return mock data if table doesn't exist
      return res.json([
        { guild_id: "123456789012345678", name: "Test Server" },
        { guild_id: "876543210987654321", name: "Another Server" }
      ]);
    }
    
    // Get unique guild IDs from database with names
    const stmt = db.prepare(`
      SELECT DISTINCT guild_id, name 
      FROM server_settings
      ORDER BY guild_id
    `);
    const guilds = stmt.all();
    
    // Add default names if they don't exist
    const enhancedGuilds = guilds.map(guild => ({
      guild_id: guild.guild_id,
      name: guild.name || `Server ${guild.guild_id.substring(0, 8)}...`
    }));
    
    // If using the bot's cache, we could get more info like guild names/icons
    res.json(enhancedGuilds);
  } catch (error) {
    console.error('Error fetching guilds:', error);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

// Get guild settings
router.get('/guilds/:guildId/settings', hasGuildPermission, (req, res) => {
  try {
    const { guildId } = req.params;
    const stmt = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?');
    const settings = stmt.get(guildId);
    
    res.json(settings || {});
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update guild settings
router.put('/guilds/:guildId/settings', hasGuildPermission, (req, res) => {
  try {
    const { guildId } = req.params;
    const updates = req.body;
    
    // Check if settings exist
    const checkStmt = db.prepare('SELECT 1 FROM server_settings WHERE guild_id = ?');
    const exists = checkStmt.get(guildId);
    
    let stmt;
    if (exists) {
      // Build dynamic update query based on provided fields
      const fields = Object.keys(updates)
        .filter(key => key !== 'guild_id') // Exclude guild_id from updates
        .map(key => `${key} = @${key}`)
        .join(', ');
      
      stmt = db.prepare(`UPDATE server_settings SET ${fields} WHERE guild_id = @guild_id`);
    } else {
      // Insert new settings
      const fields = Object.keys(updates);
      const placeholders = fields.map(f => `@${f}`).join(', ');
      
      stmt = db.prepare(`
        INSERT INTO server_settings (${fields.join(', ')})
        VALUES (${placeholders})
      `);
    }
    
    // Add guild_id to updates if not present
    const params = { ...updates, guild_id: guildId };
    stmt.run(params);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get tickets for a guild
router.get('/guilds/:guildId/tickets', hasGuildPermission, (req, res) => {
  try {
    const { guildId } = req.params;
    const { status } = req.query; // Optional status filter
    
    let sql = 'SELECT * FROM tickets WHERE guild_id = ?';
    const params = [guildId];
    
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY ticket_number DESC';
    
    const stmt = db.prepare(sql);
    const tickets = stmt.all(...params);
    
    res.json(tickets || []);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get ticket statistics
router.get('/guilds/:guildId/ticket-stats', hasGuildPermission, (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Get counts by status
    const statusStmt = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM tickets
      WHERE guild_id = ?
      GROUP BY status
    `);
    const statusCounts = statusStmt.all(guildId);
    
    // Get total tickets
    const totalStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM tickets
      WHERE guild_id = ?
    `);
    const { total } = totalStmt.get(guildId) || { total: 0 };
    
    // Get average response time (if available in your schema)
    // This would require additional fields in your database
    
    // Get rating distribution
    const ratingStmt = db.prepare(`
      SELECT rating, COUNT(*) as count
      FROM ticket_ratings
      WHERE guild_id = ?
      GROUP BY rating
    `);
    let ratingDistribution = [];
    try {
      ratingDistribution = ratingStmt.all(guildId);
    } catch (error) {
      // Table might not exist yet
      console.log('Ticket ratings table not available');
    }
    
    res.json({
      total,
      byStatus: statusCounts,
      ratings: ratingDistribution
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({ error: 'Failed to fetch ticket statistics' });
  }
});

// Get verification settings
router.get('/guilds/:guildId/verification', hasGuildPermission, (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if verification_settings table exists
    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='verification_settings'
    `).get();
    
    if (!tableCheck) {
      return res.json({ enabled: false, type: 'button' });
    }
    
    const stmt = db.prepare('SELECT * FROM verification_settings WHERE guild_id = ?');
    const settings = stmt.get(guildId);
    
    if (!settings) {
      return res.json({ enabled: false, type: 'button' });
    }
    
    // Parse custom questions if they exist
    if (settings.custom_questions) {
      try {
        settings.custom_questions = JSON.parse(settings.custom_questions);
      } catch (error) {
        settings.custom_questions = [];
      }
    }
    
    // Convert boolean fields
    settings.enabled = !!settings.enabled;
    settings.require_account_age = !!settings.require_account_age;
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching verification settings:', error);
    res.status(500).json({ error: 'Failed to fetch verification settings' });
  }
});

// Update verification settings
router.put('/guilds/:guildId/verification', hasGuildPermission, (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    // Ensure the table exists
    db.prepare(`
      CREATE TABLE IF NOT EXISTS verification_settings (
        guild_id TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 0,
        type TEXT DEFAULT 'button',
        role_id TEXT,
        channel_id TEXT,
        message_id TEXT,
        custom_questions TEXT,
        min_age INTEGER DEFAULT 13,
        require_account_age INTEGER DEFAULT 0,
        min_account_age_days INTEGER DEFAULT 7,
        log_channel_id TEXT,
        timeout_minutes INTEGER DEFAULT 10,
        welcome_message TEXT,
        welcome_channel_id TEXT
      )
    `).run();
    
    // Convert custom questions to JSON string
    const customQuestionsJson = settings.custom_questions ? 
      JSON.stringify(settings.custom_questions) : null;
    
    // Check if settings already exist
    const existing = db.prepare(`
      SELECT 1 FROM verification_settings WHERE guild_id = ?
    `).get(guildId);
    
    if (existing) {
      // Update existing settings
      db.prepare(`
        UPDATE verification_settings
        SET 
          enabled = ?,
          type = ?,
          role_id = ?,
          channel_id = ?,
          message_id = ?,
          custom_questions = ?,
          min_age = ?,
          require_account_age = ?,
          min_account_age_days = ?,
          log_channel_id = ?,
          timeout_minutes = ?,
          welcome_message = ?,
          welcome_channel_id = ?
        WHERE guild_id = ?
      `).run(
        settings.enabled ? 1 : 0,
        settings.type,
        settings.role_id,
        settings.channel_id,
        settings.message_id,
        customQuestionsJson,
        settings.min_age || 13,
        settings.require_account_age ? 1 : 0,
        settings.min_account_age_days || 7,
        settings.log_channel_id,
        settings.timeout_minutes || 10,
        settings.welcome_message,
        settings.welcome_channel_id,
        guildId
      );
    } else {
      // Insert new settings
      db.prepare(`
        INSERT INTO verification_settings (
          guild_id,
          enabled,
          type,
          role_id,
          channel_id,
          message_id,
          custom_questions,
          min_age,
          require_account_age,
          min_account_age_days,
          log_channel_id,
          timeout_minutes,
          welcome_message,
          welcome_channel_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        guildId,
        settings.enabled ? 1 : 0,
        settings.type,
        settings.role_id,
        settings.channel_id,
        settings.message_id,
        customQuestionsJson,
        settings.min_age || 13,
        settings.require_account_age ? 1 : 0,
        settings.min_account_age_days || 7,
        settings.log_channel_id,
        settings.timeout_minutes || 10,
        settings.welcome_message,
        settings.welcome_channel_id
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating verification settings:', error);
    res.status(500).json({ error: 'Failed to update verification settings' });
  }
});

// Get welcome message settings
router.get('/guilds/:guildId/welcome', hasGuildPermission, (req, res) => {
  try {
    const { guildId } = req.params;
    
    const stmt = db.prepare(`
      SELECT 
        welcome_enabled, 
        welcome_channel_id, 
        welcome_message, 
        welcome_image_enabled, 
        welcome_image_background,
        welcome_embed_enabled,
        welcome_embed_color
      FROM server_settings 
      WHERE guild_id = ?
    `);
    
    const settings = stmt.get(guildId) || {
      welcome_enabled: 0,
      welcome_channel_id: null,
      welcome_message: "Welcome {user} to {server}!",
      welcome_image_enabled: 0,
      welcome_image_background: null,
      welcome_embed_enabled: 0,
      welcome_embed_color: null
    };
    
    // Convert numeric booleans to actual booleans
    settings.welcome_enabled = !!settings.welcome_enabled;
    settings.welcome_image_enabled = !!settings.welcome_image_enabled;
    settings.welcome_embed_enabled = !!settings.welcome_embed_enabled;
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching welcome settings:', error);
    res.status(500).json({ error: 'Failed to fetch welcome settings' });
  }
});

// Update welcome message settings
router.put('/guilds/:guildId/welcome', hasGuildPermission, (req, res) => {
  try {
    const { guildId } = req.params;
    const {
      welcome_enabled,
      welcome_channel_id,
      welcome_message,
      welcome_image_enabled,
      welcome_image_background,
      welcome_embed_enabled,
      welcome_embed_color
    } = req.body;
    
    // Check if settings exist for this guild
    const checkStmt = db.prepare('SELECT 1 FROM server_settings WHERE guild_id = ?');
    const exists = checkStmt.get(guildId);
    
    if (exists) {
      // Update existing settings
      const stmt = db.prepare(`
        UPDATE server_settings
        SET
          welcome_enabled = ?,
          welcome_channel_id = ?,
          welcome_message = ?,
          welcome_image_enabled = ?,
          welcome_image_background = ?,
          welcome_embed_enabled = ?,
          welcome_embed_color = ?
        WHERE guild_id = ?
      `);
      
      stmt.run(
        welcome_enabled ? 1 : 0,
        welcome_channel_id,
        welcome_message,
        welcome_image_enabled ? 1 : 0,
        welcome_image_background,
        welcome_embed_enabled ? 1 : 0,
        welcome_embed_color,
        guildId
      );
    } else {
      // Insert new settings
      const stmt = db.prepare(`
        INSERT INTO server_settings (
          guild_id,
          welcome_enabled,
          welcome_channel_id,
          welcome_message,
          welcome_image_enabled,
          welcome_image_background,
          welcome_embed_enabled,
          welcome_embed_color
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        guildId,
        welcome_enabled ? 1 : 0,
        welcome_channel_id,
        welcome_message,
        welcome_image_enabled ? 1 : 0,
        welcome_image_background,
        welcome_embed_enabled ? 1 : 0,
        welcome_embed_color
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating welcome settings:', error);
    res.status(500).json({ error: 'Failed to update welcome settings' });
  }
});

module.exports = router; 