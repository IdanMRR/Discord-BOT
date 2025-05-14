import { logError, logInfo } from '../../utils/logger';
import { db } from '../sqlite';

/**
 * Service for managing user settings in the database
 */
export class UserSettingsService {
  /**
   * Initialize the user settings table
   */
  static async initialize(): Promise<void> {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id TEXT,
          setting_key TEXT,
          setting_value TEXT,
          PRIMARY KEY (user_id, setting_key)
        )
      `);
      logInfo('UserSettingsService', 'Initialized user_settings table');
      return Promise.resolve();
    } catch (error) {
      logError('UserSettingsService', `Error initializing user_settings table: ${error}`);
      return Promise.reject(error);
    }
  }
  
  /**
   * Get a user setting
   * @param userId The user ID
   * @param key The setting key
   * @returns The setting value, or null if not found
   */
  static async getSetting(userId: string, key: string): Promise<string | null> {
    try {
      const stmt = db.prepare('SELECT setting_value FROM user_settings WHERE user_id = ? AND setting_key = ?');
      const row = stmt.get(userId, key) as { setting_value: string } | undefined;
      return row ? row.setting_value : null;
    } catch (error) {
      logError('UserSettingsService', `Error getting user setting: ${error}`);
      return null;
    }
  }
  
  /**
   * Set a user setting
   * @param userId The user ID
   * @param key The setting key
   * @param value The setting value
   */
  static async setSetting(userId: string, key: string, value: string): Promise<void> {
    try {
      const stmt = db.prepare(
        'INSERT OR REPLACE INTO user_settings (user_id, setting_key, setting_value) VALUES (?, ?, ?)'
      );
      stmt.run(userId, key, value);
      logInfo('UserSettingsService', `Set user setting ${key} for user ${userId}`);
    } catch (error) {
      logError('UserSettingsService', `Error setting user setting: ${error}`);
      throw error;
    }
  }
  
  /**
   * Delete a user setting
   * @param userId The user ID
   * @param key The setting key
   */
  static async deleteSetting(userId: string, key: string): Promise<void> {
    try {
      const stmt = db.prepare('DELETE FROM user_settings WHERE user_id = ? AND setting_key = ?');
      stmt.run(userId, key);
      logInfo('UserSettingsService', `Deleted user setting ${key} for user ${userId}`);
    } catch (error) {
      logError('UserSettingsService', `Error deleting user setting: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get all settings for a user
   * @param userId The user ID
   * @returns An object with all settings for the user
   */
  static async getAllSettings(userId: string): Promise<Record<string, string>> {
    try {
      const stmt = db.prepare('SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?');
      const rows = stmt.all(userId) as Array<{ setting_key: string, setting_value: string }>;
      
      const settings: Record<string, string> = {};
      rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });
      return settings;
    } catch (error) {
      logError('UserSettingsService', `Error getting all user settings: ${error}`);
      return {};
    }
  }
}
