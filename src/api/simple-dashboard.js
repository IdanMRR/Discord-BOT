// Simple dashboard routes with no complex route patterns
const express = require('express');
const router = express.Router();

// Import database and utilities directly at file level to avoid path resolution issues
// Load these once instead of on each request
let db;
let getClient;

try {
  db = require('../database/sqlite').db;
  getClient = require('../utils/client-utils').getClient;
  console.log('[DASHBOARD] Successfully loaded database and client utilities');
} catch (error) {
  console.error('[DASHBOARD] Error loading dependencies:', error);
  // Create fallback mock data for testing
  db = {
    prepare: () => ({
      get: () => ({ count: 0 }),
      all: () => []
    })
  };
  getClient = () => null;
}

// Log all incoming requests for debugging
router.use((req, res, next) => {
  console.log(`[DASHBOARD] ${req.method} ${req.url}`);
  console.log('[DASHBOARD] Headers:', req.headers);
  next();
});

// API key middleware - make it optional for development
router.use((req, res, next) => {
  // Hard-coded API key from .env file
  const hardcodedKey = 'f8e7d6c5b4a3928170615243cba98765';
  
  // Get API key from various possible locations
  const apiKey = req.headers['x-api-key'] || 
                req.query.apiKey || 
                req.query.api_key;
                
  // In development, we'll allow requests without API key
  const isDevEnvironment = true; // Set to true to bypass API key check
  
  if (isDevEnvironment) {
    console.log('[DASHBOARD] Development mode - bypassing API key check');
    return next();
  }
  
  // In production, validate API key
  if (!apiKey || (apiKey !== hardcodedKey && apiKey !== process.env.API_KEY && apiKey !== process.env.DASHBOARD_API_KEY)) {
    console.log('[DASHBOARD] Invalid API key received:', apiKey);
    console.log('[DASHBOARD] Expected one of:', hardcodedKey, process.env.API_KEY, process.env.DASHBOARD_API_KEY);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log('[DASHBOARD] Valid API key received');
  next();
});

// Stats endpoint
router.get('/stats', (req, res) => {
  console.log('[DASHBOARD API] Received stats request');
  
  try {
    // Use the top-level imports we defined at the beginning of the file
    const client = getClient();
    
    // Get server count
    const serverCount = client?.guilds?.cache?.size || 0;
    
    // Get approximate user count
    let userCount = 0;
    client?.guilds?.cache?.forEach(guild => {
      userCount += guild.memberCount || 0;
    });
    
    // Get message count from database
    const messageCountResult = db.prepare("SELECT COUNT(*) as count FROM server_logs WHERE action_type LIKE 'message%'").get();
    const messageCount = messageCountResult?.count || 0;
    
    // Get ticket count from database
    const ticketCountResult = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
    const ticketCount = ticketCountResult?.count || 0;
    
    const stats = {
      serverCount,
      userCount,
      messageCount,
      ticketCount
    };
    
    console.log('[DASHBOARD API] Sending stats response:', stats);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    res.json(stats);
  } catch (error) {
    console.error('[DASHBOARD API] Error getting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Guilds endpoint
router.get('/guilds', (req, res) => {
  try {
    const client = require('../../utils/client-utils').getClient();
    if (!client) {
      return res.status(500).json({ error: 'Discord client not available' });
    }
    
    const guilds = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      icon: guild.iconURL()
    }));
    
    res.json(guilds);
  } catch (error) {
    console.error('Error getting guilds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Recent activity endpoint
router.get('/recent-activity', (req, res) => {
  console.log('[DASHBOARD API] Received recent-activity request');
  
  try {
    // Use the top-level db import we defined at the beginning of the file
    const logs = db.prepare(`
      SELECT 
        action_type as type,
        user_id as userId,
        created_at as timestamp,
        details
      FROM server_logs
      ORDER BY created_at DESC
      LIMIT 10
    `).all();
    
    console.log('[DASHBOARD API] Sending recent-activity response:', logs);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    res.json(logs || []);
  } catch (error) {
    console.error('[DASHBOARD API] Error getting recent activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Server logs endpoint
router.get('/server-logs', (req, res) => {
  try {
    const { db } = require('../../database/sqlite');
    const logs = db.prepare(`
      SELECT 
        created_at as timestamp,
        action_type as type,
        user_id as userId,
        details
      FROM server_logs
      WHERE action_type LIKE 'server%'
      ORDER BY created_at DESC
      LIMIT 50
    `).all();
    
    res.json(logs || []);
  } catch (error) {
    console.error('Error getting server logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Message logs endpoint
router.get('/message-logs', (req, res) => {
  try {
    const { db } = require('../../database/sqlite');
    const logs = db.prepare(`
      SELECT 
        created_at as timestamp,
        action_type as type,
        user_id as userId,
        channel_id as channel,
        details
      FROM server_logs
      WHERE action_type LIKE 'message%'
      ORDER BY created_at DESC
      LIMIT 50
    `).all();
    
    res.json(logs || []);
  } catch (error) {
    console.error('Error getting message logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ticket logs endpoint
router.get('/ticket-logs', (req, res) => {
  try {
    const { db } = require('../../database/sqlite');
    const logs = db.prepare(`
      SELECT 
        created_at as timestamp,
        status as action,
        user_id as userId,
        ticket_id as ticketId,
        category
      FROM tickets
      ORDER BY created_at DESC
      LIMIT 50
    `).all();
    
    res.json(logs || []);
  } catch (error) {
    console.error('Error getting ticket logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Moderation logs endpoint
router.get('/mod-logs', (req, res) => {
  try {
    const { db } = require('../../database/sqlite');
    const logs = db.prepare(`
      SELECT 
        created_at as timestamp,
        action_type as action,
        user_id as userId,
        mod_id as moderatorId,
        reason
      FROM server_logs
      WHERE action_type IN ('warn', 'ban', 'kick', 'timeout')
      ORDER BY created_at DESC
      LIMIT 50
    `).all();
    
    res.json(logs || []);
  } catch (error) {
    console.error('Error getting moderation logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User logs endpoint
router.get('/user-logs', (req, res) => {
  try {
    const { db } = require('../../database/sqlite');
    const logs = db.prepare(`
      SELECT 
        created_at as timestamp,
        action_type as action,
        user_id as userId,
        details
      FROM server_logs
      WHERE action_type IN ('memberJoin', 'memberLeave')
      ORDER BY created_at DESC
      LIMIT 50
    `).all();
    
    res.json(logs || []);
  } catch (error) {
    console.error('Error getting user logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
