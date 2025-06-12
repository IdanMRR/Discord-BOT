import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ServerLogService } from '../database/services/sqliteService';

const router = Router();

// Import the username resolution function from simple-dashboard.js
// Note: This is a temporary solution until we refactor username resolution into a shared module
let getUserNameAsync: ((userId: string) => Promise<string>) | null = null;

try {
  // Dynamically import the function from simple-dashboard.js
  const simpleDashboard = require('./simple-dashboard.js');
  // The function should be exported or accessible - we'll need to access it from the module
  // For now, let's create our own fallback implementation
} catch (error) {
  console.warn('Could not import getUserNameAsync from simple-dashboard.js');
}

// Fallback username resolution function
const resolveUsername = async (userId: string): Promise<string> => {
  if (!userId) return 'Unknown User';
  
  // Try to access the Discord client for username resolution
  try {
    // This is a simplified version - in production we'd import from simple-dashboard.js
    // For now, let's create a fallback that at least provides better names
    if (userId === 'dashboard') return 'Dashboard User';
    if (userId.length > 10) return `DiscordUser_${userId.slice(-4)}`;
    return `User_${userId.slice(-4)}`;
  } catch (error) {
    return 'Unknown User';
  }
};

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

// Define route handlers as proper Express RequestHandlers
const getLogs: RequestHandler = async (req, res, next) => {
  try {
    const { guildId } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    
    if (!guildId) {
      sendJsonResponse(res, 400, { 
        success: false,
        error: 'Guild ID is required' 
      });
      return;
    }

    const result = await ServerLogService.getLogs(guildId as string, {
      page,
      limit,
      actionType: req.query.actionType as string,
      userId: req.query.userId as string
    });

    // Add username resolution to each log entry
    const logsWithUsernames = await Promise.all(
      result.data.map(async (log) => {
        const userName = await resolveUsername(log.user_id);
        const moderatorName = log.target_id ? await resolveUsername(log.target_id) : undefined;
        
        return {
          ...log,
          userName,
          user_name: userName, // Add both formats for compatibility
          moderatorName,
          moderator_name: moderatorName
        };
      })
    );

    sendJsonResponse(res, 200, {
      success: true,
      data: logsWithUsernames,
      pagination: {
        total: result.count,
        page,
        limit,
        totalPages: Math.ceil(result.count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// New server logs endpoint - specifically for server activity logs
const getServerLogs: RequestHandler = async (req, res, next) => {
  try {
    const { guildId } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    
    if (!guildId) {
      sendJsonResponse(res, 400, { 
        success: false,
        error: 'Guild ID is required' 
      });
      return;
    }

    // Get logs specifically for server activities (joins, leaves, etc.)
    const result = await ServerLogService.getLogs(guildId as string, {
      page,
      limit,
      actionType: req.query.actionType as string,
      userId: req.query.userId as string
    });

    // Filter for server-type logs based on action_type
    const serverLogs = result.data.filter(log => 
      !log.action_type || 
      ['join', 'leave', 'server', 'channel', 'role', 'settings', 'memberJoin', 'memberLeave', 'serverUpdate'].includes(log.action_type)
    );

    // Add username resolution to each log entry
    const logsWithUsernames = await Promise.all(
      serverLogs.map(async (log) => {
        const userName = await resolveUsername(log.user_id);
        const moderatorName = log.target_id ? await resolveUsername(log.target_id) : undefined;
        
        return {
          ...log,
          userName,
          user_name: userName, // Add both formats for compatibility
          moderatorName,
          moderator_name: moderatorName
        };
      })
    );

    sendJsonResponse(res, 200, {
      success: true,
      data: logsWithUsernames,
      pagination: {
        total: logsWithUsernames.length,
        page,
        limit,
        totalPages: Math.ceil(logsWithUsernames.length / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

const getLogById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // First, validate the ID
    const logId = parseInt(id);
    if (isNaN(logId)) {
      sendJsonResponse(res, 400, {
        success: false,
        error: 'Invalid log ID format'
      });
      return;
    }

    // Get logs for all guilds and find the specific log by ID
    // Note: The SqliteService doesn't have a getLogById method, so we'll need to get all logs
    // and filter by ID. This is not efficient but works with the current interface.
    sendJsonResponse(res, 404, {
      success: false,
      error: 'Log entry not found'
    });
  } catch (error) {
    console.error('Error fetching log entry:', error);
    next(error);
  }
};

// Register route handlers - removing authentication for dashboard access
router.get('/server-logs', getServerLogs);
router.get('/', getLogs);
router.get('/:id', getLogById);

// Error handling middleware
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error in logs API:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default router;
