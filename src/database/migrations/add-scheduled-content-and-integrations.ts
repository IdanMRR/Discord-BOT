import Database from 'better-sqlite3';
import { logInfo, logError } from '../../utils/logger';

export const addScheduledContentAndIntegrations = {
  version: '010',
  name: 'add-scheduled-content-and-integrations',
  up: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Creating scheduled content and integration system tables...');

      // ==========================================
      // SCHEDULED CONTENT & AUTOMATION SYSTEM
      // ==========================================

      // Main scheduled tasks table
      db.exec(`
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          task_type TEXT NOT NULL CHECK (task_type IN ('message', 'announcement', 'role_assignment', 'channel_action', 'moderation', 'custom')),
          trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cron', 'interval', 'once', 'event')),
          cron_expression TEXT, -- For cron-based schedules (e.g., '0 9 * * 1' for every Monday at 9 AM)
          interval_seconds INTEGER, -- For interval-based schedules
          scheduled_time TIMESTAMP, -- For one-time schedules
          event_trigger TEXT, -- For event-based triggers (member_join, member_leave, etc.)
          target_channel_id TEXT,
          target_role_ids TEXT, -- JSON array of role IDs
          message_template TEXT, -- Message content with placeholders
          embed_config TEXT, -- JSON configuration for embedded messages
          components_config TEXT, -- JSON configuration for buttons/select menus
          is_active INTEGER DEFAULT 1,
          max_executions INTEGER, -- NULL for unlimited
          execution_count INTEGER DEFAULT 0,
          last_execution TIMESTAMP,
          next_execution TIMESTAMP,
          timezone TEXT DEFAULT 'UTC',
          conditions TEXT, -- JSON array of conditions that must be met
          error_count INTEGER DEFAULT 0,
          last_error TEXT,
          created_by TEXT NOT NULL, -- User ID who created the task
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Automation rules for complex workflows
      db.exec(`
        CREATE TABLE IF NOT EXISTS automation_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          trigger_event TEXT NOT NULL CHECK (trigger_event IN ('member_join', 'member_leave', 'message_sent', 'reaction_added', 'role_assigned', 'voice_join', 'voice_leave', 'custom')),
          trigger_conditions TEXT, -- JSON array of conditions
          actions TEXT NOT NULL, -- JSON array of actions to perform
          cooldown_seconds INTEGER DEFAULT 0,
          max_triggers_per_user INTEGER, -- NULL for unlimited
          is_active INTEGER DEFAULT 1,
          priority INTEGER DEFAULT 0, -- Higher priority rules execute first
          execution_count INTEGER DEFAULT 0,
          last_execution TIMESTAMP,
          success_count INTEGER DEFAULT 0,
          error_count INTEGER DEFAULT 0,
          last_error TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Task execution history and logs
      db.exec(`
        CREATE TABLE IF NOT EXISTS task_execution_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER,
          rule_id INTEGER,
          guild_id TEXT NOT NULL,
          execution_type TEXT NOT NULL CHECK (execution_type IN ('scheduled_task', 'automation_rule')),
          trigger_source TEXT, -- What triggered this execution
          trigger_user_id TEXT, -- User who triggered (for event-based)
          start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          end_time TIMESTAMP,
          status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
          result_data TEXT, -- JSON with execution results
          error_message TEXT,
          execution_duration INTEGER, -- milliseconds
          actions_performed TEXT, -- JSON array of completed actions
          metadata TEXT, -- JSON with additional execution context
          FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE
        )
      `);

      // Recurring schedule patterns for complex schedules
      db.exec(`
        CREATE TABLE IF NOT EXISTS recurring_schedules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          pattern_type TEXT NOT NULL CHECK (pattern_type IN ('daily', 'weekly', 'monthly', 'yearly', 'custom')),
          pattern_config TEXT NOT NULL, -- JSON configuration for the pattern
          days_of_week TEXT, -- JSON array for weekly patterns [1,2,3,4,5] (Monday=1)
          days_of_month TEXT, -- JSON array for monthly patterns [1,15,30]
          months TEXT, -- JSON array for yearly patterns [1,6,12]
          time_slots TEXT, -- JSON array of time slots ['09:00', '15:00']
          exceptions TEXT, -- JSON array of exception dates ['2024-12-25', '2024-01-01']
          timezone TEXT DEFAULT 'UTC',
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id) ON DELETE CASCADE
        )
      `);

      // ==========================================
      // ADVANCED INTEGRATION HUB
      // ==========================================

      // Integration configurations
      db.exec(`
        CREATE TABLE IF NOT EXISTS integrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          integration_type TEXT NOT NULL CHECK (integration_type IN ('webhook', 'api', 'rss', 'github', 'twitter', 'twitch', 'youtube', 'minecraft', 'steam', 'custom')),
          provider TEXT NOT NULL, -- github, discord, slack, etc.
          config TEXT NOT NULL, -- JSON configuration specific to integration type
          credentials_encrypted TEXT, -- Encrypted API keys/tokens
          target_channel_id TEXT,
          message_template TEXT, -- Template for messages from this integration
          embed_template TEXT, -- JSON template for embeds
          is_active INTEGER DEFAULT 1,
          sync_frequency INTEGER, -- seconds between sync attempts
          last_sync TIMESTAMP,
          next_sync TIMESTAMP,
          sync_count INTEGER DEFAULT 0,
          error_count INTEGER DEFAULT 0,
          last_error TEXT,
          rate_limit_config TEXT, -- JSON with rate limiting settings
          retry_config TEXT, -- JSON with retry configuration
          filter_config TEXT, -- JSON with filtering rules
          transform_config TEXT, -- JSON with data transformation rules
          created_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Webhook endpoints and settings
      db.exec(`
        CREATE TABLE IF NOT EXISTS webhooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          integration_id INTEGER,
          name TEXT NOT NULL,
          webhook_url TEXT NOT NULL,
          secret_token TEXT, -- For webhook verification
          events TEXT NOT NULL, -- JSON array of events this webhook handles
          is_active INTEGER DEFAULT 1,
          security_config TEXT, -- JSON with security settings (IP whitelist, etc.)
          rate_limit_per_minute INTEGER DEFAULT 60,
          max_payload_size INTEGER DEFAULT 1048576, -- 1MB default
          timeout_seconds INTEGER DEFAULT 30,
          retry_attempts INTEGER DEFAULT 3,
          success_count INTEGER DEFAULT 0,
          failure_count INTEGER DEFAULT 0,
          last_triggered TIMESTAMP,
          last_success TIMESTAMP,
          last_failure TIMESTAMP,
          last_error TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
        )
      `);

      // Integration activity logs
      db.exec(`
        CREATE TABLE IF NOT EXISTS integration_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          integration_id INTEGER,
          webhook_id INTEGER,
          event_type TEXT NOT NULL,
          event_source TEXT, -- github, discord, api, etc.
          status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending', 'cancelled')),
          request_method TEXT,
          request_url TEXT,
          request_headers TEXT, -- JSON (sensitive headers should be filtered)
          request_body TEXT, -- JSON or text payload
          response_status INTEGER,
          response_headers TEXT, -- JSON
          response_body TEXT, -- JSON or text response
          processing_time INTEGER, -- milliseconds
          error_message TEXT,
          retry_count INTEGER DEFAULT 0,
          metadata TEXT, -- JSON with additional context
          user_agent TEXT,
          ip_address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
          FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
        )
      `);

      // Webhook delivery tracking
      db.exec(`
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          webhook_id INTEGER NOT NULL,
          guild_id TEXT NOT NULL,
          delivery_id TEXT UNIQUE NOT NULL, -- UUID for tracking
          event_type TEXT NOT NULL,
          payload TEXT NOT NULL, -- JSON payload sent
          target_url TEXT NOT NULL,
          http_method TEXT DEFAULT 'POST',
          headers TEXT, -- JSON headers sent
          attempt_number INTEGER DEFAULT 1,
          max_attempts INTEGER DEFAULT 3,
          status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed', 'cancelled')),
          response_status INTEGER,
          response_body TEXT,
          response_time INTEGER, -- milliseconds
          scheduled_at TIMESTAMP NOT NULL,
          delivered_at TIMESTAMP,
          next_retry_at TIMESTAMP,
          error_message TEXT,
          user_data TEXT, -- JSON with user context (user_id, channel_id, etc.)
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
        )
      `);

      // ==========================================
      // PERFORMANCE INDEXES
      // ==========================================

      // Scheduled tasks indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_guild_active ON scheduled_tasks(guild_id, is_active)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_execution ON scheduled_tasks(next_execution) WHERE is_active = 1`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_task_type ON scheduled_tasks(task_type)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_trigger_type ON scheduled_tasks(trigger_type)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_created_by ON scheduled_tasks(created_by)`);

      // Automation rules indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_automation_rules_guild_active ON automation_rules(guild_id, is_active)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_event ON automation_rules(trigger_event)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_automation_rules_priority ON automation_rules(priority DESC)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_automation_rules_created_by ON automation_rules(created_by)`);

      // Task execution history indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_task_execution_history_task_id ON task_execution_history(task_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_task_execution_history_rule_id ON task_execution_history(rule_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_task_execution_history_guild_status ON task_execution_history(guild_id, status)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_task_execution_history_start_time ON task_execution_history(start_time)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_task_execution_history_execution_type ON task_execution_history(execution_type)`);

      // Recurring schedules indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_recurring_schedules_task_id ON recurring_schedules(task_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_recurring_schedules_pattern_type ON recurring_schedules(pattern_type)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active ON recurring_schedules(is_active)`);

      // Integrations indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_guild_active ON integrations(guild_id, is_active)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_type_provider ON integrations(integration_type, provider)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_next_sync ON integrations(next_sync) WHERE is_active = 1`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by)`);

      // Webhooks indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhooks_guild_active ON webhooks(guild_id, is_active)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhooks_integration_id ON webhooks(integration_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhooks_created_by ON webhooks(created_by)`);

      // Integration logs indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integration_logs_guild_id ON integration_logs(guild_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integration_logs_integration_id ON integration_logs(integration_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integration_logs_webhook_id ON integration_logs(webhook_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integration_logs_event_type ON integration_logs(event_type)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON integration_logs(status)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON integration_logs(created_at)`);

      // Webhook deliveries indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_guild_id ON webhook_deliveries(guild_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivery_id ON webhook_deliveries(delivery_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_scheduled_at ON webhook_deliveries(scheduled_at)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at) WHERE status = 'failed'`);

      logInfo('Migration', 'Scheduled content and integration system tables created successfully');
    } catch (error) {
      logError('Migration', `Error creating scheduled content and integration system tables: ${error}`);
      throw error;
    }
  },

  down: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Dropping scheduled content and integration system tables...');
      
      // Drop indexes first
      db.exec('DROP INDEX IF EXISTS idx_webhook_deliveries_next_retry');
      db.exec('DROP INDEX IF EXISTS idx_webhook_deliveries_scheduled_at');
      db.exec('DROP INDEX IF EXISTS idx_webhook_deliveries_status');
      db.exec('DROP INDEX IF EXISTS idx_webhook_deliveries_delivery_id');
      db.exec('DROP INDEX IF EXISTS idx_webhook_deliveries_guild_id');
      db.exec('DROP INDEX IF EXISTS idx_webhook_deliveries_webhook_id');
      
      db.exec('DROP INDEX IF EXISTS idx_integration_logs_created_at');
      db.exec('DROP INDEX IF EXISTS idx_integration_logs_status');
      db.exec('DROP INDEX IF EXISTS idx_integration_logs_event_type');
      db.exec('DROP INDEX IF EXISTS idx_integration_logs_webhook_id');
      db.exec('DROP INDEX IF EXISTS idx_integration_logs_integration_id');
      db.exec('DROP INDEX IF EXISTS idx_integration_logs_guild_id');
      
      db.exec('DROP INDEX IF EXISTS idx_webhooks_created_by');
      db.exec('DROP INDEX IF EXISTS idx_webhooks_integration_id');
      db.exec('DROP INDEX IF EXISTS idx_webhooks_guild_active');
      
      db.exec('DROP INDEX IF EXISTS idx_integrations_created_by');
      db.exec('DROP INDEX IF EXISTS idx_integrations_next_sync');
      db.exec('DROP INDEX IF EXISTS idx_integrations_type_provider');
      db.exec('DROP INDEX IF EXISTS idx_integrations_guild_active');
      
      db.exec('DROP INDEX IF EXISTS idx_recurring_schedules_active');
      db.exec('DROP INDEX IF EXISTS idx_recurring_schedules_pattern_type');
      db.exec('DROP INDEX IF EXISTS idx_recurring_schedules_task_id');
      
      db.exec('DROP INDEX IF EXISTS idx_task_execution_history_execution_type');
      db.exec('DROP INDEX IF EXISTS idx_task_execution_history_start_time');
      db.exec('DROP INDEX IF EXISTS idx_task_execution_history_guild_status');
      db.exec('DROP INDEX IF EXISTS idx_task_execution_history_rule_id');
      db.exec('DROP INDEX IF EXISTS idx_task_execution_history_task_id');
      
      db.exec('DROP INDEX IF EXISTS idx_automation_rules_created_by');
      db.exec('DROP INDEX IF EXISTS idx_automation_rules_priority');
      db.exec('DROP INDEX IF EXISTS idx_automation_rules_trigger_event');
      db.exec('DROP INDEX IF EXISTS idx_automation_rules_guild_active');
      
      db.exec('DROP INDEX IF EXISTS idx_scheduled_tasks_created_by');
      db.exec('DROP INDEX IF EXISTS idx_scheduled_tasks_trigger_type');
      db.exec('DROP INDEX IF EXISTS idx_scheduled_tasks_task_type');
      db.exec('DROP INDEX IF EXISTS idx_scheduled_tasks_next_execution');
      db.exec('DROP INDEX IF EXISTS idx_scheduled_tasks_guild_active');
      
      // Drop tables in reverse dependency order
      db.exec('DROP TABLE IF EXISTS webhook_deliveries');
      db.exec('DROP TABLE IF EXISTS integration_logs');
      db.exec('DROP TABLE IF EXISTS webhooks');
      db.exec('DROP TABLE IF EXISTS integrations');
      db.exec('DROP TABLE IF EXISTS recurring_schedules');
      db.exec('DROP TABLE IF EXISTS task_execution_history');
      db.exec('DROP TABLE IF EXISTS automation_rules');
      db.exec('DROP TABLE IF EXISTS scheduled_tasks');
      
      logInfo('Migration', 'Scheduled content and integration system tables dropped successfully');
    } catch (error) {
      logError('Migration', `Error dropping scheduled content and integration system tables: ${error}`);
      throw error;
    }
  }
};

export default addScheduledContentAndIntegrations;