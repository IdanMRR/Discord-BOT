import { Router, Request, Response } from 'express';
import { LevelingService } from '../database/services/levelingService';
import { DashboardLogsService } from '../database/services/dashboardLogsService';
import { getClient, isClientReady } from '../utils/client-utils';

const router = Router();

// Get leveling settings
router.get('/:guildId/leveling', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;

    const settings = LevelingService.getLevelingSettings(guildId);
    
    if (settings) {
      res.json({
        success: true,
        data: settings
      });
    } else {
      // Return default settings if none exist
      const defaultSettings = {
        guild_id: guildId,
        enabled: false,
        xp_per_message: 15,
        xp_cooldown: 60,
        xp_multiplier: 1.0,
        level_formula: 'quadratic',
        base_xp: 100,
        xp_multiplier_per_level: 1.1,
        level_up_message_enabled: true,
        level_up_channel_id: '',
        level_up_message: 'Congratulations {user}, you reached level {level}! 🎉',
        level_rewards: '[]',
        voice_xp_enabled: false,
        voice_xp_rate: 10,
        boost_channels: '[]',
        boost_roles: '[]',
        ignored_channels: '[]',
        ignored_roles: '[]',
        leaderboard_enabled: true,
        leaderboard_channel_id: '',
        leaderboard_update_interval: 3600
      };

      res.json({
        success: true,
        data: defaultSettings
      });
    }
  } catch (error) {
    console.error('Error getting leveling settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get leveling settings'
    });
  }
});

// Update leveling settings (PUT)
router.put('/:guildId/leveling', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;

    // Get Discord usernames for logging
    let adminUsername = 'Unknown Admin';
    try {
      const client = getClient();
      if (client && isClientReady() && req.user?.userId) {
        const adminUser = await client.users.fetch(req.user.userId).catch(() => null);
        if (adminUser) {
          adminUsername = adminUser.username;
        }
      }
    } catch (fetchError) {
      adminUsername = req.user?.username || `Admin ${req.user?.userId?.slice(-4) || 'Unknown'}`;
    }

    const success = LevelingService.updateLevelingSettings(guildId, settings);

    if (success) {
      // Log the settings update
      const changes = [];
      if (settings.enabled !== undefined) {
        changes.push(`${settings.enabled ? '✅ Enabled' : '❌ Disabled'} leveling system`);
      }
      if (settings.xp_per_message !== undefined) {
        changes.push(`📊 XP per message: ${settings.xp_per_message}`);
      }
      if (settings.xp_cooldown !== undefined) {
        changes.push(`⏱️ XP cooldown: ${settings.xp_cooldown}s`);
      }
      if (settings.level_formula !== undefined) {
        changes.push(`📈 Level formula: ${settings.level_formula}`);
      }
      if (settings.level_up_message_enabled !== undefined) {
        changes.push(`💬 Level up messages: ${settings.level_up_message_enabled ? 'enabled' : 'disabled'}`);
      }

      await DashboardLogsService.logActivity({
        guild_id: guildId,
        user_id: req.user?.userId || 'unknown',
        action_type: 'update_leveling_settings',
        target_type: 'settings',
        target_id: 'leveling_settings',
        page: 'leveling_settings',
        details: `🎮 **Leveling Settings Updated** by ${adminUsername}\n${changes.join('\n')}`
      });

      res.json({
        success: true,
        message: 'Leveling settings updated successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update leveling settings'
      });
    }
  } catch (error) {
    console.error('Error updating leveling settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update leveling settings'
    });
  }
});

// Update leveling settings (POST - for client compatibility)
router.post('/:guildId/leveling', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;

    // Get Discord usernames for logging
    let adminUsername = 'Unknown Admin';
    try {
      const client = getClient();
      if (client && isClientReady() && req.user?.userId) {
        const adminUser = await client.users.fetch(req.user.userId).catch(() => null);
        if (adminUser) {
          adminUsername = adminUser.username;
        }
      }
    } catch (fetchError) {
      adminUsername = req.user?.username || `Admin ${req.user?.userId?.slice(-4) || 'Unknown'}`;
    }

    const success = LevelingService.updateLevelingSettings(guildId, settings);

    if (success) {
      // Log the settings update
      const changes = [];
      if (settings.enabled !== undefined) {
        changes.push(`${settings.enabled ? '✅ Enabled' : '❌ Disabled'} leveling system`);
      }
      if (settings.xp_per_message !== undefined) {
        changes.push(`📊 XP per message: ${settings.xp_per_message}`);
      }
      if (settings.xp_cooldown !== undefined) {
        changes.push(`⏱️ XP cooldown: ${settings.xp_cooldown}s`);
      }
      if (settings.level_formula !== undefined) {
        changes.push(`📈 Level formula: ${settings.level_formula}`);
      }
      if (settings.level_up_message_enabled !== undefined) {
        changes.push(`💬 Level up messages: ${settings.level_up_message_enabled ? 'enabled' : 'disabled'}`);
      }

      await DashboardLogsService.logActivity({
        guild_id: guildId,
        user_id: req.user?.userId || 'unknown',
        action_type: 'update_leveling_settings',
        target_type: 'settings',
        target_id: 'leveling_settings',
        page: 'leveling_settings',
        details: `🎮 **Leveling Settings Updated** by ${adminUsername}\n${changes.join('\n')}`
      });

      res.json({
        success: true,
        message: 'Leveling settings updated successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update leveling settings'
      });
    }
  } catch (error) {
    console.error('Error updating leveling settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update leveling settings'
    });
  }
});

// Get leaderboard data
router.get('/:guildId/leveling/leaderboard', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const leaderboard = LevelingService.getLeaderboard(guildId, limit + offset);
    const totalMembers = LevelingService.getTotalRankedMembers(guildId);

    // Get users for this page
    const pageUsers = leaderboard.slice(offset, offset + limit);

    // Fetch Discord user data
    const client = getClient();
    const usersWithData = [];

    for (const user of pageUsers) {
      try {
        let userData = { id: user.user_id, username: 'Unknown User', displayName: 'Unknown User' };
        
        if (client && isClientReady()) {
          const discordUser = await client.users.fetch(user.user_id).catch(() => null);
          if (discordUser) {
            userData = {
              id: discordUser.id,
              username: discordUser.username,
              displayName: discordUser.displayName
            };
          }
        }

        usersWithData.push({
          ...user,
          userData,
          rank: usersWithData.length + offset + 1
        });
      } catch (error) {
        // Add user with unknown data
        usersWithData.push({
          ...user,
          userData: { id: user.user_id, username: 'Unknown User', displayName: 'Unknown User' },
          rank: usersWithData.length + offset + 1
        });
      }
    }

    res.json({
      success: true,
      data: {
        users: usersWithData,
        totalMembers,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalMembers / limit)
      }
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get leaderboard data'
    });
  }
});

// Get user level info
router.get('/:guildId/leveling/user/:userId', async (req: Request, res: Response) => {
  try {
    const { guildId, userId } = req.params;

    const userLevel = LevelingService.getUserLevel(guildId, userId);
    const rank = LevelingService.getUserRank(guildId, userId);
    const totalMembers = LevelingService.getTotalRankedMembers(guildId);

    if (!userLevel) {
      res.json({
        success: true,
        data: null,
        message: 'User has not earned any XP yet'
      });
      return;
    }

    // Get Discord user data
    let userData = { id: userId, username: 'Unknown User', displayName: 'Unknown User' };
    try {
      const client = getClient();
      if (client && isClientReady()) {
        const discordUser = await client.users.fetch(userId).catch(() => null);
        if (discordUser) {
          userData = {
            id: discordUser.id,
            username: discordUser.username,
            displayName: discordUser.displayName
          };
        }
      }
    } catch (error) {
      // Use default userData
    }

    res.json({
      success: true,
      data: {
        ...userLevel,
        userData,
        rank,
        totalMembers
      }
    });
  } catch (error) {
    console.error('Error getting user level:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user level data'
    });
  }
});

// Reset user level (admin only)
router.delete('/:guildId/leveling/user/:userId', async (req: Request, res: Response) => {
  try {
    const { guildId, userId } = req.params;

    // Get Discord usernames for logging
    let adminUsername = 'Unknown Admin';
    let targetUsername = 'Unknown User';
    
    try {
      const client = getClient();
      if (client && isClientReady()) {
        if (req.user?.userId) {
          const adminUser = await client.users.fetch(req.user.userId).catch(() => null);
          if (adminUser) adminUsername = adminUser.username;
        }
        
        const targetUser = await client.users.fetch(userId).catch(() => null);
        if (targetUser) targetUsername = targetUser.username;
      }
    } catch (fetchError) {
      adminUsername = req.user?.username || `Admin ${req.user?.userId?.slice(-4) || 'Unknown'}`;
    }

    const success = LevelingService.resetUserLevel(guildId, userId);

    if (success) {
      // Log the level reset
      await DashboardLogsService.logActivity({
        guild_id: guildId,
        user_id: req.user?.userId || 'unknown',
        action_type: 'reset_user_level',
        target_type: 'user',
        target_id: userId,
        page: 'leveling_management',
        details: `🔄 **User Level Reset** by ${adminUsername}\n👤 Target: ${targetUsername}\n📊 All XP and level progress has been reset`
      });

      res.json({
        success: true,
        message: 'User level reset successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to reset user level'
      });
    }
  } catch (error) {
    console.error('Error resetting user level:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset user level'
    });
  }
});

export default router;