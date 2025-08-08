import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

// Server Settings Service
export const ServerSettingsService = {
  async listServers(): Promise<{ success: boolean; data: ServerSettings[]; error?: any }> {
    try {
      const stmt = db.prepare('SELECT * FROM server_settings ORDER BY name');
      const servers = stmt.all() as ServerSettings[];
      
      return {
        success: true,
        data: servers
      };
    } catch (error) {
      logError('ServerSettingsService', `Error listing servers: ${error}`);
      return {
        success: false,
        data: [],
        error
      };
    }
  },
  
  async getServerSettings(guildId: string): Promise<ServerSettings | null> {
    try {
      const stmt = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?');
      const settings = stmt.get(guildId) as ServerSettings | undefined;

      if (!settings) {
        return null;
      }

      // Parse JSON fields
      if (settings.staff_role_ids && typeof settings.staff_role_ids === 'string') {
        try {
          settings.staff_role_ids = JSON.parse(settings.staff_role_ids);
        } catch (e) {
          settings.staff_role_ids = [];
        }
      }

      if (settings.auto_mod_settings && typeof settings.auto_mod_settings === 'string') {
        try {
          settings.auto_mod_settings = JSON.parse(settings.auto_mod_settings);
        } catch (e) {
          settings.auto_mod_settings = {
            filter_profanity: true,
            filter_invites: true,
            filter_links: false,
            spam_protection: true,
            max_mentions: 5,
            max_emojis: 10
          };
        }
      }

      if (settings.templates && typeof settings.templates === 'string') {
        try {
          settings.templates = JSON.parse(settings.templates);
        } catch (e) {
          settings.templates = {};
        }
      }

      if (settings.active_templates && typeof settings.active_templates === 'string') {
        try {
          settings.active_templates = JSON.parse(settings.active_templates);
        } catch (e) {
          settings.active_templates = {};
        }
      }

      if (settings.red_alert_channels && typeof settings.red_alert_channels === 'string') {
        try {
          settings.red_alert_channels = JSON.parse(settings.red_alert_channels);
        } catch (e) {
          settings.red_alert_channels = [];
        }
      }

      return settings;
    } catch (error) {
      logError('ServerSettingsService', `Error getting server settings: ${error}`);
      return null;
    }
  },

  async getSetting<T>(guildId: string, key: keyof ServerSettings): Promise<T | null> {
    try {
      const settings = await this.getServerSettings(guildId);
      if (!settings) {
        return null;
      }
      return settings[key] as T;
    } catch (error) {
      logError('ServerSettingsService', `Error getting setting ${String(key)}: ${error}`);
      return null;
    }
  },

  async updateSettings(guildId: string, updates: Partial<ServerSettings>): Promise<boolean> {
    try {
      // First, ensure the guild exists in the database
      const existingSettings = await this.getOrCreate(guildId, updates.name || 'Unknown Server');
      if (!existingSettings) {
        logError('ServerSettingsService', `Failed to create or get settings for guild ${guildId}`);
        return false;
      }

      const updateFields: string[] = [];
      const params: any[] = [];

      // Handle each possible field that can be updated
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          // Handle special JSON fields
          if (['staff_role_ids', 'auto_mod_settings', 'templates', 'active_templates', 'red_alert_channels'].includes(key)) {
            updateFields.push(`${key} = ?`);
            params.push(JSON.stringify(value));
          } else if (['auto_mod_enabled', 'ticket_chatbot_enabled', 'ticket_chatbot_ai_enabled', 'log_all_commands'].includes(key)) {
            // Handle boolean fields - convert to integer
            updateFields.push(`${key} = ?`);
            params.push(value ? 1 : 0);
          } else {
            updateFields.push(`${key} = ?`);
            params.push(value);
          }
        }
      });

      if (updateFields.length === 0) {
        logInfo('ServerSettingsService', `No fields to update for guild ${guildId}`);
        return true; // No updates needed
      }

      // Add updated_at timestamp
      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      // Add guild_id to params for WHERE clause
      params.push(guildId);

      const query = `UPDATE server_settings SET ${updateFields.join(', ')} WHERE guild_id = ?`;
      const stmt = db.prepare(query);
      const result = stmt.run(...params);

      logInfo('ServerSettingsService', `Update query: ${query}`);
      logInfo('ServerSettingsService', `Update params: ${JSON.stringify(params)}`);
      logInfo('ServerSettingsService', `Update result: changes=${result.changes}`);

      if (result.changes === 0) {
        logError('ServerSettingsService', `No rows updated for guild ${guildId} despite guild existing`);
        return false;
      }

      logInfo('ServerSettingsService', `Successfully updated ${result.changes} row(s) for guild ${guildId}`);
      return true;
    } catch (error) {
      logError('ServerSettingsService', `Error updating settings for guild ${guildId}: ${error}`);
      return false;
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
      logError('ServerSettingsService', `Error in getOrCreate: ${error}`);
      return null;
    }
  },

  // DM Settings Management - PDR requirement
  async getDMSettings(guildId: string): Promise<{
    dm_warnings_enabled: boolean;
    dm_tickets_enabled: boolean;
    dm_level_notifications: boolean;
    dm_general_notifications: boolean;
  }> {
    try {
      const settings = await this.getServerSettings(guildId);
      
      // PDR requirement: Default ON, allow server override
      return {
        dm_warnings_enabled: settings?.dm_warnings_enabled ?? true,
        dm_tickets_enabled: settings?.dm_tickets_enabled ?? true,
        dm_level_notifications: settings?.dm_level_notifications ?? true,
        dm_general_notifications: settings?.dm_general_notifications ?? true
      };
    } catch (error) {
      logError('ServerSettingsService', `Error getting DM settings: ${error}`);
      // Return defaults if error
      return {
        dm_warnings_enabled: true,
        dm_tickets_enabled: true,
        dm_level_notifications: true,
        dm_general_notifications: true
      };
    }
  },

  async updateDMSettings(guildId: string, dmSettings: {
    dm_warnings_enabled?: boolean;
    dm_tickets_enabled?: boolean;
    dm_level_notifications?: boolean;
    dm_general_notifications?: boolean;
  }): Promise<boolean> {
    try {
      const currentSettings = await this.getServerSettings(guildId);
      
      if (!currentSettings) {
        // Create default settings first
        await this.getOrCreate(guildId, 'Unknown Server');
      }

      const updateFields = [];
      const values = [];
      
      if (dmSettings.dm_warnings_enabled !== undefined) {
        updateFields.push('dm_warnings_enabled = ?');
        values.push(dmSettings.dm_warnings_enabled ? 1 : 0);
      }
      
      if (dmSettings.dm_tickets_enabled !== undefined) {
        updateFields.push('dm_tickets_enabled = ?');
        values.push(dmSettings.dm_tickets_enabled ? 1 : 0);
      }
      
      if (dmSettings.dm_level_notifications !== undefined) {
        updateFields.push('dm_level_notifications = ?');
        values.push(dmSettings.dm_level_notifications ? 1 : 0);
      }
      
      if (dmSettings.dm_general_notifications !== undefined) {
        updateFields.push('dm_general_notifications = ?');
        values.push(dmSettings.dm_general_notifications ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return true; // No changes to make
      }

      values.push(guildId);
      
      const stmt = db.prepare(`
        UPDATE server_settings 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
        WHERE guild_id = ?
      `);
      
      const result = stmt.run(...values);
      
      logInfo('ServerSettingsService', `Updated DM settings for guild ${guildId}`);
      return result.changes > 0;
    } catch (error) {
      logError('ServerSettingsService', `Error updating DM settings: ${error}`);
      return false;
    }
  }
};

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
  // DM Settings - PDR requirement for default ON with server override capability
  dm_warnings_enabled?: boolean;
  dm_tickets_enabled?: boolean;
  dm_level_notifications?: boolean;
  dm_general_notifications?: boolean;
  created_at?: string;
  updated_at?: string;
}
