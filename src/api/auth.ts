import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logInfo, logError } from '../utils/logger';
import { getClient } from '../utils/client-utils';
import { getDashboardPermissions } from '../database/migrations/add-dashboard-permissions';

const router = express.Router();

// Simple configuration
const JWT_SECRET = 'discord-bot-dashboard-secret-key-2024';

// Function to fetch real Discord user data using the bot client
async function fetchDiscordUserData(userId: string) {
  try {
    const client = getClient();
    if (!client) {
      logError('Auth', 'Discord client not available');
      return null;
    }

    const user = await client.users.fetch(userId);
    if (!user) {
      logError('Auth', `User ${userId} not found`);
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      email: null // Email not available through bot client
    };
  } catch (error: any) {
    logError('Auth', `Error fetching Discord user ${userId}: ${error.message}`);
    return null;
  }
}

// Remove hardcoded admin IDs - use database permissions instead
const ADMIN_USER_IDS: string[] = [];

// Temporary storage for authentication codes (in production, use Redis or database)
const authCodes: Map<string, { userId: string; username: string; discriminator: string; avatar: string | null; expiresAt: number }> = new Map();

// Processed OAuth codes to prevent duplicate processing
const processedCodes: Set<string> = new Set();

// Clean up old processed codes every 10 minutes
setInterval(() => {
  processedCodes.clear();
}, 10 * 60 * 1000);

// Remove hardcoded user data - use Discord API for real data
const MOCK_USERS: { [key: string]: any } = {};

// Check if Discord OAuth is properly configured
const isDiscordOAuthConfigured = () => {
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  return clientSecret && clientSecret !== 'your_client_secret_here';
};

// Rate limiting for auth requests
const authAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();

// Clean up rate limiting data every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of authAttempts.entries()) {
    if (now - data.lastAttempt > 5 * 60 * 1000) { // 5 minutes
      authAttempts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Rate limiting middleware for auth routes
const authRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const current = authAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  
  // Reset count if more than 1 minute has passed
  if (now - current.lastAttempt > 60 * 1000) {
    current.count = 0;
  }
  
  // Allow max 5 attempts per minute
  if (current.count >= 5 && now - current.lastAttempt < 60 * 1000) {
    logError('Auth', `Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({
      success: false,
      error: 'Too many authentication attempts. Please wait a moment.'
    });
  }
  
  current.count++;
  current.lastAttempt = now;
  authAttempts.set(ip, current);
  
  next();
};

// Generate authentication URL/instructions
router.get('/discord', (req: Request, res: Response) => {
  try {
    // Generate a random code for authentication
    const authCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    logInfo('Auth', `Generated auth code: ${authCode}`);
    
    res.json({
      success: true,
      data: { 
        url: `discord://auth/${authCode}`, // This will be handled by the frontend
        authCode: authCode,
        instructions: 'Send a message to the bot or use the authentication method'
      }
    });
  } catch (error: any) {
    logError('Auth', `Error generating auth instructions: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate authentication instructions'
    });
  }
});

// Simplified authentication endpoint
router.post('/discord/simple', (req: Request, res: Response) => {
  try {
    const { userId, username } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    logInfo('Auth', `Simple Discord authentication for user: ${userId}`);

    // Check if user is admin
    const isAdmin = ADMIN_USER_IDS.includes(userId);
    
    // Create user object (use mock data or fetch from your bot)
    const user = MOCK_USERS[userId] || {
      id: userId,
      username: username || `User_${userId.slice(-4)}`,
      discriminator: '0000',
      avatar: null,
      email: null
    };

    // Add admin status and permissions
    const userWithPermissions = {
      ...user,
      isAdmin,
      permissions: isAdmin ? ['admin', 'manage_tickets', 'manage_warnings', 'manage_settings', 'view_logs'] : ['view_tickets', 'view_warnings']
    };

    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user.id, isAdmin: isAdmin, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logInfo('Auth', `Successfully authenticated user: ${user.username}#${user.discriminator} (${user.id})`);
    
    res.json({
      success: true,
      data: {
        token: jwtToken,
        user: userWithPermissions
      }
    });
  } catch (error: any) {
    logError('Auth', `Error in simple Discord authentication: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Failed to authenticate'
    });
  }
});

// Development mode login endpoint
router.post('/dev-login', async (req: Request, res: Response) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Development login not available in production'
      });
    }

    logInfo('Auth', 'Development mode login for Soggra - fetching real Discord data...');

    // Try to fetch real Discord user data first
    const realUserData = await fetchDiscordUserData('471204846855258123');
    
    let user;
    if (realUserData) {
      logInfo('Auth', `Successfully fetched real Discord data for ${realUserData.username}`);
      user = {
        id: realUserData.id,
        username: realUserData.username,
        discriminator: realUserData.discriminator,
        avatar: realUserData.avatar,
        email: 'soggra@example.com', // Keep email as fallback
        isAdmin: true,
        permissions: ['admin', 'manage_tickets', 'manage_warnings', 'manage_settings', 'view_logs']
      };
    } else {
      logInfo('Auth', 'Could not fetch real Discord data, using fallback user data');
      // Fallback to mock data if Discord client unavailable
      user = {
        id: '471204846855258123',
        username: 'Soggra',
        discriminator: '0',
        avatar: '71d55b3c1aa02b6dcd3d3e1bd58bc850', // Fallback avatar hash
        email: 'soggra@example.com',
        isAdmin: true,
        permissions: ['admin', 'manage_tickets', 'manage_warnings', 'manage_settings', 'view_logs']
      };
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user.id, isAdmin: user.isAdmin, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logInfo('Auth', `Successfully authenticated ${user.username} in development mode`);
    
    res.json({
      success: true,
      data: {
        token: jwtToken,
        user: user
      }
    });
  } catch (error: any) {
    logError('Auth', `Error in development login: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Failed to authenticate'
    });
  }
});

// Handle Discord OAuth callback (real implementation)
router.post('/discord/callback', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }
    
    // Check if this code has already been processed
    if (processedCodes.has(code)) {
      logInfo('Auth', `OAuth code already processed: ${code.substring(0, 10)}...`);
      return res.status(400).json({
        success: false,
        error: 'Authorization code has already been used'
      });
    }
    
    // Mark code as being processed
    processedCodes.add(code);
    
    logInfo('Auth', `Processing Discord OAuth code: ${code.substring(0, 10)}...`);

    // Check if Discord OAuth is properly configured
    if (!isDiscordOAuthConfigured()) {
      logInfo('Auth', 'Discord OAuth not configured, falling back to development user');
      
      // Try to fetch real Discord user data first
      const realUserData = await fetchDiscordUserData('471204846855258123');
      
      let mockUser;
      if (realUserData) {
        logInfo('Auth', `Using real Discord data for ${realUserData.username}`);
        mockUser = {
          id: realUserData.id,
          username: realUserData.username,
          discriminator: realUserData.discriminator,
          avatar: realUserData.avatar,
          email: 'soggra@example.com'
        };
      } else {
        logInfo('Auth', 'Using fallback user data');
        mockUser = {
          id: '471204846855258123',
          username: 'Soggra',
          discriminator: '0',
          avatar: '71d55b3c1aa02b6dcd3d3e1bd58bc850',
          email: 'soggra@example.com'
        };
      }

      const isAdmin = ADMIN_USER_IDS.includes(mockUser.id);
      
      const user = {
        ...mockUser,
        isAdmin,
        permissions: isAdmin ? ['admin', 'manage_tickets', 'manage_warnings', 'manage_settings', 'view_logs'] : ['view_tickets', 'view_warnings']
      };

      const jwtToken = jwt.sign(
        { userId: user.id, isAdmin: user.isAdmin, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        data: {
          token: jwtToken,
          user: user
        }
      });
    }

    // Discord OAuth configuration - Updated with correct client ID
    const DISCORD_CLIENT_ID = '1368637479653216297'; // BotAI's actual client ID
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    
    // Environment-based redirect URI for production/development
    const DISCORD_REDIRECT_URI = process.env.NODE_ENV === 'production' 
      ? (process.env.PRODUCTION_DOMAIN ? `${process.env.PRODUCTION_DOMAIN}/login` : 'https://yourdomain.com/login')
      : 'http://localhost:3002/login';

    try {
      // Step 1: Exchange authorization code for access token
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET!,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: DISCORD_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        logError('Auth', `Token exchange failed: ${errorData}`);
        throw new Error('Token exchange failed');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Step 2: Fetch user information from Discord API
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!userResponse.ok) {
        logError('Auth', `Failed to fetch user data: ${userResponse.status}`);
        throw new Error('Failed to fetch user data');
      }

      const discordUser = await userResponse.json();
      
      // Check if user is admin
      const isAdmin = ADMIN_USER_IDS.includes(discordUser.id);
      
      const user = {
        id: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator || '0',
        avatar: discordUser.avatar,
        email: discordUser.email,
        isAdmin,
        permissions: isAdmin ? ['admin', 'manage_tickets', 'manage_warnings', 'manage_settings', 'view_logs'] : ['view_tickets', 'view_warnings']
      };

      // Generate JWT token
      const jwtToken = jwt.sign(
        { userId: user.id, isAdmin: user.isAdmin, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      logInfo('Auth', `Successfully authenticated Discord user: ${user.username}#${user.discriminator} (${user.id})`);
    
      res.json({
        success: true,
        data: {
          token: jwtToken,
          user: user
        }
      });

    } catch (discordError: any) {
      logError('Auth', `Discord API error: ${discordError.message}`);
      
      // Fallback to demo user for development
      logInfo('Auth', 'Falling back to demo user due to Discord API error');
      
      // Try to fetch real Discord user data first
      const realUserData = await fetchDiscordUserData('471204846855258123');
      
      let mockUser;
      if (realUserData) {
        logInfo('Auth', `Using real Discord data for ${realUserData.username}`);
        mockUser = {
          id: realUserData.id,
          username: realUserData.username,
          discriminator: realUserData.discriminator,
          avatar: realUserData.avatar,
          email: 'soggra@example.com'
        };
      } else {
        logInfo('Auth', 'Using fallback user data');
        mockUser = {
          id: '471204846855258123',
          username: 'Soggra',
          discriminator: '0',
          avatar: '71d55b3c1aa02b6dcd3d3e1bd58bc850',
          email: 'soggra@example.com'
        };
      }

      const isAdmin = ADMIN_USER_IDS.includes(mockUser.id);
      
      const user = {
        ...mockUser,
        isAdmin,
        permissions: isAdmin ? ['admin', 'manage_tickets', 'manage_warnings', 'manage_settings', 'view_logs'] : ['view_tickets', 'view_warnings']
      };

      const jwtToken = jwt.sign(
        { userId: user.id, isAdmin: user.isAdmin, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        data: {
          token: jwtToken,
          user: user
        }
      });
    }
  } catch (error: any) {
    logError('Auth', `Error handling Discord OAuth callback: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Failed to authenticate'
    });
  }
});

// Store authentication data (for bot integration)
router.post('/store-auth', (req: Request, res: Response) => {
  try {
    const { code, userId, username, discriminator, avatar } = req.body;
    
    if (!code || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Code and userId are required'
      });
    }

    // Store auth data with 10 minute expiration
    authCodes.set(code, {
      userId,
      username: username || `User_${userId.slice(-4)}`,
      discriminator: discriminator || '0000',
      avatar: avatar || null,
      expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
    });

    logInfo('Auth', `Stored auth code for user ${username}#${discriminator} (${userId})`);
    
    res.json({
      success: true,
      message: 'Authentication data stored successfully'
    });
  } catch (error: any) {
    logError('Auth', `Error storing auth data: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to store authentication data'
    });
  }
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No valid authorization token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Get guild ID from request headers or use a default
      // For now, we'll use the first guild the bot is in as the context
      // In a production app, you might want to pass guild ID in the request
      const client = getClient();
      const guildId = client?.guilds.cache.first()?.id || 'default';
      
      logInfo('Auth', `Getting permissions for user ${decoded.userId} in guild ${guildId}`);
      
      // Get permissions from database
      const userPermissions = await getPermissions(decoded.userId, guildId);
      
      logInfo('Auth', `Database permissions for user ${decoded.userId}: ${userPermissions.join(', ')}`);
      
      // Check if user is admin based on permissions or hardcoded list (fallback)
      const isAdminByHardcode = ADMIN_USER_IDS.includes(decoded.userId);
      const isAdminByPermissions = userPermissions.includes('admin') || userPermissions.includes('system_admin');
      const isAdmin = isAdminByHardcode || isAdminByPermissions;
      
      logInfo('Auth', `Admin check for user ${decoded.userId}: hardcoded=${isAdminByHardcode}, permissions=${isAdminByPermissions}, final=${isAdmin}`);
      
      // Try to fetch real Discord user data
      const realUserData = await fetchDiscordUserData(decoded.userId);
      
      // Only users with database permissions get any access
      // Empty permissions array means no dashboard access
      const finalPermissions = userPermissions;
      
      logInfo('Auth', `Final permissions for user ${decoded.userId}: ${finalPermissions.join(', ')}`);
      
      // Log which guild we're using for context
      logInfo('Auth', `Using guild ${guildId} for permission context`);
      
      let user;
      if (realUserData) {
        logInfo('Auth', `Fetched real Discord data for ${realUserData.username}`);
        user = {
          id: realUserData.id,
          username: realUserData.username,
          discriminator: realUserData.discriminator,
          avatar: realUserData.avatar,
          email: null,
          isAdmin,
          permissions: finalPermissions
        };
      } else {
        // Fallback to token data with default avatar
        user = {
          id: decoded.userId,
          username: decoded.username || `User_${decoded.userId.slice(-4)}`,
          discriminator: '0000',
          avatar: null, // Remove hardcoded avatar check
          email: null,
          isAdmin,
          permissions: finalPermissions
        };
      }

      res.json({
        success: true,
        data: user
      });
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  } catch (error: any) {
    logError('Auth', `Error getting current user: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Initial setup endpoint - allows the first user to grant themselves admin permissions
router.post('/setup-admin', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No valid authorization token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    const client = getClient();
    const guildId = client?.guilds.cache.first()?.id || 'default';
    
    // Check if any admin users already exist
    const { getAllDashboardPermissions } = await import('../database/migrations/add-dashboard-permissions');
    const existingAdmins = getAllDashboardPermissions(guildId).filter(userPerm => 
      userPerm.permissions.includes('admin') || 
      userPerm.permissions.includes('system_admin')
    );
    
    if (existingAdmins.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'Admin users already exist. Use the /dashboard-perms command to manage permissions.'
      });
    }
    
    // Grant admin permissions to this user
    const { saveDashboardPermissions } = await import('../database/migrations/add-dashboard-permissions');
    const adminPermissions = ['admin', 'system_admin', 'manage_users', 'manage_tickets', 'manage_warnings', 'manage_settings', 'view_logs', 'view_tickets', 'view_warnings', 'view_dashboard', 'moderate_users', 'manage_roles'];
    
    logInfo('Auth', `Granting admin permissions to user ${decoded.userId} in guild ${guildId}: ${adminPermissions.join(', ')}`);
    
    saveDashboardPermissions(decoded.userId, guildId, adminPermissions);
    
    logInfo('Auth', `Successfully granted initial admin permissions to user ${decoded.userId} in guild ${guildId}`);
    
    // Verify the permissions were saved
    const { getDashboardPermissions } = await import('../database/migrations/add-dashboard-permissions');
    const verifyPermissions = getDashboardPermissions(decoded.userId, guildId);
    logInfo('Auth', `Verification - permissions saved for user ${decoded.userId}: ${verifyPermissions.join(', ')}`);
    
    res.json({
      success: true,
      message: 'Admin permissions granted successfully! You now have full access to the dashboard.',
      permissions: adminPermissions
    });
    
  } catch (error: any) {
    logError('Auth', `Error in setup-admin: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Debug endpoint to check database permissions
router.get('/debug-permissions', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No valid authorization token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    const client = getClient();
    const guildId = client?.guilds.cache.first()?.id || 'default';
    
    const { getDashboardPermissions, getAllDashboardPermissions } = await import('../database/migrations/add-dashboard-permissions');
    const { db } = await import('../database/sqlite');
    
    // Get current user's permissions
    const userPermissions = getDashboardPermissions(decoded.userId, guildId);
    
    // Get all permissions in the guild
    const allPermissions = getAllDashboardPermissions(guildId);
    
    // Check if table exists and get schema
    const tableInfo = db.prepare("PRAGMA table_info(dashboard_permissions)").all();
    
    // Get all rows from the table
    const allRows = db.prepare("SELECT * FROM dashboard_permissions WHERE guild_id = ?").all(guildId);
    
    res.json({
      success: true,
      data: {
        currentUser: {
          userId: decoded.userId,
          guildId: guildId,
          permissions: userPermissions
        },
        allUsers: allPermissions,
        tableSchema: tableInfo,
        rawRows: allRows,
        isAdmin: ADMIN_USER_IDS.includes(decoded.userId)
      }
    });
    
  } catch (error: any) {
    logError('Auth', `Error in debug-permissions: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Debug: Catch-all route to see what requests are coming in
router.all('*', (req: Request, res: Response) => {
  logError('Auth', `Unknown auth endpoint requested: ${req.method} ${req.path} - Full URL: ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: `Auth endpoint not found: ${req.path}`,
    method: req.method,
    originalUrl: req.originalUrl
  });
});

async function getPermissions(userId: string, guildId?: string): Promise<string[]> {
  try {
    // Get permissions from database instead of generating fake ones
    const dbPermissions = getDashboardPermissions(userId, guildId || 'default');
    
    if (!dbPermissions || !Array.isArray(dbPermissions)) {
      console.log(`[INFO][Auth] No database permissions found for user ${userId}, returning empty permissions`);
      return []; // Return empty permissions instead of defaults
    }
    
    console.log(`[INFO][Auth] Retrieved permissions for user ${userId}:`, dbPermissions);
    return dbPermissions;
  } catch (error) {
    console.error('[ERROR][Auth] Error getting permissions:', error);
    return []; // Return empty permissions on error
  }
}

export default router;
