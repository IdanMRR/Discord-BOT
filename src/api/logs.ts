import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth';
import ServerLogService from '../database/services/serverLogService';

const router = Router();

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
      userId: req.query.userId as string,
      channelId: req.query.channelId as string,
      search: req.query.search as string
    });

    sendJsonResponse(res, 200, {
      success: true,
      data: result.data,
      pagination: result.pagination
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

    const log = await ServerLogService.getLogById(logId);
    
    if (!log) {
      sendJsonResponse(res, 404, {
        success: false,
        error: 'Log entry not found'
      });
      return;
    }
    
    sendJsonResponse(res, 200, {
      success: true,
      data: log
    });
  } catch (error) {
    console.error('Error fetching log entry:', error);
    next(error);
  }
};

// Register route handlers
router.get('/', authenticateToken, getLogs);
router.get('/:id', authenticateToken, getLogById);

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
