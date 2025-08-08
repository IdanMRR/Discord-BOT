import { Router, Request, Response } from 'express';
import { GiveawayService, GiveawayRequirement } from '../database/services/giveawayService';
import { dashboardLogger } from '../middleware/dashboardLogger';
import { authenticateToken } from '../middleware/auth';
import { checkServerAccess } from '../middleware/serverAuth';
import { logInfo, logError } from '../utils/logger';
import { client } from '../index';
import { endGiveaway, startGiveaway } from '../handlers/giveaway/giveaway-handler';
import { getUserName } from './user-helper';

const router = Router({ mergeParams: true });

// Apply middleware
router.use(authenticateToken);
router.use(dashboardLogger);

interface GiveawayRequest extends Request {
  params: {
    serverId: string;
  };
  query: {
    page?: string;
    limit?: string;
    status?: 'active' | 'ended' | 'cancelled';
  };
}

interface CreateGiveawayRequest extends Request {
  params: {
    serverId: string;
  };
  body: {
    channelId: string;
    title: string;
    description?: string;
    prize: string;
    winnerCount: number;
    duration: number; // in minutes
    requirements?: {
      roleId?: string;
      serverBoost?: boolean;
    };
  };
}

// Get all giveaways for a server
router.get('/', checkServerAccess(), async (req: GiveawayRequest, res: Response) => {
  try {
    const { serverId } = req.params;
    const { page = '1', limit = '20', status } = req.query;
    
    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'Server ID is required'
      });
    }

    // Get giveaways from database
    const result = GiveawayService.getGuildGiveaways(serverId, status);
    
    if (!result.success) {
      logError('Giveaway API', `Error getting giveaways for guild ${serverId}: ${result.error}`);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve giveaways'
      });
    }

    const giveaways = result.giveaways || [];
    
    // Enhance giveaways with additional data
    const enhancedGiveaways = await Promise.all(giveaways.map(async giveaway => {
      const entryCountResult = GiveawayService.getEntryCount(giveaway.id);
      const winnersResult = GiveawayService.getGiveawayWinners(giveaway.id);
      
      // Enhance winners with user information from Discord
      let enhancedWinners: any[] = [];
      if (winnersResult.success && winnersResult.winners) {
        enhancedWinners = await Promise.all(winnersResult.winners.map(async (winner) => {
          const username = await getUserName(client, winner.user_id);
          return {
            ...winner,
            username: username,
            displayName: username,
            nickname: null
          };
        }));
      }
      
      return {
        ...giveaway,
        entryCount: entryCountResult.success ? entryCountResult.count || 0 : 0,
        winners: enhancedWinners,
        timeRemaining: giveaway.status === 'active' ? 
          Math.max(0, new Date(giveaway.end_time).getTime() - Date.now()) : 0
      };
    }));

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const paginatedGiveaways = enhancedGiveaways.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        giveaways: paginatedGiveaways,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: enhancedGiveaways.length,
          totalPages: Math.ceil(enhancedGiveaways.length / limitNum)
        }
      }
    });

    logInfo('Giveaway API', `Retrieved ${paginatedGiveaways.length} giveaways for guild ${serverId} (page ${pageNum})`);
  } catch (error) {
    logError('Giveaway API', `Error in GET /giveaways: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get specific giveaway details
router.get('/:id', checkServerAccess(), async (req: Request, res: Response) => {
  try {
    const giveawayId = parseInt(req.params.id);
    const { serverId } = req.params;

    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'Server ID is required'
      });
    }

    if (isNaN(giveawayId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid giveaway ID'
      });
    }

    // Get giveaway
    const result = GiveawayService.getGiveawayById(giveawayId);
    
    if (!result.success || !result.giveaway) {
      return res.status(404).json({
        success: false,
        error: 'Giveaway not found'
      });
    }

    const giveaway = result.giveaway;

    // Check if giveaway belongs to the server
    if (giveaway.guild_id !== serverId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get additional data
    const entriesResult = GiveawayService.getGiveawayEntries(giveawayId);
    const winnersResult = GiveawayService.getGiveawayWinners(giveawayId);
    const requirementsResult = GiveawayService.getGiveawayRequirements(giveawayId);

    // Enhance winners with user information from Discord
    let enhancedWinners: any[] = [];
    if (winnersResult.success && winnersResult.winners) {
      enhancedWinners = await Promise.all(winnersResult.winners.map(async (winner) => {
        const username = await getUserName(client, winner.user_id);
        return {
          ...winner,
          username: username,
          displayName: username,
          nickname: null
        };
      }));
    }

    const enhancedGiveaway = {
      ...giveaway,
      entries: entriesResult.success ? entriesResult.entries || [] : [],
      winners: enhancedWinners,
      requirements: requirementsResult.success ? requirementsResult.requirements || [] : [],
      timeRemaining: giveaway.status === 'active' ? 
        Math.max(0, new Date(giveaway.end_time).getTime() - Date.now()) : 0
    };

    res.json({
      success: true,
      data: enhancedGiveaway
    });

    logInfo('Giveaway API', `Retrieved giveaway ${giveawayId} details for guild ${serverId}`);
  } catch (error) {
    logError('Giveaway API', `Error in GET /giveaways/:id: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new giveaway
router.post('/', checkServerAccess('giveaway_manage'), async (req: CreateGiveawayRequest, res: Response) => {
  try {
    const { serverId } = req.params;
    
    // Debug: Log the full request
    console.log('[GIVEAWAY DEBUG] Request params:', req.params);
    console.log('[GIVEAWAY DEBUG] Request body:', JSON.stringify(req.body, null, 2));
    console.log('[GIVEAWAY DEBUG] User:', req.user);
    
    const { 
      channelId, 
      title, 
      description, 
      prize, 
      winnerCount, 
      duration,
      requirements 
    } = req.body;

    // Validation
    console.log('[GIVEAWAY DEBUG] Validation check:', {
      serverId: !!serverId,
      channelId: !!channelId,
      title: !!title,
      prize: !!prize,
      winnerCount: !!winnerCount,
      duration: !!duration
    });
    
    if (!serverId || !channelId || !title || !prize || !winnerCount || !duration) {
      console.log('[GIVEAWAY DEBUG] Validation failed - missing fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    if (winnerCount < 1 || winnerCount > 20) {
      return res.status(400).json({
        success: false,
        error: 'Winner count must be between 1 and 20'
      });
    }

    if (duration < 1 || duration > 43200) { // Max 30 days
      return res.status(400).json({
        success: false,
        error: 'Duration must be between 1 minute and 30 days'
      });
    }

    // Calculate end time
    const endTime = new Date(Date.now() + duration * 60 * 1000).toISOString();

    // Prepare giveaway data
    const giveawayData = {
      guild_id: serverId,
      channel_id: channelId,
      title,
      description,
      prize,
      winner_count: winnerCount,
      host_user_id: (req as any).user.userId, // From auth middleware
      end_time: endTime
    };

    console.log('[GIVEAWAY DEBUG] Prepared giveaway data:', JSON.stringify(giveawayData, null, 2));

    // Create giveaway
    const result = GiveawayService.createGiveaway(giveawayData);
    
    console.log('[GIVEAWAY DEBUG] Service result:', result);
    
    if (!result.success || !result.giveaway) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to create giveaway'
      });
    }

    // Add requirements if provided
    if (requirements && result.giveaway) {
      const requirementsArray: Array<Omit<GiveawayRequirement, 'id' | 'giveaway_id'>> = [];
      
      if (requirements.roleId) {
        requirementsArray.push({
          requirement_type: 'role',
          requirement_value: requirements.roleId
        });
      }
      
      if (requirements.serverBoost) {
        requirementsArray.push({
          requirement_type: 'server_boost',
          requirement_value: 'true'
        });
      }

      if (requirementsArray.length > 0) {
        GiveawayService.addGiveawayRequirements(result.giveaway.id, requirementsArray);
      }
    }

    // Send Discord message for the giveaway
    console.log('[GIVEAWAY DEBUG] Starting Discord giveaway message...');
    const startResult = await startGiveaway(client, result.giveaway.id);
    
    if (!startResult.success) {
      console.log('[GIVEAWAY DEBUG] Failed to start Discord giveaway:', startResult.error);
      // Don't fail the entire request if Discord message fails
      logError('Giveaway API', `Failed to send Discord message for giveaway ${result.giveaway.id}: ${startResult.error}`);
    } else {
      console.log('[GIVEAWAY DEBUG] Successfully started Discord giveaway message');
    }

    res.status(201).json({
      success: true,
      data: result.giveaway
    });

    logInfo('Giveaway API', `Created giveaway "${title}" (ID: ${result.giveaway.id}) for guild ${serverId}`);
  } catch (error) {
    logError('Giveaway API', `Error in POST /giveaways: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// End giveaway
router.post('/:id/end', checkServerAccess('giveaway_manage'), async (req: Request, res: Response) => {
  try {
    const giveawayId = parseInt(req.params.id);
    const { serverId } = req.body;

    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'Server ID is required'
      });
    }

    if (isNaN(giveawayId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid giveaway ID'
      });
    }

    // Get giveaway
    const result = GiveawayService.getGiveawayById(giveawayId);
    
    if (!result.success || !result.giveaway) {
      return res.status(404).json({
        success: false,
        error: 'Giveaway not found'
      });
    }

    const giveaway = result.giveaway;

    // Check if giveaway belongs to the server
    if (giveaway.guild_id !== serverId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if already ended
    if (giveaway.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Giveaway is already ${giveaway.status}`
      });
    }

    // End the giveaway
    await endGiveaway(client, giveawayId);

    res.json({
      success: true,
      message: 'Giveaway ended successfully'
    });

    logInfo('Giveaway API', `Ended giveaway ${giveawayId} for guild ${serverId}`);
  } catch (error) {
    logError('Giveaway API', `Error in POST /giveaways/:id/end: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Cancel giveaway
router.post('/:id/cancel', checkServerAccess('giveaway_manage'), async (req: Request, res: Response) => {
  try {
    const giveawayId = parseInt(req.params.id);
    const { serverId } = req.body;

    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'Server ID is required'
      });
    }

    if (isNaN(giveawayId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid giveaway ID'
      });
    }

    // Get giveaway
    const result = GiveawayService.getGiveawayById(giveawayId);
    
    if (!result.success || !result.giveaway) {
      return res.status(404).json({
        success: false,
        error: 'Giveaway not found'
      });
    }

    const giveaway = result.giveaway;

    // Check if giveaway belongs to the server
    if (giveaway.guild_id !== serverId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if can be cancelled
    if (giveaway.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel a ${giveaway.status} giveaway`
      });
    }

    // Cancel the giveaway
    const updateResult = GiveawayService.updateStatus(giveawayId, 'cancelled');
    
    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel giveaway'
      });
    }

    res.json({
      success: true,
      message: 'Giveaway cancelled successfully'
    });

    logInfo('Giveaway API', `Cancelled giveaway ${giveawayId} for guild ${serverId}`);
  } catch (error) {
    logError('Giveaway API', `Error in POST /giveaways/:id/cancel: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete giveaway
router.delete('/:id', checkServerAccess('giveaway_manage'), async (req: Request, res: Response) => {
  try {
    const giveawayId = parseInt(req.params.id);
    const { serverId } = req.query;

    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'Server ID is required'
      });
    }

    if (isNaN(giveawayId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid giveaway ID'
      });
    }

    // Get giveaway first to check ownership
    const result = GiveawayService.getGiveawayById(giveawayId);
    
    if (!result.success || !result.giveaway) {
      return res.status(404).json({
        success: false,
        error: 'Giveaway not found'
      });
    }

    const giveaway = result.giveaway;

    // Check if giveaway belongs to the server
    if (giveaway.guild_id !== serverId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Delete the giveaway
    const deleteResult = GiveawayService.deleteGiveaway(giveawayId);
    
    if (!deleteResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete giveaway'
      });
    }

    res.json({
      success: true,
      message: 'Giveaway deleted successfully'
    });

    logInfo('Giveaway API', `Deleted giveaway ${giveawayId} for guild ${serverId}`);
  } catch (error) {
    logError('Giveaway API', `Error in DELETE /giveaways/:id: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router; 