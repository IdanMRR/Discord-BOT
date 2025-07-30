import express from 'express';
import { Request, Response } from 'express';
import { LevelingService } from '../database/services/levelingService';
import { DashboardLogsService } from '../database/services/dashboardLogsService';
import { authenticateToken } from '../middleware/auth';
import { logInfo, logError } from '../utils/logger';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Get user level data
 * GET /api/xp-management/:serverId/user/:userId
 */
router.get('/:serverId/user/:userId', async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params;

    if (!serverId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Server ID and User ID are required' 
      });
    }

    // Check if leveling is enabled for this server
    const settings = LevelingService.getLevelingSettings(serverId);
    if (!settings) {
      return res.status(404).json({ 
        success: false, 
        error: 'Leveling system not configured for this server' 
      });
    }

    // Get user level data
    const userLevel = LevelingService.getUserLevel(serverId, userId);
    if (!userLevel) {
      return res.status(404).json({ 
        success: false, 
        error: 'User has no level data' 
      });
    }

    // Get user rank
    const rank = LevelingService.getUserRank(serverId, userId);
    const totalMembers = LevelingService.getTotalRankedMembers(serverId);

    // Calculate next level XP requirement
    const nextLevelXP = LevelingService.calculateXPForLevel(userLevel.level + 1, settings);
    const currentLevelXP = LevelingService.calculateTotalXPForLevel(userLevel.level, settings);
    const progressXP = userLevel.xp - currentLevelXP;
    const progressPercentage = (progressXP / nextLevelXP) * 100;

    res.json({
      success: true,
      data: {
        ...userLevel,
        rank,
        totalMembers,
        nextLevelXP,
        currentLevelXP: progressXP,
        progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
        xpToNextLevel: Math.max(0, nextLevelXP - progressXP)
      }
    });

  } catch (error) {
    logError('XP Management API', `Error getting user level: ${error}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user level data' 
    });
  }
});

/**
 * Update user XP/Level
 * POST /api/xp-management/:serverId/user/:userId/update
 */
router.post('/:serverId/user/:userId/update', async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params;
    const { xp, level, reason } = req.body;
    const adminUserId = (req as any).user?.id;

    if (!serverId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Server ID and User ID are required' 
      });
    }

    if (typeof xp !== 'number' && typeof level !== 'number') {
      return res.status(400).json({ 
        success: false, 
        error: 'Either XP or level must be provided as a number' 
      });
    }

    if (xp !== undefined && xp < 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'XP cannot be negative' 
      });
    }

    if (level !== undefined && level < 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Level cannot be negative' 
      });
    }

    // Check if leveling is enabled for this server
    const settings = LevelingService.getLevelingSettings(serverId);
    if (!settings) {
      return res.status(404).json({ 
        success: false, 
        error: 'Leveling system not configured for this server' 
      });
    }

    // Get current user data
    const currentUserLevel = LevelingService.getUserLevel(serverId, userId);
    const oldXP = currentUserLevel?.xp || 0;
    const oldLevel = currentUserLevel?.level || 0;

    // Calculate final values
    let finalXP = xp !== undefined ? xp : oldXP;
    let finalLevel = level !== undefined ? level : oldLevel;

    // If only XP is provided, calculate level
    if (xp !== undefined && level === undefined) {
      finalLevel = LevelingService.calculateLevelFromXP(finalXP, settings);
    }
    // If only level is provided, calculate minimum XP for that level
    else if (level !== undefined && xp === undefined) {
      finalXP = LevelingService.calculateTotalXPForLevel(finalLevel, settings);
    }

    // Update user level
    const success = LevelingService.setUserLevel(serverId, userId, finalXP, finalLevel);
    
    if (!success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update user level' 
      });
    }

    // Log the change
    const changeType = finalXP > oldXP ? 'increased' : finalXP < oldXP ? 'decreased' : 'maintained';
    const logDetails = `🔧 **XP Management** User <@${userId}> XP ${changeType} from ${oldXP.toLocaleString()} to ${finalXP.toLocaleString()} (Level ${oldLevel} → ${finalLevel})${reason ? `\n**Reason:** ${reason}` : ''}`;

    await DashboardLogsService.logActivity({
      guild_id: serverId,
      user_id: adminUserId || 'unknown',
      action_type: 'xp_management',
      target_type: 'user',
      target_id: userId,
      page: 'xp_management',
      details: logDetails
    });

    logInfo('XP Management', `Admin ${adminUserId} updated XP for user ${userId} in server ${serverId}: ${oldXP} -> ${finalXP} XP, ${oldLevel} -> ${finalLevel} level`);

    // Get updated user data
    const updatedUserLevel = LevelingService.getUserLevel(serverId, userId);
    const rank = LevelingService.getUserRank(serverId, userId);

    res.json({
      success: true,
      message: 'User XP/Level updated successfully',
      data: {
        ...updatedUserLevel,
        rank,
        oldXP,
        oldLevel,
        change: {
          xp: finalXP - oldXP,
          level: finalLevel - oldLevel
        }
      }
    });

  } catch (error) {
    logError('XP Management API', `Error updating user XP: ${error}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update user XP/Level' 
    });
  }
});

/**
 * Add XP to user (relative change)
 * POST /api/xp-management/:serverId/user/:userId/add-xp
 */
router.post('/:serverId/user/:userId/add-xp', async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params;
    const { xp, reason } = req.body;
    const adminUserId = (req as any).user?.id;

    if (!serverId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Server ID and User ID are required' 
      });
    }

    if (typeof xp !== 'number') {
      return res.status(400).json({ 
        success: false, 
        error: 'XP must be a number' 
      });
    }

    // Check if leveling is enabled for this server
    const settings = LevelingService.getLevelingSettings(serverId);
    if (!settings) {
      return res.status(404).json({ 
        success: false, 
        error: 'Leveling system not configured for this server' 
      });
    }

    // Get current user data
    const currentUserLevel = LevelingService.getUserLevel(serverId, userId);
    const oldXP = currentUserLevel?.xp || 0;
    const oldLevel = currentUserLevel?.level || 0;

    // Calculate new XP (ensure it doesn't go below 0)
    const newXP = Math.max(0, oldXP + xp);
    const newLevel = LevelingService.calculateLevelFromXP(newXP, settings);

    // Update user level
    const success = LevelingService.setUserLevel(serverId, userId, newXP, newLevel);
    
    if (!success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update user XP' 
      });
    }

    // Log the change
    const changeType = xp > 0 ? 'added' : 'removed';
    const logDetails = `➕ **XP ${changeType.charAt(0).toUpperCase() + changeType.slice(1)}** ${Math.abs(xp).toLocaleString()} XP ${xp > 0 ? 'to' : 'from'} <@${userId}> (${oldXP.toLocaleString()} → ${newXP.toLocaleString()} XP)${newLevel !== oldLevel ? ` **Level up!** ${oldLevel} → ${newLevel}` : ''}${reason ? `\n**Reason:** ${reason}` : ''}`;

    await DashboardLogsService.logActivity({
      guild_id: serverId,
      user_id: adminUserId || 'unknown',
      action_type: 'xp_modification',
      target_type: 'user',
      target_id: userId,
      page: 'xp_management',
      details: logDetails
    });

    logInfo('XP Management', `Admin ${adminUserId} ${changeType} ${Math.abs(xp)} XP ${xp > 0 ? 'to' : 'from'} user ${userId} in server ${serverId}`);

    // Get updated user data
    const updatedUserLevel = LevelingService.getUserLevel(serverId, userId);
    const rank = LevelingService.getUserRank(serverId, userId);

    res.json({
      success: true,
      message: `Successfully ${changeType} ${Math.abs(xp).toLocaleString()} XP`,
      data: {
        ...updatedUserLevel,
        rank,
        oldXP,
        oldLevel,
        change: {
          xp: newXP - oldXP,
          level: newLevel - oldLevel
        },
        leveledUp: newLevel > oldLevel
      }
    });

  } catch (error) {
    logError('XP Management API', `Error adding XP: ${error}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add XP to user' 
    });
  }
});

/**
 * Reset user level data
 * DELETE /api/xp-management/:serverId/user/:userId
 */
router.delete('/:serverId/user/:userId', async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params;
    const { reason } = req.body;
    const adminUserId = (req as any).user?.id;

    if (!serverId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Server ID and User ID are required' 
      });
    }

    // Get current user data before deletion
    const currentUserLevel = LevelingService.getUserLevel(serverId, userId);
    if (!currentUserLevel) {
      return res.status(404).json({ 
        success: false, 
        error: 'User has no level data to reset' 
      });
    }

    // Reset user level
    const success = LevelingService.resetUserLevel(serverId, userId);
    
    if (!success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to reset user level' 
      });
    }

    // Log the reset
    const logDetails = `🔄 **Level Reset** <@${userId}> level data reset (was Level ${currentUserLevel.level} with ${currentUserLevel.xp.toLocaleString()} XP)${reason ? `\n**Reason:** ${reason}` : ''}`;

    await DashboardLogsService.logActivity({
      guild_id: serverId,
      user_id: adminUserId || 'unknown',
      action_type: 'level_reset',
      target_type: 'user',
      target_id: userId,
      page: 'xp_management',
      details: logDetails
    });

    logInfo('XP Management', `Admin ${adminUserId} reset level data for user ${userId} in server ${serverId}`);

    res.json({
      success: true,
      message: 'User level data reset successfully',
      data: {
        resetData: currentUserLevel
      }
    });

  } catch (error) {
    logError('XP Management API', `Error resetting user level: ${error}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset user level' 
    });
  }
});

/**
 * Get server leaderboard
 * GET /api/xp-management/:serverId/leaderboard
 */
router.get('/:serverId/leaderboard', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;

    if (!serverId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Server ID is required' 
      });
    }

    // Check if leveling is enabled for this server
    const settings = LevelingService.getLevelingSettings(serverId);
    if (!settings) {
      return res.status(404).json({ 
        success: false, 
        error: 'Leveling system not configured for this server' 
      });
    }

    const offset = (page - 1) * limit;
    const leaderboard = LevelingService.getLeaderboard(serverId, limit + offset);
    const totalMembers = LevelingService.getTotalRankedMembers(serverId);
    const totalPages = Math.ceil(totalMembers / limit);

    // Get the requested page
    const pageData = leaderboard.slice(offset, offset + limit);

    // Add rank information
    const leaderboardWithRanks = pageData.map((user, index) => ({
      ...user,
      rank: offset + index + 1
    }));

    res.json({
      success: true,
      data: {
        leaderboard: leaderboardWithRanks,
        pagination: {
          page,
          limit,
          totalPages,
          totalMembers,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        settings: {
          enabled: settings.enabled,
          xp_per_message: settings.xp_per_message,
          xp_cooldown: settings.xp_cooldown,
          level_formula: settings.level_formula
        }
      }
    });

  } catch (error) {
    logError('XP Management API', `Error getting leaderboard: ${error}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch leaderboard' 
    });
  }
});

export default router;