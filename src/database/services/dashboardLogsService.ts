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
  /**
   * Log a dashboard activity
   */
  async logActivity(entry: DashboardLogEntry): Promise<boolean> {
    try {
      const stmt = db.prepare(`
        INSERT INTO dashboard_logs (
          guild_id, user_id, username, action, action_type, page, target_type, target_id,
          old_value, new_value, ip_address, user_agent, details, success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        'dashboard', // Default guild_id for dashboard activities
        entry.user_id,
        entry.username || null,
        entry.action_type, // Use action_type for the old action column as well
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
        entry.error_message || null
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

      return { logs, total };
    } catch (error) {
      logError('DashboardLogs', `Error getting logs: ${error}`);
      return { logs: [], total: 0 };
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