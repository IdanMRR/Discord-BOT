import { Collection } from 'discord.js';
import { ServerSettingsService } from '../database/services/sqliteService';
import { logInfo, logError } from './logger';

// Interface for our settings format
export interface ServerSettings {
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
  language?: string;
  log_all_commands?: boolean;
  staff_role_ids?: string[];
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
}

// Settings manager that uses SQLite for persistent storage
class SettingsManager {
  private cache: Collection<string, ServerSettings>;

  constructor() {
    this.cache = new Collection<string, ServerSettings>();
  }

  // Get settings for a specific guild
  async getSettings(guildId: string): Promise<ServerSettings> {
    // First check the cache
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId) as ServerSettings;
    }
    
    try {
      // If not in cache, fetch from SQLite
      const settings = await ServerSettingsService.getOrCreate(guildId, 'Unknown Server');
      
      if (settings) {
        // Convert auto_mod_settings from string to object if needed
        if (typeof settings.auto_mod_settings === 'string') {
          try {
            settings.auto_mod_settings = JSON.parse(settings.auto_mod_settings);
          } catch (e) {
            // Use default settings if parsing fails
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
        
        // Convert staff_role_ids from string to array if needed
        if (typeof settings.staff_role_ids === 'string') {
          try {
            settings.staff_role_ids = JSON.parse(settings.staff_role_ids);
          } catch (e) {
            settings.staff_role_ids = [];
          }
        }
        
        // Update cache
        this.cache.set(guildId, settings as ServerSettings);
        
        return settings as ServerSettings;
      }
      
      // If no settings found, return empty object
      return {} as ServerSettings;
    } catch (error) {
      logError('SettingsManager', `Error fetching settings for guild ${guildId}: ${error}`);
      return {} as ServerSettings;
    }
  }
  
  // Get a specific setting for a guild
  async getSetting(guildId: string, key: keyof ServerSettings): Promise<any> {
    try {
      // Try to get directly from the database first for most up-to-date value
      const value = await ServerSettingsService.getSetting(guildId, key);
      
      // Update cache if we have this guild cached
      if (this.cache.has(guildId) && value !== null) {
        const cachedSettings = this.cache.get(guildId) as ServerSettings;
        cachedSettings[key] = value;
        this.cache.set(guildId, cachedSettings);
      }
      
      return value;
    } catch (error) {
      logError('SettingsManager', `Error getting setting ${String(key)} for guild ${guildId}: ${error}`);
      
      // Fall back to cache if available
      if (this.cache.has(guildId)) {
        const cachedSettings = this.cache.get(guildId) as ServerSettings;
        return cachedSettings[key];
      }
      
      return null;
    }
  }
  
  // Set a specific setting for a guild
  async setSetting(guildId: string, key: keyof ServerSettings, value: any): Promise<boolean> {
    try {
      // Create a partial settings object with just the one setting
      const updateSettings: Partial<ServerSettings> = {};
      updateSettings[key] = value;
      
      // Update in SQLite
      const success = await ServerSettingsService.updateSettings(guildId, updateSettings);
      
      if (success) {
        // Also update in cache if it exists
        if (this.cache.has(guildId)) {
          const cachedSettings = this.cache.get(guildId) as ServerSettings;
          cachedSettings[key] = value;
          this.cache.set(guildId, cachedSettings);
        }
        
        logInfo('SettingsManager', `Updated setting ${String(key)} for guild ${guildId}`);
        return true;
      }
      
      logError('SettingsManager', `Failed to update setting ${String(key)} for guild ${guildId}`);
      return false;
    } catch (error) {
      logError('SettingsManager', `Error updating setting ${String(key)} for guild ${guildId}: ${error}`);
      return false;
    }
  }
  
  // Update multiple settings for a guild
  async updateSettings(guildId: string, newSettings: Partial<ServerSettings>): Promise<boolean> {
    try {
      // Update in SQLite
      const success = await ServerSettingsService.updateSettings(guildId, newSettings);
      
      if (success) {
        // Also update in cache if it exists
        if (this.cache.has(guildId)) {
          const cachedSettings = this.cache.get(guildId) as ServerSettings;
          Object.assign(cachedSettings, newSettings);
          this.cache.set(guildId, cachedSettings);
        }
        
        logInfo('SettingsManager', `Updated settings for guild ${guildId}`);
        return true;
      }
      
      logError('SettingsManager', `Failed to update settings for guild ${guildId}`);
      return false;
    } catch (error) {
      logError('SettingsManager', `Error updating settings for guild ${guildId}: ${error}`);
      return false;
    }
  }
  
  // Clear the cache for a specific guild or all guilds
  clearCache(guildId?: string): void {
    if (guildId) {
      this.cache.delete(guildId);
      logInfo('SettingsManager', `Cleared cache for guild ${guildId}`);
    } else {
      this.cache.clear();
      logInfo('SettingsManager', 'Cleared all settings cache');
    }
  }
}

export const settingsManager = new SettingsManager();
