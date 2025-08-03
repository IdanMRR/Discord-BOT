import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import PermissionGuard from '../components/common/PermissionGuard';
import { apiService } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
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
import { Line, Bar } from 'react-chartjs-2';

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

interface ServerOverview {
  total_messages: number;
  avg_members: number;
  total_commands: number;
  peak_online: number;
  new_members: number;
  left_members: number;
  voice_minutes: number;
  reactions_given: number;
  current_online: number;
  current_members: number;
}

interface HourlyActivity {
  hour: number;
  avg_messages: number;
  avg_commands: number;
  avg_voice_users: number;
}

interface ChannelAnalytics {
  channel_id: string;
  channel_name: string;
  channel_type: string;
  total_messages: number;
  active_days: number;
  avg_users: number;
}

interface CommandStats {
  command_name: string;
  usage_count: number;
  avg_execution_time: number;
  success_count: number;
  error_count: number;
}

interface MemberEngagement {
  active_members: number;
  avg_messages_per_member: number;
  avg_commands_per_member: number;
  avg_voice_per_member: number;
  most_messages: number;
  most_voice_time: number;
}

interface ServerHealth {
  id: number;
  guild_id: string;
  timestamp: string;
  member_count: number;
  online_count: number;
  bot_latency: number;
  memory_usage: number;
  uptime: number;
  error_count: number;
}

export const Analytics: React.FC = () => {
  const { serverId: routeServerId } = useParams<{ serverId: string }>();
  const { settings, registerAutoRefresh } = useSettings();
  const [selectedPeriod, setSelectedPeriod] = useState<number>(7);
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [overview, setOverview] = useState<ServerOverview | null>(null);
  const [hourlyActivity, setHourlyActivity] = useState<HourlyActivity[]>([]);
  const [topChannels, setTopChannels] = useState<ChannelAnalytics[]>([]);
  const [commandStats, setCommandStats] = useState<CommandStats[]>([]);
  const [memberEngagement, setMemberEngagement] = useState<MemberEngagement | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealth[]>([]);

  const fetchAnalytics = useCallback(async () => {
    const serverId = routeServerId;
    if (!serverId) return;
    
    setIsLoading(true);
    try {
      // Fetch real analytics data
      const [overviewRes, hourlyRes, channelsRes, commandsRes, engagementRes, healthRes] = await Promise.all([
        apiService.getAnalyticsOverview(serverId, selectedPeriod),
        apiService.getAnalyticsHourlyActivity(serverId, selectedPeriod),
        apiService.getAnalyticsTopChannels(serverId, selectedPeriod, 10),
        apiService.getAnalyticsCommandStats(serverId, selectedPeriod),
        apiService.getAnalyticsMemberEngagement(serverId, selectedPeriod),
        apiService.getAnalyticsServerHealth(serverId, 24)
      ]);
      
      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      } else {
        setOverview(null);
      }
      
      if (hourlyRes.success && hourlyRes.data) {
        setHourlyActivity(hourlyRes.data);
      } else {
        setHourlyActivity([]);
      }
      
      if (channelsRes.success && channelsRes.data) {
        setTopChannels(channelsRes.data);
      } else {
        setTopChannels([]);
      }
      
      if (commandsRes.success && commandsRes.data) {
        setCommandStats(commandsRes.data);
      } else {
        setCommandStats([]);
      }
      
      if (engagementRes.success && engagementRes.data) {
        setMemberEngagement(engagementRes.data);
      } else {
        setMemberEngagement(null);
      }
      
      if (healthRes.success && healthRes.data) {
        setServerHealth(healthRes.data);
      } else {
        setServerHealth([]);
      }
      
      console.log(`Analytics loaded for server ${serverId} (${selectedPeriod} days)`);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Set empty states
      setOverview(null);
      setHourlyActivity([]);
      setTopChannels([]);
      setCommandStats([]);
      setMemberEngagement(null);
      setServerHealth([]);
    } finally {
      setIsLoading(false);
    }
  }, [routeServerId, selectedPeriod]);

useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Register auto-refresh
  useEffect(() => {
    if (settings.autoRefresh) {
      const unregister = registerAutoRefresh('analytics-page', () => {
        console.log('Auto-refreshing analytics...');
        fetchAnalytics();
      });

      return unregister;
    }
  }, [settings.autoRefresh, registerAutoRefresh, fetchAnalytics]);

  const currentServerId = routeServerId;

  // Hourly Activity Chart
  const hourlyActivityChart = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: 'Messages',
        data: Array.from({ length: 24 }, (_, i) => {
          const hourData = hourlyActivity.find(h => h.hour === i);
          return hourData ? Math.round(hourData.avg_messages) : 0;
        }),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Commands',
        data: Array.from({ length: 24 }, (_, i) => {
          const hourData = hourlyActivity.find(h => h.hour === i);
          return hourData ? Math.round(hourData.avg_commands) : 0;
        }),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
      }
    ]
  };

  // Top Commands Chart
  const topCommandsChart = {
    labels: commandStats.slice(0, 10).map(cmd => cmd.command_name),
    datasets: [
      {
        label: 'Usage Count',
        data: commandStats.slice(0, 10).map(cmd => cmd.usage_count),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(14, 165, 233, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(168, 85, 247, 0.8)',
        ],
      }
    ]
  };

  // Channel Activity Chart
  const channelActivityChart = {
    labels: topChannels.slice(0, 8).map(ch => `#${ch.channel_name}`),
    datasets: [
      {
        label: 'Messages',
        data: topChannels.slice(0, 8).map(ch => ch.total_messages),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      }
    ]
  };

  // Server Health Chart (last 24 hours)
  const recentHealth = serverHealth.slice(-24);
  const healthChart = {
    labels: recentHealth.map(h => new Date(h.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Online Members',
        data: recentHealth.map(h => h.online_count),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        yAxisID: 'y',
      },
      {
        label: 'Bot Latency (ms)',
        data: recentHealth.map(h => h.bot_latency),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        yAxisID: 'y1',
      }
    ]
  };

  return (
    <PermissionGuard requiredPermission="view_analytics">
      <div className="page-container space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              📊 Server Analytics
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Comprehensive insights into your server's activity and performance
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-4">
            {/* Period Selector */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(Number(e.target.value))}
              className="input-primary"
            >
              <option value={1}>Last 24 Hours</option>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        </div>

        {!currentServerId ? (
          <div className="card flex justify-center items-center h-64">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">Please select a server to view analytics.</p>
              <p className="text-sm mt-2">Choose a server from the dropdown above to see detailed analytics.</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="card flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : (
            <div className="space-y-8">
              {/* Overview Cards */}
              {overview && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="card p-6">
                    <div className="flex items-center">
                      <div className="text-2xl">💬</div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Messages</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {overview.total_messages?.toLocaleString() || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div className="flex items-center">
                      <div className="text-2xl">⚡</div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Commands Used</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {overview.total_commands?.toLocaleString() || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div className="flex items-center">
                      <div className="text-2xl">👥</div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Online/Total</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                          {overview.current_online}/{overview.current_members}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div className="flex items-center">
                      <div className="text-2xl">📈</div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">New Members</p>
                        <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                          +{overview.new_members || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Charts Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Hourly Activity */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    📅 Activity by Hour
                  </h3>
                  <div className="h-64">
                    <Line 
                      data={hourlyActivityChart}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'top' as const }
                        },
                        scales: {
                          y: { beginAtZero: true }
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Server Health */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    🔥 Real-time Health
                  </h3>
                  <div className="h-64">
                    <Line 
                      data={healthChart}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'top' as const }
                        },
                        scales: {
                          y: { 
                            type: 'linear',
                            display: true,
                            position: 'left',
                            beginAtZero: true
                          },
                          y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            beginAtZero: true,
                            grid: { drawOnChartArea: false }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Charts Row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Commands */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    ⚡ Most Used Commands
                  </h3>
                  <div className="h-64">
                    <Bar 
                      data={topCommandsChart}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false }
                        },
                        scales: {
                          y: { beginAtZero: true }
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Channel Activity */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    📺 Most Active Channels
                  </h3>
                  <div className="h-64">
                    <Bar 
                      data={channelActivityChart}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false }
                        },
                        scales: {
                          y: { beginAtZero: true }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Member Engagement Stats */}
              {memberEngagement && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    👨‍👩‍👧‍👦 Member Engagement
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {memberEngagement.active_members}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Active Members</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {Math.round(memberEngagement.avg_messages_per_member || 0)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Avg Messages</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {Math.round(memberEngagement.avg_commands_per_member || 0)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Avg Commands</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {Math.round(memberEngagement.avg_voice_per_member || 0)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Avg Voice (min)</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {memberEngagement.most_messages}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Top Messages</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {Math.round(memberEngagement.most_voice_time || 0)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Top Voice (min)</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
      </div>
    </PermissionGuard>
  );
};