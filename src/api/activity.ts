const express = require('express');
const { getClient } = require('../utils/client-utils');
const { db } = require('../database/sqlite');
const { logError, logInfo } = require('../utils/logger');
const { filterInvalidUserActivities, logInvalidUserId, isValidUserId } = require('./filter-invalid-users');
const { getUserName, formatWarning } = require('./user-helper');

// Import date utilities for consistent timezone handling
function formatTimestamp(timestamp: any): string {
  try {
    if (!timestamp) {
      return 'Recently';
    }
    
    let date: Date;
    if (typeof timestamp === 'number') {
      // Handle both seconds and milliseconds timestamps
      date = timestamp > 10000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp);
      return 'Recently';
    }
    
    // Force the date to be interpreted as UTC (same as frontend)
    const utcYear = date.getUTCFullYear();
    const utcMonth = date.getUTCMonth();
    const utcDay = date.getUTCDate();
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const utcSeconds = date.getUTCSeconds();
    
    // Create a new date object with the UTC values
    const utcDate = new Date(Date.UTC(utcYear, utcMonth, utcDay, utcHours, utcMinutes, utcSeconds));
    
    // Add 3 hours for Israeli time (UTC+3) - same as frontend
    const israeliTime = new Date(utcDate.getTime() + (3 * 60 * 60 * 1000));
    
    // Get current Israeli time for comparison
    const now = new Date();
    const currentIsraeliTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    
    // Calculate time difference using Israeli timestamps
    const diffMs = currentIsraeliTime.getTime() - israeliTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Show relative time for recent entries (same as frontend)
    if (diffMinutes < 1 && diffMs >= 0) {
      return 'Just now';
    } else if (diffMinutes < 60 && diffMs >= 0) {
      return `${diffMinutes} min ago`;
    } else if (diffHours < 24 && diffMs >= 0) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7 && diffMs >= 0) {
      return `${diffDays}d ago`;
    } else {
      // For older entries, format same as frontend (DD.MM.YYYY, HH:MM)
      const day = israeliTime.getDate().toString().padStart(2, '0');
      const month = (israeliTime.getMonth() + 1).toString().padStart(2, '0');
      const year = israeliTime.getFullYear();
      const hours = israeliTime.getHours().toString().padStart(2, '0');
      const minutes = israeliTime.getMinutes().toString().padStart(2, '0');
      
      return `${day}.${month}.${year}, ${hours}:${minutes}`;
    }
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'Invalid date';
  }
}

const router = express.Router();

// Helper function to filter invalid data and remove duplicates
function filterInvalidData(data: any[]): any[] {
  if (!Array.isArray(data)) {
    return data;
  }
  
  const seenIds = new Set();
  
  return data.filter(item => {
    // Remove duplicate entries by ID
    if (seenIds.has(item.id)) {
      logInfo('API', `Filtered out duplicate entry: ${item.id}`);
      return false;
    }
    seenIds.add(item.id);
    
    // Remove test/mock entries
    if (item && item.user_id === 'soggra' && 
        (item.type === 'command_usage' || 
         item.type === 'command' || 
         (item.content && (item.content.startsWith('/') || 
          item.content === 'Command Used')))) {
      logInfo('API', `Filtered out test entry: ${JSON.stringify(item)}`);
      return false;
    }
    
    // Filter out invalid user IDs
    if (item.user_id && !isValidUserId(item.user_id)) {
      logInvalidUserId(item.user_id, 'activity feed');
      return false;
    }
    
    return true;
  });
}

// Shared function to get activity data from database
async function getActivityData(guildId?: string): Promise<any[]> {
  const recentActivity: any[] = [];

  try {
    // Verify database connection first
    if (!db) {
      throw new Error('Database not connected');
    }
    
    // Build WHERE clause for guild filtering
    const whereClause = guildId ? ' AND guild_id = ?' : '';
    const params = guildId ? [guildId] : [];
    
    // Get recent moderation actions
    const modLogs = db.prepare(`
      SELECT 
        'moderation' as type,
        id,
        user_id,
        guild_id,
        action_type as content,
        created_at as timestamp,
        details
      FROM server_logs 
      WHERE (action_type LIKE '%moderation%' OR action_type LIKE '%ban%' OR action_type LIKE '%kick%' OR action_type LIKE '%timeout%')${whereClause}
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(...params);

    // Get recent warnings
    const warnings = db.prepare(`
      SELECT 
        'warning' as type,
        id,
        user_id,
        guild_id,
        reason as content,
        created_at as timestamp,
        moderator_id,
        case_number
      FROM warnings 
      WHERE active = 1${whereClause}
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(...params);

    // Get recent tickets
    const tickets = db.prepare(`
      SELECT 
        'ticket' as type,
        id,
        user_id,
        guild_id,
        ('Ticket #' || ticket_number || ': ' || subject) as content,
        created_at as timestamp,
        channel_id,
        status
      FROM tickets 
      WHERE 1=1${whereClause}
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(...params);

    // Get recent command usage
    const commandUsage = db.prepare(`
      SELECT 
        'command_usage' as type,
        id,
        user_id,
        guild_id,
        ('/' || command) as content,
        created_at as timestamp,
        channel_id,
        success
      FROM command_logs 
      WHERE 1=1${whereClause}
      ORDER BY created_at DESC 
      LIMIT 15
    `).all(...params);

    // Combine all activities
    recentActivity.push(...modLogs);
    recentActivity.push(...warnings);
    recentActivity.push(...tickets);
    recentActivity.push(...commandUsage);

    // Sort by timestamp (most recent first)
    recentActivity.sort((a, b) => {
      const timeA = typeof a.timestamp === 'number' ? a.timestamp * 1000 : new Date(a.timestamp).getTime();
      const timeB = typeof b.timestamp === 'number' ? b.timestamp * 1000 : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    return recentActivity;
  } catch (error: any) {
    logError('API', `Database error in activity data: ${error.message}`);
    return [];
  }
}

// Shared function to enrich activity data
async function enrichActivityData(activities: any[], guildId?: string): Promise<any[]> {
  const client = getClient();
  let serverName = 'Unknown Server';
  
  // Get server name if we have a specific guild
  if (client && guildId) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        serverName = guild.name;
      }
    } catch (discordError: any) {
      console.log(`Discord API error: ${discordError.message}`);
    }
  }

  // Create an array of promises for user fetching
  const enrichmentPromises = activities.map(async (activity) => {
    let channelName = 'Unknown Channel';
    let realUsername = 'Unknown User';

    // Get actual username from Discord if possible
    if (isValidUserId(activity.user_id)) {
      realUsername = await getUserName(client, activity.user_id);
    }

    // Get additional data from Discord if client is available
    if (client && activity.guild_id) {
      try {
        const guild = client.guilds.cache.get(activity.guild_id);
        if (guild) {
          if (!guildId) serverName = guild.name; // Only update if we don't have a specific guild
          
          // Get channel name if we have channel_id
          if (activity.channel_id) {
            const channel = guild.channels.cache.get(activity.channel_id);
            if (channel && 'name' in channel) {
              channelName = channel.name;
            }
          }
        }
      } catch (discordError: any) {
        console.log(`Discord API error: ${discordError.message}`);
      }
    }

    // Debug: Log the timestamp format we're getting
    console.log('Activity timestamp:', activity.timestamp, 'Type:', typeof activity.timestamp);
    
    // Send raw timestamp to frontend for proper formatting
    const formattedTimestamp = activity.timestamp;

    // Format the activity description based on type
    let description = '';
    
    switch (activity.type) {
      case 'command_usage':
        description = activity.content || 'Command Used';
        break;
      case 'warning':
        const reason = activity.content || 'No reason provided';
        description = await formatWarning(client, activity.moderator_id, activity.user_id, reason, activity.case_number);
        break;
      case 'ticket':
        description = activity.content || 'Ticket Activity';
        break;
      case 'moderation':
        description = activity.content || 'Moderation Action';
        break;
      default:
        description = activity.content || activity.details || 'Activity';
    }

    return {
      id: activity.id.toString(),
      type: activity.type === 'command_usage' ? 'command_used' : 
            activity.type === 'warning' ? 'warning_issued' :
            activity.type === 'ticket' ? 'ticket_created' :
            activity.type === 'moderation' ? 'moderation_action' : activity.type,
      user: activity.type === 'warning' ? '' : realUsername,
      description: description,
      content: activity.content || '',
      details: activity.details || '',
      timestamp: formattedTimestamp,
      serverId: activity.guild_id,
      serverName: serverName,
      channelName: channelName
    };
  });

  // Wait for all enrichment promises to resolve
  const enrichedActivity = await Promise.all(enrichmentPromises);
  
  // Filter out any null values (from async operations)
  return enrichedActivity.filter(item => item !== null);
}

// GET /api/activity - Default route that returns recent activity
router.get('/', async (req: any, res: any) => {
  try {
    // Get activity data from database
    const recentActivity = await getActivityData();
    
    // Filter invalid data and remove duplicates, then limit to 20 items
    const filteredActivity = filterInvalidData(recentActivity);
    const limitedActivity = filteredActivity.slice(0, 20);

    logInfo('API', `Returning ${limitedActivity.length} activity items after filtering`);

    // Enrich with Discord data
    const enrichedActivity = await enrichActivityData(limitedActivity);
    
    // Respond with the combined activities
    res.json({
      success: true,
      data: enrichedActivity
    });

  } catch (error: any) {
    logError('API', `Error fetching activity: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity',
      message: error.message
    });
  }
});

// GET /api/activity/recent - Get recent activity logs from database
router.get('/recent', async (req: any, res: any) => {
  try {
    // Get activity data from database
    const recentActivity = await getActivityData();
    
    // Filter invalid data and remove duplicates, then limit to 20 items
    const filteredActivity = filterInvalidData(recentActivity);
    const limitedActivity = filteredActivity.slice(0, 20);

    logInfo('API', `Returning ${limitedActivity.length} activity items after filtering`);

    // Enrich with Discord data
    const enrichedActivity = await enrichActivityData(limitedActivity);
    
    // Respond with the combined activities
    res.json({
      success: true,
      data: enrichedActivity
    });

  } catch (error: any) {
    logError('API', `Error fetching server activity: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch server activity',
      message: error.message
    });
  }
});

// GET /api/activity/:serverId - Get recent activity logs for a specific server
router.get('/:serverId', async (req: any, res: any) => {
  const serverId = req.params.serverId;
  
  try {
    // Verify server ID format
    if (!serverId || !/^\d+$/.test(serverId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid server ID format',
        message: 'Server ID must be a valid Discord server ID (numeric string)'
      });
    }

    // Get activity data for specific server
    const serverActivity = await getActivityData(serverId);
    
    // Filter invalid data and remove duplicates, then limit to 20 items
    const filteredActivity = filterInvalidData(serverActivity);
    const limitedServerActivity = filteredActivity.slice(0, 20);

    logInfo('API', `Returning ${limitedServerActivity.length} server activity items after filtering`);

    // Enrich with Discord data
    const enrichedActivity = await enrichActivityData(limitedServerActivity, serverId);
    
    // Get server name for response
    let serverName = 'Unknown Server';
    const client = getClient();
    if (client) {
      try {
        const guild = client.guilds.cache.get(serverId);
        if (guild) {
          serverName = guild.name;
        }
      } catch (discordError: any) {
        console.log(`Discord API error: ${discordError.message}`);
      }
    }
    
    // Respond with the combined activities
    res.json({
      success: true,
      data: enrichedActivity,
      server: {
        id: serverId,
        name: serverName
      }
    });

  } catch (error: any) {
    logError('API', `Error fetching server activity: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch server activity',
      message: error.message
    });
  }
});

module.exports = router;