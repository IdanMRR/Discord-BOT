import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { WarningService } from '../database/services/sqliteService';
import { ServerSettingsService } from '../database/services/serverSettingsService';
import { db } from '../database/sqlite'; // Import db directly
import { logInfo, logError } from '../utils/logger';
import { TextChannel } from 'discord.js';
import { createModerationEmbed } from '../utils/embeds';
const { getUserName } = require('./user-helper');
const { getClient } = require('../utils/client-utils');

const router = express.Router();

// Define custom response type
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: any;
}

// Helper function to send JSON responses
const sendJsonResponse = <T>(
  res: Response,
  statusCode: number,
  data: T
): void => {
  res.status(statusCode).json(data);
};

// JSON parsing error handler middleware
router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    // Handle JSON parsing errors
    return sendJsonResponse(res, 400, {
      success: false,
      error: 'Invalid JSON format'
    });
  }
  next(err);
});

// Middleware to ensure request body is parsed correctly
router.use((req: Request, res: Response, next: NextFunction) => {
  // If the request has a body but it's not parsed, try to parse it as JSON
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!req.body || Object.keys(req.body).length === 0) {
      req.body = {}; // Initialize empty body if none exists
    }
  }
  next();
});

// Get warnings for a guild or all guilds
const getWarnings: express.RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use guildId if provided, otherwise get warnings from all guilds
    const targetGuildId = req.query.guildId ? req.query.guildId as string : null;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    try {
      // Get warnings from database
      // Parse the active parameter correctly - default to showing all warnings
      let activeParam: boolean | undefined = undefined;
      if (req.query.status === 'active') {
        activeParam = true;
      } else if (req.query.status === 'removed') {
        activeParam = false;
      }
      // If no status specified, get all warnings (both active and removed)
      
      const warnings = await WarningService.getWarnings(
        targetGuildId,
        req.query.userId as string,
        activeParam
      );

      // Fetch usernames, admin usernames, and server names for warnings
      const warningsWithUsernames = await Promise.all(warnings.data.map(async (warning) => {
        const client = await getClient();
        const username = await getUserName(client, warning.user_id);
        
        // Get admin username if moderator_id exists
        let adminUsername = 'Unknown Admin';
        if (warning.moderator_id) {
          adminUsername = await getUserName(client, warning.moderator_id);
        }
        
        // Get server name
        let serverName = 'Unknown Server';
        try {
          const guild = client?.guilds?.cache?.get(warning.guild_id);
          if (guild) {
            serverName = guild.name;
          }
        } catch (error) {
          logError('API', `Error getting guild name for ${warning.guild_id}: ${error}`);
        }
        
        return { 
          ...warning, 
          username,
          adminUsername,
          server_name: serverName,
          guild_name: serverName
        };
      }));

      // Return warnings with pagination info
      sendJsonResponse(res, 200, {
        success: true,
        data: warningsWithUsernames,
        pagination: {
          total: warnings.data?.length || 0,
          page,
          limit,
          pages: Math.ceil((warnings.data?.length || 0) / limit)
        }
      });
    } catch (dbError) {
      logError('API', `Database error getting warnings: ${dbError}`);
      
      // Return empty data with success to prevent dashboard from breaking
      sendJsonResponse(res, 200, {
        success: true,
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          pages: 0
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

// Get a specific warning by ID
const getWarningById: express.RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // First, validate the ID
    const warningId = parseInt(id);
    if (isNaN(warningId)) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Invalid warning ID format'
      });
      return;
    }

    try {
      // Get all warnings and find the one with the matching ID
      const allWarnings = await WarningService.getWarnings(null as unknown as string);
      const warning = allWarnings.data.find(w => w.id === warningId);
      
      if (!warning) {
        sendJsonResponse(res, 404, {
          success: false,
          error: 'Warning not found'
        });
        return;
      }

      // Fetch username for warning
      const client = await getClient();
      const username = await getUserName(client, warning.user_id);
      const warningWithUsername = { ...warning, username };

      sendJsonResponse(res, 200, {
        success: true,
        data: warningWithUsername
      });
    } catch (dbError) {
      logError('API', `Database error getting warning: ${dbError}`);
      sendJsonResponse(res, 200, {
        success: true,
        data: null
      });
    }
  } catch (error) {
    next(error);
  }
};

// Remove a warning by ID
const removeWarning: express.RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    let { reason } = req.body;
    
    // Handle empty or malformed request body
    if (!req.body || typeof req.body !== 'object') {
      reason = 'Removed via Dashboard';
    }
    
    // First, validate the ID
    const warningId = parseInt(id);
    if (isNaN(warningId)) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Invalid warning ID format'
      });
      return;
    }

    try {
      // Get the warning directly by ID to verify it exists
      const getWarningQuery = `SELECT * FROM warnings WHERE id = ?`;
      const getWarningStmt = db.prepare(getWarningQuery);
      const warning: any = getWarningStmt.get(warningId);
      
      if (!warning) {
        sendJsonResponse(res, 404, {
          success: false,
          error: 'Warning not found'
        });
        return;
      }

      // Check if warning is already removed
      if (!warning.active) {
        sendJsonResponse(res, 400, {
          success: false,
          error: 'Warning is already removed'
        });
        return;
      }

      // Update the warning to mark it as removed
      const updateQuery = `
        UPDATE warnings 
        SET active = 0, 
            removed_at = CURRENT_TIMESTAMP, 
            removed_by = 'Dashboard', 
            removal_reason = ? 
        WHERE id = ?
      `;
      
      const updateStmt = db.prepare(updateQuery);
      const result = updateStmt.run(reason || 'Removed via Dashboard', warningId);
      
      if (result.changes > 0) {
        logInfo('API', `Warning ID ${warningId} removed via API. Reason: ${reason || 'Not specified'}`);
        
        // Send notification in Discord if possible
        try {
          const client = getClient();
          if (client && warning.guild_id && warning.user_id) {
            // Try to send DM to the user
            try {
              const user = await client.users.fetch(warning.user_id);
              if (user) {
                const embed = {
                  color: 0x00ff00, // Green color
                  title: '⚠️ Warning Removed',
                  description: `A warning has been removed from your record.${reason ? `\n**Reason:** ${reason}` : ''}`,
                  footer: {
                    text: `Warning ID: ${warningId}`
                  },
                  timestamp: new Date().toISOString()
                };
                
                await user.send({ embeds: [embed] }).catch(() => {
                  // Silently fail if DM can't be sent
                  logInfo('API', `Could not send DM to user ${warning.user_id} about warning removal`);
                });
              }
            } catch (dmError) {
              // Silently fail if user can't be fetched or DM can't be sent
              logInfo('API', `Error sending DM about warning removal: ${dmError}`);
            }
            
            // Log the warning removal to the member's log channel
            try {
              const guild = await client.guilds.fetch(warning.guild_id);
              if (guild) {
                // Get the server settings to find the member log channel
                const serverSettings = await ServerSettingsService.getOrCreate(warning.guild_id, guild.name);
                
                if (serverSettings && serverSettings.member_log_channel_id) {
                  const memberLogChannel = await guild.channels.fetch(serverSettings.member_log_channel_id) as TextChannel;
                  
                  if (memberLogChannel && memberLogChannel.isTextBased()) {
                    // Create a moderation embed for the log
                    const moderator = await client.users.fetch(warning.moderator_id).catch(() => null);
                    const targetUser = await client.users.fetch(warning.user_id).catch(() => null);
                    
                    const logEmbed = createModerationEmbed({
                      action: 'Warning Removed',
                      target: targetUser,
                      moderator: moderator,
                      reason: reason || 'No reason provided',
                      caseNumber: warning.case_number || warningId,
                      additionalFields: [
                        { name: 'Warning ID', value: `${warningId}`, inline: true },
                        { name: 'Removed Via', value: 'Dashboard', inline: true },
                        { name: 'Original Case #', value: warning.case_number ? `#${String(warning.case_number).padStart(4, '0')}` : `#${String(warningId).padStart(4, '0')}`, inline: true }
                      ]
                    });
                    
                    await memberLogChannel.send({ embeds: [logEmbed] });
                    logInfo('API', `Logged warning removal to member log channel ${memberLogChannel.id}`);
                  }
                }
              }
            } catch (logError) {
              // Silently fail if logging to the channel fails
              logInfo('API', `Error logging warning removal to member log channel: ${logError}`);
            }
          }
        } catch (discordError) {
          logError('API', `Error with Discord client during warning removal: ${discordError}`);
          // Continue with the API response even if Discord notification fails
        }
        
        sendJsonResponse(res, 200, {
          success: true,
          message: 'Warning removed successfully'
        });
      } else {
        sendJsonResponse(res, 500, {
          success: false,
          error: 'Failed to remove warning'
        });
      }
    } catch (dbError) {
      logError('API', `Database error removing warning: ${dbError}`);
      sendJsonResponse(res, 500, {
        success: false,
        error: 'Error removing warning'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Register route handlers - removing authentication for dashboard access
router.get('/', getWarnings);
router.get('/:id', getWarningById);

// Add direct endpoint for removing warnings
router.post('/:id/remove', removeWarning);
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const warningId = parseInt(id);
    
    if (isNaN(warningId)) {
      return sendJsonResponse(res, 400, {
        success: false,
        error: 'Invalid warning ID format'
      });
    }
    
    // Update the warning to mark it as removed
    const updateQuery = `
      UPDATE warnings 
      SET active = 0, 
          removed_at = CURRENT_TIMESTAMP, 
          removed_by = 'Dashboard', 
          removal_reason = 'Removed via Dashboard' 
      WHERE id = ?
    `;
    
    const updateStmt = db.prepare(updateQuery);
    const result = updateStmt.run(warningId);
    
    if (result.changes > 0) {
      logInfo('API', `Warning ID ${warningId} removed via API DELETE endpoint`);
      
      // Get the warning details to include in the log
      const getWarningQuery = `SELECT * FROM warnings WHERE id = ?`;
      const getWarningStmt = db.prepare(getWarningQuery);
      const warning: any = getWarningStmt.get(warningId); // Use any type to avoid TypeScript errors
      
      // Send notification in Discord if possible
      try {
        const client = getClient();
        if (client && warning && warning.guild_id) {
          // Log the warning removal to the member's log channel
          try {
            const guild = await client.guilds.fetch(warning.guild_id);
            if (guild) {
              // Get the server settings to find the member log channel
              const serverSettings = await ServerSettingsService.getOrCreate(warning.guild_id, guild.name);
              
              if (serverSettings && serverSettings.member_log_channel_id) {
                const memberLogChannel = await guild.channels.fetch(serverSettings.member_log_channel_id) as TextChannel;
                
                if (memberLogChannel && memberLogChannel.isTextBased()) {
                  // Create a moderation embed for the log
                  const moderator = await client.users.fetch(warning.moderator_id).catch(() => null);
                  const targetUser = await client.users.fetch(warning.user_id).catch(() => null);
                  
                  const logEmbed = createModerationEmbed({
                    action: 'Warning Removed',
                    target: targetUser,
                    moderator: moderator,
                    reason: req.body.reason || 'No reason provided',
                    caseNumber: warning.case_number || warningId,
                    additionalFields: [
                      { name: 'Warning ID', value: `${warningId}`, inline: true },
                      { name: 'Removed Via', value: 'Dashboard', inline: true },
                      { name: 'Original Case #', value: warning.case_number ? `#${String(warning.case_number).padStart(4, '0')}` : `#${String(warningId).padStart(4, '0')}`, inline: true }
                    ]
                  });
                  
                  await memberLogChannel.send({ embeds: [logEmbed] });
                  logInfo('API', `Logged warning removal to member log channel ${memberLogChannel.id}`);
                }
              }
            }
          } catch (logError) {
            // Silently fail if logging to the channel fails
            logInfo('API', `Error logging warning removal to member log channel: ${logError}`);
          }
        }
      } catch (discordError) {
        logError('API', `Error with Discord client during warning removal: ${discordError}`);
        // Continue with the API response even if Discord notification fails
      }
      
      return sendJsonResponse(res, 200, {
        success: true,
        message: 'Warning removed successfully'
      });
    } else {
      return sendJsonResponse(res, 404, {
        success: false,
        error: 'Warning not found or already removed'
      });
    }
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error in warnings API:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default router;
