import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getAllUserDashboardPermissions } from '../database/migrations/add-dashboard-permissions';

interface JwtPayload {
  userId: string;
  guildId: string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        serverPermissions?: { [guildId: string]: string[] };
        accessibleServers?: Array<{ id: string; name: string; permissions: string[] }>;
      };
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Check for API key first (for dashboard access)
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_KEY || 'f8e7d6c5b4a3928170615243cba98765';
  
  // If API key is provided and matches expected value, allow access
  if (apiKey && apiKey === expectedApiKey) {
    console.log('Request authenticated via API key');
    
    // For API key authentication, we need to get the user ID from the request
    // This should come from the frontend after OAuth login
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      res.status(401).json({ error: 'User ID required for dashboard access' });
      return;
    }
    
    try {
      // Get server-specific permissions for this user
      const permissions = getAllUserDashboardPermissions(userId);
      
      // Add user info with server-specific permissions
      req.user = {
        userId: userId,
        guildId: req.query.guildId as string || 'all',
        serverPermissions: permissions.serverPermissions,
        accessibleServers: permissions.accessibleServers
      };
      
      return next();
    } catch (error) {
      console.error('Error getting user permissions:', error);
      res.status(500).json({ error: 'Failed to get user permissions' });
      return;
    }
  }
  
  // Otherwise, proceed with token-based authentication
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'discord-dashboard-jwt-secret-2024-secure-key';
    console.log('🔐 Middleware using JWT_SECRET:', jwtSecret.substring(0, 20) + '...');
    
    // Add more specific error handling for JWT verification
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    } catch (jwtError: any) {
      // Only log JWT errors in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('[Auth] JWT validation failed:', jwtError.name, jwtError.message);
      }
      
      // Clear the invalid token by responding with specific error
      if (jwtError.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Invalid token format', shouldClearToken: true });
      } else if (jwtError.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired', shouldClearToken: true });
      } else {
        res.status(401).json({ error: 'Token verification failed', shouldClearToken: true });
      }
      return;
    }
    
    // Get server-specific permissions for this user
    const permissions = getAllUserDashboardPermissions(decoded.userId);
    
    req.user = {
      ...decoded,
      serverPermissions: permissions.serverPermissions,
      accessibleServers: permissions.accessibleServers
    };
    
    next();
  } catch (error) {
    console.error('Unexpected error in auth middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
};
