import React, { useState, useEffect, useCallback } from 'react';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import PermissionGuard from '../components/common/PermissionGuard';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ClockIcon, 
  UserIcon, 
  FunnelIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  TicketIcon,
  ExclamationTriangleIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface DashboardLogEntry {
  id: number;
  user_id: string;
  username?: string;
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
  created_at: string;
}

interface ActivityStats {
  totalActions: number;
  uniqueUsers: number;
  actionsByType: Record<string, number>;
  actionsByPage: Record<string, number>;
  successRate: number;
}

const DashboardLogsContent: React.FC = () => {
  const { darkMode } = useTheme();
  const [logs, setLogs] = useState<DashboardLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [filters, setFilters] = useState({
    user_id: '',
    action_type: '',
    page_name: '',
    target_type: '',
    success: '',
    start_date: '',
    end_date: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 25;

  const fetchLogs = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      });

      const response = await fetch(`/api/dashboard-logs?${queryParams}`, {
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setLogs(data.data.logs || []);
        if (data.data.pagination) {
          setCurrentPage(data.data.pagination.page);
          setTotalPages(data.data.pagination.pages);
          setTotalLogs(data.data.pagination.total);
        }
      } else {
        toast.error('Failed to fetch dashboard logs');
        setLogs([]);
      }
    } catch (error) {
      console.error('Error fetching dashboard logs:', error);
      toast.error('Failed to fetch dashboard logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters, itemsPerPage]);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      
      const response = await fetch('/api/dashboard-logs/stats?hours=24', {
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(1);
    fetchStats();
  }, [fetchLogs, fetchStats]);

  const handlePageChange = (page: number) => {
    fetchLogs(page);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setCurrentPage(1);
    fetchLogs(1);
  };

  const clearFilters = () => {
    setFilters({
      user_id: '',
      action_type: '',
      page_name: '',
      target_type: '',
      success: '',
      start_date: '',
      end_date: ''
    });
    setCurrentPage(1);
    setTimeout(() => fetchLogs(1), 100);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const israeliTime = new Date(date.getTime() + (3 * 60 * 60 * 1000)); // Add 3 hours for Israeli timezone
    
    const day = israeliTime.getDate().toString().padStart(2, '0');
    const month = (israeliTime.getMonth() + 1).toString().padStart(2, '0');
    const year = israeliTime.getFullYear();
    const hours = israeliTime.getHours().toString().padStart(2, '0');
    const minutes = israeliTime.getMinutes().toString().padStart(2, '0');
    const seconds = israeliTime.getSeconds().toString().padStart(2, '0');
    
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'view_dashboard':
      case 'view_page':
        return <EyeIcon className="h-4 w-4" />;
      case 'create_ticket':
      case 'create_resource':
        return <PlusIcon className="h-4 w-4" />;
      case 'update_ticket':
      case 'update_settings':
      case 'update_server':
      case 'update_resource':
        return <PencilIcon className="h-4 w-4" />;
      case 'delete_ticket':
      case 'delete_resource':
        return <TrashIcon className="h-4 w-4" />;
      case 'view_tickets':
        return <TicketIcon className="h-4 w-4" />;
      case 'view_warnings':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      case 'view_servers':
        return <ComputerDesktopIcon className="h-4 w-4" />;
      case 'view_logs':
        return <DocumentTextIcon className="h-4 w-4" />;
      case 'view_settings':
        return <Cog6ToothIcon className="h-4 w-4" />;
      default:
        return <DocumentTextIcon className="h-4 w-4" />;
    }
  };

  const getActionTypeColor = (actionType: string, success: boolean) => {
    if (!success) {
      return darkMode ? 'text-red-400 bg-red-900/20 border-red-700' : 'text-red-600 bg-red-100 border-red-200';
    }
    
    switch (actionType) {
      case 'view_dashboard':
      case 'view_page':
      case 'view_tickets':
      case 'view_warnings':
      case 'view_servers':
      case 'view_logs':
      case 'view_settings':
        return darkMode ? 'text-primary-400 bg-primary-900/20 border-primary-700' : 'text-primary-600 bg-primary-100 border-primary-200';
      case 'create_ticket':
      case 'create_resource':
        return darkMode ? 'text-green-400 bg-green-900/20 border-green-700' : 'text-green-600 bg-green-100 border-green-200';
      case 'update_ticket':
      case 'update_settings':
      case 'update_server':
      case 'update_resource':
        return darkMode ? 'text-yellow-400 bg-yellow-900/20 border-yellow-700' : 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'delete_ticket':
      case 'delete_resource':
        return darkMode ? 'text-red-400 bg-red-900/20 border-red-700' : 'text-red-600 bg-red-100 border-red-200';
      default:
        return darkMode ? 'text-gray-400 bg-gray-900/20 border-gray-700' : 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  return (
    <div className={classNames(
      "min-h-screen p-6 space-y-6",
      darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
    )}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className={classNames(
            "text-3xl font-bold mb-2",
            darkMode ? "text-white" : "text-gray-900"
          )}>
            Dashboard Activity Logs
          </h1>
          <p className={classNames(
            "text-lg",
            darkMode ? "text-gray-300" : "text-gray-600"
          )}>Track and monitor all user activities in the dashboard</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={classNames(
            "inline-flex items-center px-4 py-2 border font-medium rounded-lg transition-colors",
            darkMode 
              ? "bg-primary-600 border-primary-600 text-white hover:bg-primary-700" 
              : "bg-primary-600 border-primary-600 text-white hover:bg-primary-700"
          )}
        >
          <FunnelIcon className="h-4 w-4 mr-2" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Activity Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className={classNames(
          "p-6 border rounded-lg",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg border",
              darkMode ? "bg-primary-900/20 border-primary-700" : "bg-primary-100 border-primary-200"
            )}>
              <ChartBarIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-primary-400" : "text-primary-600"
              )} />
            </div>
            <div className="ml-4">
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>Total Actions</p>
              <div className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {statsLoading ? <LoadingSpinner size="sm" /> : stats?.totalActions || 0}
              </div>
            </div>
          </div>
        </Card>

        <Card className={classNames(
          "p-6 border rounded-lg",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg border",
              darkMode ? "bg-green-900/20 border-green-700" : "bg-green-100 border-green-200"
            )}>
              <UserIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-green-400" : "text-green-600"
              )} />
            </div>
            <div className="ml-4">
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>Active Users</p>
              <div className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {statsLoading ? <LoadingSpinner size="sm" /> : stats?.uniqueUsers || 0}
              </div>
            </div>
          </div>
        </Card>

        <Card className={classNames(
          "p-6 border rounded-lg",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg border",
              darkMode ? "bg-secondary-900/20 border-secondary-700" : "bg-secondary-100 border-secondary-200"
            )}>
              <CheckCircleIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-secondary-400" : "text-secondary-600"
              )} />
            </div>
            <div className="ml-4">
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>Success Rate</p>
              <div className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {statsLoading ? <LoadingSpinner size="sm" /> : `${Math.round(stats?.successRate || 0)}%`}
              </div>
            </div>
          </div>
        </Card>

        <Card className={classNames(
          "p-6 border rounded-lg",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg border",
              darkMode ? "bg-accent-900/20 border-accent-700" : "bg-accent-100 border-accent-200"
            )}>
              <ClockIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-accent-400" : "text-accent-600"
              )} />
            </div>
            <div className="ml-4">
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>Time Period</p>
              <p className={classNames(
                "text-lg font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>Last 24h</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className={classNames(
          "p-6 border rounded-lg",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <h3 className={classNames(
            "text-lg font-semibold mb-4",
            darkMode ? "text-white" : "text-gray-900"
          )}>🔍 Filter Options</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-1",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>User ID</label>
              <input
                type="text"
                value={filters.user_id}
                onChange={(e) => handleFilterChange('user_id', e.target.value)}
                placeholder="Enter user ID"
                className={classNames(
                  "w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                  darkMode 
                    ? "bg-gray-700 text-gray-100 border-gray-600" 
                    : "bg-white text-gray-900 border-gray-300"
                )}
              />
            </div>

            <div>
              <label className={classNames(
                "block text-sm font-medium mb-1",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>Action Type</label>
              <select
                value={filters.action_type}
                onChange={(e) => handleFilterChange('action_type', e.target.value)}
                className={classNames(
                  "w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                  darkMode 
                    ? "bg-gray-700 text-gray-100 border-gray-600" 
                    : "bg-white text-gray-900 border-gray-300"
                )}
              >
                <option value="">All Actions</option>
                <option value="view_dashboard">View Dashboard</option>
                <option value="view_tickets">View Tickets</option>
                <option value="view_warnings">View Warnings</option>
                <option value="view_servers">View Servers</option>
                <option value="view_logs">View Logs</option>
                <option value="update_settings">Update Settings</option>
                <option value="create_ticket">Create Ticket</option>
                <option value="update_ticket">Update Ticket</option>
                <option value="delete_ticket">Delete Ticket</option>
              </select>
            </div>

            <div>
              <label className={classNames(
                "block text-sm font-medium mb-1",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>Page</label>
              <select
                value={filters.page_name}
                onChange={(e) => handleFilterChange('page_name', e.target.value)}
                className={classNames(
                  "w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                  darkMode 
                    ? "bg-gray-700 text-gray-100 border-gray-600" 
                    : "bg-white text-gray-900 border-gray-300"
                )}
              >
                <option value="">All Pages</option>
                <option value="dashboard">Dashboard</option>
                <option value="tickets">Tickets</option>
                <option value="warnings">Warnings</option>
                <option value="servers">Servers</option>
                <option value="logs">Logs</option>
                <option value="settings">Settings</option>
              </select>
            </div>

            <div>
              <label className={classNames(
                "block text-sm font-medium mb-1",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>Status</label>
              <select
                value={filters.success}
                onChange={(e) => handleFilterChange('success', e.target.value)}
                className={classNames(
                  "w-full p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                  darkMode 
                    ? "bg-gray-700 text-gray-100 border-gray-600" 
                    : "bg-white text-gray-900 border-gray-300"
                )}
              >
                <option value="">All Status</option>
                <option value="true">Success</option>
                <option value="false">Failed</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={applyFilters}
              className={classNames(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105",
                "text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              )}
            >
              Apply Filters
            </button>
            <button
              onClick={clearFilters}
              className={classNames(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105",
                darkMode 
                  ? "text-gray-300 bg-gray-700 hover:bg-gray-600" 
                  : "text-gray-700 bg-gray-200 hover:bg-gray-300"
              )}
            >
              Clear Filters
            </button>
          </div>
        </Card>
      )}

      {/* Logs Table */}
      <Card className={classNames(
        "shadow-xl border-0 rounded-xl overflow-hidden",
        darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
      )}>
        <div className={classNames(
          "p-6 border-b",
          darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
        )}>
          <h3 className={classNames(
            "text-xl font-semibold",
            darkMode ? "text-white" : "text-gray-900"
          )}>📋 Activity Logs</h3>
          <span className={classNames(
            "text-sm font-medium",
            darkMode ? "text-gray-300" : "text-gray-600"
          )}>
            {totalLogs} total entries
          </span>
        </div>

        <div className={classNames(
          "p-6",
          darkMode ? "bg-gray-900" : "bg-white"
        )}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner className="text-blue-500" size="lg" />
              <span className={classNames(
                "ml-3 text-lg",
                darkMode ? "text-gray-300" : "text-gray-600"
              )}>Loading activity logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <div className={classNames(
                "text-6xl mb-4",
                darkMode ? "text-gray-600" : "text-gray-400"
              )}>📊</div>
              <h3 className={classNames(
                "text-xl font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>No activity logs found</h3>
              <p className={classNames(
                "text-sm",
                darkMode ? "text-gray-400" : "text-gray-500"
              )}>No dashboard activities match your current filters.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg">
                <table className={classNames(
                  "min-w-full divide-y-2",
                  darkMode ? "divide-gray-700" : "divide-gray-200"
                )}>
                  <thead className={classNames(
                    "rounded-t-lg",
                    darkMode ? "bg-gray-800" : "bg-gray-100"
                  )}>
                    <tr>
                      <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        🕐 Time
                      </th>
                      <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        👤 User
                      </th>
                      <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        📝 Action
                      </th>
                      <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        📄 Page
                      </th>
                      <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        🎯 Target
                      </th>
                      <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        ✅ Status
                      </th>
                      <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        🌐 IP Address
                      </th>
                    </tr>
                  </thead>
                  <tbody className={classNames(
                    "divide-y",
                    darkMode ? "bg-gray-900 divide-gray-800" : "bg-white divide-gray-100"
                  )}>
                    {logs.map((log) => (
                      <tr 
                        key={log.id} 
                        className={classNames(
                          "transition-all duration-200 hover:shadow-lg",
                          darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                        )}
                      >
                        <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm",
                          darkMode ? "text-gray-400" : "text-gray-500"
                        )}>
                          {formatDate(log.created_at)}
                        </td>
                        <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm font-semibold",
                          darkMode ? "text-gray-100" : "text-gray-900"
                        )}>
                          <div className="flex items-center space-x-2">
                            <div className={classNames(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                              darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
                            )}>
                              {(log.username || log.user_id).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div>{log.username || `User ${log.user_id.slice(-4)}`}</div>
                              <div className={classNames(
                                "text-xs",
                                darkMode ? "text-gray-500" : "text-gray-400"
                              )}>
                                {log.user_id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={classNames(
                            "inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold",
                            getActionTypeColor(log.action_type, log.success)
                          )}>
                            <span className="mr-2">{getActionIcon(log.action_type)}</span>
                            {log.action_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </td>
                        <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm font-medium",
                          darkMode ? "text-gray-200" : "text-gray-900"
                        )}>
                          <span className={classNames(
                            "inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium",
                            darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                          )}>
                            {log.page}
                          </span>
                        </td>
                        <td className={classNames(
                          "px-6 py-4 text-sm",
                          darkMode ? "text-gray-300" : "text-gray-600"
                        )}>
                          {log.target_type && log.target_id ? (
                            <div>
                              <div className="font-medium">{log.target_type}</div>
                              <div className="text-xs opacity-75">{log.target_id}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {log.success ? (
                            <span className={classNames(
                              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                              darkMode ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-800"
                            )}>
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                              Success
                            </span>
                          ) : (
                            <span className={classNames(
                              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                              darkMode ? "bg-red-900/30 text-red-300" : "bg-red-100 text-red-800"
                            )}>
                              <XCircleIcon className="h-3 w-3 mr-1" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm font-mono",
                          darkMode ? "text-gray-400" : "text-gray-500"
                        )}>
                          {log.ip_address || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    itemsPerPage={itemsPerPage}
                    totalItems={totalLogs}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

const DashboardLogs: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['view_logs', 'admin']}
      fallbackMessage="You need log viewing permissions to access dashboard activity logs."
    >
      <DashboardLogsContent />
    </PermissionGuard>
  );
};

export default DashboardLogs; 