import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PermissionGuard from '../components/common/PermissionGuard';
import toast from 'react-hot-toast';

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
  { value: 'member', label: 'Member Events', icon: UserIcon },
  { value: 'verification', label: 'Verification', icon: CheckIcon },
  { value: 'warning', label: 'Warnings', icon: XCircleIcon },
  { value: 'giveaway', label: 'Giveaways', icon: TicketIcon },
  { value: 'levelup', label: 'Level Ups', icon: UserPlusIcon },
  { value: 'automod', label: 'AutoMod', icon: ShieldCheckIcon },
  { value: 'server', label: 'Server Events', icon: ShieldCheckIcon },
  { value: 'ticket', label: 'Tickets', icon: TicketIcon },
];

// Cache for API results
const logsCache = new Map<string, { data: LogEntry[]; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

const LogsContent: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
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
        // Get server-specific logs
        if (!serverId) {
          throw new Error('No server ID provided');
        }

        console.log('Fetching server logs for serverId:', serverId);
        
        const response = await apiService.getServerLogs({
          guildId: serverId,
          page: 1,
          limit: 1000,
          userId: filter.userId || undefined
        });

        console.log('Server logs response:', response);

        if (response.success && response.data) {
          allLogs = response.data.map((log: any) => {
            // Determine proper log type based on action/command
            let logType = log.log_type || 'server';
            
            // Comprehensive categorization system
            if (log.command) {
              const cmd = log.command.toLowerCase();
              
              // Warning Commands
              if (cmd === 'warn' || cmd === 'warning' || cmd === 'removewarn') {
                logType = 'warning';
              }
              // Moderation Commands  
              else if (['ban', 'kick', 'timeout', 'mute', 'unmute', 'unban', 'tempban'].includes(cmd)) {
                logType = 'moderation';
              }
              // Ticket Commands
              else if (['ticket', 'close', 'add', 'remove', 'claim', 'unclaim'].includes(cmd)) {
                logType = 'ticket';
              }
              // Giveaway Commands
              else if (['giveaway', 'gstart', 'gend', 'greroll', 'gcancel'].includes(cmd)) {
                logType = 'giveaway';
              }
              // Level/XP Commands
              else if (['rank', 'leaderboard', 'setlevel', 'addxp', 'removexp'].includes(cmd)) {
                logType = 'levelup';
              }
              // General Commands
              else if (['help', 'ping', 'info', 'serverinfo', 'userinfo', 'avatar', 'invite'].includes(cmd)) {
                logType = 'command';
              }
              // Verification Commands
              else if (['verify', 'verification'].includes(cmd)) {
                logType = 'verification';
              }
            } 
            // Categorize by action/event type
            else if (log.action) {
              const action = log.action.toLowerCase();
              
              // Warning Events
              if (action.includes('warn')) {
                logType = 'warning';
              }
              // Moderation Events
              else if (action.includes('ban') || action.includes('kick') || action.includes('timeout') || action.includes('mute')) {
                logType = 'moderation';
              }
              // Member Events
              else if (action.includes('join') || action.includes('leave') || action.includes('member')) {
                logType = 'member';
              }
              // Verification Events
              else if (action.includes('verify') || action.includes('verification')) {
                logType = 'verification';
              }
              // Message Events
              else if (action.includes('message') || action.includes('edit') || action.includes('delete')) {
                logType = 'message';
              }
              // Ticket Events
              else if (action.includes('ticket') || action.includes('close') || action.includes('create')) {
                logType = 'ticket';
              }
              // Giveaway Events
              else if (action.includes('giveaway') || action.includes('raffle')) {
                logType = 'giveaway';
              }
              // Level Events
              else if (action.includes('level') || action.includes('xp') || action.includes('rank')) {
                logType = 'levelup';
              }
              // AutoMod Events
              else if (action.includes('automod') || action.includes('auto') || action.includes('filter')) {
                logType = 'automod';
              }
            }
            // Categorize by log details/metadata
            else if (log.details) {
              const details = (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)).toLowerCase();
              
              if (details.includes('warn')) {
                logType = 'warning';
              } else if (details.includes('ticket')) {
                logType = 'ticket';
              } else if (details.includes('giveaway')) {
                logType = 'giveaway';
              } else if (details.includes('level') || details.includes('xp')) {
                logType = 'levelup';
              }
            }
            
            return {
              ...log,
              log_type: logType,
              action: log.action || log.action_type || 'action',
              action_type: log.action_type || log.action || logType
            };
          });
          
          // Debug: Log first few entries to see timestamps
          console.log('Sample log timestamps:', allLogs.slice(0, 5).map(log => ({
            id: log.id,
            action: log.action,
            created_at: log.created_at,
            timestamp: log.timestamp,
            dateValid: !isNaN(new Date(log.created_at || log.timestamp || '').getTime())
          })));
        } else {
          console.error('Failed to fetch logs:', response.error);
          throw new Error(response.error || 'Failed to fetch logs');
        }

        // Don't filter out logs - show all logs even if they have date issues
        console.log('Total logs fetched:', allLogs.length);
        
        // Sort logs by timestamp (newest first) - put logs with invalid dates at the end
        allLogs.sort((a, b) => {
          const getValidTimestamp = (log: any) => {
            const dateStr = log.created_at || log.timestamp;
            if (!dateStr) return -1; // Put entries without dates at the end
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? -1 : date.getTime(); // Put invalid dates at the end
          };
          
          const dateA = getValidTimestamp(a);
          const dateB = getValidTimestamp(b);
          
          // If both have invalid dates, maintain original order
          if (dateA === -1 && dateB === -1) return 0;
          // If only A is invalid, put B first
          if (dateA === -1) return 1;
          // If only B is invalid, put A first  
          if (dateB === -1) return -1;
          // Both are valid, sort by newest first
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

        // Apply date filter with proper date validation - but don't exclude logs with no dates
        const now = new Date();
        if (filter.dateRange !== 'all') {
          allLogs = allLogs.filter(log => {
            const dateStr = log.created_at || log.timestamp;
            if (!dateStr) return true; // Include entries without dates when filtering
            
            const logDate = new Date(dateStr);
            if (isNaN(logDate.getTime())) return true; // Include invalid dates when filtering
            
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
  }, [filter, pagination.limit, getCacheKey, getCachedLogs, setCachedLogs, serverId]);

  
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
        if (actionType?.includes('Ban')) {
          return <XCircleIcon className="h-5 w-5 text-red-600" />;
        } else if (actionType?.includes('Kick')) {
          return <UserMinusIcon className="h-5 w-5 text-orange-500" />;
        } else if (actionType?.includes('Timeout')) {
          return <ClockIcon className="h-5 w-5 text-yellow-500" />;
        }
        return <ShieldCheckIcon className="h-5 w-5 text-orange-500" />;
      case 'member':
        if (actionType?.includes('joined')) {
          return <UserPlusIcon className="h-5 w-5 text-green-500" />;
        }
        return <UserMinusIcon className="h-5 w-5 text-red-500" />;
      case 'verification':
        if (actionType?.includes('Success')) {
          return <CheckIcon className="h-5 w-5 text-green-500" />;
        }
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <XCircleIcon className="h-5 w-5 text-amber-500" />;
      case 'giveaway':
        return <TicketIcon className="h-5 w-5 text-pink-500" />;
      case 'levelup':
        return <UserIcon className="h-5 w-5 text-green-400" />;
      case 'automod':
        return <ShieldCheckIcon className="h-5 w-5 text-purple-500" />;
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
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'member':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'verification':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
      case 'warning':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'giveaway':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
      case 'levelup':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'automod':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
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

                            {((log.moderatorName || log.moderatorId) || 
                              (log.action && (log.action.toLowerCase().includes('auto') || log.action.toLowerCase().includes('timeout') || log.action.toLowerCase().includes('ban') || log.action.toLowerCase().includes('kick')))) && (
                              <div className="flex items-center space-x-2">
                                <ShieldCheckIcon className="h-4 w-4 text-primary-400" />
                                <span className={classNames(
                                  "text-sm",
                                  darkMode ? "text-gray-300" : "text-gray-600"
                                )}>
                                  Moderator: {log.moderatorId === 'dashboard' || log.moderatorId === 'system' || log.moderatorId === 'automod' || 
                                             log.moderatorName === 'dashboard' || log.moderatorName === 'system' || log.moderatorName === 'automod' ||
                                             (log.moderatorName && log.moderatorName.startsWith('User_')) ||
                                             (log.moderatorId && log.moderatorId.startsWith('User_')) ||
                                             (log.action && (log.action.toLowerCase().includes('auto') || log.action.toLowerCase().includes('timeout') || log.action.toLowerCase().includes('ban') || log.action.toLowerCase().includes('kick')) && (!log.moderatorName || log.moderatorName.startsWith('User_') || !log.moderatorId || log.moderatorId.startsWith('User_'))) ||
                                             (log.details && log.details.toLowerCase().includes('automatic'))
                                             ? 'AutoMod System' : (log.moderatorName || log.moderatorId || 'Unknown')}
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
                              {(() => {
                                const dateStr = log.created_at || log.timestamp;
                                if (!dateStr || dateStr === 'null' || dateStr === 'undefined') {
                                  return 'Unknown time';
                                }
                                
                                try {
                                  // More robust date parsing
                                  let date: Date;
                                  
                                  // Handle timestamp as number (milliseconds)
                                  if (!isNaN(Number(dateStr)) && Number(dateStr) > 1000000000000) {
                                    date = new Date(Number(dateStr));
                                  }
                                  // Handle timestamp as number (seconds)
                                  else if (!isNaN(Number(dateStr)) && Number(dateStr) > 1000000000) {
                                    date = new Date(Number(dateStr) * 1000);
                                  }
                                  // Handle formatted timestamps (DD/MM/YYYY, HH:mm:ss) or (DD.MM.YYYY, HH:mm:ss)
                                  else if (dateStr.match(/^\d{2}[/.]\d{2}[/.]\d{4}, \d{2}:\d{2}:\d{2}$/)) {
                                    const [datePart, timePart] = dateStr.split(', ');
                                    const [day, month, year] = datePart.split(/[/.]/);
                                    date = new Date(`${year}-${month}-${day}T${timePart}.000Z`);
                                  }
                                  // Handle ISO format
                                  else if (dateStr.includes('T') || dateStr.includes('Z')) {
                                    date = new Date(dateStr);
                                  }
                                  // Handle SQLite format (YYYY-MM-DD HH:MM:SS)
                                  else if (dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                                    date = new Date(dateStr + 'Z');
                                  }
                                  // Generic fallback
                                  else {
                                    date = new Date(dateStr);
                                  }
                                  
                                  // Check if date is valid
                                  if (isNaN(date.getTime())) {
                                    return `Invalid: ${dateStr}`;
                                  }
                                  
                                  // Calculate relative time
                                  const now = new Date();
                                  const diffTime = now.getTime() - date.getTime();
                                  const diffMinutes = Math.floor(diffTime / (1000 * 60));
                                  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
                                  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                  
                                  // Show relative time for recent entries
                                  if (diffMinutes < 1 && diffTime >= 0) {
                                    return 'Just now';
                                  } else if (diffMinutes < 60 && diffTime >= 0) {
                                    return `${diffMinutes} min ago`;
                                  } else if (diffHours < 24 && diffTime >= 0) {
                                    return `${diffHours}h ago`;
                                  } else if (diffDays < 7 && diffTime >= 0) {
                                    return `${diffDays}d ago`;
                                  } else {
                                    // For older entries, show formatted date
                                    return date.toLocaleDateString('en-GB', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    });
                                  }
                                } catch (error) {
                                  console.error('Date parsing error:', error, 'for:', dateStr);
                                  return `Raw: ${dateStr}`;
                                }
                              })()}
                            </p>
                            <p className={classNames(
                              "text-xs",
                              darkMode ? "text-gray-500" : "text-gray-400"
                            )}>
                              {(() => {
                                const dateStr = log.created_at || log.timestamp;
                                if (!dateStr || dateStr === 'null' || dateStr === 'undefined') {
                                  return 'No timestamp available';
                                }
                                
                                try {
                                  // More robust date parsing for full timestamp
                                  let date: Date;
                                  
                                  // Handle timestamp as number (milliseconds)
                                  if (!isNaN(Number(dateStr)) && Number(dateStr) > 1000000000000) {
                                    date = new Date(Number(dateStr));
                                  }
                                  // Handle timestamp as number (seconds)
                                  else if (!isNaN(Number(dateStr)) && Number(dateStr) > 1000000000) {
                                    date = new Date(Number(dateStr) * 1000);
                                  }
                                  // Handle formatted timestamps (DD/MM/YYYY, HH:mm:ss) or (DD.MM.YYYY, HH:mm:ss) - already in Israeli timezone
                                  else if (dateStr.match(/^\d{2}[/.]\d{2}[/.]\d{4}, \d{2}:\d{2}:\d{2}$/)) {
                                    return dateStr.replace(/\./g, '/'); // Normalize dots to slashes for display
                                  }
                                  // Handle ISO format
                                  else if (dateStr.includes('T') || dateStr.includes('Z')) {
                                    date = new Date(dateStr);
                                  }
                                  // Handle SQLite format (YYYY-MM-DD HH:MM:SS)
                                  else if (dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                                    date = new Date(dateStr + 'Z');
                                  }
                                  // Generic fallback
                                  else {
                                    date = new Date(dateStr);
                                  }
                                  
                                  // Check if date is valid
                                  if (isNaN(date.getTime())) {
                                    return `Invalid timestamp: ${dateStr}`;
                                  }
                                  
                                  // Return formatted timestamp in Israeli timezone
                                  return date.toLocaleString('en-GB', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false,
                                    timeZone: 'Asia/Jerusalem'
                                  });
                                } catch (error) {
                                  console.error('Full timestamp parsing error:', error, 'for:', dateStr);
                                  return `Raw timestamp: ${dateStr}`;
                                }
                              })()}
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