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
  weather_channel_id?: string;
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
  guild_id?: string;
  prefix?: string;
  leave_message?: string;
  leave_channel_id?: string;
  member_count_channel_id?: string;
  logs_channel_id?: string;
  starboard_channel_id?: string;
  starboard_threshold?: number;
  ticket_channel_id?: string;
  red_alert_channel_id?: string;
  custom_cities?: string;
  weather_schedule?: string;
  ticket_chatbot_enabled?: boolean;
  ticket_chatbot_ai_enabled?: boolean; // New property for AI chatbot
}

// Default settings for the server
const DEFAULT_SETTINGS: Partial<ServerSettings> = {
  auto_mod_enabled: false,
  auto_mod_settings: {
    filter_profanity: true,
    filter_invites: true,
    filter_links: false,
    spam_protection: true,
    max_mentions: 5,
    max_emojis: 10
  },
  log_all_commands: false,
  staff_role_ids: [],
  language: 'en',
  ticket_chatbot_enabled: true,
  ticket_chatbot_ai_enabled: true
};

// Settings manager that uses SQLite for persistent storage
class SettingsManager {
  private cache: Collection<string, ServerSettings>;

  constructor() {
    this.cache = new Collection<string, ServerSettings>();
  }

  /**
   * Get settings for a guild
   * @param guildId The guild ID
   * @returns The settings for the guild
   */
  public async getSettings(guildId: string): Promise<ServerSettings> {
    try {
      // Check if we have cached settings
      if (this.cache.has(guildId)) {
        return this.cache.get(guildId)!;
      }

      // Get the settings from the database
      const dbSettings = await ServerSettingsService.getOrCreate(guildId, 'Unknown Server');
      
      // If we have settings in the database, parse them
      if (dbSettings) {
        const settings = {...DEFAULT_SETTINGS} as ServerSettings;
        
        // Add each setting from the database
        Object.keys(dbSettings).forEach(key => {
          if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
            try {
              // Check if the value is supposed to be a JSON object
              if (typeof dbSettings[key as keyof typeof dbSettings] === 'string' && 
                  typeof dbSettings[key as keyof typeof dbSettings] === 'string' &&
                  (dbSettings[key as keyof typeof dbSettings] as string).startsWith('{') || 
                  (dbSettings[key as keyof typeof dbSettings] as string).startsWith('[')) {
                (settings as any)[key] = JSON.parse(dbSettings[key as keyof typeof dbSettings] as string);
              } else {
                (settings as any)[key] = dbSettings[key as keyof typeof dbSettings];
              }
            } catch (e) {
              // If JSON parsing fails, just use the value as is
              (settings as any)[key] = dbSettings[key as keyof typeof dbSettings];
            }
          }
        });
        
        // Ensure critical settings have proper type (boolean values might be stored as integers)
        if (typeof settings.ticket_chatbot_enabled === 'number') {
          settings.ticket_chatbot_enabled = Boolean(settings.ticket_chatbot_enabled);
        }
        
        if (typeof settings.ticket_chatbot_ai_enabled === 'number') {
          settings.ticket_chatbot_ai_enabled = Boolean(settings.ticket_chatbot_ai_enabled);
        }
        
        // Cache the settings
        this.cache.set(guildId, settings);
        
        // Return the settings
        return settings;
      }
      
      // If we don't have settings, create default settings
      const defaultSettings = {...DEFAULT_SETTINGS, guild_id: guildId} as ServerSettings;
      
      // Update the cache
      this.cache.set(guildId, defaultSettings);
      
      // Return the default settings
      return defaultSettings;
    } catch (error) {
      logError('Settings', `Error getting settings for guild ${guildId}: ${error}`);
      
      // Return default settings in case of error
      return {...DEFAULT_SETTINGS, guild_id: guildId} as ServerSettings;
    }
  }

  /**
   * Update all settings for a guild
   * @param guildId The guild ID
   * @param settings The new settings
   * @returns True if successful, false otherwise
   */
  public async updateSettings(guildId: string, settings: ServerSettings): Promise<boolean> {
    try {
      // Prepare settings for database (stringify objects)
      const dbSettings = this.prepareSettingsForDb(settings);
      
      // Update the database
      const success = await ServerSettingsService.updateSettings(guildId, dbSettings);
      
      if (success) {
        // Update the cache
        this.cache.set(guildId, settings);
        
        logInfo('Settings', `Updated settings for guild ${guildId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logError('Settings', `Error updating settings for guild ${guildId}: ${error}`);
      return false;
    }
  }

  /**
   * Set a specific setting for a guild
   * @param guildId The guild ID
   * @param key The setting key
   * @param value The new value
   * @returns True if successful, false otherwise
   */
  public async setSetting<K extends keyof ServerSettings>(
    guildId: string, 
    key: K, 
    value: ServerSettings[K]
  ): Promise<boolean> {
    try {
      // Get current settings
      const settings = await this.getSettings(guildId);
      
      // Update the setting
      settings[key] = value;
      
      // Create a partial settings object for the update
      const update: Partial<ServerSettings> = {};
      
      // Set the value with the correct type handling
      if (typeof value === 'object' && value !== null) {
        // For complex objects, we need to JSON stringify
        (update as any)[key] = JSON.stringify(value);
      } else {
        // For simple types, use directly
        (update as any)[key] = value;
      }
      
      // Update the database
      const success = await ServerSettingsService.updateSettings(guildId, update);
      
      if (success) {
        // Update the cache
        this.cache.set(guildId, settings);
        
        logInfo('Settings', `Updated setting ${String(key)} for guild ${guildId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logError('Settings', `Error updating setting ${String(key)} for guild ${guildId}: ${error}`);
      return false;
    }
  }

  /**
   * Check if a specific setting exists for a guild
   * @param guildId The guild ID
   * @param key The setting key
   * @returns True if exists, false otherwise
   */
  public async hasSetting<K extends keyof ServerSettings>(
    guildId: string,
    key: K
  ): Promise<boolean> {
    try {
      const settings = await this.getSettings(guildId);
      return settings[key] !== undefined;
    } catch (error) {
      logError('Settings', `Error checking setting ${String(key)} for guild ${guildId}: ${error}`);
      return false;
    }
  }

  /**
   * Get a specific setting for a guild with proper type safety
   * @param guildId The guild ID
   * @param key The setting key
   * @param defaultValue Default value to return if setting doesn't exist
   * @returns The setting value or default value
   */
  public async getSetting<K extends keyof ServerSettings>(
    guildId: string,
    key: K,
    defaultValue?: ServerSettings[K]
  ): Promise<ServerSettings[K] | undefined> {
    try {
      // Try to get from the database for most up-to-date value
      const value = await ServerSettingsService.getSetting(guildId, key as any);
      
      if (value !== null) {
        // If it's a JSON string, parse it
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            return JSON.parse(value) as ServerSettings[K];
          } catch (e) {
            // If parsing fails, return the string value
            return value as unknown as ServerSettings[K];
          }
        }
        
        return value as ServerSettings[K];
      }
      
      // Fall back to cached settings
      const settings = await this.getSettings(guildId);
      return settings[key] !== undefined ? settings[key] : defaultValue;
    } catch (error) {
      logError('Settings', `Error getting setting ${String(key)} for guild ${guildId}: ${error}`);
      return defaultValue;
    }
  }

  /**
   * Prepare settings for database storage (stringify objects)
   * @param settings The settings
   * @returns Settings ready for DB storage
   */
  private prepareSettingsForDb(settings: ServerSettings): Record<string, any> {
    const dbSettings: Record<string, any> = {};
    
    Object.keys(settings).forEach(key => {
      const value = (settings as any)[key];
      
      // If the value is an object (not null) or array, stringify it
      if (value !== null && typeof value === 'object') {
        dbSettings[key] = JSON.stringify(value);
      } else {
        dbSettings[key] = value;
      }
    });
    
    return dbSettings;
  }
}

// Export a singleton instance of the settings manager
export const settingsManager = new SettingsManager();
