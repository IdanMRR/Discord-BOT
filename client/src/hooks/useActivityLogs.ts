import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import { wsService } from '../services/websocket';
import { useQuery } from './useDataFetching';
import { ActivityLog } from '../types';

interface ApiActivityLog {
  id: number;
  user_id: string;
  username: string;
  action_type: string;
  page: string;
  target_type?: string;
  target_id?: string;
  old_value?: string;
  new_value?: string;
  ip_address?: string;
  user_agent?: string;
  details?: string;
  success: boolean;
  error_message?: string;
  guild_id?: string;
  created_at: string;
}

interface ActivityLogFilters {
  userId?: string;
  actionType?: string;
  guildId?: string;
  page?: number;
  limit?: number;
}

interface ActivityLogResponse {
  logs: ActivityLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Helper function to map API response to expected format
function mapApiLogToActivityLog(apiLog: ApiActivityLog): ActivityLog {
  return {
    id: apiLog.id.toString(),
    type: apiLog.action_type,
    user: apiLog.username || `User ${apiLog.user_id?.slice(-4) || 'Unknown'}`,
    description: apiLog.details || `${apiLog.action_type} on ${apiLog.page}`,
    details: apiLog.details,
    timestamp: apiLog.created_at,
    serverId: apiLog.guild_id,
    serverName: apiLog.page // Use the enhanced readable page name from backend
  };
}

interface UseActivityLogsOptions {
  filters?: ActivityLogFilters;
  realTimeUpdates?: boolean;
  autoRefresh?: number; // Refresh interval in ms
}

export function useActivityLogs(options: UseActivityLogsOptions = {}) {
  const { filters = {}, realTimeUpdates = true, autoRefresh } = options;
  const [realtimeLogs, setRealtimeLogs] = useState<ActivityLog[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Create query key from filters
  const queryKey = `activity-logs-${JSON.stringify(filters)}`;

  // Stable fetch function
  const fetchLogs = useCallback(async (): Promise<ActivityLogResponse> => {
    const response = await apiService.getDashboardLogs(filters);
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch activity logs');
    }
    
    // Map API response to expected format
    const apiData = response.data as {
      logs: ApiActivityLog[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
      };
    };
    
    return {
      logs: apiData.logs.map(mapApiLogToActivityLog),
      pagination: {
        ...apiData.pagination,
        totalPages: apiData.pagination.pages
      }
    };
  }, [filters]); // Use filters directly as dependency

  // Use query hook for caching and state management
  const query = useQuery(queryKey, fetchLogs, {
    staleTime: 60 * 1000, // 60 seconds (longer than auto-refresh to prevent conflicts)
    refetchOnFocus: false // Disable auto-refetch on focus to prevent duplicate requests
  });

  // Stable refetch function with query dependency
  const refetchLogs = useCallback(() => {
    query.refetch();
  }, [query]);

  // Set up real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    // Subscribe to WebSocket updates
    const unsubscribe = wsService.on('dashboard_log_created', (newApiLog: ApiActivityLog) => {
      // Check if log matches current filters
      const matchesFilters = (
        (!filters.userId || newApiLog.user_id === filters.userId) &&
        (!filters.actionType || newApiLog.action_type === filters.actionType) &&
        (!filters.guildId || newApiLog.guild_id === filters.guildId)
      );

      if (matchesFilters) {
        const mappedLog = mapApiLogToActivityLog(newApiLog);
        setRealtimeLogs(prev => [mappedLog, ...prev]);
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [filters, realTimeUpdates]);

  // Set up auto-refresh with stable dependency
  useEffect(() => {
    if (!autoRefresh) return;

    // Clear any existing interval first
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
    }

    autoRefreshRef.current = setInterval(() => {
      refetchLogs();
    }, autoRefresh);

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [autoRefresh, refetchLogs]);

  // Combine fetched logs with real-time logs
  const combinedLogs = useCallback(() => {
    if (!query.data) return [];

    const fetchedLogs = query.data.logs || [];
    
    // Merge real-time logs with fetched logs, removing duplicates
    const allLogs = [...realtimeLogs, ...fetchedLogs];
    const uniqueLogs = allLogs.filter((log, index, self) => 
      index === self.findIndex(l => l.id === log.id)
    );

    // Sort by timestamp (newest first)
    return uniqueLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [query.data, realtimeLogs]);

  // Clean up real-time logs when filters change
  useEffect(() => {
    setRealtimeLogs([]);
  }, [queryKey]);

  return {
    logs: combinedLogs(),
    loading: query.loading,
    error: query.error,
    pagination: query.data?.pagination,
    refetch: query.refetch,
    invalidate: query.invalidate,
    hasNewLogs: realtimeLogs.length > 0
  };
}

// Hook for creating activity logs
export function useCreateActivityLog() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLog = useCallback(async (logData: Partial<ActivityLog> | Partial<ApiActivityLog>) => {
    try {
      setLoading(true);
      setError(null);

      // Convert ActivityLog format to ApiActivityLog format if needed
      let apiLogData: Partial<ApiActivityLog>;
      
      if ('type' in logData && 'user' in logData) {
        // Input is in ActivityLog format, convert to ApiActivityLog
        apiLogData = {
          action_type: logData.type,
          username: logData.user,
          page: 'dashboard', // default page
          details: logData.description,
          guild_id: logData.serverId,
          success: true, // default success
          created_at: logData.timestamp || new Date().toISOString()
        };
      } else {
        // Input is already in ApiActivityLog format
        apiLogData = logData as Partial<ApiActivityLog>;
      }

      // Ensure required fields are present
      if (!apiLogData.username || !apiLogData.action_type || !apiLogData.page || apiLogData.success === undefined) {
        throw new Error('Missing required fields for activity log');
      }

      const response = await apiService.createDashboardLog(apiLogData as Required<Pick<ApiActivityLog, 'username' | 'action_type' | 'page' | 'success'>> & Partial<ApiActivityLog>);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create activity log');
      }

      return response.data;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create activity log';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createLog,
    loading,
    error
  };
}

// Hook for batch operations on activity logs
export function useBatchActivityLogs() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteMultipleLogs = useCallback(async (logIds: number[]) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.deleteDashboardLogs(logIds);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete logs');
      }

      return response.data;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete logs';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const exportLogs = useCallback(async (filters: ActivityLogFilters, format: 'csv' | 'json' = 'csv') => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.exportDashboardLogs(filters, format);
      if (!response.success) {
        throw new Error(response.error || 'Failed to export logs');
      }

      // Create download link
      const blob = new Blob([response.data?.data || ''], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', response.data?.filename || `activity-logs-${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to export logs';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    deleteMultipleLogs,
    exportLogs,
    loading,
    error
  };
}