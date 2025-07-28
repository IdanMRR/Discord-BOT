// Base API response structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string[];
  message?: string;
}

// User types
export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string | null;
  isAdmin?: boolean;
  permissions?: string[];
  serverPermissions?: Record<string, string[]>;
  accessibleServers?: AccessibleServer[];
}

export interface AccessibleServer {
  id: string;
  name: string;
  permissions: string[];
}

// Authentication types
export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  userId?: string;
  username?: string;
  code?: string;
}

// Server/Guild types
export interface Server {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  memberCount?: number;
  onlineCount?: number;
  owner?: boolean;
  permissions?: string[];
  features?: string[];
  settings?: ServerSettings;
  stats?: ServerStats;
}

export interface ServerSettings {
  guild_id: string;
  name: string;
  language?: string;
  prefix?: string;
  log_channel_id?: string;
  member_log_channel_id?: string;
  mod_log_channel_id?: string;
  ticket_logs_channel_id?: string;
  ticket_panel_channel_id?: string;
  welcome_channel_id?: string;
  server_log_channel_id?: string;
  ticket_category_id?: string;
  auto_role_id?: string;
  mute_role_id?: string;
  welcome_message?: string;
  leave_message?: string;
  auto_mod_enabled?: boolean;
  max_warnings?: number;
  warning_action?: 'kick' | 'ban' | 'timeout';
  created_at?: string;
  updated_at?: string;
}

export interface ServerStats {
  warnings: number;
  tickets: number;
  recentLogs: number;
  totalMembers?: number;
  onlineMembers?: number;
  bots?: number;
  humans?: number;
}

// Channel types
export interface Channel {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId?: string | null;
  parent?: string | null;
  permissions?: ChannelPermission[];
}

export interface ChannelPermission {
  id: string;
  type: 'role' | 'member';
  allow: string;
  deny: string;
}

// Role types
export interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  hoist?: boolean;
  icon?: string | null;
  unicodeEmoji?: string | null;
}

// Warning types
export interface Warning {
  id: number;
  guild_id: string;
  user_id: string;
  user_name?: string;
  moderator_id: string;
  moderator_name?: string;
  reason: string;
  created_at: string;
  active: boolean;
  removed_by?: string | null;
  removed_at?: string | null;
  removal_reason?: string | null;
  case_number: number;
  channel_id?: string;
  channel_name?: string;
  additional_info?: string;
}

export interface CreateWarningRequest {
  userId: string;
  reason: string;
  additionalInfo?: string;
  notifyUser?: boolean;
}

// Ticket types
export interface Ticket {
  id: number;
  guild_id: string;
  user_id: string;
  user_name?: string;
  channel_id: string;
  category?: string;
  status: 'open' | 'closed' | 'archived';
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at?: string;
  closed_at?: string | null;
  closed_by?: string | null;
  closed_by_name?: string | null;
  close_reason?: string | null;
  ticket_number?: number;
  messages?: TicketMessage[];
  participants?: string[];
  tags?: string[];
}

export interface TicketMessage {
  id: string;
  author_id: string;
  author_name?: string;
  content: string;
  timestamp: string;
  edited?: boolean;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxyUrl?: string;
  contentType?: string;
}

export interface CreateTicketRequest {
  category: string;
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface UpdateTicketRequest {
  status?: 'open' | 'closed' | 'archived';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  title?: string;
  description?: string;
  closeReason?: string;
}

// Log types
export interface LogEntry {
  id: number;
  guild_id: string;
  user_id?: string | null;
  user_name?: string;
  action_type: string;
  details: string;
  metadata?: Record<string, any>;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

export interface DashboardLog extends LogEntry {
  category: string;
  success: boolean;
  target_type?: string;
  target_id?: string;
  duration?: number;
}

// Member types
export interface Member {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string | null;
  nickname?: string | null;
  joinedAt: string;
  roles: string[];
  permissions?: string[];
  isBot: boolean;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  activities?: Activity[];
}

export interface Activity {
  name: string;
  type: number;
  url?: string | null;
  details?: string | null;
  state?: string | null;
}

// Moderation types
export interface ModerationCase {
  id: number;
  guild_id: string;
  case_number: number;
  user_id: string;
  user_name?: string;
  moderator_id: string;
  moderator_name?: string;
  action: 'warn' | 'kick' | 'ban' | 'timeout' | 'unban';
  reason: string;
  duration?: string | null;
  created_at: string;
  expires_at?: string | null;
  active: boolean;
  additional_info?: string;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Filter types
export interface WarningFilters extends PaginationParams {
  userId?: string;
  moderatorId?: string;
  active?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface TicketFilters extends PaginationParams {
  status?: 'open' | 'closed' | 'archived' | 'all';
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  userId?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface LogFilters extends PaginationParams {
  action?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Statistics types
export interface ServerStatistics {
  overview: OverviewStats;
  activity: ActivityStats;
  moderation: ModerationStats;
  tickets: TicketStats;
  members: MemberStats;
}

export interface OverviewStats {
  totalMembers: number;
  onlineMembers: number;
  totalChannels: number;
  totalRoles: number;
  botUptime: number;
  serverAge: number;
}

export interface ActivityStats {
  messagesLastWeek: number;
  commandsLastWeek: number;
  activeUsers: number;
  peakOnline: number;
  averageOnline: number;
}

export interface ModerationStats {
  totalWarnings: number;
  activeWarnings: number;
  totalBans: number;
  totalKicks: number;
  totalTimeouts: number;
  moderationActions7Days: number;
}

export interface TicketStats {
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  ticketsLast7Days: number;
}

export interface MemberStats {
  totalMembers: number;
  newMembers7Days: number;
  leftMembers7Days: number;
  membersByStatus: {
    online: number;
    idle: number;
    dnd: number;
    offline: number;
  };
  topRoles: Array<{
    roleId: string;
    roleName: string;
    memberCount: number;
  }>;
}

// WebSocket types
export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp: string;
  id?: string;
}

export interface WebSocketSubscription {
  serverId?: string;
  updates?: string[];
  filters?: Record<string, any>;
}

// Error types
export interface ApiError {
  success: false;
  error: string;
  details?: string[];
  code?: string | number;
  timestamp?: string;
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

// Environment/Configuration types
export interface ClientConfig {
  apiUrl: string;
  wsUrl: string;
  environment: 'development' | 'production' | 'test';
  features: {
    enableWebSocket: boolean;
    enableNotifications: boolean;
    enableAnalytics: boolean;
    maxFileSize: number;
    supportedFileTypes: string[];
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
  };
}

// Export helper type for API endpoints
export type ApiEndpoint<TRequest = any, TResponse = any> = (
  data: TRequest
) => Promise<ApiResponse<TResponse>>;