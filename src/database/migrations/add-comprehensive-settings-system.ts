import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

export async function addComprehensiveSettingsSystem(): Promise<void> {
  try {
    logInfo('Migration', 'Adding comprehensive settings system...');

    // 1. Advanced Server Configuration
    db.exec(`
      CREATE TABLE IF NOT EXISTS advanced_server_settings (
        guild_id TEXT PRIMARY KEY,
        -- General Settings
        bot_prefix TEXT DEFAULT '!',
        bot_nickname TEXT,
        custom_status TEXT,
        timezone TEXT DEFAULT 'UTC',
        date_format TEXT DEFAULT 'MM/DD/YYYY',
        time_format TEXT DEFAULT '12',
        
        -- Theme & Appearance
        primary_color TEXT DEFAULT '#5865F2',
        secondary_color TEXT DEFAULT '#57F287',
        embed_color TEXT DEFAULT '#5865F2',
        bot_avatar_url TEXT,
        custom_emojis TEXT, -- JSON array of custom emoji configurations
        
        -- Feature Toggles
        modules_enabled TEXT DEFAULT '[]', -- JSON array of enabled modules
        features_enabled TEXT DEFAULT '[]', -- JSON array of enabled features
        
        -- Advanced Configuration
        api_settings TEXT DEFAULT '{}', -- JSON object for API configurations
        webhook_settings TEXT DEFAULT '{}', -- JSON object for webhook configurations
        integration_settings TEXT DEFAULT '{}', -- JSON object for third-party integrations
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Auto-Moderation Settings
    db.exec(`
      CREATE TABLE IF NOT EXISTS automod_settings (
        guild_id TEXT PRIMARY KEY,
        -- General Auto-Moderation
        enabled INTEGER DEFAULT 0,
        log_channel_id TEXT,
        bypass_roles TEXT DEFAULT '[]', -- JSON array of role IDs that bypass automod
        
        -- Anti-Spam Settings
        anti_spam_enabled INTEGER DEFAULT 1,
        spam_threshold INTEGER DEFAULT 5,
        spam_timeframe INTEGER DEFAULT 10, -- seconds
        spam_punishment TEXT DEFAULT 'timeout', -- timeout, kick, ban
        spam_duration INTEGER DEFAULT 300, -- seconds for timeout
        
        -- Anti-Raid Settings
        anti_raid_enabled INTEGER DEFAULT 1,
        raid_threshold INTEGER DEFAULT 10, -- users joining
        raid_timeframe INTEGER DEFAULT 60, -- seconds
        raid_action TEXT DEFAULT 'lockdown', -- lockdown, kick_new, ban_new
        
        -- Message Filtering
        filter_profanity INTEGER DEFAULT 1,
        filter_invites INTEGER DEFAULT 1,
        filter_links INTEGER DEFAULT 0,
        filter_caps INTEGER DEFAULT 1,
        filter_mentions INTEGER DEFAULT 1,
        custom_filters TEXT DEFAULT '[]', -- JSON array of custom filter words/patterns
        
        -- Punishment Settings
        warning_threshold INTEGER DEFAULT 3,
        auto_timeout_duration INTEGER DEFAULT 600,
        auto_kick_threshold INTEGER DEFAULT 5,
        auto_ban_threshold INTEGER DEFAULT 7,
        
        -- Advanced Settings
        whitelist_channels TEXT DEFAULT '[]',
        whitelist_roles TEXT DEFAULT '[]',
        punishment_escalation TEXT DEFAULT '{}', -- JSON object for escalation rules
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Welcome & Leave System
    db.exec(`
      CREATE TABLE IF NOT EXISTS welcome_leave_settings (
        guild_id TEXT PRIMARY KEY,
        -- Welcome Settings
        welcome_enabled INTEGER DEFAULT 1,
        welcome_channel_id TEXT,
        welcome_message TEXT,
        welcome_embed_enabled INTEGER DEFAULT 1,
        welcome_embed_config TEXT DEFAULT '{}', -- JSON config for embed
        welcome_dm_enabled INTEGER DEFAULT 0,
        welcome_dm_message TEXT,
        welcome_role_id TEXT, -- Auto-assign role on join
        welcome_delay INTEGER DEFAULT 0, -- Delay in seconds before sending welcome
        
        -- Leave Settings
        leave_enabled INTEGER DEFAULT 0,
        leave_channel_id TEXT,
        leave_message TEXT,
        leave_embed_enabled INTEGER DEFAULT 1,
        leave_embed_config TEXT DEFAULT '{}',
        
        -- Advanced Welcome Features
        welcome_card_enabled INTEGER DEFAULT 0,
        welcome_card_background TEXT, -- URL or preset name
        welcome_preview_channel_id TEXT, -- Channel for testing welcome messages
        welcome_variables TEXT DEFAULT '{}', -- JSON object for custom variables
        
        -- Member Screening
        screening_enabled INTEGER DEFAULT 0,
        screening_questions TEXT DEFAULT '[]', -- JSON array of screening questions
        screening_role_id TEXT, -- Role given after screening
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Role Management System
    db.exec(`
      CREATE TABLE IF NOT EXISTS role_management_settings (
        guild_id TEXT PRIMARY KEY,
        -- Auto-Role Settings
        auto_roles_enabled INTEGER DEFAULT 0,
        auto_roles TEXT DEFAULT '[]', -- JSON array of role IDs to auto-assign
        auto_role_delay INTEGER DEFAULT 0,
        
        -- Reaction Roles
        reaction_roles_enabled INTEGER DEFAULT 0,
        reaction_role_configs TEXT DEFAULT '[]', -- JSON array of reaction role configs
        
        -- Level Roles
        level_roles_enabled INTEGER DEFAULT 0,
        level_role_configs TEXT DEFAULT '[]', -- JSON array of level-based role configs
        level_role_mode TEXT DEFAULT 'add', -- add, replace, highest
        
        -- Role Hierarchy Management
        role_hierarchy_enabled INTEGER DEFAULT 0,
        protected_roles TEXT DEFAULT '[]', -- JSON array of role IDs that can't be removed
        admin_roles TEXT DEFAULT '[]', -- JSON array of admin role IDs
        mod_roles TEXT DEFAULT '[]', -- JSON array of moderator role IDs
        
        -- Advanced Role Features
        temporary_roles_enabled INTEGER DEFAULT 0,
        role_shop_enabled INTEGER DEFAULT 0,
        role_shop_configs TEXT DEFAULT '[]', -- JSON array of purchasable roles
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Economy System
    db.exec(`
      CREATE TABLE IF NOT EXISTS economy_settings (
        guild_id TEXT PRIMARY KEY,
        -- General Economy
        enabled INTEGER DEFAULT 0,
        currency_name TEXT DEFAULT 'coins',
        currency_symbol TEXT DEFAULT '🪙',
        starting_balance INTEGER DEFAULT 100,
        
        -- Earning Settings
        message_reward_min INTEGER DEFAULT 1,
        message_reward_max INTEGER DEFAULT 5,
        message_cooldown INTEGER DEFAULT 60, -- seconds
        voice_reward_rate INTEGER DEFAULT 2, -- per minute
        daily_reward INTEGER DEFAULT 100,
        weekly_reward INTEGER DEFAULT 500,
        
        -- Shop System
        shop_enabled INTEGER DEFAULT 1,
        shop_items TEXT DEFAULT '[]', -- JSON array of shop items
        role_shop_enabled INTEGER DEFAULT 0,
        
        -- Gambling
        gambling_enabled INTEGER DEFAULT 0,
        gambling_min_bet INTEGER DEFAULT 1,
        gambling_max_bet INTEGER DEFAULT 1000,
        gambling_games TEXT DEFAULT '[]', -- JSON array of enabled gambling games
        
        -- Advanced Features
        interest_rate REAL DEFAULT 0.0, -- Daily interest rate
        tax_rate REAL DEFAULT 0.0, -- Transaction tax rate
        transfer_enabled INTEGER DEFAULT 1,
        leaderboard_enabled INTEGER DEFAULT 1,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. User Economy Data
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_economy (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        balance INTEGER DEFAULT 0,
        bank_balance INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        last_daily TIMESTAMP,
        last_weekly TIMESTAMP,
        last_message_reward TIMESTAMP,
        inventory TEXT DEFAULT '[]', -- JSON array of owned items
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, user_id)
      )
    `);

    // 7. Leveling System
    db.exec(`
      CREATE TABLE IF NOT EXISTS leveling_settings (
        guild_id TEXT PRIMARY KEY,
        -- General Leveling
        enabled INTEGER DEFAULT 0,
        xp_per_message INTEGER DEFAULT 15,
        xp_cooldown INTEGER DEFAULT 60, -- seconds
        xp_multiplier REAL DEFAULT 1.0,
        
        -- Level Calculation
        level_formula TEXT DEFAULT 'quadratic', -- linear, quadratic, exponential
        base_xp INTEGER DEFAULT 100, -- XP needed for level 1
        xp_multiplier_per_level REAL DEFAULT 1.1,
        
        -- Rewards
        level_up_message_enabled INTEGER DEFAULT 1,
        level_up_channel_id TEXT,
        level_up_message TEXT DEFAULT 'Congratulations {user}, you reached level {level}!',
        level_rewards TEXT DEFAULT '[]', -- JSON array of level rewards
        
        -- Advanced Features
        voice_xp_enabled INTEGER DEFAULT 0,
        voice_xp_rate INTEGER DEFAULT 10, -- XP per minute in voice
        boost_channels TEXT DEFAULT '[]', -- JSON array of channels with XP boost
        boost_roles TEXT DEFAULT '[]', -- JSON array of roles with XP boost
        ignored_channels TEXT DEFAULT '[]', -- Channels where XP is not gained
        ignored_roles TEXT DEFAULT '[]', -- Roles that don't gain XP
        
        -- Leaderboard
        leaderboard_enabled INTEGER DEFAULT 1,
        leaderboard_channel_id TEXT,
        leaderboard_update_interval INTEGER DEFAULT 3600, -- seconds
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. User Leveling Data
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_levels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        total_xp INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        voice_time INTEGER DEFAULT 0, -- minutes
        last_xp_gain TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, user_id)
      )
    `);

    // 9. Enhanced Ticket System
    db.exec(`
      CREATE TABLE IF NOT EXISTS enhanced_ticket_settings (
        guild_id TEXT PRIMARY KEY,
        -- General Ticket Settings
        enabled INTEGER DEFAULT 1,
        category_id TEXT,
        log_channel_id TEXT,
        archive_category_id TEXT,
        
        -- Ticket Creation
        panel_channel_id TEXT,
        panel_message_id TEXT,
        panel_config TEXT DEFAULT '{}', -- JSON config for panel embed and buttons
        max_tickets_per_user INTEGER DEFAULT 3,
        ticket_name_format TEXT DEFAULT 'ticket-{number}',
        
        -- Staff Management
        staff_roles TEXT DEFAULT '[]', -- JSON array of staff role IDs
        admin_roles TEXT DEFAULT '[]', -- JSON array of admin role IDs
        auto_assign_staff INTEGER DEFAULT 1,
        staff_assignment_mode TEXT DEFAULT 'round_robin', -- round_robin, random, least_busy
        
        -- Ticket Features
        transcripts_enabled INTEGER DEFAULT 1,
        transcripts_channel_id TEXT,
        rating_system_enabled INTEGER DEFAULT 1,
        close_confirmation INTEGER DEFAULT 1,
        auto_close_inactive INTEGER DEFAULT 0,
        auto_close_time INTEGER DEFAULT 86400, -- seconds (24 hours)
        
        -- Advanced Features
        categories_enabled INTEGER DEFAULT 1,
        priority_system_enabled INTEGER DEFAULT 0,
        chatbot_enabled INTEGER DEFAULT 0,
        chatbot_model TEXT DEFAULT 'gpt-3.5-turbo',
        templates_enabled INTEGER DEFAULT 1,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 10. Ticket Categories
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        emoji TEXT,
        color TEXT DEFAULT '#5865F2',
        staff_roles TEXT DEFAULT '[]', -- JSON array of role IDs for this category
        questions TEXT DEFAULT '[]', -- JSON array of questions to ask when creating ticket
        max_tickets INTEGER DEFAULT 1, -- Max tickets per user in this category
        enabled INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. Custom Commands System
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        content TEXT NOT NULL,
        embed_config TEXT, -- JSON config for embed response
        cooldown INTEGER DEFAULT 0, -- seconds
        enabled INTEGER DEFAULT 1,
        delete_trigger INTEGER DEFAULT 0,
        required_roles TEXT DEFAULT '[]', -- JSON array of required role IDs
        allowed_channels TEXT DEFAULT '[]', -- JSON array of allowed channel IDs
        usage_count INTEGER DEFAULT 0,
        variables TEXT DEFAULT '{}', -- JSON object for custom variables
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, name)
      )
    `);

    // 12. Logging Settings (Enhanced)
    db.exec(`
      CREATE TABLE IF NOT EXISTS enhanced_logging_settings (
        guild_id TEXT PRIMARY KEY,
        -- Message Logging
        message_delete_enabled INTEGER DEFAULT 1,
        message_edit_enabled INTEGER DEFAULT 1,
        message_bulk_delete_enabled INTEGER DEFAULT 1,
        message_log_channel_id TEXT,
        
        -- Member Logging
        member_join_enabled INTEGER DEFAULT 1,
        member_leave_enabled INTEGER DEFAULT 1,
        member_update_enabled INTEGER DEFAULT 1,
        member_log_channel_id TEXT,
        
        -- Server Logging
        server_update_enabled INTEGER DEFAULT 1,
        channel_create_enabled INTEGER DEFAULT 1,
        channel_delete_enabled INTEGER DEFAULT 1,
        channel_update_enabled INTEGER DEFAULT 1,
        role_create_enabled INTEGER DEFAULT 1,
        role_delete_enabled INTEGER DEFAULT 1,
        role_update_enabled INTEGER DEFAULT 1,
        server_log_channel_id TEXT,
        
        -- Moderation Logging
        ban_enabled INTEGER DEFAULT 1,
        unban_enabled INTEGER DEFAULT 1,
        kick_enabled INTEGER DEFAULT 1,
        timeout_enabled INTEGER DEFAULT 1,
        warn_enabled INTEGER DEFAULT 1,
        moderation_log_channel_id TEXT,
        
        -- Voice Logging
        voice_join_enabled INTEGER DEFAULT 0,
        voice_leave_enabled INTEGER DEFAULT 0,
        voice_move_enabled INTEGER DEFAULT 0,
        voice_log_channel_id TEXT,
        
        -- Advanced Logging
        command_usage_enabled INTEGER DEFAULT 1,
        automod_actions_enabled INTEGER DEFAULT 1,
        ticket_actions_enabled INTEGER DEFAULT 1,
        economy_transactions_enabled INTEGER DEFAULT 0,
        level_ups_enabled INTEGER DEFAULT 0,
        
        -- Log Formatting
        embed_logs INTEGER DEFAULT 1,
        log_format TEXT DEFAULT 'detailed', -- simple, detailed, verbose
        include_avatars INTEGER DEFAULT 1,
        timezone TEXT DEFAULT 'UTC',
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 13. Giveaway System (Enhanced)
    db.exec(`
      CREATE TABLE IF NOT EXISTS giveaway_settings (
        guild_id TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        default_channel_id TEXT,
        ping_role_id TEXT,
        embed_color TEXT DEFAULT '#FF6B6B',
        emoji TEXT DEFAULT '🎉',
        dm_winners INTEGER DEFAULT 1,
        dm_losers INTEGER DEFAULT 0,
        require_account_age INTEGER DEFAULT 0, -- days
        require_server_time INTEGER DEFAULT 0, -- days
        blacklisted_roles TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 14. Enhanced Giveaways Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS enhanced_giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        prize TEXT NOT NULL,
        winners_count INTEGER DEFAULT 1,
        end_time TIMESTAMP NOT NULL,
        host_id TEXT NOT NULL,
        requirements TEXT DEFAULT '{}', -- JSON object for entry requirements
        entries TEXT DEFAULT '[]', -- JSON array of user IDs
        winners TEXT DEFAULT '[]', -- JSON array of winner user IDs
        status TEXT DEFAULT 'active', -- active, ended, cancelled
        bonus_entries TEXT DEFAULT '{}', -- JSON object for bonus entry rules
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP
      )
    `);

    // 15. Settings Templates
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL, -- community, gaming, business, educational, etc.
        template_data TEXT NOT NULL, -- JSON object containing all settings
        is_public INTEGER DEFAULT 0,
        created_by TEXT,
        usage_count INTEGER DEFAULT 0,
        rating REAL DEFAULT 0.0,
        tags TEXT DEFAULT '[]', -- JSON array of tags
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 16. Analytics and Statistics
    db.exec(`
      CREATE TABLE IF NOT EXISTS server_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        date DATE NOT NULL,
        -- User Activity
        messages_sent INTEGER DEFAULT 0,
        commands_used INTEGER DEFAULT 0,
        users_joined INTEGER DEFAULT 0,
        users_left INTEGER DEFAULT 0,
        voice_minutes INTEGER DEFAULT 0,
        -- Moderation
        warnings_issued INTEGER DEFAULT 0,
        timeouts_issued INTEGER DEFAULT 0,
        kicks_issued INTEGER DEFAULT 0,
        bans_issued INTEGER DEFAULT 0,
        -- Economy
        currency_earned INTEGER DEFAULT 0,
        currency_spent INTEGER DEFAULT 0,
        transactions INTEGER DEFAULT 0,
        -- Tickets
        tickets_created INTEGER DEFAULT 0,
        tickets_closed INTEGER DEFAULT 0,
        avg_ticket_time INTEGER DEFAULT 0,
        -- Other
        reactions_added INTEGER DEFAULT 0,
        files_uploaded INTEGER DEFAULT 0,
        UNIQUE(guild_id, date)
      )
    `);

    // Create indexes for better performance
    logInfo('Migration', 'Creating indexes for settings tables...');
    
    // Advanced server settings indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_advanced_server_settings_guild_id ON advanced_server_settings(guild_id)');
    
    // Automod settings indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_automod_settings_guild_id ON automod_settings(guild_id)');
    
    // Welcome/leave settings indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_welcome_leave_settings_guild_id ON welcome_leave_settings(guild_id)');
    
    // Role management indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_role_management_settings_guild_id ON role_management_settings(guild_id)');
    
    // Economy indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_economy_settings_guild_id ON economy_settings(guild_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_economy_guild_user ON user_economy(guild_id, user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_economy_balance ON user_economy(balance DESC)');
    
    // Leveling indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_leveling_settings_guild_id ON leveling_settings(guild_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_levels_guild_user ON user_levels(guild_id, user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_levels_xp ON user_levels(xp DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_levels_level ON user_levels(level DESC)');
    
    // Ticket system indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_enhanced_ticket_settings_guild_id ON enhanced_ticket_settings(guild_id)');
    
    // Check if ticket_categories table has enabled column before creating index
    try {
      const tableInfo = db.prepare("PRAGMA table_info(ticket_categories)").all() as any[];
      const hasEnabledColumn = tableInfo.some(col => col.name === 'enabled');
      
      db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_categories_guild_id ON ticket_categories(guild_id)');
      
      if (hasEnabledColumn) {
        db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_categories_enabled ON ticket_categories(enabled)');
      } else {
        logInfo('Migration', 'Skipping ticket_categories enabled index - column does not exist');
      }
    } catch (e) {
      logInfo('Migration', 'ticket_categories table does not exist yet, skipping enabled index');
    }
    
    // Custom commands indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_custom_commands_guild_id ON custom_commands(guild_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_custom_commands_name ON custom_commands(name)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_custom_commands_enabled ON custom_commands(enabled)');
    
    // Logging indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_enhanced_logging_settings_guild_id ON enhanced_logging_settings(guild_id)');
    
    // Giveaway indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_giveaway_settings_guild_id ON giveaway_settings(guild_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_enhanced_giveaways_guild_id ON enhanced_giveaways(guild_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_enhanced_giveaways_status ON enhanced_giveaways(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_enhanced_giveaways_end_time ON enhanced_giveaways(end_time)');
    
    // Templates indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_settings_templates_category ON settings_templates(category)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_settings_templates_public ON settings_templates(is_public)');
    
    // Analytics indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_server_analytics_guild_metric ON server_analytics(guild_id, metric_type)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_server_analytics_created ON server_analytics(created_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_daily_server_stats_guild_date ON daily_server_stats(guild_id, date)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_daily_server_stats_date ON daily_server_stats(date)');

    logInfo('Migration', 'Comprehensive settings system migration completed successfully');
  } catch (error) {
    logError('Migration', `Error in comprehensive settings migration: ${error}`);
    throw error;
  }
}