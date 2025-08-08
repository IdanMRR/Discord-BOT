import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDashboardPermissions } from '../database/migrations/add-dashboard-permissions';
import { logInfo, logError } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'discord-dashboard-jwt-secret-2024-secure-key';

interface ServerJwtPayload {
  userId: string;
  guildId?: string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      serverUser?: ServerJwtPayload;
      userPermissions?: Record<string, string[]>; // Server-specific permissions
      hasServerAccess?: (guildId: string, requiredPermission?: string) => boolean;
    }
  }
}

// Middleware to check if user has access to specific server
export const checkServerAccess = (requiredPermission?: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check for API key first (for dashboard access)
      const apiKey = req.headers['x-api-key'];
      const expectedApiKey = process.env.API_KEY || 'f8e7d6c5b4a3928170615243cba98765';
      
      let decoded: ServerJwtPayload;
      
      // If API key is provided and matches expected value, use API key authentication
      if (apiKey && apiKey === expectedApiKey) {
        const userId = req.headers['x-user-id'] as string;
        
        if (!userId) {
          res.status(401).json({
            success: false,
            error: 'User ID required for dashboard access'
          });
          return;
        }
        
        decoded = { userId: userId };
      } else {
        // Otherwise, proceed with token-based authentication
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({
            success: false,
            error: 'No valid authorization token provided'
          });
          return;
        }

        const token = authHeader.substring(7);
        decoded = jwt.verify(token, JWT_SECRET) as ServerJwtPayload;
      }
      
      // Get server ID from request (query, params, or body)
      const guildId = req.query.guildId as string || 
                     req.query.serverId as string ||
                     req.params.guildId as string || 
                     req.params.serverId as string ||
                     req.body.guildId as string ||
                     req.body.serverId as string;

      if (!guildId) {
        res.status(400).json({
          success: false,
          error: 'Server ID (guildId) is required'
        });
        return;
      }

      // Get user's permissions for this specific server
      const userPermissions = getDashboardPermissions(decoded.userId, guildId);
      
      if (!userPermissions || !Array.isArray(userPermissions) || userPermissions.length === 0) {
        logInfo('ServerAuth', `User ${decoded.userId} has no permissions for server ${guildId}`);
        res.status(403).json({
          success: false,
          error: 'No permissions for this server'
        });
        return;
      }

      // Check specific permission if required
      if (requiredPermission && !userPermissions.includes(requiredPermission)) {
        logInfo('ServerAuth', `User ${decoded.userId} lacks required permission '${requiredPermission}' for server ${guildId}`);
        res.status(403).json({
          success: false,
          error: `Missing required permission: ${requiredPermission}`
        });
        return;
      }

      // Add user info and helper function to request
      req.serverUser = decoded;
      req.userPermissions = { [guildId]: userPermissions };
      req.hasServerAccess = (checkGuildId: string, checkPermission?: string) => {
        if (checkGuildId !== guildId) return false;
        if (!checkPermission) return true;
        return userPermissions.includes(checkPermission);
      };

      logInfo('ServerAuth', `User ${decoded.userId} authorized for server ${guildId} with permissions: ${userPermissions.join(', ')}`);
      next();
    } catch (error: any) {
      logError('ServerAuth', `Error checking server access: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

// Middleware to get all servers user has access to
export const getUserServers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No valid authorization token provided'
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as ServerJwtPayload;
    
    // Get all servers user has access to
    const { getClient } = await import('../utils/client-utils');
    const client = getClient();
    const userServers: Array<{id: string, name: string, permissions: string[]}> = [];
    
    if (client && client.guilds.cache.size > 0) {
      for (const guild of client.guilds.cache.values()) {
        const guildPermissions = getDashboardPermissions(decoded.userId, guild.id);
        
        if (guildPermissions && Array.isArray(guildPermissions) && guildPermissions.length > 0) {
          userServers.push({
            id: guild.id,
            name: guild.name,
            permissions: guildPermissions
          });
        }
      }
    }

    if (userServers.length === 0) {
      res.status(403).json({
        success: false,
        error: 'No server access found'
      });
      return;
    }

    // Add to request for use in route handlers
    req.serverUser = decoded;
    req.userPermissions = userServers.reduce((acc, server) => {
      acc[server.id] = server.permissions;
      return acc;
    }, {} as Record<string, string[]>);

    logInfo('ServerAuth', `User ${decoded.userId} has access to ${userServers.length} servers`);
    next();
  } catch (error: any) {
    logError('ServerAuth', `Error getting user servers: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}; 