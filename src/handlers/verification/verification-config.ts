import { db } from '../../database/sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Verification types available in the system
 */
export enum VerificationType {
  BUTTON = 'button',      // Simple button verification
  CAPTCHA = 'captcha',    // CAPTCHA verification
  CUSTOM_QUESTION = 'custom_question', // Custom question verification
  AGE_VERIFICATION = 'age_verification' // Age verification
}

/**
 * Interface for verification settings
 */
export interface VerificationSettings {
  enabled: boolean;
  type: VerificationType;
  role_id?: string;       // Role to assign after verification
  channel_id?: string;    // Channel where verification message is sent
  message_id?: string;    // Message ID of the verification message
  custom_questions?: VerificationQuestion[]; // Custom questions for verification
  min_age?: number;       // Minimum age for age verification
  require_account_age?: boolean; // Whether to require a minimum account age
  min_account_age_days?: number; // Minimum account age in days
  log_channel_id?: string; // Channel to log verification attempts
  timeout_minutes?: number; // Timeout for verification attempts
  welcome_message?: string; // Message to send after verification
  welcome_channel_id?: string; // Channel to send welcome message
}

/**
 * Interface for custom verification questions
 */
export interface VerificationQuestion {
  id: string;
  question: string;
  answer: string;
  case_sensitive: boolean;
}

/**
 * Get verification settings for a guild
 * 
 * @param guildId The guild ID to get settings for
 * @returns Promise resolving to verification settings
 */
export async function getVerificationSettings(guildId: string): Promise<VerificationSettings | null> {
  try {
    // First, try to get settings from server_settings table (used by dashboard)
    let serverSettings: any = null;
    try {
      serverSettings = db.prepare(`
        SELECT 
          verified_role_id, 
          verification_channel_id, 
          verification_type,
          verification_message_id
        FROM server_settings 
        WHERE guild_id = ?
      `).get(guildId);
    } catch (error) {
      // server_settings table might not exist yet
    }

    // Then check verification_settings table for additional settings
    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='verification_settings'
    `).get();
    
    let verificationSettings: any = null;
    if (tableCheck) {
      verificationSettings = db.prepare(`
        SELECT * FROM verification_settings WHERE guild_id = ?
      `).get(guildId);
    } else {
      // Create the table if it doesn't exist
      db.prepare(`
        CREATE TABLE IF NOT EXISTS verification_settings (
          guild_id TEXT PRIMARY KEY,
          enabled INTEGER DEFAULT 0,
          type TEXT DEFAULT 'button',
          role_id TEXT,
          channel_id TEXT,
          message_id TEXT,
          custom_questions TEXT,
          min_age INTEGER DEFAULT 13,
          require_account_age INTEGER DEFAULT 0,
          min_account_age_days INTEGER DEFAULT 7,
          log_channel_id TEXT,
          timeout_minutes INTEGER DEFAULT 10,
          welcome_message TEXT,
          welcome_channel_id TEXT
        )
      `).run();
    }

    // If no settings in either table, return default
    if (!serverSettings && !verificationSettings) {
      return {
        enabled: false,
        type: VerificationType.BUTTON
      };
    }

    // Parse custom questions if they exist
    let customQuestions: VerificationQuestion[] = [];
    if (verificationSettings?.custom_questions) {
      try {
        customQuestions = JSON.parse(verificationSettings.custom_questions);
      } catch (error) {
        logError('Verification', `Error parsing custom questions: ${error}`);
      }
    }

    // Merge settings, prioritizing server_settings for core values
    const settings: VerificationSettings = {
      enabled: verificationSettings?.enabled ? Boolean(verificationSettings.enabled) : Boolean(serverSettings?.verified_role_id),
      type: (serverSettings?.verification_type || verificationSettings?.type || VerificationType.BUTTON) as VerificationType,
      role_id: serverSettings?.verified_role_id || verificationSettings?.role_id, // Prioritize dashboard setting
      channel_id: serverSettings?.verification_channel_id || verificationSettings?.channel_id,
      message_id: serverSettings?.verification_message_id || verificationSettings?.message_id,
      custom_questions: customQuestions,
      min_age: verificationSettings?.min_age || 13,
      require_account_age: verificationSettings?.require_account_age ? Boolean(verificationSettings.require_account_age) : false,
      min_account_age_days: verificationSettings?.min_account_age_days || 7,
      log_channel_id: verificationSettings?.log_channel_id,
      timeout_minutes: verificationSettings?.timeout_minutes || 10,
      welcome_message: verificationSettings?.welcome_message,
      welcome_channel_id: verificationSettings?.welcome_channel_id
    };

    logInfo('Verification', `Loaded verification settings for guild ${guildId}: role_id=${settings.role_id}, enabled=${settings.enabled}, type=${settings.type}`);
    
    return settings;
  } catch (error) {
    logError('Verification', `Error getting verification settings: ${error}`);
    return null;
  }
}

/**
 * Save verification settings for a guild
 * 
 * @param guildId The guild ID to save settings for
 * @param settings The verification settings to save
 * @returns Promise resolving to true if successful
 */
export async function saveVerificationSettings(
  guildId: string,
  settings: VerificationSettings
): Promise<boolean> {
  try {
    // Save core settings to server_settings table (used by dashboard)
    try {
      const serverUpdateStmt = db.prepare(`
        UPDATE server_settings 
        SET 
          verified_role_id = ?,
          verification_channel_id = ?,
          verification_type = ?,
          verification_message_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE guild_id = ?
      `);
      
      const result = serverUpdateStmt.run(
        settings.role_id || null,
        settings.channel_id || null,
        settings.type || 'button',
        settings.message_id || null,
        guildId
      );
      
      // If no rows affected, insert a new record
      if (result.changes === 0) {
        const serverInsertStmt = db.prepare(`
          INSERT OR REPLACE INTO server_settings (
            guild_id,
            verified_role_id,
            verification_channel_id,
            verification_type,
            verification_message_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
        
        serverInsertStmt.run(
          guildId,
          settings.role_id || null,
          settings.channel_id || null,
          settings.type || 'button',
          settings.message_id || null
        );
      }
      
      logInfo('Verification', `Updated server_settings for guild ${guildId}`);
    } catch (error) {
      logError('Verification', `Error updating server_settings: ${error}`);
    }

    // Also save to verification_settings table for additional settings
    // Ensure the table exists
    db.prepare(`
      CREATE TABLE IF NOT EXISTS verification_settings (
        guild_id TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 0,
        type TEXT DEFAULT 'button',
        role_id TEXT,
        channel_id TEXT,
        message_id TEXT,
        custom_questions TEXT,
        min_age INTEGER DEFAULT 13,
        require_account_age INTEGER DEFAULT 0,
        min_account_age_days INTEGER DEFAULT 7,
        log_channel_id TEXT,
        timeout_minutes INTEGER DEFAULT 10,
        welcome_message TEXT,
        welcome_channel_id TEXT
      )
    `).run();
    
    // Convert custom questions to JSON string
    const customQuestionsJson = settings.custom_questions ? 
      JSON.stringify(settings.custom_questions) : null;
    
    // Check if settings already exist
    const existing = db.prepare(`
      SELECT 1 FROM verification_settings WHERE guild_id = ?
    `).get(guildId);
    
    if (existing) {
      // Update existing settings
      db.prepare(`
        UPDATE verification_settings
        SET 
          enabled = ?,
          type = ?,
          role_id = ?,
          channel_id = ?,
          message_id = ?,
          custom_questions = ?,
          min_age = ?,
          require_account_age = ?,
          min_account_age_days = ?,
          log_channel_id = ?,
          timeout_minutes = ?,
          welcome_message = ?,
          welcome_channel_id = ?
        WHERE guild_id = ?
      `).run(
        settings.enabled ? 1 : 0,
        settings.type,
        settings.role_id,
        settings.channel_id,
        settings.message_id,
        customQuestionsJson,
        settings.min_age || 13,
        settings.require_account_age ? 1 : 0,
        settings.min_account_age_days || 7,
        settings.log_channel_id,
        settings.timeout_minutes || 10,
        settings.welcome_message,
        settings.welcome_channel_id,
        guildId
      );
    } else {
      // Insert new settings
      db.prepare(`
        INSERT INTO verification_settings (
          guild_id,
          enabled,
          type,
          role_id,
          channel_id,
          message_id,
          custom_questions,
          min_age,
          require_account_age,
          min_account_age_days,
          log_channel_id,
          timeout_minutes,
          welcome_message,
          welcome_channel_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        guildId,
        settings.enabled ? 1 : 0,
        settings.type,
        settings.role_id,
        settings.channel_id,
        settings.message_id,
        customQuestionsJson,
        settings.min_age || 13,
        settings.require_account_age ? 1 : 0,
        settings.min_account_age_days || 7,
        settings.log_channel_id,
        settings.timeout_minutes || 10,
        settings.welcome_message,
        settings.welcome_channel_id
      );
    }
    
    logInfo('Verification', `Saved verification settings for guild ${guildId} with role_id: ${settings.role_id}`);
    return true;
  } catch (error) {
    logError('Verification', `Error saving verification settings: ${error}`);
    return false;
  }
}

/**
 * Add a custom question to verification settings
 * 
 * @param guildId The guild ID to add the question for
 * @param question The question to add
 * @returns Promise resolving to true if successful
 */
export async function addCustomQuestion(
  guildId: string,
  question: VerificationQuestion
): Promise<boolean> {
  try {
    const settings = await getVerificationSettings(guildId);
    if (!settings) return false;
    
    // Add the question to the list
    const questions = settings.custom_questions || [];
    questions.push(question);
    
    // Save the updated settings
    settings.custom_questions = questions;
    return await saveVerificationSettings(guildId, settings);
  } catch (error) {
    logError('Verification', `Error adding custom question: ${error}`);
    return false;
  }
}

/**
 * Remove a custom question from verification settings
 * 
 * @param guildId The guild ID to remove the question from
 * @param questionId The ID of the question to remove
 * @returns Promise resolving to true if successful
 */
export async function removeCustomQuestion(
  guildId: string,
  questionId: string
): Promise<boolean> {
  try {
    const settings = await getVerificationSettings(guildId);
    if (!settings || !settings.custom_questions) return false;
    
    // Filter out the question to remove
    settings.custom_questions = settings.custom_questions.filter(q => q.id !== questionId);
    
    // Save the updated settings
    return await saveVerificationSettings(guildId, settings);
  } catch (error) {
    logError('Verification', `Error removing custom question: ${error}`);
    return false;
  }
}
