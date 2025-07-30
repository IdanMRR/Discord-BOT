import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

// Define types for our database tables
export interface Warning {
  id?: number;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  reason: string;
  created_at?: string;
  active: boolean;
  removed_by?: string;
  removed_at?: string;
  removal_reason?: string;
  case_number?: number;
}

export interface Ticket {
  id?: number;
  guild_id: string;
  channel_id: string;
  user_id: string;
  ticket_number: number;
  case_number?: number;
  subject: string;
  category: string;
  status: 'open' | 'closed' | 'deleted';
  deleted?: number; // 0 = not deleted, 1 = soft deleted
  created_at?: string;
  closed_at?: string;
  closed_by?: string;
  last_message_at?: string;
  rating?: number;
  feedback?: string;
}

export interface ServerLog {
  id?: number;
  guild_id: string;
  action_type: string;
  user_id: string;
  target_id?: string;
  channel_id?: string;
  message_id?: string;
  reason?: string;
  details?: any;
  created_at?: string;
}

export interface ServerSettings {
  id?: number;
  guild_id: string;
  name: string;
  log_channel_id?: string;
  mod_log_channel_id?: string;
  member_log_channel_id?: string;
  message_log_channel_id?: string;
  server_log_channel_id?: string;
  welcome_channel_id?: string;
  goodbye_channel_id?: string;
  welcome_message?: string;
  ticket_category_id?: string;
  ticket_panel_channel_id?: string;
  ticket_panel_message_id?: string;
  ticket_logs_channel_id?: string;
  faq_channel_id?: string;
  rules_channel_id?: string;
  log_all_commands?: boolean;
  staff_role_ids?: string[];
  language?: string;
  auto_mod_enabled?: boolean;
  ticket_chatbot_enabled?: boolean;
  ticket_chatbot_ai_enabled?: boolean;
  weather_channel_id?: string;
  verification_channel_id?: string;
  verification_message_id?: string;
  verified_role_id?: string;
  verification_type?: string;
  member_events_config?: string;
  auto_mod_settings?: {
    filter_profanity: boolean;
    filter_invites: boolean;
    filter_links: boolean;
    spam_protection: boolean;
    max_mentions: number;
    max_emojis: number;
  };
  templates?: Record<string, any[]>;
  active_templates?: Record<string, string>;
  red_alert_channels?: string[];
  created_at?: string;
  updated_at?: string;
}

// Warning Service
export const WarningService = {
  async getWarnings(guildId: string | null, userId?: string, active?: boolean): Promise<{data: Warning[], error: any}> {
    try {
      console.log(`🔍 WarningService.getWarnings called with: guildId=${guildId}, userId=${userId}, active=${active}`);
      
      // Check if users table exists
      const usersTableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `).get();
      
      console.log(`📋 Users table exists: ${!!usersTableExists}`);
      
      if (!usersTableExists) {
        // If users table doesn't exist, run the migration
        console.log('🔧 Creating missing users table...');
        const { migrateAddUsersTable } = require('../migrations/add_users_table');
        await migrateAddUsersTable();
        logInfo('WarningService', 'Created missing users table');
      }
      
      let query = 'SELECT * FROM warnings';
      const params: any[] = [];
      
      // Add WHERE clause conditions
      const conditions: string[] = [];
      
      // Add guild filter if guildId is provided
      if (guildId) {
        conditions.push('guild_id = ?');
        params.push(guildId);
      }
      
      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
      
      if (active !== undefined) {
        conditions.push('active = ?');
        params.push(active ? 1 : 0);
      }
      
      // Add WHERE clause if we have conditions
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY created_at DESC';
      
      console.log(`🔍 Executing query: ${query}`);
      console.log(`📋 With params: ${JSON.stringify(params)}`);
      
      const stmt = db.prepare(query);
      const warnings = stmt.all(...params) as Warning[];
      
      console.log(`📊 Query returned ${warnings.length} warnings`);
      
      // Convert SQLite integers to booleans
      warnings.forEach(warning => {
        warning.active = !!warning.active;
      });
      
      console.log(`✅ WarningService returning ${warnings.length} warnings`);
      return { data: warnings, error: null };
    } catch (error) {
      console.error('❌ WarningService.getWarnings ERROR:', error);
      logError('WarningService', error);
      return { data: [], error };
    }
  },
  
  async getWarningCounts(guildId: string, userId: string): Promise<{activeCount: number, totalCount: number}> {
    try {
      const activeStmt = db.prepare(
        'SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1'
      );
      const totalStmt = db.prepare(
        'SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ?'
      );
      
      const activeResult = activeStmt.get(guildId, userId) as { count: number };
      const totalResult = totalStmt.get(guildId, userId) as { count: number };
      
      return { 
        activeCount: activeResult.count, 
        totalCount: totalResult.count 
      };
    } catch (error) {
      logError('WarningService', error);
      return { activeCount: 0, totalCount: 0 };
    }
  },
  
  async create(warning: Warning): Promise<Warning | null> {
    try {
      const stmt = db.prepare(`
        INSERT INTO warnings 
        (guild_id, user_id, moderator_id, reason, active, case_number) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        warning.guild_id,
        warning.user_id,
        warning.moderator_id,
        warning.reason,
        warning.active ? 1 : 0,
        warning.case_number || null
      );
      
      if (result.changes > 0) {
        const newWarning = {...warning, id: result.lastInsertRowid as number};
        logInfo('WarningService', `Created new warning with ID ${newWarning.id}`);
        return newWarning;
      } else {
        logError('WarningService', 'Failed to create warning - no changes reported');
        return null;
      }
    } catch (error) {
      logError('WarningService', error);
      return null;
    }
  },
  
  async getActiveWarnings(guildId: string, userId: string): Promise<Warning[]> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM warnings 
        WHERE guild_id = ? AND user_id = ? AND active = 1
        ORDER BY created_at DESC
      `);
      
      const warnings = stmt.all(guildId, userId) as Warning[];
      
      // Convert SQLite integers to booleans
      warnings.forEach(warning => {
        warning.active = !!warning.active;
      });
      
      return warnings;
    } catch (error) {
      logError('WarningService', error);
      return [];
    }
  },
  
  async countActiveWarnings(guildId: string, userId: string): Promise<number> {
    try {
      const stmt = db.prepare(`
        SELECT COUNT(*) as count FROM warnings 
        WHERE guild_id = ? AND user_id = ? AND active = 1
      `);
      
      const result = stmt.get(guildId, userId) as { count: number };
      return result.count;
    } catch (error) {
      logError('WarningService', error);
      return 0;
    }
  },
  
  async removeWarning(warningId: number, moderatorId: string, reason: string): Promise<boolean> {
    try {
      const stmt = db.prepare(`
        UPDATE warnings 
        SET active = 0, removed_by = ?, removed_at = CURRENT_TIMESTAMP, removal_reason = ?
        WHERE id = ?
      `);
      
      const result = stmt.run(moderatorId, reason, warningId);
      
      if (result.changes > 0) {
        logInfo('WarningService', `Removed warning ${warningId} by moderator ${moderatorId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logError('WarningService', error);
      return false;
    }
  }
};

// Ticket Service
export const TicketService = {
  async getTickets(guildId: string | null, status?: string, userId?: string, includeDeleted: boolean = false): Promise<{data: Ticket[], error: any}> {
    try {
      // Check if users table exists
      const usersTableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `).get();
      
      if (!usersTableExists) {
        // If users table doesn't exist, run the migration
        const { migrateAddUsersTable } = require('../migrations/add_users_table');
        await migrateAddUsersTable();
        logInfo('TicketService', 'Created missing users table');
      }
      
      let query = 'SELECT * FROM tickets';
      const params: any[] = [];
      
      // Add WHERE clause conditions
      const conditions: string[] = [];
      
      // Add guild filter if guildId is provided
      if (guildId) {
        conditions.push('guild_id = ?');
        params.push(guildId);
      }
      
      // Filter by soft delete unless includeDeleted is true
      if (!includeDeleted) {
        conditions.push('(deleted = 0 OR deleted IS NULL)');
      }
      
      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }
      
      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
      
      // Add WHERE clause if we have conditions
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      // Order by status priority (open first, then in_progress, on_hold, closed, deleted)
      // then by ticket number descending for newest first
      query += ` ORDER BY 
        CASE 
          WHEN status = 'open' THEN 1
          WHEN status = 'in_progress' THEN 2
          WHEN status = 'on_hold' THEN 3
          WHEN status = 'closed' THEN 4
          WHEN status = 'deleted' THEN 5
          ELSE 6
        END,
        ticket_number DESC`;
      
      const stmt = db.prepare(query);
      const tickets = stmt.all(...params) as Ticket[];
      
      return { data: tickets, error: null };
    } catch (error) {
      logError('TicketService', error);
      return { data: [], error };
    }
  },
  
  async getTicketCounts(guildId: string, userId: string): Promise<{openCount: number, totalCount: number}> {
    try {
      const openStmt = db.prepare(
        'SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND user_id = ? AND status = "open"'
      );
      const totalStmt = db.prepare(
        'SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND user_id = ?'
      );
      
      const openResult = openStmt.get(guildId, userId) as { count: number };
      const totalResult = totalStmt.get(guildId, userId) as { count: number };
      
      return { 
        openCount: openResult.count, 
        totalCount: totalResult.count 
      };
    } catch (error) {
      logError('TicketService', error);
      return { openCount: 0, totalCount: 0 };
    }
  },
  
  async create(ticket: Ticket): Promise<Ticket | null> {
    try {
      // Get the next case number for this guild
      const caseNumberStmt = db.prepare(`
        SELECT MAX(case_number) as max_case FROM tickets WHERE guild_id = ?
      `);
      const { max_case } = caseNumberStmt.get(ticket.guild_id) as { max_case: number | null };
      const caseNumber = (max_case !== null ? max_case + 1 : 1);

      const stmt = db.prepare(`
        INSERT INTO tickets 
        (guild_id, channel_id, user_id, ticket_number, case_number, subject, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        ticket.guild_id,
        ticket.channel_id,
        ticket.user_id,
        ticket.ticket_number,
        caseNumber,
        ticket.subject,
        ticket.status
      );
      
      if (result.changes > 0) {
        const newTicket = {
          ...ticket,
          id: result.lastInsertRowid as number,
          case_number: caseNumber,
          created_at: new Date().toISOString()
        };
        
        logInfo('TicketService', `Created ticket #${ticket.ticket_number} (Case #${caseNumber}) for user ${ticket.user_id} in guild ${ticket.guild_id}`);
        return newTicket;
      }
      
      return null;
    } catch (error) {
      logError('TicketService', error);
      return null;
    }
  },
  
  async getNextTicketNumber(guildId: string): Promise<number> {
    try {
      const stmt = db.prepare(
        'SELECT MAX(ticket_number) as max_number FROM tickets WHERE guild_id = ?'
      );
      
      const result = stmt.get(guildId) as { max_number: number | null };
      
      // If no tickets exist yet, start with 1
      return (result.max_number || 0) + 1;
    } catch (error) {
      logError('TicketService', error);
      // In case of error, return a safe default
      return 1;
    }
  },
  
  async closeTicket(channelId: string, closedBy: string): Promise<boolean> {
    try {
      const stmt = db.prepare(`
        UPDATE tickets 
        SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ?
        WHERE channel_id = ?
      `);
      
      const result = stmt.run(closedBy, channelId);
      
      if (result.changes > 0) {
        logInfo('TicketService', `Closed ticket with channel ID ${channelId} by user ${closedBy}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logError('TicketService', error);
      return false;
    }
  },
  
  async softDeleteTicket(ticketId: number, deletedBy: string, reason?: string): Promise<boolean> {
    try {
      const stmt = db.prepare(`
        UPDATE tickets 
        SET deleted = 1, status = 'deleted', closed_at = CURRENT_TIMESTAMP, closed_by = ?
        WHERE id = ?
      `);
      
      const result = stmt.run(deletedBy, ticketId);
      
      if (result.changes > 0) {
        logInfo('TicketService', `Soft deleted ticket ${ticketId} by user ${deletedBy}${reason ? ` (${reason})` : ''}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logError('TicketService', error);
      return false;
    }
  },
  
  async restoreTicket(ticketId: number, restoredBy: string): Promise<boolean> {
    try {
      const stmt = db.prepare(`
        UPDATE tickets 
        SET deleted = 0, status = 'closed'
        WHERE id = ?
      `);
      
      const result = stmt.run(ticketId);
      
      if (result.changes > 0) {
        logInfo('TicketService', `Restored ticket ${ticketId} by user ${restoredBy}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logError('TicketService', error);
      return false;
    }
  },
  
  async getTicketByChannelId(guildId: string, channelId: string): Promise<{data: Ticket | null, error: any}> {
    try {
      const stmt = db.prepare(
        'SELECT * FROM tickets WHERE guild_id = ? AND channel_id = ?'
      );
      
      const ticket = stmt.get(guildId, channelId) as Ticket | undefined;
      
      return { data: ticket || null, error: null };
    } catch (error) {
      logError('TicketService', error);
      return { data: null, error };
    }
  }
};

// Server Log Service
export const ServerLogService = {
  async getLogs(guildId: string, options: {actionType?: string, userId?: string, limit?: number, page?: number}): Promise<{data: ServerLog[], count: number, error: any}> {
    try {
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
      
      // Get total count first
      const countStmt = db.prepare(query.replace('*', 'COUNT(*) as count'));
      const countResult = countStmt.get(...params) as { count: number };
      
      // Add pagination
      const limit = options.limit || 50;
      const offset = ((options.page || 1) - 1) * limit;
      
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      const stmt = db.prepare(query);
      const logs = stmt.all(...params) as ServerLog[];
      
      // Parse JSON details if needed
      logs.forEach(log => {
        if (log.details && typeof log.details === 'string') {
          try {
            log.details = JSON.parse(log.details);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
      });
      
      return { data: logs, count: countResult.count, error: null };
    } catch (error) {
      logError('ServerLogService', error);
      return { data: [], count: 0, error };
    }
  },
  
  async getModerationActionCount(guildId: string, userId: string): Promise<{count: number}> {
    try {
      const stmt = db.prepare(`
        SELECT COUNT(*) as count FROM server_logs 
        WHERE guild_id = ? AND user_id = ? AND action_type LIKE 'mod_%'
      `);
      
      const result = stmt.get(guildId, userId) as { count: number };
      return { count: result.count };
    } catch (error) {
      logError('ServerLogService', error);
      return { count: 0 };
    }
  },
  
  async getRecentUserActivity(guildId: string, userId: string, limit: number = 10): Promise<{data: ServerLog[]}> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM server_logs 
        WHERE guild_id = ? AND (user_id = ? OR target_id = ?)
        ORDER BY created_at DESC
        LIMIT ?
      `);
      
      const logs = stmt.all(guildId, userId, userId, limit) as ServerLog[];
      
      // Parse JSON details if needed
      logs.forEach(log => {
        if (log.details && typeof log.details === 'string') {
          try {
            log.details = JSON.parse(log.details);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
      });
      
      return { data: logs };
    } catch (error) {
      logError('ServerLogService', error);
      return { data: [] };
    }
  },
  
  async create(log: ServerLog): Promise<ServerLog | null> {
    try {
      // Convert details to JSON string if it's an object
      const detailsStr = log.details ? 
        (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : 
        null;
      
      const stmt = db.prepare(`
        INSERT INTO server_logs 
        (guild_id, action_type, user_id, target_id, channel_id, message_id, reason, details) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        log.guild_id,
        log.action_type,
        log.user_id,
        log.target_id || null,
        log.channel_id || null,
        log.message_id || null,
        log.reason || null,
        detailsStr
      );
      
      if (result.changes > 0) {
        const newLog = {
          ...log,
          id: result.lastInsertRowid as number,
          created_at: new Date().toISOString()
        };
        
        logInfo('ServerLogService', `Created log entry for action ${log.action_type} in guild ${log.guild_id}`);
        return newLog;
      }
      
      return null;
    } catch (error) {
      logError('ServerLogService', error);
      return null;
    }
  },
  
  async getRecentLogs(guildId: string, limit: number = 50): Promise<ServerLog[]> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM server_logs 
        WHERE guild_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      
      const logs = stmt.all(guildId, limit) as ServerLog[];
      
      // Parse JSON details if needed
      logs.forEach(log => {
        if (log.details && typeof log.details === 'string') {
          try {
            log.details = JSON.parse(log.details);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
      });
      
      return logs;
    } catch (error) {
      logError('ServerLogService', error);
      return [];
    }
  }
};

// Server Settings Service has been moved to serverSettingsService.ts

// Moderation Case interface
interface ModerationCase {
  id?: number;
  guild_id: string;
  case_number: number;
  action_type: string;
  user_id: string;
  moderator_id: string;
  reason: string;
  created_at?: string;
  additional_info?: string;
  active?: boolean;
}

// Moderation Case Service
export class ModerationCaseService {
  static async getNextCaseNumber(guildId: string): Promise<number> {
    try {
      const query = 'SELECT MAX(case_number) as max_case FROM moderation_cases WHERE guild_id = ?';
      const result = db.prepare(query).get(guildId) as { max_case: number | null };
      return (result?.max_case || 0) + 1;
    } catch (error) {
      logError('ModerationCaseService', `Error getting next case number: ${error}`);
      return 1;
    }
  }

  static async create(moderationCase: Omit<ModerationCase, 'id' | 'created_at' | 'case_number'>): Promise<ModerationCase | null> {
    try {
      // Get the next case number for this guild
      const caseNumber = await this.getNextCaseNumber(moderationCase.guild_id);
      
      const stmt = db.prepare(`
        INSERT INTO moderation_cases 
        (guild_id, case_number, action_type, user_id, moderator_id, reason, additional_info, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        moderationCase.guild_id,
        caseNumber,
        moderationCase.action_type,
        moderationCase.user_id,
        moderationCase.moderator_id,
        moderationCase.reason,
        moderationCase.additional_info || null,
        moderationCase.active !== false ? 1 : 0
      );
      
      if (result.lastInsertRowid) {
        const newCase = {
          ...moderationCase,
          id: result.lastInsertRowid as number,
          case_number: caseNumber,
          created_at: new Date().toISOString()
        };
        
        logInfo('ModerationCaseService', `Created moderation case #${caseNumber} for ${moderationCase.action_type}`);
        return newCase;
      }
      
      return null;
    } catch (error) {
      logError('ModerationCaseService', `Error creating moderation case: ${error}`);
      return null;
    }
  }

  static async getByGuild(guildId: string, limit: number = 50): Promise<ModerationCase[]> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM moderation_cases 
        WHERE guild_id = ? 
        ORDER BY case_number DESC 
        LIMIT ?
      `);
      
      const results = stmt.all(guildId, limit) as ModerationCase[];
      return results;
    } catch (error) {
      logError('ModerationCaseService', `Error getting moderation cases: ${error}`);
      return [];
    }
  }

  static async getByCaseNumber(guildId: string, caseNumber: number): Promise<ModerationCase | null> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM moderation_cases 
        WHERE guild_id = ? AND case_number = ?
      `);
      
      const result = stmt.get(guildId, caseNumber) as ModerationCase | undefined;
      return result || null;
    } catch (error) {
      logError('ModerationCaseService', `Error getting moderation case: ${error}`);
      return null;
    }
  }

  static async updateCase(guildId: string, caseNumber: number, updates: Partial<ModerationCase>): Promise<boolean> {
    try {
      const setClause = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'guild_id' && key !== 'case_number')
        .map(key => `${key} = ?`)
        .join(', ');
      
      if (!setClause) return false;
      
      const values = Object.keys(updates)
        .filter(key => key !== 'id' && key !== 'guild_id' && key !== 'case_number')
        .map(key => (updates as any)[key]);
      
      const stmt = db.prepare(`
        UPDATE moderation_cases 
        SET ${setClause}
        WHERE guild_id = ? AND case_number = ?
      `);
      
      const result = stmt.run(...values, guildId, caseNumber);
      return result.changes > 0;
    } catch (error) {
      logError('ModerationCaseService', `Error updating moderation case: ${error}`);
      return false;
    }
  }
}
