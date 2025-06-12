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
