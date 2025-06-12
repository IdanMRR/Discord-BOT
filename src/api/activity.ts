const express = require('express');
const { getClient } = require('../utils/client-utils');
const { db } = require('../database/sqlite');
const { logError, logInfo } = require('../utils/logger');
const { filterInvalidUserActivities, logInvalidUserId, isValidUserId } = require('./filter-invalid-users');
const { getUserName, formatWarning } = require('./user-helper');

const router = express.Router();

// Helper function to filter mock data
function filterMockData(data: any[]): any[] {
  if (!Array.isArray(data)) {
    return data;
  }
  
  // Filter out ALL soggra command usage entries completely
  return data.filter(item => {
    // Remove ALL soggra command entries
    if (item && item.user_id === 'soggra' && 
        (item.type === 'command_usage' || 
         item.type === 'command' || 
         (item.content && (item.content.startsWith('/') || 
          item.content === 'Command Used')))) {
      logInfo('API', `Filtered out soggra command: ${JSON.stringify(item)}`);
      return false;
    }
    return true;
  });
}

// GET /api/activity - Default route that returns recent activity
router.get('/', async (req: any, res: any) => {
  // Redirect to the recent endpoint to avoid code duplication
  try {
    const recentActivity: any[] = [];

    try {
      // Verify database connection first
      if (!db) {
        throw new Error('Database not connected');
      }
      
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
        WHERE action_type LIKE '%moderation%' OR action_type LIKE '%ban%' OR action_type LIKE '%kick%' OR action_type LIKE '%timeout%'
        ORDER BY created_at DESC 
        LIMIT 10
      `).all();

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
        WHERE active = 1
        ORDER BY created_at DESC 
        LIMIT 10
      `).all();

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
        ORDER BY created_at DESC 
        LIMIT 10
      `).all();

      // Get recent command usage from command_logs table
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
        ORDER BY created_at DESC 
        LIMIT 15
      `).all();

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

      // Take only the most recent 20 items and filter out any fake entries or invalid user IDs
      const limitedActivity = recentActivity
        .filter(activity => {
          // Filter out 'soggra' placeholder entries
          if (activity.user_id === 'soggra') return false;
          
          // Filter out invalid user IDs like '_soill_'
          if (activity.user_id) {
            logInvalidUserId(activity.user_id, 'activity feed');
            return !activity.user_id.includes('_soill_') && /^\d+$/.test(activity.user_id);
          }
          
          return true;
        })
        .slice(0, 20);

      logInfo('API', `Returning ${limitedActivity.length} activity items after filtering`);

      // Try to enrich with Discord data if client is available
      const client = getClient();
      
      // Create an array of promises for user fetching
      const enrichmentPromises = limitedActivity.map(async (activity) => {
        let serverName = 'Unknown Server';
        let channelName = 'Unknown Channel';
        let realUsername = 'Unknown User';

        // Get actual username from Discord if possible
        if (isValidUserId(activity.user_id)) {
          realUsername = await getUserName(client, activity.user_id);
        }

        // Get server name from Discord if client is available
        if (client && activity.guild_id) {
          try {
            const guild = client.guilds.cache.get(activity.guild_id);
            if (guild) {
              serverName = guild.name;
              
              // Get channel name if we have channel_id
              if (activity.channel_id) {
                const channel = guild.channels.cache.get(activity.channel_id);
                if (channel && 'name' in channel) {
                  channelName = channel.name;
                }
              }
            }
          } catch (discordError: any) {
            // Ignore Discord errors, use fallback names
            console.log(`Discord API error: ${discordError.message}`);
          }
        }

        // Format timestamp in Israeli timezone (UTC+3)
        let formattedTimestamp;
        if (typeof activity.timestamp === 'number') {
          const date = new Date(activity.timestamp * 1000);
          formattedTimestamp = new Date(date.setHours(date.getHours() + 3)).toISOString();
        } else {
          const date = new Date(activity.timestamp);
          // Format to Israeli timezone string
          formattedTimestamp = new Date(date.setHours(date.getHours() + 3)).toISOString();
        }

        // Format the activity description based on type
        let description = '';
        
        switch (activity.type) {
          case 'command_usage':
            description = activity.content || 'Command Used';
            break;
          case 'warning':
            // Use new warning format with case number: "Case #0001: admin warned user - reason"
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
      const filteredActivity = enrichedActivity.filter(item => item !== null);
      
      // Double-check and filter out any remaining soggra entries
      const finalActivity = filterMockData(filteredActivity);
      
      // Don't replace usernames anymore - we want to show the actual Discord usernames
      const sanitizedActivity = finalActivity;
      
      // Respond with the combined activities
      res.json({
        success: true,
        data: sanitizedActivity
      });

    } catch (dbError: any) {
      logError('API', `Database error in activity endpoint: ${dbError.message}`);
      
      // If database fails, return empty array instead of mock data
      res.json({
        success: true,
        data: [],
        message: 'No activity data available'
      });
    }

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
    // Get recent activity from database - combining different log types
    const recentActivity: any[] = [];

    try {
      // Verify database connection first
      if (!db) {
        throw new Error('Database not connected');
      }
      
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
        WHERE action_type LIKE '%moderation%' OR action_type LIKE '%ban%' OR action_type LIKE '%kick%' OR action_type LIKE '%timeout%'
        ORDER BY created_at DESC 
        LIMIT 10
      `).all();

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
        WHERE active = 1
        ORDER BY created_at DESC 
        LIMIT 10
      `).all();

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
        ORDER BY created_at DESC 
        LIMIT 10
      `).all();

      // Get recent command usage from command_logs table
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
        ORDER BY created_at DESC 
        LIMIT 15
      `).all();

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

      // Take only the most recent 20 items and filter out any fake entries or invalid user IDs
      const limitedActivity = recentActivity
        .filter(activity => {
          // Filter out 'soggra' placeholder entries
          if (activity.user_id === 'soggra') return false;
          
          // Filter out invalid user IDs like '_soill_'
          if (activity.user_id) {
            logInvalidUserId(activity.user_id, 'activity feed');
            return !activity.user_id.includes('_soill_') && /^\d+$/.test(activity.user_id);
          }
          
          return true;
        })
        .slice(0, 20);

      logInfo('API', `Returning ${limitedActivity.length} activity items after filtering`);

      // Try to enrich with Discord data if client is available
      const client = getClient();
      
      // Create an array of promises for user fetching
      const enrichmentPromises = limitedActivity.map(async (activity) => {
        let serverName = 'Unknown Server';
        let channelName = 'Unknown Channel';
        let realUsername = 'Unknown User';

        // Get actual username from Discord if possible
        if (isValidUserId(activity.user_id)) {
          realUsername = await getUserName(client, activity.user_id);
        }

        // Get server name from Discord if client is available
        if (client && activity.guild_id) {
          try {
            const guild = client.guilds.cache.get(activity.guild_id);
            if (guild) {
              serverName = guild.name;
              
              // Get channel name if we have channel_id
              if (activity.channel_id) {
                const channel = guild.channels.cache.get(activity.channel_id);
                if (channel && 'name' in channel) {
                  channelName = channel.name;
                }
              }
            }
          } catch (discordError: any) {
            // Ignore Discord errors, use fallback names
            console.log(`Discord API error: ${discordError.message}`);
          }
        }

        // Format timestamp in Israeli timezone (UTC+3)
        let formattedTimestamp;
        if (typeof activity.timestamp === 'number') {
          const date = new Date(activity.timestamp * 1000);
          formattedTimestamp = new Date(date.setHours(date.getHours() + 3)).toISOString();
        } else {
          const date = new Date(activity.timestamp);
          // Format to Israeli timezone string
          formattedTimestamp = new Date(date.setHours(date.getHours() + 3)).toISOString();
        }

        // Format the activity description based on type
        let description = '';
        
        switch (activity.type) {
          case 'command_usage':
            description = activity.content || 'Command Used';
            break;
          case 'warning':
            // Use new warning format with case number: "Case #0001: admin warned user - reason"
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
      const filteredActivity = enrichedActivity.filter(item => item !== null);
      
      // Double-check and filter out any remaining soggra entries
      const finalActivity = filterMockData(filteredActivity);
      
      // Don't replace usernames anymore - we want to show the actual Discord usernames
      const sanitizedActivity = finalActivity;
      
      // Respond with the combined activities
      res.json({
        success: true,
        data: sanitizedActivity
      });

    } catch (dbError: any) {
      logError('API', `Database error in server activity endpoint: ${dbError.message}`);
      
      // If database fails, return empty array instead of mock data
      res.json({
        success: true,
        data: [],
        message: 'No activity data available for this server'
      });
    }

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

    // Get recent activity from database - combining different log types
    const serverActivity: any[] = [];

    try {
      // Verify database connection first
      if (!db) {
        throw new Error('Database not connected');
      }
      
      // Get recent moderation actions for this server
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
        WHERE (action_type LIKE '%moderation%' OR action_type LIKE '%ban%' OR action_type LIKE '%kick%' OR action_type LIKE '%timeout%') AND guild_id = ?
        ORDER BY created_at DESC 
        LIMIT 10
      `).all(serverId);

      // Get recent warnings for this server
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
        WHERE active = 1 AND guild_id = ?
        ORDER BY created_at DESC 
        LIMIT 10
      `).all(serverId);

      // Get recent tickets for this server
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
        WHERE guild_id = ?
        ORDER BY created_at DESC 
        LIMIT 10
      `).all(serverId);

      // Get recent command usage for this server
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
        WHERE guild_id = ?
        ORDER BY created_at DESC 
        LIMIT 15
      `).all(serverId);

      // Combine all activities
      serverActivity.push(...modLogs);
      serverActivity.push(...warnings);
      serverActivity.push(...tickets);
      serverActivity.push(...commandUsage);

      // Sort by timestamp (most recent first)
      serverActivity.sort((a, b) => {
        const timeA = typeof a.timestamp === 'number' ? a.timestamp * 1000 : new Date(a.timestamp).getTime();
        const timeB = typeof b.timestamp === 'number' ? b.timestamp * 1000 : new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      // Take only the most recent 20 items and filter out any fake entries or invalid user IDs
      const limitedServerActivity = serverActivity
        .filter(activity => {
          // Filter out 'soggra' placeholder entries
          if (activity.user_id === 'soggra') return false;
          
          // Filter out invalid user IDs like '_soill_'
          if (activity.user_id) {
            logInvalidUserId(activity.user_id, 'server activity');
            return !activity.user_id.includes('_soill_') && /^\d+$/.test(activity.user_id);
          }
          
          return true;
        })
        .slice(0, 20);

      logInfo('API', `Returning ${limitedServerActivity.length} server activity items after filtering`);

      // Try to enrich with Discord data if client is available
      const client = getClient();
      let serverName = 'Unknown Server';
      
      // Get server name from Discord if client is available
      if (client) {
        try {
          const guild = client.guilds.cache.get(serverId);
          if (guild) {
            serverName = guild.name;
          }
        } catch (discordError: any) {
          // Ignore Discord errors, use fallback name
          console.log(`Discord API error: ${discordError.message}`);
        }
      }
      
      // Create an array of promises for user fetching
      const enrichmentPromises = limitedServerActivity.map(async (activity) => {
        let channelName = 'Unknown Channel';
        let realUsername = 'Unknown User';

        // Get actual username from Discord if possible
        if (isValidUserId(activity.user_id)) {
          realUsername = await getUserName(client, activity.user_id);
        }

        // Get additional data from Discord if client is available
        if (client) {
          try {
            const guild = client.guilds.cache.get(serverId);
            if (guild) {
              // Get channel name if we have channel_id
              if (activity.channel_id) {
                const channel = guild.channels.cache.get(activity.channel_id);
                if (channel && 'name' in channel) {
                  channelName = channel.name;
                }
              }

              // Try to get real username from Discord API
              if (activity.user_id && isValidUserId(activity.user_id)) {
                try {
                  const member = guild.members.cache.get(activity.user_id);
                  if (member) {
                    realUsername = member.user.username;
                  } else {
                    const user = client.users.cache.get(activity.user_id);
                    if (user) {
                      realUsername = user.username;
                    }
                  }
                } catch (userError: any) {
                  // Keep the fallback username
                  console.log(`Error getting user ${activity.user_id}: ${userError.message}`);
                }
              }
            }
          } catch (discordError: any) {
            // Ignore Discord errors, use fallback names
            console.log(`Discord API error: ${discordError.message}`);
          }
        }

        // Format timestamp in Israeli timezone (UTC+3)
        let formattedTimestamp;
        if (typeof activity.timestamp === 'number') {
          const date = new Date(activity.timestamp * 1000);
          formattedTimestamp = new Date(date.setHours(date.getHours() + 3)).toISOString();
        } else {
          const date = new Date(activity.timestamp);
          // Format to Israeli timezone string
          formattedTimestamp = new Date(date.setHours(date.getHours() + 3)).toISOString();
        }

        // Format the activity description based on type
        let description = '';
        
        switch (activity.type) {
          case 'command_usage':
            description = activity.content || 'Command Used';
            break;
          case 'warning':
            // Use new warning format with case number: "Case #0001: admin warned user - reason"
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
      const filteredActivity = enrichedActivity.filter(item => item !== null);
      
      // Double-check and filter out any remaining soggra entries
      const finalActivity = filterMockData(filteredActivity);
      
      // Don't replace usernames anymore - we want to show the actual Discord usernames
      const sanitizedActivity = finalActivity;
      
      // Respond with the combined activities
      res.json({
        success: true,
        data: sanitizedActivity,
        server: {
          id: serverId,
          name: serverName
        }
      });

    } catch (dbError: any) {
      logError('API', `Database error in server activity endpoint: ${dbError.message}`);
      
      // If database fails, return empty array instead of mock data
      res.json({
        success: true,
        data: [],
        server: {
          id: serverId,
          name: 'Unknown Server'
        },
        message: 'No activity data available for this server'
      });
    }

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
