import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Card from '../components/common/Card';
import PermissionGuard from '../components/common/PermissionGuard';
// import { formatDashboardLogDate } from '../utils/dateUtils'; // Removed unused import
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
                actionDescription = 'Kick System';
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
                  actionDescription = `Kick System`;
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
                    actionDescription = 'Kick System';
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
                      actionDescription = 'Kick System';
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
      case 'admin': return 'orange';
      case 'security': return 'pink';
      case 'system': return 'cyan';
      case 'voice': return 'teal';
      case 'role': return 'emerald';
      case 'channel': return 'violet';
      default: return 'gray';
    }
  };

  // Fixed date formatting function
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Recently';
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Recently';
      }
      
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
        return date.toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
      
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Recently';
    }
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
          <XCircleIcon className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Server Not Found
          </h2>
          <p className="text-muted-foreground mb-4">
            The server ID is missing or invalid.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
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
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
                  <EyeIcon className="h-5 w-5" />
                </div>
                
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Activity Logs
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Monitor all bot activities and server events in real-time
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className={classNames(
                  "btn-refresh",
                  loading ? "spinning" : ""
                )}
              >
                <ArrowPathIcon className="icon" />
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6 shadow-lg border-0 rounded-xl overflow-hidden bg-card ring-1 ring-border">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center text-foreground">
                <FunnelIcon className="h-5 w-5 mr-2" />
                Filters
              </h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border transition-colors duration-200 text-muted-foreground hover:text-foreground hover:bg-muted border-border"
              >
                <FunnelIcon className="h-4 w-4 mr-2" />
                {showFilters ? 'Hide' : 'Show'} Filters
                <ChevronDownIcon className={classNames(
                  "h-4 w-4 ml-1 transition-transform duration-200",
                  showFilters ? "rotate-180" : ""
                )} />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="p-6 space-y-4 bg-card">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Log Type Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Log Type
                  </label>
                  <select
                    value={filter.type}
                    onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 bg-background text-foreground border-input hover:border-border"
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
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Search
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={filter.search}
                      onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                      placeholder="Search logs..."
                      className="w-full p-3 pl-10 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 bg-background text-foreground border-input hover:border-border placeholder:text-muted-foreground"
                    />
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  </div>
                </div>

                {/* User ID Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={filter.userId}
                    onChange={(e) => setFilter(prev => ({ ...prev, userId: e.target.value }))}
                    placeholder="Filter by user ID..."
                    className="w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 bg-background text-foreground border-input hover:border-border placeholder:text-muted-foreground"
                  />
                </div>

                {/* Date Range Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Date Range
                  </label>
                  <select
                    value={filter.dateRange}
                    onChange={(e) => setFilter(prev => ({ ...prev, dateRange: e.target.value }))}
                    className="w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 bg-background text-foreground border-input hover:border-border"
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
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
                >
                  <XMarkIcon className="h-4 w-4 mr-2" />
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mr-3 bg-blue-100 text-blue-600">
                <DocumentTextIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {filter.type !== 'all' || filter.search || filter.userId || filter.dateRange !== 'all' 
                    ? 'Filtered Logs' 
                    : 'Total Logs'
                  }
                </p>
                <p className="text-xl font-semibold text-foreground">
                  {logs.length.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mr-3 bg-green-100 text-green-600">
                <ClockIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Last Activity
                </p>
                <p className="text-xl font-semibold text-foreground">
                  {logs.length > 0 ? formatDate(logs[0].timestamp || logs[0].created_at) : 'None'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mr-3 bg-purple-100 text-purple-600">
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Events
                </p>
                <p className="text-xl font-semibold text-foreground">
                  {logs.length.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Logs List */}
        <Card className="shadow-lg border-0 rounded-xl overflow-hidden bg-card ring-1 ring-border">
          <div className="p-6 border-b border-border bg-muted/50">
            <h3 className="text-lg font-semibold text-foreground">
              Activity Logs
            </h3>
          </div>

          <div className="p-6 bg-card">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
                <span className="ml-3 text-lg text-muted-foreground">
                  Loading server logs...
                </span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <XCircleIcon className="h-16 w-16 mx-auto mb-4 text-destructive" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">
                  Error Loading Logs
                </h3>
                <p className="mb-4 text-muted-foreground">
                  {error}
                </p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <DocumentTextIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">
                  No Logs Found
                </h3>
                <p className="mb-4 text-muted-foreground">
                  No activity logs match your current filters.
                </p>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
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
                        "p-4 rounded-lg border",
                        darkMode 
                          ? "bg-gray-800/50 border-gray-700" 
                          : "bg-white border-gray-200"
                      )}
                    >
                      
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={classNames(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            color === 'blue' && "bg-blue-100 text-blue-600",
                            color === 'green' && "bg-green-100 text-green-600",
                            color === 'red' && "bg-red-100 text-red-600",
                            color === 'purple' && "bg-purple-100 text-purple-600",
                            color === 'yellow' && "bg-yellow-100 text-yellow-600",
                            color === 'indigo' && "bg-indigo-100 text-indigo-600",
                            color === 'orange' && "bg-orange-100 text-orange-600",
                            color === 'pink' && "bg-pink-100 text-pink-600",
                            color === 'cyan' && "bg-cyan-100 text-cyan-600",
                            color === 'teal' && "bg-teal-100 text-teal-600",
                            color === 'emerald' && "bg-emerald-100 text-emerald-600",
                            color === 'violet' && "bg-violet-100 text-violet-600",
                            color === 'gray' && "bg-gray-100 text-gray-600",
                            darkMode && color === 'blue' && "bg-blue-900/30 text-blue-400",
                            darkMode && color === 'green' && "bg-green-900/30 text-green-400",
                            darkMode && color === 'red' && "bg-red-900/30 text-red-400",
                            darkMode && color === 'purple' && "bg-purple-900/30 text-purple-400",
                            darkMode && color === 'yellow' && "bg-yellow-900/30 text-yellow-400",
                            darkMode && color === 'indigo' && "bg-indigo-900/30 text-indigo-400",
                            darkMode && color === 'orange' && "bg-orange-900/30 text-orange-400",
                            darkMode && color === 'pink' && "bg-pink-900/30 text-pink-400",
                            darkMode && color === 'cyan' && "bg-cyan-900/30 text-cyan-400",
                            darkMode && color === 'teal' && "bg-teal-900/30 text-teal-400",
                            darkMode && color === 'emerald' && "bg-emerald-900/30 text-emerald-400",
                            darkMode && color === 'violet' && "bg-violet-900/30 text-violet-400",
                            darkMode && color === 'gray' && "bg-gray-900/30 text-gray-400"
                          )}>
                            <IconComponent className="h-5 w-5" />
                          </div>
                          
                          <div>
                            <h4 className="text-lg font-semibold text-foreground">
                              {safeRender(log.action) || 'Unknown Action'}
                            </h4>
                            <span className={classNames(
                              "inline-flex items-center px-2 py-1 text-xs font-medium rounded-md",
                              color === 'blue' && "bg-blue-100 text-blue-800",
                              color === 'green' && "bg-green-100 text-green-800",
                              color === 'red' && "bg-red-100 text-red-800",
                              color === 'purple' && "bg-purple-100 text-purple-800",
                              color === 'yellow' && "bg-yellow-100 text-yellow-800",
                              color === 'indigo' && "bg-indigo-100 text-indigo-800",
                              color === 'orange' && "bg-orange-100 text-orange-800",
                              color === 'pink' && "bg-pink-100 text-pink-800",
                              color === 'cyan' && "bg-cyan-100 text-cyan-800",
                              color === 'teal' && "bg-teal-100 text-teal-800",
                              color === 'emerald' && "bg-emerald-100 text-emerald-800",
                              color === 'violet' && "bg-violet-100 text-violet-800",
                              color === 'gray' && "bg-gray-100 text-gray-800",
                              darkMode && color === 'blue' && "bg-blue-900/30 text-blue-300",
                              darkMode && color === 'green' && "bg-green-900/30 text-green-300",
                              darkMode && color === 'red' && "bg-red-900/30 text-red-300",
                              darkMode && color === 'purple' && "bg-purple-900/30 text-purple-300",
                              darkMode && color === 'yellow' && "bg-yellow-900/30 text-yellow-300",
                              darkMode && color === 'indigo' && "bg-indigo-900/30 text-indigo-300",
                              darkMode && color === 'orange' && "bg-orange-900/30 text-orange-300",
                              darkMode && color === 'pink' && "bg-pink-900/30 text-pink-300",
                              darkMode && color === 'cyan' && "bg-cyan-900/30 text-cyan-300",
                              darkMode && color === 'teal' && "bg-teal-900/30 text-teal-300",
                              darkMode && color === 'emerald' && "bg-emerald-900/30 text-emerald-300",
                              darkMode && color === 'violet' && "bg-violet-900/30 text-violet-300",
                              darkMode && color === 'gray' && "bg-gray-900/30 text-gray-300"
                            )}>
                              {log.log_type || 'unknown'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">
                            <ClockIcon className="inline h-4 w-4 mr-1" />
                            {formatDate(log.timestamp || log.created_at)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Details */}
                      {log.details && (
                        <div className={classNames(
                          "p-3 rounded-lg mb-3 border-l-4",
                          darkMode 
                            ? "bg-gray-700/20 border-l-gray-500" 
                            : "bg-gray-50 border-l-gray-400",
                          log.details.toLowerCase().includes('success') && "border-l-green-500",
                          log.details.toLowerCase().includes('error') && "border-l-red-500"
                        )}>
                          <p className={classNames(
                            "text-sm leading-relaxed",
                            log.details.toLowerCase().includes('success') 
                              ? "text-green-600 font-medium" 
                              : log.details.toLowerCase().includes('error')
                              ? "text-red-600 font-medium"
                              : darkMode ? "text-gray-300" : "text-gray-700"
                          )}>
                            {log.details}
                          </p>
                        </div>
                      )}
                      
                      {/* Success/Status Indicator */}
                      {(log.success === 1 || (log.details && log.details.toLowerCase().includes('success'))) && (
                        <div className="flex items-center space-x-1 mt-1">
                          <CheckIcon className="h-4 w-4 !text-green-500" />
                          <span className="text-sm !text-green-500 font-semibold">
                            Command executed successfully
                          </span>
                        </div>
                      )}
                      
                      {/* Metadata */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        {log.userName && (
                          <div className="flex items-center space-x-2">
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">User:</span>
                            <span className="font-medium text-foreground">
                              {safeRender(log.userName)}
                            </span>
                          </div>
                        )}
                        
                        {log.moderatorName && (
                          <div className="flex items-center space-x-2">
                            <ShieldCheckIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Moderator:</span>
                            <span className="font-medium text-foreground">
                              {safeRender(log.moderatorName)}
                            </span>
                          </div>
                        )}
                        
                        {log.reason && (
                          <div className="flex items-center space-x-2">
                            <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Reason:</span>
                            <span className="font-medium text-foreground">
                              {safeRender(log.reason)}
                            </span>
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