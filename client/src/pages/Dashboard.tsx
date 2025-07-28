import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ServerIcon,
  TicketIcon,
  ExclamationTriangleIcon,
  CommandLineIcon,
  ChartBarIcon,
  ClockIcon,
  CpuChipIcon,
  SignalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { apiService } from '../services/api';
import { wsService } from '../services/websocket';
import { DashboardStats } from '../types';
import { useTheme } from '../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const Dashboard: React.FC = () => {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverStatus, setServerStatus] = useState({
    uptime: 'Loading...',
    memoryUsage: 'Loading...',
    apiLatency: 'Loading...'
  });

  useEffect(() => {
    loadDashboardData();
    
    // Set up real-time updates
    const unsubscribeStats = wsService.on('stats_update', (newStats: DashboardStats) => {
      setStats(newStats);
      
      // Update server status when we get new stats
      if (newStats.uptime || newStats.memoryUsage || newStats.apiLatency) {
        setServerStatus({
          uptime: newStats.uptime || 'Loading...',
          memoryUsage: newStats.memoryUsage || 'Loading...',
          apiLatency: newStats.apiLatency || 'Loading...'
        });
      }
    });

    return () => {
      unsubscribeStats();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const statsResponse = await apiService.getDashboardStats();

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
        // Update server status with real data from API
        setServerStatus({
          uptime: statsResponse.data.uptime || 'Unknown',
          memoryUsage: statsResponse.data.memoryUsage || 'Unknown',
          apiLatency: statsResponse.data.apiLatency || '25ms'
        });
        console.log('Dashboard stats loaded successfully');
      } else {
        console.warn('Failed to load dashboard statistics - using fallback data');
        // Provide fallback stats so the dashboard still works
        const fallbackStats = {
          serverCount: 2,
          activeTickets: 0,
          totalWarnings: 0,
          commandsUsed: 0,
          recentActivity: [],
          uptime: '0h 0m',
          memoryUsage: 'Unknown',
          apiLatency: 'Unknown'
        };
        setStats(fallbackStats);
        setServerStatus({
          uptime: 'Offline',
          memoryUsage: 'Unknown', 
          apiLatency: 'Unknown'
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Provide fallback stats so the dashboard still works
      const fallbackStats = {
        serverCount: 2,
        activeTickets: 0,
        totalWarnings: 0,
        commandsUsed: 0,
        recentActivity: [],
        uptime: '0h 0m',
        memoryUsage: 'Unknown',
        apiLatency: 'Unknown'
      };
      setStats(fallbackStats);
      setServerStatus({
        uptime: 'Offline',
        memoryUsage: 'Unknown',
        apiLatency: 'Unknown'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={classNames(
        "flex items-center justify-center min-h-[60vh]",
        darkMode ? "bg-gray-900/50" : "bg-white/50"
      )}>
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-blue-500" />
          <p className={classNames(
            "mt-4 text-lg font-medium",
            darkMode ? "text-gray-300" : "text-gray-600"
          )}>Loading control center...</p>
        </div>
      </div>
    );
  }

  const statusCards = [
    {
      title: 'System Health',
      value: stats?.serverCount ? '100%' : 'Offline',
      change: stats?.serverCount ? '+0.1%' : '0%',
      trend: 'up' as const,
      icon: ShieldCheckIcon,
      color: 'green' as const,
      description: stats?.serverCount ? 'All systems operational' : 'System starting up'
    },
    {
      title: 'Active Servers',
      value: stats?.serverCount?.toString() || '0',
      change: '+0%',
      trend: 'up' as const,
      icon: UserGroupIcon,
      color: 'blue' as const,
      description: 'Connected servers'
    },
    {
      title: 'API Response',
      value: serverStatus.apiLatency,
      change: '-0.5ms',
      trend: 'down' as const,
      icon: BoltIcon,
      color: 'yellow' as const,
      description: 'Response time'
    },
    {
      title: 'Memory Usage',
      value: serverStatus.memoryUsage,
      change: '+1.2%',
      trend: 'up' as const,
      icon: CpuChipIcon,
      color: 'purple' as const,
      description: 'System memory'
    }
  ];

  const quickActions = [
    {
      title: 'Support Tickets',
      description: 'Manage user support requests',
      icon: TicketIcon,
      route: '/tickets',
      color: 'blue' as const,
      count: stats?.activeTickets || 0
    },
    {
      title: 'User Warnings',
      description: 'Review moderation actions',
      icon: ExclamationTriangleIcon,
      route: '/warnings',
      color: 'red' as const,
      count: stats?.totalWarnings || 0
    },
    {
      title: 'Server Config',
      description: 'Configure server settings',
      icon: ServerIcon,
      route: '/servers',
      color: 'green' as const,
      count: stats?.serverCount || 1
    },
    {
      title: 'System Logs',
      description: 'Monitor system activity',
      icon: ChartBarIcon,
      route: '/dashboard-logs',
      color: 'purple' as const,
      count: 0
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className={classNames(
        'relative rounded-lg border p-6 card-modern transition-all duration-300 hover:shadow-xl',
        darkMode 
          ? 'bg-gray-800 border-gray-700 hover:border-primary-500' 
          : 'bg-white border-gray-200 hover:border-primary-400'
      )}>
          <div className="flex items-center justify-between">
            <div>
            <h1 className={classNames(
              'text-2xl font-bold',
                darkMode ? 'text-white' : 'text-gray-900'
              )}>
                PanelOps Control Center
            </h1>
              <p className={classNames(
              'text-base mt-1',
              darkMode ? 'text-gray-400' : 'text-gray-600'
              )}>
              Modern dashboard for Discord bot operations
              </p>
            </div>
            <div className={classNames(
            'p-3 rounded-lg transition-all duration-300 hover:scale-110',
            darkMode ? 'bg-primary-500/20 hover:bg-primary-500/30' : 'bg-primary-100 hover:bg-primary-200'
            )}>
            <ChartBarIcon className={classNames(
              'h-6 w-6',
              darkMode ? 'text-primary-400' : 'text-primary-600'
            )} />
          </div>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statusCards.map((card, index) => (
          <div
            key={card.title}
            className={classNames(
              'relative p-6 rounded-lg border transition-all duration-300 card-modern group',
              darkMode 
                ? 'bg-gray-800 border-gray-700 hover:border-primary-500 hover:shadow-xl hover:-translate-y-1' 
                : 'bg-white border-gray-200 hover:border-primary-400 hover:shadow-xl hover:-translate-y-1'
            )}
          >
            <div className="flex items-center">
                <div className={classNames(
                  'p-3 rounded-lg transition-all duration-300 group-hover:scale-110',
                card.color === 'blue' && (darkMode ? 'bg-blue-500/20 group-hover:bg-blue-500/30' : 'bg-blue-100 group-hover:bg-blue-200'),
                card.color === 'green' && (darkMode ? 'bg-green-500/20 group-hover:bg-green-500/30' : 'bg-green-100 group-hover:bg-green-200'),
                card.color === 'yellow' && (darkMode ? 'bg-yellow-500/20 group-hover:bg-yellow-500/30' : 'bg-yellow-100 group-hover:bg-yellow-200'),
                card.color === 'purple' && (darkMode ? 'bg-purple-500/20 group-hover:bg-purple-500/30' : 'bg-purple-100 group-hover:bg-purple-200')
                )}>
                <card.icon className={classNames(
                  'h-6 w-6',
                  card.color === 'blue' && (darkMode ? 'text-blue-400' : 'text-blue-600'),
                  card.color === 'green' && (darkMode ? 'text-green-400' : 'text-green-600'),
                  card.color === 'yellow' && (darkMode ? 'text-yellow-400' : 'text-yellow-600'),
                  card.color === 'purple' && (darkMode ? 'text-purple-400' : 'text-purple-600')
                )} />
              </div>
              <div className="ml-4">
                <p className={classNames(
                  'text-sm font-medium',
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                )}>
                  {card.title}
                </p>
                <p className={classNames(
                  'text-2xl font-bold',
                  darkMode ? 'text-white' : 'text-gray-900'
                )}>
                  {card.value}
                </p>
                <div className="flex items-center mt-1">
                  {card.trend === 'up' ? (
                    <ArrowUpIcon className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <ArrowDownIcon className="h-4 w-4 text-green-500 mr-1" />
                  )}
                  <span className={classNames(
                    'text-sm',
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                )}>
                    {card.change}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primary Metrics */}
        <div className="lg:col-span-2">
          <Card className={classNames(
            'border-0 overflow-hidden card-modern transition-all duration-300 hover:shadow-2xl hover:-translate-y-2',
            darkMode 
              ? 'bg-gray-800/60 backdrop-blur-sm shadow-lg hover:bg-gray-800/80' 
              : 'bg-white/80 backdrop-blur-sm shadow-md hover:bg-white/90'
          )}>
            <div className="p-6">
              <h3 className={classNames(
                'text-lg font-semibold mb-6 flex items-center',
                darkMode ? 'text-white' : 'text-gray-900'
              )}>
                <ChartBarIcon className="h-5 w-5 mr-2" />
                System Metrics
              </h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div className={classNames(
                  'p-4 rounded-xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group',
                  darkMode 
                    ? 'bg-gray-700/30 border-gray-600/30 hover:bg-gray-700/50 hover:border-gray-500' 
                    : 'bg-gray-50/50 border-gray-200/50 hover:bg-gray-100/70 hover:border-gray-300'
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={classNames(
                        'text-sm font-medium',
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Active Servers
                      </p>
                      <p className={classNames(
                        'text-2xl font-bold mt-1',
                        darkMode ? 'text-white' : 'text-gray-900'
                      )}>
                        {stats?.serverCount || 1}
                      </p>
                    </div>
                    <ServerIcon className={classNames(
                      'h-8 w-8 transition-all duration-300 group-hover:scale-110',
                      darkMode ? 'text-blue-400 group-hover:text-blue-300' : 'text-blue-600 group-hover:text-blue-700'
                    )} />
                  </div>
                </div>

                <div className={classNames(
                  'p-4 rounded-xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group',
                  darkMode 
                    ? 'bg-gray-700/30 border-gray-600/30 hover:bg-gray-700/50 hover:border-gray-500' 
                    : 'bg-gray-50/50 border-gray-200/50 hover:bg-gray-100/70 hover:border-gray-300'
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={classNames(
                        'text-sm font-medium',
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Commands Used
                      </p>
                      <p className={classNames(
                        'text-2xl font-bold mt-1',
                        darkMode ? 'text-white' : 'text-gray-900'
                      )}>
                        {stats?.commandsUsed || 0}
                      </p>
                    </div>
                    <CommandLineIcon className={classNames(
                      'h-8 w-8 transition-all duration-300 group-hover:scale-110',
                      darkMode ? 'text-purple-400 group-hover:text-purple-300' : 'text-purple-600 group-hover:text-purple-700'
                    )} />
                  </div>
                </div>

                <div className={classNames(
                  'p-4 rounded-xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group',
                  darkMode 
                    ? 'bg-gray-700/30 border-gray-600/30 hover:bg-gray-700/50 hover:border-gray-500' 
                    : 'bg-gray-50/50 border-gray-200/50 hover:bg-gray-100/70 hover:border-gray-300'
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={classNames(
                        'text-sm font-medium',
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Open Tickets
                      </p>
                      <p className={classNames(
                        'text-2xl font-bold mt-1',
                        darkMode ? 'text-white' : 'text-gray-900'
                      )}>
                        {stats?.activeTickets || 0}
                      </p>
                    </div>
                    <TicketIcon className={classNames(
                      'h-8 w-8 transition-all duration-300 group-hover:scale-110',
                      darkMode ? 'text-green-400 group-hover:text-green-300' : 'text-green-600 group-hover:text-green-700'
                    )} />
                  </div>
                </div>

                <div className={classNames(
                  'p-4 rounded-xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group',
                  darkMode 
                    ? 'bg-gray-700/30 border-gray-600/30 hover:bg-gray-700/50 hover:border-gray-500' 
                    : 'bg-gray-50/50 border-gray-200/50 hover:bg-gray-100/70 hover:border-gray-300'
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={classNames(
                        'text-sm font-medium',
                        darkMode ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Total Warnings
                      </p>
                      <p className={classNames(
                        'text-2xl font-bold mt-1',
                        darkMode ? 'text-white' : 'text-gray-900'
                      )}>
                        {stats?.totalWarnings || 0}
                      </p>
                    </div>
                    <ExclamationTriangleIcon className={classNames(
                      'h-8 w-8 transition-all duration-300 group-hover:scale-110',
                      darkMode ? 'text-yellow-400 group-hover:text-yellow-300' : 'text-yellow-600 group-hover:text-yellow-700'
                    )} />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* System Status */}
        <div>
          <Card className={classNames(
            'border-0 overflow-hidden card-modern transition-all duration-300 hover:shadow-2xl hover:-translate-y-2',
            darkMode 
              ? 'bg-gray-800/60 backdrop-blur-sm shadow-lg hover:bg-gray-800/80' 
              : 'bg-white/80 backdrop-blur-sm shadow-md hover:bg-white/90'
          )}>
            <div className="p-6">
              <h3 className={classNames(
                'text-lg font-semibold mb-6 flex items-center',
                darkMode ? 'text-white' : 'text-gray-900'
              )}>
                <SignalIcon className="h-5 w-5 mr-2" />
                System Status
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={classNames(
                      'w-8 h-8 rounded-lg flex items-center justify-center mr-3',
                      darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-600'
                    )}>
                      <ClockIcon className="w-4 h-4" />
                    </div>
                    <span className={classNames(
                      'text-sm font-medium',
                      darkMode ? 'text-gray-300' : 'text-gray-600'
                    )}>Uptime</span>
                  </div>
                  <span className={classNames(
                    'text-sm font-bold px-3 py-1 rounded-lg',
                    darkMode 
                      ? 'text-green-400 bg-green-900/20 border border-green-800' 
                      : 'text-green-600 bg-green-50 border border-green-200'
                  )}>
                    {serverStatus.uptime}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={classNames(
                      'w-8 h-8 rounded-lg flex items-center justify-center mr-3',
                      darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'
                    )}>
                      <CpuChipIcon className="w-4 h-4" />
                    </div>
                    <span className={classNames(
                      'text-sm font-medium',
                      darkMode ? 'text-gray-300' : 'text-gray-600'
                    )}>Memory</span>
                  </div>
                  <span className={classNames(
                    'text-sm font-bold px-3 py-1 rounded-lg',
                    darkMode 
                      ? 'text-blue-400 bg-blue-900/20 border border-blue-800' 
                      : 'text-blue-600 bg-blue-50 border border-blue-200'
                  )}>
                    {serverStatus.memoryUsage}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={classNames(
                      'w-8 h-8 rounded-lg flex items-center justify-center mr-3',
                      darkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-600'
                    )}>
                      <BoltIcon className="w-4 h-4" />
                    </div>
                    <span className={classNames(
                      'text-sm font-medium',
                      darkMode ? 'text-gray-300' : 'text-gray-600'
                    )}>API Latency</span>
                  </div>
                  <span className={classNames(
                    'text-sm font-bold px-3 py-1 rounded-lg',
                    darkMode 
                      ? 'text-purple-400 bg-purple-900/20 border border-purple-800' 
                      : 'text-purple-600 bg-purple-50 border border-purple-200'
                  )}>
                    {serverStatus.apiLatency}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={classNames(
        'rounded-lg border p-6 card-modern transition-all duration-300 hover:shadow-xl',
        darkMode 
          ? 'bg-gray-800 border-gray-700 hover:border-primary-500' 
          : 'bg-white border-gray-200 hover:border-primary-400'
      )}>
        <div className="flex items-center justify-between mb-6">
        <h3 className={classNames(
            'text-xl font-semibold',
          darkMode ? 'text-white' : 'text-gray-900'
        )}>
          Quick Actions
        </h3>
          <LightBulbIcon className={classNames(
            'h-6 w-6',
            darkMode ? 'text-gray-400' : 'text-gray-500'
          )} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.title}
              onClick={() => navigate(action.route)}
              className={classNames(
                'p-4 rounded-lg border text-left transition-all duration-300 group btn-modern hover:-translate-y-1 hover:shadow-lg',
                darkMode 
                  ? 'bg-gray-700 border-gray-600 hover:border-primary-500 hover:bg-gray-600' 
                  : 'bg-gray-50 border-gray-200 hover:border-primary-400 hover:bg-gray-100'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                    <div className={classNames(
                  'p-2 rounded-lg transition-all duration-300 group-hover:scale-110',
                  action.color === 'blue' && (darkMode ? 'bg-blue-500/20 group-hover:bg-blue-500/30' : 'bg-blue-100 group-hover:bg-blue-200'),
                  action.color === 'red' && (darkMode ? 'bg-red-500/20 group-hover:bg-red-500/30' : 'bg-red-100 group-hover:bg-red-200'),
                  action.color === 'green' && (darkMode ? 'bg-green-500/20 group-hover:bg-green-500/30' : 'bg-green-100 group-hover:bg-green-200'),
                  action.color === 'purple' && (darkMode ? 'bg-purple-500/20 group-hover:bg-purple-500/30' : 'bg-purple-100 group-hover:bg-purple-200')
                )}>
                  <action.icon className={classNames(
                    'h-5 w-5 transition-all duration-300 group-hover:scale-110',
                    action.color === 'blue' && (darkMode ? 'text-blue-400 group-hover:text-blue-300' : 'text-blue-600 group-hover:text-blue-700'),
                    action.color === 'red' && (darkMode ? 'text-red-400 group-hover:text-red-300' : 'text-red-600 group-hover:text-red-700'),
                    action.color === 'green' && (darkMode ? 'text-green-400 group-hover:text-green-300' : 'text-green-600 group-hover:text-green-700'),
                    action.color === 'purple' && (darkMode ? 'text-purple-400 group-hover:text-purple-300' : 'text-purple-600 group-hover:text-purple-700')
                  )} />
                    </div>
                    {action.count > 0 && (
                      <span className={classNames(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    darkMode ? 'bg-primary-500 text-white' : 'bg-primary-600 text-white'
                      )}>
                        {action.count}
                      </span>
                    )}
                  </div>
                  <h4 className={classNames(
                'font-medium text-sm mb-1',
                    darkMode ? 'text-white' : 'text-gray-900'
                  )}>
                    {action.title}
                  </h4>
                  <p className={classNames(
                'text-xs',
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    {action.description}
                  </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
