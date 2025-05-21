import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ServerSettingsService, WarningService, TicketService } from '../database/services/sqliteService';
import { logInfo, logError } from '../utils/logger';
import { db } from '../database/sqlite';
import { getClient } from '../utils/client-utils';
import logsRouter from './logs';
import '../database/services/sqliteServiceExtensions';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
// Read API port from environment variables, fall back to 3001 if not set
const PORT = process.env.API_PORT || 3001;
console.log(`[API] Using port ${PORT} from environment variables or default`);

// SQLite database is already initialized when imported
logInfo('API', 'API server connected to SQLite database');

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "*"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "*"],
      connectSrc: ["'self'", "localhost:*", "127.0.0.1:*", "*"],
      imgSrc: ["'self'", "data:", "*"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "*"],
      fontSrc: ["'self'", "data:", "cdnjs.cloudflare.com", "*"]
    }
  }
})); // Security headers with relaxed CSP to allow Vue.js and external resources

// Enable CORS with a configuration that allows the dashboard to connect
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3003', 'http://127.0.0.1:3000', 'http://127.0.0.1:3003'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
  credentials: true
}));

// Add a specific header middleware for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
  next();
});

app.use(express.json()); // Parse JSON bodies

// Rate limiting - configured to work with proxied requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increase limit for development
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development mode
  skip: (req, res) => true, // Disable rate limiting for now to debug the API
});

// Trust proxy settings for Express
app.set('trust proxy', 1);
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

// Public API routes (no authentication required)
// Define server endpoints directly here to avoid module loading issues
app.get('/api/servers', (async (req: Request, res: Response) => {
  try {
    const client = getClient();
    if (!client) {
      res.status(500).json({ error: 'Discord client not available' });
    return;
    }
    
    const guilds = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      icon: guild.iconURL()
    }));
    
    // Add CORS headers to ensure the dashboard can access this
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    
    res.json(guilds);
  } catch (error) {
    logError('API', `Error getting servers: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
}) as RequestHandler);

// API Routes (protected by authentication)
app.use('/api/logs', logsRouter);

// Serve dashboard static files first (no authentication needed)
const dashboardPath = path.join(__dirname, '../../dashboard');
app.use('/dashboard', express.static(dashboardPath));

// Root route redirect to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard/vue-dashboard.html');
});

// Add a redirect from old dashboard to new vue dashboard
app.get('/dashboard', (req, res) => {
  res.redirect('/dashboard/vue-dashboard.html');
});

// Apply authentication to all API routes
const router = express.Router();
app.use('/api', authenticateRequest, router);

// Import and use our simplified dashboard routes with more careful route handling
const simpleDashboard = require('./simple-dashboard.js');

// Mount the simple-dashboard router at /api/dashboard
// This will make all routes in simple-dashboard.js available under /api/dashboard/*
app.use('/api/dashboard', simpleDashboard);

// Add test endpoints to verify the API is working
app.get('/api/status', (req, res) => {
  // Add CORS headers explicitly
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
  res.json({ status: 'ok', message: 'API is running' });
});

// Add a test endpoint specifically for CORS testing
app.get('/api/cors-test', (req, res) => {
  // Add CORS headers explicitly
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
  res.json({ success: true, message: 'CORS is working correctly', timestamp: new Date().toISOString() });
});

// Basic API test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'API route is working' });
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
