import * as fs from 'fs';
import * as path from 'path';
import { Guild, User } from 'discord.js';
import { logError, logInfo } from './logger';
import { UserSettingsService } from '../database/services/userSettingsService';
import { ServerSettingsService } from '../database/services/sqliteService';
import { db } from '../database/sqlite';

// Define available languages
export const AVAILABLE_LANGUAGES = ['en'] as const;
export type Language = typeof AVAILABLE_LANGUAGES[number];

// Define translation cache
const translations: Record<Language, any> = {} as Record<Language, any>;

// Load all translations
export function loadTranslations() {
  for (const lang of AVAILABLE_LANGUAGES) {
    try {
      const filePath = path.join(process.cwd(), 'src', 'locales', `${lang}.json`);
      const content = fs.readFileSync(filePath, 'utf-8');
      translations[lang] = JSON.parse(content);
      logInfo('Language', `Loaded translations for ${lang}`);
    } catch (error) {
      logError('Language', `Failed to load translations for ${lang}: ${error}`);
    }
  }
}

// Get translation for a key
export function getTranslation(key: string, language: Language = 'en'): string {
  // If translations are not loaded yet, load them
  if (Object.keys(translations).length === 0) {
    loadTranslations();
  }

  // Split the key by dots to navigate the nested structure
  const keys = key.split('.');
  let result: any = translations[language];

  // Navigate through the nested structure
  for (const k of keys) {
    if (result && result[k] !== undefined) {
      result = result[k];
    } else {
      // If key not found in the specified language, try English as fallback
      if (language !== 'en') {
        return getTranslation(key, 'en');
      }
      // If still not found, return the key itself
      return key;
    }
  }

  return result;
}

// Shorthand function for getTranslation
export function t(key: string, language: Language = 'en'): string {
  return getTranslation(key, language);
}

// Database functions for language preferences
export async function getUserLanguage(userId: string): Promise<Language> {
  try {
    // Get the user's language preference directly from our imported UserSettingsService
    const language = await UserSettingsService.getSetting(userId, 'language') as Language | null;
    
    // Return the language or default to English
    return language || 'en';
  } catch (error) {
    logError('Language', `Failed to get user language: ${error}`);
    return 'en';
  }
}

export async function getGuildLanguage(guildId: string): Promise<Language> {
  try {
    // Get the guild's language preference using ServerSettingsService
    // We need to use updateSettings to add a custom field since 'language' isn't in the ServerSettings interface
    const settings = await ServerSettingsService.getOrCreate(guildId, 'Unknown');
    if (!settings) return 'en';
    
    // Try to get the language from the settings
    // This requires us to manually check for the language field since it's not in the interface
    const stmt = db.prepare('SELECT language FROM server_settings WHERE guild_id = ?');
    const result = stmt.get(guildId) as any;
    
    return (result && result.language) ? result.language as Language : 'en';
  } catch (error) {
    logError('Language', `Failed to get guild language: ${error}`);
    return 'en';
  }
}

export async function setUserLanguage(userId: string, language: Language): Promise<boolean> {
  try {
    // Set the user's language preference directly
    await UserSettingsService.setSetting(userId, 'language', language);
    
    logInfo('Language', `Set user ${userId} language to ${language}`);
    return true;
  } catch (error) {
    logError('Language', `Failed to set user language: ${error}`);
    return false;
  }
}

export async function setGuildLanguage(guildId: string, language: Language): Promise<boolean> {
  try {
    // For guild language, we need to use a direct SQL query since 'language' isn't in the ServerSettings interface
    const stmt = db.prepare('UPDATE server_settings SET language = ? WHERE guild_id = ?');
    stmt.run(language, guildId);
    
    logInfo('Language', `Set guild ${guildId} language to ${language}`);
    return true;
  } catch (error) {
    logError('Language', `Failed to set guild language: ${error}`);
    return false;
  }
}

// Helper function to get the appropriate language for a context
export async function getContextLanguage(guildId?: string, userId?: string): Promise<Language> {
  try {
    // If user ID is provided, try to get user language first
    if (userId) {
      const userLanguage = await getUserLanguage(userId);
      if (userLanguage && AVAILABLE_LANGUAGES.includes(userLanguage)) {
        return userLanguage;
      }
    }
    
    // If guild ID is provided, try to get guild language
    if (guildId) {
      const guildLanguage = await getGuildLanguage(guildId);
      if (guildLanguage && AVAILABLE_LANGUAGES.includes(guildLanguage)) {
        return guildLanguage;
      }
    }
    
    // Default to English
    return 'en';
  } catch (error) {
    logError('Language', `Error getting context language: ${error}`);
    return 'en';
  }
}

// Function to get translated text for a specific context
export async function translate(key: string, guildId?: string, userId?: string): Promise<string> {
  const language = await getContextLanguage(guildId, userId);
  return t(key, language);
}
