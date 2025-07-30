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
  UserGroupIcon,
  BoltIcon,
  CircleStackIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
// import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface SystemMetrics {
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
}

interface DashboardStats {
  serverCount: number;
  activeTickets: number;
  totalWarnings: number;
  commandsUsed: number;
  recentActivity: any[];
}

interface SystemHealth {
  status: string;
  database: string;
  discord: string;
  responseTime: string;
  timestamp: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  // const { permissions } = useAuth(); // Currently unused
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load system metrics, dashboard stats, and health in parallel
      const [metricsResponse, statsResponse, healthResponse] = await Promise.all([
        apiService.getSystemMetrics(),
        apiService.getDashboardStats(),
        apiService.getSystemHealth()
      ]);

      if (metricsResponse.success && metricsResponse.data) {
        setSystemMetrics(metricsResponse.data);
      }

      if (statsResponse.success && statsResponse.data) {
        setDashboardStats(statsResponse.data);
      }

      if (healthResponse.success && healthResponse.data) {
        setSystemHealth(healthResponse.data);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  useEffect(() => {
    loadDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={classNames(
            "text-4xl font-bold",
            darkMode ? "text-white" : "text-gray-900"
          )}>
            Dashboard Overview
          </h1>
          <p className={classNames(
            "text-lg mt-2",
            darkMode ? "text-gray-400" : "text-gray-600"
          )}>
            System metrics, performance data, and real-time statistics
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={classNames(
            "flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors",
            darkMode ? "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100",
            refreshing ? "opacity-50 cursor-not-allowed" : ""
          )}
        >
          <ArrowPathIcon className={classNames("h-4 w-4", refreshing ? "animate-spin" : "")} />
          <span>Refresh</span>
        </button>
      </div>

      {/* System Health Status */}
      {systemHealth && (
        <div className="mb-8">
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={classNames(
                  "p-3 rounded-lg",
                  systemHealth.status === 'healthy' 
                    ? (darkMode ? "bg-green-900/20" : "bg-green-100")
                    : (darkMode ? "bg-red-900/20" : "bg-red-100")
                )}>
                  <SignalIcon className={classNames(
                    "h-6 w-6",
                    systemHealth.status === 'healthy'
                      ? (darkMode ? "text-green-400" : "text-green-600")
                      : (darkMode ? "text-red-400" : "text-red-600")
                  )} />
                </div>
                <div>
                  <h3 className={classNames("text-lg font-semibold", darkMode ? "text-white" : "text-gray-900")}>
                    System Status: {systemHealth.status === 'healthy' ? '🟢 Healthy' : '🔴 Unhealthy'}
                  </h3>
                  <p className={classNames("text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>
                    Database: {systemHealth.database} • Discord: {systemHealth.discord} • Response: {systemHealth.responseTime}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* System Metrics Cards */}
      {systemMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Uptime */}
          <Card>
            <div className="flex items-center">
              <div className={classNames(
                "p-3 rounded-lg mr-4",
                darkMode ? "bg-blue-900/20" : "bg-blue-100"
              )}>
                <ClockIcon className={classNames(
                  "h-6 w-6",
                  darkMode ? "text-blue-400" : "text-blue-600"
                )} />
              </div>
              <div>
                <p className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Bot Uptime
                </p>
                <p className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {systemMetrics.uptime}
                </p>
              </div>
            </div>
          </Card>

          {/* Memory Usage */}
          <Card>
            <div className="flex items-center">
              <div className={classNames(
                "p-3 rounded-lg mr-4",
                darkMode ? "bg-purple-900/20" : "bg-purple-100"
              )}>
                <CpuChipIcon className={classNames(
                  "h-6 w-6",
                  darkMode ? "text-purple-400" : "text-purple-600"
                )} />
              </div>
              <div>
                <p className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Memory Usage
                </p>
                <p className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {systemMetrics.memoryUsage.percentage}%
                </p>
                <p className={classNames(
                  "text-xs",
                  darkMode ? "text-gray-500" : "text-gray-500"
                )}>
                  {systemMetrics.memoryUsage.used} / {systemMetrics.memoryUsage.total}
                </p>
              </div>
            </div>
          </Card>

          {/* API Latency */}
          <Card>
            <div className="flex items-center">
              <div className={classNames(
                "p-3 rounded-lg mr-4",
                darkMode ? "bg-green-900/20" : "bg-green-100"
              )}>
                <BoltIcon className={classNames(
                  "h-6 w-6",
                  darkMode ? "text-green-400" : "text-green-600"
                )} />
              </div>
              <div>
                <p className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  API Response Time
                </p>
                <p className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {systemMetrics.apiLatency}
                </p>
              </div>
            </div>
          </Card>

          {/* Database Size */}
          <Card>
            <div className="flex items-center">
              <div className={classNames(
                "p-3 rounded-lg mr-4",
                darkMode ? "bg-yellow-900/20" : "bg-yellow-100"
              )}>
                <CircleStackIcon className={classNames(
                  "h-6 w-6",
                  darkMode ? "text-yellow-400" : "text-yellow-600"
                )} />
              </div>
              <div>
                <p className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Database Size
                </p>
                <p className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {systemMetrics.databaseSize}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Bot Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Guild Count */}
        <Card>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg mr-4",
              darkMode ? "bg-indigo-900/20" : "bg-indigo-100"
            )}>
              <ServerIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-indigo-400" : "text-indigo-600"
              )} />
            </div>
            <div>
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Discord Servers
              </p>
              <p className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {systemMetrics?.guildCount || 0}
              </p>
            </div>
          </div>
        </Card>

        {/* Total Users */}
        <Card>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg mr-4",
              darkMode ? "bg-pink-900/20" : "bg-pink-100"
            )}>
              <UserGroupIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-pink-400" : "text-pink-600"
              )} />
            </div>
            <div>
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Total Users
              </p>
              <p className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {systemMetrics?.totalUsers.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </Card>

        {/* Commands Executed (24h) */}
        <Card>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg mr-4",
              darkMode ? "bg-cyan-900/20" : "bg-cyan-100"
            )}>
              <CommandLineIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-cyan-400" : "text-cyan-600"
              )} />
            </div>
            <div>
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Commands (24h)
              </p>
              <p className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {systemMetrics?.commandsExecuted || 0}
              </p>
            </div>
          </div>
        </Card>

        {/* Messages Processed (24h) */}
        <Card>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg mr-4",
              darkMode ? "bg-orange-900/20" : "bg-orange-100"
            )}>
              <ChatBubbleLeftRightIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-orange-400" : "text-orange-600"
              )} />
            </div>
            <div>
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Messages (24h)
              </p>
              <p className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {systemMetrics?.messagesProcessed || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Dashboard Statistics (from existing API) */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="flex items-center">
              <div className={classNames(
                "p-3 rounded-lg mr-4",
                darkMode ? "bg-red-900/20" : "bg-red-100"
              )}>
                <TicketIcon className={classNames(
                  "h-6 w-6",
                  darkMode ? "text-red-400" : "text-red-600"
                )} />
              </div>
              <div>
                <p className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Active Tickets
                </p>
                <p className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {dashboardStats.activeTickets}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center">
              <div className={classNames(
                "p-3 rounded-lg mr-4",
                darkMode ? "bg-yellow-900/20" : "bg-yellow-100"
              )}>
                <ExclamationTriangleIcon className={classNames(
                  "h-6 w-6",
                  darkMode ? "text-yellow-400" : "text-yellow-600"
                )} />
              </div>
              <div>
                <p className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Total Warnings
                </p>
                <p className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {dashboardStats.totalWarnings}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Technical Information */}
      {systemMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <h3 className={classNames("text-lg font-semibold mb-4", darkMode ? "text-white" : "text-gray-900")}>
              System Information
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className={classNames("text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>
                  Node.js Version:
                </span>
                <span className={classNames("text-sm font-medium", darkMode ? "text-white" : "text-gray-900")}>
                  {systemMetrics.nodeVersion}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={classNames("text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>
                  Discord.js Version:
                </span>
                <span className={classNames("text-sm font-medium", darkMode ? "text-white" : "text-gray-900")}>
                  {systemMetrics.discordJsVersion}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={classNames("text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>
                  Last Restart:
                </span>
                <span className={classNames("text-sm font-medium", darkMode ? "text-white" : "text-gray-900")}>
                  {new Date(systemMetrics.lastRestart).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={classNames("text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>
                  CPU Usage:
                </span>
                <span className={classNames("text-sm font-medium", darkMode ? "text-white" : "text-gray-900")}>
                  {systemMetrics.systemLoad.cpu}%
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className={classNames("text-lg font-semibold mb-4", darkMode ? "text-white" : "text-gray-900")}>
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/servers')}
                className={classNames(
                  "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                  darkMode ? "border-gray-700 hover:bg-gray-700" : "border-gray-200 hover:bg-gray-50"
                )}
              >
                <span className={classNames("text-sm font-medium", darkMode ? "text-white" : "text-gray-900")}>
                  Manage Servers
                </span>
                <ServerIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/dashboard-logs')}
                className={classNames(
                  "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                  darkMode ? "border-gray-700 hover:bg-gray-700" : "border-gray-200 hover:bg-gray-50"
                )}
              >
                <span className={classNames("text-sm font-medium", darkMode ? "text-white" : "text-gray-900")}>
                  View Activity Logs
                </span>
                <ChartBarIcon className="h-4 w-4" />
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;