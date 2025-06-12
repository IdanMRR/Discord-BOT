import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';
import { WarningService, TicketService, ServerLogService } from './sqliteService';
import { ServerSettingsService } from './serverSettingsService';
import { Warning, Ticket, ServerLog } from './sqliteService';

// Command Service - New service for tracking command usage
export const CommandService = {
  // Get total command count
  async getTotalCommandCount(): Promise<number> {
    try {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM command_logs');
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      logError('CommandService', `Error getting total command count: ${error}`);
      return 0;
    }
  },

  // Get command count by guild
  async getCommandCountByGuild(guildId: string): Promise<number> {
    try {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM command_logs WHERE guild_id = ?');
      const result = stmt.get(guildId) as { count: number };
      return result.count;
    } catch (error) {
      logError('CommandService', `Error getting command count for guild ${guildId}: ${error}`);
      return 0;
    }
  },

  // Get recent commands by guild
  async getRecentCommandsByGuild(guildId: string, limit: number = 10): Promise<any[]> {
    try {
      const stmt = db.prepare(`
        SELECT cl.*, u.username as user_name 
        FROM command_logs cl
        LEFT JOIN users u ON cl.user_id = u.user_id
        WHERE cl.guild_id = ?
        ORDER BY cl.created_at DESC
        LIMIT ?
      `);
      return stmt.all(guildId, limit) as any[];
    } catch (error) {
      logError('CommandService', `Error getting recent commands for guild ${guildId}: ${error}`);
      return [];
    }
  }
};

// Extensions for existing services
// Add these methods to the WarningService
export const WarningServiceExtensions = {
  // Get active warning count across all guilds
  async getActiveWarningCount(): Promise<number> {
    try {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM warnings WHERE active = 1');
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      logError('WarningService', `Error getting active warning count: ${error}`);
      return 0;
    }
  },

  // Get warning count by guild
  async getWarningCountByGuild(guildId: string): Promise<number> {
    try {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND active = 1');
      const result = stmt.get(guildId) as { count: number };
      return result.count;
    } catch (error) {
      logError('WarningService', `Error getting warning count for guild ${guildId}: ${error}`);
      return 0;
    }
  },

  // Get warnings by guild with user info
  async getWarningsByGuild(guildId: string, limit: number = 10): Promise<any[]> {
    try {
      const stmt = db.prepare(`
        SELECT w.*, u1.username as user_name, u2.username as moderator_name
        FROM warnings w
        LEFT JOIN users u1 ON w.user_id = u1.user_id
        LEFT JOIN users u2 ON w.moderator_id = u2.user_id
        WHERE w.guild_id = ?
        ORDER BY w.created_at DESC
        LIMIT ?
      `);
      return stmt.all(guildId, limit) as any[];
    } catch (error) {
      logError('WarningService', `Error getting warnings for guild ${guildId}: ${error}`);
      return [];
    }
  }
};

// Add these methods to the TicketService
export const TicketServiceExtensions = {
  // Get active ticket count across all guilds
  async getActiveTicketCount(): Promise<number> {
    try {
      const stmt = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'");
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      logError('TicketService', `Error getting active ticket count: ${error}`);
      return 0;
    }
  },

  // Get ticket count by guild
  async getTicketCountByGuild(guildId: string): Promise<number> {
    try {
      const stmt = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = 'open'");
      const result = stmt.get(guildId) as { count: number };
      return result.count;
    } catch (error) {
      logError('TicketService', `Error getting ticket count for guild ${guildId}: ${error}`);
      return 0;
    }
  },

  // Get tickets by guild with user info
  async getTicketsByGuild(guildId: string, limit: number = 10): Promise<any[]> {
    try {
      const stmt = db.prepare(`
        SELECT t.*, u.username as user_name
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.user_id
        WHERE t.guild_id = ?
        ORDER BY 
          CASE WHEN t.status = 'open' THEN 0 ELSE 1 END,
          t.created_at DESC
        LIMIT ?
      `);
      return stmt.all(guildId, limit) as any[];
    } catch (error) {
      logError('TicketService', `Error getting tickets for guild ${guildId}: ${error}`);
      return [];
    }
  }
};

// Add these methods to the ServerLogService
export const LogServiceExtensions = {
  // Get logs by guild with formatted data
  async getLogsByGuild(guildId: string, type: string = 'general', limit: number = 50): Promise<any[]> {
    try {
      let query = `
        SELECT sl.*, u.username as user_name
        FROM server_logs sl
        LEFT JOIN users u ON sl.user_id = u.user_id
        WHERE sl.guild_id = ?
      `;
      
      const params: any[] = [guildId];
      
      if (type && type !== 'all') {
        query += ' AND sl.action_type = ?';
        params.push(type);
      }
      
      query += ' ORDER BY sl.created_at DESC LIMIT ?';
      params.push(limit);
      
      const stmt = db.prepare(query);
      const logs = stmt.all(...params) as any[];
      
      // Format logs for display
      return logs.map(log => ({
        ...log,
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
        timestamp: new Date(log.created_at).getTime(),
        log_type: log.action_type,
        action: getActionDescription(log.action_type)
      }));
    } catch (error) {
      logError('ServerLogService', `Error getting logs for guild ${guildId}: ${error}`);
      return [];
    }
  },
  
  // Get recent logs by guild
  async getRecentLogsByGuild(guildId: string, limit: number = 5): Promise<any[]> {
    try {
      const stmt = db.prepare(`
        SELECT sl.*, u.username as user_name
        FROM server_logs sl
        LEFT JOIN users u ON sl.user_id = u.user_id
        WHERE sl.guild_id = ?
        ORDER BY sl.created_at DESC
        LIMIT ?
      `);
      
      const logs = stmt.all(guildId, limit) as any[];
      
      // Format logs for display
      return logs.map(log => ({
        ...log,
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
        timestamp: new Date(log.created_at).getTime(),
        formatted_time: new Date(log.created_at).toLocaleString(),
        log_type: log.action_type,
        action: getActionDescription(log.action_type)
      }));
    } catch (error) {
      logError('ServerLogService', `Error getting recent logs for guild ${guildId}: ${error}`);
      return [];
    }
  }
};

// Helper function to get human-readable action descriptions
function getActionDescription(actionType: string): string {
  const actionMap: Record<string, string> = {
    'command': 'Command Used',
    'message_delete': 'Message Deleted',
    'message_edit': 'Message Edited',
    'member_join': 'Member Joined',
    'member_leave': 'Member Left',
    'member_ban': 'Member Banned',
    'member_unban': 'Member Unbanned',
    'member_kick': 'Member Kicked',
    'member_update': 'Member Updated',
    'channel_create': 'Channel Created',
    'channel_delete': 'Channel Deleted',
    'channel_update': 'Channel Updated',
    'role_create': 'Role Created',
    'role_delete': 'Role Deleted',
    'role_update': 'Role Updated',
    'warning_add': 'Warning Added',
    'warning_remove': 'Warning Removed',
    'ticket_create': 'Ticket Created',
    'ticket_close': 'Ticket Closed',
    'ticket_reopen': 'Ticket Reopened',
    'ticket_delete': 'Ticket Deleted',
    'server_update': 'Server Updated',
    'automod': 'AutoMod Action',
    'general': 'General Log'
  };
  
  return actionMap[actionType] || actionType;
}

// Extend the existing services with the new methods
Object.assign(WarningService, WarningServiceExtensions);
Object.assign(TicketService, TicketServiceExtensions);
Object.assign(ServerLogService, LogServiceExtensions);

// Export the new CommandService
export { CommandService as LogService };
