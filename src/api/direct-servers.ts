import express from 'express';
import { logInfo, logError } from '../utils/logger';
import { getClient, isClientReady } from '../utils/client-utils';
import { ServerSettingsService } from '../database/services/serverSettingsService';

const router = express.Router();

// Define server interface
interface ServerData {
  id: string;
  name: string;
  memberCount: number;
  icon: string | null;
  available?: boolean;
  source?: string;
}

// Helper function to get client status
const getClientStatus = () => {
  const client = getClient();
  return {
    exists: !!client,
    ready: client?.isReady() || false,
    userTag: client?.user?.tag || null,
    guildCount: client?.guilds?.cache?.size || 0
  };
};

// Main endpoint for getting servers directly (simplified and robust)
router.get('/', async (req, res) => {
  const startTime = Date.now();
  logInfo('API', '=== Starting direct servers endpoint ===');
  
  try {
    const clientStatus = getClientStatus();
    logInfo('API', `Direct endpoint client status: ${JSON.stringify(clientStatus)}`);
    
    let servers: ServerData[] = [];
    let source = 'none';
    
    // Try Discord client first if available and ready
    if (clientStatus.exists && clientStatus.ready && clientStatus.guildCount > 0) {
      try {
        const client = getClient();
        const guilds = Array.from(client!.guilds!.cache.values());
        
        servers = guilds.map((guild: any) => ({
          id: guild.id,
          name: guild.name || 'Unknown Server',
          memberCount: guild.memberCount || 0,
          icon: guild.icon,
          available: guild.available !== false,
          source: 'discord'
        }));
        
        source = 'discord';
        logInfo('API', `Direct endpoint: Successfully fetched ${servers.length} servers from Discord`);
      } catch (discordError: any) {
        logError('API', `Direct endpoint Discord error: ${discordError.message}`);
      }
    } else {
      logInfo('API', `Direct endpoint: Skipping Discord (exists: ${clientStatus.exists}, ready: ${clientStatus.ready}, guilds: ${clientStatus.guildCount})`);
    }
    
    // Fallback to database if no Discord servers
    if (servers.length === 0) {
      try {
        logInfo('API', 'Direct endpoint: Attempting database fallback...');
        const dbResult = await ServerSettingsService.listServers();
        
        if (dbResult.success && dbResult.data && Array.isArray(dbResult.data) && dbResult.data.length > 0) {
          servers = dbResult.data.map((server: any) => ({
            id: server.guild_id,
            name: server.name || 'Unknown Server',
            memberCount: 0,
            icon: null,
            available: true,
            source: 'database'
          }));
          
          source = 'database';
          logInfo('API', `Direct endpoint: Database fallback successful - ${servers.length} servers`);
        } else {
          logInfo('API', 'Direct endpoint: No servers found in database');
        }
      } catch (dbError: any) {
        logError('API', `Direct endpoint database error: ${dbError.message}`);
      }
    }
    
    // Determine response message
    let message = '';
    if (servers.length === 0) {
      if (!clientStatus.exists) {
        message = 'Discord bot is starting up. Please wait a moment and refresh the page.';
      } else if (!clientStatus.ready) {
        message = 'Discord bot is connecting. Please wait a moment and refresh the page.';
      } else if (clientStatus.guildCount === 0) {
        message = 'Your Discord bot is not currently invited to any servers. Please invite the bot to a server to see it here.';
      } else {
        message = 'No servers found. Please ensure your Discord bot has proper permissions.';
      }
    } else {
      message = `Found ${servers.length} servers from ${source}`;
    }
    
    const duration = Date.now() - startTime;
    logInfo('API', `=== Direct servers endpoint completed in ${duration}ms with ${servers.length} servers ===`);
    
    return res.json({
      success: true,
      data: servers,
      message,
      clientStatus,
      source
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logError('API', `Direct servers endpoint failed after ${duration}ms: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error while fetching servers',
      clientStatus: getClientStatus()
    });
  }
});

// Simplified server by ID endpoint
router.get('/:serverId', async (req, res) => {
  const { serverId } = req.params;
  const startTime = Date.now();
  
  logInfo('API', `=== Direct server by ID: ${serverId} ===`);
  
  try {
    if (!serverId || serverId === 'undefined') {
      return res.status(400).json({
        success: false,
        error: 'Server ID is required'
      });
    }
    
    const clientStatus = getClientStatus();
    let serverData: ServerData | null = null;
    let source = 'none';
    
    // Try Discord first
    if (clientStatus.exists && clientStatus.ready) {
      try {
        const client = getClient();
        const guild = client?.guilds?.cache?.get(serverId);
        
        if (guild) {
          serverData = {
            id: guild.id,
            name: guild.name || 'Unknown Server',
            memberCount: guild.memberCount || 0,
            icon: guild.icon,
            available: guild.available !== false,
            source: 'discord'
          };
          source = 'discord';
          logInfo('API', `Direct server by ID: Found ${serverId} in Discord`);
        }
      } catch (discordError: any) {
        logError('API', `Direct server by ID Discord error for ${serverId}: ${discordError.message}`);
      }
    }
    
    // Fallback to database
    if (!serverData) {
      try {
        const settings = await ServerSettingsService.getServerSettings(serverId);
        if (settings) {
          serverData = {
            id: serverId,
            name: settings.name || 'Unknown Server',
            memberCount: 0,
            icon: null,
            available: true,
            source: 'database'
          };
          source = 'database';
          logInfo('API', `Direct server by ID: Found ${serverId} in database`);
        }
      } catch (dbError: any) {
        logError('API', `Direct server by ID database error for ${serverId}: ${dbError.message}`);
      }
    }
    
    if (!serverData) {
      return res.status(404).json({
        success: false,
        error: 'Server not found. Please ensure the server exists and your bot has access to it.',
        clientStatus
      });
    }
    
    const duration = Date.now() - startTime;
    logInfo('API', `=== Direct server by ID completed in ${duration}ms ===`);
    
    return res.json({
      success: true,
      data: serverData,
      source,
      clientStatus
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logError('API', `Direct server by ID failed after ${duration}ms: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      clientStatus: getClientStatus()
    });
  }
});

// Route to update server settings
router.put('/:serverId/settings', async (req, res) => {
  try {
    const { serverId } = req.params;
    let settings = req.body;
    
    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'Server ID is required'
      });
    }
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Settings data is required'
      });
    }
    
    logInfo('API', `Updating settings for server ${serverId}: ${JSON.stringify(settings)}`);
    
    try {
      // Update server settings in database
      const result = await ServerSettingsService.updateSettings(serverId, settings);
      
      if (result) {
        logInfo('API', `Successfully updated settings for server ${serverId}`);
        // Get the updated settings to return
        const updatedSettings = await ServerSettingsService.getServerSettings(serverId);
        return res.json({
          success: true,
          data: updatedSettings
        });
      } else {
        logError('API', `Failed to update settings for server ${serverId} - updateSettings returned false`);
        logError('API', `Settings that failed to update: ${JSON.stringify(settings)}`);
        return res.status(500).json({
          success: false,
          error: 'Failed to update server settings - no rows affected'
        });
      }
    } catch (dbError: any) {
      logError('API', `Database error updating settings for server ${serverId}: ${dbError?.message || String(dbError)}`);
      return res.status(500).json({
        success: false,
        error: 'Database error occurred while updating settings'
      });
    }
  } catch (error: any) {
    logError('API', `Error in update server settings endpoint: ${error?.message || String(error)}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
