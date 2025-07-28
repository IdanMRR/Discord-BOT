import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

export interface AutomodEscalationSettings {
  id?: number;
  guild_id: string;
  enabled: boolean;
  reset_warnings_after_days: number;
  created_at?: string;
  updated_at?: string;
}

export interface AutomodEscalationRule {
  id?: number;
  guild_id: string;
  warning_threshold: number;
  punishment_type: 'timeout' | 'kick' | 'ban' | 'role_remove' | 'role_add' | 'nothing';
  punishment_duration?: number; // in minutes for timeout
  punishment_reason: string;
  role_id?: string; // for role_add/role_remove punishments
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AutomodEscalationLog {
  id?: number;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  rule_id: number;
  warning_count: number;
  punishment_type: string;
  punishment_duration?: number;
  punishment_reason: string;
  success: boolean;
  error_message?: string;
  case_number?: number;
  created_at?: string;
}

export class AutomodEscalationService {
  
  // Settings Management
  static async getSettings(guildId: string): Promise<AutomodEscalationSettings | null> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM automod_escalation_settings 
        WHERE guild_id = ?
      `);
      
      const result = stmt.get(guildId) as AutomodEscalationSettings | undefined;
      if (result) {
        // Convert SQLite INTEGER (0/1) to boolean
        return {
          ...result,
          enabled: Boolean(result.enabled)
        };
      }
      return null;
    } catch (error) {
      logError('AutomodEscalationService', `Error getting settings for guild ${guildId}: ${error}`);
      throw error;
    }
  }

  static async createOrUpdateSettings(settings: AutomodEscalationSettings): Promise<AutomodEscalationSettings> {
    try {
      const existing = await this.getSettings(settings.guild_id);
      
      if (existing) {
        const stmt = db.prepare(`
          UPDATE automod_escalation_settings 
          SET enabled = ?, reset_warnings_after_days = ?, updated_at = CURRENT_TIMESTAMP
          WHERE guild_id = ?
        `);
        
        stmt.run(
          settings.enabled ? 1 : 0,
          settings.reset_warnings_after_days,
          settings.guild_id
        );
        
        logInfo('AutomodEscalationService', `Updated automod settings for guild ${settings.guild_id}`);
        return await this.getSettings(settings.guild_id) as AutomodEscalationSettings;
      } else {
        const stmt = db.prepare(`
          INSERT INTO automod_escalation_settings (guild_id, enabled, reset_warnings_after_days)
          VALUES (?, ?, ?)
        `);
        
        stmt.run(
          settings.guild_id,
          settings.enabled ? 1 : 0,
          settings.reset_warnings_after_days
        );
        
        logInfo('AutomodEscalationService', `Created automod settings for guild ${settings.guild_id}`);
        return await this.getSettings(settings.guild_id) as AutomodEscalationSettings;
      }
    } catch (error) {
      logError('AutomodEscalationService', `Error creating/updating settings: ${error}`);
      throw error;
    }
  }

  // Rule Management
  static async getRules(guildId: string): Promise<AutomodEscalationRule[]> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM automod_escalation_rules 
        WHERE guild_id = ?
        ORDER BY warning_threshold ASC
      `);
      
      const results = stmt.all(guildId) as AutomodEscalationRule[];
      return results.map(rule => ({
        ...rule,
        enabled: Boolean(rule.enabled)
      }));
    } catch (error) {
      logError('AutomodEscalationService', `Error getting rules for guild ${guildId}: ${error}`);
      throw error;
    }
  }

  static async createRule(rule: Omit<AutomodEscalationRule, 'id' | 'created_at' | 'updated_at'>): Promise<AutomodEscalationRule> {
    try {
      const stmt = db.prepare(`
        INSERT INTO automod_escalation_rules 
        (guild_id, warning_threshold, punishment_type, punishment_duration, punishment_reason, role_id, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        rule.guild_id,
        rule.warning_threshold,
        rule.punishment_type,
        rule.punishment_duration || null,
        rule.punishment_reason,
        rule.role_id || null,
        rule.enabled ? 1 : 0
      );
      
      logInfo('AutomodEscalationService', `Created escalation rule ${result.lastInsertRowid} for guild ${rule.guild_id}`);
      
      const getStmt = db.prepare('SELECT * FROM automod_escalation_rules WHERE id = ?');
      const newRule = getStmt.get(result.lastInsertRowid) as AutomodEscalationRule;
      return {
        ...newRule,
        enabled: Boolean(newRule.enabled)
      };
    } catch (error) {
      logError('AutomodEscalationService', `Error creating rule: ${error}`);
      throw error;
    }
  }

  static async updateRule(id: number, updates: Partial<AutomodEscalationRule>): Promise<AutomodEscalationRule> {
    try {
      const setClause = [];
      const values = [];
      
      if (updates.warning_threshold !== undefined) {
        setClause.push('warning_threshold = ?');
        values.push(updates.warning_threshold);
      }
      if (updates.punishment_type !== undefined) {
        setClause.push('punishment_type = ?');
        values.push(updates.punishment_type);
      }
      if (updates.punishment_duration !== undefined) {
        setClause.push('punishment_duration = ?');
        values.push(updates.punishment_duration);
      }
      if (updates.punishment_reason !== undefined) {
        setClause.push('punishment_reason = ?');
        values.push(updates.punishment_reason);
      }
      if (updates.role_id !== undefined) {
        setClause.push('role_id = ?');
        values.push(updates.role_id);
      }
      if (updates.enabled !== undefined) {
        setClause.push('enabled = ?');
        values.push(updates.enabled ? 1 : 0);
      }
      
      setClause.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const stmt = db.prepare(`
        UPDATE automod_escalation_rules 
        SET ${setClause.join(', ')}
        WHERE id = ?
      `);
      
      stmt.run(...values);
      
      logInfo('AutomodEscalationService', `Updated escalation rule ${id}`);
      
      const getStmt = db.prepare('SELECT * FROM automod_escalation_rules WHERE id = ?');
      const updatedRule = getStmt.get(id) as AutomodEscalationRule;
      return {
        ...updatedRule,
        enabled: Boolean(updatedRule.enabled)
      };
    } catch (error) {
      logError('AutomodEscalationService', `Error updating rule ${id}: ${error}`);
      throw error;
    }
  }

  static async deleteRule(id: number): Promise<boolean> {
    try {
      const stmt = db.prepare('DELETE FROM automod_escalation_rules WHERE id = ?');
      const result = stmt.run(id);
      
      logInfo('AutomodEscalationService', `Deleted escalation rule ${id}`);
      return result.changes > 0;
    } catch (error) {
      logError('AutomodEscalationService', `Error deleting rule ${id}: ${error}`);
      throw error;
    }
  }

  // Escalation Logic
  static async checkEscalation(guildId: string, userId: string, warningCount: number): Promise<AutomodEscalationRule | null> {
    try {
      logInfo('AutomodEscalationService', `Checking escalation for guild ${guildId}, user ${userId}, warnings: ${warningCount}`);
      
      const settings = await this.getSettings(guildId);
      logInfo('AutomodEscalationService', `Automod settings: ${settings ? `enabled=${settings.enabled}, reset_days=${settings.reset_warnings_after_days}` : 'not found'}`);
      
      if (!settings || !settings.enabled) {
        logInfo('AutomodEscalationService', 'Automod escalation disabled or no settings found');
        return null;
      }

      // Find the highest threshold rule that applies
      const stmt = db.prepare(`
        SELECT * FROM automod_escalation_rules 
        WHERE guild_id = ? AND warning_threshold <= ? AND enabled = 1
        ORDER BY warning_threshold DESC
        LIMIT 1
      `);
      
      const rule = stmt.get(guildId, warningCount) as AutomodEscalationRule | undefined;
      
      logInfo('AutomodEscalationService', `Rule search result: ${rule ? `found rule id=${rule.id}, threshold=${rule.warning_threshold}, punishment=${rule.punishment_type}` : 'no rule found'}`);
      
      if (rule) {
        return {
          ...rule,
          enabled: Boolean(rule.enabled)
        };
      }
      
      return null;
    } catch (error) {
      logError('AutomodEscalationService', `Error checking escalation for guild ${guildId}, user ${userId}: ${error}`);
      throw error;
    }
  }

  // Logging
  static async logEscalationAction(log: Omit<AutomodEscalationLog, 'id' | 'created_at'>): Promise<void> {
    try {
      const stmt = db.prepare(`
        INSERT INTO automod_escalation_log 
        (guild_id, user_id, moderator_id, rule_id, warning_count, punishment_type, 
         punishment_duration, punishment_reason, success, error_message, case_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        log.guild_id,
        log.user_id,
        log.moderator_id,
        log.rule_id,
        log.warning_count,
        log.punishment_type,
        log.punishment_duration || null,
        log.punishment_reason,
        log.success ? 1 : 0,
        log.error_message || null,
        log.case_number || null
      );
      
      logInfo('AutomodEscalationService', `Logged escalation action for user ${log.user_id} in guild ${log.guild_id}`);
    } catch (error) {
      logError('AutomodEscalationService', `Error logging escalation action: ${error}`);
      throw error;
    }
  }

  static async getEscalationLogs(guildId: string, limit: number = 100, offset: number = 0): Promise<AutomodEscalationLog[]> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM automod_escalation_log 
        WHERE guild_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);
      
      const results = stmt.all(guildId, limit, offset) as AutomodEscalationLog[];
      return results.map(log => ({
        ...log,
        success: Boolean(log.success)
      }));
    } catch (error) {
      logError('AutomodEscalationService', `Error getting escalation logs for guild ${guildId}: ${error}`);
      throw error;
    }
  }

  static async getUserEscalationHistory(guildId: string, userId: string): Promise<AutomodEscalationLog[]> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM automod_escalation_log 
        WHERE guild_id = ? AND user_id = ?
        ORDER BY created_at DESC
      `);
      
      const results = stmt.all(guildId, userId) as AutomodEscalationLog[];
      return results.map(log => ({
        ...log,
        success: Boolean(log.success)
      }));
    } catch (error) {
      logError('AutomodEscalationService', `Error getting escalation history for user ${userId} in guild ${guildId}: ${error}`);
      throw error;
    }
  }

  // Utility Methods
  static async getEscalationStats(guildId: string): Promise<{
    totalRules: number;
    activeRules: number;
    totalActions: number;
    successfulActions: number;
    recentActions: number; // last 24 hours
  }> {
    try {
      const rulesStmt = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as active
        FROM automod_escalation_rules 
        WHERE guild_id = ?
      `);
      
      const actionsStmt = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END) as recent
        FROM automod_escalation_log 
        WHERE guild_id = ?
      `);
      
      const rulesResult = rulesStmt.get(guildId) as any;
      const actionsResult = actionsStmt.get(guildId) as any;
      
      return {
        totalRules: rulesResult.total || 0,
        activeRules: rulesResult.active || 0,
        totalActions: actionsResult.total || 0,
        successfulActions: actionsResult.successful || 0,
        recentActions: actionsResult.recent || 0
      };
    } catch (error) {
      logError('AutomodEscalationService', `Error getting escalation stats for guild ${guildId}: ${error}`);
      throw error;
    }
  }
}

export default AutomodEscalationService;