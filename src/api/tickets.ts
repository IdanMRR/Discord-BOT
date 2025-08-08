import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { TicketService } from '../database/services/sqliteService';
import { db } from '../database/sqlite'; // Import db directly
import { logInfo, logError } from '../utils/logger';
import { validateTicketAction, sendTicketNotification } from './ticket-handlers';
import { TicketTranscriptService } from '../database/services/ticketTranscriptService';
import { storeTicketTranscript, createTextTranscript } from '../utils/transcript-utils';
import { regenerateMissingTranscripts, getTranscriptStats } from '../utils/transcript-management';
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
const { getUserName } = require('./user-helper');
// Removed duplicate import - using getDiscordClient from import above

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

// Get all tickets for a guild or all guilds
const getTickets: express.RequestHandler = async (req, res, next) => {
  try {
    const { guildId } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const status = req.query.status as string;
    
    logInfo('Tickets API', `Request params: guildId=${guildId}, page=${page}, limit=${limit}, status=${status}`);
    
    // Check if user has server permissions
    if (!req.user?.serverPermissions) {
      sendJsonResponse(res, 403, {
        success: false,
        error: 'No server permissions found'
      });
      return;
    }
    
    // Get accessible server IDs
    const accessibleServerIds = Object.keys(req.user.serverPermissions);
    
    if (accessibleServerIds.length === 0) {
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
      return;
    }
    
    // If guildId is specified, check if user has access to that server
    let targetGuildId: string | null = null;
    if (guildId) {
      if (!accessibleServerIds.includes(guildId as string)) {
        logError('Tickets API', `User doesn't have access to server ${guildId}. Accessible servers: ${accessibleServerIds.join(', ')}`);
        sendJsonResponse(res, 403, {
          success: false,
          error: 'No permission to access this server'
        });
        return;
      }
      targetGuildId = guildId as string;
      logInfo('Tickets API', `Filtering tickets for specific server: ${targetGuildId}`);
    } else {
      logInfo('Tickets API', `No guildId specified, showing tickets from all accessible servers: ${accessibleServerIds.join(', ')}`);
    }

    try {
      // Get tickets from database
      const tickets = await TicketService.getTickets(
        targetGuildId,
        status,
        req.query.userId as string
      );

      logInfo('Tickets API', `TicketService returned ${tickets.data.length} tickets`);
      
      // Filter tickets to only include those from accessible servers
      const filteredTickets = tickets.data.filter(ticket => 
        accessibleServerIds.includes(ticket.guild_id)
      );
      
      logInfo('Tickets API', `After accessibility filter: ${filteredTickets.length} tickets`);
      
      // Log first few ticket guild_ids for debugging
      if (filteredTickets.length > 0) {
        const guildIds = [...new Set(filteredTickets.map(t => t.guild_id))];
        logInfo('Tickets API', `Tickets from servers: ${guildIds.join(', ')}`);
      }

      // Fetch usernames and server names for tickets
      const ticketsWithUsernames = await Promise.all(filteredTickets.map(async (ticket) => {
        const client = await getDiscordClient();
        const username = await getUserName(client, ticket.user_id);
        
        // Get server name
        let serverName = 'Unknown Server';
        try {
          const guild = client?.guilds?.cache?.get(ticket.guild_id);
          if (guild) {
            serverName = guild.name;
            logInfo('API', `Found guild name for ${ticket.guild_id}: ${serverName}`);
          } else {
            logInfo('API', `Guild not found in cache for ${ticket.guild_id}`);
          }
        } catch (error) {
          logError('API', `Error getting guild name for ${ticket.guild_id}: ${error}`);
        }
        
        return { ...ticket, username, server_name: serverName, guild_name: serverName };
      }));

      // Return tickets with pagination info
      sendJsonResponse(res, 200, {
        success: true,
        data: ticketsWithUsernames || [],
        pagination: {
          total: ticketsWithUsernames?.length || 0,
          page,
          limit,
          pages: Math.ceil((ticketsWithUsernames?.length || 0) / limit)
        }
      });
    } catch (dbError) {
      logError('API', `Database error getting tickets: ${dbError}`);
      
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

// Get a specific ticket by ID
const getTicketById: express.RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // First, validate the ID
    const ticketId = parseInt(id);
    if (isNaN(ticketId)) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Invalid ticket ID format'
      });
      return;
    }

    try {
      // Get all tickets and find the one with the matching ID
      const allTickets = await TicketService.getTickets(null as unknown as string);
      const ticket = allTickets.data.find(t => t.id === ticketId);
      
      if (!ticket) {
        sendJsonResponse(res, 404, {
          success: false,
          error: 'Ticket not found'
        });
        return;
      }
      
      // Fetch username for ticket
      const client = await getDiscordClient();
      const username = await getUserName(client, ticket.user_id);
      const ticketWithUsername = { ...ticket, username };

      sendJsonResponse(res, 200, {
        success: true,
        data: ticketWithUsername
      });
    } catch (dbError) {
      logError('API', `Database error getting ticket: ${dbError}`);
      sendJsonResponse(res, 200, {
        success: true,
        data: null
      });
    }
  } catch (error) {
    next(error);
  }
};

// Close a ticket by ID
const closeTicket: express.RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const { reason } = req.body;
    
    if (isNaN(ticketId)) {
      sendJsonResponse(res, 400, { success: false, error: 'Invalid ticket ID' });
      return;
    }
    
    try {
      // Validate the ticket action
      const validation = await validateTicketAction(ticketId);
      
      if (!validation.success) {
        sendJsonResponse(res, validation.status, { success: false, error: validation.error });
        return;
      }
      
      const ticket = validation.ticket;
      
      // Store the transcript before closing the ticket
      // Just store in database, don't send to user yet (will be handled by notification)
      await storeTicketTranscript(ticketId, ticket.channel_id);
      
      // Use direct database query to update the ticket by ID
      const updateStmt = db.prepare(`
        UPDATE tickets 
        SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ?
        WHERE id = ?
      `);
      
      const result = updateStmt.run('API Request', ticketId);
      
      if (result.changes > 0) {
        logInfo('API', `Closed ticket #${ticket.ticket_number} via API request`);
        
        // Get admin username - prioritize dashboard username, fallback to Discord username
        let adminUsername = 'Unknown Admin';
        const adminUserId = req.user?.userId;
        
        if (req.user?.username) {
          // Use dashboard username if available
          adminUsername = req.user.username;
        } else if (adminUserId) {
          // Fallback to Discord username
          try {
            const client = getDiscordClient();
            if (client && isClientReady()) {
              const adminUser = await client.users.fetch(adminUserId).catch(() => null);
              if (adminUser) {
                adminUsername = adminUser.username;
              }
            }
          } catch (fetchError) {
            adminUsername = `Admin ${adminUserId.slice(-4)}`;
          }
        }
        
        // Enhanced dashboard activity logging
        try {

          await DashboardLogsService.logActivity({
            user_id: adminUserId || 'unknown',
            username: adminUsername,
            action_type: 'ticket_close',
            page: 'tickets',
            target_type: 'ticket',
            target_id: ticketId.toString(),
            old_value: JSON.stringify({ status: 'open' }),
            new_value: JSON.stringify({ status: 'closed', reason: reason }),
            details: `🎫 Ticket Closed: ${adminUsername} closed ticket #${ticket.ticket_number}.\n📝 Reason: ${reason || 'No reason provided'}\n🏷️ Ticket ID: ${ticketId}`,
            success: true,
            guild_id: ticket.guild_id
          });
        } catch (logErr) {
          logError('API', `Error logging ticket close activity: ${logErr}`);
        }
        
        // Get the user who closed the ticket
        const closedByInfo = { 
          id: req.user?.userId, 
          username: adminUsername || 'Unknown Admin' 
        };
        
        // Send notification in Discord channel and log channel
        await sendTicketNotification(ticket, 'closed', reason, closedByInfo);
        
        sendJsonResponse(res, 200, { success: true, message: 'Ticket closed successfully' });
      } else {
        // If no rows were updated, the ticket wasn't found
        sendJsonResponse(res, 404, { success: false, error: 'Ticket not found or could not be closed' });
      }
    } catch (dbError) {
      logError('API', `Database error closing ticket: ${dbError}`);
      sendJsonResponse(res, 500, { success: false, error: 'Error closing ticket' });
    }
  } catch (error) {
    next(error);
  }
};

// Reopen a ticket by ID
const reopenTicket: express.RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const { reason } = req.body;
    
    if (isNaN(ticketId)) {
      sendJsonResponse(res, 400, { success: false, error: 'Invalid ticket ID' });
      return;
    }
    
    try {
      // Validate the ticket action
      const validation = await validateTicketAction(ticketId);
      
      if (!validation.success) {
        sendJsonResponse(res, validation.status, { success: false, error: validation.error });
        return;
      }
      
      const ticket = validation.ticket;
      
      // Update the ticket status directly
      const updateStmt = db.prepare(`
        UPDATE tickets 
        SET status = 'open' 
        WHERE id = ?
      `);
      
      const result = updateStmt.run(ticketId);
      
      if (result.changes > 0) {
        // Log the action
        logInfo('API', `Ticket #${ticket.ticket_number} reopened via API. Reason: ${reason || 'Not specified'}`);
        
        // Get admin username - prioritize dashboard username, fallback to Discord username
        let adminUsername = 'Unknown Admin';
        const adminUserId = req.user?.userId;
        
        if (req.user?.username) {
          // Use dashboard username if available
          adminUsername = req.user.username;
        } else if (adminUserId) {
          // Fallback to Discord username
          try {
            const client = getDiscordClient();
            if (client && isClientReady()) {
              const adminUser = await client.users.fetch(adminUserId).catch(() => null);
              if (adminUser) {
                adminUsername = adminUser.username;
              }
            }
          } catch (fetchError) {
            adminUsername = `Admin ${adminUserId.slice(-4)}`;
          }
        }
        
        // Enhanced dashboard activity logging
        try {

          await DashboardLogsService.logActivity({
            user_id: adminUserId || 'unknown',
            username: adminUsername,
            action_type: 'ticket_reopen',
            page: 'tickets',
            target_type: 'ticket',
            target_id: ticketId.toString(),
            old_value: JSON.stringify({ status: 'closed' }),
            new_value: JSON.stringify({ status: 'open', reason: reason }),
            details: `🎫 Ticket Reopened: ${adminUsername} reopened ticket #${ticket.ticket_number}.\n📝 Reason: ${reason || 'No reason provided'}\n🏷️ Ticket ID: ${ticketId}`,
            success: true,
            guild_id: ticket.guild_id
          });
        } catch (logErr) {
          logError('API', `Error logging ticket reopen activity: ${logErr}`);
        }
        
        // Get the user who reopened the ticket
        const reopenedByInfo = { 
          id: req.user?.userId, 
          username: adminUsername || 'Unknown Admin' 
        };
        
        // Send notification in Discord channel and log channel
        await sendTicketNotification(ticket, 'reopened', reason, reopenedByInfo);
        
        // Return success response
        sendJsonResponse(res, 200, { success: true, message: 'Ticket reopened successfully' });
      } else {
        sendJsonResponse(res, 404, { success: false, error: 'Ticket not found or could not be reopened' });
      }
    } catch (dbError) {
      logError('API', `Database error reopening ticket: ${dbError}`);
      sendJsonResponse(res, 500, { success: false, error: 'Error reopening ticket' });
    }
  } catch (error) {
    next(error);
  }
};

// Delete a ticket by ID
const deleteTicket: express.RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const { reason } = req.body;
    
    if (isNaN(ticketId)) {
      sendJsonResponse(res, 400, { success: false, error: 'Invalid ticket ID' });
      return;
    }
    
    try {
      // Validate the ticket action
      const validation = await validateTicketAction(ticketId);
      
      if (!validation.success) {
        sendJsonResponse(res, validation.status, { success: false, error: validation.error });
        return;
      }
      
      const ticket = validation.ticket;
      
      // Store the transcript in the database without sending to user
      try {
        await storeTicketTranscript(ticketId, ticket.channel_id, false);
      } catch (transcriptError) {
        logError('API', `Error storing transcript: ${transcriptError}`);
        // Continue with deletion even if transcript storage fails
      }
      
      // First, try to delete the Discord channel if it exists
      try {
        const client = getDiscordClient();
        if (client && ticket.channel_id) {
          try {
            const channel = await client.channels.fetch(ticket.channel_id);
            if (channel && 'delete' in channel) {
              await channel.delete(`Ticket #${ticket.ticket_number} deleted via dashboard`);
              logInfo('API', `Deleted Discord channel ${ticket.channel_id} for ticket #${ticket.ticket_number}`);
            }
          } catch (err) {
            const channelError = err as { code?: number; message?: string };
            // If we can't find the channel, it might already be deleted
            if (channelError.code === 10003) { // Unknown Channel
              logInfo('API', `Channel ${ticket.channel_id} not found, may have been already deleted`);
            } else {
              logError('API', `Error deleting channel ${ticket.channel_id}: ${channelError.message || 'Unknown error'}`);
            }
          }
        }
      } catch (error) {
        logError('API', `Error in channel deletion process: ${error}`);
        // Continue with ticket deletion even if channel deletion fails
      }
      
      // Use direct database query to update the ticket status to 'deleted'
      const updateStmt = db.prepare(`
        UPDATE tickets 
        SET status = 'deleted', closed_at = CURRENT_TIMESTAMP, closed_by = ?
        WHERE id = ?
      `);
      
      const result = updateStmt.run('API Request', ticketId);
      
      if (result.changes > 0) {
        logInfo('API', `Deleted ticket #${ticket.ticket_number} via API request`);
        
        // Get admin username - prioritize dashboard username, fallback to Discord username
        let adminUsername = 'Unknown Admin';
        const adminUserId = req.user?.userId;
        
        if (req.user?.username) {
          // Use dashboard username if available
          adminUsername = req.user.username;
        } else if (adminUserId) {
          // Fallback to Discord username
          try {
            const client = getDiscordClient();
            if (client && isClientReady()) {
              const adminUser = await client.users.fetch(adminUserId).catch(() => null);
              if (adminUser) {
                adminUsername = adminUser.username;
              }
            }
          } catch (fetchError) {
            adminUsername = `Admin ${adminUserId.slice(-4)}`;
          }
        }
        
        // Enhanced dashboard activity logging
        try {

          await DashboardLogsService.logActivity({
            user_id: adminUserId || 'unknown',
            username: adminUsername,
            action_type: 'ticket_delete',
            page: 'tickets',
            target_type: 'ticket',
            target_id: ticketId.toString(),
            old_value: JSON.stringify({ status: ticket.status, deleted: false }),
            new_value: JSON.stringify({ status: ticket.status, deleted: true, reason: reason }),
            details: `🗑️ Ticket Deleted: ${adminUsername} deleted ticket #${ticket.ticket_number}.\n📝 Reason: ${reason || 'No reason provided'}\n🏷️ Ticket ID: ${ticketId}\n⚠️ This action is permanent and cannot be undone`,
            success: true,
            guild_id: ticket.guild_id
          });
        } catch (logErr) {
          logError('API', `Error logging ticket delete activity: ${logErr}`);
        }
        
        // Get the user who deleted the ticket
        const deletedByInfo = { 
          id: req.user?.userId, 
          username: adminUsername || 'Unknown Admin' 
        };
        
        // Send notification in log channel (don't try to send to the ticket channel as it's being deleted)
        await sendTicketNotification(ticket, 'deleted', reason, deletedByInfo);
        
        sendJsonResponse(res, 200, { success: true });
      } else {
        sendJsonResponse(res, 404, { success: false, error: 'Ticket not found or already deleted' });
      }
    } catch (dbError) {
      logError('API', `Database error deleting ticket: ${dbError}`);
      sendJsonResponse(res, 500, { success: false, error: 'Database error' });
    }
  } catch (error) {
    next(error);
  }
};

// Get ticket transcript by ID
const getTicketTranscript: express.RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    
    if (isNaN(ticketId)) {
      sendJsonResponse(res, 400, { success: false, error: 'Invalid ticket ID' });
      return;
    }
    
    try {
      // Get the ticket directly from the database
      const ticketQuery = db.prepare('SELECT * FROM tickets WHERE id = ?');
      const ticket = ticketQuery.get(ticketId) as any;
      
      if (!ticket) {
        sendJsonResponse(res, 404, { success: false, error: 'Ticket not found' });
        return;
      }
      
      // First check if we have a stored transcript in the database
      const storedTranscript = await TicketTranscriptService.getTranscript(ticketId);
      
      if (storedTranscript && storedTranscript.transcript) {
        logInfo('API', `Retrieved stored transcript for ticket #${ticket.ticket_number}`);
        sendJsonResponse(res, 200, {
          success: true,
          data: {
            ticket,
            transcript: storedTranscript.transcript
          }
        });
        return;
      }
      
      // If no stored transcript, try to fetch from Discord
      const client = getDiscordClient();
      if (!client) {
        sendJsonResponse(res, 503, { success: false, error: 'Discord client not available' });
        return;
      }
      
      try {
        // Try to fetch the channel
        const channel = await client.channels.fetch(ticket.channel_id);
        
        if (!channel || !channel.isTextBased()) {
          // Channel doesn't exist, create a placeholder transcript
          const placeholderTranscript = [{
            id: 'placeholder',
            author: {
              id: 'system',
              username: 'System',
              bot: true
            },
            content: 'This ticket channel no longer exists. The transcript is not available.',
            timestamp: new Date(),
            attachments: [],
            embeds: []
          }];
          
          sendJsonResponse(res, 200, {
            success: true,
            data: {
              ticket,
              transcript: placeholderTranscript
            }
          });
          return;
        }
        
        // Fetch the messages from the channel (limited to 100 most recent)
        const messages = await (channel as any).messages.fetch({ limit: 100 });
        
        // Format the messages into a transcript
        const transcript = Array.from(messages.values())
          .reverse() // Show oldest messages first
          .map((msg: any) => ({
            id: msg.id,
            author: {
              id: msg.author.id,
              username: msg.author.username,
              bot: msg.author.bot
            },
            content: msg.content,
            timestamp: msg.createdAt,
            attachments: Array.from(msg.attachments.values()).map((att: any) => ({
              url: att.url,
              name: att.name,
              contentType: att.contentType
            })),
            embeds: msg.embeds.map((embed: any) => ({
              title: embed.title,
              description: embed.description,
              color: embed.color,
              fields: embed.fields
            }))
          }));
        
        // Store the transcript in the database for future use
        await TicketTranscriptService.saveTranscript(ticketId, transcript);
        
        sendJsonResponse(res, 200, {
          success: true,
          data: {
            ticket,
            transcript
          }
        });
      } catch (discordError: any) {
        // Only log as error if it's not a "channel not found" error
        if (discordError.code === 10003) {
          logInfo('API', `Channel ${ticket.channel_id} for ticket #${ticket.ticket_number} no longer exists - using placeholder transcript`);
        } else {
          logError('API', `Error fetching ticket transcript from Discord: ${discordError}`);
        }
        
        // If Discord fetch fails, return a placeholder transcript
        const placeholderTranscript = [{
          id: 'placeholder',
          author: {
            id: 'system',
            username: 'System',
            bot: true
          },
          content: 'This ticket channel no longer exists. The transcript was not saved when the ticket was closed.',
          timestamp: new Date(),
          attachments: [],
          embeds: []
        }];
        
        sendJsonResponse(res, 200, {
          success: true,
          data: {
            ticket,
            transcript: placeholderTranscript
          }
        });
      }
    } catch (dbError) {
      logError('API', `Database error getting ticket transcript: ${dbError}`);
      sendJsonResponse(res, 500, { success: false, error: 'Error getting ticket transcript' });
    }
  } catch (error) {
    next(error);
  }
};

// Create a new endpoint to manually store a transcript
const storeTranscript: express.RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id);
    
    if (isNaN(ticketId)) {
      sendJsonResponse(res, 400, { success: false, error: 'Invalid ticket ID' });
      return;
    }
    
    try {
      // Get the ticket directly from the database
      const ticketQuery = db.prepare('SELECT * FROM tickets WHERE id = ?');
      const ticket = ticketQuery.get(ticketId) as any;
      
      if (!ticket) {
        sendJsonResponse(res, 404, { success: false, error: 'Ticket not found' });
        return;
      }
      
      // Store the transcript
      const success = await storeTicketTranscript(ticketId, ticket.channel_id);
      
      if (success) {
        sendJsonResponse(res, 200, { 
          success: true, 
          message: `Transcript for ticket #${ticket.ticket_number} stored successfully` 
        });
      } else {
        sendJsonResponse(res, 500, { 
          success: false, 
          error: 'Failed to store transcript' 
        });
      }
    } catch (error) {
      logError('API', `Error storing transcript: ${error}`);
      sendJsonResponse(res, 500, { success: false, error: 'Error storing transcript' });
    }
  } catch (error) {
    next(error);
  }
};

// Get transcript statistics
const getTranscriptStatistics: express.RequestHandler = async (req, res, next) => {
  try {
    const stats = await getTranscriptStats();
    sendJsonResponse(res, 200, {
      success: true,
      data: stats
    });
  } catch (error) {
    logError('API', `Error getting transcript statistics: ${error}`);
    sendJsonResponse(res, 500, { success: false, error: 'Error getting transcript statistics' });
  }
};

// Regenerate missing transcripts
const regenerateTranscripts: express.RequestHandler = async (req, res, next) => {
  try {
    logInfo('API', 'Starting transcript regeneration via API request');
    const result = await regenerateMissingTranscripts();
    
    sendJsonResponse(res, 200, {
      success: true,
      data: result,
      message: `Transcript regeneration completed. Processed: ${result.processed}, Generated: ${result.generated}, Errors: ${result.errors}`
    });
  } catch (error) {
    logError('API', `Error regenerating transcripts: ${error}`);
    sendJsonResponse(res, 500, { success: false, error: 'Error regenerating transcripts' });
  }
};

// Register route handlers - removing authentication for dashboard access
router.get('/', getTickets);
router.get('/:id', getTicketById);
router.get('/:id/transcript', getTicketTranscript);
router.put('/:id/transcript', storeTranscript); // New endpoint to store transcript
router.put('/:id/close', closeTicket);
router.put('/:id/reopen', reopenTicket);
router.delete('/:id', deleteTicket);

// Transcript management endpoints
router.get('/transcripts/stats', getTranscriptStatistics);
router.post('/transcripts/regenerate', regenerateTranscripts);

// Error handling middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error in tickets API:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default router;
