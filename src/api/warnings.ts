import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { WarningService } from '../database/services/sqliteService';
import { ServerSettingsService } from '../database/services/serverSettingsService';
import { db } from '../database/sqlite'; // Import db directly
import { logInfo, logError } from '../utils/logger';
import { TextChannel, User } from 'discord.js';
import { createModerationEmbed } from '../utils/embeds';
import { logDashboardActivity } from '../middleware/dashboardLogger';
import { DashboardLogsService } from '../database/services/dashboardLogsService';
import { getClient as getDiscordClient, isClientReady } from '../utils/client-utils';

// Helper function to extract user info from request
function extractUserInfo(req: Request): { userId: string; username?: string } | null {
  try {
    // Try to get user info from headers (API key authentication)
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
      return { userId, username: undefined };
    }
    
    // Try to get from JWT token if available
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // For now, just return null since we're using API key auth
      return null;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}
import { getUserName } from './user-helper';
// Removed duplicate import - using getDiscordClient from import above

// Helper function to create enhanced moderator object with actual Discord username
async function createEnhancedModerator(req: Request): Promise<User> {
  const client = getDiscordClient();
  let moderatorUsername = 'Dashboard';
  let actualUserId = req.user?.userId || 'dashboard';
  
  // Try to get the actual Discord username from the authenticated user
  if (req.user?.userId && client) {
    try {
      const actualUsername = await getUserName(client, req.user.userId);
      if (actualUsername && actualUsername !== 'Unknown User' && !actualUsername.startsWith('User ')) {
        moderatorUsername = `Dashboard [${actualUsername}]`;
      }
    } catch (error) {
      // Fallback to just "Dashboard" if we can't get the username
      logError('Warnings API', `Could not get username for dashboard user ${req.user.userId}: ${error}`);
    }
  }
  
  // Create a proper user-like object with toString method
  const userObject = { 
    id: actualUserId,
    username: moderatorUsername,
    tag: `${moderatorUsername}#0000`,
    toString() { return moderatorUsername; }
  };
  
  return userObject as any as User;
}

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

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
    console.log('🔥 WARNINGS ENDPOINT HIT!!! Query:', req.query);
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
      
      // Parse userId parameter properly - handle undefined/empty values
      const userId = req.query.userId as string;
      const cleanUserId = userId && userId !== 'undefined' && userId !== 'null' && userId.trim() !== '' ? userId : undefined;
      
      console.log(`🔍 Getting warnings with params: guildId=${targetGuildId}, userId=${cleanUserId || 'undefined'}, active=${activeParam}`);
      
      const warnings = await WarningService.getWarnings(
        targetGuildId,
        cleanUserId,
        activeParam
      );
      
      console.log(`📊 WarningService returned: ${warnings.data.length} warnings, error: ${warnings.error}`);

      console.log(`📋 Processing ${warnings.data.length} warnings for usernames...`);
      
      // Fetch real usernames for all warnings
      const client = getDiscordClient();
      const warningsWithUsernames = await Promise.all(
        warnings.data.map(async (warning) => {
          // Fetch username for the warned user
          const username = await getUserName(client, warning.user_id);
          
          // Fetch username for the admin/moderator
          const adminUsername = warning.moderator_id === 'dashboard' 
            ? 'Dashboard' 
            : await getUserName(client, warning.moderator_id);
          
          // Get server name if available
          let serverName = 'Unknown Server';
          if (warning.guild_id) {
            try {
              const guild = client?.guilds.cache.get(warning.guild_id);
              if (guild) {
                serverName = guild.name;
              }
            } catch (error) {
              console.log(`Could not fetch guild name for ${warning.guild_id}`);
            }
          }
          
          return {
            ...warning,
            username,
            adminUsername,
            server_name: serverName,
            guild_name: serverName
          };
        })
      );
      
      console.log(`✅ Processed warnings: ${warningsWithUsernames.length}`);

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
      console.error('❌ Database error getting warnings:', dbError);
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
      const client = getDiscordClient();
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
          const client = getDiscordClient();
          if (client && warning.guild_id && warning.user_id) {
            // Try to send DM to the user with consistent moderation embed format
            try {
              const user = await client.users.fetch(warning.user_id);
              const moderator = warning.moderator_id === 'dashboard' 
                ? await createEnhancedModerator(req)
                : await client.users.fetch(warning.moderator_id).catch(() => null);
              
              // Send DM if we have both user and moderator
              if (user && moderator) {
                const userModerationEmbed = createModerationEmbed({
                  action: 'Warning Removed',
                  target: user,
                  moderator: moderator,
                  reason: reason || 'No reason provided',
                  case_number: warning.case_number || warningId,
                  additionalFields: [
                    { name: 'Warning ID', value: `${warningId}`, inline: true },
                    { name: 'Removed Via', value: 'Dashboard', inline: true },
                    { name: 'Original Case #', value: warning.case_number ? `#${String(warning.case_number).padStart(4, '0')}` : `#${String(warningId).padStart(4, '0')}`, inline: true }
                  ]
                });
                
                await user.send({ embeds: [userModerationEmbed] }).catch(() => {
                  // Silently fail if DM can't be sent
                  logInfo('API', `Could not send DM to user ${warning.user_id} about warning removal`);
                });
              }
            } catch (dmError) {
              // Silently fail if user can't be fetched or DM can't be sent
              logInfo('API', `Error sending DM about warning removal: ${dmError}`);
            }
            
            // Use centralized logger with proper fallback
            try {
              const guild = await client.guilds.fetch(warning.guild_id);
              if (guild) {
                const moderator = warning.moderator_id === 'dashboard' 
                  ? await createEnhancedModerator(req)
                  : await client.users.fetch(warning.moderator_id).catch(() => null);
                const targetUser = await client.users.fetch(warning.user_id).catch(() => null);
                
                // Log to moderation channel if we have both user and moderator
                if (targetUser && moderator) {
                  // Import the centralized logger
                  const { logModeration } = await import('../utils/logger');
                  
                  await logModeration({
                    guild: guild,
                    action: 'Warning Removed',
                    target: targetUser,
                    moderator: moderator,
                    reason: reason || 'No reason provided',
                    caseNumber: warning.case_number || warningId,
                    additionalInfo: `Warning ID: ${warningId} | Removed Via: Dashboard | Original Case: #${warning.case_number ? String(warning.case_number).padStart(4, '0') : String(warningId).padStart(4, '0')}`
                  });
                }
              }
            } catch (logError) {
              logInfo('API', `Error logging warning removal: ${logError}`);
            }
          }
        } catch (discordError) {
          logError('API', `Error with Discord client during warning removal: ${discordError}`);
          // Continue with the API response even if Discord notification fails
        }
        
        // Enhanced dashboard activity logging with Discord usernames
        try {
          // Get admin username from Discord
          let adminUsername = 'Unknown Admin';
          const adminUserId = req.user?.userId;
          if (adminUserId) {
            try {
              const client = getDiscordClient();
              if (client && isClientReady()) {
                const adminUser = await client.users.fetch(adminUserId).catch(() => null);
                if (adminUser) {
                  adminUsername = adminUser.username;
                }
              }
            } catch (fetchError) {
              adminUsername = req.user?.username || `Admin ${adminUserId.slice(-4)}`;
            }
          }

          // Get target user info for better logging
          let targetUsername = 'Unknown User';
          try {
            const client = getDiscordClient();
            if (client && isClientReady() && warning.user_id) {
              const targetUser = await client.users.fetch(warning.user_id).catch(() => null);
              if (targetUser) {
                targetUsername = targetUser.username;
              }
            }
          } catch (error) {
            targetUsername = `User ${warning.user_id?.slice(-4) || 'Unknown'}`;
          }

          await DashboardLogsService.logActivity({
            user_id: adminUserId || 'unknown',
            username: adminUsername,
            action_type: 'warning_removal',
            page: 'warnings',
            target_type: 'warning',
            target_id: warningId.toString(),
            old_value: JSON.stringify({ active: true, reason: warning.reason }),
            new_value: JSON.stringify({ active: false, removal_reason: reason }),
            details: `⚠️ Warning Removal: ${adminUsername} removed warning #${warningId} from ${targetUsername} (${warning.user_id}).\n📝 Removal Reason: ${reason || 'No reason provided'}\n🏷️ Original Warning: ${warning.reason || 'No reason provided'}`,
            success: true,
            guild_id: warning?.guild_id || 'unknown'
          });
        } catch (logErr) {
          logError('API', `Error logging warning removal activity: ${logErr}`);
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

// TEST ROUTE - to verify router is working
router.get('/test', (req, res) => {
  console.log('🔥 TEST ROUTE HIT - warnings router is working!');
  res.json({ message: 'Warnings router test successful!' });
});

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
        const client = getDiscordClient();
        if (client && warning && warning.guild_id) {
          // Use centralized logger with proper fallback
          try {
            const guild = await client.guilds.fetch(warning.guild_id);
            if (guild) {
              const moderator = warning.moderator_id === 'dashboard' 
                ? await createEnhancedModerator(req)
                : await client.users.fetch(warning.moderator_id).catch(() => null);
              const targetUser = await client.users.fetch(warning.user_id).catch(() => null);
              
              // Log to moderation channel if we have both user and moderator
              if (targetUser && moderator) {
                // Import the centralized logger
                const { logModeration } = await import('../utils/logger');
                
                await logModeration({
                  guild: guild,
                  action: 'Warning Removed',
                  target: targetUser,
                  moderator: moderator,
                  reason: req.body.reason || 'No reason provided',
                  caseNumber: warning.case_number || warningId,
                  additionalInfo: `Warning ID: ${warningId} | Removed Via: Dashboard | Original Case: #${warning.case_number ? String(warning.case_number).padStart(4, '0') : String(warningId).padStart(4, '0')}`
                });
              }
            }
          } catch (logError) {
            logInfo('API', `Error logging warning removal: ${logError}`);
          }
        }
      } catch (discordError) {
        logError('API', `Error with Discord client during warning removal: ${discordError}`);
        // Continue with the API response even if Discord notification fails
      }
      
      // Log the dashboard activity
      try {
        const userInfo = extractUserInfo(req);
        if (userInfo?.userId) {
          await logDashboardActivity(
            userInfo.userId,
            'delete_warning',
            'warnings',
            `Deleted warning ID ${warningId} via DELETE endpoint`,
            {
              target_type: 'warning',
              target_id: warningId.toString(),
              guild_id: warning?.guild_id || null,
              username: userInfo.username,
              success: 1
            }
          );
        }
      } catch (logErr) {
        logError('API', `Error logging warning deletion activity: ${logErr}`);
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
