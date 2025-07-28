import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ServerSelector from '../components/common/ServerSelector';
import toast from 'react-hot-toast';
import {
  ChartBarIcon,
  TrophyIcon,
  UserGroupIcon,
  StarIcon,
  TrashIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface UserLevel {
  guild_id: string;
  user_id: string;
  xp: number;
  level: number;
  message_count: number;
  last_xp_gain: string;
  userData: {
    id: string;
    username: string;
    displayName: string;
  };
  rank: number;
}

interface LeaderboardData {
  users: UserLevel[];
  totalMembers: number;
  page: number;
  totalPages: number;
}

interface LevelingSettings {
  guild_id: string;
  enabled?: boolean;
  xp_per_message?: number;
  xp_cooldown?: number;
  xp_multiplier?: number;
  level_formula?: string;
  base_xp?: number;
  xp_multiplier_per_level?: number;
  level_up_message_enabled?: boolean;
  level_up_channel_id?: string;
  level_up_message?: string;
  level_rewards?: string;
  voice_xp_enabled?: boolean;
  voice_xp_rate?: number;
  boost_channels?: string;
  boost_roles?: string;
  ignored_channels?: string;
  ignored_roles?: string;
  leaderboard_enabled?: boolean;
  leaderboard_channel_id?: string;
  leaderboard_update_interval?: number;
}

const LevelingPage: React.FC = () => {
  const { serverId: urlServerId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode } = useTheme();
  
  // State management
  const [selectedServerId, setSelectedServerId] = useState<string | null>(urlServerId || null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<LevelingSettings | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!selectedServerId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load settings and leaderboard in parallel
      const [settingsResponse, leaderboardResponse] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/settings/${selectedServerId}/leveling`),
        fetch(`${process.env.REACT_APP_API_URL}/api/settings/${selectedServerId}/leveling/leaderboard?limit=10&offset=${(currentPage - 1) * 10}`)
      ]);

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        if (settingsData.success) {
          setSettings(settingsData.data);
        }
      }

      if (leaderboardResponse.ok) {
        const leaderboardData = await leaderboardResponse.json();
        if (leaderboardData.success) {
          setLeaderboard(leaderboardData.data);
        }
      }

    } catch (error) {
      toast.error('Failed to load leveling data');
    } finally {
      setLoading(false);
    }
  }, [selectedServerId, currentPage]);

  // Load data when server selection or page changes
  useEffect(() => {
    if (!selectedServerId) {
      return;
    }
    loadData();
  }, [selectedServerId, currentPage, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const handleToggleSystem = async () => {
    if (!selectedServerId || !settings) {
      toast.error('No server selected');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/settings/${selectedServerId}/leveling`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_API_KEY}`
        },
        body: JSON.stringify({
          enabled: !settings.enabled
        })
      });

      const result = await response.json();

      if (result.success) {
        setSettings(prev => prev ? { ...prev, enabled: !prev.enabled } : null);
        toast.success(`Leveling system ${!settings.enabled ? 'enabled' : 'disabled'}`);
      } else {
        toast.error('Failed to update leveling settings');
      }
    } catch (error) {
      console.error('Error toggling leveling system:', error);
      toast.error('Failed to update leveling settings');
    }
  };

  const handleServerChange = (serverId: string | null) => {
    setSelectedServerId(serverId);
    setSettings(null);
    setLeaderboard(null);
    setCurrentPage(1);
    
    // Update URL if we're in a route that expects a serverId and serverId is not null
    if (serverId && location.pathname.includes('/servers/')) {
      navigate(`/servers/${serverId}/leveling`);
    }
  };

  const handleResetUser = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to reset ${username}'s level progress? This action cannot be undone.`)) {
      return;
    }

    if (!selectedServerId) {
      toast.error('No server selected');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/settings/${selectedServerId}/leveling/user/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_API_KEY}`
        }
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Reset ${username}'s level progress`);
        await loadData(); // Refresh data
      } else {
        toast.error('Failed to reset user level');
      }
    } catch (error) {
      console.error('Error resetting user level:', error);
      toast.error('Failed to reset user level');
    }
  };

  const navigateToSettings = () => {
    if (!selectedServerId) {
      toast.error('No server selected');
      return;
    }
    window.location.href = `/servers/${selectedServerId}/settings/leveling`;
  };


  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className={classNames(
              "p-3 rounded-lg",
              darkMode ? "bg-blue-900/20" : "bg-blue-100"
            )}>
              <ChartBarIcon className={classNames(
                "h-8 w-8",
                darkMode ? "text-blue-400" : "text-blue-600"
              )} />
            </div>
            
            <div>
              <h1 className={classNames(
                "text-4xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                Leveling System
              </h1>
              <p className={classNames(
                "text-lg font-medium mt-2",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Manage XP, levels, and leaderboards
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Server Selector */}
            <div className="min-w-48">
              <ServerSelector
                selectedServerId={selectedServerId}
                onServerSelect={handleServerChange}
                placeholder="Select a server..."
                showAllOption={false}
              />
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing || !selectedServerId}
              className={classNames(
                "flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors",
                darkMode ? "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100",
                (!selectedServerId || refreshing) ? "opacity-50 cursor-not-allowed" : ""
              )}
            >
              <ArrowPathIcon className={classNames("h-4 w-4", refreshing ? "animate-spin" : "")} />
              <span>Refresh</span>
            </button>

            {/* Toggle Switch */}
            {selectedServerId && settings && (
              <div className="flex items-center space-x-3">
                <span className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  System {settings.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  onClick={handleToggleSystem}
                  className={classNames(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    settings.enabled
                      ? "bg-blue-600"
                      : darkMode ? "bg-gray-600" : "bg-gray-200"
                  )}
                >
                  <span
                    className={classNames(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.enabled ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            )}

            <button
              onClick={navigateToSettings}
              disabled={!selectedServerId}
              className={classNames(
                "flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors",
                !selectedServerId ? "opacity-50 cursor-not-allowed" : ""
              )}
            >
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Server Selection Notice */}
        {!selectedServerId && (
          <div className={classNames(
            "p-4 rounded-lg border mb-6",
            darkMode ? "bg-yellow-900/20 border-yellow-800 text-yellow-300" : "bg-yellow-50 border-yellow-200 text-yellow-800"
          )}>
            <p className="text-sm">
              Please select a server from the dropdown above to view leveling data.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && selectedServerId && (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        )}
      </div>

      {/* Content - only show when server is selected and not loading */}
      {selectedServerId && !loading && (
        <>
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg mr-4",
              settings?.enabled 
                ? darkMode ? "bg-green-900/20" : "bg-green-100"
                : darkMode ? "bg-red-900/20" : "bg-red-100"
            )}>
              <TrophyIcon className={classNames(
                "h-6 w-6",
                settings?.enabled 
                  ? darkMode ? "text-green-400" : "text-green-600"
                  : darkMode ? "text-red-400" : "text-red-600"
              )} />
            </div>
            <div>
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                System Status
              </p>
              <p className={classNames(
                "text-2xl font-bold",
                settings?.enabled 
                  ? darkMode ? "text-green-400" : "text-green-600"
                  : darkMode ? "text-red-400" : "text-red-600"
              )}>
                {settings?.enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
        </div>

        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg mr-4",
              darkMode ? "bg-blue-900/20" : "bg-blue-100"
            )}>
              <UserGroupIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-blue-400" : "text-blue-600"
              )} />
            </div>
            <div>
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Active Users
              </p>
              <p className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {leaderboard?.totalMembers.toLocaleString() || '0'}
              </p>
            </div>
          </div>
        </div>

        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg mr-4",
              darkMode ? "bg-purple-900/20" : "bg-purple-100"
            )}>
              <StarIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-purple-400" : "text-purple-600"
              )} />
            </div>
            <div>
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                XP per Message
              </p>
              <p className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {settings?.xp_per_message || 15}
              </p>
            </div>
          </div>
        </div>

        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg mr-4",
              darkMode ? "bg-yellow-900/20" : "bg-yellow-100"
            )}>
              <ChartBarIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-yellow-400" : "text-yellow-600"
              )} />
            </div>
            <div>
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
              Level Formula
              </p>
              <p className={classNames(
                "text-xl font-bold capitalize",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {settings?.level_formula || 'quadratic'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className={classNames(
        "rounded-lg border",
        darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <TrophyIcon className="h-6 w-6 mr-3 text-yellow-500" />
              <h2 className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                Leaderboard
              </h2>
            </div>
            
            {leaderboard && leaderboard.totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={classNames(
                    "p-2 rounded border transition-colors",
                    currentPage === 1
                      ? "opacity-50 cursor-not-allowed"
                      : darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100",
                    darkMode ? "border-gray-600" : "border-gray-300"
                  )}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                
                <span className={classNames(
                  "px-3 py-1 text-sm",
                  darkMode ? "text-gray-300" : "text-gray-600"
                )}>
                  Page {currentPage} of {leaderboard.totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(Math.min(leaderboard.totalPages, currentPage + 1))}
                  disabled={currentPage === leaderboard.totalPages}
                  className={classNames(
                    "p-2 rounded border transition-colors",
                    currentPage === leaderboard.totalPages
                      ? "opacity-50 cursor-not-allowed"
                      : darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100",
                    darkMode ? "border-gray-600" : "border-gray-300"
                  )}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {!leaderboard || leaderboard.users.length === 0 ? (
            <div className="text-center py-12">
              <TrophyIcon className={classNames(
                "h-12 w-12 mx-auto mb-4",
                darkMode ? "text-gray-600" : "text-gray-400"
              )} />
              <p className={classNames(
                "text-lg",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                No users have earned XP yet
              </p>
              <p className={classNames(
                "text-sm mt-2",
                darkMode ? "text-gray-500" : "text-gray-500"
              )}>
                Users will appear here once they start chatting
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaderboard.users.map((user, index) => {
                // Medal emojis for top 3
                let medal = '';
                if (user.rank === 1) medal = '🥇';
                else if (user.rank === 2) medal = '🥈';
                else if (user.rank === 3) medal = '🥉';

                return (
                  <div
                    key={user.user_id}
                    className={classNames(
                      "flex items-center justify-between p-4 rounded-lg border",
                      darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                    )}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-8 h-8">
                        {medal ? (
                          <span className="text-2xl">{medal}</span>
                        ) : (
                          <span className={classNames(
                            "text-lg font-bold",
                            darkMode ? "text-gray-300" : "text-gray-600"
                          )}>
                            #{user.rank}
                          </span>
                        )}
                      </div>
                      
                      <div>
                        <h3 className={classNames(
                          "font-semibold",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                          {user.userData.displayName}
                        </h3>
                        <p className={classNames(
                          "text-sm",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          Level {user.level} • {user.xp.toLocaleString()} XP • {user.message_count.toLocaleString()} messages
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleResetUser(user.user_id, user.userData.displayName)}
                      className={classNames(
                        "p-2 rounded-lg transition-colors",
                        darkMode ? "text-red-400 hover:bg-red-900/20" : "text-red-600 hover:bg-red-100"
                      )}
                      title={`Reset ${user.userData.displayName}'s level`}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default LevelingPage;