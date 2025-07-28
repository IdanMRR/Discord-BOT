import { db } from '../database/sqlite';
import { logInfo, logError } from '../utils/logger';

// Types for all settings categories
export interface AdvancedServerSettings {
  guild_id: string;
  bot_prefix?: string;
  bot_nickname?: string;
  custom_status?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  primary_color?: string;
  secondary_color?: string;
  embed_color?: string;
  bot_avatar_url?: string;
  custom_emojis?: string; // JSON
  modules_enabled?: string; // JSON
  features_enabled?: string; // JSON
  api_settings?: string; // JSON
  webhook_settings?: string; // JSON
  integration_settings?: string; // JSON
}

export interface AutomodSettings {
  guild_id: string;
  enabled?: boolean;
  log_channel_id?: string;
  bypass_roles?: string; // JSON
  anti_spam_enabled?: boolean;
  spam_threshold?: number;
  spam_timeframe?: number;
  spam_punishment?: string;
  spam_duration?: number;
  anti_raid_enabled?: boolean;
  raid_threshold?: number;
  raid_timeframe?: number;
  raid_action?: string;
  filter_profanity?: boolean;
  filter_invites?: boolean;
  filter_links?: boolean;
  filter_caps?: boolean;
  filter_mentions?: boolean;
  custom_filters?: string; // JSON
  warning_threshold?: number;
  auto_timeout_duration?: number;
  auto_kick_threshold?: number;
  auto_ban_threshold?: number;
  whitelist_channels?: string; // JSON
  whitelist_roles?: string; // JSON
  punishment_escalation?: string; // JSON
}

export interface WelcomeLeaveSettings {
  guild_id: string;
  welcome_enabled?: boolean;
  welcome_channel_id?: string;
  welcome_message?: string;
  welcome_embed_enabled?: boolean;
  welcome_embed_config?: string; // JSON
  welcome_dm_enabled?: boolean;
  welcome_dm_message?: string;
  welcome_role_id?: string;
  welcome_delay?: number;
  leave_enabled?: boolean;
  leave_channel_id?: string;
  leave_message?: string;
  leave_embed_enabled?: boolean;
  leave_embed_config?: string; // JSON
  welcome_card_enabled?: boolean;
  welcome_card_background?: string;
  welcome_preview_channel_id?: string;
  welcome_variables?: string; // JSON
  screening_enabled?: boolean;
  screening_questions?: string; // JSON
  screening_role_id?: string;
}

export interface RoleManagementSettings {
  guild_id: string;
  auto_roles_enabled?: boolean;
  auto_roles?: string; // JSON
  auto_role_delay?: number;
  reaction_roles_enabled?: boolean;
  reaction_role_configs?: string; // JSON
  level_roles_enabled?: boolean;
  level_role_configs?: string; // JSON
  level_role_mode?: string;
  role_hierarchy_enabled?: boolean;
  protected_roles?: string; // JSON
  admin_roles?: string; // JSON
  mod_roles?: string; // JSON
  temporary_roles_enabled?: boolean;
  role_shop_enabled?: boolean;
  role_shop_configs?: string; // JSON
}

export interface EconomySettings {
  guild_id: string;
  enabled?: boolean;
  currency_name?: string;
  currency_symbol?: string;
  starting_balance?: number;
  message_reward_min?: number;
  message_reward_max?: number;
  message_cooldown?: number;
  voice_reward_rate?: number;
  daily_reward?: number;
  weekly_reward?: number;
  shop_enabled?: boolean;
  shop_items?: string; // JSON
  role_shop_enabled?: boolean;
  gambling_enabled?: boolean;
  gambling_min_bet?: number;
  gambling_max_bet?: number;
  gambling_games?: string; // JSON
  interest_rate?: number;
  tax_rate?: number;
  transfer_enabled?: boolean;
  leaderboard_enabled?: boolean;
}

export interface LevelingSettings {
  guild_id: string;
  enabled?: boolean;
  xp_per_message?: number;
  xp_cooldown?: number;
  xp_multiplier?: number;
  level_formula?: string;
  base_xp?: number;
  xp_multiplier_per_level?: number;
  level_up_message_enabled?: boolean;
  level_up_channel_id?: string;
  level_up_message?: string;
  level_rewards?: string; // JSON
  voice_xp_enabled?: boolean;
  voice_xp_rate?: number;
  boost_channels?: string; // JSON
  boost_roles?: string; // JSON
  ignored_channels?: string; // JSON
  ignored_roles?: string; // JSON
  leaderboard_enabled?: boolean;
  leaderboard_channel_id?: string;
  leaderboard_update_interval?: number;
}

export interface EnhancedTicketSettings {
  guild_id: string;
  enabled?: boolean;
  category_id?: string;
  log_channel_id?: string;
  archive_category_id?: string;
  panel_channel_id?: string;
  panel_message_id?: string;
  panel_config?: string; // JSON
  max_tickets_per_user?: number;
  ticket_name_format?: string;
  staff_roles?: string; // JSON
  admin_roles?: string; // JSON
  auto_assign_staff?: boolean;
  staff_assignment_mode?: string;
  transcripts_enabled?: boolean;
  transcripts_channel_id?: string;
  rating_system_enabled?: boolean;
  close_confirmation?: boolean;
  auto_close_inactive?: boolean;
  auto_close_time?: number;
  categories_enabled?: boolean;
  priority_system_enabled?: boolean;
  chatbot_enabled?: boolean;
  chatbot_model?: string;
  templates_enabled?: boolean;
}

export interface EnhancedLoggingSettings {
  guild_id: string;
  message_delete_enabled?: boolean;
  message_edit_enabled?: boolean;
  message_bulk_delete_enabled?: boolean;
  message_log_channel_id?: string;
  member_join_enabled?: boolean;
  member_leave_enabled?: boolean;
  member_update_enabled?: boolean;
  member_log_channel_id?: string;
  server_update_enabled?: boolean;
  channel_create_enabled?: boolean;
  channel_delete_enabled?: boolean;
  channel_update_enabled?: boolean;
  role_create_enabled?: boolean;
  role_delete_enabled?: boolean;
  role_update_enabled?: boolean;
  server_log_channel_id?: string;
  ban_enabled?: boolean;
  unban_enabled?: boolean;
  kick_enabled?: boolean;
  timeout_enabled?: boolean;
  warn_enabled?: boolean;
  moderation_log_channel_id?: string;
  voice_join_enabled?: boolean;
  voice_leave_enabled?: boolean;
  voice_move_enabled?: boolean;
  voice_log_channel_id?: string;
  command_usage_enabled?: boolean;
  automod_actions_enabled?: boolean;
  ticket_actions_enabled?: boolean;
  economy_transactions_enabled?: boolean;
  level_ups_enabled?: boolean;
  embed_logs?: boolean;
  log_format?: string;
  include_avatars?: boolean;
  timezone?: string;
}

export interface GiveawaySettings {
  guild_id: string;
  enabled?: boolean;
  default_channel_id?: string;
  ping_role_id?: string;
  embed_color?: string;
  emoji?: string;
  dm_winners?: boolean;
  dm_losers?: boolean;
  require_account_age?: number;
  require_server_time?: number;
  blacklisted_roles?: string; // JSON
}

// Validation schemas
const validationRules = {
  guildId: (value: any) => typeof value === 'string' && /^\d{17,19}$/.test(value),
  channelId: (value: any) => !value || (typeof value === 'string' && /^\d{17,19}$/.test(value)),
  roleId: (value: any) => !value || (typeof value === 'string' && /^\d{17,19}$/.test(value)),
  messageId: (value: any) => !value || (typeof value === 'string' && /^\d{17,19}$/.test(value)),
  color: (value: any) => !value || (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)),
  url: (value: any) => !value || (typeof value === 'string' && /^https?:\/\/.+/.test(value)),
  emoji: (value: any) => !value || (typeof value === 'string' && value.length <= 100),
  json: (value: any) => {
    if (!value) return true;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  },
  number: (value: any) => !value || (typeof value === 'number' && !isNaN(value)),
  positiveNumber: (value: any) => !value || (typeof value === 'number' && value > 0),
  boolean: (value: any) => typeof value === 'boolean' || value === 0 || value === 1,
  string: (value: any) => !value || typeof value === 'string',
  stringLength: (max: number) => (value: any) => !value || (typeof value === 'string' && value.length <= max)
};

export class ComprehensiveSettingsManager {
  // Generic method to get settings from any table
  private getSettings<T>(tableName: string, guildId: string): T | null {
    try {
      const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE guild_id = ?`);
      const result = stmt.get(guildId) as T | undefined;
      return result || null;
    } catch (error) {
      logError('SettingsManager', `Error getting ${tableName} settings: ${error}`);
      return null;
    }
  }

  // Generic method to update settings in any table
  private async updateSettings<T extends Record<string, any>>(
    tableName: string, 
    guildId: string, 
    settings: Partial<T>,
    validationSchema?: Record<string, (value: any) => boolean>
  ): Promise<boolean> {
    try {
      // Validate settings if schema provided
      if (validationSchema) {
        for (const [key, value] of Object.entries(settings)) {
          if (validationSchema[key] && !validationSchema[key](value)) {
            logError('SettingsManager', `Validation failed for ${key}: ${value}`);
            return false;
          }
        }
      }

      // Check if record exists
      const exists = this.getSettings(tableName, guildId);
      
      if (exists) {
        // Update existing record
        const updateFields = Object.keys(settings).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(settings), guildId];
        const stmt = db.prepare(`UPDATE ${tableName} SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`);
        stmt.run(...values);
      } else {
        // Insert new record
        const allSettings = { guild_id: guildId, ...settings };
        const fields = Object.keys(allSettings).join(', ');
        const placeholders = Object.keys(allSettings).map(() => '?').join(', ');
        const stmt = db.prepare(`INSERT INTO ${tableName} (${fields}) VALUES (${placeholders})`);
        stmt.run(...Object.values(allSettings));
      }

      logInfo('SettingsManager', `Updated ${tableName} settings for guild ${guildId}`);
      return true;
    } catch (error) {
      logError('SettingsManager', `Error updating ${tableName} settings: ${error}`);
      return false;
    }
  }

  // Advanced Server Settings
  getAdvancedServerSettings(guildId: string): AdvancedServerSettings | null {
    return this.getSettings<AdvancedServerSettings>('advanced_server_settings', guildId);
  }

  async updateAdvancedServerSettings(guildId: string, settings: Partial<AdvancedServerSettings>): Promise<boolean> {
    const schema = {
      guild_id: validationRules.guildId,
      bot_prefix: validationRules.stringLength(10),
      bot_nickname: validationRules.stringLength(32),
      custom_status: validationRules.stringLength(128),
      timezone: validationRules.string,
      date_format: validationRules.string,
      time_format: validationRules.string,
      primary_color: validationRules.color,
      secondary_color: validationRules.color,
      embed_color: validationRules.color,
      bot_avatar_url: validationRules.url,
      custom_emojis: validationRules.json,
      modules_enabled: validationRules.json,
      features_enabled: validationRules.json,
      api_settings: validationRules.json,
      webhook_settings: validationRules.json,
      integration_settings: validationRules.json
    };
    
    return this.updateSettings('advanced_server_settings', guildId, settings, schema);
  }

  // Automod Settings
  getAutomodSettings(guildId: string): AutomodSettings | null {
    return this.getSettings<AutomodSettings>('automod_settings', guildId);
  }

  async updateAutomodSettings(guildId: string, settings: Partial<AutomodSettings>): Promise<boolean> {
    const schema = {
      guild_id: validationRules.guildId,
      enabled: validationRules.boolean,
      log_channel_id: validationRules.channelId,
      bypass_roles: validationRules.json,
      anti_spam_enabled: validationRules.boolean,
      spam_threshold: validationRules.positiveNumber,
      spam_timeframe: validationRules.positiveNumber,
      spam_punishment: validationRules.string,
      spam_duration: validationRules.positiveNumber,
      anti_raid_enabled: validationRules.boolean,
      raid_threshold: validationRules.positiveNumber,
      raid_timeframe: validationRules.positiveNumber,
      raid_action: validationRules.string,
      filter_profanity: validationRules.boolean,
      filter_invites: validationRules.boolean,
      filter_links: validationRules.boolean,
      filter_caps: validationRules.boolean,
      filter_mentions: validationRules.boolean,
      custom_filters: validationRules.json,
      warning_threshold: validationRules.positiveNumber,
      auto_timeout_duration: validationRules.positiveNumber,
      auto_kick_threshold: validationRules.positiveNumber,
      auto_ban_threshold: validationRules.positiveNumber,
      whitelist_channels: validationRules.json,
      whitelist_roles: validationRules.json,
      punishment_escalation: validationRules.json
    };

    return this.updateSettings('automod_settings', guildId, settings, schema);
  }

  // Welcome/Leave Settings
  getWelcomeLeaveSettings(guildId: string): WelcomeLeaveSettings | null {
    return this.getSettings<WelcomeLeaveSettings>('welcome_leave_settings', guildId);
  }

  async updateWelcomeLeaveSettings(guildId: string, settings: Partial<WelcomeLeaveSettings>): Promise<boolean> {
    const schema = {
      guild_id: validationRules.guildId,
      welcome_enabled: validationRules.boolean,
      welcome_channel_id: validationRules.channelId,
      welcome_message: validationRules.string,
      welcome_embed_enabled: validationRules.boolean,
      welcome_embed_config: validationRules.json,
      welcome_dm_enabled: validationRules.boolean,
      welcome_dm_message: validationRules.string,
      welcome_role_id: validationRules.roleId,
      welcome_delay: validationRules.number,
      leave_enabled: validationRules.boolean,
      leave_channel_id: validationRules.channelId,
      leave_message: validationRules.string,
      leave_embed_enabled: validationRules.boolean,
      leave_embed_config: validationRules.json,
      welcome_card_enabled: validationRules.boolean,
      welcome_card_background: validationRules.string,
      welcome_preview_channel_id: validationRules.channelId,
      welcome_variables: validationRules.json,
      screening_enabled: validationRules.boolean,
      screening_questions: validationRules.json,
      screening_role_id: validationRules.roleId
    };

    return this.updateSettings('welcome_leave_settings', guildId, settings, schema);
  }

  // Role Management Settings
  getRoleManagementSettings(guildId: string): RoleManagementSettings | null {
    return this.getSettings<RoleManagementSettings>('role_management_settings', guildId);
  }

  async updateRoleManagementSettings(guildId: string, settings: Partial<RoleManagementSettings>): Promise<boolean> {
    const schema = {
      guild_id: validationRules.guildId,
      auto_roles_enabled: validationRules.boolean,
      auto_roles: validationRules.json,
      auto_role_delay: validationRules.number,
      reaction_roles_enabled: validationRules.boolean,
      reaction_role_configs: validationRules.json,
      level_roles_enabled: validationRules.boolean,
      level_role_configs: validationRules.json,
      level_role_mode: validationRules.string,
      role_hierarchy_enabled: validationRules.boolean,
      protected_roles: validationRules.json,
      admin_roles: validationRules.json,
      mod_roles: validationRules.json,
      temporary_roles_enabled: validationRules.boolean,
      role_shop_enabled: validationRules.boolean,
      role_shop_configs: validationRules.json
    };

    return this.updateSettings('role_management_settings', guildId, settings, schema);
  }

  // Economy Settings
  getEconomySettings(guildId: string): EconomySettings | null {
    return this.getSettings<EconomySettings>('economy_settings', guildId);
  }

  async updateEconomySettings(guildId: string, settings: Partial<EconomySettings>): Promise<boolean> {
    const schema = {
      guild_id: validationRules.guildId,
      enabled: validationRules.boolean,
      currency_name: validationRules.stringLength(32),
      currency_symbol: validationRules.stringLength(10),
      starting_balance: validationRules.number,
      message_reward_min: validationRules.number,
      message_reward_max: validationRules.number,
      message_cooldown: validationRules.positiveNumber,
      voice_reward_rate: validationRules.number,
      daily_reward: validationRules.number,
      weekly_reward: validationRules.number,
      shop_enabled: validationRules.boolean,
      shop_items: validationRules.json,
      role_shop_enabled: validationRules.boolean,
      gambling_enabled: validationRules.boolean,
      gambling_min_bet: validationRules.positiveNumber,
      gambling_max_bet: validationRules.positiveNumber,
      gambling_games: validationRules.json,
      interest_rate: validationRules.number,
      tax_rate: validationRules.number,
      transfer_enabled: validationRules.boolean,
      leaderboard_enabled: validationRules.boolean
    };

    return this.updateSettings('economy_settings', guildId, settings, schema);
  }

  // Leveling Settings
  getLevelingSettings(guildId: string): LevelingSettings | null {
    return this.getSettings<LevelingSettings>('leveling_settings', guildId);
  }

  async updateLevelingSettings(guildId: string, settings: Partial<LevelingSettings>): Promise<boolean> {
    const schema = {
      guild_id: validationRules.guildId,
      enabled: validationRules.boolean,
      xp_per_message: validationRules.positiveNumber,
      xp_cooldown: validationRules.positiveNumber,
      xp_multiplier: validationRules.positiveNumber,
      level_formula: validationRules.string,
      base_xp: validationRules.positiveNumber,
      xp_multiplier_per_level: validationRules.positiveNumber,
      level_up_message_enabled: validationRules.boolean,
      level_up_channel_id: validationRules.channelId,
      level_up_message: validationRules.string,
      level_rewards: validationRules.json,
      voice_xp_enabled: validationRules.boolean,
      voice_xp_rate: validationRules.positiveNumber,
      boost_channels: validationRules.json,
      boost_roles: validationRules.json,
      ignored_channels: validationRules.json,
      ignored_roles: validationRules.json,
      leaderboard_enabled: validationRules.boolean,
      leaderboard_channel_id: validationRules.channelId,
      leaderboard_update_interval: validationRules.positiveNumber
    };

    return this.updateSettings('leveling_settings', guildId, settings, schema);
  }

  // Enhanced Ticket Settings
  getEnhancedTicketSettings(guildId: string): EnhancedTicketSettings | null {
    return this.getSettings<EnhancedTicketSettings>('enhanced_ticket_settings', guildId);
  }

  async updateEnhancedTicketSettings(guildId: string, settings: Partial<EnhancedTicketSettings>): Promise<boolean> {
    const schema = {
      guild_id: validationRules.guildId,
      enabled: validationRules.boolean,
      category_id: validationRules.channelId,
      log_channel_id: validationRules.channelId,
      archive_category_id: validationRules.channelId,
      panel_channel_id: validationRules.channelId,
      panel_message_id: validationRules.messageId,
      panel_config: validationRules.json,
      max_tickets_per_user: validationRules.positiveNumber,
      ticket_name_format: validationRules.string,
      staff_roles: validationRules.json,
      admin_roles: validationRules.json,
      auto_assign_staff: validationRules.boolean,
      staff_assignment_mode: validationRules.string,
      transcripts_enabled: validationRules.boolean,
      transcripts_channel_id: validationRules.channelId,
      rating_system_enabled: validationRules.boolean,
      close_confirmation: validationRules.boolean,
      auto_close_inactive: validationRules.boolean,
      auto_close_time: validationRules.positiveNumber,
      categories_enabled: validationRules.boolean,
      priority_system_enabled: validationRules.boolean,
      chatbot_enabled: validationRules.boolean,
      chatbot_model: validationRules.string,
      templates_enabled: validationRules.boolean
    };

    return this.updateSettings('enhanced_ticket_settings', guildId, settings, schema);
  }

  // Enhanced Logging Settings
  getEnhancedLoggingSettings(guildId: string): EnhancedLoggingSettings | null {
    return this.getSettings<EnhancedLoggingSettings>('enhanced_logging_settings', guildId);
  }

  async updateEnhancedLoggingSettings(guildId: string, settings: Partial<EnhancedLoggingSettings>): Promise<boolean> {
    const schema = {
      guild_id: validationRules.guildId,
      message_delete_enabled: validationRules.boolean,
      message_edit_enabled: validationRules.boolean,
      message_bulk_delete_enabled: validationRules.boolean,
      message_log_channel_id: validationRules.channelId,
      member_join_enabled: validationRules.boolean,
      member_leave_enabled: validationRules.boolean,
      member_update_enabled: validationRules.boolean,
      member_log_channel_id: validationRules.channelId,
      server_update_enabled: validationRules.boolean,
      channel_create_enabled: validationRules.boolean,
      channel_delete_enabled: validationRules.boolean,
      channel_update_enabled: validationRules.boolean,
      role_create_enabled: validationRules.boolean,
      role_delete_enabled: validationRules.boolean,
      role_update_enabled: validationRules.boolean,
      server_log_channel_id: validationRules.channelId,
      ban_enabled: validationRules.boolean,
      unban_enabled: validationRules.boolean,
      kick_enabled: validationRules.boolean,
      timeout_enabled: validationRules.boolean,
      warn_enabled: validationRules.boolean,
      moderation_log_channel_id: validationRules.channelId,
      voice_join_enabled: validationRules.boolean,
      voice_leave_enabled: validationRules.boolean,
      voice_move_enabled: validationRules.boolean,
      voice_log_channel_id: validationRules.channelId,
      command_usage_enabled: validationRules.boolean,
      automod_actions_enabled: validationRules.boolean,
      ticket_actions_enabled: validationRules.boolean,
      economy_transactions_enabled: validationRules.boolean,
      level_ups_enabled: validationRules.boolean,
      embed_logs: validationRules.boolean,
      log_format: validationRules.string,
      include_avatars: validationRules.boolean,
      timezone: validationRules.string
    };

    return this.updateSettings('enhanced_logging_settings', guildId, settings, schema);
  }

  // Giveaway Settings
  getGiveawaySettings(guildId: string): GiveawaySettings | null {
    return this.getSettings<GiveawaySettings>('giveaway_settings', guildId);
  }

  async updateGiveawaySettings(guildId: string, settings: Partial<GiveawaySettings>): Promise<boolean> {
    const schema = {
      guild_id: validationRules.guildId,
      enabled: validationRules.boolean,
      default_channel_id: validationRules.channelId,
      ping_role_id: validationRules.roleId,
      embed_color: validationRules.color,
      emoji: validationRules.emoji,
      dm_winners: validationRules.boolean,
      dm_losers: validationRules.boolean,
      require_account_age: validationRules.number,
      require_server_time: validationRules.number,
      blacklisted_roles: validationRules.json
    };

    return this.updateSettings('giveaway_settings', guildId, settings, schema);
  }

  // Bulk settings operations
  async getAllSettings(guildId: string): Promise<Record<string, any>> {
    return {
      advanced_server: this.getAdvancedServerSettings(guildId),
      automod: this.getAutomodSettings(guildId),
      welcome_leave: this.getWelcomeLeaveSettings(guildId),
      role_management: this.getRoleManagementSettings(guildId),
      economy: this.getEconomySettings(guildId),
      leveling: this.getLevelingSettings(guildId),
      tickets: this.getEnhancedTicketSettings(guildId),
      logging: this.getEnhancedLoggingSettings(guildId),
      giveaways: this.getGiveawaySettings(guildId)
    };
  }

  // Settings templates
  async saveSettingsTemplate(name: string, description: string, category: string, templateData: any, createdBy?: string): Promise<boolean> {
    try {
      const stmt = db.prepare(`
        INSERT INTO settings_templates (name, description, category, template_data, created_by) 
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(name, description, category, JSON.stringify(templateData), createdBy);
      logInfo('SettingsManager', `Saved settings template: ${name}`);
      return true;
    } catch (error) {
      logError('SettingsManager', `Error saving settings template: ${error}`);
      return false;
    }
  }

  getSettingsTemplates(category?: string): any[] {
    try {
      let query = 'SELECT * FROM settings_templates WHERE is_public = 1';
      let params: any[] = [];
      
      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
      
      query += ' ORDER BY usage_count DESC, rating DESC';
      
      const stmt = db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      logError('SettingsManager', `Error getting settings templates: ${error}`);
      return [];
    }
  }
}

// Export singleton instance
export const settingsManager = new ComprehensiveSettingsManager();