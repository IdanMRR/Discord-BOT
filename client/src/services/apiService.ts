import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { environment, detectApiUrl } from '../config/environment';
import { ApiResponse } from '../types/api';

// Enhanced logger for API service
const logger = {
  debug: (message: string, data?: any) => {
    if (environment.features.enableLogging) {
      console.log(`[API Debug] ${message}`, data);
    }
  },
  error: (message: string, data?: any) => {
    console.error(`[API Error] ${message}`, data);
  },
  warn: (message: string, data?: any) => {
    console.warn(`[API Warning] ${message}`, data);
  }
};

// Request deduplication system
interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly requestTimeout = 30000; // 30 seconds

  private generateKey(method: string, url: string, data?: any): string {
    const dataStr = data ? JSON.stringify(data) : '';
    return `${method.toUpperCase()}:${url}:${dataStr}`;
  }

  private cleanupExpiredRequests(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.requestTimeout) {
        this.pendingRequests.delete(key);
      }
    }
  }

  async deduplicate<T>(
    method: string,
    url: string,
    requestFn: () => Promise<T>,
    data?: any
  ): Promise<T> {
    this.cleanupExpiredRequests();
    
    const key = this.generateKey(method, url, data);
    const existing = this.pendingRequests.get(key);
    
    if (existing) {
      logger.debug('Deduplicating request', { method, url });
      return existing.promise;
    }

    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });

    return promise;
  }

  clear(): void {
    this.pendingRequests.clear();
  }
}

// Retry logic with exponential backoff
class RetryHandler {
  async withRetry<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on authentication errors or client errors (4xx)
        if (error.response?.status === 401 || 
            error.response?.status === 403 ||
            (error.response?.status >= 400 && error.response?.status < 500)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        logger.debug(`Request failed, retrying in ${delay}ms`, { 
          attempt: attempt + 1, 
          maxRetries, 
          error: error.message 
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}

// Enhanced API Service
class EnhancedApiService {
  private api: AxiosInstance;
  private deduplicator = new RequestDeduplicator();
  private retryHandler = new RetryHandler();
  private isInitialized = false;

  constructor() {
    this.api = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const baseURL = await detectApiUrl();
      this.api.defaults.baseURL = baseURL;
      this.isInitialized = true;
      logger.debug('API service initialized', { baseURL });
    } catch (error) {
      logger.error('Failed to initialize API service', error);
      // Fallback to default URL
      this.api.defaults.baseURL = environment.API_URL;
      this.isInitialized = true;
    }
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        // Add authentication token
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add API key from environment
        const apiKey = environment.API_KEY;
        if (apiKey) {
          config.headers['x-api-key'] = apiKey;
        }
        
        // Add user ID from token for server-specific permissions
        try {
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.userId) {
              config.headers['x-user-id'] = payload.userId;
            }
          }
        } catch (error) {
          logger.warn('Could not extract user ID from token', error);
        }
        
        // Add request ID for tracking
        config.headers['x-request-id'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        logger.debug('Request starting', {
          method: config.method?.toUpperCase(),
          url: config.url,
          requestId: config.headers['x-request-id']
        });
        
        return config;
      },
      (error) => {
        logger.error('Request configuration failed', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug('Response received', {
          status: response.status,
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          requestId: response.config.headers['x-request-id']
        });
        return response;
      },
      (error: AxiosError) => {
        this.handleResponseError(error);
        return Promise.reject(error);
      }
    );
  }

  private handleResponseError(error: AxiosError): void {
    const status = error.response?.status;
    const requestId = error.config?.headers?.['x-request-id'];
    
    logger.error('Request failed', {
      status,
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      requestId,
      message: error.message
    });

    // Handle authentication errors
    if (status === 401) {
      localStorage.removeItem('auth_token');
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    // Handle rate limiting
    if (status === 429) {
      const retryAfter = error.response?.headers['retry-after'];
      logger.warn('Rate limited', { retryAfter });
    }
  }

  // Generic request method with deduplication and retry
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any,
    options: {
      skipAuth?: boolean;
      skipRetry?: boolean;
      skipDeduplication?: boolean;
      timeout?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    await this.initialize();

    const {
      skipAuth = false,
      skipRetry = false,
      skipDeduplication = false,
      timeout
    } = options;

    const requestFn = async () => {
      const config: any = {
        method,
        url,
        timeout: timeout || this.api.defaults.timeout,
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.data = data;
      } else if (data && method === 'GET') {
        config.params = data;
      }

      if (skipAuth) {
        config.headers = { ...config.headers };
        delete config.headers.Authorization;
      }

      const response = await this.api.request<ApiResponse<T>>(config);
      return response.data;
    };

    try {
      if (skipDeduplication) {
        if (skipRetry) {
          return await requestFn();
        } else {
          return await this.retryHandler.withRetry(requestFn);
        }
      } else {
        const finalRequestFn = skipRetry ? requestFn : () => this.retryHandler.withRetry(requestFn);
        return await this.deduplicator.deduplicate(method, url, finalRequestFn, data);
      }
    } catch (error: any) {
      // Normalize error response
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Request failed';
      
      return {
        success: false,
        error: errorMessage,
        data: null
      } as ApiResponse<T>;
    }
  }

  // Public API methods
  get<T>(url: string, params?: any, options?: any): Promise<ApiResponse<T>> {
    return this.request<T>('GET', url, params, options);
  }

  post<T>(url: string, data?: any, options?: any): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, data, options);
  }

  put<T>(url: string, data?: any, options?: any): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, data, options);
  }

  delete<T>(url: string, options?: any): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  // Authentication methods
  setAuthToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  clearAuth(): void {
    localStorage.removeItem('auth_token');
  }

  logout(): void {
    this.clearAuth();
    this.deduplicator.clear();
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/api/status', {}, { 
        skipAuth: true, 
        skipRetry: false,
        timeout: 5000 
      });
      return response.success;
    } catch (error) {
      return false;
    }
  }

  // Dashboard logs methods
  async getDashboardLogs(filters?: {
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
      totalPages: number;
    };
  }>> {
    return this.get('/api/dashboard-logs', filters);
  }

  async createDashboardLog(logData: {
    user_id: string;
    username: string;
    action_type: string;
    page: string;
    target_type?: string;
    target_id?: string;
    old_value?: string;
    new_value?: string;
    details?: string;
    success: boolean;
    error_message?: string;
    guild_id?: string;
  }): Promise<ApiResponse<any>> {
    return this.post('/api/dashboard-logs', logData);
  }

  async deleteDashboardLogs(logIds: number[]): Promise<ApiResponse<any>> {
    return this.delete('/api/dashboard-logs', { 
      skipDeduplication: true,
      data: { ids: logIds }
    });
  }

  async exportDashboardLogs(filters?: any, format: 'csv' | 'json' = 'csv'): Promise<ApiResponse<{
    data: string;
    filename: string;
  }>> {
    return this.get('/api/dashboard-logs/export', { ...filters, format });
  }

  // Cleanup method
  destroy(): void {
    this.deduplicator.clear();
  }
}

// Create and export service instance
export const enhancedApiService = new EnhancedApiService();

// Initialize on module load
enhancedApiService.initialize().catch(error => {
  logger.error('Failed to initialize enhanced API service', error);
});

export default enhancedApiService;