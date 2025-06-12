import express, { Request, Response, NextFunction } from 'express';
import { logInfo, logError } from '../utils/logger';
import { requireAdmin, requireAuth, AuthenticatedRequest } from '../middleware/adminAuth';
import { db } from '../database/sqlite';
import { getClient, isClientReady } from '../utils/client-utils';
import { DashboardLogsService } from '../database/services/dashboardLogsService';

const router = express.Router();

/**
 * GET /admin/dashboard-stats - Get enhanced dashboard statistics for admins
 */
router.get('/dashboard-stats', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
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
router.get('/system-info', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
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
router.post('/bot/restart', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logInfo('AdminPanel', `Bot restart requested by ${req.dashboardUser?.username} (${req.dashboardUser?.userId})`);
    
    // Log the admin action
    await DashboardLogsService.logActivity({
      user_id: req.dashboardUser?.userId || 'unknown',
      username: req.dashboardUser?.username || 'Unknown Admin',
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
router.get('/users', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
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
 * DELETE /admin/logs/cleanup - Clean old logs (admin only)
 */
router.delete('/logs/cleanup', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const daysOld = parseInt(req.query.days as string) || 30;
    
    logInfo('AdminPanel', `Log cleanup requested by ${req.dashboardUser?.username} for logs older than ${daysOld} days`);
    
    const deletedCount = await DashboardLogsService.cleanOldLogs(daysOld);

    // Log the admin action
    await DashboardLogsService.logActivity({
      user_id: req.dashboardUser?.userId || 'unknown',
      username: req.dashboardUser?.username || 'Unknown Admin',
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
router.put('/users/:userId', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { permissions, role, dashboardAccess } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Get guild ID (using first guild for now)
    const client = getClient();
    const guildId = client?.guilds.cache.first()?.id || 'default';
    
    logInfo('AdminPanel', `Admin ${req.dashboardUser?.username} updating permissions for user ${userId}`);

    // Import the permissions functions
    const { saveDashboardPermissions, getDashboardPermissions } = await import('../database/migrations/add-dashboard-permissions');
    
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
    saveDashboardPermissions(userId, guildId, dashboardPermissions);
    
    // Verify the save
    const savedPermissions = getDashboardPermissions(userId, guildId);
    
    logInfo('AdminPanel', `Successfully updated permissions for user ${userId}: ${savedPermissions.join(', ')}`);

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
    res.status(500).json({
      success: false,
      error: 'Failed to update user permissions'
    });
  }
});

export default router; 