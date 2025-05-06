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
  subject: string;
  category: string;
  status: 'open' | 'closed' | 'deleted';
  created_at?: string;
  closed_at?: string;
  closed_by?: string;
  last_message_at?: string;
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
  created_at?: string;
  updated_at?: string;
}

// Warning Service
export const WarningService = {
  async getWarnings(guildId: string, userId?: string, active?: boolean): Promise<{data: Warning[], error: any}> {
    try {
      let query = 'SELECT * FROM warnings WHERE guild_id = ?';
      const params: any[] = [guildId];
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      if (active !== undefined) {
        query += ' AND active = ?';
        params.push(active ? 1 : 0);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const stmt = db.prepare(query);
      const warnings = stmt.all(...params) as Warning[];
      
      // Convert SQLite integers to booleans
      warnings.forEach(warning => {
        warning.active = !!warning.active;
      });
      
      return { data: warnings, error: null };
    } catch (error) {
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
      // Get the next case number for this guild
      const caseNumberStmt = db.prepare(`
        SELECT MAX(case_number) as max_case FROM warnings WHERE guild_id = ?
      `);
      const { max_case } = caseNumberStmt.get(warning.guild_id) as { max_case: number | null };
      const caseNumber = (max_case !== null ? max_case + 1 : 1);
      
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
        caseNumber
      );
      
      if (result.changes > 0) {
        const newWarning = {...warning, id: result.lastInsertRowid as number, case_number: caseNumber};
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
  async getTickets(guildId: string, status?: string, userId?: string): Promise<{data: Ticket[], error: any}> {
    try {
      let query = 'SELECT * FROM tickets WHERE guild_id = ?';
      const params: any[] = [guildId];
      
      if (status && status !== 'all') {
        query += ' AND status = ?';
        params.push(status);
      }
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      query += ' ORDER BY ticket_number DESC';
      
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
      const stmt = db.prepare(`
        INSERT INTO tickets 
        (guild_id, channel_id, user_id, ticket_number, subject, status) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        ticket.guild_id,
        ticket.channel_id,
        ticket.user_id,
        ticket.ticket_number,
        ticket.subject,
        ticket.status
      );
      
      if (result.changes > 0) {
        const newTicket = {
          ...ticket,
          id: result.lastInsertRowid as number,
          created_at: new Date().toISOString()
        };
        
        logInfo('TicketService', `Created ticket #${ticket.ticket_number} for user ${ticket.user_id} in guild ${ticket.guild_id}`);
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

// Server Settings Service
export const ServerSettingsService = {
  async listServers(): Promise<{data: ServerSettings[], error: any}> {
    try {
      const stmt = db.prepare('SELECT * FROM server_settings');
      const settings = stmt.all() as ServerSettings[];
      
      // Parse JSON fields
      settings.forEach(setting => {
        // Convert auto_mod_enabled to boolean
        setting.auto_mod_enabled = !!setting.auto_mod_enabled;
        
        // Parse auto_mod_settings
        if (setting.auto_mod_settings && typeof setting.auto_mod_settings === 'string') {
          try {
            setting.auto_mod_settings = JSON.parse(setting.auto_mod_settings);
          } catch (e) {
            setting.auto_mod_settings = {
              filter_profanity: true,
              filter_invites: true,
              filter_links: false,
              spam_protection: true,
              max_mentions: 5,
              max_emojis: 10
            };
          }
        }
        
        // Parse staff_role_ids
        if (setting.staff_role_ids && typeof setting.staff_role_ids === 'string') {
          try {
            setting.staff_role_ids = JSON.parse(setting.staff_role_ids);
          } catch (e) {
            setting.staff_role_ids = [];
          }
        }
      });
      
      return { data: settings, error: null };
    } catch (error) {
      logError('ServerSettingsService', error);
      return { data: [], error };
    }
  },
  
  async getOrCreate(guildId: string, guildName: string): Promise<ServerSettings | null> {
    try {
      // Try to get existing settings
      const getStmt = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?');
      let settings = getStmt.get(guildId) as ServerSettings | undefined;
      
      if (settings) {
        // Convert auto_mod_enabled to boolean
        settings.auto_mod_enabled = !!settings.auto_mod_enabled;
        
        // Parse auto_mod_settings
        if (settings.auto_mod_settings && typeof settings.auto_mod_settings === 'string') {
          try {
            settings.auto_mod_settings = JSON.parse(settings.auto_mod_settings);
          } catch (e) {
            // If parsing fails, set default values
            settings.auto_mod_settings = {
              filter_profanity: true,
              filter_invites: true,
              filter_links: false,
              spam_protection: true,
              max_mentions: 5,
              max_emojis: 10
            };
            
            // Update the settings with default auto_mod_settings
            const updateStmt = db.prepare(`
              UPDATE server_settings 
              SET auto_mod_settings = ?
              WHERE guild_id = ?
            `);
            
            updateStmt.run(JSON.stringify(settings.auto_mod_settings), guildId);
          }
        } else if (!settings.auto_mod_settings) {
          // If auto_mod_settings is missing, set default values
          settings.auto_mod_settings = {
            filter_profanity: true,
            filter_invites: true,
            filter_links: false,
            spam_protection: true,
            max_mentions: 5,
            max_emojis: 10
          };
          
          // Update the settings with default auto_mod_settings
          const updateStmt = db.prepare(`
            UPDATE server_settings 
            SET auto_mod_settings = ?
            WHERE guild_id = ?
          `);
          
          updateStmt.run(JSON.stringify(settings.auto_mod_settings), guildId);
        }
        
        // Parse staff_role_ids
        if (settings.staff_role_ids && typeof settings.staff_role_ids === 'string') {
          try {
            settings.staff_role_ids = JSON.parse(settings.staff_role_ids);
          } catch (e) {
            settings.staff_role_ids = [];
          }
        }
        
        return settings;
      }
      
      // If no settings exist, create new ones
      const defaultSettings: ServerSettings = {
        guild_id: guildId,
        name: guildName,
        auto_mod_enabled: false,
        auto_mod_settings: {
          filter_profanity: true,
          filter_invites: true,
          filter_links: false,
          spam_protection: true,
          max_mentions: 5,
          max_emojis: 10
        }
      };
      
      const insertStmt = db.prepare(`
        INSERT INTO server_settings 
        (guild_id, name, auto_mod_enabled, auto_mod_settings) 
        VALUES (?, ?, ?, ?)
      `);
      
      const result = insertStmt.run(
        defaultSettings.guild_id,
        defaultSettings.name,
        defaultSettings.auto_mod_enabled ? 1 : 0,
        JSON.stringify(defaultSettings.auto_mod_settings)
      );
      
      if (result.changes > 0) {
        const newSettings = {
          ...defaultSettings,
          id: result.lastInsertRowid as number,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        logInfo('ServerSettingsService', `Created settings for guild ${guildId}`);
        return newSettings;
      }
      
      return null;
    } catch (error) {
      logError('ServerSettingsService', error);
      return null;
    }
  },
  
  async updateSettings(guildId: string, settings: Partial<ServerSettings>): Promise<boolean> {
    try {
      // First, check if the server settings record exists
      const checkStmt = db.prepare('SELECT COUNT(*) as count FROM server_settings WHERE guild_id = ?');
      const { count } = checkStmt.get(guildId) as { count: number };
      
      // If the record doesn't exist, create it first
      if (count === 0) {
        const serverName = settings.name || 'Unknown Server';
        const insertStmt = db.prepare(`
          INSERT INTO server_settings (
            guild_id, name, created_at, updated_at
          ) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        
        insertStmt.run(guildId, serverName);
        logInfo('ServerSettingsService', `Created new settings record for guild ${guildId}`);
      }
      
      // Build the SET part of the query dynamically based on provided settings
      const updates: string[] = [];
      const params: any[] = [];
      
      if (settings.name !== undefined) {
        updates.push('name = ?');
        params.push(settings.name);
      }
      
      if (settings.log_channel_id !== undefined) {
        updates.push('log_channel_id = ?');
        params.push(settings.log_channel_id);
      }
      
      if (settings.mod_log_channel_id !== undefined) {
        updates.push('mod_log_channel_id = ?');
        params.push(settings.mod_log_channel_id);
      }
      
      if (settings.member_log_channel_id !== undefined) {
        updates.push('member_log_channel_id = ?');
        params.push(settings.member_log_channel_id);
      }
      
      if (settings.message_log_channel_id !== undefined) {
        updates.push('message_log_channel_id = ?');
        params.push(settings.message_log_channel_id);
      }
      
      if (settings.server_log_channel_id !== undefined) {
        updates.push('server_log_channel_id = ?');
        params.push(settings.server_log_channel_id);
      }
      
      if (settings.language !== undefined) {
        updates.push('language = ?');
        params.push(settings.language);
      }
      
      if (settings.welcome_channel_id !== undefined) {
        updates.push('welcome_channel_id = ?');
        params.push(settings.welcome_channel_id);
      }
      
      if (settings.welcome_message !== undefined) {
        updates.push('welcome_message = ?');
        params.push(settings.welcome_message);
      }
      
      if (settings.ticket_category_id !== undefined) {
        updates.push('ticket_category_id = ?');
        params.push(settings.ticket_category_id);
      }
      
      if (settings.faq_channel_id !== undefined) {
        updates.push('faq_channel_id = ?');
        params.push(settings.faq_channel_id);
      }
      
      if (settings.rules_channel_id !== undefined) {
        updates.push('rules_channel_id = ?');
        params.push(settings.rules_channel_id);
      }
      
      if (settings.staff_role_ids !== undefined) {
        updates.push('staff_role_ids = ?');
        params.push(JSON.stringify(settings.staff_role_ids));
      }
      
      if (settings.auto_mod_enabled !== undefined) {
        updates.push('auto_mod_enabled = ?');
        params.push(settings.auto_mod_enabled ? 1 : 0);
      }
      
      if (settings.auto_mod_settings !== undefined) {
        updates.push('auto_mod_settings = ?');
        params.push(JSON.stringify(settings.auto_mod_settings));
      }
      
      // Add updated_at timestamp
      updates.push('updated_at = CURRENT_TIMESTAMP');
      
      // If no updates, return early
      if (updates.length === 0) {
        return true;
      }
      
      // Build and execute the query
      const query = `UPDATE server_settings SET ${updates.join(', ')} WHERE guild_id = ?`;
      params.push(guildId);
      
      const stmt = db.prepare(query);
      const result = stmt.run(...params);
      
      // Only log if we actually changed something
      if (result.changes > 0) {
        logInfo('ServerSettingsService', `Updated settings for guild ${guildId}`);
      }
      return true;
    } catch (error) {
      logError('ServerSettingsService', error);
      return false;
    }
  },
  
  async getSetting(guildId: string, key: keyof ServerSettings): Promise<any> {
    try {
      // For most settings, we can directly query the column
      const directColumns = [
        'log_channel_id', 'mod_log_channel_id', 'member_log_channel_id',
        'message_log_channel_id', 'server_log_channel_id', 'welcome_channel_id',
        'welcome_message', 'ticket_category_id', 'name', 'language',
        'faq_channel_id', 'rules_channel_id'
      ];
      
      if (directColumns.includes(key)) {
        const stmt = db.prepare(`SELECT ${key} FROM server_settings WHERE guild_id = ?`);
        const result = stmt.get(guildId) as Record<string, any> | undefined;
        
        return result ? result[key] : null;
      }
      
      // For other settings, we need to get the full record and parse JSON fields
      const stmt = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?');
      const settings = stmt.get(guildId) as ServerSettings | undefined;
      
      if (!settings) {
        return null;
      }
      
      // Convert auto_mod_enabled to boolean
      if (key === 'auto_mod_enabled') {
        return !!settings.auto_mod_enabled;
      }
      
      // Parse auto_mod_settings
      if (key === 'auto_mod_settings' && settings.auto_mod_settings) {
        if (typeof settings.auto_mod_settings === 'string') {
          try {
            return JSON.parse(settings.auto_mod_settings);
          } catch (e) {
            return {
              filter_profanity: true,
              filter_invites: true,
              filter_links: false,
              spam_protection: true,
              max_mentions: 5,
              max_emojis: 10
            };
          }
        }
        return settings.auto_mod_settings;
      }
      
      // Parse staff_role_ids
      if (key === 'staff_role_ids' && settings.staff_role_ids) {
        if (typeof settings.staff_role_ids === 'string') {
          try {
            return JSON.parse(settings.staff_role_ids);
          } catch (e) {
            return [];
          }
        }
        return settings.staff_role_ids;
      }
      
      return settings[key] || null;
    } catch (error) {
      logError('ServerSettingsService', error);
      return null;
    }
  }
};
