import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PermissionGuard from '../components/common/PermissionGuard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { apiService } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  TicketIcon,
  UsersIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  BarElement,
  ArcElement 
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ArcElement
);

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface ServerOverviewData {
  serverInfo: {
    name: string;
    memberCount: number;
    onlineCount: number;
    icon?: string;
  };
  quickStats: {
    totalTickets: number;
    activeTickets: number;
    totalWarnings: number;
    activeWarnings: number;
    recentCommands: number;
    topLevel: number;
  };
  recentActivity: {
    tickets: any[];
    warnings: any[];
    levelUps: any[];
    commands: any[];
  };
  healthMetrics: {
    botLatency: number;
    uptime: string;
    lastRestart: string;
  };
}

export const ServerOverview: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ServerOverviewData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverviewData = useCallback(async () => {
    if (!serverId) return;
    
    try {
      setLoading(true);
      
      // Fetch various data in parallel
      const [
        serverResponse,
        ticketsResponse,
        warningsResponse,
        systemMetricsResponse
      ] = await Promise.all([
        apiService.getServerById(serverId),
        apiService.getTickets({ guildId: serverId, limit: 5, page: 1 }),
        apiService.getWarnings({ guildId: serverId, limit: 5, page: 1 }),
        apiService.getSystemMetrics()
      ]);

      // Build overview data
      const overviewData: ServerOverviewData = {
        serverInfo: {
          name: serverResponse.data?.name || 'Unknown Server',
          memberCount: serverResponse.data?.memberCount || 0,
          onlineCount: 0, // Would need real-time data
          icon: serverResponse.data?.icon || undefined
        },
        quickStats: {
          totalTickets: ticketsResponse.data?.totalCount || 0,
          activeTickets: ticketsResponse.data?.tickets?.filter((t: any) => t.status === 'open').length || 0,
          totalWarnings: warningsResponse.data?.length || 0,
          activeWarnings: warningsResponse.data?.filter((w: any) => w.active).length || 0,
          recentCommands: 0, // Would need analytics data
          topLevel: 0 // Would need leveling data
        },
        recentActivity: {
          tickets: ticketsResponse.data?.tickets?.slice(0, 3) || [],
          warnings: warningsResponse.data?.slice(0, 3) || [],
          levelUps: [], // Would need leveling data
          commands: [] // Would need command logs
        },
        healthMetrics: {
          botLatency: systemMetricsResponse.data?.apiLatency ? parseInt(systemMetricsResponse.data.apiLatency) : 0,
          uptime: systemMetricsResponse.data?.uptime || 'Unknown',
          lastRestart: systemMetricsResponse.data?.lastRestart || 'Unknown'
        }
      };

      setData(overviewData);
    } catch (error) {
      console.error('Error fetching overview data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOverviewData();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className={classNames(
          "text-lg",
          darkMode ? "text-gray-400" : "text-gray-600"
        )}>
          Failed to load server overview data
        </p>
      </div>
    );
  }

  // Activity chart data
  const activityData = {
    labels: ['Tickets', 'Warnings', 'Commands', 'Level Ups'],
    datasets: [{
      data: [
        data.quickStats.totalTickets,
        data.quickStats.totalWarnings,
        data.quickStats.recentCommands,
        data.recentActivity.levelUps.length
      ],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(139, 92, 246, 0.8)'
      ],
      borderColor: [
        'rgb(59, 130, 246)',
        'rgb(245, 158, 11)',
        'rgb(16, 185, 129)',
        'rgb(139, 92, 246)'
      ],
      borderWidth: 2
    }]
  };

  return (
    <PermissionGuard requiredPermission="view_overview">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-4">
            <div className={classNames(
              "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold",
              darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
            )}>
              {data.serverInfo.icon ? (
                <img 
                  src={`https://cdn.discordapp.com/icons/${serverId}/${data.serverInfo.icon}.png`}
                  alt={data.serverInfo.name}
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                data.serverInfo.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.serverInfo.name}
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Server Overview • {data.serverInfo.memberCount} members
              </p>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={classNames(
              "mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
              refreshing && "opacity-50 cursor-not-allowed"
            )}
          >
            {refreshing ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <ArrowTrendingUpIcon className="h-4 w-4 mr-2" />
            )}
            Refresh
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-2xl">🎫</div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tickets</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {data.quickStats.totalTickets}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {data.quickStats.activeTickets} active
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-2xl">⚠️</div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Warnings</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {data.quickStats.totalWarnings}
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  {data.quickStats.activeWarnings} active
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-2xl">👥</div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Members</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {data.serverInfo.memberCount}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {data.serverInfo.onlineCount} online
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="text-2xl">🤖</div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bot Latency</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {data.healthMetrics.botLatency}ms
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {data.healthMetrics.uptime} uptime
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Activity Overview Chart */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📊 Activity Overview
            </h3>
            <div className="h-64">
              <Doughnut 
                data={activityData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'right' as const }
                  }
                }}
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              ⚡ Quick Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate(`/server/${serverId}/tickets`)}
                className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <TicketIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-gray-900 dark:text-white">Manage Tickets</span>
                </div>
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  {data.quickStats.activeTickets} active
                </span>
              </button>

              <button
                onClick={() => navigate(`/server/${serverId}/warnings`)}
                className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <span className="text-gray-900 dark:text-white">View Warnings</span>
                </div>
                <span className="text-sm text-orange-600 dark:text-orange-400">
                  {data.quickStats.activeWarnings} active
                </span>
              </button>

              <button
                onClick={() => navigate(`/server/${serverId}/members`)}
                className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <UsersIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-gray-900 dark:text-white">Manage Members</span>
                </div>
                <span className="text-sm text-purple-600 dark:text-purple-400">
                  {data.serverInfo.memberCount} total
                </span>
              </button>

              <button
                onClick={() => navigate(`/server/${serverId}/analytics`)}
                className="w-full flex items-center justify-between px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <ChartBarIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-gray-900 dark:text-white">View Analytics</span>
                </div>
                <span className="text-sm text-green-600 dark:text-green-400">
                  Detailed stats
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🕒 Recent Activity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Tickets */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Recent Tickets</h4>
              <div className="space-y-2">
                {data.recentActivity.tickets.length > 0 ? (
                  data.recentActivity.tickets.map((ticket: any, index) => (
                    <div key={index} className="flex items-center justify-between py-2 px-3 rounded bg-gray-50 dark:bg-gray-700">
                      <span className="text-sm text-gray-900 dark:text-white">
                        Ticket #{ticket.id}
                      </span>
                      <span className={classNames(
                        "text-xs px-2 py-1 rounded",
                        ticket.status === 'open' 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        {ticket.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No recent tickets</p>
                )}
              </div>
            </div>

            {/* Recent Warnings */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Recent Warnings</h4>
              <div className="space-y-2">
                {data.recentActivity.warnings.length > 0 ? (
                  data.recentActivity.warnings.map((warning: any, index) => (
                    <div key={index} className="flex items-center justify-between py-2 px-3 rounded bg-gray-50 dark:bg-gray-700">
                      <span className="text-sm text-gray-900 dark:text-white">
                        Warning #{warning.id}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {warning.reason?.substring(0, 20)}...
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No recent warnings</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default ServerOverview;