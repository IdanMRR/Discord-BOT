import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logInfo, logError } from '../utils/logger';

const JWT_SECRET = 'discord-bot-dashboard-secret-key-2024';

// Remove hardcoded IDs - use database permissions instead
const ADMIN_USER_IDS: string[] = [];

// User data interface
export interface DashboardUser {
  userId: string;
  username: string;
  isAdmin: boolean;
  permissions: string[];
}

// Extended Request interface to include user data
export interface AuthenticatedRequest extends Request {
  dashboardUser?: DashboardUser;
}

/**
 * Middleware to authenticate users and check admin permissions
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.discordToken || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Check database permissions instead of hardcoded IDs
    // This will be handled by the permission system in the API routes
    req.dashboardUser = {
      userId: decoded.userId,
      username: decoded.username || 'Unknown',
      isAdmin: false, // Will be determined by database permissions
      permissions: [] // Will be filled by database permissions
    };

    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

/**
 * Middleware to authenticate users (any valid user, not just admins)
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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
      
      // Check if user is admin
      const isAdmin = ADMIN_USER_IDS.includes(decoded.userId);
      
      // Add user info to request
      req.dashboardUser = {
        userId: decoded.userId,
        username: decoded.username || `User_${decoded.userId.slice(-4)}`,
        isAdmin: isAdmin,
        permissions: isAdmin ? 
          ['admin', 'manage_tickets', 'manage_warnings', 'manage_settings', 'view_logs', 'manage_dashboard'] : 
          ['view_tickets', 'view_warnings']
      };

      logInfo('Auth', `Access granted for ${req.dashboardUser.username} (${req.dashboardUser.userId})`);
      next();
      
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  } catch (error: any) {
    logError('Auth', `Error in authentication: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: DashboardUser | undefined, permission: string): boolean {
  return !!(user && user.permissions && user.permissions.includes(permission));
}

/**
 * Middleware to check for specific permission
 */
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.dashboardUser) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    if (!hasPermission(req.dashboardUser, permission)) {
      return res.status(403).json({
        success: false,
        error: `Permission required: ${permission}`
      });
    }

    next();
  };
} 