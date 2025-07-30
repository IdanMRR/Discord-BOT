import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  ChartBarIcon,
  TrophyIcon,
  UserGroupIcon,
  StarIcon,
  TrashIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon,
  UserIcon
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
  const { serverId } = useParams<{ serverId: string }>();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<LevelingSettings | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserLevel | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [xpAmount, setXpAmount] = useState(0);
  const [actionReason, setActionReason] = useState('');

  const loadData = useCallback(async () => {
    if (!serverId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load settings and leaderboard in parallel
      const [settingsResponse, leaderboardResponse] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/settings/${serverId}/leveling`, {
          headers: {
            'x-api-key': process.env.REACT_APP_API_KEY || '',
            'x-user-id': 'dashboard-user'
          }
        }),
        fetch(`${process.env.REACT_APP_API_URL}/api/settings/${serverId}/leveling/leaderboard?limit=10&offset=${(currentPage - 1) * 10}`, {
          headers: {
            'x-api-key': process.env.REACT_APP_API_KEY || '',
            'x-user-id': 'dashboard-user'
          }
        })
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
  }, [serverId, currentPage]);

  // Load data when server selection or page changes
  useEffect(() => {
    if (!serverId) {
      return;
    }
    loadData();
  }, [serverId, currentPage, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const handleToggleSystem = async () => {
    if (!serverId || !settings) {
      toast.error('No server selected');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/settings/${serverId}/leveling`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'x-user-id': 'dashboard-user'
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


  const handleResetUser = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to reset ${username}'s level progress? This action cannot be undone.`)) {
      return;
    }

    if (!serverId) {
      toast.error('No server selected');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/settings/${serverId}/leveling/user/${userId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'x-user-id': 'dashboard-user'
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
    if (!serverId) {
      toast.error('No server selected');
      return;
    }
    // Navigate to the server settings page
    window.location.href = `/server/${serverId}/settings`;
  };

  const handleOpenUserModal = (user: UserLevel) => {
    setSelectedUser(user);
    setShowUserModal(true);
    setXpAmount(0);
    setActionReason('');
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    setSelectedUser(null);
    setXpAmount(0);
    setActionReason('');
  };

  const handleAddXP = async () => {
    if (!serverId || !selectedUser || xpAmount === 0) {
      toast.error('Invalid request');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/xp-management/${serverId}/user/${selectedUser.user_id}/add-xp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'x-user-id': 'dashboard-user'
        },
        body: JSON.stringify({
          xp: xpAmount,
          reason: actionReason || undefined
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Successfully ${xpAmount > 0 ? 'added' : 'removed'} ${Math.abs(xpAmount)} XP`);
        handleCloseUserModal();
        await loadData(); // Refresh data
      } else {
        toast.error(result.error || 'Failed to update XP');
      }
    } catch (error) {
      console.error('Error updating XP:', error);
      toast.error('Failed to update XP');
    }
  };

  const handleSetLevel = async (newLevel: number) => {
    if (!serverId || !selectedUser) {
      toast.error('Invalid request');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/xp-management/${serverId}/user/${selectedUser.user_id}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'x-user-id': 'dashboard-user'
        },
        body: JSON.stringify({
          level: newLevel,
          reason: actionReason || undefined
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Successfully set level to ${newLevel}`);
        handleCloseUserModal();
        await loadData(); // Refresh data
      } else {
        toast.error(result.error || 'Failed to update level');
      }
    } catch (error) {
      console.error('Error updating level:', error);
      toast.error('Failed to update level');
    }
  };


  return (
    <div className="p-8">
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

            <button
              onClick={handleRefresh}
              disabled={refreshing || !serverId}
              className={classNames(
                "flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors",
                darkMode ? "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100",
                (!serverId || refreshing) ? "opacity-50 cursor-not-allowed" : ""
              )}
            >
              <ArrowPathIcon className={classNames("h-4 w-4", refreshing ? "animate-spin" : "")} />
              <span>Refresh</span>
            </button>

            {/* Toggle Switch */}
            {serverId && settings && (
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
              disabled={!serverId}
              className={classNames(
                "flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors",
                !serverId ? "opacity-50 cursor-not-allowed" : ""
              )}
            >
              <span>Settings</span>
            </button>
          </div>
        </div>


        {/* Loading State */}
        {loading && serverId && (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        )}
      </div>

      {/* Content - only show when server is selected and not loading */}
      {serverId && !loading && (
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

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg mr-4",
              darkMode ? "bg-orange-900/20" : "bg-orange-100"
            )}>
              <ChartBarIcon className={classNames(
                "h-6 w-6",  
                darkMode ? "text-orange-400" : "text-orange-600"
              )} />
            </div>
            <div>
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                XP Cooldown
              </p>
              <p className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {settings?.xp_cooldown ? `${settings.xp_cooldown}s` : '60s'}
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
              darkMode ? "bg-indigo-900/20" : "bg-indigo-100"
            )}>
              <StarIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-indigo-400" : "text-indigo-600"
              )} />
            </div>
            <div>
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                XP Multiplier
              </p>
              <p className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {settings?.xp_multiplier ? `${settings.xp_multiplier}x` : '1.0x'}
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
              settings?.voice_xp_enabled
                ? darkMode ? "bg-green-900/20" : "bg-green-100"
                : darkMode ? "bg-red-900/20" : "bg-red-100"
            )}>
              <TrophyIcon className={classNames(
                "h-6 w-6",
                settings?.voice_xp_enabled
                  ? darkMode ? "text-green-400" : "text-green-600"
                  : darkMode ? "text-red-400" : "text-red-600"
              )} />
            </div>
            <div>
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Voice XP
              </p>
              <p className={classNames(
                "text-2xl font-bold",
                settings?.voice_xp_enabled
                  ? darkMode ? "text-green-400" : "text-green-600"
                  : darkMode ? "text-red-400" : "text-red-600"
              )}>
                {settings?.voice_xp_enabled ? 'Enabled' : 'Disabled'}
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
                      "flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-opacity-80 transition-colors",
                      darkMode ? "bg-gray-700 border-gray-600 hover:bg-gray-600" : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                    )}
                    onClick={() => handleOpenUserModal(user)}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResetUser(user.user_id, user.userData.displayName);
                      }}
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

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={classNames(
            "bg-white rounded-lg shadow-xl max-w-md w-full mx-4",
            darkMode ? "bg-gray-800" : "bg-white"
          )}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className={classNames(
                  "p-2 rounded-lg",
                  darkMode ? "bg-blue-900/20" : "bg-blue-100"
                )}>
                  <UserIcon className={classNames(
                    "h-6 w-6",
                    darkMode ? "text-blue-400" : "text-blue-600"
                  )} />
                </div>
                <div>
                  <h3 className={classNames(
                    "text-lg font-semibold",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    {selectedUser.userData.displayName}
                  </h3>
                  <p className={classNames(
                    "text-sm",
                    darkMode ? "text-gray-400" : "text-gray-600"
                  )}>
                    Rank #{selectedUser.rank}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseUserModal}
                className={classNames(
                  "p-2 rounded-lg transition-colors",
                  darkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {/* User Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className={classNames(
                  "text-center p-4 rounded-lg",
                  darkMode ? "bg-gray-700" : "bg-gray-50"
                )}>
                  <p className={classNames(
                    "text-2xl font-bold",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    {selectedUser.level}
                  </p>
                  <p className={classNames(
                    "text-sm",
                    darkMode ? "text-gray-400" : "text-gray-600"
                  )}>
                    Level
                  </p>
                </div>
                <div className={classNames(
                  "text-center p-4 rounded-lg",
                  darkMode ? "bg-gray-700" : "bg-gray-50"
                )}>
                  <p className={classNames(
                    "text-2xl font-bold",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    {selectedUser.xp.toLocaleString()}
                  </p>
                  <p className={classNames(
                    "text-sm",
                    darkMode ? "text-gray-400" : "text-gray-600"
                  )}>
                    Total XP
                  </p>
                </div>
              </div>

              {/* XP Management */}
              <div className="space-y-4">
                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    XP Amount (positive to add, negative to remove)
                  </label>
                  <input
                    type="number"
                    value={xpAmount}
                    onChange={(e) => setXpAmount(parseInt(e.target.value) || 0)}
                    className={classNames(
                      "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                    placeholder="Enter XP amount..."
                  />
                </div>

                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className={classNames(
                      "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                    placeholder="Reason for change..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleAddXP}
                    disabled={xpAmount === 0}
                    className={classNames(
                      "flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors",
                      xpAmount === 0
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-opacity-90",
                      darkMode ? "bg-blue-600 text-white" : "bg-blue-500 text-white"
                    )}
                  >
                    {xpAmount > 0 ? <PlusIcon className="h-4 w-4" /> : <MinusIcon className="h-4 w-4" />}
                    <span>{xpAmount > 0 ? 'Add' : 'Remove'} XP</span>
                  </button>
                </div>

                {/* Quick Level Actions */}
                <div className="border-t pt-4 dark:border-gray-700">
                  <p className={classNames(
                    "text-sm font-medium mb-3",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Quick Level Actions
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleSetLevel(selectedUser.level + 1)}
                      className={classNames(
                        "px-3 py-2 text-sm rounded-lg transition-colors",
                        darkMode ? "bg-green-600 text-white hover:bg-green-700" : "bg-green-500 text-white hover:bg-green-600"
                      )}
                    >
                      +1 Level
                    </button>
                    <button
                      onClick={() => handleSetLevel(Math.max(0, selectedUser.level - 1))}
                      className={classNames(
                        "px-3 py-2 text-sm rounded-lg transition-colors",
                        darkMode ? "bg-red-600 text-white hover:bg-red-700" : "bg-red-500 text-white hover:bg-red-600"
                      )}
                    >
                      -1 Level
                    </button>
                    <button
                      onClick={() => handleSetLevel(0)}
                      className={classNames(
                        "px-3 py-2 text-sm rounded-lg transition-colors",
                        darkMode ? "bg-gray-600 text-white hover:bg-gray-700" : "bg-gray-500 text-white hover:bg-gray-600"
                      )}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LevelingPage;