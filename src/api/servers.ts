import express, { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ServerSettingsService, ServerSettings } from '../database/services/serverSettingsService';
import { TicketCategoriesService } from '../database/services/ticketCategoriesService';
import { logInfo, logError } from '../utils/logger';
import { getClient, isClientReady } from '../utils/client-utils';

const router = Router();

// Define custom response type
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  clientStatus?: {
    exists: boolean;
    ready: boolean;
    userTag: string | null;
    guildCount: number;
  };
}

// Helper function to send JSON responses
const sendJsonResponse = <T>(
  res: Response,
  statusCode: number,
  data: T
): void => {
  res.status(statusCode).json(data);
};

// Helper function to get detailed client status
const getClientStatus = () => {
  const client = getClient();
  return {
    exists: !!client,
    ready: client?.isReady() || false,
    userTag: client?.user?.tag || null,
    guildCount: client?.guilds?.cache?.size || 0
  };
};

// Helper function to fetch servers with proper error handling and retries
const fetchServersFromDiscord = async (): Promise<any[]> => {
    const client = getClient();
    
  if (!client) {
    logError('API', 'Discord client is not available');
    throw new Error('Discord client not initialized');
  }
  
  if (!client.isReady()) {
    logError('API', 'Discord client exists but is not ready');
    throw new Error('Discord client not ready');
  }
  
  if (!client.guilds || !client.guilds.cache) {
    logError('API', 'Discord client guilds manager not available');
    throw new Error('Discord guilds manager not available');
  }
  
        const guilds = Array.from(client.guilds.cache.values());
  logInfo('API', `Found ${guilds.length} guilds in Discord client cache`);
  
  if (guilds.length === 0) {
    logInfo('API', 'No guilds found - bot may not be invited to any servers');
    return [];
  }
        
  // Format servers with error handling for each guild
  const servers = [];
  for (const guild of guilds) {
    try {
          let ownerInfo = null;
          
      // Try to fetch owner info safely
      if (guild.ownerId) {
          try {
              const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
              if (owner) {
                ownerInfo = {
                  id: owner.id,
                  username: owner.user.username,
                  discriminator: owner.user.discriminator,
                  avatar: owner.user.avatar,
                  displayName: owner.displayName
                };
              }
        } catch (ownerError) {
          logError('API', `Failed to fetch owner for guild ${guild.id}: ${ownerError}`);
            }
          }
          
      const serverData = {
            id: guild.id,
        name: guild.name || 'Unknown Server',
            memberCount: guild.memberCount || 0,
            icon: guild.icon,
            owner: ownerInfo,
        ownerId: guild.ownerId,
        available: guild.available || true
          };
      
      servers.push(serverData);
      logInfo('API', `Successfully processed guild: ${serverData.name} (${serverData.id})`);
    } catch (guildError) {
      logError('API', `Error processing guild ${guild.id}: ${guildError}`);
      // Continue with other guilds even if one fails
    }
  }
  
  return servers;
};

// Main function to get all servers with comprehensive fallback
const getAllServers: RequestHandler = async (req, res, next) => {
  const startTime = Date.now();
  logInfo('API', '=== Starting getAllServers request ===');
  
  try {
    const clientStatus = getClientStatus();
    logInfo('API', `Client status: ${JSON.stringify(clientStatus)}`);
    
    let servers: any[] = [];
    let errorMessage: string | null = null;
    
    // Try to fetch from Discord first
    if (clientStatus.exists && clientStatus.ready) {
      try {
        logInfo('API', 'Attempting to fetch servers from Discord...');
        servers = await fetchServersFromDiscord();
        logInfo('API', `Successfully fetched ${servers.length} servers from Discord`);
      } catch (discordError: any) {
        logError('API', `Discord fetch failed: ${discordError.message}`);
        errorMessage = discordError.message;
      }
    } else {
      const reason = !clientStatus.exists 
        ? 'Discord client not initialized' 
        : 'Discord client not ready';
      logInfo('API', `Skipping Discord fetch: ${reason}`);
      errorMessage = reason;
    }
    
    // Fallback to database if Discord failed or returned no servers
    if (servers.length === 0) {
      try {
        logInfo('API', 'Attempting database fallback...');
        const dbResult = await ServerSettingsService.listServers();
        
        if (dbResult.success && dbResult.data && Array.isArray(dbResult.data) && dbResult.data.length > 0) {
          servers = dbResult.data.map((server: ServerSettings) => ({
        id: server.guild_id,
        name: server.name || 'Unknown Server',
        memberCount: 0,
            icon: null,
            owner: null,
            ownerId: null,
            available: true,
            source: 'database'
          }));
          logInfo('API', `Database fallback successful: ${servers.length} servers`);
        } else {
          logInfo('API', 'No servers found in database either');
        }
      } catch (dbError: any) {
        logError('API', `Database fallback failed: ${dbError.message}`);
      }
    }
    
    // Determine response based on results
    const response: ApiResponse = {
      success: true,
      data: servers,
      clientStatus,
      message: servers.length === 0 ? 'No servers found' : undefined
    };
    
    // Add specific error messages based on the situation
    if (servers.length === 0) {
      if (!clientStatus.exists) {
        response.error = 'Discord bot is starting up. Please wait a moment and try again.';
      } else if (!clientStatus.ready) {
        response.error = 'Discord bot is connecting. Please wait a moment and try again.';
      } else if (clientStatus.guildCount === 0) {
        response.error = 'Your Discord bot is not currently invited to any servers. Please invite the bot to a server to see it here.';
      } else {
        response.error = 'No servers found. Please ensure your Discord bot has proper permissions or try again.';
      }
    }
    
    const duration = Date.now() - startTime;
    logInfo('API', `=== getAllServers completed in ${duration}ms with ${servers.length} servers ===`);
    
    sendJsonResponse(res, 200, response);
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logError('API', `getAllServers failed after ${duration}ms: ${error.message}`);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Internal server error while fetching servers',
      clientStatus: getClientStatus()
    };
    
    sendJsonResponse(res, 500, errorResponse);
  }
};

// Get a specific server by ID with better error handling
const getServerById: RequestHandler = async (req, res, next) => {
    const { serverId } = req.params;
  const startTime = Date.now();
    
  logInfo('API', `=== Starting getServerById for ${serverId} ===`);
    
  try {
    if (!serverId || serverId === 'undefined') {
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Server ID is required'
      };
      return sendJsonResponse(res, 400, errorResponse);
    }
    
    const clientStatus = getClientStatus();
    let serverData: any = null;
    
    // Try Discord first if available
    if (clientStatus.exists && clientStatus.ready) {
    try {
      const client = getClient();
        const guild = client?.guilds?.cache?.get(serverId);
        
        if (guild) {
          // Fetch additional server data
          const serverSettings = await ServerSettingsService.getOrCreate(serverId, guild.name);
          
          let ownerInfo = null;
          if (guild.ownerId) {
          try {
              const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
              if (owner) {
                ownerInfo = {
                  id: owner.id,
                  username: owner.user.username,
                  discriminator: owner.user.discriminator,
                  avatar: owner.user.avatar,
                  displayName: owner.displayName
                };
              }
            } catch (ownerError) {
              logError('API', `Error fetching owner for guild ${serverId}: ${ownerError}`);
            }
          }
          
          serverData = {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount || 0,
            icon: guild.icon,
            owner: ownerInfo,
            ownerId: guild.ownerId,
            available: guild.available,
            settings: serverSettings,
            source: 'discord'
          };
          
          logInfo('API', `Found server ${serverId} in Discord`);
        }
      } catch (discordError: any) {
        logError('API', `Discord lookup failed for ${serverId}: ${discordError.message}`);
      }
    }
    
    // Fallback to database
    if (!serverData) {
      try {
        const settings = await ServerSettingsService.getOrCreate(serverId, 'Unknown Server');
        if (settings) {
          serverData = {
            id: serverId,
            name: settings.name || 'Unknown Server',
            memberCount: 0,
            icon: null,
            owner: null,
            ownerId: null,
            available: true,
            settings: settings,
            source: 'database'
          };
          logInfo('API', `Found server ${serverId} in database`);
        }
      } catch (dbError: any) {
        logError('API', `Database lookup failed for ${serverId}: ${dbError.message}`);
      }
    }
    
    if (!serverData) {
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Server not found',
        clientStatus
      };
      return sendJsonResponse(res, 404, errorResponse);
    }
    
    const response: ApiResponse = {
      success: true,
      data: serverData,
      clientStatus
    };
    
    const duration = Date.now() - startTime;
    logInfo('API', `=== getServerById completed in ${duration}ms ===`);
    
    sendJsonResponse(res, 200, response);
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logError('API', `getServerById failed after ${duration}ms: ${error.message}`);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Internal server error while fetching server',
      clientStatus: getClientStatus()
    };
    
    sendJsonResponse(res, 500, errorResponse);
  }
};

// Register routes in the correct order
// Debug and test routes first
router.get('/debug/client', (req, res) => {
  try {
    const clientStatus = getClientStatus();
    const client = getClient();
    
    const debugInfo = {
      ...clientStatus,
      timestamp: new Date().toISOString(),
      guildNames: [] as Array<{ id: string; name: string; memberCount: number }>
    };
    
    if (client && client.guilds && client.guilds.cache && client.guilds.cache.size > 0) {
      debugInfo.guildNames = Array.from(client.guilds.cache.values())
        .slice(0, 5)
        .map((guild: any) => ({
      id: guild.id,
      name: guild.name,
          memberCount: guild.memberCount || 0
        }));
    }
    
    logInfo('API', `Debug client status: ${JSON.stringify(debugInfo)}`);
    
    res.json({
      success: true,
      data: debugInfo
    });
  } catch (error: any) {
    logError('API', `Debug endpoint error: ${error.message}`);
    res.json({
      success: false,
      error: error.message
    });
  }
});

router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Servers API is working',
    timestamp: new Date().toISOString(),
    clientStatus: getClientStatus()
  });
});

// Main routes
router.get('/', getAllServers);
router.get('/:serverId', getServerById);

// Add channels endpoint
router.get('/:serverId/channels', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { type = 'text' } = req.query;
    
    logInfo('API', `Getting channels for server ${serverId}, type: ${type}`);
    
    if (!serverId || serverId === 'undefined') {
      return sendJsonResponse(res, 400, {
        success: false,
        error: 'Server ID is required'
      });
    }
    
    const client = getClient();
    
    if (!client || !client.isReady() || !client.guilds) {
      return sendJsonResponse(res, 503, {
        success: false,
        error: 'Discord client is not available or not ready'
      });
    }
    
    const guild = client.guilds.cache.get(serverId);
    
    if (!guild) {
      return sendJsonResponse(res, 404, {
        success: false,
        error: 'Server not found or bot does not have access to this server'
      });
    }
    
    try {
      // Get channels based on type filter
      let channels = Array.from(guild.channels.cache.values());
      
      if (type === 'text') {
        channels = channels.filter(channel => channel.type === 0); // Text channels
      } else if (type === 'category') {
        channels = channels.filter(channel => channel.type === 4); // Category channels
      }
      // 'all' returns all channels without filter
      
      const channelData = channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: 'position' in channel ? channel.position : 0,
        parentId: channel.parentId,
        parent: channel.parent?.name || null
      })).sort((a, b) => a.position - b.position);
      
      logInfo('API', `Successfully fetched ${channelData.length} channels for server ${serverId}`);
      
      return sendJsonResponse(res, 200, {
        success: true,
        data: channelData
      });
      
    } catch (channelError: any) {
      logError('API', `Error fetching channels for server ${serverId}: ${channelError.message}`);
      return sendJsonResponse(res, 500, {
        success: false,
        error: 'Failed to fetch server channels'
      });
    }
    
  } catch (error: any) {
    logError('API', `Error in channels endpoint: ${error.message}`);
    return sendJsonResponse(res, 500, {
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get ticket categories for a server
router.get('/:serverId/ticket-categories', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    if (!serverId) {
      return sendJsonResponse(res, 400, {
        success: false,
        error: 'Server ID is required'
      });
    }
    
    logInfo('API', `Fetching ticket categories for server ${serverId}`);
    
    // Get server settings to see current selection
    const settings = await ServerSettingsService.getServerSettings(serverId);
    
    // First, check if we have any stored categories in the database
    let storedCategories = await TicketCategoriesService.getServerCategories(serverId);
    
    // Get real Discord category channels from the server
    const client = getClient();
    let discordCategories: any[] = [];
    
    if (client && client.isReady() && client.guilds) {
      const guild = client.guilds.cache.get(serverId);
      if (guild) {
        // Get all category channels (type 4)
        const categoryChannels = guild.channels.cache.filter(channel => channel.type === 4);
        
        discordCategories = Array.from(categoryChannels.values()).map(category => ({
          id: category.id,
          name: category.name,
          position: 'position' in category ? category.position : 0
        })).sort((a, b) => a.position - b.position);
        
        logInfo('API', `Found ${discordCategories.length} Discord category channels in server ${serverId}`);
        
        // If we have Discord categories and no stored categories, create them in the database
        if (discordCategories.length > 0 && storedCategories.length === 0) {
          logInfo('API', `Creating Discord categories in database for server ${serverId}`);
          await TicketCategoriesService.createFromDiscordCategories(serverId, discordCategories);
          // Refresh stored categories after creation
          storedCategories = await TicketCategoriesService.getServerCategories(serverId);
        }
      }
    }
    
    // If we still have no categories (no Discord categories and no stored ones), create defaults
    if (storedCategories.length === 0 && discordCategories.length === 0) {
      logInfo('API', `No categories found for server ${serverId}, creating defaults`);
      await TicketCategoriesService.createDefaultCategories(serverId);
      storedCategories = await TicketCategoriesService.getServerCategories(serverId);
    }
    
    // Convert stored categories to the format expected by the frontend
    const categories = storedCategories.map(cat => ({
      id: cat.category_id,
      label: cat.name,
      description: cat.description || `${cat.category_type === 'discord_category' ? 'Discord category: ' : ''}${cat.name}`,
      emoji: cat.emoji || '📁',
      color: cat.color || 0x5865F2,
      priority: cat.priority || 'medium',
      expectedResponseTime: cat.expected_response_time || '24 hours',
      type: cat.category_type || 'custom'
    }));
    
    logInfo('API', `Returning ${categories.length} categories for server ${serverId}`);
    
    sendJsonResponse(res, 200, {
      success: true,
      data: {
        categories: categories,
        currentCategoryId: settings?.ticket_category_id || null,
        source: categories.length > 0 ? (categories[0].type === 'discord_category' ? 'discord' : 'database') : 'none'
      }
    });
  } catch (error: any) {
    logError('API', `Error getting ticket categories: ${error.message}`);
    sendJsonResponse(res, 500, {
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update ticket categories for a server (POST endpoint for compatibility)
router.post('/:serverId/ticket-categories', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { categoryId, categories } = req.body;
    
    if (!serverId) {
      return sendJsonResponse(res, 400, {
        success: false,
        error: 'Server ID is required'
      });
    }
    
    logInfo('API', `Updating ticket category for server ${serverId} to: ${categoryId || 'none'}`);
    
    // Get current settings or create default ones
    let currentSettings = await ServerSettingsService.getServerSettings(serverId);
    
    if (!currentSettings) {
      // Create default settings if none exist
      currentSettings = {
        guild_id: serverId,
        name: 'Unknown Server',
        language: 'en'
      };
    }
    
    // Update server settings with new category ID
    const updatedSettings = {
      ...currentSettings,
      ticket_category_id: categoryId || undefined
    };
    
    const result = await ServerSettingsService.updateSettings(serverId, updatedSettings);
    
    if (result) {
      logInfo('API', `Successfully updated ticket category for server ${serverId}`);
      sendJsonResponse(res, 200, {
        success: true,
        message: 'Ticket category updated successfully'
      });
    } else {
      logError('API', `Failed to update ticket category for server ${serverId}`);
      sendJsonResponse(res, 500, {
        success: false,
        error: 'Failed to update ticket category'
      });
    }
    
    // TODO: In the future, store custom categories per server in the database
    
  } catch (error: any) {
    logError('API', `Error updating ticket categories: ${error.message}`);
    sendJsonResponse(res, 500, {
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update ticket categories for a server (PUT endpoint)
router.put('/:serverId/ticket-categories', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { categoryId, categories } = req.body;
    
    if (!serverId) {
      return sendJsonResponse(res, 400, {
        success: false,
        error: 'Server ID is required'
      });
    }
    
    logInfo('API', `Updating ticket category for server ${serverId} to: ${categoryId || 'none'}`);
    
    // Get current settings or create default ones
    let currentSettings = await ServerSettingsService.getServerSettings(serverId);
    
    if (!currentSettings) {
      // Create default settings if none exist
      currentSettings = {
        guild_id: serverId,
        name: 'Unknown Server',
        language: 'en'
      };
    }
    
    // Update server settings with new category ID
    const updatedSettings = {
      ...currentSettings,
      ticket_category_id: categoryId || undefined
    };
    
    const result = await ServerSettingsService.updateSettings(serverId, updatedSettings);
    
    if (result) {
      logInfo('API', `Successfully updated ticket category for server ${serverId}`);
      sendJsonResponse(res, 200, {
        success: true,
        message: 'Ticket category updated successfully'
      });
    } else {
      logError('API', `Failed to update ticket category for server ${serverId}`);
      sendJsonResponse(res, 500, {
        success: false,
        error: 'Failed to update ticket category'
      });
    }
    
    // TODO: In the future, store custom categories per server in the database
    
  } catch (error: any) {
    logError('API', `Error updating ticket categories: ${error.message}`);
    sendJsonResponse(res, 500, {
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
