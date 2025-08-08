import axios, { AxiosInstance, AxiosResponse } from 'axios';
import logger from '../utils/appLogger';
import { environment, detectApiUrl } from '../config/environment';
import {
  ApiResponse,
  Server,
  Ticket,
  Warning,
  ServerLog,
  ServerSettings,
  DashboardStats,
  FilterOptions,
  PaginationOptions,
  ActivityLog
} from '../types';

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;
  // Cache for usernames to reduce API calls
  private usernameCache: Record<string, string> = {};
  private consecutiveErrors = 0;

  constructor() {
    this.baseURL = environment.API_URL;
    
    // Auto-detect available API in development only if enabled
    if (process.env.NODE_ENV === 'development' && environment.features.enableAutoDetection) {
      detectApiUrl().then(url => {
        if (url !== this.baseURL) {
          this.baseURL = url;
          this.api.defaults.baseURL = url;
        }
      }).catch(error => {
        console.warn('⚠️ Could not auto-detect API URL, using default:', error);
      });
    }
    
    this.api = axios.create({
      baseURL: this.baseURL || '',  // Empty string for same-origin requests
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      // Add validation to only reject on server errors
      validateStatus: (status) => status < 500
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add API key for dashboard access (from environment)
        const apiKey = process.env.REACT_APP_API_KEY;
        if (apiKey) {
          config.headers['x-api-key'] = apiKey;
        }
        
        // Add user ID for server-specific permissions
        // We'll get this from the token payload or user data stored in localStorage
        try {
          if (token && typeof token === 'string' && token.split('.').length === 3) {
            // Decode the JWT token to get user ID
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.userId) {
              config.headers['x-user-id'] = payload.userId;
            }
          }
        } catch (error) {
          // Clear invalid token
          localStorage.removeItem('auth_token');
        }
        
        return config;
      },
      (error) => {
        logger.error('API', 'Request failed', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        logger.debug('API', `Response received: ${response.config.url}`, {
          status: response.status,
          method: response.config.method,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        // Check if the server is telling us to clear the token
        if (error.response?.status === 401) {
          const responseData = error.response.data;
          if (responseData?.shouldClearToken || responseData?.error?.includes('Invalid token') || responseData?.error?.includes('expired')) {
            console.warn('[DashboardLogger] Clearing invalid/expired token');
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Generic API call method with retry logic
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any,
    params?: any,
    retries: number = 3
  ): Promise<ApiResponse<T>> {
    let lastError: any;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const config: any = {
          method,
          url,
          timeout: attempt === 0 ? 5000 : 10000, // Longer timeout for retries
        };

        if (data) {
          config.data = data;
        }

        if (params) {
          config.params = params;
        }

        const response = await this.api.request(config);
        
        // Reset consecutive errors on successful request
        this.consecutiveErrors = 0;
        
        return this.normalizeResponse<T>(response);
      } catch (error: any) {
        lastError = error;
        this.consecutiveErrors++;
        
        // If we have too many consecutive errors, increase the delay significantly
        if (this.consecutiveErrors > 5) {
          await this.delay(Math.min(30000, 1000 * Math.pow(2, this.consecutiveErrors - 5))); // Max 30 second delay
        }
        
        // Don't retry on client errors (4xx) or if it's the last attempt
        if (error.response?.status >= 400 && error.response?.status < 500) {
          break;
        }
        
        if (attempt < retries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.min(5000, 1000 * Math.pow(2, attempt));
          await this.delay(delay);
        }
      }
    }

    logger.error('ApiService', `Request failed after ${retries} attempts:`, lastError);
    
    return {
      success: false,
      error: this.getErrorMessage(lastError)
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get username with caching to reduce API calls
  async getUserName(userId: string): Promise<string> {
    // Return from cache if available
    if (this.usernameCache[userId]) {
      return this.usernameCache[userId];
    }
    
    try {
      const response = await this.makeRequest<{username: string}>('GET', `/api/users/${userId}`);
      if (response.success && response.data) {
        // Store in cache
        this.usernameCache[userId] = response.data.username;
        return response.data.username;
      }
      return userId;
    } catch (error) {
      return userId;
    }
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    try {
      logger.info('ApiService', 'Attempting to fetch dashboard stats...');
      const result = await this.makeRequest<DashboardStats>('GET', '/api/dashboard/stats');
      
      if (result.success) {
        logger.info('ApiService', 'Dashboard stats fetched successfully');
      } else {
        logger.warn('ApiService', 'Dashboard stats request failed:', result.error);
      }
      
      return result;
    } catch (error) {
      logger.error('ApiService', 'Error in getDashboardStats:', error);
      return {
        success: false,
        error: 'Failed to connect to dashboard API'
      };
    }
  }

  async getRecentActivity(): Promise<ApiResponse<ActivityLog[]>> {
    return this.makeRequest<ActivityLog[]>('GET', '/api/dashboard/recent-activity');
  }

  // Server Management
  async getServerList(): Promise<ApiResponse<Server[]>> {
    const startTime = Date.now();
    
        try {
      logger.info('ApiService', 'Fetching server list from updated API...');
      
      // Try main servers endpoint first (the new recoded one)
      let response: AxiosResponse;
      let endpoint = '/api/servers';
      
      try {
        response = await this.api.get(endpoint, {
          timeout: 10000 // Longer timeout for server fetching
        });
        
        logger.info('ApiService', `Successfully fetched from main endpoint: ${endpoint}`);
      } catch (mainError: any) {
        // Fallback to direct servers endpoint if main fails
        logger.warn('ApiService', `Main servers endpoint failed: ${mainError.message}, trying direct endpoint`);
        endpoint = '/api/direct-servers';
        
        try {
          response = await this.api.get(endpoint, {
            timeout: 10000
          });
          logger.info('ApiService', `Successfully fetched from fallback endpoint: ${endpoint}`);
        } catch (directError: any) {
          logger.error('ApiService', `Both endpoints failed. Main: ${mainError.message}, Direct: ${directError.message}`);
          throw directError;
        }
      }
      
      const duration = Date.now() - startTime;
      logger.info('ApiService', `Server list fetch completed in ${duration}ms from ${endpoint}`);
      
      // Handle the response data
      const responseData = response.data;
      
      // The new backend returns ApiResponse format
      if (responseData && typeof responseData === 'object' && 'success' in responseData) {
        const apiResponse = responseData as ApiResponse<Server[]>;
        
        if (apiResponse.success && apiResponse.data) {
          const servers = apiResponse.data;
          logger.info('ApiService', `Successfully received ${servers.length} servers`);
          
          if (servers.length === 0) {
            logger.info('ApiService', 'No servers found - checking for error message');
            if (apiResponse.error) {
              logger.info('ApiService', `Server list empty reason: ${apiResponse.error}`);
            }
          } else {
            logger.debug('ApiService', `Sample server: ${servers[0]?.name} (${servers[0]?.id})`);
          }
          
          return apiResponse;
        } else {
          // Handle error response
          logger.error('ApiService', 'Server list response indicates failure', apiResponse.error);
          return {
            success: false,
            data: [],
            error: apiResponse.error || 'Unknown error occurred'
          };
        }
      } else if (Array.isArray(responseData)) {
        // Handle direct array response (fallback)
        logger.info('ApiService', `Received direct array with ${responseData.length} servers`);
            return {
              success: true,
          data: responseData as Server[]
        };
      } else {
        // Unexpected response format
        logger.error('ApiService', 'Unexpected response format from server list endpoint', responseData);
        return {
          success: false,
          data: [],
          error: 'Unexpected response format from server'
            };
          }
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('ApiService', `Server list fetch failed after ${duration}ms`, error);
      
      // Return a standardized error response
      const errorResponse: ApiResponse<Server[]> = {
        success: false,
        data: [],
        error: this.getErrorMessage(error)
      };
      
      return errorResponse;
    }
  }


  // Ticket Management
  async getTickets(options?: FilterOptions & PaginationOptions): Promise<ApiResponse<{
    tickets: Ticket[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }>> {
    try {
      const response = await this.makeRequest<{
        tickets: Ticket[];
        totalCount: number;
        totalPages: number;
        currentPage: number;
      }>('GET', '/api/tickets', undefined, options);
      
      return response;
    } catch (error: any) {
      logger.error('ApiService', 'Error fetching tickets', error);
      return {
        success: false,
        error: 'Failed to fetch tickets. Please try again later.',
        data: {
          tickets: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: 1
        }
      };
    }
  }

  async getTicket(id: number): Promise<ApiResponse<Ticket>> {
    return this.makeRequest<Ticket>('GET', `/api/tickets/${id}`);
  }

  async closeTicket(id: number, reason?: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('PUT', `/api/tickets/${id}/close`, { reason });
  }

  async reopenTicket(id: number, reason?: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('PUT', `/api/tickets/${id}/reopen`, { reason });
  }

  async deleteTicket(id: number, reason?: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('DELETE', `/api/tickets/${id}`, { reason });
  }

  async getTicketTranscript(id: number): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('GET', `/api/tickets/${id}/transcript`);
  }

  async storeTicketTranscript(id: number): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('PUT', `/api/tickets/${id}/transcript`);
  }

  // Warning Management
  async getWarnings(options?: FilterOptions & PaginationOptions): Promise<ApiResponse<Warning[]>> {
    return this.makeRequest<Warning[]>('GET', '/api/warnings', undefined, options);
  }

  async getWarning(id: number): Promise<ApiResponse<Warning>> {
    return this.makeRequest<Warning>('GET', `/api/warnings/${id}`);
  }

  async createWarning(warning: Omit<Warning, 'id' | 'created_at'>): Promise<ApiResponse<Warning>> {
    return this.makeRequest<Warning>('POST', '/api/warnings', warning);
  }

  async updateWarning(id: number, warning: Partial<Warning>): Promise<ApiResponse<Warning>> {
    return this.makeRequest<Warning>('PUT', `/api/warnings/${id}`, warning);
  }

  async deleteWarning(id: number): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('DELETE', `/api/warnings/${id}`);
  }

  async removeWarning(id: number, reason: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('POST', `/api/warnings/${id}/remove`, { reason });
  }

  // Server Channels
  async getServerChannels(serverId: string, type: 'text' | 'category' | 'all' = 'text'): Promise<ApiResponse<any[]>> {
    // Validate serverId
    if (!serverId || serverId === 'undefined' || serverId === 'null') {
      logger.warn('ApiService', 'Invalid server ID provided for channels:', serverId);
      return {
        success: false,
        error: 'Invalid server ID provided',
        data: []
      };
    }

    try {
      logger.info('ApiService', `Fetching channels for server ${serverId} with type ${type}`);
      const response = await this.makeRequest<any[]>('GET', `/api/servers/${serverId}/channels`, undefined, { type }, 1);
      if (!response.success) {
        logger.error('ApiService', `Failed to fetch channels for server ${serverId}:`, response.error);
      } else {
        logger.info('ApiService', `Successfully fetched ${response.data?.length || 0} channels for server ${serverId}`);
      }
      
      return response;
    } catch (error: any) {
      logger.error('ApiService', `Error in getServerChannels for server ${serverId}:`, error);
      return {
        success: false,
        error: `Failed to fetch server channels: ${error.message || 'Unknown error'}`,
        data: []
      };
    }
  }

  // Logging Settings
  async getLoggingSettings(serverId: string): Promise<ApiResponse<any>> {
    try {
      logger.info('ApiService', `Fetching logging settings for server ${serverId}`);
      const response = await this.makeRequest('GET', `/api/servers/${serverId}/logging-settings`);
      return response;
    } catch (error: any) {
      logger.error('ApiService', `Error getting logging settings for server ${serverId}:`, error);
      return {
        success: false,
        error: `Failed to fetch logging settings: ${error.message || 'Unknown error'}`,
        data: null
      };
    }
  }

  async updateLoggingSettings(serverId: string, settings: any): Promise<ApiResponse<any>> {
    try {
      logger.info('ApiService', `Updating logging settings for server ${serverId}`, settings);
      const response = await this.makeRequest('POST', `/api/servers/${serverId}/logging-settings`, settings);
      return response;
    } catch (error: any) {
      logger.error('ApiService', `Error updating logging settings for server ${serverId}:`, error);
      return {
        success: false,
        error: `Failed to update logging settings: ${error.message || 'Unknown error'}`,
        data: null
      };
    }
  }

  // Server Info (fallback to getServerById)
  async getServerInfo(serverId: string): Promise<ApiResponse<any>> {
    return this.getServerById(serverId);
  }


  async getServerById(serverId: string): Promise<ApiResponse<Server & { settings: ServerSettings }>> {
    try {
      // Validate serverId
      if (!serverId || serverId === 'undefined' || serverId === 'null') {
        logger.warn('ApiService', 'Invalid server ID provided:', serverId);
        return {
          success: false,
          error: 'Invalid server ID provided'
        };
      }

      logger.info('ApiService', `Attempting to fetch server details for ${serverId}...`);
      
      // Try main servers endpoint first
      let response;
      try {
        response = await this.api.get(`/api/servers/${serverId}`, {
          timeout: 10000
        });
        
        logger.info('ApiService', 'Successfully fetched server details from main endpoint');
      } catch (mainError: any) {
        // Fallback to direct servers endpoint
        logger.warn('ApiService', `Main endpoint failed: ${mainError.message}, trying direct endpoint`);
        
        response = await this.api.get(`/api/direct-servers/${serverId}`, {
          timeout: 10000
        });
        
        logger.info('ApiService', 'Successfully fetched server details from direct endpoint');
      }
      
      logger.debug('ApiService', 'Server details fetch result', response.data);
      
      // Handle the response
      const responseData = response.data;
      if (responseData && typeof responseData === 'object' && 'success' in responseData) {
        return responseData as ApiResponse<Server & { settings: ServerSettings }>;
      } else {
        // Handle direct data response
        return {
          success: true,
          data: responseData as Server & { settings: ServerSettings }
        };
      }
      
    } catch (error: any) {
      logger.error('ApiService', 'All server details fetch attempts failed', error);
      
        return {
          success: false,
        error: this.getErrorMessage(error)
        };
    }
  }

  // Logs
  async getServerLogs(options?: FilterOptions & PaginationOptions): Promise<ApiResponse<ServerLog[]>> {
    // Get comprehensive logs (commands, moderation, etc.) for server-specific pages
    return this.makeRequest<ServerLog[]>('GET', '/api/simple-dashboard/all-logs', undefined, {
      guild_id: options?.guildId,
      page: options?.page || 1,
      limit: options?.limit || 1000,
      user_id: options?.userId
    });
  }

  // Get all logs with filtering
  async getLogs(params?: {
    guild_id?: string;
    action?: string;
    user_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{
    data: any[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
    };
  }>> {
    return this.makeRequest('GET', '/api/dashboard/logs', undefined, params);
  }

  // Get command logs
  async getCommandLogs(guildId?: string): Promise<ApiResponse<any[]>> {
    return this.makeRequest('GET', '/api/dashboard/command-logs', undefined, { guild_id: guildId });
  }

  // Get message logs (deletions, edits)
  async getMessageLogs(): Promise<ApiResponse<any[]>> {
    return this.makeRequest('GET', '/api/dashboard/message-logs');
  }

  // Get server logs (member joins, leaves, etc.)
  async getServerActivityLogs(): Promise<ApiResponse<any[]>> {
    return this.makeRequest('GET', '/api/dashboard/server-logs');
  }

  // Get moderation logs (bans, kicks, warnings)
  async getModerationLogs(): Promise<ApiResponse<any[]>> {
    return this.makeRequest('GET', '/api/dashboard/mod-logs');
  }

  // Member Management
  async getServerMembers(serverId: string, options?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  }): Promise<ApiResponse<{
    members: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    serverInfo: {
      name: string;
      memberCount: number;
      icon: string | null;
    };
  }>> {
    return this.makeRequest('GET', `/api/${serverId}/members`, undefined, options);
  }

  async getMemberDetails(serverId: string, memberId: string): Promise<ApiResponse<any>> {
    return this.makeRequest('GET', `/api/${serverId}/members/${memberId}`);
  }

  async kickMember(serverId: string, memberId: string, reason?: string): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest('POST', `/api/${serverId}/members/${memberId}/kick`, { reason });
  }

  async banMember(serverId: string, memberId: string, reason?: string, deleteMessageDays?: number): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest('POST', `/api/${serverId}/members/${memberId}/ban`, { reason, deleteMessageDays });
  }

  async timeoutMember(serverId: string, memberId: string, duration: number, reason?: string): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest('POST', `/api/${serverId}/members/${memberId}/timeout`, { reason, duration });
  }

  async warnMember(serverId: string, memberId: string, reason?: string): Promise<ApiResponse<{ message: string; data: { warningId: number } }>> {
    return this.makeRequest('POST', `/api/${serverId}/members/${memberId}/warn`, { reason });
  }

  async sendDM(serverId: string, memberId: string, message: string): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest('POST', `/api/${serverId}/members/${memberId}/dm`, { message });
  }

  // Get ticket logs
  async getTicketLogs(): Promise<ApiResponse<any[]>> {
    return this.makeRequest('GET', '/api/dashboard/ticket-logs');
  }

  // Get user activity logs (joins, leaves)
  async getUserActivityLogs(): Promise<ApiResponse<any[]>> {
    return this.makeRequest('GET', '/api/dashboard/user-logs');
  }

  // Channel Management
  async getChannels(guildId: string): Promise<ApiResponse<any[]>> {
    // Validate guildId
    if (!guildId || guildId === 'undefined' || guildId === 'null') {
      logger.warn('ApiService', 'Invalid guild ID provided for channels:', guildId);
      return {
        success: false,
        error: 'Invalid guild ID provided',
        data: []
      };
    }

    return this.makeRequest<any[]>('GET', `/api/servers/${guildId}/channels`, undefined, undefined, 1);
  }

  async getRoles(guildId: string): Promise<ApiResponse<any[]>> {
    // Validate guildId
    if (!guildId || guildId === 'undefined' || guildId === 'null') {
      logger.warn('ApiService', 'Invalid guild ID provided for roles:', guildId);
      return {
        success: false,
        error: 'Invalid guild ID provided',
        data: []
      };
    }

    return this.makeRequest<any[]>('GET', `/api/servers/${guildId}/roles`, undefined, undefined, 1);
  }

  // Authentication (Discord OAuth2)
  async getAuthUrl(): Promise<ApiResponse<{ url: string }>> {
    return this.makeRequest<{ url: string }>('GET', '/auth/discord');
  }

  async handleAuthCallback(code: string): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.makeRequest<{ token: string; user: any }>('POST', '/auth/discord/callback', { code });
  }

  async devLogin(): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.makeRequest<{ token: string; user: any }>('POST', '/auth/dev-login', {});
  }

  async setupAdmin(): Promise<ApiResponse<{ message: string; permissions: string[] }>> {
    return this.makeRequest<{ message: string; permissions: string[] }>('POST', '/auth/setup-admin', {});
  }

  async debugPermissions(): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('GET', '/auth/debug-permissions', {});
  }

  // Update user permissions (admin only)
  async updateUserPermissions(userId: string, updates: {
    permissions?: string[];
    role?: string;
    dashboardAccess?: boolean;
    guildId?: string;
  }): Promise<ApiResponse<{
    userId: string;
    permissions: string[];
    role: string;
    dashboardAccess: boolean;
    message: string;
  }>> {
    return this.makeRequest('PUT', `/api/admin/users/${userId}`, updates);
  }

  async getCurrentUser(): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('GET', '/auth/me');
  }

  async logout(): Promise<ApiResponse<void>> {
    localStorage.removeItem('auth_token');
    return { success: true };
  }

  // Utility methods
  getWebSocketUrl(): string {
    return process.env.REACT_APP_WS_URL || (this.baseURL.replace('http', 'ws') + '/ws');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  setAuthToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  // Helper method to normalize API responses
  private normalizeResponse<T>(response: AxiosResponse): ApiResponse<T> {
    const data = response.data;
    
    // If response is already in ApiResponse format
    if (typeof data === 'object' && data !== null && 'success' in data) {
      return data as ApiResponse<T>;
    }
    
    // If response is an array (direct data)
    if (Array.isArray(data)) {
      return {
        success: true,
        data: data as T
      };
    }
    
    // If response is just data
    return {
      success: true,
      data: data as T
    };
  }

  // Helper method to extract meaningful error messages
  private getErrorMessage(error: any): string {
    if (error.response) {
      // HTTP error
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 404) {
        return 'Service not found. Please ensure the Discord bot is running.';
      } else if (status === 503) {
        return 'Service temporarily unavailable. Please try again.';
      } else if (status >= 500) {
        return 'Server error occurred. Please check bot logs and try again.';
      } else if (data?.error) {
        return data.error;
      } else {
        return `HTTP ${status}: ${error.response.statusText}`;
      }
    } else if (error.request) {
      // Network error
      return 'Cannot connect to Discord bot API. Please ensure the bot is running.';
    } else if (error.code === 'ECONNREFUSED') {
      return 'Connection refused. Please ensure the Discord bot is running on port 3001.';
    } else {
      // Other error
      return error.message || 'An unexpected error occurred';
    }
  }

  // Ticket Categories
  async getTicketCategories(serverId: string): Promise<ApiResponse<{
    categories: any[];
    currentCategoryId: string | null;
  }>> {
    return this.makeRequest<{
      categories: any[];
      currentCategoryId: string | null;
    }>('GET', `/api/servers/${serverId}/ticket-categories`);
  }

  async updateTicketCategories(serverId: string, data: {
    categoryId?: string;
    categories?: any[];
  }): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('POST', `/api/servers/${serverId}/ticket-categories`, data);
  }

  // Verification Management
  async getServerChannelsAndRoles(serverId: string): Promise<ApiResponse<{
    channels: any[];
    roles: any[];
    guildName: string;
  }>> {
    return this.makeRequest<{
      channels: any[];
      roles: any[];
      guildName: string;
    }>('GET', `/api/simple-dashboard/server/${serverId}/channels-and-roles`);
  }

  async updateVerificationSettings(serverId: string, settings: {
    verification_channel_id?: string;
    verified_role_id?: string;
    verification_type?: string;
  }): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('POST', `/api/simple-dashboard/server/${serverId}/verification`, settings);
  }

  async createVerificationMessage(serverId: string, channelId: string): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/verification/create-message`, { channel_id: channelId });
  }

  async createTicketPanelMessage(serverId: string, channelId: string): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/tickets/create-panel`, { channel_id: channelId });
  }

  async createCustomVerificationMessage(serverId: string, channelId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    buttonText?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/verification/create-custom-message`, {
      channel_id: channelId,
      title: customMessage.title,
      description: customMessage.description,
      color: customMessage.color,
      buttonText: customMessage.buttonText,
      fields: customMessage.fields
    });
  }

  // Age Verification Settings
  async getAgeVerificationSettings(serverId: string): Promise<ApiResponse<{
    min_age: number;
    require_account_age: boolean;
    min_account_age_days: number;
  }>> {
    return this.makeRequest<{
      min_age: number;
      require_account_age: boolean;
      min_account_age_days: number;
    }>('GET', `/api/simple-dashboard/verification/age-settings/${serverId}`);
  }

  async saveAgeVerificationSettings(serverId: string, settings: {
    min_age: number;
    require_account_age: boolean;
    min_account_age_days: number;
  }): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('POST', `/api/simple-dashboard/verification/age-settings/${serverId}`, settings);
  }

  // Custom Questions Management
  async getCustomQuestions(serverId: string): Promise<ApiResponse<Array<{
    id: string;
    question: string;
    answer: string;
    case_sensitive: boolean;
  }>>> {
    return this.makeRequest<Array<{
      id: string;
      question: string;
      answer: string;
      case_sensitive: boolean;
    }>>('GET', `/api/simple-dashboard/verification/questions/${serverId}`);
  }

  async addCustomQuestion(serverId: string, question: {
    question: string;
    answer: string;
    case_sensitive: boolean;
  }): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('POST', `/api/simple-dashboard/verification/questions/${serverId}`, question);
  }

  async deleteCustomQuestion(serverId: string, questionId: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('DELETE', `/api/simple-dashboard/verification/questions/${serverId}/${questionId}`);
  }

  async createCustomTicketPanelMessage(serverId: string, channelId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    footer: string;
    buttonText?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/tickets/create-custom-panel`, {
      channel_id: channelId,
      title: customMessage.title,
      description: customMessage.description,
      color: customMessage.color,
      footer: customMessage.footer,
      buttonText: customMessage.buttonText,
      fields: customMessage.fields
    });
  }

  async createCustomWelcomeMessage(serverId: string, channelId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/member-events/create-welcome-message`, {
      channel_id: channelId,
      title: customMessage.title,
      description: customMessage.description,
      color: customMessage.color,
      fields: customMessage.fields
    });
  }

  async createCustomLeaveMessage(serverId: string, channelId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/member-events/create-leave-message`, {
      channel_id: channelId,
      title: customMessage.title,
      description: customMessage.description,
      color: customMessage.color,
      fields: customMessage.fields
    });
  }

  async createCustomInviteJoinMessage(serverId: string, channelId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/invite-tracker/create-join-message`, {
      channel_id: channelId,
      title: customMessage.title,
      description: customMessage.description,
      color: customMessage.color,
      fields: customMessage.fields
    });
  }

  async createCustomInviteLeaveMessage(serverId: string, channelId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/invite-tracker/create-leave-message`, {
      channel_id: channelId,
      title: customMessage.title,
      description: customMessage.description,
      color: customMessage.color,
      fields: customMessage.fields
    });
  }

  async testInviteJoinMessage(serverId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/invite-tracker/test-join-message`, {
      title: customMessage.title,
      description: customMessage.description,
      color: customMessage.color,
      fields: customMessage.fields
    });
  }

  async testInviteLeaveMessage(serverId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/invite-tracker/test-leave-message`, {
      title: customMessage.title,
      description: customMessage.description,
      color: customMessage.color,
      fields: customMessage.fields
    });
  }

  async saveWelcomeMessageConfig(serverId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/member-events/save-welcome-config`, {
      title: customMessage.title,
      description: customMessage.description,
      color: customMessage.color,
      fields: customMessage.fields
    });
  }

  async getWelcomeMessageConfig(serverId: string): Promise<ApiResponse<{
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }>> {
    return this.makeRequest<{
      title: string;
      description: string;
      color: string;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
    }>('GET', `/api/simple-dashboard/server/${serverId}/member-events/welcome-config`);
  }

  async resetWelcomeMessageConfig(serverId: string): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/member-events/reset-welcome-config`);
  }

  async saveGoodbyeMessageConfig(serverId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/member-events/save-goodbye-config`, customMessage);
  }

  async getGoodbyeMessageConfig(serverId: string): Promise<ApiResponse<{
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }>> {
    return this.makeRequest<{
      title: string;
      description: string;
      color: string;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
    }>('GET', `/api/simple-dashboard/server/${serverId}/member-events/goodbye-config`);
  }

  async resetGoodbyeMessageConfig(serverId: string): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/member-events/reset-goodbye-config`);
  }


  async saveInviteJoinMessageConfig(serverId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/invite-tracker/save-join-config`, customMessage);
  }

  async getInviteJoinMessageConfig(serverId: string): Promise<ApiResponse<{
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }>> {
    return this.makeRequest<{
      title: string;
      description: string;
      color: string;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
    }>('GET', `/api/simple-dashboard/server/${serverId}/invite-tracker/join-config`);
  }

  async resetInviteJoinMessageConfig(serverId: string): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/invite-tracker/reset-join-config`);
  }

  async saveInviteLeaveMessageConfig(serverId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/invite-tracker/save-leave-config`, customMessage);
  }

  async getInviteLeaveMessageConfig(serverId: string): Promise<ApiResponse<{
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }>> {
    return this.makeRequest<{
      title: string;
      description: string;
      color: string;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
    }>('GET', `/api/simple-dashboard/server/${serverId}/invite-tracker/leave-config`);
  }

  async resetInviteLeaveMessageConfig(serverId: string): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/invite-tracker/reset-leave-config`);
  }



  // Verification Panel Methods
  async saveVerificationConfig(serverId: string, config: {
    title: string;
    description: string;
    color: string;
    buttonText?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/verification/save-config`, config);
  }

  async getVerificationConfig(serverId: string): Promise<ApiResponse<{
    title: string;
    description: string;
    color: string;
    buttonText?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }>> {
    return this.makeRequest<{
      title: string;
      description: string;
      color: string;
      buttonText?: string;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
    }>('GET', `/api/simple-dashboard/server/${serverId}/verification/config`);
  }

  async resetVerificationConfig(serverId: string): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/verification/reset-config`);
  }

  async testVerificationMessage(serverId: string, config: {
    title: string;
    description: string;
    color: string;
    buttonText?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/verification/test-message`, config);
  }

  // Ticket Panel Methods
  async saveTicketPanelConfig(serverId: string, config: {
    title: string;
    description: string;
    color: string;
    footer?: string;
    buttonText?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/tickets/save-config`, config);
  }

  async getTicketPanelConfig(serverId: string): Promise<ApiResponse<{
    title: string;
    description: string;
    color: string;
    footer?: string;
    buttonText?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }>> {
    return this.makeRequest<{
      title: string;
      description: string;
      color: string;
      footer?: string;
      buttonText?: string;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
    }>('GET', `/api/simple-dashboard/server/${serverId}/tickets/config`);
  }

  async resetTicketPanelConfig(serverId: string): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/tickets/reset-config`);
  }

  async testTicketPanelMessage(serverId: string, config: {
    title: string;
    description: string;
    color: string;
    footer?: string;
    buttonText?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/tickets/test-panel`, config);
  }

  async testWelcomeMessage(serverId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/member-events/test-welcome-message`, {
      title: customMessage.title,
      description: customMessage.description,
      color: customMessage.color,
      fields: customMessage.fields
    });
  }

  async testGoodbyeMessage(serverId: string, customMessage: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }): Promise<ApiResponse<{
    messageId: string;
  }>> {
    return this.makeRequest<{
      messageId: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/member-events/test-goodbye-message`, {
      title: customMessage.title,
      description: customMessage.description,
      color: customMessage.color,
      fields: customMessage.fields
    });
  }

  // Dashboard Logs
  async getDashboardLogs(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    actionType?: string;
    guildId?: string;
  }): Promise<ApiResponse<{
    logs: any[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  }>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.userId) queryParams.append('user_id', params.userId);
    if (params?.actionType) queryParams.append('action_type', params.actionType);
    if (params?.guildId) queryParams.append('guild_id', params.guildId);

    return this.makeRequest<{
      logs: any[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
      };
    }>('GET', `/api/dashboard-logs?${queryParams}`);
  }

  // Create Dashboard Log
  async createDashboardLog(logData: {
    user_id?: string;
    username: string;
    action_type: string;
    page: string;
    target_type?: string;
    target_id?: string;
    details?: string;
    success?: boolean;
    guild_id?: string;
  }): Promise<ApiResponse<any>> {
    return this.makeRequest('POST', '/api/dashboard-logs', logData);
  }

  // Delete Dashboard Logs (cleanup)
  async deleteDashboardLogs(logIds?: number[]): Promise<ApiResponse<any>> {
    if (logIds && logIds.length > 0) {
      // If specific log IDs are provided, we'd need a different endpoint
      // For now, just call cleanup
      return this.makeRequest('DELETE', '/api/dashboard-logs/cleanup');
    }
    return this.makeRequest('DELETE', '/api/dashboard-logs/cleanup');
  }

  // Export Dashboard Logs (placeholder - would need backend implementation)
  async exportDashboardLogs(filters?: any, format: 'csv' | 'json' = 'csv'): Promise<ApiResponse<{
    data: string;
    filename: string;
  }>> {
    // This would need to be implemented in the backend
    throw new Error('Export dashboard logs not implemented in backend');
  }

  // Automod Escalation Methods
  async getAutomodSettings(guildId: string): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('GET', `/api/automod-escalation/${guildId}/settings`);
  }

  async updateAutomodSettings(guildId: string, settings: any): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('PUT', `/api/automod-escalation/${guildId}/settings`, settings);
  }

  async getAutomodRules(guildId: string): Promise<ApiResponse<any[]>> {
    return this.makeRequest<any[]>('GET', `/api/automod-escalation/${guildId}/rules`);
  }

  async createAutomodRule(guildId: string, rule: any): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('POST', `/api/automod-escalation/${guildId}/rules`, rule);
  }

  async updateAutomodRule(guildId: string, ruleId: number, updates: any): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('PUT', `/api/automod-escalation/${guildId}/rules/${ruleId}`, updates);
  }

  async deleteAutomodRule(guildId: string, ruleId: number): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('DELETE', `/api/automod-escalation/${guildId}/rules/${ruleId}`);
  }

  async getAutomodStats(guildId: string): Promise<ApiResponse<any>> {
    return this.makeRequest<any>('GET', `/api/automod-escalation/${guildId}/stats`);
  }

  async getAutomodLogs(guildId: string, params?: { limit?: number; offset?: number }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    
    return this.makeRequest<any[]>('GET', `/api/automod-escalation/${guildId}/logs?${queryParams}`);
  }

  // Dashboard Action Logging
  async logDashboardAction(serverId: string, data: {
    action: string;
    details?: string;
    userId?: string;
    username?: string;
  }): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('POST', `/api/servers/${serverId}/dashboard-actions`, data);
  }

  // Generic POST method for dashboard logger
  async post(url: string, data?: any): Promise<ApiResponse<any>> {
    // Remove leading slash if present to work with makeRequest
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    return this.makeRequest<any>('POST', `/api/${cleanUrl}`, data);
  }

  // DM Settings - PDR requirement for server-level DM toggles
  async getDMSettings(serverId: string): Promise<ApiResponse<{
    dm_warnings_enabled: boolean;
    dm_tickets_enabled: boolean;
    dm_level_notifications: boolean;
    dm_general_notifications: boolean;
  }>> {
    return this.makeRequest<{
      dm_warnings_enabled: boolean;
      dm_tickets_enabled: boolean;
      dm_level_notifications: boolean;
      dm_general_notifications: boolean;
    }>('GET', `/api/servers/${serverId}/dm-settings`);
  }

  async updateDMSettings(serverId: string, settings: {
    dm_warnings_enabled?: boolean;
    dm_tickets_enabled?: boolean;
    dm_level_notifications?: boolean;
    dm_general_notifications?: boolean;
  }): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('PUT', `/api/servers/${serverId}/dm-settings`, settings);
  }

  // Analytics Methods
  async getAnalyticsOverview(serverId: string, days: number = 7): Promise<ApiResponse<any>> {
    return this.makeRequest('GET', `/api/analytics/${serverId}/overview`, undefined, { days });
  }

  async getAnalyticsHourlyActivity(serverId: string, days: number = 7): Promise<ApiResponse<any[]>> {
    return this.makeRequest('GET', `/api/analytics/${serverId}/hourly-activity`, undefined, { days });
  }

  async getAnalyticsTopChannels(serverId: string, days: number = 7, limit: number = 10): Promise<ApiResponse<any[]>> {
    return this.makeRequest('GET', `/api/analytics/${serverId}/top-channels`, undefined, { days, limit });
  }

  async getAnalyticsCommandStats(serverId: string, days: number = 7): Promise<ApiResponse<any[]>> {
    return this.makeRequest('GET', `/api/analytics/${serverId}/command-stats`, undefined, { days });
  }

  async getAnalyticsMemberEngagement(serverId: string, days: number = 7): Promise<ApiResponse<any>> {
    return this.makeRequest('GET', `/api/analytics/${serverId}/member-engagement`, undefined, { days });
  }

  async getAnalyticsServerHealth(serverId: string, hours: number = 24): Promise<ApiResponse<any[]>> {
    return this.makeRequest('GET', `/api/analytics/${serverId}/server-health`, undefined, { hours });
  }

  async exportAnalytics(serverId: string, days: number = 30, format: string = 'json'): Promise<ApiResponse<any>> {
    return this.makeRequest('GET', `/api/analytics/${serverId}/export`, undefined, { days, format });
  }

  // System Metrics
  async getSystemMetrics(): Promise<ApiResponse<{
    uptime: string;
    memoryUsage: {
      used: string;
      total: string;
      percentage: number;
    };
    apiLatency: string;
    databaseSize: string;
    guildCount: number;
    totalUsers: number;
    commandsExecuted: number;
    messagesProcessed: number;
    systemLoad: {
      cpu: number;
      memory: number;
    };
    lastRestart: string;
    nodeVersion: string;
    discordJsVersion: string;
  }>> {
    return this.makeRequest('GET', '/api/system/metrics');
  }

  async getSystemHealth(): Promise<ApiResponse<{
    status: string;
    database: string;
    discord: string;
    responseTime: string;
    timestamp: string;
  }>> {
    return this.makeRequest('GET', '/api/system/health');
  }

  // Server Settings
  async getServerSettings(serverId: string): Promise<ApiResponse<any>> {
    return this.makeRequest('GET', `/api/servers/${serverId}/settings`);
  }

  async updateServerSettings(serverId: string, settings: any): Promise<ApiResponse<any>> {
    return this.makeRequest('POST', `/api/servers/${serverId}/settings`, settings);
  }

  async createTicketPanel(serverId: string, data: {
    channel_id: string;
    panel_type: string;
  }): Promise<ApiResponse<{ messageId: string }>> {
    return this.makeRequest('POST', `/api/servers/${serverId}/tickets/create-panel`, data);
  }


  // Leveling System
  async getLevelingSettings(serverId: string): Promise<ApiResponse<{
    enabled: boolean;
    xp_per_message: number;
    xp_cooldown: number;
    level_up_channel_id?: string;
    level_roles: Array<{
      level: number;
      role_id: string;
      role_name: string;
    }>;
    rewards: Array<{
      level: number;
      reward_type: 'role' | 'currency' | 'badge';
      reward_value: string;
      reward_amount?: number;
    }>;
  }>> {
    return this.makeRequest('GET', `/api/servers/${serverId}/leveling-settings`);
  }

  async updateLevelingSettings(serverId: string, settings: {
    enabled?: boolean;
    xp_per_message?: number;
    xp_cooldown?: number;
    level_up_channel_id?: string;
    level_roles?: Array<{
      level: number;
      role_id: string;
    }>;
    rewards?: Array<{
      level: number;
      reward_type: 'role' | 'currency' | 'badge';
      reward_value: string;
      reward_amount?: number;
    }>;
  }): Promise<ApiResponse<any>> {
    return this.makeRequest('POST', `/api/servers/${serverId}/leveling-settings`, settings);
  }

  // Economy System
  async getEconomySettings(serverId: string): Promise<ApiResponse<{
    enabled: boolean;
    currency_name: string;
    currency_symbol: string;
    daily_reward: number;
    work_reward_min: number;
    work_reward_max: number;
    shop_items: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      role_id?: string;
      type: 'role' | 'item' | 'badge';
    }>;
  }>> {
    return this.makeRequest('GET', `/api/servers/${serverId}/economy-settings`);
  }

  async updateEconomySettings(serverId: string, settings: {
    enabled?: boolean;
    currency_name?: string;
    currency_symbol?: string;
    daily_reward?: number;
    work_reward_min?: number;
    work_reward_max?: number;
    shop_items?: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      role_id?: string;
      type: 'role' | 'item' | 'badge';
    }>;
  }): Promise<ApiResponse<any>> {
    return this.makeRequest('POST', `/api/servers/${serverId}/economy-settings`, settings);
  }

  // Auto-Role Management
  async getAutoRoleSettings(serverId: string): Promise<ApiResponse<{
    join_roles: string[];
    verification_roles: string[];
    level_roles: Array<{
      level: number;
      role_id: string;
    }>;
    reaction_roles: Array<{
      message_id: string;
      channel_id: string;
      emoji: string;
      role_id: string;
    }>;
  }>> {
    return this.makeRequest('GET', `/api/servers/${serverId}/auto-roles`);
  }

  async updateAutoRoleSettings(serverId: string, settings: {
    join_roles?: string[];
    verification_roles?: string[];
    level_roles?: Array<{
      level: number;
      role_id: string;
    }>;
    reaction_roles?: Array<{
      message_id: string;
      channel_id: string;
      emoji: string;
      role_id: string;
    }>;
  }): Promise<ApiResponse<any>> {
    return this.makeRequest('POST', `/api/servers/${serverId}/auto-roles`, settings);
  }

  // General Server Configuration
  async getGeneralSettings(serverId: string): Promise<ApiResponse<{
    language: string;
    timezone: string;
    prefix: string;
    delete_commands: boolean;
    dm_notifications: boolean;
    announcement_channel_id?: string;
    audit_log_channel_id?: string;
  }>> {
    return this.makeRequest('GET', `/api/servers/${serverId}/general-settings`);
  }

  async updateGeneralSettings(serverId: string, settings: {
    language?: string;
    timezone?: string;
    prefix?: string;
    delete_commands?: boolean;
    dm_notifications?: boolean;
    announcement_channel_id?: string;
    audit_log_channel_id?: string;
  }): Promise<ApiResponse<any>> {
    return this.makeRequest('POST', `/api/servers/${serverId}/general-settings`, settings);
  }

  // Auto-Roles Methods
  async getAutoRolesConfig(serverId: string): Promise<ApiResponse<{
    enabled: boolean;
    autoRoles: Array<{
      roleId: string;
      roleName: string;
      level?: number;
      condition: 'join' | 'level' | 'reaction' | 'time';
      description: string;
    }>;
    joinRole: string;
    mutedRole: string;
    modRole: string;
    adminRole: string;
  }>> {
    return this.makeRequest<{
      enabled: boolean;
      autoRoles: Array<{
        roleId: string;
        roleName: string;
        level?: number;
        condition: 'join' | 'level' | 'reaction' | 'time';
        description: string;
      }>;
      joinRole: string;
      mutedRole: string;
      modRole: string;
      adminRole: string;
    }>('GET', `/api/simple-dashboard/server/${serverId}/auto-roles/config`);
  }

  async saveAutoRolesConfig(serverId: string, config: {
    enabled: boolean;
    autoRoles: Array<{
      roleId: string;
      roleName: string;
      level?: number;
      condition: 'join' | 'level' | 'reaction' | 'time';
      description: string;
    }>;
    joinRole: string;
    mutedRole: string;
    modRole: string;
    adminRole: string;
  }): Promise<ApiResponse<{
    message: string;
  }>> {
    return this.makeRequest<{
      message: string;
    }>('POST', `/api/simple-dashboard/server/${serverId}/auto-roles/save-config`, config);
  }
}

export const apiService = new ApiService();
export default apiService;
