import express, { Request, Response, NextFunction } from 'express';
import { logInfo, logError } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { db } from '../database/sqlite';
import { getClient, isClientReady } from '../utils/client-utils';
import { DashboardLogsService } from '../database/services/dashboardLogsService';

const router = express.Router();

/**
 * GET /admin/dashboard-stats - Get enhanced dashboard statistics for admins
 */
router.get('/dashboard-stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const stats = {
      // Basic stats
      serverCount: 0,
      totalUsers: 0,
      totalWarnings: 0,
      totalTickets: 0,
      totalCommands: 0,
      
      // Admin-only stats
      dashboardUsers: 0,
      adminActions: 0,
      systemErrors: 0,
      databaseSize: 0,
      
      // Performance stats
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      
      // Recent activity counts
      recentLogins: 0,
      recentActions: 0
    };

    // Get basic counts from database
    try {
      // Server count from client
      const client = getClient();
      if (client && isClientReady()) {
        stats.serverCount = client.guilds.cache.size;
        stats.totalUsers = client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0);
      }

      // Database counts
      const warningCount = db.prepare('SELECT COUNT(*) as count FROM warnings WHERE active = 1').get() as { count: number };
      stats.totalWarnings = warningCount.count;

      const ticketCount = db.prepare('SELECT COUNT(*) as count FROM tickets').get() as { count: number };
      stats.totalTickets = ticketCount.count;

      const commandCount = db.prepare('SELECT COUNT(*) as count FROM command_logs').get() as { count: number };
      stats.totalCommands = commandCount.count;

      // Admin-specific stats
      const dashboardLogCount = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM dashboard_logs').get() as { count: number };
      stats.dashboardUsers = dashboardLogCount.count;

      const adminActionCount = db.prepare('SELECT COUNT(*) as count FROM dashboard_logs WHERE action_type LIKE "%admin%" OR action_type LIKE "%manage%"').get() as { count: number };
      stats.adminActions = adminActionCount.count;

      // Recent activity (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const recentLogins = db.prepare('SELECT COUNT(*) as count FROM dashboard_logs WHERE action_type = "login" AND created_at > ?').get(yesterday) as { count: number };
      stats.recentLogins = recentLogins.count;

      const recentActions = db.prepare('SELECT COUNT(*) as count FROM dashboard_logs WHERE created_at > ?').get(yesterday) as { count: number };
      stats.recentActions = recentActions.count;

    } catch (dbError: any) {
      logError('AdminPanel', `Database error getting stats: ${dbError.message}`);
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    logError('AdminPanel', `Error getting admin dashboard stats: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard statistics'
    });
  }
});

/**
 * GET /admin/system-info - Get system information for admins
 */
router.get('/system-info', authenticateToken, async (req: Request, res: Response) => {
  try {
    const client = getClient();
    
    const systemInfo = {
      // Bot information
      botInfo: {
        ready: isClientReady(),
        username: client?.user?.username || 'Unknown',
        id: client?.user?.id || 'Unknown',
        serverCount: client?.guilds.cache.size || 0,
        uptime: process.uptime()
      },
      
      // System performance
      performance: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform
      },
      
      // Database info
      database: {
        connected: !!db,
        tables: [] as string[]
      },
      
      // Environment
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    // Get database table info
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
      systemInfo.database.tables = tables.map(t => t.name);
    } catch (dbError) {
      logError('AdminPanel', `Error getting database info: ${dbError}`);
    }

    res.json({
      success: true,
      data: systemInfo
    });

  } catch (error: any) {
    logError('AdminPanel', `Error getting system info: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get system information'
    });
  }
});

/**
 * POST /admin/bot/restart - Restart bot (admin only)
 */
router.post('/bot/restart', authenticateToken, async (req: Request, res: Response) => {
  try {
    logInfo('AdminPanel', `Bot restart requested by ${req.user?.userId} (${req.user?.userId})`);
    
    // Log the admin action
    await DashboardLogsService.logActivity({
      user_id: req.user?.userId || 'unknown',
      username: req.user?.userId || 'Unknown Admin',
      action_type: 'bot_restart',
      page: 'admin_panel',
      target_type: 'system',
      details: 'Bot restart requested from admin panel',
      success: true
    });

    res.json({
      success: true,
      message: 'Bot restart initiated. This may take a few moments.'
    });

    // Restart the bot after a short delay
    setTimeout(() => {
      process.exit(0); // This will trigger the process manager to restart the bot
    }, 2000);

  } catch (error: any) {
    logError('AdminPanel', `Error restarting bot: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to restart bot'
    });
  }
});

/**
 * GET /admin/users - Get list of dashboard users (admin only)
 */
router.get('/users', authenticateToken, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Get unique dashboard users with their activity
    const usersQuery = `
      SELECT 
        user_id,
        username,
        COUNT(*) as action_count,
        MAX(created_at) as last_activity,
        MIN(created_at) as first_activity
      FROM dashboard_logs 
      WHERE user_id != 'anonymous'
      GROUP BY user_id, username
      ORDER BY last_activity DESC
      LIMIT ? OFFSET ?
    `;

    const users = db.prepare(usersQuery).all(limit, offset) as any[];

    // Get total count
    const totalQuery = `
      SELECT COUNT(DISTINCT user_id) as count 
      FROM dashboard_logs 
      WHERE user_id != 'anonymous'
    `;
    const { count: total } = db.prepare(totalQuery).get() as { count: number };

    // Enhance user data
    const enhancedUsers = users.map(user => ({
      ...user,
              isAdmin: false, // Remove hardcoded admin check - use database permissions instead
      last_activity: new Date(user.last_activity).toISOString(),
      first_activity: new Date(user.first_activity).toISOString()
    }));

    res.json({
      success: true,
      data: {
        users: enhancedUsers,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error: any) {
    logError('AdminPanel', `Error getting dashboard users: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard users'
    });
  }
});

/**
 * GET /admin/logs - Get dashboard logs (admin only)
 */
router.get('/logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const userId = req.query.userId as string;
    const actionType = req.query.actionType as string;
    const guildId = req.query.guildId as string;

    let whereConditions: string[] = [];
    let params: any[] = [];

    // Build WHERE conditions
    if (userId) {
      whereConditions.push('user_id = ?');
      params.push(userId);
    }
    
    if (actionType) {
      whereConditions.push('action_type = ?');
      params.push(actionType);
    }
    
    if (guildId) {
      whereConditions.push('guild_id = ?');
      params.push(guildId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get logs with pagination
    const logsQuery = `
      SELECT 
        id,
        user_id,
        username,
        action_type,
        page,
        target_type,
        target_id,
        old_value,
        new_value,
        ip_address,
        user_agent,
        details,
        success,
        error_message,
        guild_id,
        created_at
      FROM dashboard_logs 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const logs = db.prepare(logsQuery).all(...params, limit, offset) as any[];

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM dashboard_logs ${whereClause}`;
    const { count: total } = db.prepare(countQuery).get(...params) as { count: number };

    // Format logs
    const formattedLogs = logs.map(log => ({
      ...log,
      created_at: log.created_at + 'Z', // SQLite CURRENT_TIMESTAMP is UTC, add Z to indicate UTC
      success: Boolean(log.success)
    }));

    res.json({
      success: true,
      data: {
        logs: formattedLogs,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error: any) {
    logError('AdminPanel', `Error getting dashboard logs: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard logs'
    });
  }
});

/**
 * DELETE /admin/logs/cleanup - Clean old logs (admin only)
 */
router.delete('/logs/cleanup', authenticateToken, async (req: Request, res: Response) => {
  try {
    const daysOld = parseInt(req.query.days as string) || 30;
    
    logInfo('AdminPanel', `Log cleanup requested by ${req.user?.userId} for logs older than ${daysOld} days`);
    
    const deletedCount = await DashboardLogsService.cleanOldLogs(daysOld);

    // Log the admin action
    await DashboardLogsService.logActivity({
      user_id: req.user?.userId || 'unknown',
      username: req.user?.userId || 'Unknown Admin',
      action_type: 'log_cleanup',
      page: 'admin_panel',
      target_type: 'logs',
      details: `Cleaned ${deletedCount} log entries older than ${daysOld} days`,
      success: true
    });

    res.json({
      success: true,
      data: {
        deletedCount,
        message: `Cleaned ${deletedCount} log entries older than ${daysOld} days`
      }
    });

  } catch (error: any) {
    logError('AdminPanel', `Error cleaning logs: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to clean logs'
    });
  }
});

/**
 * PUT /admin/users/:userId - Update user permissions (admin only)
 */
router.put('/users/:userId', authenticateToken, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { permissions, role, dashboardAccess, guildId } = req.body;
  
  // Declare targetGuildId at function level so it's accessible in catch block
  let targetGuildId = guildId;
  if (!targetGuildId) {
    const client = getClient();
    targetGuildId = client?.guilds.cache.first()?.id || 'default';
  }
  
  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    console.log(`🏘️ Admin panel using guild ID: ${targetGuildId} (from request: ${!!guildId})`);
    
    logInfo('AdminPanel', `Admin ${req.user?.userId} updating permissions for user ${userId}`);

    // Import the permissions functions
    const { saveDashboardPermissions, getDashboardPermissions } = await import('../database/migrations/add-dashboard-permissions');
    
    // Get current permissions before updating (for logging)
    const oldPermissions = getDashboardPermissions(userId, targetGuildId) || [];
    
    // Convert role and permissions to dashboard permissions
    let dashboardPermissions: string[] = [];
    
    if (dashboardAccess) {
      dashboardPermissions.push('dashboard_access');
    }
    
    if (role === 'admin') {
      dashboardPermissions = [
        'dashboard_access', 'view_logs', 'manage_warnings', 'manage_tickets', 
        'manage_servers', 'manage_members', 'view_analytics', 'system_admin', 
        'moderate_users', 'manage_roles'
      ];
    } else if (role === 'moderator') {
      dashboardPermissions = [
        'dashboard_access', 'view_logs', 'manage_warnings', 'manage_tickets', 
        'moderate_users'
      ];
    } else if (permissions && Array.isArray(permissions)) {
      // Use custom permissions array
      dashboardPermissions = [...permissions];
      if (dashboardAccess && !dashboardPermissions.includes('dashboard_access')) {
        dashboardPermissions.push('dashboard_access');
      }
    }

    // Save permissions to database
    saveDashboardPermissions(userId, targetGuildId, dashboardPermissions);
    
    // Verify the save
    const savedPermissions = getDashboardPermissions(userId, targetGuildId);
    
    logInfo('AdminPanel', `Successfully updated permissions for user ${userId}: ${savedPermissions.join(', ')}`);

    // Get admin user info for better logging
    let adminUsername = 'Unknown Admin';
    try {
      const client = getClient();
      if (client && isClientReady() && req.user?.userId) {
        const adminUser = await client.users.fetch(req.user.userId).catch(() => null);
        if (adminUser) {
          adminUsername = adminUser.username;
        }
      }
    } catch (error) {
      // Use fallback if Discord API fails
      adminUsername = req.user?.username || `Admin ${req.user?.userId?.slice(-4) || 'Unknown'}`;
    }

    // Get target user info for better logging
    let targetUsername = 'Unknown User';
    try {
      const client = getClient();
      if (client && isClientReady()) {
        const targetUser = await client.users.fetch(userId).catch(() => null);
        if (targetUser) {
          targetUsername = targetUser.username;
        }
      }
    } catch (error) {
      // Use fallback if Discord API fails
      targetUsername = `User ${userId.slice(-4)}`;
    }

    // Log the admin action to dashboard logs with enhanced details
    await DashboardLogsService.logActivity({
      user_id: req.user?.userId || 'unknown',
      username: adminUsername,
      action_type: 'dashboard_permission_update',
      page: 'admin_panel',
      target_type: 'user',
      target_id: userId,
      old_value: JSON.stringify(oldPermissions),
      new_value: JSON.stringify(savedPermissions),
      details: `🔐 Dashboard Permission Update: ${adminUsername} updated permissions for ${targetUsername} (${userId}).\n📝 Changes: Role=${role || 'custom'} | Dashboard Access=${dashboardAccess ? 'GRANTED' : 'DENIED'}\n🛡️ New Permissions: [${savedPermissions.join(', ')}]\n🏷️ Previous Permissions: [${oldPermissions.join(', ')}]`,
      success: true,
      guild_id: targetGuildId
    });

    res.json({
      success: true,
      data: {
        userId,
        permissions: savedPermissions,
        role,
        dashboardAccess: savedPermissions.length > 0,
        message: 'User permissions updated successfully'
      }
    });

  } catch (error: any) {
    logError('AdminPanel', `Error updating user permissions: ${error.message}`);
    
    // Get admin username for error logging
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

    // Log the failed admin action
    try {
      await DashboardLogsService.logActivity({
        user_id: req.user?.userId || 'unknown',
        username: adminUsername,
        action_type: 'dashboard_permission_update_failed',
        page: 'admin_panel',
        target_type: 'user',
        target_id: userId,
        details: `❌ Dashboard Permission Update Failed: ${adminUsername} attempted to update permissions for user ${userId} but failed.\n🚨 Error: ${error.message}`,
        success: false,
        error_message: error.message,
        guild_id: targetGuildId || 'default'
      });
    } catch (loggingError) {
      // Ignore logging errors to prevent cascading failures
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update user permissions'
    });
  }
});

export default router; 