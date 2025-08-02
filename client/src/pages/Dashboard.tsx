import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ServerIcon,
  TicketIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
  SignalIcon,
  UserGroupIcon,
  BoltIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
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
  const { user, permissions } = useAuth();
  
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
      <div className="page-container flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-container p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground">
            Welcome back, {user?.username || 'User'}!
          </h1>
          <p className="text-lg mt-2 text-muted-foreground">
            Your servers, permissions, and activity overview
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={classNames(
            "btn-refresh",
            refreshing ? "spinning" : ""
          )}
        >
          <ArrowPathIcon className="icon" />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* User Access Status */}
      <div className="mb-8">
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${
                permissions.length > 0 
                  ? "bg-success/20" 
                  : "bg-destructive/20"
              }`}>
                <SignalIcon className={`h-6 w-6 ${
                  permissions.length > 0
                    ? "text-success"
                    : "text-destructive"
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Access Status: {permissions.length > 0 ? '🟢 Active' : '🔴 Limited'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Servers: {user?.accessibleServers?.length || 0} • Permissions: {permissions.length} • {systemHealth?.responseTime ? `Response: ${systemHealth.responseTime}` : 'Ready'}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* System Status (simplified) */}
      {systemMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
          {/* Bot Status */}
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
                <p className="text-sm font-medium text-muted-foreground">
                  Bot Status
                </p>
                <p className="text-2xl font-bold text-foreground">
                  🟢 Online
                </p>
                <p className="text-xs text-muted-foreground">
                  Uptime: {systemMetrics.uptime}
                </p>
              </div>
            </div>
          </Card>

          {/* Connection Speed */}
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
                <p className="text-sm font-medium text-muted-foreground">
                  Connection Speed
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {systemMetrics.apiLatency}
                </p>
                <p className="text-xs text-muted-foreground">
                  Response time
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Bot Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* User's Accessible Servers */}
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
              <p className="text-sm font-medium text-muted-foreground">
                Your Servers
              </p>
              <p className="text-2xl font-bold text-foreground">
                {user?.accessibleServers?.length || 0}
              </p>
            </div>
          </div>
        </Card>

        {/* User's Permissions */}
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
              <p className="text-sm font-medium text-muted-foreground">
                Your Permissions
              </p>
              <p className="text-2xl font-bold text-foreground">
                {permissions.length || 0}
              </p>
            </div>
          </div>
        </Card>

        {/* Active Tickets */}
        <Card>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg mr-4",
              darkMode ? "bg-cyan-900/20" : "bg-cyan-100"
            )}>
              <TicketIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-cyan-400" : "text-cyan-600"
              )} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Active Tickets
              </p>
              <p className="text-2xl font-bold text-foreground">
                {dashboardStats?.activeTickets || 0}
              </p>
            </div>
          </div>
        </Card>

        {/* Total Warnings */}
        <Card>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg mr-4",
              darkMode ? "bg-orange-900/20" : "bg-orange-100"
            )}>
              <ExclamationTriangleIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-orange-400" : "text-orange-600"
              )} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Warnings
              </p>
              <p className="text-2xl font-bold text-foreground">
                {dashboardStats?.totalWarnings || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>


      {/* User Information & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4 text-foreground">
            Your Access
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Username:
              </span>
              <span className="text-sm font-medium text-foreground">
                {user?.username}#{user?.discriminator}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Accessible Servers:
              </span>
              <span className="text-sm font-medium text-foreground">
                {user?.accessibleServers?.length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Permissions:
              </span>
              <span className="text-sm font-medium text-foreground">
                {permissions.length} roles
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Admin Access:
              </span>
              <span className="text-sm font-medium text-foreground">
                {user?.isAdmin ? '✅ Yes' : '❌ No'}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4 text-foreground">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/servers')}
              className="w-full flex items-center justify-between p-3 rounded-lg border transition-colors border-border hover:bg-muted"
            >
              <span className="text-sm font-medium text-foreground">
                Manage Your Servers
              </span>
              <ServerIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="w-full flex items-center justify-between p-3 rounded-lg border transition-colors border-border hover:bg-muted"
            >
              <span className="text-sm font-medium text-foreground">
                View Profile
              </span>
              <UserGroupIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/dashboard-logs')}
              className="w-full flex items-center justify-between p-3 rounded-lg border transition-colors border-border hover:bg-muted"
            >
              <span className="text-sm font-medium text-foreground">
                View Activity Logs
              </span>
              <ChartBarIcon className="h-4 w-4" />
            </button>
          </div>
        </Card>
      </div>

      {/* Your Servers */}
      {user?.accessibleServers && user.accessibleServers.length > 0 && (
        <div className="mt-8">
          <Card>
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              Your Servers ({user.accessibleServers.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {user.accessibleServers.slice(0, 6).map((server) => (
                <div
                  key={server.id}
                  onClick={() => navigate(`/server/${server.id}`)}
                  className="p-4 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                      <ServerIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{server.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {server.permissions.length} permissions
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {user.accessibleServers.length > 6 && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate('/servers')}
                  className="text-sm text-primary hover:underline"
                >
                  View all {user.accessibleServers.length} servers →
                </button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;