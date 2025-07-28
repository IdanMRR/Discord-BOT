import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../database/services/analyticsService';
import { authenticateToken } from '../middleware/auth';
import { checkServerAccess } from '../middleware/serverAuth';
import { logInfo, logError } from '../utils/logger';

const router = Router();

// Apply authentication to all analytics routes
// Temporarily disabled for testing - TODO: Re-enable in production
// router.use(authenticateToken);
// router.use(checkServerAccess('view_analytics'));

/**
 * GET /api/analytics/:guildId/overview
 * Get server overview statistics
 */
router.get('/:guildId/overview', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    const overview = await AnalyticsService.getServerOverview(guildId, days);
    
    logInfo('Analytics API', `Retrieved server overview for guild ${guildId} (${days} days)`);
    
    res.json({
      success: true,
      data: overview,
      period_days: days
    });

  } catch (error) {
    logError('Analytics API', `Error getting server overview: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve server overview'
    });
  }
});

/**
 * GET /api/analytics/:guildId/hourly-activity
 * Get hourly activity patterns
 */
router.get('/:guildId/hourly-activity', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    const activity = await AnalyticsService.getHourlyActivity(guildId, days);
    
    logInfo('Analytics API', `Retrieved hourly activity for guild ${guildId} (${days} days)`);
    
    res.json({
      success: true,
      data: activity,
      period_days: days
    });

  } catch (error) {
    logError('Analytics API', `Error getting hourly activity: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve hourly activity'
    });
  }
});

/**
 * GET /api/analytics/:guildId/top-channels
 * Get most active channels
 */
router.get('/:guildId/top-channels', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const days = parseInt(req.query.days as string) || 7;
    const limit = parseInt(req.query.limit as string) || 10;

    const channels = await AnalyticsService.getTopChannels(guildId, days, limit);
    
    logInfo('Analytics API', `Retrieved top channels for guild ${guildId} (${days} days, limit ${limit})`);
    
    res.json({
      success: true,
      data: channels,
      period_days: days,
      limit
    });

  } catch (error) {
    logError('Analytics API', `Error getting top channels: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve top channels'
    });
  }
});

/**
 * GET /api/analytics/:guildId/command-stats
 * Get command usage statistics
 */
router.get('/:guildId/command-stats', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    const stats = await AnalyticsService.getCommandStats(guildId, days);
    
    logInfo('Analytics API', `Retrieved command stats for guild ${guildId} (${days} days)`);
    
    res.json({
      success: true,
      data: stats,
      period_days: days
    });

  } catch (error) {
    logError('Analytics API', `Error getting command stats: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve command statistics'
    });
  }
});

/**
 * GET /api/analytics/:guildId/member-engagement
 * Get member engagement metrics
 */
router.get('/:guildId/member-engagement', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    const engagement = await AnalyticsService.getMemberEngagement(guildId, days);
    
    logInfo('Analytics API', `Retrieved member engagement for guild ${guildId} (${days} days)`);
    
    res.json({
      success: true,
      data: engagement,
      period_days: days
    });

  } catch (error) {
    logError('Analytics API', `Error getting member engagement: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve member engagement'
    });
  }
});

/**
 * GET /api/analytics/:guildId/server-health
 * Get server health history
 */
router.get('/:guildId/server-health', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;

    const health = await AnalyticsService.getServerHealthHistory(guildId, hours);
    
    logInfo('Analytics API', `Retrieved server health for guild ${guildId} (${hours} hours)`);
    
    res.json({
      success: true,
      data: health,
      period_hours: hours
    });

  } catch (error) {
    logError('Analytics API', `Error getting server health: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve server health'
    });
  }
});

/**
 * GET /api/analytics/:guildId/export
 * Export comprehensive analytics data
 */
router.get('/:guildId/export', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const format = req.query.format as string || 'json';

    const exportData = await AnalyticsService.exportData(guildId, days);
    
    logInfo('Analytics API', `Exported analytics data for guild ${guildId} (${days} days, ${format} format)`);
    
    if (format === 'json') {
      res.json({
        success: true,
        data: exportData
      });
    } else {
      // For future formats like CSV, Excel, etc.
      res.status(400).json({
        success: false,
        error: 'Unsupported export format. Only JSON is currently supported.'
      });
    }

  } catch (error) {
    logError('Analytics API', `Error exporting analytics data: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics data'
    });
  }
});

/**
 * POST /api/analytics/:guildId/track
 * Manually track an activity (for testing or special events)
 */
router.post('/:guildId/track', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const { metric_type, channel_id, user_id, command_name, value, metadata } = req.body;

    if (!metric_type) {
      return res.status(400).json({
        success: false,
        error: 'metric_type is required'
      });
    }

    const validMetricTypes = ['message_count', 'command_usage', 'member_join', 'member_leave', 'voice_activity', 'reaction_count'];
    if (!validMetricTypes.includes(metric_type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid metric_type. Must be one of: ${validMetricTypes.join(', ')}`
      });
    }

    await AnalyticsService.trackActivity({
      guild_id: guildId,
      metric_type,
      channel_id,
      user_id,
      command_name,
      value: value || 1,
      metadata: metadata ? JSON.stringify(metadata) : undefined
    });

    logInfo('Analytics API', `Manual activity tracked for guild ${guildId}: ${metric_type}`);

    res.json({
      success: true,
      message: 'Activity tracked successfully'
    });

  } catch (error) {
    logError('Analytics API', `Error tracking manual activity: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to track activity'
    });
  }
});

/**
 * DELETE /api/analytics/:guildId/clean
 * Clean old analytics data
 */
router.delete('/:guildId/clean', async (req: Request, res: Response) => {
  try {
    const daysToKeep = parseInt(req.query.days as string) || 90;

    await AnalyticsService.cleanOldData(daysToKeep);

    logInfo('Analytics API', `Cleaned analytics data older than ${daysToKeep} days`);

    res.json({
      success: true,
      message: `Analytics data older than ${daysToKeep} days has been cleaned`
    });

  } catch (error) {
    logError('Analytics API', `Error cleaning analytics data: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to clean analytics data'
    });
  }
});

export default router;