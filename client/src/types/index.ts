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
