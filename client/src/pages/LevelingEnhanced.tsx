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
      const response = await fetch(`/api/settings/${serverId}/leveling/leaderboard?limit=10&offset=${(currentPage - 1) * 10}`, {
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
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
      const response = await fetch(`/api/settings/${serverId}/leveling`, {
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
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

  // Calculate what the new level and XP will be after adding/removing XP
  const calculateNewLevel = (currentXP: number, xpChange: number) => {
    const newTotalXP = Math.max(0, currentXP + xpChange);
    
    // Using quadratic formula: level = sqrt(xp / 100)
    const newLevel = Math.floor(Math.sqrt(newTotalXP / 100));
    const xpForCurrentLevel = Math.pow(newLevel, 2) * 100;
    const xpForNextLevel = Math.pow(newLevel + 1, 2) * 100;
    const currentLevelXP = newTotalXP - xpForCurrentLevel;
    const nextLevelXP = xpForNextLevel - xpForCurrentLevel;
    
    return {
      newLevel,
      newTotalXP,
      currentLevelXP,
      nextLevelXP,
      progressPercent: (currentLevelXP / nextLevelXP) * 100
    };
  };

  const loadUserData = async (userId: string) => {
    try {
      console.log('Loading user data for:', userId, 'in server:', serverId);
      console.log('API Key:', process.env.REACT_APP_API_KEY ? 'Present' : 'Missing');
      console.log('Settings enabled:', settings?.enabled);
      
      // First try to find user in the leaderboard data as a fallback
      const leaderboardUser = leaderboard?.leaderboard?.find(user => user.user_id === userId);
      if (leaderboardUser) {
        console.log('Found user in leaderboard:', leaderboardUser);
        
        // Calculate missing XP progression data for the level card
        const currentLevel = leaderboardUser.level;
        const totalXP = leaderboardUser.xp;
        
        // Use quadratic formula: Level = sqrt(totalXP / 100)
        // XP for current level: level^2 * 100
        const xpForCurrentLevel = Math.pow(currentLevel, 2) * 100;
        const xpForNextLevel = Math.pow(currentLevel + 1, 2) * 100;
        const currentLevelXP = totalXP - xpForCurrentLevel;
        const nextLevelXP = xpForNextLevel - xpForCurrentLevel;
        
        // Enhanced user data with calculated progression
        const enhancedUser = {
          ...leaderboardUser,
          currentLevelXP: Math.max(0, currentLevelXP),
          nextLevelXP: nextLevelXP,
          progressPercent: nextLevelXP > 0 ? (currentLevelXP / nextLevelXP) * 100 : 0
        };
        
        console.log('Enhanced user data:', enhancedUser);
        setSelectedUser(enhancedUser);
        toast.success('User loaded from leaderboard');
        return;
      }
      
      const apiKey = process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765';
      
      const response = await fetch(`/api/xp-management/${serverId}/user/${userId}`, {
        headers: {
          'x-api-key': apiKey,
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        setSelectedUser(data.data);
        toast.success('User loaded successfully');
      } else {
        console.error('API Error:', data.error);
        toast.error(data.error || 'User not found or has no XP data');
        setSelectedUser(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Error loading user data: ' + (error as Error).message);
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
      const response = await fetch(`/api/xp-management/${serverId}/user/${targetUserId}/add-xp`, {
        method: 'POST',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
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
      const response = await fetch(`/api/xp-management/${serverId}/user/${targetUserId}/update`, {
        method: 'POST',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
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
      const response = await fetch(`/api/xp-management/${serverId}/user/${targetUserId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
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
      const response = await fetch(`/api/settings/${serverId}/leveling`, {
        method: 'POST',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
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
          <h1 className="text-2xl font-bold text-foreground">Leveling System</h1>
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
              "btn-refresh",
              refreshing ? "spinning" : ""
            )}
          >
            <ArrowPathIcon className="icon" />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-border pb-4">
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
              darkMode ? "content-area" : "content-area"
            )}>
              <div className="flex items-center">
                <UserGroupIcon className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Members</p>
                  <p className="text-2xl font-bold text-foreground">
                    {leaderboard?.pagination.totalMembers.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className={classNames(
              "rounded-lg p-6 border",
              darkMode ? "content-area" : "content-area"
            )}>
              <div className="flex items-center">
                <TrophyIcon className="h-8 w-8 text-yellow-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Top Level</p>
                  <p className="text-2xl font-bold text-foreground">
                    {leaderboard?.leaderboard[0]?.level || 0}
                  </p>
                </div>
              </div>
            </div>
            
            <div className={classNames(
              "rounded-lg p-6 border",
              darkMode ? "content-area" : "content-area"
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
            darkMode ? "content-area" : "content-area"
          )}>
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Server Leaderboard</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Page {leaderboard?.pagination.page || 1} of {leaderboard?.pagination.totalPages || 1}
              </p>
            </div>
            
            <div className="divide-y divide-border">
              {!leaderboard || leaderboard.leaderboard.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <TrophyIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Leaderboard Data</h3>
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
                            <p className="font-semibold text-foreground">
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
              <div className="px-6 py-4 border-t border-border flex items-center justify-between">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Search Panel */}
          <div className={classNames(
            "rounded-lg border p-6",
            darkMode ? "content-area" : "content-area"
          )}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Select User</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search Users
                </label>
                <input
                  type="text"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="Enter Discord User ID or search..."
                  className="w-full px-3 py-2 border border-border rounded-md shadow-sm input-field text-foreground"
                />
                <button
                  onClick={() => loadUserData(targetUserId)}
                  disabled={!targetUserId || targetUserId.length < 10}
                  className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Load User
                </button>
              </div>

              {selectedUser && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">{selectedUser.level}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-800 dark:text-blue-200">
                        {selectedUser.userData?.displayName || `User ${selectedUser.user_id.slice(-4)}`}
                      </h4>
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        ID: {selectedUser.user_id}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white dark:bg-gray-800 rounded p-2">
                      <div className="text-gray-500 dark:text-gray-400">Level</div>
                      <div className="font-bold text-blue-600 dark:text-blue-400">{selectedUser.level}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded p-2">
                      <div className="text-gray-500 dark:text-gray-400">Rank</div>
                      <div className="font-bold">#{selectedUser.rank}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded p-2">
                      <div className="text-gray-500 dark:text-gray-400">Total XP</div>
                      <div className="font-bold">{selectedUser.xp.toLocaleString()}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded p-2">
                      <div className="text-gray-500 dark:text-gray-400">Messages</div>
                      <div className="font-bold">{selectedUser.message_count.toLocaleString()}</div>
                    </div>
                  </div>

                  {selectedUser?.nextLevelXP && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>Progress to Level {selectedUser.level + 1}</span>
                        <span>{selectedUser.currentLevelXP?.toLocaleString()} / {selectedUser.nextLevelXP.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min(100, ((selectedUser.currentLevelXP || 0) / selectedUser.nextLevelXP) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      setTargetUserId('');
                    }}
                    className="w-full mt-3 px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Clear Selection
                  </button>
                </div>
              )}

              {/* Top Users Quick Select */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Top Users</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {leaderboard?.leaderboard?.slice(0, 10).map((user, index) => (
                    <button
                      key={user.user_id}
                      onClick={() => {
                        setTargetUserId(user.user_id);
                        loadUserData(user.user_id);
                      }}
                      className="w-full p-2 text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xs text-white font-bold">
                          {user.level}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {user.userData?.displayName || `User ${user.user_id.slice(-4)}`}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            #{index + 1} • {user.xp.toLocaleString()} XP
                          </div>
                        </div>
                      </div>
                    </button>
                  )) || (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No users found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* XP Management Controls */}
          <div className={classNames(
            "rounded-lg border p-6",
            darkMode ? "content-area" : "content-area"
          )}>
            <h3 className="text-lg font-semibold text-foreground mb-4">XP Management Controls</h3>
            
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
              {!selectedUser && (
                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    Please select a user from the left panel to manage their XP.
                  </p>
                </div>
              )}

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
                      className="w-full px-3 py-2 border border-border rounded-md shadow-sm input-field text-foreground"
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
                      className="w-full px-3 py-2 border border-border rounded-md shadow-sm input-field text-foreground"
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
                  className="w-full px-3 py-2 border border-border rounded-md shadow-sm input-field text-foreground"
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

              {/* XP Change Preview */}
              {selectedUser && xpAmount && parseInt(xpAmount) !== 0 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">Preview Changes</h4>
                  {(() => {
                    const xpChange = parseInt(xpAmount) || 0;
                    const preview = calculateNewLevel(selectedUser.xp, xpChange);
                    const levelChange = preview.newLevel - selectedUser.level;
                    
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Current:</span>
                          <span className="font-medium">Level {selectedUser.level} • {selectedUser.xp.toLocaleString()} XP</span>
                        </div>
                        
                        <div className="flex items-center justify-center my-2">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            xpChange > 0 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {xpChange > 0 ? '+' : ''}{xpChange.toLocaleString()} XP
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Result:</span>
                          <span className="font-medium">
                            Level {preview.newLevel} • {preview.newTotalXP.toLocaleString()} XP
                            {levelChange !== 0 && (
                              <span className={`ml-2 ${
                                levelChange > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                ({levelChange > 0 ? '+' : ''}{levelChange} level{Math.abs(levelChange) !== 1 ? 's' : ''})
                              </span>
                            )}
                          </span>
                        </div>
                        
                        {preview.newLevel > 0 && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                              <span>Progress to Level {preview.newLevel + 1}</span>
                              <span>{preview.currentLevelXP.toLocaleString()} / {preview.nextLevelXP.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, preview.progressPercent)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Discord-Style Level Card Preview */}
          {selectedUser && (
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "content-area" : "content-area"
            )}>
              <h3 className="text-lg font-semibold text-foreground mb-4">Level Card Preview</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This is how the user's level appears when they use <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/level</code>
              </p>
              
              
              {/* Discord-style embed card */}
              <div className="bg-[#2f3136] rounded-lg p-3 border-l-4 border-blue-500 max-w-sm">
                {/* Bot header */}
                <div className="flex items-center mb-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                    <span className="text-white text-xs font-bold font-sans">B</span>
                  </div>
                  <span className="text-white text-xs font-medium font-sans">Discord Bot</span>
                  <span className="text-[#72767d] text-[10px] ml-1 font-sans uppercase tracking-wide">BOT</span>
                  <span className="text-[#72767d] text-[10px] ml-auto font-mono">Today at {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>

                {/* Level card content */}
                <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-md p-3 relative overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
                  {/* Enhanced background pattern with animations */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-2 right-2 w-20 h-20 border-2 border-white/20 rounded-full animate-pulse"></div>
                    <div className="absolute bottom-2 left-2 w-16 h-16 border-2 border-white/20 rounded-full animate-bounce"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white/10 rounded-full" style={{ animation: 'spin 8s linear infinite' }}></div>
                    {/* Floating particles */}
                    <div className="absolute top-4 left-4 w-2 h-2 bg-white/20 rounded-full animate-ping"></div>
                    <div className="absolute top-8 right-8 w-1 h-1 bg-white/30 rounded-full animate-pulse"></div>
                    <div className="absolute bottom-6 right-6 w-1.5 h-1.5 bg-white/25 rounded-full animate-bounce"></div>
                  </div>
                  
                  {/* Gradient overlay animation */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 animate-pulse"></div>

                  <div className="relative z-10">
                    {/* User info header */}
                    <div className="flex items-center mb-3">
                      <div className="relative mr-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-400 via-pink-500 to-red-500 rounded-full flex items-center justify-center border border-white/20 shadow-lg transform transition-all duration-300 hover:scale-110 hover:rotate-12">
                          <span className="text-white font-bold text-sm font-sans">
                            {selectedUser.userData?.displayName?.[0] || 'U'}
                          </span>
                        </div>
                        {/* Level badge */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border border-white/20 animate-pulse font-mono">
                          {selectedUser.level}
                        </div>
                        {/* Glow effect */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-400/20 to-pink-500/20 blur-sm animate-pulse"></div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold text-sm hover:text-yellow-200 transition-colors duration-200 cursor-default font-sans">
                          {selectedUser.userData?.displayName || `User ${selectedUser.user_id.slice(-4)}`}
                        </h3>
                        <p className="text-white/80 text-xs flex items-center space-x-1.5 font-sans">
                          <span className="bg-yellow-500/20 px-1.5 py-0.5 rounded-full text-yellow-200 font-medium text-[10px]">
                            Rank #{selectedUser.rank}
                          </span>
                          <span className="text-white/60">•</span>
                          <span className="bg-blue-500/20 px-1.5 py-0.5 rounded-full text-blue-200 font-medium text-[10px]">
                            Level {selectedUser.level}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* XP Progress */}
                    <div className="mb-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white/90 text-xs font-medium flex items-center font-mono">
                          <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse"></span>
                          {selectedUser.currentLevelXP?.toLocaleString() || 0} / {selectedUser.nextLevelXP?.toLocaleString() || 1} XP
                        </span>
                        <span className="text-white/90 text-xs font-medium bg-white/10 px-1.5 py-0.5 rounded-full backdrop-blur-sm font-mono">
                          {selectedUser.nextLevelXP ? Math.round(((selectedUser.currentLevelXP || 0) / selectedUser.nextLevelXP) * 100) : 0}%
                        </span>
                      </div>
                      <div className="relative w-full bg-black/30 rounded-full h-3 overflow-hidden border border-white/10">
                        {/* Background glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 animate-pulse"></div>
                        
                        {/* Progress bar */}
                        <div 
                          className="relative bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 h-full rounded-full transition-all duration-1000 ease-out shadow-lg"
                          style={{ 
                            width: `${selectedUser.nextLevelXP ? Math.min(100, ((selectedUser.currentLevelXP || 0) / selectedUser.nextLevelXP) * 100) : 0}%` 
                          }}
                        >
                          {/* Shimmer effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                          {/* Glow effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full blur-sm opacity-50"></div>
                        </div>
                        
                        {/* Progress indicators */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex space-x-0.5">
                            {[...Array(5)].map((_, i) => (
                              <div 
                                key={i}
                                className={`w-0.5 h-0.5 rounded-full transition-all duration-300 ${
                                  i < Math.floor(((selectedUser.currentLevelXP || 0) / (selectedUser.nextLevelXP || 1)) * 5) 
                                    ? 'bg-white animate-pulse' 
                                    : 'bg-white/20'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-black/30 rounded-md p-2 text-center backdrop-blur-sm border border-white/10 transform transition-all duration-300 hover:scale-105 hover:bg-black/40 hover:border-blue-400/50 group cursor-pointer">
                        <div className="text-white font-semibold text-sm group-hover:text-blue-300 transition-colors duration-200 flex items-center justify-center font-mono">
                          <span className="mr-1 text-xs">💎</span>
                          {selectedUser.xp.toLocaleString()}
                        </div>
                        <div className="text-white/70 text-[10px] uppercase tracking-wider group-hover:text-blue-200 transition-colors duration-200 font-sans mt-0.5">TOTAL XP</div>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                      <div className="bg-black/30 rounded-md p-2 text-center backdrop-blur-sm border border-white/10 transform transition-all duration-300 hover:scale-105 hover:bg-black/40 hover:border-yellow-400/50 group cursor-pointer relative">
                        <div className="text-white font-semibold text-sm group-hover:text-yellow-300 transition-colors duration-200 flex items-center justify-center font-mono">
                          <span className="mr-1 text-xs">⭐</span>
                          {selectedUser.level}
                        </div>
                        <div className="text-white/70 text-[10px] uppercase tracking-wider group-hover:text-yellow-200 transition-colors duration-200 font-sans mt-0.5">LEVEL</div>
                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/10 to-yellow-500/0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        {/* Special glow for level */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-md blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"></div>
                      </div>
                      <div className="bg-black/30 rounded-md p-2 text-center backdrop-blur-sm border border-white/10 transform transition-all duration-300 hover:scale-105 hover:bg-black/40 hover:border-green-400/50 group cursor-pointer">
                        <div className="text-white font-semibold text-sm group-hover:text-green-300 transition-colors duration-200 flex items-center justify-center font-mono">
                          <span className="mr-1 text-xs">💬</span>
                          {selectedUser.message_count.toLocaleString()}
                        </div>
                        <div className="text-white/70 text-[10px] uppercase tracking-wider group-hover:text-green-200 transition-colors duration-200 font-sans mt-0.5">MESSAGES</div>
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/10 to-green-500/0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                    </div>

                    {/* Next level info */}
                    {selectedUser.nextLevelXP && (
                      <div className="mt-3 text-center">
                        <p className="text-white/80 text-sm">
                          <span className="font-medium">{(selectedUser.nextLevelXP - (selectedUser.currentLevelXP || 0)).toLocaleString()} XP</span> until level {selectedUser.level + 1}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer with server info */}
                <div className="mt-3 flex items-center justify-between text-xs text-[#72767d]">
                  <span>Coding API Server</span>
                  <span>🎯 Leveling System</span>
                </div>
              </div>

              {/* Additional Discord-style info */}
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Level Rewards Preview</h4>
                <div className="space-y-2">
                  {/* Show next few level milestones */}
                  {[selectedUser.level + 1, selectedUser.level + 5, selectedUser.level + 10].map((level) => (
                    <div key={level} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Level {level}</span>
                      <span className="text-purple-600 dark:text-purple-400 font-medium">
                        {Math.pow(level, 2) * 100} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live preview toggle */}
              <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Live Preview</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Updates automatically when XP changes</p>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          )}

          {!selectedUser && (
            <div className={classNames(
              "rounded-lg border p-6 flex items-center justify-center",
              darkMode ? "content-area" : "content-area"
            )}>
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No User Selected</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select a user to see their Discord level card preview
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "content-area" : "content-area"
        )}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Leveling Settings</h3>
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
                  <label className="font-medium text-foreground">Enable Leveling System</label>
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
                  <label className="block text-sm font-medium text-foreground mb-2">
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
                  <label className="block text-sm font-medium text-foreground mb-2">
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
                  <label className="block text-sm font-medium text-foreground mb-2">
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
                  <label className="block text-sm font-medium text-foreground mb-2">
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