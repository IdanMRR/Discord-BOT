import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Card from '../components/common/Card';
import PermissionGuard from '../components/common/PermissionGuard';
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
  CheckIcon,
  ChevronLeftIcon,
  ServerIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
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
  { value: 'moderation', label: 'Moderation', icon: ShieldCheckIcon },
  { value: 'user', label: 'User Activity', icon: UserIcon },
  { value: 'message', label: 'Messages', icon: ChatBubbleLeftEllipsisIcon },
  { value: 'server', label: 'Server Events', icon: ServerIcon },
  { value: 'ticket', label: 'Tickets', icon: TicketIcon },
];



const ServerLogsContent: React.FC = () => {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { serverId } = useParams<{ serverId: string }>();
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LogFilter>({
    type: 'all',
    search: '',
    userId: '',
    dateRange: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);





  // Safe render function to prevent XSS and handle null/undefined values
  const safeRender = useCallback((content: any): string => {
    if (content === null || content === undefined) {
      return '';
    }
    
    if (typeof content === 'object') {
      try {
        return JSON.stringify(content);
      } catch {
        return '[Object]';
      }
    }
    
    const str = String(content);
    // Only escape the most dangerous characters, but preserve forward slashes for commands
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }, []);





  const fetchLogs = useCallback(async () => {
    if (!serverId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching logs for server:', serverId);
      
      const [serverLogsResponse, modLogsResponse] = await Promise.all([
        // Get regular server logs
        apiService.getServerLogs({ 
          guildId: serverId,
          page: 1,
          limit: 1000
        }),
        // Get moderation logs (warnings, etc.)
        apiService.getWarnings()
      ]);
      
      console.log('Server logs response:', serverLogsResponse);
      console.log('Mod logs response:', modLogsResponse);
      
      let allLogs: any[] = [];
      
      // Process regular server logs
      if (serverLogsResponse.success && serverLogsResponse.data && Array.isArray(serverLogsResponse.data)) {
        console.log('Processing server logs...');
        const serverLogs = serverLogsResponse.data.map((log: any) => {
          // Server logs may have different field names for usernames
          let userName = 'Unknown User';
          if (log.user_name || log.userName || log.username) {
            userName = log.user_name || log.userName || log.username;
          } else if (log.details && typeof log.details === 'string') {
            // Try to extract username from details field
            const targetMatch = log.details.match(/Target:\s*([^\s|]+)/);
            const userMatch = log.details.match(/User:\s*([^\s|]+)/);
            if (targetMatch && targetMatch[1] && targetMatch[1] !== '-MIA') {
              userName = targetMatch[1];
            } else if (userMatch && userMatch[1]) {
              userName = userMatch[1];
            }
          } else if (log.user_id) {
            const userIdSuffix = log.user_id.slice(-4);
            userName = `User_${userIdSuffix}`;
          }
          
          // Format action for better display
          let actionDescription = log.action || 'Unknown Action';
          if (log.action) {
            const actionLower = log.action.toLowerCase();
            switch (actionLower) {
              case 'ban':
              case 'memberban':
                actionDescription = 'Member Ban';
                break;
              case 'kick':
              case 'memberkick':
                actionDescription = 'Member Kick';
                break;
              case 'timeout':
              case 'membertimeout':
                actionDescription = 'Member Timeout';
                break;
              case 'warning':
              case 'warn':
                actionDescription = 'Member Warning';
                break;
              default:
                // Format camelCase actions to proper case
                if (actionLower.includes('kick')) {
                  actionDescription = 'Member Kick';
                } else if (actionLower.includes('ban')) {
                  actionDescription = 'Member Ban';
                } else if (actionLower.includes('timeout')) {
                  actionDescription = 'Member Timeout';
                } else if (actionLower.includes('warn')) {
                  actionDescription = 'Member Warning';
                } else {
                  actionDescription = log.action;
                }
            }
          }

          return {
            ...log,
            log_type: log.type || 'server',
            id: log.id || Math.random() * 1000000,
            action: actionDescription,
            action_type: log.action_type || log.action || 'server',
            details: safeRender(log.details) || 'No details available',
            timestamp: log.timestamp || log.created_at,
            userName: userName // Ensure userName is set
          };
        });
        allLogs.push(...serverLogs);
      }
      
      // Process moderation logs (warnings, bans, kicks, etc.)
      if (modLogsResponse.success && modLogsResponse.data && Array.isArray(modLogsResponse.data)) {
        console.log('Processing moderation logs...');
        
        const modLogs = modLogsResponse.data
          .filter((log: any) => !log.guild_id || log.guild_id === serverId)
          .map((log: any) => {
            // Use only the data that's already available in the logs
            let userName = 'Unknown User';
            let moderatorName = 'System';
            
            // Check all possible username fields - warnings API returns 'username' and 'adminUsername'
            if (log.username || log.userName || log.user_name) {
              userName = log.username || log.userName || log.user_name;
            } else if (log.user_id) {
              const userIdSuffix = log.user_id.slice(-4);
              userName = `User_${userIdSuffix}`;
            }
            
            // Check all possible moderator name fields
            if (log.adminUsername || log.moderatorName || log.moderator_name) {
              moderatorName = log.adminUsername || log.moderatorName || log.moderator_name;
            } else if (log.moderator_id) {
              const modIdSuffix = log.moderator_id.slice(-4);
              moderatorName = `Mod_${modIdSuffix}`;
            }

            // Create better action descriptions
            let actionDescription = 'Member Warning';
            let detailsDescription = '';
            
            if (log.case_number) {
              actionDescription = `Member Warning`;
              detailsDescription = `⚠️ Case #${String(log.case_number).padStart(4, '0')}: ${moderatorName} warned ${userName}`;
              if (log.reason && log.reason !== 'No reason provided') {
                detailsDescription += ` | Reason: ${log.reason}`;
              }
            } else if (log.action) {
              const actionLower = log.action.toLowerCase();
              
              // Check if it has a case number for proper formatting
              if (log.case_number) {
                if (actionLower.includes('kick')) {
                  actionDescription = `Member Kick`;
                  detailsDescription = `👢 Case #${String(log.case_number).padStart(4, '0')}: ${moderatorName} kicked ${userName}`;
                } else if (actionLower.includes('ban')) {
                  actionDescription = `Member Ban`;
                  detailsDescription = `🔨 Case #${String(log.case_number).padStart(4, '0')}: ${moderatorName} banned ${userName}`;
                } else if (actionLower.includes('timeout')) {
                  actionDescription = `Member Timeout`;
                  detailsDescription = `⏰ Case #${String(log.case_number).padStart(4, '0')}: ${moderatorName} timed out ${userName}`;
                } else if (actionLower.includes('warn')) {
                  actionDescription = `Member Warning`;
                  detailsDescription = `⚠️ Case #${String(log.case_number).padStart(4, '0')}: ${moderatorName} warned ${userName}`;
                } else {
                  actionDescription = `${log.action}`;
                  detailsDescription = `${moderatorName} performed ${log.action} on ${userName}`;
                }
              } else {
                switch (actionLower) {
                  case 'ban':
                  case 'memberban':
                    actionDescription = 'Member Ban';
                    detailsDescription = `🔨 ${moderatorName} banned ${userName}`;
                    break;
                  case 'kick':
                  case 'memberkick':
                    actionDescription = 'Member Kick';
                    detailsDescription = `👢 ${moderatorName} kicked ${userName}`;
                    break;
                  case 'timeout':
                  case 'membertimeout':
                    actionDescription = 'Member Timeout';
                    detailsDescription = `⏰ ${moderatorName} timed out ${userName}`;
                    break;
                  case 'warning':
                  case 'warn':
                    actionDescription = 'Member Warning';
                    detailsDescription = `⚠️ ${moderatorName} warned ${userName}`;
                    break;
                  default:
                    // Format camelCase actions to proper case
                    if (actionLower.includes('kick')) {
                      actionDescription = 'Member Kick';
                      detailsDescription = `👢 ${moderatorName} kicked ${userName}`;
                    } else if (actionLower.includes('ban')) {
                      actionDescription = 'Member Ban';
                      detailsDescription = `🔨 ${moderatorName} banned ${userName}`;
                    } else if (actionLower.includes('timeout')) {
                      actionDescription = 'Member Timeout';
                      detailsDescription = `⏰ ${moderatorName} timed out ${userName}`;
                    } else if (actionLower.includes('warn')) {
                      actionDescription = 'Member Warning';
                      detailsDescription = `⚠️ ${moderatorName} warned ${userName}`;
                    } else {
                      actionDescription = log.action;
                      detailsDescription = `${moderatorName} performed ${log.action} on ${userName}`;
                    }
                }
              }
              
              if (log.reason && log.reason !== 'No reason provided') {
                detailsDescription += ` | Reason: ${log.reason}`;
              }
            }

            return {
              id: log.id || Math.random() * 1000000,
              guild_id: log.guild_id,
              user_id: log.user_id,
              userName: userName,
              moderatorId: log.moderator_id,
              moderatorName: moderatorName,
              action: actionDescription,
              action_type: log.action_type || log.action || 'warning',
              log_type: 'moderation',
              details: detailsDescription,
              channel_id: log.channel_id,
              target_id: log.target_id,
              reason: safeRender(log.reason),
              timestamp: log.timestamp || log.created_at,
              created_at: log.created_at,
              metadata: log.metadata,
              command: log.command,
              success: log.success,
              error: log.error
            };
          });
        allLogs.push(...modLogs);
      }
      
      // Sort all logs by timestamp (newest first)
      allLogs.sort((a, b) => {
        const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
        const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
        return timeB - timeA;
      });
      
      console.log('Final processed logs:', allLogs);
      setLogs(allLogs);
      
    } catch (error) {
      console.error('Error fetching logs:', error);
      setError('Failed to fetch logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [serverId, safeRender]);

  // Debounced fetch for search
  const debouncedFetch = useCallback(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      fetchLogs();
    }, 500);
  }, [fetchLogs]);

  // Initial fetch
  useEffect(() => {
    if (serverId) {
      fetchLogs();
    }
  }, [serverId, fetchLogs]);

  // Fetch logs when filter changes
  useEffect(() => {
    if (serverId && filter.search) {
      debouncedFetch();
    } else if (serverId) {
      fetchLogs();
    }
  }, [serverId, filter.search, filter.type, filter.userId, filter.dateRange, debouncedFetch, fetchLogs]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  const getLogIcon = (logType: string, actionType: string) => {
    if (logType === 'command') return CommandLineIcon;
    if (logType === 'moderation') return ShieldCheckIcon;
    if (logType === 'user') return UserIcon;
    if (logType === 'message') return ChatBubbleLeftEllipsisIcon;
    if (logType === 'server') return ServerIcon;
    if (logType === 'ticket') return TicketIcon;
    
    // Fallback based on action type
    if (actionType?.includes('ban') || actionType?.includes('kick')) return XCircleIcon;
    if (actionType?.includes('warn') || actionType?.includes('timeout')) return ExclamationTriangleIcon;
    if (actionType?.includes('join')) return UserPlusIcon;
    if (actionType?.includes('leave')) return UserMinusIcon;
    if (actionType?.includes('delete')) return TrashIcon;
    if (actionType?.includes('create') || actionType?.includes('add')) return CheckIcon;
    if (actionType?.includes('view')) return EyeIcon;
    
    return DocumentTextIcon;
  };

  const getLogTypeColor = (logType: string) => {
    switch (logType) {
      case 'command': return 'blue';
      case 'moderation': return 'red';
      case 'user': return 'yellow';
      case 'message': return 'green';
      case 'server': return 'purple';
      case 'ticket': return 'indigo';
      default: return 'gray';
    }
  };

  // Use the same date formatting as the working GitHub version
  const formatDate = (dateString: string) => {
    return formatDashboardLogDate(dateString);
  };

  const handleRefresh = () => {
    fetchLogs();
  };

  const clearFilters = () => {
    setFilter({
      type: 'all',
      search: '',
      userId: '',
      dateRange: 'all'
    });
  };



  if (!serverId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Server Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The server ID is missing or invalid.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/servers/${serverId}`)}
                className={classNames(
                  "p-2 rounded-lg transition-colors duration-200",
                  darkMode 
                    ? "text-gray-400 hover:text-gray-300 hover:bg-gray-800" 
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <ChevronLeftIcon className="h-6 w-6" />
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                  <ServerIcon className="h-6 w-6" />
                </div>
                
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    Server Activity Logs
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    📊 Monitor all server activity and events
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className={classNames(
                  "inline-flex items-center px-6 py-3 text-sm font-semibold rounded-xl border-2 shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  loading
                    ? "bg-gray-400 text-white cursor-not-allowed border-gray-400"
                    : "text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-green-500/50 hover:border-green-400",
                  darkMode ? "focus:ring-offset-gray-900" : "focus:ring-offset-white"
                )}
              >
                <ArrowPathIcon className={classNames(
                  "h-5 w-5 mr-2",
                  loading ? "animate-spin" : ""
                )} />
                {loading ? 'Refreshing...' : '🔄 Refresh Logs'}
              </button>
              

              

            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className={classNames(
          "mb-6 shadow-lg border-0 rounded-xl overflow-hidden",
          darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
        )}>
          <div className={classNames(
            "p-6 border-b",
            darkMode ? "border-gray-700" : "border-gray-200"
          )}>
            <div className="flex items-center justify-between">
              <h3 className={classNames(
                "text-lg font-semibold flex items-center",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                <FunnelIcon className="h-5 w-5 mr-2" />
                Filters
              </h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={classNames(
                  "inline-flex items-center px-3 py-1 text-sm font-medium rounded-lg transition-colors duration-200",
                  darkMode 
                    ? "text-gray-300 hover:text-white hover:bg-gray-700" 
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                {showFilters ? 'Hide' : 'Show'} Filters
                <ChevronDownIcon className={classNames(
                  "h-4 w-4 ml-1 transition-transform duration-200",
                  showFilters ? "rotate-180" : ""
                )} />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className={classNames(
              "p-6 space-y-4",
              darkMode ? "bg-gray-800" : "bg-white"
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
                      "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                      darkMode 
                        ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                        : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                    )}
                  >
                    {LOG_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Filter */}
                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Search
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={filter.search}
                      onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                      placeholder="Search logs..."
                      className={classNames(
                        "w-full p-3 pl-10 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                        darkMode 
                          ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500 placeholder-gray-400" 
                          : "bg-white text-gray-900 border-gray-300 hover:border-gray-400 placeholder-gray-500"
                      )}
                    />
                    <MagnifyingGlassIcon className={classNames(
                      "absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5",
                      darkMode ? "text-gray-400" : "text-gray-500"
                    )} />
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
                      "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                      darkMode 
                        ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500 placeholder-gray-400" 
                        : "bg-white text-gray-900 border-gray-300 hover:border-gray-400 placeholder-gray-500"
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
                      "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                      darkMode 
                        ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                        : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                    )}
                  >
                    <option value="all">All Time</option>
                    <option value="1h">Last Hour</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
              </div>

              {/* Clear Filters Button */}
              <div className="flex justify-end">
                <button
                  onClick={clearFilters}
                  className={classNames(
                    "inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200",
                    darkMode 
                      ? "text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-600" 
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300"
                  )}
                >
                  <XMarkIcon className="h-4 w-4 mr-2" />
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className={classNames(
            "p-6 shadow-lg border-0 rounded-xl",
            darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
          )}>
            <div className="flex items-center">
              <div className={classNames(
                "w-12 h-12 rounded-lg flex items-center justify-center mr-4",
                darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-600"
              )}>
                <DocumentTextIcon className="h-6 w-6" />
              </div>
              <div>
                <p className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  {filter.type !== 'all' || filter.search || filter.userId || filter.dateRange !== 'all' 
                    ? 'Filtered Logs' 
                    : 'All Activity Logs'
                  }
                </p>
                <p className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {logs.length.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>

          <Card className={classNames(
            "p-6 shadow-lg border-0 rounded-xl",
            darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
          )}>
            <div className="flex items-center">
              <div className={classNames(
                "w-12 h-12 rounded-lg flex items-center justify-center mr-4",
                darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-600"
              )}>
                <ClockIcon className="h-6 w-6" />
              </div>
              <div>
                <p className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Last Activity
                </p>
                <p className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {logs.length > 0 ? formatDate(logs[0].timestamp || logs[0].created_at) : 'None'}
                </p>
              </div>
            </div>
          </Card>

          <Card className={classNames(
            "p-6 shadow-lg border-0 rounded-xl",
            darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
          )}>
            <div className="flex items-center">
              <div className={classNames(
                "w-12 h-12 rounded-lg flex items-center justify-center mr-4",
                darkMode ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-600"
              )}>
                <UserIcon className="h-6 w-6" />
              </div>
              <div>
                <p className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Total Events
                </p>
                <p className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {logs.length.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Logs List */}
        <Card className={classNames(
          "shadow-lg border-0 rounded-xl overflow-hidden",
          darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
        )}>
          <div className={classNames(
            "p-6 border-b",
            darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
          )}>
            <h3 className={classNames(
              "text-lg font-semibold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Activity Logs
            </h3>
          </div>

          <div className={classNames(
            "p-6",
            darkMode ? "bg-gray-900" : "bg-white"
          )}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
                <span className={classNames(
                  "ml-3 text-lg",
                  darkMode ? "text-gray-300" : "text-gray-600"
                )}>
                  Loading server logs...
                </span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <XCircleIcon className={classNames(
                  "h-16 w-16 mx-auto mb-4",
                  darkMode ? "text-red-400" : "text-red-500"
                )} />
                <h3 className={classNames(
                  "text-lg font-semibold mb-2",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Error Loading Logs
                </h3>
                <p className={classNames(
                  "mb-4",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  {error}
                </p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <DocumentTextIcon className={classNames(
                  "h-16 w-16 mx-auto mb-4",
                  darkMode ? "text-gray-600" : "text-gray-400"
                )} />
                <h3 className={classNames(
                  "text-lg font-semibold mb-2",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  No Logs Found
                </h3>
                <p className={classNames(
                  "mb-4",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  No activity logs match your current filters.
                </p>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {logs.map((log, index) => {
                  const IconComponent = getLogIcon(log.log_type || '', log.action_type || '');
                  const color = getLogTypeColor(log.log_type || '');
                  
                  return (
                    <div
                      key={`${log.id}-${index}`}
                      className={classNames(
                        "group relative p-6 rounded-2xl border-2 shadow-2xl backdrop-blur-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-3xl active:scale-[0.99] cursor-pointer",
                        darkMode 
                          ? "bg-gray-800/60 border-gray-600/30 hover:border-gray-500/50 hover:bg-gray-800/80" 
                          : "bg-white/60 border-gray-200/50 hover:border-gray-300/70 hover:bg-white/80"
                      )}
                    >
                      {/* Background Pattern */}
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-500/5 rounded-2xl pointer-events-none" />
                      
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className={classNames(
                            "w-14 h-14 rounded-xl flex items-center justify-center shadow-lg",
                            color === 'blue' && (darkMode ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white" : "bg-gradient-to-br from-blue-500 to-blue-600 text-white"),
                            color === 'green' && (darkMode ? "bg-gradient-to-br from-green-600 to-green-700 text-white" : "bg-gradient-to-br from-green-500 to-green-600 text-white"),
                            color === 'red' && (darkMode ? "bg-gradient-to-br from-red-600 to-red-700 text-white" : "bg-gradient-to-br from-red-500 to-red-600 text-white"),
                            color === 'purple' && (darkMode ? "bg-gradient-to-br from-purple-600 to-purple-700 text-white" : "bg-gradient-to-br from-purple-500 to-purple-600 text-white"),
                            color === 'yellow' && (darkMode ? "bg-gradient-to-br from-yellow-600 to-yellow-700 text-white" : "bg-gradient-to-br from-yellow-500 to-yellow-600 text-white"),
                            color === 'indigo' && (darkMode ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white" : "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white"),
                            color === 'gray' && (darkMode ? "bg-gradient-to-br from-gray-600 to-gray-700 text-white" : "bg-gradient-to-br from-gray-500 to-gray-600 text-white")
                          )}>
                            <IconComponent className="h-7 w-7" />
                          </div>
                          
                          <div>
                            <h3 className={classNames(
                              "text-xl font-bold",
                              darkMode ? "text-white" : "text-gray-900"
                            )}>
                              {safeRender(log.action) || 'Unknown Action'}
                            </h3>
                            <span className={classNames(
                              "inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full shadow-sm",
                              color === 'blue' && (darkMode ? "bg-blue-900/50 text-blue-300 border border-blue-700/50" : "bg-blue-100 text-blue-700 border border-blue-200"),
                              color === 'green' && (darkMode ? "bg-green-900/50 text-green-300 border border-green-700/50" : "bg-green-100 text-green-700 border border-green-200"),
                              color === 'red' && (darkMode ? "bg-red-900/50 text-red-300 border border-red-700/50" : "bg-red-100 text-red-700 border border-red-200"),
                              color === 'purple' && (darkMode ? "bg-purple-900/50 text-purple-300 border border-purple-700/50" : "bg-purple-100 text-purple-700 border border-purple-200"),
                              color === 'yellow' && (darkMode ? "bg-yellow-900/50 text-yellow-300 border border-yellow-700/50" : "bg-yellow-100 text-yellow-700 border border-yellow-200"),
                              color === 'indigo' && (darkMode ? "bg-indigo-900/50 text-indigo-300 border border-indigo-700/50" : "bg-indigo-100 text-indigo-700 border border-indigo-200"),
                              color === 'gray' && (darkMode ? "bg-gray-700/50 text-gray-300 border border-gray-600/50" : "bg-gray-100 text-gray-700 border border-gray-200")
                            )}>
                              {log.log_type || 'unknown'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={classNames(
                            "text-sm font-medium",
                            darkMode ? "text-gray-300" : "text-gray-600"
                          )}>
                            📅 {formatDate(log.timestamp || log.created_at)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Details */}
                      {log.details && (
                        <div className={classNames(
                          "p-4 rounded-xl mb-4 border",
                          darkMode 
                            ? "bg-gray-700/30 border-gray-600/30 text-gray-200" 
                            : "bg-gray-50/50 border-gray-200/50 text-gray-700"
                        )}>
                          <div className="flex items-start space-x-2">
                            <span className="text-sm">📋</span>
                            <p className="text-sm font-medium leading-relaxed">
                              {log.details}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Metadata */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {log.userName && (
                          <div className={classNames(
                            "flex items-center space-x-3 p-3 rounded-lg border",
                            darkMode 
                              ? "bg-gray-700/20 border-gray-600/20" 
                              : "bg-gray-50/30 border-gray-200/30"
                          )}>
                            <div className={classNames(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              darkMode ? "bg-blue-600/20 text-blue-400" : "bg-blue-100 text-blue-600"
                            )}>
                              <span className="text-sm">👤</span>
                            </div>
                            <div>
                              <p className={classNames(
                                "text-xs font-medium",
                                darkMode ? "text-gray-400" : "text-gray-500"
                              )}>
                                User
                              </p>
                              <p className={classNames(
                                "text-sm font-semibold",
                                darkMode ? "text-white" : "text-gray-900"
                              )}>
                                {safeRender(log.userName)}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {log.moderatorName && (
                          <div className={classNames(
                            "flex items-center space-x-3 p-3 rounded-lg border",
                            darkMode 
                              ? "bg-gray-700/20 border-gray-600/20" 
                              : "bg-gray-50/30 border-gray-200/30"
                          )}>
                            <div className={classNames(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              darkMode ? "bg-purple-600/20 text-purple-400" : "bg-purple-100 text-purple-600"
                            )}>
                              <span className="text-sm">🛡️</span>
                            </div>
                            <div>
                              <p className={classNames(
                                "text-xs font-medium",
                                darkMode ? "text-gray-400" : "text-gray-500"
                              )}>
                                Moderator
                              </p>
                              <p className={classNames(
                                "text-sm font-semibold",
                                darkMode ? "text-white" : "text-gray-900"
                              )}>
                                {safeRender(
                                  log.moderatorName === 'dashboard' || log.moderatorName === 'system' || log.moderatorName === 'automod' ||
                                  (log.moderatorName && log.moderatorName.startsWith('User_')) ||
                                  (log.action && (log.action.toLowerCase().includes('auto') || log.action.toLowerCase().includes('timeout'))) ||
                                  (log.details && log.details.toLowerCase().includes('automatic'))
                                  ? 'AutoMod System' : log.moderatorName
                                )}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {log.reason && (
                          <div className={classNames(
                            "flex items-center space-x-3 p-3 rounded-lg border",
                            darkMode 
                              ? "bg-gray-700/20 border-gray-600/20" 
                              : "bg-gray-50/30 border-gray-200/30"
                          )}>
                            <div className={classNames(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              darkMode ? "bg-green-600/20 text-green-400" : "bg-green-100 text-green-600"
                            )}>
                              <span className="text-sm">📝</span>
                            </div>
                            <div>
                              <p className={classNames(
                                "text-xs font-medium",
                                darkMode ? "text-gray-400" : "text-gray-500"
                              )}>
                                Reason
                              </p>
                              <p className={classNames(
                                "text-sm font-semibold",
                                darkMode ? "text-white" : "text-gray-900"
                              )}>
                                {safeRender(log.reason)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

const ServerLogs: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['view_logs', 'admin']}
      fallbackMessage="You need log viewing permissions to access server logs."
    >
      <ServerLogsContent />
    </PermissionGuard>
  );
};

export default ServerLogs; 