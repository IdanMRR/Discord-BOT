import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PermissionGuard from '../components/common/PermissionGuard';
import toast from 'react-hot-toast';
import { formatDashboardLogDate } from '../utils/dateUtils';
import {
  EyeIcon,
  FunnelIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  UserIcon,
  ClockIcon,
  ChatBubbleLeftEllipsisIcon,
  ShieldCheckIcon,
  CommandLineIcon,
  DocumentTextIcon,
  TicketIcon,
  XCircleIcon,
  UserPlusIcon,
  UserMinusIcon,
  TrashIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface LogEntry {
  id: number;
  guild_id?: string;
  user_id?: string;
  userName?: string;
  moderatorId?: string;
  moderatorName?: string;
  action?: string;
  action_type?: string;
  details?: string;
  log_type?: string;
  channel_id?: string;
  target_id?: string;
  reason?: string;
  timestamp?: string;
  created_at: string;
  metadata?: any;
  command?: string;
  success?: number;
  error?: string;
  status?: string;
  category?: string;
  ticket_id?: string;
}

interface LogFilter {
  type: string;
  search: string;
  userId: string;
  dateRange: string;
}

const LOG_TYPES = [
  { value: 'all', label: 'All Logs', icon: EyeIcon },
  { value: 'command', label: 'Commands', icon: CommandLineIcon },
  { value: 'message', label: 'Messages', icon: ChatBubbleLeftEllipsisIcon },
  { value: 'moderation', label: 'Moderation', icon: ShieldCheckIcon },
  { value: 'server', label: 'Server Events', icon: ShieldCheckIcon },
  { value: 'user', label: 'User Activity', icon: UserIcon },
  { value: 'ticket', label: 'Tickets', icon: TicketIcon },
];

// Cache for API results
const logsCache = new Map<string, { data: LogEntry[]; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

const LogsContent: React.FC = () => {
  const { darkMode } = useTheme();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LogFilter>({
    type: 'all',
    search: '',
    userId: '',
    dateRange: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0
  });

  // Refs to prevent duplicate requests
  const requestInProgress = useRef(false);
  const lastRequestTime = useRef(0);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Check if we have cached data for a filter
  const getCachedLogs = useCallback((filterKey: string) => {
    const cached = logsCache.get(filterKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }, []);

  // Set cached data
  const setCachedLogs = useCallback((filterKey: string, data: LogEntry[]) => {
    logsCache.set(filterKey, { data, timestamp: Date.now() });
    // Clean old cache entries
    for (const key of Array.from(logsCache.keys())) {
      const value = logsCache.get(key);
      if (value && Date.now() - value.timestamp > CACHE_DURATION) {
        logsCache.delete(key);
      }
    }
  }, []);

  // Generate cache key for current filter
  const getCacheKey = useCallback((currentFilter: LogFilter) => {
    return `${currentFilter.type}-${currentFilter.search}-${currentFilter.userId}-${currentFilter.dateRange}`;
  }, []);

  const fetchLogs = useCallback(async (isRefresh: boolean = false, forceRefresh: boolean = false) => {
    // Prevent duplicate requests
    if (requestInProgress.current && !forceRefresh) {
      return;
    }

    // Rate limiting - max 1 request per 1 second unless forced
    const now = Date.now();
    if (now - lastRequestTime.current < 1000 && !forceRefresh && !isRefresh) {
      return;
    }

    const cacheKey = getCacheKey(filter);
    
    // Check cache first unless refreshing
    if (!isRefresh && !forceRefresh) {
      const cachedData = getCachedLogs(cacheKey);
      if (cachedData) {
        setLogs(cachedData);
        setLoading(false);
        return;
      }
    }

    try {
      requestInProgress.current = true;
      lastRequestTime.current = now;
      
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let allLogs: LogEntry[] = [];

      try {
        // Batch API calls efficiently
        const apiCalls: Promise<any>[] = [];

        if (filter.type === 'all' || filter.type === 'command') {
          apiCalls.push(apiService.getCommandLogs().then(result => ({ type: 'command', result })));
        }
        if (filter.type === 'all' || filter.type === 'message') {
          apiCalls.push(apiService.getMessageLogs().then(result => ({ type: 'message', result })));
        }
        if (filter.type === 'all' || filter.type === 'moderation') {
          apiCalls.push(apiService.getModerationLogs().then(result => ({ type: 'moderation', result })));
        }
        if (filter.type === 'all' || filter.type === 'server') {
          apiCalls.push(apiService.getServerActivityLogs().then(result => ({ type: 'server', result })));
        }
        if (filter.type === 'all' || filter.type === 'user') {
          apiCalls.push(apiService.getUserActivityLogs().then(result => ({ type: 'user', result })));
        }
        if (filter.type === 'all' || filter.type === 'ticket') {
          apiCalls.push(apiService.getTicketLogs().then(result => ({ type: 'ticket', result })));
        }

        // Execute all API calls in parallel
        const results = await Promise.allSettled(apiCalls);

        // Process results
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const { type, result: apiResult } = result.value;
            if (apiResult.success && apiResult.data) {
              const formattedLogs = apiResult.data.map((log: any) => ({
                ...log,
                log_type: type,
                action: log.action || log.command || `${type} action`,
                action_type: log.action_type || log.action || type
              }));
              allLogs.push(...formattedLogs);
            }
          }
        });

        // Sort logs by timestamp (newest first)
        allLogs.sort((a, b) => {
          const dateA = new Date(a.created_at || a.timestamp || 0).getTime();
          const dateB = new Date(b.created_at || b.timestamp || 0).getTime();
          return dateB - dateA;
        });

        // Apply search filter
        if (filter.search) {
          allLogs = allLogs.filter(log => 
            log.action?.toLowerCase().includes(filter.search.toLowerCase()) ||
            log.details?.toLowerCase().includes(filter.search.toLowerCase()) ||
            log.user_id?.includes(filter.search) ||
            log.command?.toLowerCase().includes(filter.search.toLowerCase())
          );
        }

        // Apply user filter
        if (filter.userId) {
          allLogs = allLogs.filter(log => log.user_id === filter.userId);
        }

        // Apply date filter
        const now = new Date();
        if (filter.dateRange !== 'all') {
          allLogs = allLogs.filter(log => {
            const logDate = new Date(log.created_at || log.timestamp || 0);
            const diffTime = now.getTime() - logDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            switch (filter.dateRange) {
              case 'today':
                return diffDays <= 1;
              case 'week':
                return diffDays <= 7;
              case 'month':
                return diffDays <= 30;
              default:
                return true;
            }
          });
        }

        // Cache the results
        setCachedLogs(cacheKey, allLogs);

        setLogs(allLogs.slice(0, pagination.limit));
        setPagination(prev => ({ ...prev, total: allLogs.length }));

        if (isRefresh) {
          toast.success(`🎉 Refreshed! Found ${allLogs.length} logs`);
        }

      } catch (fetchError) {
        console.error('Error fetching logs:', fetchError);
        setError('Failed to fetch some log types. Some data may be missing.');
      }

    } catch (error: any) {
      console.error('Error in fetchLogs:', error);
      setError(error?.message || 'An unexpected error occurred');
      toast.error('Failed to fetch logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
      requestInProgress.current = false;
    }
  }, [filter, pagination.limit, getCacheKey, getCachedLogs, setCachedLogs]);

  
  // Debounced fetch function for search and filter changes
  const debouncedFetch = useCallback(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      fetchLogs(false, false);
    }, 500); // 500ms debounce
  }, [fetchLogs]);

  useEffect(() => {
    // Initial load without debounce  
    fetchLogs(false, false);
  }, [fetchLogs]); // Include fetchLogs in dependency

  // Debounced effect for filter changes
  useEffect(() => {
    if (filter.type || filter.search || filter.userId || filter.dateRange) {
      debouncedFetch();
    }
    
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [filter, debouncedFetch]);

  // Memoized filtered logs to prevent unnecessary re-renders
  const displayLogs = useMemo(() => {
    return logs.slice(0, pagination.limit);
  }, [logs, pagination.limit]);

  const getLogIcon = (logType: string, actionType: string) => {
    switch (logType) {
      case 'command':
        return <CommandLineIcon className="h-5 w-5 text-blue-500" />;
      case 'message':
        if (actionType?.includes('delete')) {
          return <TrashIcon className="h-5 w-5 text-red-500" />;
        }
        return <DocumentTextIcon className="h-5 w-5 text-yellow-500" />;
      case 'moderation':
        return <ShieldCheckIcon className="h-5 w-5 text-orange-500" />;
      case 'server':
        return <ShieldCheckIcon className="h-5 w-5 text-purple-500" />;
      case 'user':
        if (actionType?.includes('Join')) {
          return <UserPlusIcon className="h-5 w-5 text-green-500" />;
        }
        return <UserMinusIcon className="h-5 w-5 text-red-500" />;
      case 'ticket':
        if (actionType?.includes('closed')) {
          return <XCircleIcon className="h-5 w-5 text-red-500" />;
        } else if (actionType?.includes('created')) {
          return <TicketIcon className="h-5 w-5 text-green-500" />;
        }
        return <DocumentTextIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <EyeIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getLogTypeColor = (logType: string) => {
    switch (logType) {
      case 'command':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'message':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'moderation':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'server':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'user':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'ticket':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };


  const handleRefresh = () => {
    fetchLogs(true, true);
  };

  if (loading) {
    return (
      <div className={classNames(
        "min-h-screen p-6",
        darkMode ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <LoadingSpinner size="lg" className="text-blue-500" />
            <p className={classNames(
              "mt-4 text-lg font-medium",
              darkMode ? "text-gray-300" : "text-gray-600"
            )}>Loading logs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={classNames("space-y-8", darkMode ? "bg-gray-900" : "bg-gray-50")}>
      {/* Professional Header Section */}
      <div className="relative">
        <div className="relative flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className={classNames(
              "p-4 rounded-lg border transition-colors",
              darkMode 
                ? "bg-gray-800 border-gray-700" 
                : "bg-white border-gray-200"
            )}>
              <EyeIcon className={classNames(
                "h-8 w-8",
                darkMode ? "text-slate-400" : "text-slate-600"
              )} />
            </div>
            <div>
              <h1 className={classNames(
                "text-4xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                Activity Logs
              </h1>
              <p className={classNames(
                "text-lg font-medium mt-2",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Monitor all bot activities and server events in real-time
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={classNames(
                "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium border transition-colors",
                darkMode 
                  ? "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700" 
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              )}
            >
              <FunnelIcon className="h-5 w-5" />
              <span>Filters</span>
              <ChevronDownIcon className={classNames(
                "h-4 w-4 transition-transform duration-200",
                showFilters ? "rotate-180" : ""
              )} />
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={classNames(
                "flex items-center space-x-2 px-6 py-3 rounded-lg font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                darkMode 
                  ? "bg-primary-600 border-primary-600 text-white hover:bg-primary-700" 
                  : "bg-primary-600 border-primary-600 text-white hover:bg-primary-700"
              )}
            >
              <ArrowPathIcon className={classNames(
                "h-5 w-5",
                refreshing ? "animate-spin" : ""
              )} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode 
            ? "bg-gray-800 border-gray-700" 
            : "bg-white border-gray-200"
        )}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Log Type Filter */}
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Log Type
              </label>
              <select
                value={filter.type}
                onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
                className={classNames(
                  "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors",
                  darkMode 
                    ? "bg-gray-700 text-gray-100 border-gray-600" 
                    : "bg-white text-gray-900 border-gray-300"
                )}
              >
                {LOG_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Search
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filter.search}
                  onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Search logs..."
                  className={classNames(
                    "w-full pl-10 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors",
                    darkMode 
                      ? "bg-gray-700 text-gray-100 border-gray-600 placeholder-gray-400" 
                      : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                  )}
                />
              </div>
            </div>

            {/* User ID Filter */}
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                User ID
              </label>
              <input
                type="text"
                value={filter.userId}
                onChange={(e) => setFilter(prev => ({ ...prev, userId: e.target.value }))}
                placeholder="Filter by user ID..."
                className={classNames(
                  "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors",
                  darkMode 
                    ? "bg-gray-700 text-gray-100 border-gray-600 placeholder-gray-400" 
                    : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                )}
              />
            </div>

            {/* Date Range Filter */}
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Date Range
              </label>
              <select
                value={filter.dateRange}
                onChange={(e) => setFilter(prev => ({ ...prev, dateRange: e.target.value }))}
                className={classNames(
                  "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors",
                  darkMode 
                    ? "bg-gray-700 text-gray-100 border-gray-600" 
                    : "bg-white text-gray-900 border-gray-300"
                )}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setFilter({ type: 'all', search: '', userId: '', dateRange: 'all' })}
              className={classNames(
                "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium border transition-colors",
                darkMode 
                  ? "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600" 
                  : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
              )}
            >
              <XMarkIcon className="h-4 w-4" />
              <span>Clear Filters</span>
            </button>
          </div>
        </div>
      )}

      {/* Logs Container */}
      <div className={classNames(
        "rounded-lg border overflow-hidden",
        darkMode 
          ? "bg-gray-800 border-gray-700" 
          : "bg-white border-gray-200"
      )}>
        <div className={classNames(
          "px-8 py-6 border-b",
          darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
        )}>
          <div className="flex items-center justify-between">
            <h3 className={classNames(
              "text-2xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Activity Logs
            </h3>
            <span className={classNames(
              "px-4 py-2 rounded-lg font-medium text-sm border",
              darkMode ? "bg-gray-700 border-gray-600 text-gray-300" : "bg-gray-100 border-gray-200 text-gray-600"
            )}>
              {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        </div>

        <div className="p-8">
          {error ? (
            <div className="text-center py-16">
              <div className={classNames(
                "w-16 h-16 mx-auto mb-6 rounded-lg border flex items-center justify-center",
                darkMode ? "border-red-700 bg-red-900/20" : "border-red-200 bg-red-50"
              )}>
                <XCircleIcon className={classNames(
                  "h-8 w-8",
                  darkMode ? "text-red-400" : "text-red-500"
                )} />
              </div>
              <h3 className={classNames(
                "text-2xl font-bold mb-4",
                darkMode ? "text-red-400" : "text-red-500"
              )}>Something went wrong</h3>
              <p className={classNames(
                "text-lg mb-6 max-w-md mx-auto",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>{error}</p>
              <button
                onClick={handleRefresh}
                className={classNames(
                  "inline-flex items-center space-x-2 px-6 py-3 rounded-lg font-medium border transition-colors",
                  darkMode 
                    ? "bg-primary-600 border-primary-600 text-white hover:bg-primary-700" 
                    : "bg-primary-600 border-primary-600 text-white hover:bg-primary-700"
                )}
              >
                <ArrowPathIcon className="h-5 w-5" />
                <span>Try Again</span>
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <div className={classNames(
                "w-16 h-16 mx-auto mb-6 rounded-lg border flex items-center justify-center",
                darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
              )}>
                <DocumentTextIcon className={classNames(
                  "h-8 w-8",
                  darkMode ? "text-gray-400" : "text-gray-500"
                )} />
              </div>
              <h3 className={classNames(
                "text-2xl font-bold mb-4",
                darkMode ? "text-white" : "text-gray-900"
              )}>No logs found</h3>
              <p className={classNames(
                "text-lg mb-6 max-w-md mx-auto",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                No activity logs match your current filters. Try adjusting your search criteria.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayLogs.map((log, index) => (
                <div key={`${log.id}-${index}`} className={classNames(
                  "relative p-6 rounded-lg border transition-colors",
                  darkMode 
                    ? "border-gray-700 bg-gray-800 hover:border-gray-600" 
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}>
                  <div className="flex items-start space-x-4">
                    {/* Log Icon */}
                    <div className={classNames(
                      "flex-shrink-0 p-2 rounded-lg border",
                      darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-100 border-gray-200"
                    )}>
                      {getLogIcon(log.log_type || 'general', log.action_type || log.action || '')}
                    </div>

                    {/* Log Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className={classNames(
                              "font-semibold text-lg",
                              darkMode ? "text-white" : "text-gray-900"
                            )}>
                              {log.action || log.command || 'Unknown Action'}
                            </h4>
                            <span className={classNames(
                              "px-2 py-1 rounded-lg text-xs font-medium border",
                              getLogTypeColor(log.log_type || 'general')
                            )}>
                              {log.log_type || 'general'}
                            </span>
                          </div>

                          {/* Log Details */}
                          <div className="space-y-2">
                            {(log.userName || log.user_id) && (
                              <div className="flex items-center space-x-2">
                                <UserIcon className="h-4 w-4 text-gray-400" />
                                <span className={classNames(
                                  "text-sm",
                                  darkMode ? "text-gray-300" : "text-gray-600"
                                )}>
                                  User: {log.userName || log.user_id}
                                </span>
                              </div>
                            )}

                            {(log.moderatorName || log.moderatorId) && (
                              <div className="flex items-center space-x-2">
                                <ShieldCheckIcon className="h-4 w-4 text-primary-400" />
                                <span className={classNames(
                                  "text-sm",
                                  darkMode ? "text-gray-300" : "text-gray-600"
                                )}>
                                  Moderator: {log.moderatorName || log.moderatorId}
                                </span>
                              </div>
                            )}

                            {log.channel_id && (
                              <div className="flex items-center space-x-2">
                                <ChatBubbleLeftEllipsisIcon className="h-4 w-4 text-gray-400" />
                                <span className={classNames(
                                  "text-sm",
                                  darkMode ? "text-gray-300" : "text-gray-600"
                                )}>
                                  Channel: {log.channel_id}
                                </span>
                              </div>
                            )}

                            {log.details && (
                              <div className="space-y-1">
                                <p className={classNames(
                                  "text-sm font-medium",
                                  darkMode ? "text-gray-300" : "text-gray-600"
                                )}>
                                  {typeof log.details === 'string' 
                                    ? log.details 
                                    : 'Ticket activity'
                                  }
                                </p>
                                
                                {/* Only show JSON for debugging if it's an object and not parsed properly */}
                                {typeof log.details === 'object' && log.details !== null && typeof log.details !== 'string' && (
                                  <details className="mt-2">
                                    <summary className={classNames(
                                      "cursor-pointer text-xs font-mono",
                                      darkMode ? "text-gray-500" : "text-gray-400"
                                    )}>
                                      Show raw data
                                    </summary>
                                    <div className={classNames(
                                      "mt-2 p-3 rounded-lg font-mono text-xs overflow-x-auto border",
                                      darkMode ? "bg-gray-700 border-gray-600 text-gray-300" : "bg-gray-100 border-gray-200 text-gray-700"
                                    )}>
                                      <pre className="whitespace-pre-wrap">
                                        {JSON.stringify(log.details, null, 2)}
                                      </pre>
                                    </div>
                                  </details>
                                )}
                              </div>
                            )}

                            {log.reason && (
                              <div className="flex items-start space-x-2">
                                <XCircleIcon className="h-4 w-4 text-yellow-500 mt-0.5" />
                                <p className={classNames(
                                  "text-sm font-medium",
                                  darkMode ? "text-yellow-400" : "text-yellow-600"
                                )}>
                                  Reason: {log.reason}
                                </p>
                              </div>
                            )}

                            {log.error && (
                              <div className="flex items-start space-x-2">
                                <XCircleIcon className="h-4 w-4 text-red-500 mt-0.5" />
                                <p className={classNames(
                                  "text-sm font-medium",
                                  darkMode ? "text-red-400" : "text-red-600"
                                )}>
                                  Error: {log.error}
                                </p>
                              </div>
                            )}
                            
                            {/* Additional log metadata */}
                            {log.ticket_id && (
                              <div className="flex items-center space-x-2">
                                <TicketIcon className="h-4 w-4 text-primary-400" />
                                <span className={classNames(
                                  "text-sm",
                                  darkMode ? "text-gray-300" : "text-gray-600"
                                )}>
                                  Ticket ID: {log.ticket_id}
                                </span>
                              </div>
                            )}
                            
                            {log.command && (
                              <div className="flex items-center space-x-2">
                                <CommandLineIcon className="h-4 w-4 text-blue-400" />
                                <span className={classNames(
                                  "text-sm font-mono",
                                  darkMode ? "text-blue-300" : "text-blue-600"
                                )}>
                                  /{log.command}
                                </span>
                              </div>
                            )}
                            
                            {/* Success/Error indicators for commands */}
                            {log.success !== undefined && (
                              <div className="flex items-center space-x-2">
                                {log.success ? (
                                  <>
                                    <CheckIcon className="h-4 w-4 text-green-400" />
                                    <span className={classNames(
                                      "text-sm",
                                      darkMode ? "text-green-400" : "text-green-600"
                                    )}>
                                      Command executed successfully
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <XCircleIcon className="h-4 w-4 text-red-400" />
                                    <span className={classNames(
                                      "text-sm",
                                      darkMode ? "text-red-400" : "text-red-600"
                                    )}>
                                      Command failed
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center space-x-2 text-right">
                          <ClockIcon className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className={classNames(
                              "text-sm font-medium",
                              darkMode ? "text-gray-300" : "text-gray-600"
                            )}>
                              {formatDashboardLogDate(log.created_at || log.timestamp || '')}
                            </p>
                            <p className={classNames(
                              "text-xs",
                              darkMode ? "text-gray-500" : "text-gray-400"
                            )}>
                              {new Date(log.created_at || log.timestamp || '').toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Logs: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['view_logs', 'admin']}
      fallbackMessage="You need log viewing permissions to access system logs."
    >
      <LogsContent />
    </PermissionGuard>
  );
};

export default Logs;