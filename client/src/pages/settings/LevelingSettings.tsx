import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import PermissionGuard from '../../components/common/PermissionGuard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  ChartBarIcon,
  TrophyIcon,
  SpeakerWaveIcon,
  ClockIcon,
  GiftIcon,
  ChartPieIcon,
  BoltIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface LevelingSettingsData {
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

interface ServerInfo {
  id: string;
  name: string;
  memberCount: number;
  icon?: string;
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface Role {
  id: string;
  name: string;
  color: string;
}

interface LevelReward {
  id: string;
  level: number;
  type: 'role' | 'currency' | 'custom';
  value: string;
  amount?: number;
  description: string;
}

const LevelingSettingsContent: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [settings, setSettings] = useState<LevelingSettingsData | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<LevelingSettingsData | null>(null);
  const [levelRewards, setLevelRewards] = useState<LevelReward[]>([]);
  const [newReward, setNewReward] = useState<Partial<LevelReward>>({});
  const [showAddReward, setShowAddReward] = useState(false);

  // Default settings helper
  const getDefaultSettings = useCallback((): LevelingSettingsData => ({
    guild_id: serverId!,
    enabled: false,
    xp_per_message: 15,
    xp_cooldown: 60,
    xp_multiplier: 1.0,
    level_formula: 'quadratic',
    base_xp: 100,
    xp_multiplier_per_level: 1.1,
    level_up_message_enabled: true,
    level_up_channel_id: '',
    level_up_message: 'Congratulations {user}, you reached level {level}! 🎉',
    level_rewards: '[]',
    voice_xp_enabled: false,
    voice_xp_rate: 10,
    boost_channels: '[]',
    boost_roles: '[]',
    ignored_channels: '[]',
    ignored_roles: '[]',
    leaderboard_enabled: true,
    leaderboard_channel_id: '',
    leaderboard_update_interval: 3600
  }), [serverId]);

  // Level formula options
  const formulaOptions = [
    { 
      value: 'linear', 
      label: 'Linear', 
      description: 'Consistent XP requirement increase per level',
      formula: 'Base XP × Level'
    },
    { 
      value: 'quadratic', 
      label: 'Quadratic', 
      description: 'Exponentially increasing XP requirements',
      formula: 'Base XP × Level²'
    },
    { 
      value: 'exponential', 
      label: 'Exponential', 
      description: 'Rapidly increasing XP requirements',
      formula: 'Base XP × Multiplier^Level'
    },
    { 
      value: 'logarithmic', 
      label: 'Logarithmic', 
      description: 'Slower increase at higher levels',
      formula: 'Base XP × log(Level + 1)'
    }
  ];

  // Available variables for level up messages
  const levelUpVariables = [
    { name: '{user}', description: 'Mentions the user (@username)' },
    { name: '{user.name}', description: 'User\'s display name' },
    { name: '{level}', description: 'New level achieved' },
    { name: '{xp}', description: 'Total XP accumulated' },
    { name: '{next_level_xp}', description: 'XP needed for next level' },
    { name: '{server}', description: 'Server name' }
  ];

  // Load data
  useEffect(() => {
    if (!serverId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Load server info, channels, and settings
        const [serverResponse, channelsResponse, settingsResponse] = await Promise.all([
          apiService.getServerInfo(serverId),
          apiService.getServerChannels(serverId),
          fetch(`${process.env.REACT_APP_API_URL}/api/settings/${serverId}/leveling`)
        ]);

        if (serverResponse.success && serverResponse.data) {
          setServerInfo(serverResponse.data);
        }

        if (channelsResponse.success && channelsResponse.data) {
          const textChannels = channelsResponse.data.filter((ch: Channel) => ch.type === 0);
          setChannels(textChannels);
        }

        // Mock roles data
        setRoles([
          { id: '1', name: 'Level 5', color: '#ff6b6b' },
          { id: '2', name: 'Level 10', color: '#4ecdc4' },
          { id: '3', name: 'Level 25', color: '#45b7d1' },
          { id: '4', name: 'Level 50', color: '#f9ca24' },
          { id: '5', name: 'Level 100', color: '#f0932b' },
          { id: '6', name: 'Active Member', color: '#eb4d4b' },
          { id: '7', name: 'Veteran', color: '#6c5ce7' }
        ]);

        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          if (settingsData.success && settingsData.data) {
            const loadedSettings = settingsData.data;
            setSettings(loadedSettings);
            setOriginalSettings(JSON.parse(JSON.stringify(loadedSettings)));
            
            // Parse level rewards
            try {
              const rewards = JSON.parse(loadedSettings.level_rewards || '[]');
              setLevelRewards(rewards);
            } catch {
              setLevelRewards([]);
            }
          } else {
            const defaultSettings = getDefaultSettings();
            setSettings(defaultSettings);
            setOriginalSettings(JSON.parse(JSON.stringify(defaultSettings)));
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load settings');
        const defaultSettings = getDefaultSettings();
        setSettings(defaultSettings);
        setOriginalSettings(JSON.parse(JSON.stringify(defaultSettings)));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [serverId, getDefaultSettings]);

  // Check for changes
  useEffect(() => {
    if (!settings || !originalSettings) return;
    
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const updateSetting = (key: keyof LevelingSettingsData, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [key]: value
    });
  };

  const handleArraySetting = (key: keyof LevelingSettingsData, itemId: string, checked: boolean) => {
    if (!settings) return;
    
    try {
      const currentArray = JSON.parse((settings[key] as string) || '[]');
      const updatedArray = checked
        ? [...currentArray, itemId]
        : currentArray.filter((id: string) => id !== itemId);
      
      updateSetting(key, JSON.stringify(updatedArray));
    } catch (error) {
      console.error('Error updating array setting:', error);
    }
  };

  const isInArray = (key: keyof LevelingSettingsData, itemId: string): boolean => {
    if (!settings) return false;
    
    try {
      const array = JSON.parse((settings[key] as string) || '[]');
      return array.includes(itemId);
    } catch {
      return false;
    }
  };

  const addLevelReward = () => {
    if (!newReward.level || !newReward.type || !newReward.value) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check if level already has a reward
    if (levelRewards.some(r => r.level === newReward.level)) {
      toast.error('A reward for this level already exists');
      return;
    }

    const reward: LevelReward = {
      id: Date.now().toString(),
      level: newReward.level!,
      type: newReward.type!,
      value: newReward.value!,
      amount: newReward.amount,
      description: newReward.description || ''
    };

    const updatedRewards = [...levelRewards, reward].sort((a, b) => a.level - b.level);
    setLevelRewards(updatedRewards);
    updateSetting('level_rewards', JSON.stringify(updatedRewards));
    setNewReward({});
    setShowAddReward(false);
    toast.success('Level reward added');
  };

  const removeLevelReward = (rewardId: string) => {
    const updatedRewards = levelRewards.filter(r => r.id !== rewardId);
    setLevelRewards(updatedRewards);
    updateSetting('level_rewards', JSON.stringify(updatedRewards));
    toast.success('Level reward removed');
  };

  const calculateXPForLevel = (level: number): number => {
    const formula = settings?.level_formula || 'quadratic';
    const baseXP = settings?.base_xp || 100;
    const multiplier = settings?.xp_multiplier_per_level || 1.1;

    switch (formula) {
      case 'linear':
        return baseXP * level;
      case 'quadratic':
        return baseXP * Math.pow(level, 2);
      case 'exponential':
        return Math.floor(baseXP * Math.pow(multiplier, level));
      case 'logarithmic':
        return Math.floor(baseXP * Math.log(level + 1) * 10);
      default:
        return baseXP * Math.pow(level, 2);
    }
  };

  const handleSave = async () => {
    if (!settings || !serverId) return;

    setSaving(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/settings/${serverId}/leveling`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_API_KEY}`
        },
        body: JSON.stringify(settings)
      });

      const result = await response.json();

      if (result.success) {
        setOriginalSettings(JSON.parse(JSON.stringify(settings)));
        setHasChanges(false);
        toast.success('Leveling settings saved successfully!');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!originalSettings) return;
    setSettings(JSON.parse(JSON.stringify(originalSettings)));
    
    // Reset level rewards
    try {
      const rewards = JSON.parse(originalSettings.level_rewards || '[]');
      setLevelRewards(rewards);
    } catch {
      setLevelRewards([]);
    }
    
    toast.success('Settings reset to last saved state');
  };

  const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
  }> = ({ checked, onChange, disabled = false }) => (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={classNames(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
        checked ? "bg-emerald-600" : (darkMode ? "bg-gray-600" : "bg-gray-300"),
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
      )}
    >
      <span
        className={classNames(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!settings) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className={classNames(
          "text-center p-8 rounded-lg border",
          darkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-600"
        )}>
          <ChartBarIcon className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Settings</h3>
          <p>Unable to load leveling settings. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => navigate(`/servers/${serverId}/settings/advanced`)}
            className={classNames(
              "p-2 rounded-lg transition-colors",
              darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
            )}
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          
          <div className={classNames(
            "p-3 rounded-lg",
            darkMode ? "bg-emerald-900/20" : "bg-emerald-100"
          )}>
            <ChartBarIcon className={classNames(
              "h-8 w-8",
              darkMode ? "text-emerald-400" : "text-emerald-600"
            )} />
          </div>
          
          <div>
            <h1 className={classNames(
              "text-4xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Leveling System
            </h1>
            {serverInfo && (
              <p className={classNames(
                "text-lg font-medium mt-2",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                {serverInfo.name} • XP & Level Progression
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Master Enable/Disable */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <TrophyIcon className="h-6 w-6 mr-3 text-emerald-500" />
              <div>
                <h2 className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Leveling System
                </h2>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Enable XP earning and level progression for your server
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.enabled || false}
              onChange={(checked) => updateSetting('enabled', checked)}
            />
          </div>
        </div>

        {settings.enabled && (
          <>
            {/* Available Variables */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center mb-4">
                <BoltIcon className="h-6 w-6 mr-3 text-blue-500" />
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Available Variables
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {levelUpVariables.map((variable) => (
                  <div
                    key={variable.name}
                    className={classNames(
                      "p-3 rounded-lg border cursor-pointer transition-all hover:scale-105",
                      darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-300"
                    )}
                    onClick={() => navigator.clipboard.writeText(variable.name)}
                    title="Click to copy"
                  >
                    <code className={classNames(
                      "text-sm font-mono font-semibold",
                      darkMode ? "text-emerald-300" : "text-emerald-600"
                    )}>
                      {variable.name}
                    </code>
                    <p className={classNames(
                      "text-xs mt-1",
                      darkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      {variable.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* XP Configuration */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center mb-6">
                <ChartPieIcon className="h-6 w-6 mr-3 text-blue-500" />
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  XP Configuration
                </h3>
              </div>

              <div className="space-y-6">
                {/* Basic XP Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">XP per Message</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.xp_per_message || 15}
                      onChange={(e) => updateSetting('xp_per_message', parseInt(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Base XP earned per message</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">XP Cooldown (seconds)</label>
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={settings.xp_cooldown || 60}
                      onChange={(e) => updateSetting('xp_cooldown', parseInt(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum time between XP gains</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">XP Multiplier</label>
                    <input
                      type="number"
                      min="0.1"
                      max="5"
                      step="0.1"
                      value={settings.xp_multiplier || 1.0}
                      onChange={(e) => updateSetting('xp_multiplier', parseFloat(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Global XP multiplier</p>
                  </div>
                </div>

                {/* Voice XP */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <SpeakerWaveIcon className="h-5 w-5 mr-2 text-orange-500" />
                      <label className="text-sm font-medium">Voice XP</label>
                    </div>
                    <ToggleSwitch
                      checked={settings.voice_xp_enabled || false}
                      onChange={(checked) => updateSetting('voice_xp_enabled', checked)}
                    />
                  </div>

                  {settings.voice_xp_enabled && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Voice XP Rate (per minute)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={settings.voice_xp_rate || 10}
                        onChange={(e) => updateSetting('voice_xp_rate', parseInt(e.target.value))}
                        className={classNames(
                          "w-full max-w-xs px-3 py-2 rounded border",
                          darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Level Formula */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center mb-6">
                <ChartBarIcon className="h-6 w-6 mr-3 text-purple-500" />
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Level Calculation
                </h3>
              </div>

              <div className="space-y-6">
                {/* Formula Selection */}
                <div>
                  <label className="block text-sm font-medium mb-3">Level Formula</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {formulaOptions.map((formula) => (
                      <label
                        key={formula.value}
                        className={classNames(
                          "relative p-4 rounded-lg border-2 cursor-pointer transition-all",
                          settings.level_formula === formula.value
                            ? darkMode
                              ? "bg-purple-900/20 border-purple-500"
                              : "bg-purple-50 border-purple-500"
                            : darkMode
                              ? "bg-gray-700 border-gray-600 hover:border-gray-500"
                              : "bg-white border-gray-300 hover:border-gray-400"
                        )}
                      >
                        <input
                          type="radio"
                          name="levelFormula"
                          value={formula.value}
                          checked={settings.level_formula === formula.value}
                          onChange={(e) => updateSetting('level_formula', e.target.value)}
                          className="sr-only"
                        />
                        <h4 className={classNames(
                          "font-semibold mb-1",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                          {formula.label}
                        </h4>
                        <p className={classNames(
                          "text-xs mb-2",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          {formula.description}
                        </p>
                        <code className={classNames(
                          "text-xs font-mono",
                          darkMode ? "text-purple-300" : "text-purple-600"
                        )}>
                          {formula.formula}
                        </code>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Formula Parameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Base XP</label>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={settings.base_xp || 100}
                      onChange={(e) => updateSetting('base_xp', parseInt(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Starting XP requirement</p>
                  </div>

                  {settings.level_formula === 'exponential' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">XP Multiplier per Level</label>
                      <input
                        type="number"
                        min="1.0"
                        max="2.0"
                        step="0.1"
                        value={settings.xp_multiplier_per_level || 1.1}
                        onChange={(e) => updateSetting('xp_multiplier_per_level', parseFloat(e.target.value))}
                        className={classNames(
                          "w-full px-3 py-2 rounded border",
                          darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                      <p className="text-xs text-gray-500 mt-1">Multiplier for exponential growth</p>
                    </div>
                  )}
                </div>

                {/* Level Preview */}
                <div className={classNames(
                  "p-4 rounded-lg",
                  darkMode ? "bg-gray-700" : "bg-gray-50"
                )}>
                  <h4 className={classNames(
                    "font-semibold mb-3",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    XP Requirements Preview
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                    {[1, 5, 10, 25, 50].map((level) => (
                      <div key={level} className="text-center">
                        <div className={classNames(
                          "font-semibold",
                          darkMode ? "text-emerald-400" : "text-emerald-600"
                        )}>
                          Level {level}
                        </div>
                        <div className={classNames(
                          "text-xs",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          {calculateXPForLevel(level).toLocaleString()} XP
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Level Up Messages */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <GiftIcon className="h-6 w-6 mr-3 text-green-500" />
                  <div>
                    <h3 className={classNames(
                      "text-xl font-bold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>
                      Level Up Messages
                    </h3>
                    <p className={classNames(
                      "text-sm mt-1",
                      darkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      Congratulate users when they level up
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.level_up_message_enabled || false}
                  onChange={(checked) => updateSetting('level_up_message_enabled', checked)}
                />
              </div>

              {settings.level_up_message_enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Level Up Channel</label>
                    <select
                      value={settings.level_up_channel_id || ''}
                      onChange={(e) => updateSetting('level_up_channel_id', e.target.value)}
                      className={classNames(
                        "w-full max-w-md px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    >
                      <option value="">Same channel as message</option>
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Level Up Message</label>
                    <textarea
                      value={settings.level_up_message || ''}
                      onChange={(e) => updateSetting('level_up_message', e.target.value)}
                      placeholder="Congratulations {user}, you reached level {level}! 🎉"
                      rows={3}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Level Rewards */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <TrophyIcon className="h-6 w-6 mr-3 text-yellow-500" />
                  <h3 className={classNames(
                    "text-xl font-bold",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    Level Rewards
                  </h3>
                </div>
                
                {!showAddReward && (
                  <button
                    onClick={() => setShowAddReward(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Add Reward</span>
                  </button>
                )}
              </div>

              {/* Add Reward Form */}
              {showAddReward && (
                <div className={classNames(
                  "p-4 rounded-lg border-2 border-dashed mb-6",
                  darkMode ? "border-gray-600" : "border-gray-300"
                )}>
                  <h4 className="font-semibold mb-4">Add Level Reward</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Level</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={newReward.level || ''}
                        onChange={(e) => setNewReward({...newReward, level: parseInt(e.target.value)})}
                        className={classNames(
                          "w-full px-3 py-2 rounded border",
                          darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Type</label>
                      <select
                        value={newReward.type || 'role'}
                        onChange={(e) => setNewReward({...newReward, type: e.target.value as any})}
                        className={classNames(
                          "w-full px-3 py-2 rounded border",
                          darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      >
                        <option value="role">Discord Role</option>
                        <option value="currency">Currency Reward</option>
                        <option value="custom">Custom Reward</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {newReward.type === 'role' ? 'Role' : newReward.type === 'currency' ? 'Amount' : 'Value'}
                      </label>
                      {newReward.type === 'role' ? (
                        <select
                          value={newReward.value || ''}
                          onChange={(e) => setNewReward({...newReward, value: e.target.value})}
                          className={classNames(
                            "w-full px-3 py-2 rounded border",
                            darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                          )}
                        >
                          <option value="">Select role</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={newReward.type === 'currency' ? 'number' : 'text'}
                          value={newReward.value || ''}
                          onChange={(e) => setNewReward({...newReward, value: e.target.value})}
                          placeholder={newReward.type === 'currency' ? '100' : 'Custom reward'}
                          className={classNames(
                            "w-full px-3 py-2 rounded border",
                            darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                          )}
                        />
                      )}
                    </div>
                    
                    <div className="flex items-end space-x-2">
                      <button
                        onClick={addLevelReward}
                        className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAddReward(false);
                          setNewReward({});
                        }}
                        className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Existing Rewards */}
              {levelRewards.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-4">Configured Rewards ({levelRewards.length})</h4>
                  <div className="space-y-2">
                    {levelRewards.map((reward) => {
                      const role = roles.find(r => r.id === reward.value);
                      return (
                        <div
                          key={reward.id}
                          className={classNames(
                            "flex items-center justify-between p-3 rounded-lg border",
                            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-300"
                          )}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={classNames(
                              "px-3 py-1 rounded-full text-sm font-medium",
                              darkMode ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800"
                            )}>
                              Level {reward.level}
                            </div>
                            
                            <div>
                              <div className="flex items-center space-x-2">
                                {reward.type === 'role' && role && (
                                  <div
                                    className="w-3 h-3 rounded"
                                    style={{ backgroundColor: role.color }}
                                  />
                                )}
                                <span className={classNames(
                                  "font-medium",
                                  darkMode ? "text-white" : "text-gray-900"
                                )}>
                                  {reward.type === 'role' 
                                    ? role?.name || 'Unknown Role'
                                    : reward.type === 'currency'
                                    ? `${reward.value} coins`
                                    : reward.value
                                  }
                                </span>
                              </div>
                              {reward.description && (
                                <p className={classNames(
                                  "text-sm",
                                  darkMode ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {reward.description}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => removeLevelReward(reward.id)}
                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Channel & Role Management */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center mb-6">
                <ClockIcon className="h-6 w-6 mr-3 text-indigo-500" />
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Channel & Role Management
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Boost Channels */}
                <div>
                  <h4 className="text-lg font-semibold mb-4">XP Boost Channels</h4>
                  <p className="text-sm text-gray-500 mb-4">Channels that give extra XP</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {channels.slice(0, 8).map((channel) => (
                      <label
                        key={channel.id}
                        className={classNames(
                          "flex items-center p-2 rounded border cursor-pointer transition-all",
                          isInArray('boost_channels', channel.id)
                            ? darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-300"
                            : darkMode ? "bg-gray-800 border-gray-700 hover:bg-gray-700" : "bg-white border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isInArray('boost_channels', channel.id)}
                          onChange={(e) => handleArraySetting('boost_channels', channel.id, e.target.checked)}
                          className="mr-3 h-4 w-4 text-indigo-600 rounded"
                        />
                        <span className="text-sm">#{channel.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Ignored Channels */}
                <div>
                  <h4 className="text-lg font-semibold mb-4">Ignored Channels</h4>
                  <p className="text-sm text-gray-500 mb-4">Channels where XP is not gained</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {channels.slice(0, 8).map((channel) => (
                      <label
                        key={channel.id}
                        className={classNames(
                          "flex items-center p-2 rounded border cursor-pointer transition-all",
                          isInArray('ignored_channels', channel.id)
                            ? darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-300"
                            : darkMode ? "bg-gray-800 border-gray-700 hover:bg-gray-700" : "bg-white border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isInArray('ignored_channels', channel.id)}
                          onChange={(e) => handleArraySetting('ignored_channels', channel.id, e.target.checked)}
                          className="mr-3 h-4 w-4 text-red-600 rounded"
                        />
                        <span className="text-sm">#{channel.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <TrophyIcon className="h-6 w-6 mr-3 text-gold-500" />
                  <div>
                    <h3 className={classNames(
                      "text-xl font-bold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>
                      Leaderboard
                    </h3>
                    <p className={classNames(
                      "text-sm mt-1",
                      darkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      Show top users by level and XP
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.leaderboard_enabled || false}
                  onChange={(checked) => updateSetting('leaderboard_enabled', checked)}
                />
              </div>

              {settings.leaderboard_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Leaderboard Channel</label>
                    <select
                      value={settings.leaderboard_channel_id || ''}
                      onChange={(e) => updateSetting('leaderboard_channel_id', e.target.value)}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    >
                      <option value="">No automatic updates</option>
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Update Interval (hours)</label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={Math.floor((settings.leaderboard_update_interval || 3600) / 3600)}
                      onChange={(e) => updateSetting('leaderboard_update_interval', parseInt(e.target.value) * 3600)}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className={classNames(
              "px-6 py-2 rounded-lg border-2 transition-all",
              hasChanges
                ? darkMode
                  ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-100"
                : "border-gray-400 text-gray-400 cursor-not-allowed"
            )}
          >
            Reset Changes
          </button>
          
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={classNames(
              "px-8 py-2 rounded-lg font-medium transition-all flex items-center space-x-2",
              hasChanges && !saving
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : darkMode
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            <span>{saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const LevelingSettings: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['admin', 'system_admin', 'manage_servers']}
      fallbackMessage="You need administrator privileges to access leveling settings."
    >
      <LevelingSettingsContent />
    </PermissionGuard>
  );
};

export default LevelingSettings;