import express, { Request, Response, NextFunction } from 'express';
import { DashboardLogsService, DashboardLogFilter } from '../database/services/dashboardLogsService';
import { logInfo, logError } from '../utils/logger';

const router = express.Router();

// Helper function to send JSON responses
const sendJsonResponse = <T>(
  res: Response,
  statusCode: number,
  data: T
): void => {
  res.status(statusCode).json(data);
};

// Get dashboard logs with filtering and pagination
const getDashboardLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const filter: DashboardLogFilter = {
      user_id: req.query.user_id as string,
      action_type: req.query.action_type as string,
      page: req.query.page_name as string, // Use page_name to avoid conflict with pagination
      target_type: req.query.target_type as string,
      success: req.query.success !== undefined ? req.query.success === 'true' : undefined,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      limit,
      offset
    };

    const result = await DashboardLogsService.getLogs(filter);

    sendJsonResponse(res, 200, {
      success: true,
      data: {
        logs: result.logs,
        pagination: {
          total: result.total,
          page,
          limit,
          pages: Math.ceil(result.total / limit)
        }
      }
    });
  } catch (error) {
    logError('DashboardLogs API', `Error getting logs: ${error}`);
    next(error);
  }
};

// Get logs for a specific user
const getUserLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!userId) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    const logs = await DashboardLogsService.getUserLogs(userId, limit);

    sendJsonResponse(res, 200, {
      success: true,
      data: logs
    });
  } catch (error) {
    logError('DashboardLogs API', `Error getting user logs: ${error}`);
    next(error);
  }
};

// Get recent dashboard activity
const getRecentActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const limit = parseInt(req.query.limit as string) || 100;

    const logs = await DashboardLogsService.getRecentLogs(hours, limit);

    sendJsonResponse(res, 200, {
      success: true,
      data: logs
    });
  } catch (error) {
    logError('DashboardLogs API', `Error getting recent activity: ${error}`);
    next(error);
  }
};

// Get dashboard activity statistics
const getActivityStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;

    const stats = await DashboardLogsService.getActivityStats(hours);

    sendJsonResponse(res, 200, {
      success: true,
      data: stats
    });
  } catch (error) {
    logError('DashboardLogs API', `Error getting activity stats: ${error}`);
    next(error);
  }
};

// Manual log creation (for testing or special cases)
const createLogEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      user_id,
      username,
      action_type,
      page,
      target_type,
      target_id,
      details,
      success = true
    } = req.body;

    if (!user_id || !action_type || !page) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'user_id, action_type, and page are required'
      });
      return;
    }

    const logEntry = {
      user_id,
      username,
      action_type,
      page,
      target_type,
      target_id,
      details,
      success,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent')
    };

    const result = await DashboardLogsService.logActivity(logEntry);

    if (result) {
      sendJsonResponse(res, 201, {
        success: true,
        message: 'Log entry created successfully'
      });
    } else {
      sendJsonResponse(res, 500, {
        success: false,
        error: 'Failed to create log entry'
      });
    }
  } catch (error) {
    logError('DashboardLogs API', `Error creating log entry: ${error}`);
    next(error);
  }
};

// Clean old logs
const cleanOldLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daysOld = parseInt(req.query.days as string) || 30;
    
    // Only allow admin users to clean logs
    if (!req.user?.userId || req.user.userId !== 'dashboard') {
      sendJsonResponse(res, 403, {
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }

    const deletedCount = await DashboardLogsService.cleanOldLogs(daysOld);

    sendJsonResponse(res, 200, {
      success: true,
      data: {
        deletedCount,
        message: `Cleaned ${deletedCount} log entries older than ${daysOld} days`
      }
    });
  } catch (error) {
    logError('DashboardLogs API', `Error cleaning old logs: ${error}`);
    next(error);
  }
};

// Routes
router.get('/', getDashboardLogs);
router.get('/users/:userId', getUserLogs);
router.get('/recent', getRecentActivity);
router.get('/stats', getActivityStats);
router.post('/', createLogEntry);
router.delete('/cleanup', cleanOldLogs);

// Test endpoint to create a test log entry (no auth required for testing)
router.post('/test', async (req: Request, res: Response) => {
  try {
    // Get various time representations for debugging
    const now = new Date();
    const utcTime = now.toISOString();
    const israeliTimeFormatted = now.toLocaleString('sv-SE', { 
      timeZone: 'Asia/Jerusalem'
    }).replace(' ', 'T') + '+03:00';
    const israeliTimeSimple = now.toLocaleString('en-US', { 
      timeZone: 'Asia/Jerusalem',
      hour12: false
    });

    const testLogEntry = {
      user_id: 'test_user_123',
      username: 'Test User',
      action_type: 'test_action',
      page: 'test_page',
      target_type: 'test',
      target_id: 'test_123',
      details: `Test log entry created at Israeli time: ${israeliTimeSimple}`,
      success: true,
      ip_address: req.ip || req.connection?.remoteAddress || 'unknown',
      user_agent: req.get('User-Agent') || 'test-agent',
      guild_id: 'test_guild'
    };

    const result = await DashboardLogsService.logActivity(testLogEntry);
    
    if (result) {
      logInfo('DashboardLogs API', 'Test log entry created successfully');
      res.json({
        success: true,
        message: 'Test log entry created successfully',
        data: testLogEntry,
        debug: {
          utcTime,
          israeliTimeFormatted,
          israeliTimeSimple,
          storedAs: israeliTimeFormatted
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create test log entry'
      });
    }
  } catch (error) {
    logError('DashboardLogs API', `Error creating test log: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to create test log entry'
    });
  }
});

// Simple HTML viewer for dashboard logs (for testing)
router.get('/viewer', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    
    const result = await DashboardLogsService.getLogs({
      limit,
      offset,
      user_id: req.query.user_id as string,
      action_type: req.query.action_type as string
    });

    const totalPages = Math.ceil(result.total / limit);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Logs Viewer</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .log-entry { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 6px; background: white; }
        .log-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .log-action { font-weight: bold; color: #007bff; }
        .log-time { color: #666; font-size: 0.9em; }
        .log-user { color: #28a745; font-weight: 500; }
        .log-details { color: #333; margin-top: 8px; }
        .success { border-left: 4px solid #28a745; }
        .error { border-left: 4px solid #dc3545; }
        .pagination { text-align: center; margin-top: 20px; }
        .pagination a { display: inline-block; padding: 8px 12px; margin: 0 4px; text-decoration: none; background: #007bff; color: white; border-radius: 4px; }
        .pagination a:hover { background: #0056b3; }
        .current-page { background: #6c757d !important; }
        .timezone-info { background: #e7f3ff; padding: 10px; border-radius: 6px; margin-bottom: 20px; text-align: center; color: #0066cc; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Dashboard Activity Logs</h1>
        
        <div class="timezone-info">
            🇮🇱 All times shown in Israeli Time (Asia/Jerusalem)
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${result.total}</div>
                <div class="stat-label">Total Logs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${page}</div>
                <div class="stat-label">Current Page</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalPages}</div>
                <div class="stat-label">Total Pages</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Math.round((result.logs.filter(log => log.success).length / result.logs.length) * 100) || 0}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
        </div>

        <div class="logs">
            ${result.logs.map(log => {
              const date = new Date(log.created_at || '');
              const israeliDate = new Date(date.getTime() + (3 * 60 * 60 * 1000)); // Add 3 hours for Jerusalem timezone
              const now = new Date();
              const israeliNow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
              
              const diffInMinutes = Math.floor((israeliNow.getTime() - israeliDate.getTime()) / (1000 * 60));
              
              let timeDisplay;
              if (diffInMinutes < 1) {
                timeDisplay = 'Just now';
              } else if (diffInMinutes < 60) {
                timeDisplay = `${diffInMinutes}m ago`;
              } else if (diffInMinutes < 1440) {
                timeDisplay = `${Math.floor(diffInMinutes / 60)}h ago`;
              } else {
                // For anything over 24 hours, show full date and time in Jerusalem timezone
                timeDisplay = date.toLocaleString('en-GB', {
                  timeZone: 'Asia/Jerusalem',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
              }
              
              return `
                <div class="log-entry ${log.success ? 'success' : 'error'}">
                    <div class="log-header">
                        <span class="log-action">${log.action_type.replace(/_/g, ' ').toUpperCase()}</span>
                        <span class="log-time">${timeDisplay}</span>
                    </div>
                    <div class="log-user">👤 ${log.username || 'Unknown User'} (${log.user_id})</div>
                    <div class="log-details">
                        📄 Page: ${log.page}<br>
                        ${log.target_type ? `🎯 Target: ${log.target_type} (${log.target_id})<br>` : ''}
                        ${log.details ? `📝 Details: ${log.details}<br>` : ''}
                        ${log.guild_id ? `🏠 Guild: ${log.guild_id}<br>` : ''}
                        🌐 IP: ${log.ip_address || 'N/A'}
                    </div>
                </div>
              `;
            }).join('')}
        </div>

        <div class="pagination">
            ${page > 1 ? `<a href="?page=${page - 1}&limit=${limit}">← Previous</a>` : ''}
            ${Array.from({length: Math.min(5, totalPages)}, (_, i) => {
              const pageNum = Math.max(1, page - 2) + i;
              if (pageNum <= totalPages) {
                return `<a href="?page=${pageNum}&limit=${limit}" ${pageNum === page ? 'class="current-page"' : ''}>${pageNum}</a>`;
              }
              return '';
            }).join('')}
            ${page < totalPages ? `<a href="?page=${page + 1}&limit=${limit}">Next →</a>` : ''}
        </div>
        
        <div style="margin-top: 30px; text-align: center; color: #666; font-size: 0.9em;">
            <p>🔄 <a href="?page=${page}&limit=${limit}" style="color: #007bff;">Refresh</a> | 
            <a href="/api/dashboard-logs/test" style="color: #28a745;">Create Test Log</a></p>
        </div>
    </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logError('DashboardLogs Viewer', `Error rendering logs: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard logs'
    });
  }
});

// Error handling middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logError('DashboardLogs API', `Unhandled error: ${err.message}`);
  sendJsonResponse(res, 500, {
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default router;
