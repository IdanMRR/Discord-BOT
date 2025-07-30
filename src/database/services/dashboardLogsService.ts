import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

export interface DashboardLogEntry {
  id?: number;
  user_id: string;
  username?: string | null;
  action_type: string;
  page: string;
  target_type?: string | null;
  target_id?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: string | null;
  success?: boolean | number;
  error_message?: string | null;
  guild_id?: string | null;
  created_at?: string;
}

export interface DashboardLogFilter {
  user_id?: string;
  action_type?: string;
  page?: string;
  target_type?: string;
  success?: boolean;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export const DashboardLogsService = {
  usernameCache: new Map<string, string>(),
  /**
   * Log a dashboard activity with deduplication
   */
  async logActivity(entry: DashboardLogEntry): Promise<boolean> {
    try {
      // Check for recent duplicate entries (within last 30 seconds) with more specific matching
      const duplicateCheck = db.prepare(`
        SELECT id FROM dashboard_logs 
        WHERE user_id = ? AND action_type = ? AND page = ? 
        AND datetime(created_at) > datetime('now', '-30 seconds')
        AND target_type = ? AND target_id = ?
        LIMIT 1
      `);
      
      const existingEntry = duplicateCheck.get(
        entry.user_id, 
        entry.action_type, 
        entry.page, 
        entry.target_type || null, 
        entry.target_id || null
      );
      
      if (existingEntry) {
        // Only log this message in debug mode or reduce frequency
        return false; // Don't log duplicates
      }

      // Get current time in Israeli timezone as ISO string with timezone offset
      const israeliTime = new Date().toLocaleString('sv-SE', { 
        timeZone: 'Asia/Jerusalem'
      }).replace(' ', 'T') + '+03:00';

      const stmt = db.prepare(`
        INSERT INTO dashboard_logs (
          guild_id, user_id, username, action_type, page, target_type, target_id,
          old_value, new_value, ip_address, user_agent, details, success, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        entry.guild_id || 'dashboard', // Use provided guild_id or default to 'dashboard'
        entry.user_id,
        entry.username || null,
        entry.action_type,
        entry.page,
        entry.target_type || null,
        entry.target_id || null,
        entry.old_value || null,
        entry.new_value || null,
        entry.ip_address || null,
        entry.user_agent || null,
        entry.details || null,
        entry.success !== undefined ? (typeof entry.success === 'number' ? entry.success : (entry.success ? 1 : 0)) : 1,
        entry.error_message || null,
        israeliTime
      );

      if (result.changes > 0) {
        logInfo('DashboardLogs', `Logged activity: ${entry.action_type} by ${entry.username || entry.user_id} on ${entry.page}`);
        return true;
      }
      return false;
    } catch (error) {
      logError('DashboardLogs', `Error logging activity: ${error}`);
      return false;
    }
  },

  /**
   * Get dashboard logs with filtering and pagination
   */
  async getLogs(filter: DashboardLogFilter = {}): Promise<{
    logs: DashboardLogEntry[];
    total: number;
  }> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Build WHERE clause based on filters
      if (filter.user_id) {
        whereClause += ' AND user_id = ?';
        params.push(filter.user_id);
      }

      if (filter.action_type) {
        whereClause += ' AND action_type = ?';
        params.push(filter.action_type);
      }

      if (filter.page) {
        whereClause += ' AND page = ?';
        params.push(filter.page);
      }

      if (filter.target_type) {
        whereClause += ' AND target_type = ?';
        params.push(filter.target_type);
      }

      if (filter.success !== undefined) {
        whereClause += ' AND success = ?';
        params.push(filter.success ? 1 : 0);
      }

      if (filter.start_date) {
        whereClause += ' AND created_at >= ?';
        params.push(filter.start_date);
      }

      if (filter.end_date) {
        whereClause += ' AND created_at <= ?';
        params.push(filter.end_date);
      }

      // Get total count
      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM dashboard_logs ${whereClause}`);
      const countResult = countStmt.get(...params) as { count: number };
      const total = countResult.count;

      // Get logs with pagination
      const limit = filter.limit || 50;
      const offset = filter.offset || 0;

      const logsStmt = db.prepare(`
        SELECT * FROM dashboard_logs 
        ${whereClause} 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `);

      const logs = logsStmt.all(...params, limit, offset) as DashboardLogEntry[];

      // Enhance logs with Discord usernames and readable page names
      const enhancedLogs = await this.enhanceLogsWithUserData(logs);

      return { logs: enhancedLogs, total };
    } catch (error) {
      logError('DashboardLogs', `Error getting logs: ${error}`);
      return { logs: [], total: 0 };
    }
  },

  /**
   * Enhance logs with Discord user data and readable page names
   */
  async enhanceLogsWithUserData(logs: DashboardLogEntry[]): Promise<DashboardLogEntry[]> {
    try {
      // Use in-memory cache for usernames to prevent repeated Discord API calls
      if (!this.usernameCache) {
        this.usernameCache = new Map<string, string>();
      }

      const { getClient } = require('../../utils/client-utils');
      const client = getClient();
      
      // Collect unique user IDs that need username fetching
      const usersToFetch = new Set<string>();
      logs.forEach(log => {
        if (!log.username && log.user_id && !this.usernameCache.has(log.user_id)) {
          usersToFetch.add(log.user_id);
        }
      });

      // If we have very few logs or all usernames are already present, skip Discord API calls
      if (usersToFetch.size === 0) {
        // Fast path: no Discord API calls needed
        const enhancedLogs = logs.map((log) => {
          const enhanced = { ...log };
          
          // Use cached username or existing username
          if (!enhanced.username && enhanced.user_id) {
            enhanced.username = this.usernameCache.get(enhanced.user_id) || `User ${enhanced.user_id.slice(-4)}`;
          }
          
          // Convert page IDs to readable names
          enhanced.page = this.getReadablePageName(enhanced.page);
          
          // Convert action types to readable names
          enhanced.action_type = this.getReadableActionType(enhanced.action_type);
          
          // Convert dates to Israeli timezone
          if (enhanced.created_at) {
            enhanced.created_at = this.convertToIsraeliTime(enhanced.created_at);
          }
          
          return enhanced;
        });
        
        return enhancedLogs;
      }

      // Batch fetch usernames if needed and client is available
      if (usersToFetch.size > 0 && client) {
        const batchFetchPromises = Array.from(usersToFetch).map(async (userId) => {
          try {
            const user = await client.users.fetch(userId);
            if (user) {
              this.usernameCache.set(userId, user.username);
              // Update database for future use (async, don't wait for it)
              setImmediate(() => {
                try {
                  const updateStmt = db.prepare('UPDATE dashboard_logs SET username = ? WHERE user_id = ? AND username IS NULL');
                  updateStmt.run(user.username, userId);
                } catch (updateError) {
                  logError('DashboardLogs', `Error bulk updating username: ${updateError}`);
                }
              });
            }
          } catch (userFetchError) {
            // Cache fallback username to prevent repeated failed fetches
            this.usernameCache.set(userId, `User ${userId.slice(-4)}`);
          }
        });

        // Wait for all username fetches to complete, but with a timeout
        await Promise.allSettled(batchFetchPromises);
      }
      
      // Process logs synchronously now that we have cached data
      const enhancedLogs = logs.map((log) => {
        const enhanced = { ...log };
        
        // Use cached username or existing username
        if (!enhanced.username && enhanced.user_id) {
          enhanced.username = this.usernameCache.get(enhanced.user_id) || `User ${enhanced.user_id.slice(-4)}`;
        }
        
        // Convert page IDs to readable names
        enhanced.page = this.getReadablePageName(enhanced.page);
        
        // Convert action types to readable names
        enhanced.action_type = this.getReadableActionType(enhanced.action_type);
        
        // Convert dates to Israeli timezone
        if (enhanced.created_at) {
          enhanced.created_at = this.convertToIsraeliTime(enhanced.created_at);
        }
        
        return enhanced;
      });
      
      return enhancedLogs;
    } catch (error) {
      logError('DashboardLogs', `Error enhancing logs with user data: ${error}`);
      return logs; // Return original logs if enhancement fails
    }
  },

  /**
   * Convert page IDs to readable names
   */
  getReadablePageName(page: string): string {
    const pageNames: Record<string, string> = {
      'dashboard': 'Dashboard Home',
      'servers': 'Servers List',
      'server-detail': 'Server Details',
      'server-settings': 'Server Settings',
      'tickets': 'Support Tickets',
      'warnings': 'Warnings Management',
      'logs': 'Activity Logs',
      'admin': 'Admin Panel',
      'analytics': 'Analytics',
      'giveaways': 'Giveaways',
      'moderation': 'Moderation Tools',
      'automod': 'Auto Moderation',
      'settings': 'System Settings',
      'profile': 'User Profile',
      'login': 'Login Page',
      'logout': 'Logout',
      'test_page': 'Test Page',
      'comprehensive-logs': 'Comprehensive Logs',
      'dashboard-logs': 'Dashboard Activity'
    };
    
    return pageNames[page] || page;
  },

  /**
   * Convert action types to readable names
   */
  getReadableActionType(actionType: string): string {
    const actionNames: Record<string, string> = {
      'login': 'User Login',
      'logout': 'User Logout',
      'view_page': 'Page View',
      'view_logs': 'View Logs',
      'view_dashboard': 'View Dashboard',
      'manage_warnings': 'Manage Warnings',
      'manage_tickets': 'Manage Tickets',
      'manage_settings': 'Manage Settings',
      'update_server_settings': 'Update Server Settings',
      'export_data': 'Export Data',
      'create_ticket': 'Create Ticket',
      'create_warning': 'Create Warning',
      'update_ticket': 'Update Ticket',
      'update_warning': 'Update Warning',
      'delete_ticket': 'Delete Ticket',
      'delete_warning': 'Delete Warning',
      'close_ticket': 'Close Ticket',
      'reopen_ticket': 'Reopen Ticket',
      'admin': 'Admin Action',
      'system_admin': 'System Admin',
      'test_action': 'Test Action'
    };
    
    return actionNames[actionType] || actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  },

  /**
   * Convert UTC time to Israeli time (Asia/Jerusalem)
   */
  convertToIsraeliTime(utcDateString: string): string {
    try {
      const date = new Date(utcDateString);
      // Convert to Israeli timezone
      const israeliTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
      
      // Return in ISO-like format but with Israeli timezone
      return israeliTime.replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$3-$2-$1T$4+03:00');
    } catch (error) {
      logError('DashboardLogs', `Error converting to Israeli time: ${error}`);
      return utcDateString; // Return original if conversion fails
    }
  },

  /**
   * Get logs for a specific user
   */
  async getUserLogs(userId: string, limit: number = 50): Promise<DashboardLogEntry[]> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM dashboard_logs 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `);
      return stmt.all(userId, limit) as DashboardLogEntry[];
    } catch (error) {
      logError('DashboardLogs', `Error getting user logs: ${error}`);
      return [];
    }
  },

  /**
   * Get recent logs (last 24 hours by default)
   */
  async getRecentLogs(hours: number = 24, limit: number = 100): Promise<DashboardLogEntry[]> {
    try {
      const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const stmt = db.prepare(`
        SELECT * FROM dashboard_logs 
        WHERE created_at >= ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `);
      return stmt.all(hoursAgo, limit) as DashboardLogEntry[];
    } catch (error) {
      logError('DashboardLogs', `Error getting recent logs: ${error}`);
      return [];
    }
  },

  /**
   * Get activity statistics
   */
  async getActivityStats(hours: number = 24): Promise<{
    totalActions: number;
    uniqueUsers: number;
    actionsByType: Record<string, number>;
    actionsByPage: Record<string, number>;
    successRate: number;
  }> {
    try {
      const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      // Total actions
      const totalStmt = db.prepare('SELECT COUNT(*) as count FROM dashboard_logs WHERE created_at >= ?');
      const totalResult = totalStmt.get(hoursAgo) as { count: number };

      // Unique users
      const usersStmt = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM dashboard_logs WHERE created_at >= ?');
      const usersResult = usersStmt.get(hoursAgo) as { count: number };

      // Actions by type
      const typeStmt = db.prepare(`
        SELECT action_type, COUNT(*) as count 
        FROM dashboard_logs 
        WHERE created_at >= ? 
        GROUP BY action_type
      `);
      const typeResults = typeStmt.all(hoursAgo) as { action_type: string; count: number }[];
      const actionsByType = typeResults.reduce((acc, item) => {
        acc[item.action_type] = item.count;
        return acc;
      }, {} as Record<string, number>);

      // Actions by page
      const pageStmt = db.prepare(`
        SELECT page, COUNT(*) as count 
        FROM dashboard_logs 
        WHERE created_at >= ? 
        GROUP BY page
      `);
      const pageResults = pageStmt.all(hoursAgo) as { page: string; count: number }[];
      const actionsByPage = pageResults.reduce((acc, item) => {
        acc[item.page] = item.count;
        return acc;
      }, {} as Record<string, number>);

      // Success rate
      const successStmt = db.prepare(`
        SELECT 
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          COUNT(*) as total
        FROM dashboard_logs 
        WHERE created_at >= ?
      `);
      const successResult = successStmt.get(hoursAgo) as { successful: number; total: number };
      const successRate = successResult.total > 0 ? (successResult.successful / successResult.total) * 100 : 0;

      return {
        totalActions: totalResult.count,
        uniqueUsers: usersResult.count,
        actionsByType,
        actionsByPage,
        successRate
      };
    } catch (error) {
      logError('DashboardLogs', `Error getting activity stats: ${error}`);
      return {
        totalActions: 0,
        uniqueUsers: 0,
        actionsByType: {},
        actionsByPage: {},
        successRate: 0
      };
    }
  },

  /**
   * Clean old logs (older than specified days)
   */
  async cleanOldLogs(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
      
      const stmt = db.prepare('DELETE FROM dashboard_logs WHERE created_at < ?');
      const result = stmt.run(cutoffDate);
      
      if (result.changes > 0) {
        logInfo('DashboardLogs', `Cleaned ${result.changes} old log entries`);
      }
      
      return result.changes;
    } catch (error) {
      logError('DashboardLogs', `Error cleaning old logs: ${error}`);
      return 0;
    }
  }
};

export default DashboardLogsService; 