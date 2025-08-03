import React, { useState, useMemo } from 'react';
import { 
  ClockIcon,
  UserIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ServerIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FilterSystem, { FilterField } from '../components/common/FilterSystem';
import SortableTableHeader, { SortConfig } from '../components/common/SortableTableHeader';
import { useTheme } from '../contexts/ThemeContext';
import { useActivityLogs } from '../hooks/useActivityLogs';
import { formatDashboardLogDate } from '../utils/dateUtils';


// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}


const DashboardLogs: React.FC = () => {
  const { darkMode } = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Filters
  const [userIdFilter, setUserIdFilter] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [guildIdFilter, setGuildIdFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>();

  // Memoize filters to prevent unnecessary re-renders
  const filters = useMemo(() => ({
    page: page + 1,
    limit: rowsPerPage,
    userId: userIdFilter || undefined,
    actionType: actionTypeFilter || undefined,
    guildId: guildIdFilter || undefined,
  }), [page, rowsPerPage, userIdFilter, actionTypeFilter, guildIdFilter]);

  // Use the activity logs hook with real-time updates
  const {
    logs,
    loading,
    error,
    pagination
  } = useActivityLogs({
    filters,
    realTimeUpdates: true,
    autoRefresh: 30000 // Refresh every 30 seconds (now working correctly)
  });

  // Batch operations hook
  // const { exportLogs } = useBatchActivityLogs();

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (newRowsPerPage: number) => {
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

  const getActionTypeColor = (actionType: string) => {
    const type = actionType.toLowerCase();
    
    // Handle verification actions
    if (type.includes('verification success')) {
      return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
    }
    if (type.includes('verification failed')) {
      return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
    }
    
    // Handle other actions
    switch (type) {
      case 'login':
      case 'user login':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
      case 'logout':
      case 'user logout':
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
      case 'export_data':
      case 'data export':
        return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
      case 'manage_warnings':
      case 'manage warnings':
      case 'manage_tickets':
      case 'manage tickets':
      case 'manage_settings':
      case 'manage settings':
      case 'update_server_settings':
      case 'update server settings':
      case 'update_settings':
      case 'update settings':
      case 'update_ticket':
      case 'update_warning':
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
      case 'create_ticket':
      case 'create ticket':
      case 'create_warning':
      case 'create warning':
      case 'create_resource':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
      case 'delete_ticket':
      case 'delete ticket':
      case 'delete_warning':
      case 'delete warning':
      case 'delete_resource':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
      case 'admin':
      case 'system_admin':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
    }
  };

  const formatUserAgent = (userAgent?: string) => {
    if (!userAgent) return 'Unknown';
    
    // Extract browser info
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    
    return 'Other';
  };

  // Filter configuration
  const filterFields: FilterField[] = [
    {
      key: 'userId',
      label: 'User ID',
      type: 'text',
      placeholder: 'Search by user ID...',
      value: userIdFilter,
      onChange: setUserIdFilter,
      width: 'md',
      icon: <UserIcon className="h-4 w-4" />
    },
    {
      key: 'actionType',
      label: 'Action Type',
      type: 'select',
      placeholder: 'All Actions',
      value: actionTypeFilter,
      onChange: setActionTypeFilter,
      width: 'md',
      icon: <BoltIcon className="h-4 w-4" />,
      options: [
        { value: 'login', label: 'Login' },
        { value: 'logout', label: 'Logout' },
        { value: 'view_page', label: 'View Page' },
        { value: 'view_logs', label: 'View Logs' },
        { value: 'manage_warnings', label: 'Manage Warnings' },
        { value: 'manage_tickets', label: 'Manage Tickets' },
        { value: 'manage_settings', label: 'Manage Settings' },
        { value: 'update_server_settings', label: 'Update Server Settings' },
        { value: 'export_data', label: 'Export Data' },
        { value: 'create_ticket', label: 'Create Ticket' },
        { value: 'create_warning', label: 'Create Warning' },
        { value: 'update_ticket', label: 'Update Ticket' },
        { value: 'update_warning', label: 'Update Warning' },
        { value: 'delete_ticket', label: 'Delete Ticket' },
        { value: 'delete_warning', label: 'Delete Warning' },
        { value: 'admin', label: 'Admin' },
        { value: 'xp_management', label: 'XP Management' },
        { value: 'xp_modification', label: 'XP Modification' },
        { value: 'level_reset', label: 'Level Reset' }
      ]
    },
    {
      key: 'guildId',
      label: 'Guild ID',
      type: 'text',
      placeholder: 'Search by guild ID...',
      value: guildIdFilter,
      onChange: setGuildIdFilter,
      width: 'md',
      icon: <ServerIcon className="h-4 w-4" />
    }
  ];

  // Client-side sorting of logs based on current sort config
  const sortedLogs = useMemo(() => {
    if (!sortConfig || !logs) return logs;

    return [...logs].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof typeof a];
      let bValue: any = b[sortConfig.key as keyof typeof b];

      // Handle different data types
      if (sortConfig.key === 'timestamp') {
        aValue = new Date(a.timestamp as string).getTime();
        bValue = new Date(b.timestamp as string).getTime();
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [logs, sortConfig]);

  const handleClearAllFilters = () => {
    setUserIdFilter('');
    setActionTypeFilter('');
    setGuildIdFilter('');
    setSortConfig(undefined);
  };

  // Use the proper Israeli date formatting utility
  const formatDate = (dateString: string) => {
    return formatDashboardLogDate(dateString);
  };

  const totalPages = Math.ceil((pagination?.total || 0) / rowsPerPage);

  if (loading && (logs || []).length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className={classNames(
            "mt-4 text-lg font-medium",
            darkMode ? "text-gray-300" : "text-gray-600"
          )}>Loading dashboard logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={classNames(
          "text-3xl font-bold",
          darkMode ? "text-white" : "text-gray-900"
        )}>
          Dashboard Activity Logs
        </h1>
        <p className={classNames(
          "mt-2 text-sm",
          darkMode ? "text-gray-400" : "text-gray-600"
        )}>
          Monitor all dashboard activity and user actions across your servers.
          <span className={classNames(
            "ml-2 px-2 py-1 rounded text-xs font-medium",
            darkMode ? "bg-blue-900/30 text-blue-300" : "bg-blue-100 text-blue-700"
          )}>
            🇮🇱 Israeli Time (UTC+3)
          </span>
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error loading logs
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className={classNames(
                    "text-sm font-medium truncate",
                    darkMode ? "text-gray-400" : "text-gray-500"
                  )}>
                    Total Logs
                  </dt>
                  <dd className={classNames(
                    "text-lg font-medium",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    {pagination?.total?.toLocaleString() || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className={classNames(
                    "text-sm font-medium truncate",
                    darkMode ? "text-gray-400" : "text-gray-500"
                  )}>
                    Unique Users
                  </dt>
                  <dd className={classNames(
                    "text-lg font-medium",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    {new Set((logs || []).map(log => log.user)).size}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className={classNames(
                    "text-sm font-medium truncate",
                    darkMode ? "text-gray-400" : "text-gray-500"
                  )}>
                    Success Rate
                  </dt>
                  <dd className={classNames(
                    "text-lg font-medium",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    {(logs || []).length > 0 ? Math.round(((logs || []).filter(log => log.details !== 'Failed').length / (logs || []).length) * 100) : 0}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ComputerDesktopIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className={classNames(
                    "text-sm font-medium truncate",
                    darkMode ? "text-gray-400" : "text-gray-500"
                  )}>
                    Current Page
                  </dt>
                  <dd className={classNames(
                    "text-lg font-medium",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    {page + 1} of {totalPages}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <FilterSystem
        fields={filterFields}
        onClearAll={handleClearAllFilters}
        collapsible={true}
        defaultCollapsed={false}
        showActiveCount={true}
      />

      {/* Logs Table */}
      <Card>
        <div className="px-4 py-5 sm:p-6">
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
              <thead className={classNames(
                darkMode ? "bg-gray-800" : "bg-gray-50"
              )}>
                <tr>
                  <SortableTableHeader
                    label="User"
                    sortKey="user"
                    currentSort={sortConfig}
                    onSort={setSortConfig}
                  />
                  <SortableTableHeader
                    label="Action"
                    sortKey="type"
                    currentSort={sortConfig}
                    onSort={setSortConfig}
                  />
                  <SortableTableHeader
                    label="Page"
                    sortKey="serverName"
                    currentSort={sortConfig}
                    onSort={setSortConfig}
                  />
                  <SortableTableHeader
                    label="Status"
                    sortKey="details"
                    currentSort={sortConfig}
                    onSort={setSortConfig}
                  />
                  <SortableTableHeader
                    label="Time"
                    sortKey="timestamp"
                    currentSort={sortConfig}
                    onSort={setSortConfig}
                  />
                  <th className={classNames(
                    "px-6 py-3 text-left text-xs font-medium uppercase tracking-wider",
                    darkMode ? "text-gray-300" : "text-gray-500"
                  )}>
                    Browser
                  </th>
                </tr>
              </thead>
              <tbody className={classNames(
                "divide-y divide-gray-200 dark:divide-gray-700",
                darkMode ? "bg-gray-900" : "bg-white"
              )}>
                {(sortedLogs || []).map((log) => (
                  <tr key={log.id} className={classNames(
                    darkMode ? "hover:bg-gray-800" : "hover:bg-gray-50"
                  )}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className={classNames(
                            "h-8 w-8 rounded-full flex items-center justify-center",
                            darkMode ? "bg-gray-700" : "bg-gray-200"
                          )}>
                            <UserIcon className="h-4 w-4 text-gray-500" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className={classNames(
                            "text-sm font-medium",
                            darkMode ? "text-white" : "text-gray-900"
                          )}>
                            {log.user || 'Unknown'}
                          </div>
                          <div className={classNames(
                            "text-sm",
                            darkMode ? "text-gray-400" : "text-gray-500"
                          )}>
                            {log.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={classNames(
                        "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
                        getActionTypeColor(log.actionDisplay || log.type)
                      )}>
                        {log.actionDisplay || log.type}
                      </span>
                    </td>
                    <td className={classNames(
                      "px-6 py-4 whitespace-nowrap text-sm",
                      darkMode ? "text-gray-300" : "text-gray-900"
                    )}>
                      {log.serverName || log.serverId || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {log.details !== 'Failed' ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircleIcon className="h-5 w-5 text-red-500" />
                        )}
                        <span className={classNames(
                          "ml-2 text-sm",
                          log.details !== 'Failed'
                            ? "text-green-600 dark:text-green-400" 
                            : "text-red-600 dark:text-red-400"
                        )}>
                          {log.details !== 'Failed' ? 'Success' : 'Failed'}
                        </span>
                      </div>
                    </td>
                    <td className={classNames(
                      "px-6 py-4 whitespace-nowrap text-sm",
                      darkMode ? "text-gray-300" : "text-gray-500"
                    )}>
                      {formatDate(log.timestamp)}
                    </td>
                    <td className={classNames(
                      "px-6 py-4 whitespace-nowrap text-sm",
                      darkMode ? "text-gray-300" : "text-gray-500"
                    )}>
                      {formatUserAgent('Dashboard')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => handleChangePage(page - 1)}
                disabled={page === 0}
                className={classNames(
                  "relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50",
                  page === 0 ? "opacity-50 cursor-not-allowed" : ""
                )}
              >
                Previous
              </button>
              <button
                onClick={() => handleChangePage(page + 1)}
                disabled={page >= totalPages - 1}
                className={classNames(
                  "relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50",
                  page >= totalPages - 1 ? "opacity-50 cursor-not-allowed" : ""
                )}
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className={classNames(
                  "text-sm",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Showing <span className="font-medium">{page * rowsPerPage + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min((page + 1) * rowsPerPage, pagination?.total || 0)}
                  </span>{' '}
                  of <span className="font-medium">{pagination?.total || 0}</span> results
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={rowsPerPage}
                  onChange={(e) => handleChangeRowsPerPage(Number(e.target.value))}
                  className={classNames(
                    "rounded-md border-gray-300 text-sm",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  )}
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => handleChangePage(page - 1)}
                    disabled={page === 0}
                    className={classNames(
                      "relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0",
                      page === 0 ? "opacity-50 cursor-not-allowed" : "",
                      darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white"
                    )}
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => handleChangePage(page + 1)}
                    disabled={page >= totalPages - 1}
                    className={classNames(
                      "relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0",
                      page >= totalPages - 1 ? "opacity-50 cursor-not-allowed" : "",
                      darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-white"
                    )}
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DashboardLogs; 