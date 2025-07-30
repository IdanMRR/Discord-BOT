import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';
import {
  TrophyIcon,
  UserGroupIcon,
  StarIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  MinusIcon,
  ArrowUpIcon,
  ClockIcon,
  SparklesIcon,
  TrashIcon,
  UserIcon,
  Cog6ToothIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { formatDashboardLogDate } from '../utils/dateUtils';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

interface UserLevel {
  guild_id: string;
  user_id: string;
  xp: number;
  level: number;
  message_count: number;
  last_xp_gain: string;
  rank?: number;
  totalMembers?: number;
  nextLevelXP?: number;
  currentLevelXP?: number;
  progressPercentage?: number;
  xpToNextLevel?: number;
  userData?: {
    id: string;
    username: string;
    displayName: string;
  };
}

interface LeaderboardData {
  leaderboard: UserLevel[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalMembers: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  settings: {
    enabled: boolean;
    xp_per_message: number;
    xp_cooldown: number;
    level_formula: string;
  };
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

const LevelingEnhanced: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Data states
  const [settings, setSettings] = useState<LevelingSettings | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserLevel | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'management' | 'settings'>('leaderboard');
  
  // XP Management form states
  const [targetUserId, setTargetUserId] = useState('');
  const [xpAmount, setXpAmount] = useState('');
  const [levelAmount, setLevelAmount] = useState('');
  const [reason, setReason] = useState('');
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  
  // Settings form states
  const [settingsForm, setSettingsForm] = useState<LevelingSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loadLeaderboard = useCallback(async (currentSettings?: LevelingSettings | null) => {
    if (!serverId) return;
    
    // Use provided settings or fall back to default settings
    const settingsToUse = currentSettings || {
      enabled: false,
      xp_per_message: 15,
      xp_cooldown: 60,
      level_formula: 'quadratic'
    };
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/settings/${serverId}/leveling/leaderboard?limit=10&offset=${(currentPage - 1) * 10}`, {
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Transform the leveling-settings API response to match our interface
        const transformedData = {
          leaderboard: data.data.users || [],
          pagination: {
            page: data.data.page || 1,
            limit: 10,
            totalPages: data.data.totalPages || 1,
            totalMembers: data.data.totalMembers || 0,
            hasNext: (data.data.page || 1) < (data.data.totalPages || 1),
            hasPrev: (data.data.page || 1) > 1
          },
          settings: {
            enabled: settingsToUse?.enabled || false,
            xp_per_message: settingsToUse?.xp_per_message || 15,
            xp_cooldown: settingsToUse?.xp_cooldown || 60,
            level_formula: settingsToUse?.level_formula || 'quadratic'
          }
        };
        setLeaderboard(transformedData);
      } else {
        console.error('Leaderboard API error:', data.error);
        // Set empty leaderboard with basic structure for disabled systems
        setLeaderboard({
          leaderboard: [],
          pagination: {
            page: 1,
            limit: 10,
            totalPages: 1,
            totalMembers: 0,
            hasNext: false,
            hasPrev: false
          },
          settings: {
            enabled: false,
            xp_per_message: 15,
            xp_cooldown: 60,
            level_formula: 'quadratic'
          }
        });
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      // Set empty leaderboard structure on error
      setLeaderboard({
        leaderboard: [],
        pagination: {
          page: 1,
          limit: 10,
          totalPages: 1,
          totalMembers: 0,
          hasNext: false,
          hasPrev: false
        },
        settings: {
          enabled: false,
          xp_per_message: 15,
          xp_cooldown: 60,
          level_formula: 'quadratic'
        }
      });
    }
  }, [serverId, currentPage]);

  const loadSettings = useCallback(async (): Promise<LevelingSettings | null> => {
    if (!serverId) return null;
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/settings/${serverId}/leveling`, {
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'x-user-id': 'dashboard-user'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        // Convert numeric boolean values to actual booleans
        const processedSettings = {
          ...data.data,
          enabled: Boolean(data.data.enabled),
          level_up_message_enabled: Boolean(data.data.level_up_message_enabled),
          voice_xp_enabled: Boolean(data.data.voice_xp_enabled),
          leaderboard_enabled: Boolean(data.data.leaderboard_enabled)
        };
        setSettings(processedSettings);
        return processedSettings;
      } else {
        console.error('Settings API returned error:', data.error);
        // Set default settings if API fails
        const defaultSettings = {
          guild_id: serverId,
          enabled: false,
          xp_per_message: 15,
          xp_cooldown: 60,
          xp_multiplier: 1.0,
          level_formula: 'quadratic'
        };
        setSettings(defaultSettings);
        return defaultSettings;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Set default settings if API fails
      const defaultSettings = {
        guild_id: serverId,
        enabled: false,
        xp_per_message: 15,
        xp_cooldown: 60,
        xp_multiplier: 1.0,
        level_formula: 'quadratic'
      };
      setSettings(defaultSettings);
      return defaultSettings;
    }
  }, [serverId]);

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    // Prevent API calls more frequent than every 5 seconds unless forced
    if (!force && now - lastRefresh < 5000) {
      return;
    }
    
    setLoading(true);
    setLastRefresh(now);
    // Load settings first, then leaderboard with those settings
    const loadedSettings = await loadSettings();
    await loadLeaderboard(loadedSettings);
    setLoading(false);
  }, [loadLeaderboard, loadSettings, lastRefresh]);

  // Initial load and page changes - STABLE dependencies only
  useEffect(() => {
    if (!serverId) return;
    
    const loadInitialData = async () => {
      setLoading(true);
      setLastRefresh(Date.now());
      
      // Load settings first, then leaderboard with proper settings - sequential loading
      try {
        const loadedSettings = await loadSettings();
        await loadLeaderboard(loadedSettings);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, currentPage]); // loadSettings and loadLeaderboard excluded to prevent array size changes

  // Auto-refresh every 60 seconds - STABLE implementation
  useEffect(() => {
    if (!serverId) return;
    
    const interval = setInterval(async () => {
      // Load settings first, then leaderboard with fresh settings
      const freshSettings = await loadSettings();
      await loadLeaderboard(freshSettings);
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]); // Only serverId dependency to avoid infinite loops

  // Initialize settings form when settings data changes
  useEffect(() => {
    if (settings) {
      setSettingsForm({
        ...settings, // Include any additional settings first
        guild_id: serverId || '', // Then override specific properties
        enabled: settings.enabled,
        xp_per_message: settings.xp_per_message,
        xp_cooldown: settings.xp_cooldown,
        level_formula: settings.level_formula
      });
    }
  }, [settings, serverId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const loadUserData = async (userId: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/xp-management/${serverId}/user/${userId}`, {
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedUser(data.data);
      } else {
        toast.error('User not found or has no XP data');
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Error loading user data');
    }
  };

  const handleAddXP = async () => {
    if (!targetUserId || !xpAmount) {
      toast.error('Please enter both user ID and XP amount');
      return;
    }

    const xp = parseInt(xpAmount);
    if (isNaN(xp)) {
      toast.error('XP amount must be a valid number');
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/xp-management/${serverId}/user/${targetUserId}/add-xp`, {
        method: 'POST',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          xp,
          reason: reason || undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setXpAmount('');
        setReason('');
        if (selectedUser && selectedUser.user_id === targetUserId) {
          await loadUserData(targetUserId);
        }
        await loadLeaderboard(settings);
      } else {
        toast.error(data.error || 'Failed to add XP');
      }
    } catch (error) {
      console.error('Error adding XP:', error);
      toast.error('Error adding XP');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetLevel = async () => {
    if (!targetUserId || (!xpAmount && !levelAmount)) {
      toast.error('Please enter user ID and either XP or level amount');
      return;
    }

    const xp = xpAmount ? parseInt(xpAmount) : undefined;
    const level = levelAmount ? parseInt(levelAmount) : undefined;

    if ((xp !== undefined && isNaN(xp)) || (level !== undefined && isNaN(level))) {
      toast.error('XP and level amounts must be valid numbers');
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/xp-management/${serverId}/user/${targetUserId}/update`, {
        method: 'POST',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          xp,
          level,
          reason: reason || undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setXpAmount('');
        setLevelAmount('');
        setReason('');
        if (selectedUser && selectedUser.user_id === targetUserId) {
          await loadUserData(targetUserId);
        }
        await loadLeaderboard(settings);
      } else {
        toast.error(data.error || 'Failed to update user level');
      }
    } catch (error) {
      console.error('Error updating user level:', error);
      toast.error('Error updating user level');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetUser = async () => {
    if (!targetUserId) {
      toast.error('Please enter a user ID');
      return;
    }

    if (!window.confirm('Are you sure you want to reset this user\'s level data? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/xp-management/${serverId}/user/${targetUserId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason || undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setReason('');
        if (selectedUser && selectedUser.user_id === targetUserId) {
          setSelectedUser(null);
        }
        await loadLeaderboard(settings);
      } else {
        toast.error(data.error || 'Failed to reset user level');
      }
    } catch (error) {
      console.error('Error resetting user level:', error);
      toast.error('Error resetting user level');
    } finally {
      setActionLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settingsForm || !serverId) {
      toast.error('No settings to save');
      return;
    }

    try {
      setSettingsSaving(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/settings/${serverId}/leveling`, {
        method: 'POST',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...settingsForm,
          guild_id: serverId
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Settings saved successfully');
        setSettings(settingsForm);
        // Reload settings and leaderboard with new settings
        const updatedSettings = await loadSettings();
        await loadLeaderboard(updatedSettings);
      } else {
        toast.error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error saving settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    setTargetUserId(userId);
    loadUserData(userId);
    setActiveTab('management');
  };

  const renderProgressBar = (user: UserLevel | null) => {
    if (!user?.progressPercentage) return null;
    
    return (
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
        <div 
          className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, user.progressPercentage)}%` }}
        />
      </div>
    );
  };

  const renderTabButton = (tab: typeof activeTab, label: string, icon: React.ElementType) => {
    const Icon = icon;
    return (
      <button
        onClick={() => setActiveTab(tab)}
        className={classNames(
          "flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-200",
          activeTab === tab
            ? darkMode
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-blue-600 text-white shadow-lg"
            : darkMode
              ? "text-gray-400 hover:text-white hover:bg-gray-700"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        )}
      >
        <Icon className="h-5 w-5 mr-2" />
        {label}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check if system is truly disabled using actual settings state
  const isSystemDisabled = !settings || settings.enabled !== true;
  
  // Show loading spinner if data hasn't loaded yet
  if (loading || !leaderboard) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* System Disabled Warning */}
      {isSystemDisabled && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center">
            <StarIcon className="h-5 w-5 text-yellow-400 mr-2" />
            <span className="text-yellow-800 dark:text-yellow-200">
              ⚠️ Leveling system is currently disabled for this server. You can still manage XP manually using the admin tools below.
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leveling System</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage XP, levels and view leaderboards</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center">
              <SparklesIcon className="h-4 w-4 mr-1" />
              {leaderboard?.settings.xp_per_message || 15} XP/message
            </div>
            <div className="flex items-center">
              <ClockIcon className="h-4 w-4 mr-1" />
              {leaderboard?.settings.xp_cooldown || 60}s cooldown
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={classNames(
              "flex items-center px-3 py-2 rounded-lg font-medium transition-all duration-200",
              refreshing
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                : darkMode
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <ArrowPathIcon className={classNames("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        {renderTabButton('leaderboard', 'Leaderboard', TrophyIcon)}
        {/* Temporarily disabled until XP management API is fixed */}
        {/* {renderTabButton('management', 'XP Management', ChartBarIcon)} */}
        {renderTabButton('settings', 'Settings', Cog6ToothIcon)}
      </div>

      {/* Tab Content */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={classNames(
              "rounded-lg p-6 border",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center">
                <UserGroupIcon className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Members</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {leaderboard?.pagination.totalMembers.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className={classNames(
              "rounded-lg p-6 border",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center">
                <TrophyIcon className="h-8 w-8 text-yellow-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Top Level</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {leaderboard?.leaderboard[0]?.level || 0}
                  </p>
                </div>
              </div>
            </div>
            
            <div className={classNames(
              "rounded-lg p-6 border",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center">
                <StarIcon className="h-8 w-8 text-purple-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">System Status</p>
                  <p className="text-2xl font-bold text-green-500">
                    {leaderboard?.settings.enabled ? 'Active' : 'Disabled'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Leaderboard */}
          <div className={classNames(
            "rounded-lg border overflow-hidden",
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Server Leaderboard</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Page {leaderboard?.pagination.page || 1} of {leaderboard?.pagination.totalPages || 1}
              </p>
            </div>
            
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {!leaderboard || leaderboard.leaderboard.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <TrophyIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Leaderboard Data</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {isSystemDisabled 
                      ? "The leveling system is disabled. Enable it to start tracking user levels."
                      : "No users have earned XP yet. Users will appear here as they gain experience."}
                  </p>
                  {isSystemDisabled && (
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Cog6ToothIcon className="h-4 w-4 mr-2" />
                      Configure Leveling System
                    </button>
                  )}
                </div>
              ) : (
                leaderboard.leaderboard.map((user, index) => (
                  <div
                    key={user.user_id}
                    className={classNames(
                      "px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors",
                      "flex items-center justify-between"
                    )}
                    onClick={() => handleUserSelect(user.user_id)}
                  >
                    <div className="flex items-center space-x-4">
                      {/* Rank Medal/Number */}
                      <div className="flex-shrink-0 w-10 text-center">
                        {user.rank === 1 && <span className="text-3xl">🥇</span>}
                        {user.rank === 2 && <span className="text-3xl">🥈</span>}
                        {user.rank === 3 && <span className="text-3xl">🥉</span>}
                        {(user.rank || 0) > 3 && (
                          <span className="text-lg font-bold text-gray-500 dark:text-gray-400">
                            #{user.rank}
                          </span>
                        )}
                      </div>
                      
                      {/* User Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <UserIcon className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {user.userData?.displayName || user.userData?.username || `User ${user.user_id.slice(-4)}`}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {user.message_count.toLocaleString()} messages
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Level and XP Info */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center space-x-4">
                        <div>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            Level {user.level}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {user.xp.toLocaleString()} XP
                          </p>
                        </div>
                        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                          <EyeIcon className="h-5 w-5 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {leaderboard && leaderboard.pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!leaderboard?.pagination.hasPrev}
                  className={classNames(
                    "flex items-center px-3 py-2 rounded-lg font-medium transition-colors",
                    leaderboard?.pagination.hasPrev
                      ? darkMode
                        ? "text-gray-300 hover:bg-gray-700"
                        : "text-gray-700 hover:bg-gray-100"
                      : "text-gray-400 cursor-not-allowed"
                  )}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Previous
                </button>
                
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {leaderboard?.pagination.totalMembers.toLocaleString() || '0'} total members
                </span>
                
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!leaderboard?.pagination.hasNext}
                  className={classNames(
                    "flex items-center px-3 py-2 rounded-lg font-medium transition-colors",
                    leaderboard?.pagination.hasNext
                      ? darkMode
                        ? "text-gray-300 hover:bg-gray-700"
                        : "text-gray-700 hover:bg-gray-100"
                      : "text-gray-400 cursor-not-allowed"
                  )}
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'management' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* XP Management Controls */}
          <div className={classNames(
            "rounded-lg border p-6",
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">XP Management Controls</h3>
            
            {selectedUser && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                    <span className="text-white text-sm font-bold">{selectedUser.level}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-800 dark:text-blue-200">
                      User Selected: {selectedUser.userData?.displayName || `User ${selectedUser.user_id.slice(-4)}`}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                      Level {selectedUser.level} • {selectedUser.xp.toLocaleString()} XP • Rank #{selectedUser.rank}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  User ID
                </label>
                <div className="flex">
                  <input
                    type="text"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder="Enter Discord User ID"
                    readOnly={selectedUser !== null}
                    className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md shadow-sm ${
                      selectedUser 
                        ? 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed' 
                        : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  />
                  {selectedUser && (
                    <button
                      onClick={() => {
                        setSelectedUser(null);
                        setTargetUserId('');
                      }}
                      className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-r-md transition-colors"
                      title="Clear selection"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    XP Amount
                  </label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={xpAmount}
                      onChange={(e) => setXpAmount(e.target.value)}
                      placeholder="XP amount"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[10, 25, 50, 100, 250, 500, 1000].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setXpAmount(amount.toString())}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                        >
                          {amount}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Set Level (Auto-calculates XP)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={levelAmount}
                      onChange={(e) => {
                        setLevelAmount(e.target.value);
                        // Auto-calculate XP for the level
                        const level = parseInt(e.target.value);
                        if (level && level > 0) {
                          const xpForLevel = Math.pow(level, 2) * 100; // Quadratic formula approximation
                          setXpAmount(xpForLevel.toString());
                        }
                      }}
                      placeholder="Target level"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[1, 5, 10, 15, 20, 25, 30, 50].map((level) => (
                        <button
                          key={level}
                          onClick={() => {
                            setLevelAmount(level.toString());
                            const xpForLevel = Math.pow(level, 2) * 100;
                            setXpAmount(xpForLevel.toString());
                          }}
                          className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                        >
                          L{level}
                        </button>
                      ))}
                    </div>
                    {levelAmount && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Level {levelAmount} ≈ {Math.pow(parseInt(levelAmount) || 0, 2) * 100} XP
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for the change"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleAddXP}
                  disabled={actionLoading || !targetUserId || !xpAmount}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add XP
                </button>
                
                <button
                  onClick={() => {
                    if (xpAmount && parseInt(xpAmount) > 0) {
                      setXpAmount('-' + Math.abs(parseInt(xpAmount)).toString());
                    }
                    handleAddXP();
                  }}
                  disabled={actionLoading || !targetUserId || !xpAmount || parseInt(xpAmount) >= 0}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <MinusIcon className="h-4 w-4 mr-2" />
                  Remove XP
                </button>

                <button
                  onClick={handleSetLevel}
                  disabled={actionLoading || !targetUserId || (!xpAmount && !levelAmount)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowUpIcon className="h-4 w-4 mr-2" />
                  Set Level/XP
                </button>

                <button
                  onClick={handleResetUser}
                  disabled={actionLoading || !targetUserId}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Reset User
                </button>
              </div>
            </div>
          </div>

          {/* Selected User Info */}
          {selectedUser && (
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Selected User Info</h3>
              
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Level:</span>
                    <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                      {selectedUser?.level}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Rank:</span>
                    <span className="ml-2 font-semibold">
                      #{selectedUser?.rank} / {selectedUser?.totalMembers}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Total XP:</span>
                    <span className="ml-2 font-semibold">
                      {selectedUser?.xp.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Messages:</span>
                    <span className="ml-2 font-semibold">
                      {selectedUser?.message_count.toLocaleString()}
                    </span>
                  </div>
                </div>
                
                {selectedUser?.nextLevelXP && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Progress to Level {(selectedUser?.level || 0) + 1}</span>
                      <span>
                        {selectedUser?.currentLevelXP?.toLocaleString()} / {selectedUser?.nextLevelXP?.toLocaleString()} XP
                      </span>
                    </div>
                    {selectedUser && renderProgressBar(selectedUser)}
                  </div>
                )}

                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  Last XP gain: {(() => {
                    const lastXpGain = selectedUser?.last_xp_gain;
                    if (lastXpGain && typeof lastXpGain === 'string') {
                      return formatDashboardLogDate(lastXpGain as string);
                    }
                    return 'Never';
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Leveling Settings</h3>
            <button
              onClick={saveSettings}
              disabled={settingsSaving || !settingsForm}
              className={classNames(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                settingsSaving || !settingsForm
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : darkMode
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              {settingsSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
          
          {settingsForm && (
            <div className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <label className="font-medium text-gray-900 dark:text-white">Enable Leveling System</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Toggle the leveling system for this server</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.enabled || false}
                    onChange={(e) => setSettingsForm({...settingsForm, enabled: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* XP per Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    XP per Message
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={settingsForm.xp_per_message || 15}
                    onChange={(e) => setSettingsForm({...settingsForm, xp_per_message: parseInt(e.target.value) || 15})}
                    className={classNames(
                      "w-full px-3 py-2 border rounded-lg",
                      darkMode
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    XP awarded per message (1-100)
                  </p>
                </div>

                {/* XP Cooldown */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    XP Cooldown (seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={settingsForm.xp_cooldown || 60}
                    onChange={(e) => setSettingsForm({...settingsForm, xp_cooldown: parseInt(e.target.value) || 60})}
                    className={classNames(
                      "w-full px-3 py-2 border rounded-lg",
                      darkMode
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Cooldown between XP gains (1-300 seconds)
                  </p>
                </div>

                {/* Level Formula */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Level Formula
                  </label>
                  <select
                    value={settingsForm.level_formula || 'quadratic'}
                    onChange={(e) => setSettingsForm({...settingsForm, level_formula: e.target.value})}
                    className={classNames(
                      "w-full px-3 py-2 border rounded-lg",
                      darkMode
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  >
                    <option value="linear">Linear</option>
                    <option value="quadratic">Quadratic</option>
                    <option value="exponential">Exponential</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Formula for calculating level requirements
                  </p>
                </div>

                {/* Current Status Display */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Current Status
                  </label>
                  <div className={classNames(
                    "px-3 py-2 border rounded-lg flex items-center",
                    darkMode ? "bg-gray-900 border-gray-600" : "bg-gray-50 border-gray-300"
                  )}>
                    <div className={classNames(
                      "w-3 h-3 rounded-full mr-2",
                      settingsForm.enabled ? "bg-green-500" : "bg-red-500"
                    )}></div>
                    <span className={classNames(
                      "font-medium",
                      settingsForm.enabled ? "text-green-600" : "text-red-600"
                    )}>
                      {settingsForm.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LevelingEnhanced;