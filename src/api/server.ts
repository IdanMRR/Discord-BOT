import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as dotenv from 'dotenv';
import { ServerLogService, ServerSettingsService, WarningService, TicketService } from '../database/services/sqliteService';
import { logInfo, logError } from '../utils/logger';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.API_PORT || 3000;

// SQLite database is already initialized when imported
logInfo('API', 'API server connected to SQLite database');

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(apiLimiter);

// Authentication middleware
const authenticateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  next();
};

// Apply authentication to all API routes
const router = express.Router();
app.use('/api', authenticateRequest, router);

// Routes

// Server information
router.get('/servers', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await ServerSettingsService.listServers();
    
    if (error) {
      res.status(500).json({ error: 'Failed to fetch servers' });
      return;
    }
    
    res.json(data);
  } catch (error) {
    logError('API', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/servers/:guildId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    
    const server = await ServerSettingsService.getOrCreate(guildId, guildId);
    
    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }
    
    res.json(server);
  } catch (error) {
    logError('API', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Warnings
router.get('/servers/:guildId/warnings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const userId = req.query.userId as string;
    const active = req.query.active === 'true';
    
    const { data, error } = await WarningService.getWarnings(guildId, userId, active);
    
    if (error) {
      res.status(500).json({ error: 'Failed to fetch warnings' });
      return;
    }
    
    res.json(data);
  } catch (error) {
    logError('API', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Server logs
router.get('/servers/:guildId/logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const actionType = req.query.actionType as string;
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string || '50');
    const page = parseInt(req.query.page as string || '1');
    
    const { data, count, error } = await ServerLogService.getLogs(guildId, {
      actionType,
      userId,
      limit,
      page
    });
    
    if (error) {
      res.status(500).json({ error: 'Failed to fetch logs' });
      return;
    }
    
    res.json({
      logs: data,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logError('API', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Tickets
router.get('/servers/:guildId/tickets', async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params;
    const status = req.query.status as string;
    const userId = req.query.userId as string;
    
    const { data, error } = await TicketService.getTickets(guildId, status, userId);
    
    if (error) {
      res.status(500).json({ error: 'Failed to fetch tickets' });
      return;
    }
    
    res.json(data);
  } catch (error) {
    logError('API', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User statistics
router.get('/servers/:guildId/users/:userId/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, userId } = req.params;
    
    // Get warnings count
    const { activeCount, totalCount } = await WarningService.getWarningCounts(guildId, userId);
    
    // Get tickets count
    const { openCount, totalCount: ticketTotalCount } = await TicketService.getTicketCounts(guildId, userId);
    
    // Get moderation actions
    const { count: moderationActionsCount } = await ServerLogService.getModerationActionCount(guildId, userId);
    
    // Get recent activity
    const { data: recentActivity } = await ServerLogService.getRecentUserActivity(guildId, userId, 10);
    
    res.json({
      warnings: {
        active: activeCount,
        total: totalCount
      },
      tickets: {
        open: openCount,
        total: ticketTotalCount
      },
      moderationActions: moderationActionsCount,
      recentActivity
    });
  } catch (error) {
    logError('API', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
export function startApiServer(): void {
  app.listen(PORT, () => {
    logInfo('API', `API server running on port ${PORT}`);
  });
}

// If this file is run directly
if (require.main === module) {
  startApiServer();
}

export default app;
