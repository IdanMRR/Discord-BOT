import { Request, Response, NextFunction } from 'express';
import { DashboardLogsService, DashboardLogEntry } from '../database/services/dashboardLogsService';
import { logInfo, logError } from '../utils/logger';
import jwt from 'jsonwebtoken';

// Map HTTP methods to action types - only log meaningful actions
function getActionType(method: string, path: string): string | null {
  const pathLower = path.toLowerCase();
  
  switch (method.toUpperCase()) {
    case 'GET':
      // Log important viewing activities
      if (pathLower.includes('/export') || pathLower.includes('/download')) return 'export_data';
      if (pathLower.includes('/transcript')) return 'view_transcript';
      if (pathLower.includes('/tickets/') && pathLower.match(/\/tickets\/\d+$/)) return 'view_ticket';
      if (pathLower.includes('/warnings/') && pathLower.match(/\/warnings\/\d+$/)) return 'view_warning';
      if (pathLower.includes('/logs') && !pathLower.includes('/dashboard-logs')) return 'view_logs';
      if (pathLower.includes('/members/') && pathLower.match(/\/members\/\d+$/)) return 'view_member';
      if (pathLower.includes('/servers/') && pathLower.match(/\/servers\/\d+$/)) return 'view_server';
      // Skip general page views and API calls
      return null;
    
    case 'POST':
      if (pathLower.includes('/tickets')) return 'create_ticket';
      if (pathLower.includes('/warnings')) return 'create_warning';
      if (pathLower.includes('/ban')) return 'ban_user';
      if (pathLower.includes('/kick')) return 'kick_user';
      if (pathLower.includes('/mute')) return 'mute_user';
      if (pathLower.includes('/role')) return 'assign_role';
      if (pathLower.includes('/channel')) return 'create_channel';
      if (pathLower.includes('/category')) return 'create_category';
      if (pathLower.includes('/webhook')) return 'create_webhook';
      if (pathLower.includes('/remove')) return 'remove_warning'; // For warning removal
      if (pathLower.includes('/transcript')) return 'generate_transcript';
      return 'create_resource';
    
    case 'PUT':
    case 'PATCH':
      if (pathLower.includes('/tickets/') && pathLower.includes('/close')) return 'close_ticket';
      if (pathLower.includes('/tickets/') && pathLower.includes('/reopen')) return 'reopen_ticket';
      if (pathLower.includes('/tickets')) return 'update_ticket';
      if (pathLower.includes('/warnings')) return 'update_warning';
      if (pathLower.includes('/settings')) return 'update_server_settings';
      if (pathLower.includes('/servers')) return 'update_server';
      if (pathLower.includes('/members')) return 'update_member';
      if (pathLower.includes('/roles')) return 'update_roles';
      if (pathLower.includes('/channels')) return 'update_channel';
      if (pathLower.includes('/permissions')) return 'update_permissions';
      return 'update_resource';
    
    case 'DELETE':
      if (pathLower.includes('/tickets')) return 'delete_ticket';
      if (pathLower.includes('/warnings')) return 'delete_warning';
      if (pathLower.includes('/messages')) return 'delete_message';
      if (pathLower.includes('/channels')) return 'delete_channel';
      if (pathLower.includes('/roles')) return 'delete_role';
      return 'delete_resource';
    
    default:
      return null; // Don't log unknown methods
  }
}

// Extract page name from path
function extractPageName(path: string): string {
  const pathSegments = path.split('/').filter(segment => segment && segment !== 'api');
  
  if (pathSegments.length === 0) return 'dashboard';
  
  const firstSegment = pathSegments[0];
  
  // Map common API endpoints to page names
  switch (firstSegment) {
    case 'dashboard':
      return 'dashboard';
    case 'tickets':
      return 'tickets';
    case 'warnings':
      return 'warnings';
    case 'servers':
      return 'servers';
    case 'logs':
      return 'logs';
    case 'settings':
      return 'settings';
    case 'profile':
      return 'profile';
    case 'members':
      return 'members';
    case 'moderation':
      return 'moderation';
    case 'channels':
      return 'channels';
    case 'roles':
      return 'roles';
    default:
      return firstSegment;
  }
}

// Extract target information from request
function extractTargetInfo(req: Request): { targetType?: string; targetId?: string; guildId?: string } {
  const path = req.path;
  const params = req.params;
  const query = req.query;
  
  let result: { targetType?: string; targetId?: string; guildId?: string } = {};
  
  // Add null check for params before accessing its properties
  if (params && typeof params === 'object') {
    // Extract from URL parameters
    if (params.id) {
      if (path.includes('/tickets/')) {
        result = { targetType: 'ticket', targetId: params.id };
      } else if (path.includes('/warnings/')) {
        result = { targetType: 'warning', targetId: params.id };
      } else if (path.includes('/servers/')) {
        result = { targetType: 'server', targetId: params.id, guildId: params.id };
      }
    }
    
    if (params.serverId) {
      result = { targetType: 'server', targetId: params.serverId, guildId: params.serverId };
    }
    
    if (params.ticketId) {
      result = { targetType: 'ticket', targetId: params.ticketId };
    }
  }
  
  // Extract from query parameters
  if (query && typeof query === 'object') {
    if (query.serverId) {
      result = { ...result, targetType: 'server', targetId: query.serverId as string, guildId: query.serverId as string };
    }
    
    // Check for guild_id in query parameters
    if (query.guild_id) {
      result = { ...result, guildId: query.guild_id as string };
    }
    
    if (query.guildId) {
      result = { ...result, guildId: query.guildId as string };
    }
  }
  
  return result;
}

// Extract old and new values for updates
function extractValues(req: Request, res: Response): { oldValue?: string; newValue?: string } {
  const method = req.method.toUpperCase();
  
  if (method === 'PUT' || method === 'PATCH') {
    const newValue = req.body ? JSON.stringify(req.body) : undefined;
    
    // Note: We can't easily get old values without additional database queries
    // This could be enhanced by modifying API endpoints to include old values
    return { newValue };
  }
  
  return {};
}

// Extract user information from request
function extractUserInfo(req: Request): { userId: string; username?: string } {
  // Try different ways to get user info with proper null checks
  try {
    // Check session first
    const sessionReq = req as any; // Type assertion for session access
    if (sessionReq.session && sessionReq.session.user && typeof sessionReq.session.user === 'object') {
      const sessionUser = sessionReq.session.user;
      if (sessionUser && sessionUser.id && typeof sessionUser.id === 'string') {
        return {
          userId: sessionUser.id,
          username: sessionUser.username || sessionUser.global_name || undefined
        };
      }
    }
    
    // Check req.user property
    if (req.user && typeof req.user === 'object') {
      const user = req.user as any;
      
      // Check if user has userId property
      if (user && user.userId && typeof user.userId === 'string') {
        return {
          userId: user.userId,
          username: user.username || user.global_name || undefined
        };
      }
      
      // Check if user has id property
      if (user && user.id && typeof user.id === 'string') {
        return {
          userId: user.id,
          username: user.username || user.global_name || undefined
        };
      }
    }
    
    // Try authentication headers
    if (req.headers && req.headers.authorization && typeof req.headers.authorization === 'string') {
      // Extract from Bearer token if available
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7); // Remove 'Bearer ' prefix
          const JWT_SECRET = process.env.JWT_SECRET || 'discord-dashboard-jwt-secret-2024-secure-key';
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          
          if (decoded && decoded.userId && typeof decoded.userId === 'string') {
            return {
              userId: decoded.userId,
              username: decoded.username || undefined
            };
          }
        } catch (jwtError) {
          // Only log JWT errors in debug mode or for specific error types
          if (process.env.NODE_ENV === 'development') {
            const errorMessage = jwtError instanceof Error ? jwtError.message : String(jwtError);
            logInfo('DashboardLogger', `JWT token validation failed: ${errorMessage}`);
          }
        }
      }
    }
    
    // Fallback: try to get from headers or other sources
    const userIdFromHeader = req.headers?.['x-user-id'];
    if (userIdFromHeader && typeof userIdFromHeader === 'string' && userIdFromHeader.length > 0) {
      return {
        userId: userIdFromHeader,
        username: (req.headers?.['x-username'] as string) || undefined
      };
    }
    
    // Check if there's a Discord OAuth state
    if (req.query && typeof req.query === 'object' && req.query.code && req.query.state) {
      // This is likely an OAuth callback, use a placeholder
      return {
        userId: 'oauth_pending',
        username: 'OAuth User'
      };
    }
    
    // Final fallback - check cookies for user info
    if (req.cookies && typeof req.cookies === 'object') {
      const userCookie = req.cookies.user;
      if (userCookie && typeof userCookie === 'string') {
        try {
          const userData = JSON.parse(userCookie);
          if (userData && typeof userData === 'object' && userData.id && typeof userData.id === 'string') {
            return {
              userId: userData.id,
              username: userData.username || undefined
            };
          }
        } catch (parseError) {
          // Cookie parsing failed, continue to final fallback
        }
      }
    }
    
    // Absolute fallback for anonymous users
    return {
      userId: 'anonymous',
      username: 'Anonymous User'
    };
    
  } catch (error) {
    logError('DashboardLogger', `Error extracting user info: ${error}`);
    return {
      userId: 'error_user',
      username: 'Error User'
    };
  }
}

// Main dashboard logging middleware
export const dashboardLogger = (req: Request, res: Response, next: NextFunction) => {
  // Skip logging for certain paths and all static resources
  const skipPaths = [
    '/api/auth/',
    '/auth/',
    '/api/health',
    '/favicon.ico',
    '/_next/',
    '/static/',
    '/images/',
    '/css/',
    '/js/',
    '/api/dashboard-logs', // Skip the dashboard logs API endpoint to prevent recursive logging
    '/api/logs/', // Skip other log API endpoints
    '/api/command-logs', // Skip command logs API to prevent recursive logging
    '/api/mod-logs', // Skip mod logs API
    '/api/ticket-logs', // Skip ticket logs API
    '/api/message-logs', // Skip message logs API
    '/api/server-logs', // Skip server logs API
    '/api/user-logs', // Skip user logs API
    '/api/all-logs', // Skip all logs API
    '/logs', // Skip direct logs endpoint access
    '/.well-known/', // Skip Chrome dev tools requests
    '.hot-update.json' // Skip webpack hot-reload requests
  ];
  
  const shouldSkip = skipPaths.some(skipPath => req.path.startsWith(skipPath));
  if (shouldSkip) {
    return next();
  }

  // Check if this action should be logged
  const actionType = getActionType(req.method || 'GET', req.path || '/');
  if (!actionType) {
    // Don't log this action (likely a page view or other non-meaningful action)
    return next();
  }
  
  // Check if this request has already been logged
  if ((req as any).__dashboardLogged) {
    return next();
  }
  
  // Mark request as being processed for logging
  (req as any).__dashboardLogging = true;
  
  // Store original response methods
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody: any;
  let isLogged = false;
  
  // Override response methods to capture response data
  res.send = function(body: any) {
    responseBody = body;
    return originalSend.call(this, body);
  };
  
  res.json = function(obj: any) {
    responseBody = obj;
    return originalJson.call(this, obj);
  };
  
  // Log the activity after response is sent
  const logActivity = async () => {
    if (isLogged || (req as any).__dashboardLogged) return; // Prevent duplicate logging
    isLogged = true;
    (req as any).__dashboardLogged = true;
    
    try {
      // Add extra safety checks for all extracted values
      const userInfo = extractUserInfo(req);
      const userId = userInfo?.userId || 'unknown';
      const username = userInfo?.username || null;
      
      const page = extractPageName(req.path || '/');
      
      // Add try-catch around extractTargetInfo to prevent any remaining undefined access errors
      let targetInfo: { targetType?: string; targetId?: string; guildId?: string } = {};
      try {
        targetInfo = extractTargetInfo(req);
      } catch (targetError) {
        logError('DashboardLogger', `Error extracting target info: ${targetError}`);
        targetInfo = {}; // Fallback to empty object
      }
      
      const targetType = targetInfo?.targetType || null;
      const targetId = targetInfo?.targetId || null;
      const guildId = targetInfo?.guildId || null;
      
      const valueInfo = extractValues(req, res);
      const oldValue = valueInfo?.oldValue || null;
      const newValue = valueInfo?.newValue || null;
      
      // Determine if the action was successful
      const statusCode = res.statusCode || 500;
      const success = statusCode >= 200 && statusCode < 400;
      
      // Extract error message if available
      let errorMessage: string | undefined;
      if (!success && responseBody) {
        if (typeof responseBody === 'string') {
          try {
            const parsed = JSON.parse(responseBody);
            errorMessage = parsed?.error || parsed?.message;
          } catch {
            errorMessage = responseBody;
          }
        } else if (responseBody && (responseBody.error || responseBody.message)) {
          errorMessage = responseBody.error || responseBody.message;
        }
      }
      
      // Create more detailed log entry for meaningful actions
      let details = `${req.method || 'GET'} ${req.path || '/'}`;
      
      // Add more context for different action types
      if (req.body && Object.keys(req.body).length > 0) {
        // Don't log sensitive data like passwords
        const sanitizedBody = { ...req.body };
        delete sanitizedBody.password;
        delete sanitizedBody.token;
        delete sanitizedBody.secret;
        
        if (Object.keys(sanitizedBody).length > 0) {
          details += ` | Body: ${JSON.stringify(sanitizedBody)}`;
        }
      }
      
      if (req.query && Object.keys(req.query).length > 0) {
        details += ` | Query: ${new URLSearchParams(req.query as any).toString()}`;
      }
      
      // Create log entry with proper data types for SQLite and null safety
      const logEntry: DashboardLogEntry = {
        user_id: userId,
        username: username,
        action_type: actionType,
        page: page,
        target_type: targetType,
        target_id: targetId,
        old_value: oldValue,
        new_value: newValue,
        ip_address: (req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress) || null,
        user_agent: req.get('User-Agent') || null,
        details: details,
        success: success ? 1 : 0, // Convert boolean to number for SQLite
        error_message: errorMessage || null,
        guild_id: guildId
      };
      
      // Log the activity with additional error handling
      const logResult = await DashboardLogsService.logActivity(logEntry);
      
      if (logResult) {
        logInfo('DashboardLogs', `Logged meaningful action: ${actionType} by ${username || userId} on ${page}`);
      } else {
        logError('DashboardLogs', `Failed to log activity: ${actionType} by ${userId} on ${page}`);
      }
      
    } catch (error) {
      logError('DashboardLogger', `Error logging dashboard activity: ${error}`);
      // Log additional debug information
      try {
        logError('DashboardLogger', `Request details - Method: ${req.method}, Path: ${req.path}, Headers: ${JSON.stringify(req.headers)}`);
      } catch (debugError) {
        logError('DashboardLogger', `Failed to log debug information: ${debugError}`);
      }
    }
  };
  
  // Log activity when response finishes
  res.on('finish', logActivity);
  res.on('close', logActivity);
  
  next();
};

// Utility function for manual logging from within API endpoints
export const logDashboardActivity = async (
  userId: string,
  actionType: string,
  page: string,
  details?: string,
  options?: Partial<DashboardLogEntry>
): Promise<void> => {
  try {
    // Add safety checks for required parameters
    if (!userId || typeof userId !== 'string') {
      logError('DashboardLogger', 'Invalid userId provided to logDashboardActivity');
      return;
    }
    
    if (!actionType || typeof actionType !== 'string') {
      logError('DashboardLogger', 'Invalid actionType provided to logDashboardActivity');
      return;
    }
    
    if (!page || typeof page !== 'string') {
      logError('DashboardLogger', 'Invalid page provided to logDashboardActivity');
      return;
    }
    
    const logEntry: DashboardLogEntry = {
      user_id: userId,
      action_type: actionType,
      page: page,
      details: details || null,
      username: null,
      target_type: null,
      target_id: null,
      old_value: null,
      new_value: null,
      ip_address: null,
      user_agent: null,
      success: 1,
      error_message: null,
      ...options
    };
    
    const result = await DashboardLogsService.logActivity(logEntry);
    
    if (!result) {
      logError('DashboardLogger', `Failed to manually log activity: ${actionType} by ${userId} on ${page}`);
    }
  } catch (error) {
    logError('DashboardLogger', `Error manually logging activity: ${error}`);
  }
};

export default dashboardLogger; 