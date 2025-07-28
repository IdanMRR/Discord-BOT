import { Router, Request, Response } from 'express';
import { GiveawayService } from '../database/services/giveawayService';
import { logInfo, logError } from '../utils/logger';

const router = Router();

// Get all giveaways for a server
router.get('/', async (req: Request, res: Response) => {
  try {
    const { serverId, status } = req.query;
    
    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'Server ID is required'
      });
    }

    const result = GiveawayService.getGuildGiveaways(serverId as string, status as string);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve giveaways'
      });
    }

    const giveaways = result.giveaways || [];
    
    // Enhance with entry counts
    const enhancedGiveaways = giveaways.map(giveaway => {
      const entryCountResult = GiveawayService.getEntryCount(giveaway.id);
      const winnersResult = GiveawayService.getGiveawayWinners(giveaway.id);
      
      return {
        ...giveaway,
        entryCount: entryCountResult.success ? entryCountResult.count || 0 : 0,
        winners: winnersResult.success ? winnersResult.winners || [] : []
      };
    });

    res.json({
      success: true,
      data: enhancedGiveaways
    });
  } catch (error) {
    logError('Giveaway API', `Error: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get specific giveaway
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const giveawayId = parseInt(req.params.id);
    
    if (isNaN(giveawayId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid giveaway ID'
      });
    }

    const result = GiveawayService.getGiveawayById(giveawayId);
    
    if (!result.success || !result.giveaway) {
      return res.status(404).json({
        success: false,
        error: 'Giveaway not found'
      });
    }

    const giveaway = result.giveaway;
    const entriesResult = GiveawayService.getGiveawayEntries(giveawayId);
    const winnersResult = GiveawayService.getGiveawayWinners(giveawayId);

    res.json({
      success: true,
      data: {
        ...giveaway,
        entries: entriesResult.success ? entriesResult.entries || [] : [],
        winners: winnersResult.success ? winnersResult.winners || [] : []
      }
    });
  } catch (error) {
    logError('Giveaway API', `Error: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router; 