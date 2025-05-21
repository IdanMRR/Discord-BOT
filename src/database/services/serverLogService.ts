import { Database, Statement } from 'better-sqlite3';
import { db } from '../sqlite';

interface LogEntry {
  id?: number;
  guild_id: string;
  action_type: string;
  user_id?: string | null;
  channel_id?: string | null;
  message_id?: string | null;
  target_id?: string | null;
  reason?: string | null;
  details?: string | Record<string, any> | null;
  created_at?: string;
}

interface GetLogsOptions {
  page?: number;
  limit?: number;
  actionType?: string;
  userId?: string;
  channelId?: string;
  search?: string;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

class ServerLogService {
  /**
   * Create a new log entry
   */
  static async createLog(logData: Omit<LogEntry, 'id' | 'created_at'>): Promise<number> {
    try {
      const stmt = db.prepare(`
        INSERT INTO server_logs (
          guild_id, action_type, user_id, channel_id, 
          message_id, target_id, reason, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `) as unknown as Statement;

      const result = stmt.run(
        logData.guild_id,
        logData.action_type,
        logData.user_id || null,
        logData.channel_id || null,
        logData.message_id || null,
        logData.target_id || null,
        logData.reason || null,
        logData.details ? JSON.stringify(logData.details) : null
      );

      return Number((result as any).lastInsertRowid);
    } catch (error) {
      console.error('Error creating log entry:', error);
      throw new Error('Failed to create log entry');
    }
  }

  /**
   * Get logs with pagination and filtering
   */
  static async getLogs(guildId: string, options: GetLogsOptions = {}): Promise<{
    data: LogEntry[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    try {
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(100, Math.max(1, options.limit || 25));
      const offset = (page - 1) * limit;

      let query = 'SELECT * FROM server_logs WHERE guild_id = ?';
      const params: any[] = [guildId];

      if (options.actionType) {
        query += ' AND action_type = ?';
        params.push(options.actionType);
      }

      if (options.userId) {
        query += ' AND user_id = ?';
        params.push(options.userId);
      }

      if (options.channelId) {
        query += ' AND channel_id = ?';
        params.push(options.channelId);
      }

      if (options.search) {
        query += ' AND (reason LIKE ? OR details LIKE ?)';
        const searchTerm = `%${options.search}%`;
        params.push(searchTerm, searchTerm);
      }

      // Get total count for pagination
      const countStmt = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as count')) as unknown as Statement;
      const countResult = countStmt.get(...params) as { count: number } | undefined;
      const total = countResult?.count || 0;

      // Add sorting and pagination
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = db.prepare(query) as unknown as Statement;
      const logs = stmt.all(...params) as LogEntry[];

      // Parse JSON details if they exist
      const parsedLogs = logs.map(log => {
        let parsedDetails: any = null;
        
        if (typeof log.details === 'string') {
          try {
            parsedDetails = JSON.parse(log.details);
          } catch (e) {
            console.error('Error parsing log details:', e);
            parsedDetails = log.details;
          }
        } else {
          parsedDetails = log.details;
        }
        
        return {
          ...log,
          details: parsedDetails
        };
      });

      return {
        data: parsedLogs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching logs:', error);
      throw new Error('Failed to fetch logs');
    }
  }

  /**
   * Get a single log entry by ID
   */
  static getLogById(id: number): LogEntry | null {
    try {
      const stmt = db.prepare('SELECT * FROM server_logs WHERE id = ?') as unknown as Statement;
      const log = stmt.get(id) as LogEntry | undefined;
      
      if (!log) return null;

      // Parse JSON details if they exist
      let parsedDetails: any = null;
      if (typeof log.details === 'string') {
        try {
          parsedDetails = JSON.parse(log.details);
        } catch (e) {
          console.error('Error parsing log details:', e);
          parsedDetails = log.details;
        }
      } else {
        parsedDetails = log.details;
      }
      
      return {
        ...log,
        details: parsedDetails
      };
    } catch (error) {
      console.error('Error fetching log by ID:', error);
      return null;
    }
  }
}

export default ServerLogService;
