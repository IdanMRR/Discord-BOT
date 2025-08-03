const express = require('express');
const router = express.Router();
const { checkServerAccess } = require('../../dist/middleware/serverAuth');

// Import database and utilities directly at file level to avoid path resolution issues
// Load these once instead of on each request
let db;
let getClient;
let isClientReady;
let getDiscordUsernameSync;
let logger;

try {
  db = require('../../dist/database/sqlite').db;
  const clientUtils = require('../../dist/utils/client-utils');
  const { formatWarningRemoval } = require('../../dist/api/user-helper');
  getClient = clientUtils.getClient;
  isClientReady = clientUtils.isClientReady;
  getDiscordUsernameSync = clientUtils.getDiscordUsernameSync;
  
  // Try to load logger, create fallback if not available
  try {
    logger = require('../../dist/utils/logger');
  } catch (loggerError) {
    // Create fallback logger
    logger = {
      info: (tag, message) => console.log(`[${tag}] ${message}`),
      error: (tag, message) => console.error(`[${tag}] ${message}`),
      warn: (tag, message) => console.warn(`[${tag}] ${message}`),
      debug: (tag, message) => console.log(`[${tag}] ${message}`)
    };
  }
  
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
  isClientReady = () => false;
  getDiscordUsernameSync = (userId) => `Unknown User (ID: ${userId})`;
  logger = {
    info: (tag, message) => console.log(`[${tag}] ${message}`),
    error: (tag, message) => console.error(`[${tag}] ${message}`),
    warn: (tag, message) => console.warn(`[${tag}] ${message}`),
    debug: (tag, message) => console.log(`[${tag}] ${message}`)
  };
}

// Log all incoming requests for debugging
router.use((req, res, next) => {
  // Removed excessive request logging - only log errors now
  next();
});

// Simple test route to check if router is working
router.get('/test', (req, res) => {
  console.log('[DASHBOARD] Test route called');
  res.json({
    success: true,
    message: 'Test route working!',
    timestamp: new Date().toISOString()
  });
});

// API key middleware - make it optional for development
router.use((req, res, next) => {
  // Add CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // For debugging - allow all requests
  console.log('[DASHBOARD] Request to:', req.url, 'Method:', req.method);
  return next();
});

// Debug endpoint to check Discord client status
router.get('/debug-client', (req, res) => {
  try {
    const client = getClient();
    
    if (!client) {
      return res.json({
        success: false,
        error: 'Discord client not available',
        clientReady: false
      });
    }
    
    const isReady = isClientReady();
    const guilds = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      channelCount: guild.channels.cache.size
    }));
    
    // Get a few channels from the main guild
    let channels = [];
    if (guilds.length > 0) {
      const mainGuild = client.guilds.cache.first();
      channels = mainGuild.channels.cache.map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type
      })).slice(0, 10); // Just first 10 channels
    }
    
    res.json({
      success: true,
      clientReady: isReady,
      guilds: guilds,
      sampleChannels: channels
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      clientReady: false
    });
  }
});

// Debug endpoint to check specific channel
router.get('/debug-channel/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const client = getClient();
    
    if (!client || !isClientReady()) {
      return res.json({
        success: false,
        error: 'Discord client not ready'
      });
    }
    
    // Try cache first
    let channel = client.channels.cache.get(channelId);
    if (channel) {
      return res.json({
        success: true,
        source: 'cache',
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type
        }
      });
    }
    
    // Try to fetch
    try {
      channel = await client.channels.fetch(channelId);
      if (channel) {
        return res.json({
          success: true,
          source: 'fetch',
          channel: {
            id: channel.id,
            name: channel.name,
            type: channel.type
          }
        });
      }
    } catch (fetchError) {
      return res.json({
        success: false,
        error: `Could not fetch channel: ${fetchError.message}`,
        channelId: channelId
      });
    }
    
    res.json({
      success: false,
      error: 'Channel not found',
      channelId: channelId
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Stats endpoint
router.get('/stats', (req, res) => {
  try {
    // Use the top-level imports we defined at the beginning of the file
    const client = getClient();
    
    // Get server count
    const serverCount = client?.guilds?.cache?.size || 0;
    
    // Get active tickets count
    let activeTickets = 0;
    try {
      const activeTicketsResult = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'").get();
      activeTickets = activeTicketsResult?.count || 0;
    } catch (e) {
      // Silent fail for missing tables
    }
    
    // Get active warnings count
    let totalWarnings = 0;
    try {
      const warningsResult = db.prepare("SELECT COUNT(*) as count FROM warnings WHERE active = 1").get();
      totalWarnings = warningsResult?.count || 0;
    } catch (e) {
      // Silent fail for missing tables
    }
    
    // Get commands used count
    let commandsUsed = 0;
    try {
      const commandsResult = db.prepare("SELECT COUNT(*) as count FROM command_logs").get();
      commandsUsed = commandsResult?.count || 0;
    } catch (e) {
      // Silent fail for missing tables
    }
    
    // Calculate real uptime if process.uptime is available
    let uptime = 'Unknown';
    try {
      const uptimeSeconds = process.uptime();
      const hours = Math.floor(uptimeSeconds / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      uptime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    } catch (e) {
      uptime = 'N/A';
    }
    
    // Calculate real memory usage
    let memoryUsage = 'Unknown';
    try {
      const used = process.memoryUsage();
      const totalMB = Math.round(used.heapUsed / 1024 / 1024);
      memoryUsage = `${totalMB} MB`;
    } catch (e) {
      memoryUsage = 'N/A';
    }
    
    // For API latency, we could measure the time between request and response
    const apiLatency = 'N/A'; // Could be implemented with ping measurements
    
    const stats = {
      serverCount,
      activeTickets,
      totalWarnings,
      commandsUsed,
      uptime,
      memoryUsage,
      apiLatency
    };
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[DASHBOARD API] Error getting stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error getting dashboard statistics' 
    });
  }
});

// Guilds endpoint
router.get('/guilds', (req, res) => {
  try {
    const client = getClient();
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

// Tickets endpoint
router.get('/tickets', async (req, res) => {
  try {
    const { guild_id } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      console.log('[DASHBOARD] Database not available, returning mock data');
      return res.json({
        success: true,
        data: []
      });
    }
    
    let query = `
      SELECT 
        id,
        guild_id,
        channel_id,
        user_id,
        ticket_number,
        subject,
        status,
        created_at,
        closed_at,
        closed_by
      FROM tickets
    `;
    
    const params = [];
    
    if (guild_id) {
      query += ' WHERE guild_id = ?';
      params.push(guild_id);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 50';
    
    let tickets = [];
    try {
      tickets = db.prepare(query).all(...params);
    } catch (dbError) {
      console.log('[DASHBOARD] Tickets table not found, returning empty array');
      tickets = [];
    }
    
    // Convert to Israeli time (UTC+3)
    tickets = tickets.map(ticket => {
      const israeliTime = new Date(new Date(ticket.created_at).getTime() + (3 * 60 * 60 * 1000));
      return {
        ...ticket,
        created_at: israeliTime.toISOString(),
        closed_at: ticket.closed_at ? new Date(new Date(ticket.closed_at).getTime() + (3 * 60 * 60 * 1000)).toISOString() : null
      };
    });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    res.json({
      success: true,
      data: tickets || []
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting tickets:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Warnings endpoint
router.get('/warnings', async (req, res) => {
  try {
    const { guild_id } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      console.log('[DASHBOARD] Database not available, returning mock data');
      return res.json({
        success: true,
        data: []
      });
    }
    
    let query = `
      SELECT 
        id,
        guild_id,
        user_id,
        moderator_id,
        reason,
        active,
        removed_by,
        removed_at,
        removal_reason,
        case_number,
        created_at
      FROM warnings
    `;
    
    const params = [];
    
    if (guild_id) {
      query += ' WHERE guild_id = ?';
      params.push(guild_id);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 50';
    
    let warnings = [];
    try {
      warnings = db.prepare(query).all(...params);
      
      // Process warnings with real usernames and case numbers
      for (const warning of warnings) {
        // Get real usernames
        warning.userName = await getUserNameAsync(warning.user_id);
        if (warning.moderator_id) {
          let moderatorName = await getUserNameAsync(warning.moderator_id);
          // Handle automated system actions for warnings (ONLY for actual automod)
          // Only treat as AutoMod if: explicitly system/automod ID, or explicit automod keywords in reason
          if (warning.moderator_id === 'system' || 
              warning.moderator_id === 'automod' ||
              (warning.reason && (warning.reason.toLowerCase().includes('automatic') || warning.reason.toLowerCase().includes('automod')))) {
            moderatorName = 'AutoMod System';
          }
          warning.moderatorName = moderatorName;
        } else {
          warning.moderatorName = 'AutoMod System';
        }
        
        // Get total warning count for this user
        try {
          const countQuery = `
            SELECT COUNT(*) as count 
            FROM warnings 
            WHERE user_id = ? AND guild_id = ? AND active = 1
          `;
          const countResult = db.prepare(countQuery).get(warning.user_id, warning.guild_id);
          warning.totalWarnings = countResult?.count || 1;
        } catch (e) {
          warning.totalWarnings = 1;
        }
        
        // Convert to Israeli time (UTC+3)
        const israeliTime = new Date(new Date(warning.created_at).getTime() + (3 * 60 * 60 * 1000));
        warning.created_at = israeliTime.toISOString();
        
        if (warning.removed_at) {
          const israeliRemovedTime = new Date(new Date(warning.removed_at).getTime() + (3 * 60 * 60 * 1000));
          warning.removed_at = israeliRemovedTime.toISOString();
        }
        
        // Enhanced warning details for display
        warning.warningDetails = `⚠️ Case #${warning.case_number || 'Unknown'} | Total: ${warning.totalWarnings} | ${warning.reason || 'No reason'}`;
        warning.statusDisplay = warning.active ? '🟢 Active' : '🔴 Removed';
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Warnings table not found, returning empty array');
      warnings = [];
    }

    // Get verification logs from server_logs table
    try {
      let verificationQuery = `
        SELECT 
          id,
          guild_id,
          user_id as moderator_id,
          target_id as user_id,
          action_type as action,
          reason,
          details,
          created_at,
          'verification' as log_type
        FROM server_logs
        WHERE action_type IN ('memberVerificationSuccess', 'memberVerificationFailed')
      `;
      
      const verificationParams = [];
      if (guild_id) {
        verificationQuery += ' AND guild_id = ?';
        verificationParams.push(guild_id);
      }
      
      verificationQuery += ' ORDER BY created_at DESC LIMIT 10';
      
      const verificationLogs = db.prepare(verificationQuery).all(...verificationParams);
      
      // Process verification logs instantly (no async calls)
      for (const log of verificationLogs) {
        // For verification, user_id is the person who got verified (target_id)
        log.userName = getDisplayName(log.user_id);
        
        // Format the action for display
        let emoji = '';
        switch(log.action) {
          case 'memberVerificationSuccess':
            log.action = 'Verification Success';
            emoji = '✅';
            break;
          case 'memberVerificationFailed':
            log.action = 'Verification Failed';
            emoji = '❌';
            break;
        }
        
        // Enhanced details for verification
        log.details = `${emoji} ${log.action} | User: ${log.userName}`;
        
        // Convert to Israeli time (+3 hours)
        const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
        log.created_at = israeliTime.toISOString();
        
        allModerationLogs.push(log);
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Server logs table not found for verification logs');
    }

    // Sort by date and limit results
    allModerationLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    allModerationLogs = allModerationLogs.slice(0, 50);
    
    res.json({
      success: true,
      data: allModerationLogs
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting moderation logs:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

// Cache to track failed user lookups to avoid spam
const failedUserLookups = new Set();

// Helper function to get username from user ID (async version) - optimized for speed but with real names
async function getUserNameAsync(userId) {
  if (!userId) return 'Unknown User';
  
  // Handle system users that aren't real Discord users
  if (userId === 'AUTOMOD_SYSTEM' || userId === 'SYSTEM' || userId === 'UNKNOWN') {
    return userId;
  }
  
  // Validate that userId is a valid Discord snowflake (should be numeric)
  if (!/^\d{17,19}$/.test(userId)) {
    return userId; // Return as-is for non-Discord IDs like AUTOMOD_SYSTEM
  }
  
  // Create a more friendly fallback username based on user ID
  const createFallbackUsername = (id) => {
    const usernames = [
      'DiscordUser', 'ServerMember', 'GuildMember', 'User', 'Member',
      'Anonymous', 'Player', 'Someone', 'Participant', 'Visitor'
    ];
    // Use the user ID to deterministically pick a username
    const index = parseInt(id.slice(-2), 16) % usernames.length;
    return `${usernames[index]}_${id.slice(-4)}`;
  };
  
  try {
    // First try the sync version which often has real names cached
    try {
      const syncUsername = getDiscordUsernameSync(userId);
      // Check if we got a real username (not just User_XXXX format)
      if (syncUsername && 
          syncUsername !== `User_${userId.slice(-4)}` && 
          !syncUsername.startsWith('User_') && 
          !syncUsername.includes('Unknown User') &&
          syncUsername.length > 5) {
        return syncUsername;
      }
    } catch (e) {
      // Continue to other methods
    }
    
    const client = getClient();
    if (!client) {
      return createFallbackUsername(userId);
    }
    
    // Always try cache first, even if client isn't fully ready
    try {
      const user = client.users.cache.get(userId);
      if (user && user.username) {
        return user.displayName || user.username || user.tag;
      }
    } catch (e) {
      // Silent fail
    }
    
    // Check if client is ready for API calls
    if (!isClientReady()) {
      return createFallbackUsername(userId);
    }
    
    // Skip API fetch if we've already failed for this user recently
    if (failedUserLookups.has(userId)) {
      return createFallbackUsername(userId);
    }
    
    // Try a quick fetch with timeout
    try {
      const user = await Promise.race([
        client.users.fetch(userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
      ]);
      if (user && user.username) {
        // Remove from failed set if we succeed
        failedUserLookups.delete(userId);
        return user.displayName || user.username || user.tag;
      }
    } catch (fetchError) {
      // Add to failed set and only log if it's a new failure
      if (!failedUserLookups.has(userId)) {
        failedUserLookups.add(userId);
        // Auto-remove from failed set after 5 minutes to allow retry
        setTimeout(() => failedUserLookups.delete(userId), 5 * 60 * 1000);
      }
    }
    
    // Last attempt: try sync version again in case it got cached
    try {
      const syncUsername = getDiscordUsernameSync(userId);
      if (syncUsername && !syncUsername.includes('Unknown User')) {
        return syncUsername;
      }
    } catch (e) {
      // Silent fail
    }
    
    return createFallbackUsername(userId);
  } catch (error) {
    return createFallbackUsername(userId);
  }
}

// Helper function to get channel name from channel ID - optimized for speed but with real names
async function getChannelNameAsync(channelId) {
  if (!channelId) return 'Unknown Channel';
  
  try {
    const client = getClient();
    if (!client || !isClientReady()) {
      return `Channel_${channelId.slice(-4)}`;
    }
    
    // Try cache first
    let channel = client.channels.cache.get(channelId);
    if (channel) {
      return channel.name || `Channel_${channelId.slice(-4)}`;
    }
    
    // Try a quick fetch with timeout
    try {
      channel = await Promise.race([
        client.channels.fetch(channelId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 800))
      ]);
      if (channel) {
        return channel.name || `Channel_${channelId.slice(-4)}`;
      }
    } catch (fetchError) {
      // Silent fail and use fallback
    }
    
    return `Channel_${channelId.slice(-4)}`;
  } catch (error) {
    return `Channel_${channelId.slice(-4)}`;
  }
}

// Recent activity endpoint
router.get('/recent-activity', async (req, res) => {
  try {
    const { guild_id } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      console.log('[DASHBOARD] Database not available, returning mock data');
      return res.json({
        success: true,
        data: []
      });
    }
    
    let activities = [];
    
    // Get recent tickets with detailed information from ticket action logs
    try {
      const ticketQuery = `
        SELECT 
          'ticket' as type,
          user_id,
          ticket_id,
          ticket_number,
          action as action_type,
          details,
          created_at as timestamp,
          guild_id as serverId
        FROM ticket_action_logs 
        ${guild_id ? 'WHERE guild_id = ?' : ''}
        ORDER BY created_at DESC 
        LIMIT 20
      `;
      
      const ticketLogs = db.prepare(ticketQuery).all(guild_id ? [guild_id] : []);
      
      // Group by ticket_id and timestamp (within 30 seconds) to eliminate duplicates but preserve important state changes
      const groupedTickets = new Map();
      
      for (const log of ticketLogs) {
        const ticketKey = `${log.ticket_id}_${Math.floor(new Date(log.timestamp).getTime() / (30 * 1000))}`;
        
        if (!groupedTickets.has(ticketKey)) {
          groupedTickets.set(ticketKey, []);
        }
        groupedTickets.get(ticketKey).push(log);
      }
      
      // Process each group and pick the most meaningful action
      for (const [ticketKey, logs] of groupedTickets) {
        if (logs.length === 0) continue;
        
        // Priority order for actions (higher priority = more important to show)
        // Prioritize final states over initial states
        const actionPriority = {
          'delete': 10,      // Highest - ticket was deleted
          'close': 9,        // High - ticket was closed (final state)
          'reopen': 8,       // High - ticket was reopened (state change)
          'create': 7,       // Medium - ticket was created (initial state)
          'transfer': 6,     // Medium - ticket was transferred
          'claim': 5,        // Medium - ticket was claimed
          'unclaim': 4,      // Medium - ticket was unclaimed
          'setpriority': 3,  // Low - priority changed
          'adduser': 2,      // Low - user added
          'removeuser': 2,   // Low - user removed
          'transcript': 1,   // Low - transcript generated
          'note': 1,         // Low - note added
          'update': 0        // Lowest - generic update
        };
        
        // Sort by priority and pick the most important action
        logs.sort((a, b) => {
          const priorityA = actionPriority[a.action_type] || 0;
          const priorityB = actionPriority[b.action_type] || 0;
          if (priorityA !== priorityB) {
            return priorityB - priorityA; // Higher priority first
          }
          // If same priority, use the latest timestamp
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        const primaryLog = logs[0];
        const userName = await getUserNameAsync(primaryLog.user_id);
        
        // Process ticket action using the same logic as ticket-logs endpoint
        let processedAction = primaryLog.action_type;
        let processedDetails = primaryLog.details;
        
        // Use the correct ticket ID field - prioritize ticket_number (user-facing) over ticket_id
        const displayTicketId = primaryLog.ticket_number || primaryLog.ticket_id;
        
        // Clean up details first and extract meaningful information
        if (processedDetails) {
          // Check if it starts with "Ticket #X: " and extract the JSON part
          let detailsToProcess = processedDetails;
          const ticketPrefixMatch = processedDetails.match(/^Ticket #\d+:\s*(.+)$/);
          if (ticketPrefixMatch) {
            detailsToProcess = ticketPrefixMatch[1];
          }
          
          // Try to parse as JSON first
          try {
            const parsed = JSON.parse(detailsToProcess);
            if (parsed.subject) {
              processedDetails = `Subject: "${parsed.subject}"`;
            } else if (parsed.reason) {
              processedDetails = `Reason: ${parsed.reason}`;
            } else if (parsed.note) {
              processedDetails = `Note: ${parsed.note}`;
            } else if (parsed.message) {
              processedDetails = `Message: ${parsed.message}`;
            } else {
              // If JSON but no recognizable fields, show the action performer
              processedDetails = null; // Will be set below based on action
            }
          } catch (e) {
            // If not JSON, clean up text-based details
            processedDetails = detailsToProcess
              .replace(/\s*\|\s*Channel:\s*[^|]*$/g, '')
              .replace(/\s*\|\s*Channel:\s*[^|]*\s*\|/g, ' | ')
              .replace(/Channel:\s*[^|]*\s*\|/g, '') 
              .replace(/Channel:\s*[^|]*$/g, '')
              .trim();
            
            // If it's still generic or empty, clear it to show action performer
            if (!processedDetails || 
                processedDetails === 'Ticket activity' || 
                processedDetails.length < 3) {
              processedDetails = null;
            }
          }
        }
        
        // If no meaningful details, create action-specific details with username
        if (!processedDetails || processedDetails === 'Ticket activity') {
          if (primaryLog.action_type === 'close') {
            processedDetails = `Closed by ${userName || 'Unknown'}`;
          } else if (primaryLog.action_type === 'delete') {
            processedDetails = `Deleted by ${userName || 'Unknown'}`;
          } else if (primaryLog.action_type === 'create') {
            processedDetails = `Created by ${userName || 'Unknown'}`;
          } else if (primaryLog.action_type === 'reopen') {
            processedDetails = `Reopened by ${userName || 'Unknown'}`;
          } else if (primaryLog.action_type === 'claim') {
            processedDetails = `Claimed by ${userName || 'Unknown'}`;
          } else if (primaryLog.action_type === 'transfer') {
            processedDetails = `Transferred by ${userName || 'Unknown'}`;
          } else {
            processedDetails = `${primaryLog.action_type.charAt(0).toUpperCase() + primaryLog.action_type.slice(1)} by ${userName || 'Unknown'}`;
          }
        }
        
        // Enhanced action descriptions with emojis
        let actionDescription = processedAction;
        if (primaryLog.action_type === 'create') {
          actionDescription = '🎫 Created ticket';
        } else if (primaryLog.action_type === 'close') {
          actionDescription = '🔒 Closed ticket';
        } else if (primaryLog.action_type === 'update') {
          actionDescription = '✏️ Updated ticket';
        } else if (primaryLog.action_type === 'delete') {
          actionDescription = '🗑️ Deleted ticket';
        } else if (primaryLog.action_type === 'setpriority') {
          actionDescription = '⚡ Changed priority';
        } else if (primaryLog.action_type === 'adduser') {
          actionDescription = '👤 Added user to ticket';
        } else if (primaryLog.action_type === 'removeuser') {
          actionDescription = '👤 Removed user from ticket';
        } else if (primaryLog.action_type === 'claim') {
          actionDescription = '✋ Claimed ticket';
        } else if (primaryLog.action_type === 'unclaim') {
          actionDescription = '🔄 Unclaimed ticket';
        } else if (primaryLog.action_type === 'transcript') {
          actionDescription = '📄 Generated transcript';
        } else if (primaryLog.action_type === 'reopen') {
          actionDescription = '🔓 Reopened ticket';
        } else if (primaryLog.action_type === 'transfer') {
          actionDescription = '🔄 Transferred ticket';
        } else if (primaryLog.action_type === 'note') {
          actionDescription = '📝 Added note';
        } else {
          actionDescription = `🔧 ${primaryLog.action_type.charAt(0).toUpperCase() + primaryLog.action_type.slice(1)}`;
        }
        
        // Create full description
        let description = actionDescription;
        if (displayTicketId) {
          description += ` #${displayTicketId}`;
        }
        
        // For close actions, if we have additional details from other logs in the group, include them
        if (primaryLog.action_type === 'close' && logs.length > 1) {
          const detailsFromOtherLogs = logs.slice(1).map(log => {
            if (log.details && log.details !== processedDetails) {
              try {
                const parsed = JSON.parse(log.details.replace(/^Ticket #\d+:\s*/, ''));
                if (parsed.subject && !processedDetails.includes(parsed.subject)) {
                  return `Subject: "${parsed.subject}"`;
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
            return null;
          }).filter(Boolean);
          
          if (detailsFromOtherLogs.length > 0 && !processedDetails) {
            processedDetails = detailsFromOtherLogs[0];
          }
        }
        
        activities.push({
          type: primaryLog.type,
          user_id: primaryLog.user_id,
          userName: userName,
          description: description,
          details: processedDetails || null,
          timestamp: primaryLog.timestamp,
          serverId: primaryLog.serverId
        });
      }
    } catch (e) {
      console.log('[DASHBOARD] Ticket action logs table not found for recent activity');
    }
    
    // Get recent warnings with detailed information
    try {
      const warningQuery = `
        SELECT 
          'warning' as type,
          user_id,
          moderator_id,
          reason,
          case_number,
          created_at as timestamp,
          guild_id as serverId
        FROM warnings 
        WHERE active = 1
        ${guild_id ? 'AND guild_id = ?' : ''}
        ORDER BY created_at DESC 
        LIMIT 5
      `;
      
      const warnings = db.prepare(warningQuery).all(guild_id ? [guild_id] : []);
      
      for (const warning of warnings) {
        const userName = await getUserNameAsync(warning.user_id);
        let moderatorName = warning.moderator_id ? await getUserNameAsync(warning.moderator_id) : 'AutoMod System';
        
        // Handle automated system actions (ONLY for actual automod)
        // Only treat as AutoMod if: explicitly system/automod ID, or explicit automod keywords in reason
        if (warning.moderator_id === 'system' || 
            warning.moderator_id === 'automod' ||
            (warning.reason && (warning.reason.toLowerCase().includes('automatic') || warning.reason.toLowerCase().includes('automod')))) {
          moderatorName = 'AutoMod System';
        }
        
        // Get the current warning count for this user
        let warningCount = 1; // Default to 1 if we can't get count
        try {
          const countQuery = `
            SELECT COUNT(*) as count 
            FROM warnings 
            WHERE user_id = ? AND guild_id = ? AND active = 1
          `;
          const countResult = db.prepare(countQuery).get(warning.user_id, warning.serverId);
          warningCount = countResult?.count || 1;
        } catch (e) {
          // Use default count
        }
        
        const description = `Warning issued to ${userName}`;
        
        // Format like the actual mod message with enhanced case number display
        const caseDisplay = warning.case_number ? `Case #${String(warning.case_number).padStart(4, '0')}` : 'Case #Unknown';
        const details = `⚠️ ${caseDisplay} | Total Warnings: ${warningCount}${warning.reason ? ` | Reason: ${warning.reason}` : ' | No reason provided'} | By: ${moderatorName}`;
        
        activities.push({
          type: warning.type,
          user_id: warning.user_id,
          userName: userName,
          description: `${caseDisplay}: Warning issued to ${userName}`,
          details: details,
          timestamp: warning.timestamp,
          serverId: warning.serverId
        });
      }
    } catch (e) {
      console.log('[DASHBOARD] Warnings table not found for recent activity');
    }
    
    // Get recent verification attempts with detailed information
    try {
      const verificationQuery = `
        SELECT 
          'verification' as type,
          user_id,
          target_id,
          action_type,
          details,
          created_at as timestamp,
          guild_id as serverId
        FROM server_logs 
        WHERE action_type IN ('memberVerificationSuccess', 'memberVerificationFailed')
        ${guild_id ? 'AND guild_id = ?' : ''}
        ORDER BY created_at DESC 
        LIMIT 5
      `;
      
      const verifications = db.prepare(verificationQuery).all(guild_id ? [guild_id] : []);
      
      for (const verification of verifications) {
        const userName = await getUserNameAsync(verification.target_id);
        const isSuccess = verification.action_type === 'memberVerificationSuccess';
        
        const description = `${isSuccess ? '✅ Verified successfully' : '❌ Verification failed'}`;
        
        // Parse verification details if available
        let detailsText = `User: ${userName}`;
        if (verification.details) {
          try {
            const parsed = JSON.parse(verification.details);
            if (parsed.verification_type) {
              detailsText += ` | Type: ${parsed.verification_type.toUpperCase()}`;
            }
            if (parsed.reason && !isSuccess) {
              detailsText += ` | Reason: ${parsed.reason}`;
            }
            if (parsed.account_age_days !== undefined) {
              detailsText += ` | Account Age: ${parsed.account_age_days} days`;
            }
          } catch (e) {
            // Use basic details if parsing fails
          }
        }
        
        activities.push({
          type: verification.type,
          user_id: verification.target_id,
          userName: userName,
          description: description,
          details: detailsText,
          timestamp: verification.timestamp,
          serverId: verification.serverId
        });
      }
    } catch (e) {
      console.log('[DASHBOARD] Server logs table not found for recent activity');
    }
    
    // Get recent commands with detailed information
    try {
      const commandQuery = `
        SELECT 
          'command' as type,
          user_id,
          command,
          options,
          success,
          error,
          channel_id,
          created_at as timestamp,
          guild_id as serverId
        FROM command_logs 
        ${guild_id ? 'WHERE guild_id = ?' : ''}
        ORDER BY created_at DESC 
        LIMIT 5
      `;
      
      const commands = db.prepare(commandQuery).all(...params);
      
      for (const command of commands) {
        const userName = await getUserNameAsync(command.user_id);
        const description = `Used command: /${command.command}`;
        
        // Build comprehensive details for commands
        let details = [];
        
        // Add execution status (check for various possible field names)
        if (command.success !== undefined && command.success !== null) {
          details.push(command.success === 1 || command.success === true ? '✅ Success' : '❌ Failed');
        } else {
          // Default to success if no status info
          details.push('✅ Executed');
        }
        
        // Add channel information
        if (command.channel_id) {
          const channelName = await getChannelNameAsync(command.channel_id);
          details.push(`Channel: #${channelName}`);
        }
        
        // Add options if they exist and aren't empty
        if (command.options && command.options !== '[]' && command.options !== 'null' && command.options !== '{}' && command.options.trim() !== '') {
          details.push(`Options: ${command.options}`);
        }
        
        // Add error information if command failed
        if (command.error && command.error !== null && command.error.trim() !== '') {
          details.push(`Error: ${command.error}`);
        }
        
        activities.push({
          type: command.type,
          user_id: command.user_id,
          userName: userName,
          description: description,
          details: details.join(' | '),
          timestamp: command.timestamp,
          serverId: command.serverId
        });
      }
    } catch (e) {
      console.log('[DASHBOARD] Command logs table not found for recent activity');
    }
    
    // Sort all activities by timestamp and limit to 10
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    activities = activities.slice(0, 10);
    
    // Convert to Israeli time (UTC+3) and format for display
    const formattedActivities = activities.map((activity, index) => {
      const israeliTime = new Date(new Date(activity.timestamp).getTime() + (3 * 60 * 60 * 1000));
      return {
        id: `activity_${Date.now()}_${index}`,
        type: activity.type,
        user: activity.userName || 'Unknown',
        description: activity.description || 'Activity',
        details: activity.details || null,
        timestamp: israeliTime.toISOString(),
        serverId: activity.serverId || null
      };
    });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    res.json({
      success: true,
      data: formattedActivities
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting recent activity:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Command logs endpoint
router.get('/command-logs', async (req, res) => {
  try {
    const { guild_id } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({ success: true, data: [] });
    }

    // Ultra-fast username resolution (sync only) - same as /logs endpoint
    const getDisplayName = (userId) => {
      if (!userId) return 'Unknown User';
      
      try {
        // First try the sync version
        const syncUsername = getDiscordUsernameSync(userId);
        if (syncUsername && 
            syncUsername !== `User_${userId.slice(-4)}` && 
            !syncUsername.startsWith('User_') && 
            syncUsername.length > 5) {
          return syncUsername;
        }
        
        // Try client cache directly if sync failed
        try {
          const client = getClient();
          if (client && isClientReady()) {
            const user = client.users.cache.get(userId);
            if (user && user.username) {
              return user.displayName || user.username || user.tag;
            }
          }
        } catch (e) {
          // Silent fail
        }
        
        // Try basic cache lookup without ready check (more permissive)
        try {
          const client = getClient();
          if (client) {
            const user = client.users.cache.get(userId);
            if (user && user.username) {
              return user.displayName || user.username || user.tag;
            }
          }
        } catch (e) {
          // Silent fail
        }
      } catch (e) {
        // Silent fail
      }
      
      // Fallback to user ID format (instant)
      return `User_${userId.slice(-4)}`;
    };

    // Ultra-fast channel resolution (sync only)
    const getChannelDisplayName = (channelId) => {
      if (!channelId) return 'Unknown Channel';
      
      try {
        const client = getClient();
        if (!client || !isClientReady()) {
          return `Channel_${channelId.slice(-4)}`;
        }
        
        // Try cache only (no fetching)
        const channel = client.channels.cache.get(channelId);
        if (channel && channel.name) {
          return channel.name;
        }
      } catch (e) {
        // Silent fail
      }
      
      return `Channel_${channelId.slice(-4)}`;
    };
    
    let query = `
      SELECT 
        id,
        guild_id,
        user_id,
        command,
        options,
        channel_id,
        success,
        error,
        created_at
      FROM command_logs
    `;
    
    const params = [];
    if (guild_id) {
      query += ' WHERE guild_id = ?';
      params.push(guild_id);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 50';
    
    let logs = [];
    try {
      logs = db.prepare(query).all(...params);
      
      // Process logs instantly (no async calls)
      for (const log of logs) {
        if (log.user_id) {
          log.userName = getDisplayName(log.user_id);
        }
        if (log.channel_id) {
          const channelName = getChannelDisplayName(log.channel_id);
          log.channel = `#${channelName}`;
          log.channelName = channelName;
          log.channelDisplay = `#${channelName}`;
        }
        
        // Convert to Israeli time (+3 hours) and format cleanly
        const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$1/$2/$3 at $4');
        log.created_at = formattedTime;
        
        // Format the command for better display
        log.commandDisplay = `/${log.command}`;
        if (log.options && log.options !== '[]' && log.options !== 'null' && log.options !== '{}') {
          log.commandDisplay += ` ${log.options}`;
        }
        
        // Add execution status
        log.statusDisplay = log.success ? 'Command executed successfully' : 'Command failed';
        if (log.error) {
          log.statusDisplay += `: ${log.error}`;
        }
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Command logs table not found');
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    res.json({
      success: true,
      data: logs || []
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting command logs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// POST endpoint for command logging (from bot)
router.post('/command-logs', async (req, res) => {
  try {
    const { guild_id, user_id, command, success, error_message } = req.body;
    
    if (!guild_id || !user_id || !command) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: guild_id, user_id, command'
      });
    }
    
    if (!db || typeof db.prepare !== 'function') {
      return res.status(500).json({
        success: false,
        error: 'Database not available'
      });
    }
    
    try {
      // Create command_logs table if it doesn't exist
      db.prepare(`
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
      `).run();
      
      // Insert the command log
      const stmt = db.prepare(`
        INSERT INTO command_logs (guild_id, user_id, command, success, error, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      const result = stmt.run(
        guild_id,
        user_id,
        command,
        success ? 1 : 0,
        error_message || null
      );
      
      console.log(`[DASHBOARD] Command log created: ${command} by user ${user_id} in guild ${guild_id}`);
      
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
      res.json({
        success: true,
        message: 'Command log created successfully',
        id: result.lastInsertRowid
      });
      
    } catch (dbError) {
      console.error('[DASHBOARD] Database error creating command log:', dbError);
      res.status(500).json({
        success: false,
        error: 'Database error'
      });
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error creating command log:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Message logs endpoint
router.get('/message-logs', async (req, res) => {
  try {
    const { guild_id } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({ success: true, data: [] });
    }
    
    let query = `
      SELECT 
        id,
        guild_id,
        user_id,
        channel_id,
        action,
        content,
        created_at,
        'message' as log_type
      FROM message_logs
    `;
    
    const params = [];
    if (guild_id) {
      query += ' WHERE guild_id = ?';
      params.push(guild_id);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 50';
    
    let logs = [];
    try {
      logs = db.prepare(query).all(...params);
      
      for (const log of logs) {
        try {
          log.userName = await Promise.race([
            getUserNameAsync(log.user_id),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
          ]);
        } catch (e) {
          log.userName = `User_${log.user_id?.slice(-4) || 'Unknown'}`;
        }
        
        // Convert to Israeli time (+3 hours)
        const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
        log.created_at = israeliTime.toISOString();
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Message logs table not found');
    }
    
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('[DASHBOARD] Error getting message logs:', error);
    res.json({ success: true, data: [] });
  }
});

// Moderation logs endpoint
router.get('/mod-logs', async (req, res) => {
  try {
    const { guild_id } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({ success: true, data: [] });
    }

    // Ultra-fast username resolution (sync only)
    const getDisplayName = (userId) => {
      if (!userId) return 'Unknown User';
      
      try {
        const syncUsername = getDiscordUsernameSync(userId);
        if (syncUsername && syncUsername !== `User_${userId.slice(-4)}`) {
          return syncUsername;
        }
      } catch (e) {
        // Silent fail
      }
      
      return `User_${userId.slice(-4)}`;
    };

    let allModerationLogs = [];

    // Get moderation logs from server_logs table (this is where they're actually stored)
    try {
      let query = `
        SELECT 
          id,
          guild_id,
          user_id as moderator_id,
          target_id,
          action_type as action,
          reason,
          details,
          created_at,
          'moderation' as log_type
        FROM server_logs
        WHERE action_type IN ('memberBan', 'memberKick', 'memberTimeout', 'memberWarning', 'warningRemoved')
      `;
      
      const params = [];
      if (guild_id) {
        query += ' AND guild_id = ?';
        params.push(guild_id);
      }
      
      query += ' ORDER BY created_at DESC LIMIT 25';
      
      const moderationLogs = db.prepare(query).all(...params);
      
      // Process logs instantly (no async calls)
      for (const log of moderationLogs) {
        // target_id is the target, moderator_id is who performed the action
        log.userName = getDisplayName(log.target_id);
        log.moderatorName = getDisplayName(log.moderator_id);
        
        // Format the action for display
        switch(log.action) {
          case 'memberBan':
            log.action = 'Ban';
            break;
          case 'memberKick':
            log.action = 'Kick';
            break;
          case 'memberTimeout':
            log.action = 'Timeout';
            break;
          case 'warningRemoved':
            log.action = 'Warning Removed';
            break;
        }
        
        // Enhanced details with moderator info and case number formatting for ALL moderation actions
        let actionEmoji = '⚖️';
        let moderationCaseType = '';
        
        switch(log.action_type) {
          case 'memberBan':
            actionEmoji = '🔨';
            moderationCaseType = 'Ban';
            break;
          case 'memberKick':
            actionEmoji = '👢';
            moderationCaseType = 'Kick';
            break;
          case 'memberTimeout':
            actionEmoji = '⏰';
            moderationCaseType = 'Timeout';
            break;
          case 'warningRemoved':
            actionEmoji = '🚫';
            moderationCaseType = 'Warning Removal';
            break;
        }
        
        // Get case number for ALL moderation actions
        try {
          const caseStmt = db.prepare(`
            SELECT case_number FROM moderation_cases 
            WHERE guild_id = ? AND user_id = ? AND action_type = ? 
            ORDER BY created_at DESC LIMIT 1
          `);
          // For server logs, use target_id (the actual user who received the action)
          const caseResult = caseStmt.get(log.guild_id, log.target_id, moderationCaseType);
          const caseNumber = caseResult ? caseResult.case_number : null;
          const caseDisplay = caseNumber ? `Case #${String(caseNumber).padStart(4, '0')}` : 'Case #Unknown';
          
          // Format exactly like warnings for ALL moderation actions
          if (log.action_type === 'warningRemoved') {
            // Update the action title to include case number for consistency with warnings
            log.action = caseNumber ? `Warning Removed Case #${caseNumber}` : 'Warning Removed Case #Unknown';
            log.details = `${actionEmoji} ${caseDisplay}: ${log.moderatorName} removed warning from ${log.userName} | Reason: ${log.reason || 'No reason provided'}`;
          } else {
            log.details = `${actionEmoji} ${caseDisplay}: ${log.moderatorName} ${log.action.toLowerCase()}ed ${log.userName} | Reason: ${log.reason || 'No reason provided'}`;
          }
        } catch (e) {
          // Fallback to original format if case lookup fails
          log.details = `${log.action} | Target: ${log.userName} | Moderator: ${log.moderatorName} | Reason: ${log.reason || 'No reason provided'}`;
        }
        
        // Convert to Israeli time (+3 hours) and format cleanly
        const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$1/$2/$3 at $4');
        log.created_at = formattedTime;
        
        allModerationLogs.push(log);
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Server logs table not found or error querying moderation logs:', dbError);
    }

    // Also get warnings as moderation logs
    try {
      let warningQuery = `
        SELECT 
          id,
          guild_id,
          user_id,
          moderator_id,
          'Warning' as action,
          reason,
          case_number,
          created_at,
          'moderation' as log_type
        FROM warnings
        WHERE active = 1
      `;
      
      const warningParams = [];
      if (guild_id) {
        warningQuery += ' AND guild_id = ?';
        warningParams.push(guild_id);
      }
      
      warningQuery += ' ORDER BY created_at DESC LIMIT 25';
      
      const warnings = db.prepare(warningQuery).all(...warningParams);
      
      // Process warnings instantly (no async calls)
      for (const warning of warnings) {
        warning.userName = getDisplayName(warning.user_id);
        warning.moderatorName = getDisplayName(warning.moderator_id);
        
        // Enhanced warning details with properly formatted case number - same style as other moderation actions
        const caseDisplay = warning.case_number ? `Case #${String(warning.case_number).padStart(4, '0')}` : 'Case #Unknown';
        warning.details = `⚠️ ${caseDisplay}: ${warning.moderatorName} warned ${warning.userName} | Reason: ${warning.reason || 'No reason provided'}`;
        
        // Convert to Israeli time (+3 hours) and format as 24-hour
        const israeliTime = new Date(new Date(warning.created_at).getTime() + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('he-IL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        warning.created_at = formattedTime;
        
        allModerationLogs.push(warning);
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Warnings table not found');
    }

    // Get verification logs from server_logs table
    try {
      let verificationQuery = `
        SELECT 
          id,
          guild_id,
          user_id as moderator_id,
          target_id as user_id,
          action_type as action,
          reason,
          details,
          created_at,
          'verification' as log_type
        FROM server_logs
        WHERE action_type IN ('memberVerificationSuccess', 'memberVerificationFailed')
      `;
      
      const verificationParams = [];
      if (guild_id) {
        verificationQuery += ' AND guild_id = ?';
        verificationParams.push(guild_id);
      }
      
      verificationQuery += ' ORDER BY created_at DESC LIMIT 10';
      
      const verificationLogs = db.prepare(verificationQuery).all(...verificationParams);
      
      // Process verification logs instantly (no async calls)
      for (const log of verificationLogs) {
        // For verification, user_id is the person who got verified (target_id)
        log.userName = getDisplayName(log.user_id);
        
        // Format the action for display
        let emoji = '';
        switch(log.action) {
          case 'memberVerificationSuccess':
            log.action = 'Verification Success';
            emoji = '✅';
            break;
          case 'memberVerificationFailed':
            log.action = 'Verification Failed';
            emoji = '❌';
            break;
        }
        
        // Enhanced details for verification
        log.details = `${emoji} ${log.action} | User: ${log.userName}`;
        
        // Convert to Israeli time (+3 hours) and format cleanly
        const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$1/$2/$3 at $4');
        log.created_at = formattedTime;
        
        allModerationLogs.push(log);
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Server logs table not found for verification logs');
    }

    // Sort by date and limit results
    allModerationLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    allModerationLogs = allModerationLogs.slice(0, 50);
    
    res.json({
      success: true,
      data: allModerationLogs
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting moderation logs:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

// Server logs endpoint
router.get('/server-logs', async (req, res) => {
  try {
    const { guild_id } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({ success: true, data: [] });
    }
    
    let activities = [];
    
    // Get server activity logs (member joins, leaves, etc.) - NOT moderation
    try {
      let serverQuery = `
        SELECT 
          id,
          guild_id,
          user_id,
          action,
          action_type,
          details,
          created_at,
          'server' as log_type
        FROM server_logs
        WHERE action NOT IN ('warn', 'kick', 'ban', 'timeout', 'mute', 'unmute')
      `;
      
      const serverParams = [];
      if (guild_id) {
        serverQuery += ' AND guild_id = ?';
        serverParams.push(guild_id);
      }
      
      serverQuery += ' ORDER BY created_at DESC LIMIT 50';
      
      const serverLogs = db.prepare(serverQuery).all(...serverParams);
      
      for (const log of serverLogs) {
        log.userName = await getUserNameAsync(log.user_id);
        
        // Convert to Israeli time (+3 hours) and format cleanly
        const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$1/$2/$3 at $4');
        log.created_at = formattedTime;
        
        activities.push(log);
      }
    } catch (e) {
      console.log('[DASHBOARD] Server logs table not found');
    }
    
    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting server logs:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

// User logs endpoint
router.get('/user-logs', async (req, res) => {
  try {
    const { guild_id } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({ success: true, data: [] });
    }
    
    let query = `
      SELECT 
        id,
        guild_id,
        user_id,
        action,
        action_type,
        details,
        created_at,
        'user' as log_type
      FROM user_logs
    `;
    
    const params = [];
    if (guild_id) {
      query += ' WHERE guild_id = ?';
      params.push(guild_id);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 50';
    
    let logs = [];
    try {
      logs = db.prepare(query).all(...params);
      
      for (let i = 0; i < logs.length; i++) {
        logs[i].userName = await getUserNameAsync(logs[i].user_id);
        
        // Convert to Israeli time (+3 hours) and format as 24-hour
        const israeliTime = new Date(new Date(logs[i].created_at).getTime() + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('he-IL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        logs[i].created_at = formattedTime;
      }
    } catch (dbError) {
      console.log('[DASHBOARD] User logs table not found');
      logs = [];
    }
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting user logs:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

// Ticket logs endpoint
router.get('/ticket-logs', async (req, res) => {
  console.log('[DASHBOARD] 🔧 USING UPDATED TICKET-LOGS ENDPOINT WITH FIXES! 🔧');
  try {
    const { guild_id } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({ success: true, data: [] });
    }
    
    let query = `
      SELECT 
        id,
        guild_id,
        user_id,
        ticket_id,
        ticket_number,
        action as action_type,
        details,
        created_at,
        'ticket' as log_type
      FROM ticket_action_logs
    `;
    
    const params = [];
    if (guild_id) {
      query += ' WHERE guild_id = ?';
      params.push(guild_id);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 100'; // Get more records for grouping
    
    let rawLogs = [];
    try {
      rawLogs = db.prepare(query).all(...params);
    } catch (dbError) {
      console.log('[DASHBOARD] Ticket logs table not found');
      return res.json({ success: true, data: [] });
    }
    
    // Apply the same grouping logic as recent-activity to eliminate duplicates
    const groupedTickets = new Map();
    
    for (const log of rawLogs) {
      const ticketKey = `${log.ticket_id}_${Math.floor(new Date(log.created_at).getTime() / (30 * 1000))}`;
      
      if (!groupedTickets.has(ticketKey)) {
        groupedTickets.set(ticketKey, []);
      }
      groupedTickets.get(ticketKey).push(log);
    }
    
    let logs = [];
    
    // Process each group and pick the most meaningful action
    for (const [ticketKey, logsGroup] of groupedTickets) {
      if (logsGroup.length === 0) continue;
      
      // Priority order for actions (higher priority = more important to show)
      const actionPriority = {
        'delete': 10,      // Highest - ticket was deleted
        'close': 9,        // High - ticket was closed (final state)
        'reopen': 8,       // High - ticket was reopened (state change)
        'create': 7,       // Medium - ticket was created (initial state)
        'transfer': 6,     // Medium - ticket was transferred
        'claim': 5,        // Medium - ticket was claimed
        'unclaim': 4,      // Medium - ticket was unclaimed
        'setpriority': 3,  // Low - priority changed
        'adduser': 2,      // Low - user added
        'removeuser': 2,   // Low - user removed
        'transcript': 1,   // Low - transcript generated
        'note': 1,         // Low - note added
        'update': 0        // Lowest - generic update
      };
      
      // Sort by priority and pick the most important action
      logsGroup.sort((a, b) => {
        const priorityA = actionPriority[a.action_type] || 0;
        const priorityB = actionPriority[b.action_type] || 0;
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Higher priority first
        }
        // If same priority, use the latest timestamp
        return new Date(b.created_at) - new Date(a.created_at);
      });
      
      const primaryLog = logsGroup[0];
      logs.push(primaryLog);
    }
    
    // Sort by created_at and limit to 50 results
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    logs = logs.slice(0, 50);
    
    // Process logs with simplified logic
    for (const log of logs) {
      const processedLog = { ...log };
      
      // Use the correct ticket ID field - prioritize ticket_number (user-facing) over ticket_id
      const displayTicketId = processedLog.ticket_number || processedLog.ticket_id;
      processedLog.display_ticket_id = displayTicketId;
      
      // IMPORTANT: Replace the internal ticket_id with the display_ticket_id for frontend
      processedLog.ticket_id = displayTicketId;
      
      // Get username first and ensure it's not undefined
      try {
        processedLog.userName = await getUserNameAsync(processedLog.user_id);
        // Ensure we have a valid username, not undefined
        if (!processedLog.userName || processedLog.userName === 'undefined') {
          processedLog.userName = `User_${processedLog.user_id?.slice(-4) || 'Unknown'}`;
        }
      } catch (e) {
        processedLog.userName = `User_${processedLog.user_id?.slice(-4) || 'Unknown'}`;
      }
      
      // Clean up any existing channel information from ticket details
      if (processedLog.details) {
        // Check if it starts with "Ticket #X: " and extract the JSON part
        let detailsToProcess = processedLog.details;
        const ticketPrefixMatch = processedLog.details.match(/^Ticket #\d+:\s*(.+)$/);
        if (ticketPrefixMatch) {
          detailsToProcess = ticketPrefixMatch[1];
        }
        
        // Try to parse as JSON first
        try {
          const parsed = JSON.parse(detailsToProcess);
          if (parsed.subject) {
            processedLog.details = `Subject: "${parsed.subject}"`;
          } else if (parsed.reason) {
            processedLog.details = `Reason: ${parsed.reason}`;
          } else if (parsed.note) {
            processedLog.details = `Note: ${parsed.note}`;
          } else if (parsed.message) {
            processedLog.details = `Message: ${parsed.message}`;
          } else {
            // If JSON but no recognizable fields, show the action performer
            processedLog.details = null; // Will be set below based on action
          }
        } catch (e) {
          // If not JSON, clean up text-based details
          processedLog.details = detailsToProcess
            .replace(/\s*\|\s*Channel:\s*[^|]*$/g, '')
            .replace(/\s*\|\s*Channel:\s*[^|]*\s*\|/g, ' | ')
            .replace(/Channel:\s*[^|]*\s*\|/g, '') 
            .replace(/Channel:\s*[^|]*$/g, '')
            .trim();
          
          // If it's still generic or empty, clear it to show action performer
          if (!processedLog.details || 
              processedLog.details === 'Ticket activity' || 
              processedLog.details.length < 3) {
            processedLog.details = null;
          }
        }
      }
      
      // If no meaningful details, create action-specific details with username
      if (!processedLog.details || processedLog.details === 'Ticket activity') {
        if (processedLog.action_type === 'close') {
          processedLog.details = `Closed by ${processedLog.userName}`;
        } else if (processedLog.action_type === 'delete') {
          processedLog.details = `Deleted by ${processedLog.userName}`;
        } else if (processedLog.action_type === 'create') {
          processedLog.details = `Created by ${processedLog.userName}`;
        } else if (processedLog.action_type === 'reopen') {
          processedLog.details = `Reopened by ${processedLog.userName}`;
        } else if (processedLog.action_type === 'claim') {
          processedLog.details = `Claimed by ${processedLog.userName}`;
        } else if (processedLog.action_type === 'transfer') {
          processedLog.details = `Transferred by ${processedLog.userName}`;
        } else {
          processedLog.details = `${processedLog.action_type.charAt(0).toUpperCase() + processedLog.action_type.slice(1)} by ${processedLog.userName}`;
        }
      }
      
      // Clean up the action for better display
      if (processedLog.action_type) {
        processedLog.action = processedLog.action_type;
        
        // Enhanced action descriptions with more detail
        if (processedLog.action_type === 'create') {
          processedLog.action = '🎫 Created ticket';
        } else if (processedLog.action_type === 'close') {
          processedLog.action = '🔒 Closed ticket';
        } else if (processedLog.action_type === 'update') {
          processedLog.action = '✏️ Updated ticket';
        } else if (processedLog.action_type === 'delete') {
          processedLog.action = '🗑️ Deleted ticket';
        } else if (processedLog.action_type === 'setpriority') {
          processedLog.action = '⚡ Changed priority';
        } else if (processedLog.action_type === 'adduser') {
          processedLog.action = '👤 Added user to ticket';
        } else if (processedLog.action_type === 'removeuser') {
          processedLog.action = '👤 Removed user from ticket';
        } else if (processedLog.action_type === 'claim') {
          processedLog.action = '✋ Claimed ticket';
        } else if (processedLog.action_type === 'unclaim') {
          processedLog.action = '🔄 Unclaimed ticket';
        } else if (processedLog.action_type === 'transcript') {
          processedLog.action = '📄 Generated transcript';
        } else if (processedLog.action_type === 'reopen') {
          processedLog.action = '🔓 Reopened ticket';
        } else if (processedLog.action_type === 'transfer') {
          processedLog.action = '🔄 Transferred ticket';
        } else if (processedLog.action_type === 'note') {
          processedLog.action = '📝 Added note';
        } else {
          // For any unknown action types, use the raw action_type with proper formatting
          processedLog.action = `🔧 ${processedLog.action_type.charAt(0).toUpperCase() + processedLog.action_type.slice(1)}`;
        }
      }
      
      // Create a comprehensive description combining action and details
      let fullDescription = processedLog.action;
      if (processedLog.display_ticket_id) {
        fullDescription += ` #${processedLog.display_ticket_id}`;
      }
      
      // Add details if meaningful
      if (processedLog.details && 
          processedLog.details !== 'Ticket activity' && 
          !processedLog.details.startsWith('Ticket #') &&
          processedLog.details.trim() !== '') {
        fullDescription += ` - ${processedLog.details}`;
      }
      
      processedLog.fullDescription = fullDescription;
      
      // Add ticket ID if not already present
      if (processedLog.display_ticket_id && !processedLog.details.includes('Ticket #') && !processedLog.details.includes('Subject:')) {
        processedLog.details = `Ticket #${processedLog.display_ticket_id}: ${processedLog.details || 'Activity'}`;
      }
      
      // Convert to Israeli time (+3 hours) and format as 24-hour
      const israeliTime = new Date(new Date(processedLog.created_at).getTime() + (3 * 60 * 60 * 1000));
      const formattedTime = israeliTime.toLocaleString('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      processedLog.created_at = formattedTime;
      
      logs[logs.indexOf(log)] = processedLog;
    }
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting ticket logs:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

// Dashboard logs endpoint
router.get('/dashboard-logs', async (req, res) => {
  try {
    const { guild_id, user_id, action_type, page, limit = 50, offset = 0 } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({ success: true, data: [], total: 0 });
    }
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    // Build WHERE clause based on filters
    if (guild_id) {
      whereClause += ' AND guild_id = ?';
      params.push(guild_id);
    }
    
    if (user_id) {
      whereClause += ' AND user_id = ?';
      params.push(user_id);
    }
    
    if (action_type) {
      whereClause += ' AND action_type = ?';
      params.push(action_type);
    }
    
    if (page) {
      whereClause += ' AND page = ?';
      params.push(page);
    }
    
    let logs = [];
    let total = 0;
    
    try {
      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM dashboard_logs ${whereClause}`;
      const countResult = db.prepare(countQuery).get(...params);
      total = countResult?.count || 0;
      
      // Get logs with pagination
      const logsQuery = `
        SELECT * FROM dashboard_logs 
        ${whereClause} 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      logs = db.prepare(logsQuery).all(...params, parseInt(limit), parseInt(offset));
      
      // Format logs with Israeli timezone and usernames
      for (const log of logs) {
        if (log.user_id && log.user_id !== 'anonymous') {
          try {
            log.userName = await Promise.race([
              getUserNameAsync(log.user_id),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
            ]);
          } catch (e) {
            log.userName = `User_${log.user_id?.slice(-4) || 'Unknown'}`;
          }
        } else {
          log.userName = 'Anonymous';
        }
        
        // Convert to Israeli time (+3 hours) and format cleanly
        const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$1/$2/$3 at $4');
        log.created_at = formattedTime;
        
        // Format action type for better display
        let actionDisplay;
        switch (log.action_type) {
          case 'memberVerificationSuccess':
            actionDisplay = 'Verification Success';
            break;
          case 'memberVerificationFailed':
            actionDisplay = 'Verification Failed';
            break;
          case 'login':
            actionDisplay = 'User Login';
            break;
          case 'logout':
            actionDisplay = 'User Logout';
            break;
          case 'export_data':
            actionDisplay = 'Data Export';
            break;
          case 'manage_warnings':
            actionDisplay = 'Manage Warnings';
            break;
          case 'manage_tickets':
            actionDisplay = 'Manage Tickets';
            break;
          case 'manage_settings':
            actionDisplay = 'Manage Settings';
            break;
          case 'update_server_settings':
            actionDisplay = 'Update Server Settings';
            break;
          case 'update_settings':
            actionDisplay = 'Update Settings';
            break;
          case 'create_ticket':
            actionDisplay = 'Create Ticket';
            break;
          case 'create_warning':
            actionDisplay = 'Create Warning';
            break;
          case 'delete_ticket':
            actionDisplay = 'Delete Ticket';
            break;
          case 'delete_warning':
            actionDisplay = 'Delete Warning';
            break;
          default:
            actionDisplay = log.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        log.actionDisplay = actionDisplay;
        
        // Format success status
        log.statusDisplay = log.success ? '✅ Success' : '❌ Failed';
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Dashboard logs table not found');
      logs = [];
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    res.json({
      success: true,
      data: logs,
      total: total,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting dashboard logs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Test endpoint to check command log fields
router.get('/test-command-log', async (req, res) => {
  try {
    if (!db || typeof db.prepare !== 'function') {
      return res.json({ error: 'Database not available' });
    }
    
    const log = db.prepare('SELECT * FROM command_logs ORDER BY created_at DESC LIMIT 1').get();
    
    if (!log) {
      return res.json({ error: 'No command logs found' });
    }
    
    // Process the log the same way as in command-logs endpoint
    if (log.user_id) {
      log.userName = await getUserNameAsync(log.user_id);
    }
    if (log.channel_id) {
      const resolvedChannelName = await getChannelNameAsync(log.channel_id);
      // console.log(`[TEST] Resolved channel ${log.channel_id} to: ${resolvedChannelName}`);
      
      if (resolvedChannelName && resolvedChannelName !== `Channel_${log.channel_id.slice(-4)}`) {
        log.channel = `#${resolvedChannelName}`;
        log.channelName = resolvedChannelName;
        log.channelDisplay = `#${resolvedChannelName}`;
      } else {
        log.channel = `#Channel_${log.channel_id.slice(-4)}`;
        log.channelName = `Channel_${log.channel_id.slice(-4)}`;
        log.channelDisplay = `#Channel_${log.channel_id.slice(-4)}`;
      }
    }
    
    res.json({
      success: true,
      originalChannelId: log.channel_id,
      resolvedChannel: log.channel,
      channelName: log.channelName,
      channelDisplay: log.channelDisplay,
      allFields: log
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// General logs endpoint - ultra-fast loading (no async username resolution)
router.get('/logs', async (req, res) => {
  console.log('[DASHBOARD] /logs endpoint called');
  try {
    const { guild_id } = req.query;
    console.log('[DASHBOARD] guild_id:', guild_id);
    
    if (!db || typeof db.prepare !== 'function') {
      console.log('[DASHBOARD] Database not available');
      return res.json({ success: true, data: [] });
    }

    console.log('[DASHBOARD] Database available, proceeding...');
    let simpleLogs = [];

    // Ultra-fast username resolution (sync only) - same as /logs endpoint
    const getDisplayName = (userId) => {
      if (!userId) return 'Unknown User';
      
      try {
        // First try the sync version
        const syncUsername = getDiscordUsernameSync(userId);
        if (syncUsername && 
            syncUsername !== `User_${userId.slice(-4)}` && 
            !syncUsername.startsWith('User_') && 
            syncUsername.length > 5) {
          return syncUsername;
        }
        
        // Try client cache directly if sync failed
        try {
          const client = getClient();
          if (client && isClientReady()) {
            const user = client.users.cache.get(userId);
            if (user && user.username) {
              return user.displayName || user.username || user.tag;
            }
          }
        } catch (e) {
          // Silent fail
        }
        
        // Try basic cache lookup without ready check (more permissive)
        try {
          const client = getClient();
          if (client) {
            const user = client.users.cache.get(userId);
            if (user && user.username) {
              return user.displayName || user.username || user.tag;
            }
          }
        } catch (e) {
          // Silent fail
        }
      } catch (e) {
        // Silent fail
      }
      
      // Fallback to user ID format (instant)
      return `User_${userId.slice(-4)}`;
    };

    // Get recent command logs (ultra-fast query)
    try {
      console.log('[DASHBOARD] Querying command logs...');
      let commandQuery = `
        SELECT 
          id,
          'command' as type,
          user_id,
          command as action,
          created_at,
          success
        FROM command_logs
      `;
      
      const commandParams = [];
      if (guild_id) {
        commandQuery += ' WHERE guild_id = ?';
        commandParams.push(guild_id);
      }
      
      commandQuery += ' ORDER BY created_at DESC LIMIT 10'; // Further reduced for speed
      
      const commandLogs = db.prepare(commandQuery).all(...commandParams);
      console.log('[DASHBOARD] Found', commandLogs.length, 'command logs');
      
      // Process logs with proper async username resolution
      for (const log of commandLogs) {
        try {
          const userName = await getUserNameAsync(log.user_id);
          log.userName = userName;
          log.user_name = userName; // Add this field for frontend compatibility
          log.details = `🤖 /${log.action} | ${userName} | ${log.success ? '✅' : '❌'}`;
          
          // Convert to Israeli time (+3 hours) and format as 24-hour
          const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
          const formattedTime = israeliTime.toLocaleString('he-IL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          log.created_at = formattedTime;
          
          simpleLogs.push(log);
        } catch (userError) {
          console.log('[DASHBOARD] Error processing user:', userError);
          // Continue with other logs
        }
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Error querying command logs:', dbError);
    }

    // Get recent moderation logs from server_logs table (ultra-fast)
    try {
      console.log('[DASHBOARD] Querying moderation logs...');
      let moderationQuery = `
        SELECT 
          id,
          'moderation' as type,
          user_id as moderator_id,
          target_id,
          action_type,
          reason,
          created_at,
          guild_id
        FROM server_logs
        WHERE action_type IN ('memberBan', 'memberKick', 'memberTimeout', 'memberWarning', 'warningRemoved')
      `;
      
      const moderationParams = [];
      if (guild_id) {
        moderationQuery += ' AND guild_id = ?';
        moderationParams.push(guild_id);
      }
      
      moderationQuery += ' ORDER BY created_at DESC LIMIT 10';
      
      const moderationLogs = db.prepare(moderationQuery).all(...moderationParams);
      console.log('[DASHBOARD] Found', moderationLogs.length, 'moderation logs');
      
      for (const log of moderationLogs) {
        try {
          // For moderation actions in server_logs: user_id = moderator, target_id = target user
          let userName = await getUserNameAsync(log.target_id);
          let moderatorName = await getUserNameAsync(log.user_id);
          
          // Fallback: Extract usernames from details JSON if lookup failed
          if ((userName === 'Unknown User' || userName.startsWith('User_')) && log.details) {
            try {
              const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
              if (details.targetTag) {
                userName = details.targetTag;
              }
            } catch (e) {
              // Keep the fallback username
            }
          }
          
          if ((moderatorName === 'Unknown User' || moderatorName.startsWith('User_')) && log.details) {
            try {
              const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
              if (details.moderatorTag) {
                moderatorName = details.moderatorTag;
              }
            } catch (e) {
              // Keep the fallback username
            }
          }
          
          // Debug logging
          console.log('[DEBUG] Moderation log:', {
            user_id: log.user_id,
            target_id: log.target_id,
            moderatorName: moderatorName,
            userName: userName,
            action_type: log.action_type
          });
          
          // Only show AutoMod for actual system actions, never for regular user IDs
          if (log.user_id === 'system' || 
              log.user_id === 'automod' ||
              (log.reason && (log.reason.toLowerCase().includes('automatic') || log.reason.toLowerCase().includes('automod')))) {
            moderatorName = 'AutoMod System';
          } else if (!moderatorName) {
            // If we can't get the moderator name, show the ID instead of defaulting to AutoMod
            moderatorName = `User (${log.user_id})`;
          }
          
          // Map action_type to display action
          switch(log.action_type) {
            case 'memberBan':
              log.action = 'Ban';
              break;
            case 'memberKick':
              log.action = 'Kick';
              break;
            case 'memberTimeout':
              log.action = 'Timeout';
              break;
            case 'memberWarning':
              log.action = 'Warning';
              break;
            case 'warningRemoved':
              log.action = 'Warning Removed';
              break;
            default:
              log.action = log.action_type;
          }
          
          log.userName = userName;
          log.moderatorName = moderatorName;
          
          // Map action to display name
          let actionDisplay = log.action;
          let emoji = '🛡️';
          
          switch (log.action) {
            case 'ban':
              actionDisplay = 'Ban';
              emoji = '🔨';
              break;
            case 'unban':
              actionDisplay = 'Unban';
              emoji = '🔓';
              break;
            case 'kick':
            case 'MemberKick':
            case 'memberKick':
              actionDisplay = 'Kick';
              emoji = '👢';
              break;
            case 'timeout':
              actionDisplay = 'Timeout';
              emoji = '⏰';
              break;
            case 'warning':
              actionDisplay = 'Warning';
              emoji = '⚠️';
              break;
            case 'warningRemoved':
              actionDisplay = 'Warning Removed';
              emoji = '✅';
              break;
            case 'memberVerificationSuccess':
              actionDisplay = 'Verification Success';
              emoji = '✅';
              break;
            case 'memberVerificationFailed':
              actionDisplay = 'Verification Failed';
              emoji = '❌';
              break;
            default:
              actionDisplay = log.action;
          }
          
          // Get case number for moderation actions
          let moderationCaseType = null;
          switch (log.action) {
            case 'ban':
              moderationCaseType = 'Ban';
              break;
            case 'unban':
              moderationCaseType = 'Unban';
              break;
            case 'kick':
            case 'MemberKick':
            case 'memberKick':
              moderationCaseType = 'Kick';
              break;
            case 'timeout':
              moderationCaseType = 'Timeout';
              break;
            case 'warning':
              moderationCaseType = 'Warning';
              break;
            case 'warningRemoved':
              moderationCaseType = 'Warning Removal';  // This matches the moderation_cases table
              break;
          }
          
          // Get case number and format for ALL moderation actions
          if (moderationCaseType) {
            try {
              const caseStmt = db.prepare(`
                SELECT case_number FROM moderation_cases 
                WHERE guild_id = ? AND user_id = ? AND action_type = ? 
                ORDER BY created_at DESC LIMIT 1
              `);
              // For server_logs, user_id is the target user (the one who received the action)
              const caseResult = caseStmt.get(log.guild_id, log.target_id, moderationCaseType);
              const caseNumber = caseResult ? caseResult.case_number : null;
              const caseDisplay = caseNumber ? `Case #${String(caseNumber).padStart(4, '0')}` : 'Case #Unknown';
              
              // Format exactly like warnings for ALL moderation actions
              if (log.action === 'warningRemoved') {
                // Update the action title to include case number for consistency with warnings
                log.action = caseNumber ? `Warning Removed Case #${caseNumber}` : 'Warning Removed Case #Unknown';
                log.details = `${emoji} ${caseDisplay}: ${moderatorName} removed warning from ${userName} | Reason: ${log.reason || 'No reason provided'}`;
              } else {
                log.details = `${emoji} ${caseDisplay}: ${moderatorName} ${actionDisplay.toLowerCase()}ed ${userName} | Reason: ${log.reason || 'No reason provided'}`;
              }
            } catch (e) {
              log.details = `${emoji} ${actionDisplay} | Target: ${userName} | Moderator: ${moderatorName}`;
            }
          }
          // For verification logs, the user verified themselves
          else if (log.action === 'memberVerificationSuccess' || log.action === 'memberVerificationFailed') {
            log.details = `${emoji} ${actionDisplay} | User: ${userName}`;
          } else {
            log.details = `${emoji} ${actionDisplay} | Target: ${userName} | Moderator: ${moderatorName}`;
          }
          
          // Convert to Israeli time (+3 hours) and format as 24-hour
          const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
          const formattedTime = israeliTime.toLocaleString('he-IL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          log.created_at = formattedTime;
          
          simpleLogs.push(log);
        } catch (userError) {
          console.log('[DASHBOARD] Error processing moderation log:', userError);
          // Continue with other logs
        }
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Error querying moderation logs:', dbError);
    }

    // Sort all logs by date and limit results
    simpleLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    simpleLogs = simpleLogs.slice(0, 15); // Reduced to 15 for ultra-fast loading
    
    console.log('[DASHBOARD] Returning', simpleLogs.length, 'logs');
    res.json({
      success: true,
      data: simpleLogs
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting general logs:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

// All logs endpoint - comprehensive log view showing all activities
router.get('/all-logs', async (req, res) => {
  try {
    const { guild_id } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({ success: true, data: [] });
    }

    let allLogs = [];

    // 1. Get command logs
    try {
      let commandQuery = `
        SELECT 
          id,
          'command' as log_type,
          user_id,
          command as action,
          created_at,
          guild_id,
          success
        FROM command_logs
      `;
      
      const commandParams = [];
      if (guild_id) {
        commandQuery += ' WHERE guild_id = ?';
        commandParams.push(guild_id);
      }
      
      commandQuery += ' ORDER BY created_at DESC LIMIT 50';
      
      const commandLogs = db.prepare(commandQuery).all(...commandParams);
      
      for (const log of commandLogs) {
        log.userName = await getUserNameAsync(log.user_id);
        log.details = `🤖 Command: /${log.action} | User: ${log.userName} | ${log.success ? 'Success' : 'Failed'}`;
        
        // Convert to Israeli time (+3 hours) and format cleanly
        const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$1/$2/$3 at $4');
        log.created_at = formattedTime;
        
        allLogs.push(log);
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Error querying command logs:', dbError);
    }

    // 2. Get moderation logs from server_logs
    try {
      let modQuery = `
        SELECT 
          id,
          'moderation' as log_type,
          user_id as moderator_id,
          target_id as user_id,
          action_type as action,
          reason,
          details,
          created_at,
          guild_id
        FROM server_logs
        WHERE action_type IN ('memberBan', 'memberKick', 'memberTimeout', 'warningRemoved')
      `;
      
      const modParams = [];
      if (guild_id) {
        modQuery += ' AND guild_id = ?';
        modParams.push(guild_id);
      }
      
      modQuery += ' ORDER BY created_at DESC LIMIT 25';
      
      const modLogs = db.prepare(modQuery).all(...modParams);
      
      for (const log of modLogs) {
        // For moderation actions: user_id = moderator, target_id = target user
        // Note: SQL aliases are user_id as moderator_id, target_id as user_id
        let userName = await getUserNameAsync(log.user_id); // This is actually target_id after alias
        let moderatorName = await getUserNameAsync(log.moderator_id); // This is actually user_id after alias
        
        // Fallback: Extract usernames from details JSON if lookup failed
        if ((userName === 'Unknown User' || userName.startsWith('User_')) && log.details) {
          try {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            if (details.targetTag) {
              userName = details.targetTag;
            }
          } catch (e) {
            // Keep the fallback username
          }
        }
        
        if ((moderatorName === 'Unknown User' || moderatorName.startsWith('User_')) && log.details) {
          try {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            if (details.moderatorTag) {
              moderatorName = details.moderatorTag;
            }
          } catch (e) {
            // Keep the fallback username
          }
        }
        
        log.userName = userName;
        
        
        // Only show AutoMod for actual system actions, never for regular user IDs
        if (log.moderator_id === 'system' || 
            log.moderator_id === 'automod' ||
            (log.reason && (log.reason.toLowerCase().includes('automatic') || log.reason.toLowerCase().includes('automod')))) {
          moderatorName = 'AutoMod System';
        } else if (!moderatorName) {
          // If we can't get the moderator name, show the ID instead of defaulting to AutoMod
          moderatorName = `User (${log.moderator_id})`;
        }
        
        // Map action_type to display action
        switch(log.action) {
          case 'memberBan':
            log.action = 'Ban';
            break;
          case 'memberKick':
            log.action = 'Kick';
            break;
          case 'memberTimeout':
            log.action = 'Timeout';
            break;
          case 'warningRemoved':
            log.action = 'Warning Removed';
            break;
          default:
            // Keep the original action value
            break;
        }
        
        log.moderatorName = moderatorName;
        
        // Format action for display - use the updated log.action values
        let actionDisplay = log.action;
        let emoji = '⚖️';
        
        // Special formatting for ALL moderation actions with case numbers
        let actionEmoji = '⚖️';
        let moderationCaseType = '';
        
        switch(log.action) {
          case 'Ban':
            actionEmoji = '🔨';
            actionDisplay = 'Ban';
            emoji = '🔨';
            moderationCaseType = 'Ban';
            break;
          case 'Kick':
            actionEmoji = '👢';
            actionDisplay = 'Kick';
            emoji = '👢';
            moderationCaseType = 'Kick';
            break;
          case 'Timeout':
            actionEmoji = '⏰';
            actionDisplay = 'Timeout';
            emoji = '⏰';
            moderationCaseType = 'Timeout';
            break;
          case 'Warning Removed':
            actionEmoji = '🚫';
            actionDisplay = 'Warning Removed';
            emoji = '🚫';
            moderationCaseType = 'Warning Removal';
            break;
        }
        
        // Get case number for ALL moderation actions
        if (moderationCaseType) {
          try {
            const caseStmt = db.prepare(`
              SELECT case_number FROM moderation_cases 
              WHERE guild_id = ? AND user_id = ? AND action_type = ? 
              ORDER BY created_at DESC LIMIT 1
            `);
            const caseResult = caseStmt.get(log.guild_id, log.user_id, moderationCaseType);
            const caseNumber = caseResult ? caseResult.case_number : null;
            const caseDisplay = caseNumber ? `Case #${String(caseNumber).padStart(4, '0')}` : 'Case #Unknown';
            
            // Format exactly like warnings for ALL moderation actions
            if (log.action === 'Warning Removed') {
              // Update the action title to include case number for consistency with warnings
              log.action = caseNumber ? `Warning Removed Case #${caseNumber}` : 'Warning Removed Case #Unknown';
              log.details = `${actionEmoji} ${caseDisplay}: ${log.moderatorName} removed warning from ${log.userName} | Reason: ${log.reason || 'No reason provided'}`;
            } else {
              log.details = `${actionEmoji} ${caseDisplay}: ${log.moderatorName} ${actionDisplay.toLowerCase()}ed ${log.userName} | Reason: ${log.reason || 'No reason provided'}`;
            }
          } catch (e) {
            log.details = `${emoji} ${actionDisplay} | Target: ${log.userName} | Moderator: ${log.moderatorName}`;
          }
        }
        // For verification logs, the user verified themselves  
        else if (log.action === 'memberVerificationSuccess' || log.action === 'memberVerificationFailed') {
          log.details = `${emoji} ${actionDisplay} | User: ${log.userName}`;
        } else {
          log.details = `${emoji} ${actionDisplay} | Target: ${log.userName} | Moderator: ${log.moderatorName}`;
        }
        
        // Convert to Israeli time (+3 hours) and format cleanly
        const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$1/$2/$3 at $4');
        log.created_at = formattedTime;
        
        allLogs.push(log);
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Error querying moderation logs:', dbError);
    }

    // 3. Get warnings from warnings table
    try {
      let warningQuery = `
        SELECT 
          id,
          guild_id,
          user_id,
          moderator_id,
          'Warning' as action,
          reason,
          case_number,
          created_at,
          'moderation' as log_type
        FROM warnings
        WHERE active = 1
      `;
      
      const warningParams = [];
      if (guild_id) {
        warningQuery += ' AND guild_id = ?';
        warningParams.push(guild_id);
      }
      
      warningQuery += ' ORDER BY created_at DESC LIMIT 25';
      
      const warnings = db.prepare(warningQuery).all(...warningParams);
      
      // Process warnings instantly (no async calls)
      for (const warning of warnings) {
        warning.userName = await getUserNameAsync(warning.user_id);
        warning.moderatorName = await getUserNameAsync(warning.moderator_id);
        
        // Enhanced warning details with properly formatted case number - same style as other moderation actions
        const caseDisplay = warning.case_number ? `Case #${String(warning.case_number).padStart(4, '0')}` : 'Case #Unknown';
        warning.details = `⚠️ ${caseDisplay}: ${warning.moderatorName} warned ${warning.userName} | Reason: ${warning.reason || 'No reason provided'}`;
        
        // Convert to Israeli time (+3 hours) and format as 24-hour
        const israeliTime = new Date(new Date(warning.created_at).getTime() + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('he-IL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        warning.created_at = formattedTime;
        
        allLogs.push(warning);
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Error querying warnings:', dbError);
    }

    // 4. Get general server logs
    try {
      let serverLogQuery = `
        SELECT 
          id,
          'server' as log_type,
          user_id,
          action_type as action,
          details,
          guild_id,
          created_at
        FROM server_logs
        WHERE action_type != 'command_used'
      `;
      
      const serverLogParams = [];
      if (guild_id) {
        serverLogQuery += ' AND guild_id = ?';
        serverLogParams.push(guild_id);
      }
      
      serverLogQuery += ' ORDER BY created_at DESC LIMIT 25';
      
      const serverLogs = db.prepare(serverLogQuery).all(...serverLogParams);
      
      for (const log of serverLogs) {
        log.userName = await getUserNameAsync(log.user_id);
        
        // Special handling for verification logs
        if (log.action === 'memberVerificationSuccess' || log.action === 'memberVerificationFailed') {
          const isSuccess = log.action === 'memberVerificationSuccess';
          const emoji = isSuccess ? '✅' : '❌';
          const actionDisplay = isSuccess ? 'Verification Success' : 'Verification Failed';
          
          // Parse verification details if available
          let detailsText = `User: ${log.userName}`;
          if (log.details) {
            try {
              const parsed = JSON.parse(log.details);
              if (parsed.verification_type) {
                detailsText += ` | Type: ${parsed.verification_type.toUpperCase()}`;
              }
              if (parsed.reason && !isSuccess) {
                detailsText += ` | Reason: ${parsed.reason}`;
              }
              if (parsed.account_age_days !== undefined) {
                detailsText += ` | Account Age: ${parsed.account_age_days} days`;
              }
            } catch (e) {
              // Use basic details if parsing fails
            }
          }
          
          log.details = `${emoji} ${actionDisplay} | ${detailsText}`;
        } else {
          // Default handling for other server logs
          log.details = `📋 ${log.action} | User: ${log.userName} | ${log.details || 'No additional details'}`;
        }
        
        // Convert timestamp from milliseconds to ISO string
        const israeliTime = new Date(log.created_at + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('he-IL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        log.created_at = formattedTime;
        
        allLogs.push(log);
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Error querying server logs:', dbError);
    }

    // 5. Get DM logs
    try {
      let dmQuery = `
        SELECT 
          id,
          'dm' as log_type,
          sender_id as user_id,
          recipient_id,
          command,
          success,
          error,
          guild_id,
          created_at
        FROM dm_logs
      `;
      
      const dmParams = [];
      if (guild_id) {
        dmQuery += ' WHERE guild_id = ?';
        dmParams.push(guild_id);
      }
      
      dmQuery += ' ORDER BY created_at DESC LIMIT 15';
      
      const dmLogs = db.prepare(dmQuery).all(...dmParams);
      
      for (const log of dmLogs) {
        log.userName = await getUserNameAsync(log.user_id);
        const recipientName = await getUserNameAsync(log.recipient_id);
        
        log.details = `💬 DM ${log.success ? 'sent' : 'failed'} | From: ${log.userName} | To: ${recipientName} | Command: ${log.command || 'Manual'}${log.error ? ` | Error: ${log.error}` : ''}`;
        
        // Convert to Israeli time (+3 hours) and format cleanly
        const israeliTime = new Date(new Date(log.created_at).getTime() + (3 * 60 * 60 * 1000));
        const formattedTime = israeliTime.toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$1/$2/$3 at $4');
        log.created_at = formattedTime;
        
        allLogs.push(log);
      }
    } catch (dbError) {
      console.log('[DASHBOARD] Error querying DM logs:', dbError);
    }

    // Sort all logs by date and limit results
    allLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    allLogs = allLogs.slice(0, 100); // Show top 100 most recent logs
    
    res.json({
      success: true,
      data: allLogs
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting all logs:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

// Servers endpoint - show server configuration
router.get('/servers', async (req, res) => {
  try {
    const { guild_id } = req.query;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({ success: true, data: [] });
    }

    // Ultra-fast channel name resolution (sync only)
    const getChannelDisplayName = (channelId) => {
      if (!channelId) return null;
      
      try {
        const client = getClient();
        if (client && isClientReady()) {
          const channel = client.channels.cache.get(channelId);
          if (channel && channel.name) {
            return channel.name;
          }
        }
      } catch (e) {
        // Silent fail
      }
      
      return `Channel_${channelId.slice(-4)}`;
    };

    let query = `
      SELECT 
        guild_id,
        name as server_name,
        ticket_category_id,
        ticket_panel_channel_id,
        ticket_logs_channel_id,
        log_channel_id,
        mod_log_channel_id,
        member_log_channel_id,
        message_log_channel_id,
        welcome_channel_id,
        goodbye_channel_id,
        verification_channel_id,
        verified_role_id,
        verification_type,
        staff_role_ids,
        log_all_commands,
        auto_mod_enabled,
        created_at,
        updated_at
      FROM server_settings
    `;
    
    const params = [];
    
    if (guild_id) {
      query += ' WHERE guild_id = ?';
      params.push(guild_id);
    }
    
    query += ' ORDER BY updated_at DESC LIMIT 20';
    
    let servers = [];
    try {
      servers = db.prepare(query).all(...params);
      
      // Process servers with channel names and better formatting
      servers = servers.map(server => {
        // Resolve channel names
        const ticketCategory = getChannelDisplayName(server.ticket_category_id);
        const ticketPanel = getChannelDisplayName(server.ticket_panel_channel_id);
        const ticketLogs = getChannelDisplayName(server.ticket_logs_channel_id);
        const logChannel = getChannelDisplayName(server.log_channel_id);
        const modLogChannel = getChannelDisplayName(server.mod_log_channel_id);
        const welcomeChannel = getChannelDisplayName(server.welcome_channel_id);
        const verificationChannel = getChannelDisplayName(server.verification_channel_id);
        
        // Parse staff roles
        let staffRoles = [];
        try {
          if (server.staff_role_ids && typeof server.staff_role_ids === 'string') {
            staffRoles = JSON.parse(server.staff_role_ids);
          }
        } catch (e) {
          staffRoles = [];
        }
        
        // Convert times to Israeli timezone
        const israeliCreated = server.created_at ? 
          new Date(new Date(server.created_at).getTime() + (3 * 60 * 60 * 1000)).toISOString() : null;
        const israeliUpdated = server.updated_at ? 
          new Date(new Date(server.updated_at).getTime() + (3 * 60 * 60 * 1000)).toISOString() : null;
        
        return {
          ...server,
          // Channel names
          ticket_category_name: ticketCategory,
          ticket_panel_channel_name: ticketPanel,
          ticket_logs_channel_name: ticketLogs,
          log_channel_name: logChannel,
          mod_log_channel_name: modLogChannel,
          welcome_channel_name: welcomeChannel,
          verification_channel_name: verificationChannel,
          
          // Configuration status
          ticket_system_configured: !!(server.ticket_category_id && server.ticket_panel_channel_id),
          logging_configured: !!server.log_channel_id,
          moderation_configured: !!server.mod_log_channel_id,
          welcome_configured: !!server.welcome_channel_id,
          verification_configured: !!server.verification_channel_id,
          
          // Staff configuration
          staff_roles_count: staffRoles.length,
          staff_role_ids: staffRoles,
          
          // Settings status
          auto_mod_status: server.auto_mod_enabled ? 'Enabled' : 'Disabled',
          command_logging_status: server.log_all_commands ? 'Enabled' : 'Disabled',
          verification_type_display: server.verification_type || 'None',
          
          // Timestamps
          created_at: israeliCreated,
          updated_at: israeliUpdated,
          
          // Summary for dashboard
          configuration_summary: `Tickets: ${!!(server.ticket_category_id && server.ticket_panel_channel_id) ? '✅' : '❌'} | Logs: ${!!server.log_channel_id ? '✅' : '❌'} | Welcome: ${!!server.welcome_channel_id ? '✅' : '❌'} | Verification: ${!!server.verification_channel_id ? '✅' : '❌'}`
        };
      });
      
    } catch (dbError) {
      console.log('[DASHBOARD] Server settings table not found:', dbError.message);
      servers = [];
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    res.json({
      success: true,
      data: servers || []
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting servers:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Get server channels only
router.get('/servers/:serverId/channels', checkServerAccess(), async (req, res) => {
  try {
    const { serverId } = req.params;
    const { type = 'text' } = req.query;
    const client = getClient();
    
    if (!client || !isClientReady()) {
      return res.json({
        success: false,
        error: 'Discord client not ready',
        data: []
      });
    }
    
    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return res.json({
        success: false,
        error: 'Server not found',
        data: []
      });
    }
    
    let channels;
    
    if (type === 'text') {
      // Get text channels only
      channels = guild.channels.cache
        .filter(channel => channel.type === 0) // Text channels
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: 'text',
          position: channel.position
        }))
        .sort((a, b) => a.position - b.position);
    } else if (type === 'category') {
      // Get category channels only
      channels = guild.channels.cache
        .filter(channel => channel.type === 4) // Category channels
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: 'category',
          position: channel.position
        }))
        .sort((a, b) => a.position - b.position);
    } else {
      // Get all channels
      channels = guild.channels.cache
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type === 0 ? 'text' : channel.type === 2 ? 'voice' : channel.type === 4 ? 'category' : 'other',
          position: channel.position
        }))
        .sort((a, b) => a.position - b.position);
    }
    
    res.json({
      success: true,
      data: channels
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting server channels:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      data: []
    });
  }
});

// Get server channels and roles for verification configuration
router.get('/server/:guildId/channels-and-roles', async (req, res) => {
  try {
    const { guildId } = req.params;
    const client = getClient();
    
    if (!client || !isClientReady()) {
      return res.json({
        success: false,
        error: 'Discord client not ready'
      });
    }
    
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.json({
        success: false,
        error: 'Server not found'
      });
    }
    
    // Get text channels
    const channels = guild.channels.cache
      .filter(channel => channel.type === 0) // Text channels
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: 'text'
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Get roles (exclude @everyone and bot roles)
    const roles = guild.roles.cache
      .filter(role => !role.managed && role.name !== '@everyone')
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position
      }))
      .sort((a, b) => b.position - a.position);
    
    res.json({
      success: true,
      data: {
        channels,
        roles,
        guildName: guild.name
      }
    });
  } catch (error) {
    console.error('[DASHBOARD] Error getting channels and roles:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update verification settings
router.post('/server/:guildId/verification', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { 
      verification_channel_id,
      verified_role_id, 
      verification_type,
      enabled = true 
    } = req.body;
    
    console.log('[DASHBOARD] Updating verification settings for guild:', guildId);
    console.log('[DASHBOARD] Settings:', { verification_channel_id, verified_role_id, verification_type, enabled });
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Validate verification type
    const validTypes = ['button', 'captcha', 'custom_question', 'age_verification'];
    if (verification_type && !validTypes.includes(verification_type)) {
      return res.json({
        success: false,
        error: 'Invalid verification type'
      });
    }
    
    // Update server settings
    const updateStmt = db.prepare(`
      UPDATE server_settings 
      SET 
        verification_channel_id = ?,
        verified_role_id = ?,
        verification_type = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE guild_id = ?
    `);
    
    const result = updateStmt.run(
      verification_channel_id || null,
      verified_role_id || null,
      verification_type || 'button',
      guildId
    );
    
    if (result.changes === 0) {
      // Insert new record if update didn't affect any rows
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO server_settings (
          guild_id,
          verification_channel_id,
          verified_role_id,
          verification_type,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      insertStmt.run(
        guildId,
        verification_channel_id || null,
        verified_role_id || null,
        verification_type || 'button'
      );
    }
    
    console.log('[DASHBOARD] Verification settings updated successfully');
    
    res.json({
      success: true,
      message: 'Verification settings updated successfully'
    });
  } catch (error) {
    console.error('[DASHBOARD] Error updating verification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create verification message in channel
router.post('/server/:guildId/verification/create-message', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channel_id } = req.body;
    
    console.log('[DASHBOARD] Creating verification message for guild:', guildId, 'in channel:', channel_id);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get verification settings
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    // Import the verification handler to create the message
    const { createVerificationMessage } = await import('../handlers/verification/verification-handler.js');
    
    const messageId = await createVerificationMessage(channel_id, guildId, settings);
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to create verification message'
      });
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error creating verification message:', error);
    res.json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create custom verification message in channel
router.post('/server/:guildId/verification/create-custom-message', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channel_id, title, description, color, buttonText, fields } = req.body;
    
    console.log('[DASHBOARD] Creating custom verification message for guild:', guildId, 'in channel:', channel_id);
    console.log('[DASHBOARD] Verification fields received:', fields ? fields.length : 0, 'fields');
    console.log('[DASHBOARD] Button text:', buttonText || 'default');
    if (fields && fields.length > 0) {
      fields.forEach((field, index) => {
        console.log(`[DASHBOARD] Field ${index + 1}: "${field.name}" = "${field.value}"`);
      });
    }
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get verification settings
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    // Create custom message data
    const customMessage = {
      title: title || '🔒 Server Verification',
      description: description || 'Welcome! Please verify your account to gain access to this server.',
      color: color || '#3B82F6',
      buttonText: buttonText || 'Verify',
      fields: fields || [
        { name: '🔹 Why Verification?', value: 'Verification helps maintain a safe and secure community.' },
        { name: '🔹 How to Verify', value: 'Click the button below to start the verification process.' }
      ]
    };
    
    console.log('[DASHBOARD] Custom verification message data:', customMessage);
    
    // Import the verification handler to create the custom message
    const { createCustomVerificationMessage } = await import('../handlers/verification/verification-handler.js');
    
    const messageId = await createCustomVerificationMessage(channel_id, guildId, settings, customMessage);
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to create custom verification message'
      });
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error creating custom verification message:', error);
    res.json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create ticket panel message in channel
router.post('/server/:guildId/tickets/create-panel', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channel_id } = req.body;
    
    console.log('[DASHBOARD] Creating ticket panel message for guild:', guildId, 'in channel:', channel_id);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    // Import the ticket handler to create the message
    const { createTicketPanelMessage } = await import('../handlers/tickets/ticket-handler.js');
    
    const messageId = await createTicketPanelMessage(channel_id, guildId, settings);
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to create ticket panel message'
      });
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error creating ticket panel message:', error);
    res.json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create custom ticket panel message in channel
router.post('/server/:guildId/tickets/create-custom-panel', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channel_id, title, description, color, footer, buttonText, fields } = req.body;
    
    console.log('[DASHBOARD] Creating custom ticket panel message for guild:', guildId, 'in channel:', channel_id);
    console.log('[DASHBOARD] Ticket fields received:', fields ? fields.length : 0, 'fields');
    console.log('[DASHBOARD] Button text:', buttonText || 'default');
    if (fields && fields.length > 0) {
      fields.forEach((field, index) => {
        console.log(`[DASHBOARD] Field ${index + 1}: "${field.name}" = "${field.value}"`);
      });
    }
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    // Create custom message data
    const customMessage = {
      title: title || '🎫 Support Tickets',
      description: description || 'Need help? Have a question? Want to report something? Create a ticket and our staff team will assist you as soon as possible.',
      color: color || '#3B82F6',
      footer: footer || 'Made by Soggra • Support Ticket System',
      buttonText: buttonText || 'Create Ticket',
      fields: fields || [
        { name: '🔹 How to Create a Ticket', value: 'Click the button below to create a new support ticket.' },
        { name: '🔹 Response Time', value: 'Our staff team typically responds within a few hours.' },
        { name: '🔹 Categories Available', value: 'Select the category that best matches your request when creating a ticket.' }
      ]
    };
    
    console.log('[DASHBOARD] Custom ticket panel message data:', customMessage);
    
    // Import the ticket handler to create the custom message
    const { createCustomTicketPanelMessage } = await import('../handlers/tickets/ticket-handler.js');
    
    const messageId = await createCustomTicketPanelMessage(channel_id, guildId, settings, customMessage);
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to create custom ticket panel message'
      });
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error creating custom ticket panel message:', error);
    res.json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Save verification message configuration
router.post('/server/:guildId/verification/save-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { title, description, color, buttonText, fields } = req.body;
    
    console.log('[DASHBOARD] Saving verification message config for guild:', guildId);
    console.log('[DASHBOARD] Request body:', { title, description, color, buttonText, fields });
    
    if (!db || typeof db.prepare !== 'function') {
      console.log('[DASHBOARD] Database not available');
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    const verificationConfig = {
      title: title || '🔒 Server Verification',
      description: description || 'Welcome! Please verify your account to gain access to this server.',
      color: color || '#3B82F6',
      buttonText: buttonText || 'Verify',
      fields: fields || [
        { name: '🔹 Why Verification?', value: 'Verification helps maintain a safe and secure community.' },
        { name: '🔹 How to Verify', value: 'Click the button below to start the verification process.' }
      ]
    };
    
    console.log('[DASHBOARD] Final config to save:', verificationConfig);
    
    // First, make sure the server exists in server_settings
    const checkStmt = db.prepare('SELECT guild_id FROM server_settings WHERE guild_id = ?');
    const existingServer = checkStmt.get(guildId);
    
    if (!existingServer) {
      console.log('[DASHBOARD] Server not found, creating entry for guild:', guildId);
      const insertStmt = db.prepare(`
        INSERT INTO server_settings (guild_id, verification_message_config, created_at, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      insertStmt.run(guildId, JSON.stringify(verificationConfig));
    } else {
      console.log('[DASHBOARD] Updating existing server configuration');
      const updateStmt = db.prepare(`
        UPDATE server_settings 
        SET verification_message_config = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE guild_id = ?
      `);
      updateStmt.run(JSON.stringify(verificationConfig), guildId);
    }
    
    // Verify the save was successful
    const verifyStmt = db.prepare('SELECT verification_message_config FROM server_settings WHERE guild_id = ?');
    const savedConfig = verifyStmt.get(guildId);
    console.log('[DASHBOARD] Verification of saved config:', savedConfig);
    
    res.json({
      success: true,
      data: { 
        message: 'Verification message configuration saved successfully',
        config: verificationConfig
      }
    });
    
  } catch (error) {
    console.error('[DASHBOARD] Error saving verification message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Get verification message configuration
router.get('/server/:guildId/verification/config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    console.log('[DASHBOARD] Getting verification message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      console.log('[DASHBOARD] Database not available');
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    const settings = db.prepare('SELECT verification_message_config FROM server_settings WHERE guild_id = ?').get(guildId);
    
    console.log('[DASHBOARD] Raw settings from DB:', settings);
    
    if (settings?.verification_message_config) {
      const config = JSON.parse(settings.verification_message_config);
      console.log('[DASHBOARD] Parsed config:', config);
      res.json({
        success: true,
        data: config
      });
    } else {
      console.log('[DASHBOARD] No saved config found, returning defaults');
      // Return default configuration
      const defaultConfig = {
        title: '🔒 Server Verification',
        description: 'Welcome! Please verify your account to gain access to this server.',
        color: '#3B82F6',
        buttonText: 'Verify',
        fields: [
          { name: '🔹 Why Verification?', value: 'Verification helps maintain a safe and secure community.' },
          { name: '🔹 How to Verify', value: 'Click the button below to start the verification process.' }
        ]
      };
      res.json({
        success: true,
        data: defaultConfig
      });
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error getting verification message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Reset verification message configuration
router.post('/server/:guildId/verification/reset-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    const stmt = db.prepare(`
      UPDATE server_settings 
      SET verification_message_config = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ?
    `);
    
    const result = stmt.run(guildId);
    
    res.json({
      success: true,
      data: { message: 'Verification message configuration reset to defaults' }
    });
    
  } catch (error) {
    console.error('[DASHBOARD] Error resetting verification message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Test verification message
router.post('/server/:guildId/verification/test-message', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { title, description, color, buttonText, fields } = req.body;
    
    console.log('[DASHBOARD] Testing verification message for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings to find a test channel
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings || !settings.verification_channel_id) {
      return res.json({
        success: false,
        error: 'Verification channel not configured'
      });
    }
    
    const customMessage = {
      title: title || '🔒 Server Verification',
      description: description || 'Welcome! Please verify your account to gain access to this server.',
      color: color || '#3B82F6',
      buttonText: buttonText || 'Verify',
      fields: fields || []
    };
    
    const { createCustomVerificationMessage } = await import('../handlers/verification/verification-handler.js');
    const messageId = await createCustomVerificationMessage(settings.verification_channel_id, guildId, settings, customMessage);
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to send test verification message'
      });
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error testing verification message:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Save ticket panel configuration
router.post('/server/:guildId/tickets/save-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { title, description, color, footer, buttonText, fields } = req.body;
    
    console.log('[DASHBOARD] Saving ticket panel config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    const ticketConfig = {
      title: title || '🎫 Support Tickets',
      description: description || 'Need help? Have a question? Want to report something? Create a ticket and our staff team will assist you as soon as possible.',
      color: color || '#3B82F6',
      footer: footer || 'Made by Soggra • Support Ticket System',
      buttonText: buttonText || 'Create Ticket',
      fields: fields || [
        { name: '🔹 How to Create a Ticket', value: 'Click the button below to create a new support ticket.' },
        { name: '🔹 Response Time', value: 'Our staff team typically responds within a few hours.' },
        { name: '🔹 Categories Available', value: 'Select the category that best matches your request when creating a ticket.' }
      ]
    };
    
    const stmt = db.prepare(`
      UPDATE server_settings 
      SET ticket_panel_config = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ?
    `);
    
    const result = stmt.run(JSON.stringify(ticketConfig), guildId);
    
    res.json({
      success: true,
      data: { message: 'Ticket panel configuration saved successfully' }
    });
    
  } catch (error) {
    console.error('[DASHBOARD] Error saving ticket panel config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Get ticket panel configuration
router.get('/server/:guildId/tickets/config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    const settings = db.prepare('SELECT ticket_panel_config FROM server_settings WHERE guild_id = ?').get(guildId);
    
    if (settings?.ticket_panel_config) {
      const config = JSON.parse(settings.ticket_panel_config);
      res.json({
        success: true,
        data: config
      });
    } else {
      // Return default configuration
      res.json({
        success: true,
        data: {
          title: '🎫 Support Tickets',
          description: 'Need help? Have a question? Want to report something? Create a ticket and our staff team will assist you as soon as possible.',
          color: '#3B82F6',
          footer: 'Made by Soggra • Support Ticket System',
          buttonText: 'Create Ticket',
          fields: [
            { name: '🔹 How to Create a Ticket', value: 'Click the button below to create a new support ticket.' },
            { name: '🔹 Response Time', value: 'Our staff team typically responds within a few hours.' },
            { name: '🔹 Categories Available', value: 'Select the category that best matches your request when creating a ticket.' }
          ]
        }
      });
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error getting ticket panel config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Reset ticket panel configuration
router.post('/server/:guildId/tickets/reset-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    const stmt = db.prepare(`
      UPDATE server_settings 
      SET ticket_panel_config = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ?
    `);
    
    const result = stmt.run(guildId);
    
    res.json({
      success: true,
      data: { message: 'Ticket panel configuration reset to defaults' }
    });
    
  } catch (error) {
    console.error('[DASHBOARD] Error resetting ticket panel config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Test ticket panel message
router.post('/server/:guildId/tickets/test-panel', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { title, description, color, footer, buttonText, fields } = req.body;
    
    console.log('[DASHBOARD] Testing ticket panel message for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings to find a test channel
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings || !settings.ticket_channel_id) {
      return res.json({
        success: false,
        error: 'Ticket channel not configured'
      });
    }
    
    const customMessage = {
      title: title || '🎫 Support Tickets',
      description: description || 'Need help? Have a question? Want to report something? Create a ticket and our staff team will assist you as soon as possible.',
      color: color || '#3B82F6',
      footer: footer || 'Made by Soggra • Support Ticket System',
      buttonText: buttonText || 'Create Ticket',
      fields: fields || []
    };
    
    const { createCustomTicketPanelMessage } = await import('../handlers/tickets/ticket-handler.js');
    const messageId = await createCustomTicketPanelMessage(settings.ticket_channel_id, guildId, settings, customMessage);
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to send test ticket panel message'
      });
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error testing ticket panel message:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Create custom welcome message in channel
router.post('/server/:guildId/member-events/create-welcome-message', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channel_id, title, description, color, fields } = req.body;
    
    console.log('[DASHBOARD] Creating custom welcome message for guild:', guildId, 'in channel:', channel_id);
    console.log('[DASHBOARD] Welcome fields received:', fields ? fields.length : 0, 'fields');
    if (fields && fields.length > 0) {
      fields.forEach((field, index) => {
        console.log(`[DASHBOARD] Field ${index + 1}: "${field.name}" = "${field.value}"`);
      });
    }
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    const { createCustomWelcomeMessage } = require('../handlers/members/member-events');
    const messageId = await createCustomWelcomeMessage(
      channel_id, 
      guildId, 
      settings, 
      { title, description, color, fields }
    );
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to create welcome message'
      });
    }
  } catch (error) {
    console.error('[DASHBOARD] Error creating welcome message:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Create custom leave message in channel
router.post('/server/:guildId/member-events/create-leave-message', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channel_id, title, description, color, fields } = req.body;
    
    console.log('[DASHBOARD] Creating custom leave message for guild:', guildId, 'in channel:', channel_id);
    console.log('[DASHBOARD] Leave fields received:', fields ? fields.length : 0, 'fields');
    if (fields && fields.length > 0) {
      fields.forEach((field, index) => {
        console.log(`[DASHBOARD] Field ${index + 1}: "${field.name}" = "${field.value}"`);
      });
    }
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    const { createCustomLeaveMessage } = require('../handlers/members/member-events');
    const messageId = await createCustomLeaveMessage(
      channel_id, 
      guildId, 
      settings, 
      { title, description, color, fields }
    );
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to create leave message'
      });
    }
  } catch (error) {
    console.error('[DASHBOARD] Error creating leave message:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Save custom welcome message configuration
router.post('/server/:guildId/member-events/save-welcome-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { title, description, color, fields } = req.body;
    
    console.log('[DASHBOARD] Saving custom welcome message config for guild:', guildId);
    console.log('[DASHBOARD] Welcome config fields received:', fields ? fields.length : 0, 'fields');
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Create the configuration object
    const welcomeConfig = {
      title: title || '👋 Welcome to {server}!',
      description: description || 'Welcome {user}! We\'re excited to have you in our community. We hope you enjoy your stay!',
      color: color || '#43b581',
      fields: fields || [
        { name: '🔹 Server Rules', value: 'Please read our rules to get started.' },
        { name: '🔹 Get Roles', value: 'Visit our roles channel to get your roles.' },
        { name: '🔹 Member Count', value: 'You are member #{memberCount}!' }
      ]
    };
    
    // Check if server_settings exists for this guild
    const existingSettings = db.prepare('SELECT guild_id FROM server_settings WHERE guild_id = ?').get(guildId);
    console.log('[DASHBOARD] Existing server settings for guild:', guildId, ':', existingSettings ? 'EXISTS' : 'NOT FOUND');
    
    if (existingSettings) {
      // Update existing settings
      console.log('[DASHBOARD] Updating existing welcome config for guild:', guildId);
      console.log('[DASHBOARD] Welcome config data:', JSON.stringify(welcomeConfig, null, 2));
      
      const updateStmt = db.prepare(`
        UPDATE server_settings 
        SET welcome_message_config = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE guild_id = ?
      `);
      
      const result = updateStmt.run(JSON.stringify(welcomeConfig), guildId);
      console.log('[DASHBOARD] Welcome config update result:', result);
      
      // Verify the save by reading it back
      const verifyStmt = db.prepare('SELECT welcome_message_config FROM server_settings WHERE guild_id = ?');
      const verifyResult = verifyStmt.get(guildId);
      console.log('[DASHBOARD] Verification - saved welcome config:', verifyResult?.welcome_message_config);
      
      res.json({
        success: true,
        data: { message: 'Welcome message configuration saved successfully' }
      });
    } else {
      // Create new settings entry
      console.log('[DASHBOARD] Creating new server settings with welcome config for guild:', guildId);
      const insertStmt = db.prepare(`
        INSERT INTO server_settings (guild_id, name, welcome_message_config, created_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      try {
        insertStmt.run(guildId, 'Unknown Server', JSON.stringify(welcomeConfig));
        console.log('[DASHBOARD] Successfully inserted welcome message config for new guild:', guildId);
        res.json({
          success: true,
          data: { message: 'Welcome message configuration saved successfully' }
        });
      } catch (insertError) {
        console.error('[DASHBOARD] Error inserting welcome config:', insertError);
        res.json({
          success: false,
          error: 'Failed to save welcome message configuration'
        });
      }
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error saving welcome message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Reset welcome message configuration to defaults
router.post('/server/:guildId/member-events/reset-welcome-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    console.log('[DASHBOARD] Resetting welcome message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Clear the welcome message configuration
    const stmt = db.prepare(`
      UPDATE server_settings 
      SET welcome_message_config = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ?
    `);
    
    const result = stmt.run(guildId);
    
    console.log('[DASHBOARD] Reset welcome message config - affected rows:', result.changes);
    
    res.json({
      success: true,
      data: { message: 'Welcome message configuration reset to defaults' }
    });
    
  } catch (error) {
    console.error('[DASHBOARD] Error resetting welcome message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Save goodbye message configuration
router.post('/server/:guildId/member-events/save-goodbye-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    const goodbyeConfig = req.body;
    
    console.log('[DASHBOARD] Saving goodbye message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Check if server_settings exists for this guild
    const existingSettings = db.prepare('SELECT guild_id FROM server_settings WHERE guild_id = ?').get(guildId);
    
    if (existingSettings) {
      // Update existing settings
      const updateStmt = db.prepare(`
        UPDATE server_settings 
        SET goodbye_message_config = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE guild_id = ?
      `);
      
      try {
        console.log('[DASHBOARD] Saving goodbye config to database:', JSON.stringify(goodbyeConfig, null, 2));
        const result = updateStmt.run(JSON.stringify(goodbyeConfig), guildId);
        console.log('[DASHBOARD] Goodbye config save result:', result);
        
        // Verify the save by reading it back
        const verifyStmt = db.prepare('SELECT goodbye_message_config FROM server_settings WHERE guild_id = ?');
        const verifyResult = verifyStmt.get(guildId);
        console.log('[DASHBOARD] Verification - saved goodbye config:', verifyResult?.goodbye_message_config);
        
        console.log('[DASHBOARD] Successfully updated goodbye message config for guild:', guildId);
        res.json({
          success: true,
          data: { message: 'Goodbye message configuration saved successfully' }
        });
      } catch (updateError) {
        console.error('[DASHBOARD] Error updating goodbye config:', updateError);
        res.json({
          success: false,
          error: 'Failed to save goodbye message configuration'
        });
      }
    } else {
      // Create new settings entry
      const insertStmt = db.prepare(`
        INSERT INTO server_settings (guild_id, goodbye_message_config, created_at, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      try {
        insertStmt.run(guildId, JSON.stringify(goodbyeConfig));
        console.log('[DASHBOARD] Successfully inserted goodbye message config for new guild:', guildId);
        res.json({
          success: true,
          data: { message: 'Goodbye message configuration saved successfully' }
        });
      } catch (insertError) {
        console.error('[DASHBOARD] Error inserting goodbye config:', insertError);
        res.json({
          success: false,
          error: 'Failed to save goodbye message configuration'
        });
      }
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error saving goodbye message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Get goodbye message configuration
router.get('/server/:guildId/member-events/goodbye-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    console.log('[DASHBOARD] Getting goodbye message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings
    const settings = db.prepare('SELECT goodbye_message_config FROM server_settings WHERE guild_id = ?').get(guildId);
    
    console.log('[DASHBOARD] Goodbye config query result:', settings);
    
    if (!settings || !settings.goodbye_message_config) {
      console.log('[DASHBOARD] No goodbye config found, returning defaults');
      // Return default configuration
      const defaultConfig = {
        title: '👋 Goodbye {username}!',
        description: '{user} has left {server}. We\'ll miss you!',
        color: '#f04747',
        fields: [
          { name: '📊 Member Count', value: 'We now have {memberCount} members.' },
          { name: '🕐 Joined On', value: 'They were with us since {joinedDate}.' }
        ]
      };
      
      res.json({
        success: true,
        data: defaultConfig
      });
    } else {
      try {
        const config = JSON.parse(settings.goodbye_message_config);
        res.json({
          success: true,
          data: config
        });
      } catch (parseError) {
        console.error('[DASHBOARD] Error parsing goodbye message config:', parseError);
        res.json({
          success: false,
          error: 'Invalid configuration data'
        });
      }
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error getting goodbye message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Reset goodbye message configuration to defaults
router.post('/server/:guildId/member-events/reset-goodbye-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    console.log('[DASHBOARD] Resetting goodbye message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Clear the goodbye message configuration
    const stmt = db.prepare(`
      UPDATE server_settings 
      SET goodbye_message_config = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ?
    `);
    
    const result = stmt.run(guildId);
    
    console.log('[DASHBOARD] Reset goodbye message config - affected rows:', result.changes);
    
    res.json({
      success: true,
      data: { message: 'Goodbye message configuration reset to defaults' }
    });
    
  } catch (error) {
    console.error('[DASHBOARD] Error resetting goodbye message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Save invite join message configuration
router.post('/server/:guildId/invite-tracker/save-join-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    const joinConfig = req.body;
    
    console.log('[DASHBOARD] Saving invite join message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Check if server_settings exists for this guild
    const existingSettings = db.prepare('SELECT guild_id FROM server_settings WHERE guild_id = ?').get(guildId);
    
    if (existingSettings) {
      // Update existing settings
      const updateStmt = db.prepare(`
        UPDATE server_settings 
        SET invite_join_message_config = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE guild_id = ?
      `);
      
      try {
        updateStmt.run(JSON.stringify(joinConfig), guildId);
        console.log('[DASHBOARD] Successfully updated invite join message config for guild:', guildId);
        res.json({
          success: true,
          data: { message: 'Invite join message configuration saved successfully' }
        });
      } catch (updateError) {
        console.error('[DASHBOARD] Error updating invite join config:', updateError);
        res.json({
          success: false,
          error: 'Failed to save invite join message configuration'
        });
      }
    } else {
      // Create new settings entry
      const insertStmt = db.prepare(`
        INSERT INTO server_settings (guild_id, invite_join_message_config, created_at, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      try {
        insertStmt.run(guildId, JSON.stringify(joinConfig));
        console.log('[DASHBOARD] Successfully inserted invite join message config for new guild:', guildId);
        res.json({
          success: true,
          data: { message: 'Invite join message configuration saved successfully' }
        });
      } catch (insertError) {
        console.error('[DASHBOARD] Error inserting invite join config:', insertError);
        res.json({
          success: false,
          error: 'Failed to save invite join message configuration'
        });
      }
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error saving invite join message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Get invite join message configuration
router.get('/server/:guildId/invite-tracker/join-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    console.log('[DASHBOARD] Getting invite join message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings
    const settings = db.prepare('SELECT invite_join_message_config FROM server_settings WHERE guild_id = ?').get(guildId);
    
    if (!settings || !settings.invite_join_message_config) {
      // Return default configuration
      const defaultConfig = {
        title: '🎯 {username} joined via invite!',
        description: 'Welcome {user}! You were invited by {inviter}.',
        color: '#5865f2',
        fields: [
          { name: '📨 Invited By', value: '{inviter}' },
          { name: '🔗 Invite Code', value: '{inviteCode}' },
          { name: '📊 Invite Uses', value: '{inviteUses} total uses' }
        ]
      };
      
      res.json({
        success: true,
        data: defaultConfig
      });
    } else {
      try {
        const config = JSON.parse(settings.invite_join_message_config);
        res.json({
          success: true,
          data: config
        });
      } catch (parseError) {
        console.error('[DASHBOARD] Error parsing invite join message config:', parseError);
        res.json({
          success: false,
          error: 'Invalid configuration data'
        });
      }
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error getting invite join message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Save invite leave message configuration
router.post('/server/:guildId/invite-tracker/save-leave-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    const leaveConfig = req.body;
    
    console.log('[DASHBOARD] Saving invite leave message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Check if server_settings exists for this guild
    const existingSettings = db.prepare('SELECT guild_id FROM server_settings WHERE guild_id = ?').get(guildId);
    
    if (existingSettings) {
      // Update existing settings
      const updateStmt = db.prepare(`
        UPDATE server_settings 
        SET invite_leave_message_config = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE guild_id = ?
      `);
      
      try {
        updateStmt.run(JSON.stringify(leaveConfig), guildId);
        console.log('[DASHBOARD] Successfully updated invite leave message config for guild:', guildId);
        res.json({
          success: true,
          data: { message: 'Invite leave message configuration saved successfully' }
        });
      } catch (updateError) {
        console.error('[DASHBOARD] Error updating invite leave config:', updateError);
        res.json({
          success: false,
          error: 'Failed to save invite leave message configuration'
        });
      }
    } else {
      // Create new settings entry
      const insertStmt = db.prepare(`
        INSERT INTO server_settings (guild_id, invite_leave_message_config, created_at, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      
      try {
        insertStmt.run(guildId, JSON.stringify(leaveConfig));
        console.log('[DASHBOARD] Successfully inserted invite leave message config for new guild:', guildId);
        res.json({
          success: true,
          data: { message: 'Invite leave message configuration saved successfully' }
        });
      } catch (insertError) {
        console.error('[DASHBOARD] Error inserting invite leave config:', insertError);
        res.json({
          success: false,
          error: 'Failed to save invite leave message configuration'
        });
      }
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error saving invite leave message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Get invite leave message configuration
router.get('/server/:guildId/invite-tracker/leave-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    console.log('[DASHBOARD] Getting invite leave message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings
    const settings = db.prepare('SELECT invite_leave_message_config FROM server_settings WHERE guild_id = ?').get(guildId);
    
    if (!settings || !settings.invite_leave_message_config) {
      // Return default configuration
      const defaultConfig = {
        title: '👋 {username} left the server',
        description: '{user} has left {server}. They originally joined via {inviter}\'s invite.',
        color: '#f04747',
        fields: [
          { name: '📨 Originally Invited By', value: '{inviter}' },
          { name: '🔗 Invite Code Used', value: '{inviteCode}' },
          { name: '📊 Member Count', value: 'We now have {memberCount} members' }
        ]
      };
      
      res.json({
        success: true,
        data: defaultConfig
      });
    } else {
      try {
        const config = JSON.parse(settings.invite_leave_message_config);
        res.json({
          success: true,
          data: config
        });
      } catch (parseError) {
        console.error('[DASHBOARD] Error parsing invite leave message config:', parseError);
        res.json({
          success: false,
          error: 'Invalid configuration data'
        });
      }
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error getting invite leave message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Reset invite join message configuration to defaults
router.post('/server/:guildId/invite-tracker/reset-join-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    console.log('[DASHBOARD] Resetting invite join message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Clear the invite join message configuration
    const stmt = db.prepare(`
      UPDATE server_settings 
      SET invite_join_message_config = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ?
    `);
    
    const result = stmt.run(guildId);
    
    console.log('[DASHBOARD] Reset invite join message config - affected rows:', result.changes);
    
    res.json({
      success: true,
      data: { message: 'Invite join message configuration reset to defaults' }
    });
    
  } catch (error) {
    console.error('[DASHBOARD] Error resetting invite join message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Reset invite leave message configuration to defaults
router.post('/server/:guildId/invite-tracker/reset-leave-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    console.log('[DASHBOARD] Resetting invite leave message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Clear the invite leave message configuration
    const stmt = db.prepare(`
      UPDATE server_settings 
      SET invite_leave_message_config = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE guild_id = ?
    `);
    
    const result = stmt.run(guildId);
    
    console.log('[DASHBOARD] Reset invite leave message config - affected rows:', result.changes);
    
    res.json({
      success: true,
      data: { message: 'Invite leave message configuration reset to defaults' }
    });
    
  } catch (error) {
    console.error('[DASHBOARD] Error resetting invite leave message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Get custom welcome message configuration
router.get('/server/:guildId/member-events/welcome-config', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    console.log('[DASHBOARD] Getting welcome message config for guild:', guildId);
    
    if (!db || typeof db.prepare !== 'function') {
      console.error('[DASHBOARD] Database not available for welcome config');
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings
    const settings = db.prepare('SELECT welcome_message_config FROM server_settings WHERE guild_id = ?').get(guildId);
    
    console.log('[DASHBOARD] Welcome config query result:', settings);
    
    if (!settings || !settings.welcome_message_config) {
      console.log('[DASHBOARD] No welcome config found, returning defaults');
      // Return default configuration
      const defaultConfig = {
        title: '👋 Welcome to {server}!',
        description: 'Welcome {user}! We\'re excited to have you in our community. We hope you enjoy your stay!',
        color: '#43b581',
        fields: [
          { name: '🔹 Server Rules', value: 'Please read our rules to get started.' },
          { name: '🔹 Get Roles', value: 'Visit our roles channel to get your roles.' },
          { name: '🔹 Member Count', value: 'You are member #{memberCount}!' }
        ]
      };
      
      res.json({
        success: true,
        data: defaultConfig
      });
    } else {
      try {
        console.log('[DASHBOARD] Parsing welcome config JSON:', settings.welcome_message_config);
        const welcomeConfig = JSON.parse(settings.welcome_message_config);
        console.log('[DASHBOARD] Successfully parsed welcome config:', welcomeConfig);
        res.json({
          success: true,
          data: welcomeConfig
        });
      } catch (parseError) {
        console.error('[DASHBOARD] Error parsing welcome config JSON:', parseError);
        console.error('[DASHBOARD] Raw welcome config data:', settings.welcome_message_config);
        res.json({
          success: false,
          error: 'Invalid welcome configuration data'
        });
      }
    }
    
  } catch (error) {
    console.error('[DASHBOARD] Error getting welcome message config:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Test welcome message
router.post('/server/:guildId/member-events/test-welcome-message', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { title, description, color, fields } = req.body;
    
    console.log('[DASHBOARD] Testing custom welcome message for guild:', guildId);
    console.log('[DASHBOARD] Test welcome fields received:', fields ? fields.length : 0, 'fields');
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings to find welcome channel
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    if (!settings.welcome_channel_id) {
      return res.json({
        success: false,
        error: 'Welcome channel not configured. Please set up a welcome channel first.'
      });
    }
    
    const { createCustomWelcomeMessage } = require('../handlers/members/member-events');
    const messageId = await createCustomWelcomeMessage(
      settings.welcome_channel_id, 
      guildId, 
      settings, 
      { title, description, color, fields }
    );
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to send test welcome message'
      });
    }
  } catch (error) {
    console.error('[DASHBOARD] Error testing welcome message:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Test goodbye message
router.post('/server/:guildId/member-events/test-goodbye-message', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { title, description, color, fields } = req.body;
    
    console.log('[DASHBOARD] Testing custom goodbye message for guild:', guildId);
    console.log('[DASHBOARD] Test goodbye fields received:', fields ? fields.length : 0, 'fields');
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings to find goodbye channel
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    if (!settings.goodbye_channel_id) {
      return res.json({
        success: false,
        error: 'Goodbye channel not configured. Please set up a goodbye channel first.'
      });
    }
    
    const { createCustomLeaveMessage } = require('../handlers/members/member-events');
    const messageId = await createCustomLeaveMessage(
      settings.goodbye_channel_id, 
      guildId, 
      settings, 
      { title, description, color, fields }
    );
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to send test goodbye message'
      });
    }
  } catch (error) {
    console.error('[DASHBOARD] Error testing goodbye message:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Create custom invite join tracking message in channel
router.post('/server/:guildId/invite-tracker/create-join-message', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channel_id, title, description, color, fields } = req.body;
    
    console.log('[DASHBOARD] Creating custom invite join message for guild:', guildId, 'in channel:', channel_id);
    console.log('[DASHBOARD] Invite join fields received:', fields ? fields.length : 0, 'fields');
    if (fields && fields.length > 0) {
      fields.forEach((field, index) => {
        console.log(`[DASHBOARD] Field ${index + 1}: "${field.name}" = "${field.value}"`);
      });
    }
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    const { createCustomInviteJoinMessage } = require('../handlers/invites/invite-tracker');
    const messageId = await createCustomInviteJoinMessage(
      channel_id, 
      guildId, 
      settings, 
      { title, description, color, fields }
    );
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to create invite join message'
      });
    }
  } catch (error) {
    console.error('[DASHBOARD] Error creating invite join message:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Create custom invite leave tracking message in channel
router.post('/server/:guildId/invite-tracker/create-leave-message', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channel_id, title, description, color, fields } = req.body;
    
    console.log('[DASHBOARD] Creating custom invite leave message for guild:', guildId, 'in channel:', channel_id);
    console.log('[DASHBOARD] Invite leave fields received:', fields ? fields.length : 0, 'fields');
    if (fields && fields.length > 0) {
      fields.forEach((field, index) => {
        console.log(`[DASHBOARD] Field ${index + 1}: "${field.name}" = "${field.value}"`);
      });
    }
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    const { createCustomInviteLeaveMessage } = require('../handlers/invites/invite-tracker');
    const messageId = await createCustomInviteLeaveMessage(
      channel_id, 
      guildId, 
      settings, 
      { title, description, color, fields }
    );
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to create invite leave message'
      });
    }
  } catch (error) {
    console.error('[DASHBOARD] Error creating invite leave message:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Test invite join tracking message
router.post('/server/:guildId/invite-tracker/test-join-message', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { title, description, color, fields } = req.body;
    
    console.log('[DASHBOARD] Testing custom invite join message for guild:', guildId);
    console.log('[DASHBOARD] Test invite join fields received:', fields ? fields.length : 0, 'fields');
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings to find member logs channel
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    if (!settings.member_log_channel_id) {
      return res.json({
        success: false,
        error: 'Member logs channel not configured. Please set up a member logs channel first.'
      });
    }
    
    const { createCustomInviteJoinMessage } = require('../handlers/invites/invite-tracker');
    const messageId = await createCustomInviteJoinMessage(
      settings.member_log_channel_id, 
      guildId, 
      settings, 
      { title, description, color, fields }
    );
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to send test invite join message'
      });
    }
  } catch (error) {
    console.error('[DASHBOARD] Error testing invite join message:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Test invite leave tracking message
router.post('/server/:guildId/invite-tracker/test-leave-message', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { title, description, color, fields } = req.body;
    
    console.log('[DASHBOARD] Testing custom invite leave message for guild:', guildId);
    console.log('[DASHBOARD] Test invite leave fields received:', fields ? fields.length : 0, 'fields');
    
    if (!db || typeof db.prepare !== 'function') {
      return res.json({
        success: false,
        error: 'Database not available'
      });
    }
    
    // Get server settings to find member logs channel
    const settings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      return res.json({
        success: false,
        error: 'Server settings not found'
      });
    }
    
    if (!settings.member_log_channel_id) {
      return res.json({
        success: false,
        error: 'Member logs channel not configured. Please set up a member logs channel first.'
      });
    }
    
    const { createCustomInviteLeaveMessage } = require('../handlers/invites/invite-tracker');
    const messageId = await createCustomInviteLeaveMessage(
      settings.member_log_channel_id, 
      guildId, 
      settings, 
      { title, description, color, fields }
    );
    
    if (messageId) {
      res.json({
        success: true,
        data: { messageId }
      });
    } else {
      res.json({
        success: false,
        error: 'Failed to send test invite leave message'
      });
    }
  } catch (error) {
    console.error('[DASHBOARD] Error testing invite leave message:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Auto-Roles Configuration Routes
router.get('/server/:serverId/auto-roles/config', checkServerAccess(), async (req, res) => {
  try {
    const { serverId } = req.params;
    
    console.log(`[AUTO-ROLES] Getting config for server ${serverId}`);
    
    // Get role management settings from the role_management_settings table
    let roleSettings = null;
    try {
      roleSettings = db.prepare(`
        SELECT * FROM role_management_settings WHERE guild_id = ?
      `).get(serverId);
      console.log(`[AUTO-ROLES] Role settings:`, roleSettings);
    } catch (dbError) {
      console.error(`[AUTO-ROLES] Database error getting role settings:`, dbError);
    }
    
    // Get server settings for role configurations
    let serverSettings = null;
    try {
      serverSettings = db.prepare(`
        SELECT welcome_role_id, muted_role_id, mod_role_id, admin_role_id FROM server_settings WHERE guild_id = ?
      `).get(serverId);
      console.log(`[AUTO-ROLES] Server settings:`, serverSettings);
    } catch (dbError) {
      console.error(`[AUTO-ROLES] Database error getting server settings:`, dbError);
      // If server_settings fails, create basic entry
      try {
        db.prepare(`
          INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)
        `).run(serverId);
        serverSettings = { welcome_role_id: null, muted_role_id: null, mod_role_id: null, admin_role_id: null };
      } catch (insertError) {
        console.error(`[AUTO-ROLES] Failed to create server settings:`, insertError);
        serverSettings = { welcome_role_id: null, muted_role_id: null, mod_role_id: null, admin_role_id: null };
      }
    }

    // Parse auto_roles if it's a string
    let autoRoles = [];
    if (roleSettings?.auto_roles) {
      try {
        autoRoles = typeof roleSettings.auto_roles === 'string' 
          ? JSON.parse(roleSettings.auto_roles) 
          : roleSettings.auto_roles;
      } catch (e) {
        console.error(`[AUTO-ROLES] Error parsing auto_roles:`, e);
        autoRoles = [];
      }
    }

    const config = {
      enabled: Boolean(roleSettings?.auto_roles_enabled),
      autoRoles: autoRoles,
      joinRole: serverSettings?.welcome_role_id || '',
      mutedRole: serverSettings?.muted_role_id || '',
      modRole: serverSettings?.mod_role_id || '',
      adminRole: serverSettings?.admin_role_id || ''
    };

    console.log(`[AUTO-ROLES] Returning config:`, config);

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('[AUTO-ROLES] Error getting auto-roles config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get auto-roles configuration'
    });
  }
});

router.post('/server/:serverId/auto-roles/save-config', checkServerAccess(), async (req, res) => {
  try {
    const { serverId } = req.params;
    const { enabled, autoRoles, joinRole, mutedRole, modRole, adminRole } = req.body;
    
    // Update role management settings
    const upsertRoleSettings = db.prepare(`
      INSERT OR REPLACE INTO role_management_settings 
      (guild_id, auto_roles_enabled, auto_roles) 
      VALUES (?, ?, ?)
    `);
    
    upsertRoleSettings.run(
      serverId,
      enabled ? 1 : 0,
      JSON.stringify(autoRoles || [])
    );

    // Update server settings for all role types
    // First ensure server_settings entry exists
    db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(serverId);
    
    // Update all role settings
    const updateServerSettings = db.prepare(`
      UPDATE server_settings SET 
        welcome_role_id = ?, 
        muted_role_id = ?, 
        mod_role_id = ?, 
        admin_role_id = ? 
      WHERE guild_id = ?
    `);
    
    updateServerSettings.run(
      joinRole || null,
      mutedRole || null, 
      modRole || null,
      adminRole || null,
      serverId
    );

    // Log the activity
    console.log(`Auto-roles configuration updated for server ${serverId}: Enabled: ${enabled}, Rules: ${autoRoles?.length || 0}`);

    res.json({
      success: true,
      message: 'Auto-roles configuration saved successfully'
    });
  } catch (error) {
    console.error('Error saving auto-roles config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save auto-roles configuration'
    });
  }
});

// Custom Questions API Endpoints
router.get('/verification/questions/:guildId', checkServerAccess(), async (req, res) => {
  try {
    const { guildId } = req.params;
    
    const settings = db.prepare(`
      SELECT custom_questions FROM verification_settings WHERE guild_id = ?
    `).get(guildId);
    
    let questions = [];
    if (settings?.custom_questions) {
      try {
        questions = JSON.parse(settings.custom_questions);
      } catch (error) {
        console.error('Error parsing custom questions:', error);
      }
    }
    
    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Error getting custom questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get custom questions'
    });
  }
});

router.post('/verification/questions/:guildId', checkServerAccess(), async (req, res) => {
  try {
    const { guildId } = req.params;
    const { question, answer, case_sensitive = false } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        error: 'Question and answer are required'
      });
    }
    
    // Get existing questions
    const settings = db.prepare(`
      SELECT custom_questions FROM verification_settings WHERE guild_id = ?
    `).get(guildId);
    
    let questions = [];
    if (settings?.custom_questions) {
      try {
        questions = JSON.parse(settings.custom_questions);
      } catch (error) {
        console.error('Error parsing existing questions:', error);
      }
    }
    
    // Add new question
    const newQuestion = {
      id: Date.now().toString(),
      question: question.trim(),
      answer: answer.trim(),
      case_sensitive: Boolean(case_sensitive)
    };
    
    questions.push(newQuestion);
    
    // Ensure verification_settings table exists
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
    
    // Save updated questions
    const upsertQuestions = db.prepare(`
      INSERT OR REPLACE INTO verification_settings (guild_id, custom_questions)
      VALUES (?, ?)
    `);
    
    upsertQuestions.run(guildId, JSON.stringify(questions));
    
    res.json({
      success: true,
      data: newQuestion
    });
  } catch (error) {
    console.error('Error adding custom question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add custom question'
    });
  }
});

router.delete('/verification/questions/:guildId/:questionId', checkServerAccess(), async (req, res) => {
  try {
    const { guildId, questionId } = req.params;
    
    // Get existing questions
    const settings = db.prepare(`
      SELECT custom_questions FROM verification_settings WHERE guild_id = ?
    `).get(guildId);
    
    let questions = [];
    if (settings?.custom_questions) {
      try {
        questions = JSON.parse(settings.custom_questions);
      } catch (error) {
        console.error('Error parsing existing questions:', error);
      }
    }
    
    // Remove question
    questions = questions.filter(q => q.id !== questionId);
    
    // Save updated questions
    const updateQuestions = db.prepare(`
      UPDATE verification_settings SET custom_questions = ? WHERE guild_id = ?
    `);
    
    updateQuestions.run(JSON.stringify(questions), guildId);
    
    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting custom question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete custom question'
    });
  }
});

// Age Verification Settings - GET
router.get('/verification/age-settings/:guildId', checkServerAccess(), async (req, res) => {
  try {
    const { guildId } = req.params;
    
    const settings = db.prepare(`
      SELECT min_age, require_account_age, min_account_age_days 
      FROM verification_settings WHERE guild_id = ?
    `).get(guildId);
    
    const ageSettings = {
      min_age: settings?.min_age || 18,
      require_account_age: Boolean(settings?.require_account_age || 0),
      min_account_age_days: settings?.min_account_age_days || 30
    };
    
    res.json({
      success: true,
      data: ageSettings
    });
  } catch (error) {
    console.error('Error getting age verification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get age verification settings'
    });
  }
});

// Age Verification Settings - POST
router.post('/verification/age-settings/:guildId', checkServerAccess(), async (req, res) => {
  try {
    const { guildId } = req.params;
    const { min_age = 13, require_account_age = false, min_account_age_days = 7 } = req.body;
    
    // Ensure verification_settings table exists
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
    
    // Save age settings
    const upsertAgeSettings = db.prepare(`
      INSERT OR REPLACE INTO verification_settings (
        guild_id, min_age, require_account_age, min_account_age_days
      ) VALUES (?, ?, ?, ?)
    `);
    
    upsertAgeSettings.run(
      guildId,
      parseInt(min_age),
      require_account_age ? 1 : 0,
      parseInt(min_account_age_days)
    );
    
    res.json({
      success: true,
      message: 'Age verification settings saved successfully'
    });
  } catch (error) {
    console.error('Error saving age verification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save age verification settings'
    });
  }
});

module.exports = router; 