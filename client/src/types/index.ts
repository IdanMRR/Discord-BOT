// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  notImplemented?: boolean; // Flag to indicate feature not implemented
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// Discord Bot Data Types
export interface Server {
  id: string;
  name: string;
  memberCount: number;
  onlineCount: number;
  icon: string | null;
  owner?: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    displayName: string;
  };
  ownerId?: string;
  settings?: ServerSettings;
  stats?: {
    warnings: number;
    tickets: number;
    recentLogs: number;
  };
}

export interface Ticket {
  id: number;
  guild_id: string;
  channel_id: string;
  user_id: string;
  ticket_number: number;
  subject: string;
  status: 'open' | 'closed' | 'deleted';
  notes?: string; // Added for ticket notes
  created_at: string;
  closed_at?: string;
  closed_by?: string;
  last_message_at?: string;
  rating?: number;
  feedback?: string;
}

export interface Warning {
  id: number;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  reason: string;
  active: number;
  removed_by?: string;
  removed_at?: string;
  removal_reason?: string;
  case_number?: number;
  created_at: string;
}

export interface ServerLog {
  id: number;
  guild_id: string;
  action_type: string;
  action: string;
  user_id: string;
  target_id?: string;
  channel_id?: string;
  message_id?: string;
  reason?: string;
  details?: string;
  log_type?: string;
  timestamp: string;
  created_at: string;
  metadata?: any;
}

export interface CommandLog {
  id: number;
  guild_id: string;
  user_id: string;
  command: string;
  options?: string;
  channel_id?: string;
  success: number;
  error?: string;
  created_at: string;
}

export interface ServerSettings {
  guild_id: string;
  name?: string;
  log_channel_id?: string;
  mod_log_channel_id?: string;
  member_log_channel_id?: string;
  message_log_channel_id?: string;
  server_log_channel_id?: string;
  welcome_channel_id?: string;
  goodbye_channel_id?: string;
  verification_channel_id?: string;
  verified_role_id?: string;
  verification_type?: 'button' | 'captcha' | 'custom_question' | 'age_verification';
  verification_panel_message_id?: string;
  language: string;
  welcome_message?: string;
  member_events_config?: string;
  ticket_category_id?: string;
  ticket_panel_channel_id?: string;
  ticket_panel_message_id?: string;
  ticket_logs_channel_id?: string;
  rules_channel_id?: string;
  staff_role_ids?: string;
  auto_mod_enabled?: number;
  auto_mod_settings?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardStats {
  serverCount: number;
  activeTickets: number;
  totalWarnings: number;
  commandsUsed: number;
  serverCountChange?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  activeTicketsChange?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  warningsChange?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  commandsChange?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  uptime?: string;
  memoryUsage?: string;
  apiLatency?: string;
  topServers?: Array<{
    id: string;
    name: string;
    memberCount: number;
  }>;
  recentActivity: Array<{
    id: number;
    type: string;
    description: string;
    timestamp: string;
    user?: string;
  }>;
}

export interface ActivityLog {
  id: string;
  type: string;
  actionDisplay?: string;
  user: string;
  description: string;
  details?: string;
  timestamp: string;
  serverId?: string;
  serverName?: string;
}

// User and Authentication Types
export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  verified?: boolean;
  mfa_enabled?: boolean;
  locale?: string;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
  permissions?: string[];
  isAdmin?: boolean;
  accessibleServers?: AccessibleServer[];
  serverPermissions?: Record<string, string[]>;
}

export interface AccessibleServer {
  id: string;
  name: string;
  permissions: string[];
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isAdmin: boolean;
  permissions: string[];
}

// Filter and Pagination Types
export interface FilterOptions {
  search?: string;
  status?: string;
  userId?: string;
  guildId?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface RealTimeUpdate {
  type: 'ticket_created' | 'ticket_closed' | 'warning_added' | 'server_joined' | 'server_left';
  data: any;
  guildId: string;
}

// ==========================================
// SCHEDULED CONTENT & AUTOMATION SYSTEM
// ==========================================

export interface ScheduledTask {
  id: number;
  guild_id: string;
  name: string;
  description?: string;
  task_type: 'message' | 'announcement' | 'role_assignment' | 'channel_action' | 'moderation' | 'custom';
  trigger_type: 'cron' | 'interval' | 'once' | 'event';
  cron_expression?: string;
  interval_seconds?: number;
  scheduled_time?: string;
  event_trigger?: string;
  target_channel_id?: string;
  target_role_ids?: string; // JSON array
  message_template?: string;
  embed_config?: string; // JSON
  components_config?: string; // JSON
  is_active: number;
  max_executions?: number;
  execution_count: number;
  last_execution?: string;
  next_execution?: string;
  timezone: string;
  conditions?: string; // JSON array
  error_count: number;
  last_error?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  id: number;
  guild_id: string;
  name: string;
  description?: string;
  trigger_event: 'member_join' | 'member_leave' | 'message_sent' | 'reaction_added' | 'role_assigned' | 'voice_join' | 'voice_leave' | 'custom';
  trigger_conditions?: string; // JSON array
  actions: string; // JSON array of actions
  cooldown_seconds: number;
  max_triggers_per_user?: number;
  is_active: number;
  priority: number;
  execution_count: number;
  last_execution?: string;
  success_count: number;
  error_count: number;
  last_error?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TaskExecutionHistory {
  id: number;
  task_id?: number;
  rule_id?: number;
  guild_id: string;
  execution_type: 'scheduled_task' | 'automation_rule';
  trigger_source?: string;
  trigger_user_id?: string;
  start_time: string;
  end_time?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result_data?: string; // JSON
  error_message?: string;
  execution_duration?: number; // milliseconds
  actions_performed?: string; // JSON array
  metadata?: string; // JSON
}

export interface RecurringSchedule {
  id: number;
  task_id: number;
  pattern_type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  pattern_config: string; // JSON
  days_of_week?: string; // JSON array
  days_of_month?: string; // JSON array
  months?: string; // JSON array
  time_slots?: string; // JSON array
  exceptions?: string; // JSON array
  timezone: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ==========================================
// ADVANCED INTEGRATION HUB
// ==========================================

export interface Integration {
  id: number;
  guild_id: string;
  name: string;
  integration_type: 'webhook' | 'api' | 'rss' | 'github' | 'twitter' | 'twitch' | 'youtube' | 'minecraft' | 'steam' | 'custom';
  provider: string;
  config: string; // JSON
  credentials_encrypted?: string;
  target_channel_id?: string;
  message_template?: string;
  embed_template?: string; // JSON
  is_active: number;
  sync_frequency?: number; // seconds
  last_sync?: string;
  next_sync?: string;
  sync_count: number;
  error_count: number;
  last_error?: string;
  rate_limit_config?: string; // JSON
  retry_config?: string; // JSON
  filter_config?: string; // JSON
  transform_config?: string; // JSON
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Webhook {
  id: number;
  guild_id: string;
  integration_id?: number;
  name: string;
  webhook_url: string;
  secret_token?: string;
  events: string; // JSON array
  is_active: number;
  security_config?: string; // JSON
  rate_limit_per_minute: number;
  max_payload_size: number;
  timeout_seconds: number;
  retry_attempts: number;
  success_count: number;
  failure_count: number;
  last_triggered?: string;
  last_success?: string;
  last_failure?: string;
  last_error?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationLog {
  id: number;
  guild_id: string;
  integration_id?: number;
  webhook_id?: number;
  event_type: string;
  event_source?: string;
  status: 'success' | 'failed' | 'pending' | 'cancelled';
  request_method?: string;
  request_url?: string;
  request_headers?: string; // JSON
  request_body?: string;
  response_status?: number;
  response_headers?: string; // JSON
  response_body?: string;
  processing_time?: number; // milliseconds
  error_message?: string;
  retry_count: number;
  metadata?: string; // JSON
  user_agent?: string;
  ip_address?: string;
  created_at: string;
}

export interface WebhookDelivery {
  id: number;
  webhook_id: number;
  guild_id: string;
  delivery_id: string; // UUID
  event_type: string;
  payload: string; // JSON
  target_url: string;
  http_method: string;
  headers?: string; // JSON
  attempt_number: number;
  max_attempts: number;
  status: 'pending' | 'delivered' | 'failed' | 'cancelled';
  response_status?: number;
  response_body?: string;
  response_time?: number; // milliseconds
  scheduled_at: string;
  delivered_at?: string;
  next_retry_at?: string;
  error_message?: string;
  user_data?: string; // JSON
  created_at: string;
  updated_at: string;
}

// ==========================================
// CONFIGURATION TYPES
// ==========================================

export interface ScheduleTaskConfig {
  messageTemplate?: {
    content?: string;
    embeds?: Array<{
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
      footer?: {
        text: string;
        iconURL?: string;
      };
      thumbnail?: {
        url: string;
      };
      image?: {
        url: string;
      };
    }>;
  };
  roleAssignment?: {
    roleIds: string[];
    action: 'add' | 'remove';
    conditions?: {
      requiredRoles?: string[];
      excludedRoles?: string[];
      minAccountAge?: number; // days
      minServerAge?: number; // days
    };
  };
  channelAction?: {
    action: 'create' | 'delete' | 'modify' | 'archive';
    channelType?: 'text' | 'voice' | 'category';
    permissions?: Array<{
      id: string;
      type: 'role' | 'member';
      allow?: string;
      deny?: string;
    }>;
  };
}

export interface AutomationRuleAction {
  type: 'send_message' | 'assign_role' | 'remove_role' | 'create_channel' | 'send_dm' | 'log_event' | 'webhook' | 'custom';
  config: {
    channelId?: string;
    roleId?: string;
    message?: string;
    embedConfig?: any;
    webhookUrl?: string;
    customData?: any;
  };
  conditions?: {
    delay?: number; // seconds
    requiresConfirmation?: boolean;
  };
}

export interface IntegrationConfig {
  github?: {
    repoUrl: string;
    events: string[];
    accessToken?: string;
    webhookSecret?: string;
  };
  rss?: {
    feedUrl: string;
    checkInterval: number; // minutes
    maxItems?: number;
  };
  minecraft?: {
    serverAddress: string;
    serverPort?: number;
    queryInterval?: number; // minutes
    showPlayerCount?: boolean;
    showOnlineStatus?: boolean;
  };
  twitch?: {
    channelName: string;
    clientId?: string;
    checkInterval?: number; // minutes
    notifyOnLive?: boolean;
    notifyOnOffline?: boolean;
  };
}
