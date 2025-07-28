import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import PermissionGuard from '../../components/common/PermissionGuard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  UserMinusIcon,
  BoltIcon,
  FunnelIcon,
  ChatBubbleBottomCenterTextIcon,
  NoSymbolIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface AutomodSettings {
  guild_id: string;
  enabled?: boolean;
  log_channel_id?: string;
  bypass_roles?: string;
  anti_spam_enabled?: boolean;
  spam_threshold?: number;
  spam_timeframe?: number;
  spam_punishment?: string;
  spam_duration?: number;
  anti_raid_enabled?: boolean;
  raid_threshold?: number;
  raid_timeframe?: number;
  raid_action?: string;
  filter_profanity?: boolean;
  filter_invites?: boolean;
  filter_links?: boolean;
  filter_caps?: boolean;
  filter_mentions?: boolean;
  custom_filters?: string;
  warning_threshold?: number;
  auto_timeout_duration?: number;
  auto_kick_threshold?: number;
  auto_ban_threshold?: number;
  whitelist_channels?: string;
  whitelist_roles?: string;
  punishment_escalation?: string;
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

const ModerationSettingsContent: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [settings, setSettings] = useState<AutomodSettings | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<AutomodSettings | null>(null);
  const [customFiltersText, setCustomFiltersText] = useState('');

  // Default settings helper
  const getDefaultSettings = useCallback((): AutomodSettings => ({
    guild_id: serverId!,
    enabled: false,
    log_channel_id: '',
    bypass_roles: '[]',
    anti_spam_enabled: true,
    spam_threshold: 5,
    spam_timeframe: 10,
    spam_punishment: 'timeout',
    spam_duration: 300,
    anti_raid_enabled: true,
    raid_threshold: 10,
    raid_timeframe: 60,
    raid_action: 'lockdown',
    filter_profanity: true,
    filter_invites: true,
    filter_links: false,
    filter_caps: true,
    filter_mentions: true,
    custom_filters: '[]',
    warning_threshold: 3,
    auto_timeout_duration: 600,
    auto_kick_threshold: 5,
    auto_ban_threshold: 7,
    whitelist_channels: '[]',
    whitelist_roles: '[]',
    punishment_escalation: '[]'
  }), [serverId]);

  // Punishment options
  const punishmentOptions = [
    { value: 'warn', label: 'Warning Only' },
    { value: 'timeout', label: 'Timeout' },
    { value: 'kick', label: 'Kick' },
    { value: 'ban', label: 'Ban' }
  ];

  // Raid action options
  const raidActionOptions = [
    { value: 'lockdown', label: 'Server Lockdown' },
    { value: 'kick_new', label: 'Kick New Members' },
    { value: 'ban_new', label: 'Ban New Members' },
    { value: 'verify_new', label: 'Force Verification' }
  ];

  // Load data
  useEffect(() => {
    if (!serverId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Load server info, channels, roles, and settings
        const [serverResponse, channelsResponse, settingsResponse] = await Promise.all([
          apiService.getServerInfo(serverId),
          apiService.getServerChannels(serverId),
          fetch(`/api/settings/${serverId}/automod`)
        ]);

        if (serverResponse.success && serverResponse.data) {
          setServerInfo(serverResponse.data);
        }

        if (channelsResponse.success && channelsResponse.data) {
          const textChannels = channelsResponse.data.filter((ch: Channel) => ch.type === 0);
          setChannels(textChannels);
        }

        // Load roles (mock data for now)
        setRoles([
          { id: '1', name: 'Admin', color: '#ff0000' },
          { id: '2', name: 'Moderator', color: '#00ff00' },
          { id: '3', name: 'Staff', color: '#0000ff' },
          { id: '4', name: 'VIP', color: '#ffff00' }
        ]);

        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          if (settingsData.success && settingsData.data) {
            const loadedSettings = settingsData.data;
            setSettings(loadedSettings);
            setOriginalSettings(JSON.parse(JSON.stringify(loadedSettings)));
            
            // Parse custom filters for display
            try {
              const filters = JSON.parse(loadedSettings.custom_filters || '[]');
              setCustomFiltersText(filters.join('\n'));
            } catch {
              setCustomFiltersText('');
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

  const updateSetting = (key: keyof AutomodSettings, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [key]: value
    });
  };

  const handleCustomFiltersChange = (text: string) => {
    setCustomFiltersText(text);
    const filters = text.split('\n').filter(line => line.trim() !== '');
    updateSetting('custom_filters', JSON.stringify(filters));
  };

  const handleArraySetting = (key: keyof AutomodSettings, itemId: string, checked: boolean) => {
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

  const isInArray = (key: keyof AutomodSettings, itemId: string): boolean => {
    if (!settings) return false;
    
    try {
      const array = JSON.parse((settings[key] as string) || '[]');
      return array.includes(itemId);
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    if (!settings || !serverId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/settings/${serverId}/automod`, {
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
        toast.success('Auto-moderation settings saved successfully!');
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
    
    // Reset custom filters text
    try {
      const filters = JSON.parse(originalSettings.custom_filters || '[]');
      setCustomFiltersText(filters.join('\n'));
    } catch {
      setCustomFiltersText('');
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
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        checked ? "bg-blue-600" : (darkMode ? "bg-gray-600" : "bg-gray-300"),
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
          <ShieldCheckIcon className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Settings</h3>
          <p>Unable to load auto-moderation settings. Please try refreshing the page.</p>
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
            darkMode ? "bg-red-900/20" : "bg-red-100"
          )}>
            <ShieldCheckIcon className={classNames(
              "h-8 w-8",
              darkMode ? "text-red-400" : "text-red-600"
            )} />
          </div>
          
          <div>
            <h1 className={classNames(
              "text-4xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Auto-Moderation
            </h1>
            {serverInfo && (
              <p className={classNames(
                "text-lg font-medium mt-2",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                {serverInfo.name} • Automated Security & Moderation
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
              <BoltIcon className="h-6 w-6 mr-3 text-red-500" />
              <div>
                <h2 className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Auto-Moderation System
                </h2>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Enable or disable the entire auto-moderation system
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.enabled || false}
              onChange={(checked) => updateSetting('enabled', checked)}
            />
          </div>

          {settings.enabled && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className={classNames(
                "block text-sm font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Log Channel
              </label>
              <select
                value={settings.log_channel_id || ''}
                onChange={(e) => updateSetting('log_channel_id', e.target.value)}
                className={classNames(
                  "w-full max-w-md px-3 py-2 rounded-lg border transition-colors",
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-white focus:border-red-500" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-red-500",
                  "focus:outline-none focus:ring-2 focus:ring-red-500/20"
                )}
              >
                <option value="">Select a channel for moderation logs</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {settings.enabled && (
          <>
            {/* Anti-Spam Settings */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <ChatBubbleBottomCenterTextIcon className="h-6 w-6 mr-3 text-orange-500" />
                  <div>
                    <h3 className={classNames(
                      "text-xl font-bold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>
                      Anti-Spam Protection
                    </h3>
                    <p className={classNames(
                      "text-sm mt-1",
                      darkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      Automatically detect and punish spam messages
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.anti_spam_enabled || false}
                  onChange={(checked) => updateSetting('anti_spam_enabled', checked)}
                />
              </div>

              {settings.anti_spam_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className={classNames(
                      "block text-sm font-medium mb-2",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Spam Threshold
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="20"
                      value={settings.spam_threshold || 5}
                      onChange={(e) => updateSetting('spam_threshold', parseInt(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded-lg border transition-colors",
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Messages in timeframe</p>
                  </div>

                  <div>
                    <label className={classNames(
                      "block text-sm font-medium mb-2",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Timeframe (seconds)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={settings.spam_timeframe || 10}
                      onChange={(e) => updateSetting('spam_timeframe', parseInt(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded-lg border transition-colors",
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>

                  <div>
                    <label className={classNames(
                      "block text-sm font-medium mb-2",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Punishment
                    </label>
                    <select
                      value={settings.spam_punishment || 'timeout'}
                      onChange={(e) => updateSetting('spam_punishment', e.target.value)}
                      className={classNames(
                        "w-full px-3 py-2 rounded-lg border transition-colors",
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    >
                      {punishmentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {settings.spam_punishment === 'timeout' && (
                    <div>
                      <label className={classNames(
                        "block text-sm font-medium mb-2",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        Timeout Duration (seconds)
                      </label>
                      <input
                        type="number"
                        min="60"
                        max="2419200"
                        value={settings.spam_duration || 300}
                        onChange={(e) => updateSetting('spam_duration', parseInt(e.target.value))}
                        className={classNames(
                          "w-full px-3 py-2 rounded-lg border transition-colors",
                          darkMode 
                            ? "bg-gray-700 border-gray-600 text-white" 
                            : "bg-white border-gray-300 text-gray-900"
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Anti-Raid Settings */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-6 w-6 mr-3 text-red-500" />
                  <div>
                    <h3 className={classNames(
                      "text-xl font-bold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>
                      Anti-Raid Protection
                    </h3>
                    <p className={classNames(
                      "text-sm mt-1",
                      darkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      Protect against coordinated server raids
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.anti_raid_enabled || false}
                  onChange={(checked) => updateSetting('anti_raid_enabled', checked)}
                />
              </div>

              {settings.anti_raid_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className={classNames(
                      "block text-sm font-medium mb-2",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Join Threshold
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="50"
                      value={settings.raid_threshold || 10}
                      onChange={(e) => updateSetting('raid_threshold', parseInt(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded-lg border transition-colors",
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Users joining in timeframe</p>
                  </div>

                  <div>
                    <label className={classNames(
                      "block text-sm font-medium mb-2",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Timeframe (seconds)
                    </label>
                    <input
                      type="number"
                      min="30"
                      max="300"
                      value={settings.raid_timeframe || 60}
                      onChange={(e) => updateSetting('raid_timeframe', parseInt(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded-lg border transition-colors",
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>

                  <div>
                    <label className={classNames(
                      "block text-sm font-medium mb-2",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Action
                    </label>
                    <select
                      value={settings.raid_action || 'lockdown'}
                      onChange={(e) => updateSetting('raid_action', e.target.value)}
                      className={classNames(
                        "w-full px-3 py-2 rounded-lg border transition-colors",
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    >
                      {raidActionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Content Filters */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center mb-6">
                <FunnelIcon className="h-6 w-6 mr-3 text-purple-500" />
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Content Filters
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { key: 'filter_profanity', label: 'Profanity Filter', description: 'Block inappropriate language' },
                  { key: 'filter_invites', label: 'Discord Invites', description: 'Block Discord server invites' },
                  { key: 'filter_links', label: 'External Links', description: 'Block external website links' },
                  { key: 'filter_caps', label: 'Excessive Caps', description: 'Block messages with too many capitals' },
                  { key: 'filter_mentions', label: 'Mass Mentions', description: 'Block messages with many mentions' }
                ].map((filter) => (
                  <div
                    key={filter.key}
                    className={classNames(
                      "p-4 rounded-lg border-2 transition-all",
                      settings[filter.key as keyof AutomodSettings]
                        ? darkMode
                          ? "bg-purple-900/20 border-purple-500"
                          : "bg-purple-50 border-purple-500"
                        : darkMode
                          ? "bg-gray-700 border-gray-600"
                          : "bg-gray-50 border-gray-300"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={classNames(
                        "font-medium",
                        darkMode ? "text-white" : "text-gray-900"
                      )}>
                        {filter.label}
                      </h4>
                      <ToggleSwitch
                        checked={settings[filter.key as keyof AutomodSettings] as boolean || false}
                        onChange={(checked) => updateSetting(filter.key as keyof AutomodSettings, checked)}
                      />
                    </div>
                    <p className={classNames(
                      "text-sm",
                      darkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      {filter.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Custom Filters */}
              <div className="mt-6">
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Custom Filters
                </label>
                <textarea
                  value={customFiltersText}
                  onChange={(e) => handleCustomFiltersChange(e.target.value)}
                  placeholder="Enter custom words/phrases to filter, one per line"
                  rows={4}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500",
                    "focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  )}
                />
                <p className={classNames(
                  "text-xs mt-1",
                  darkMode ? "text-gray-400" : "text-gray-500"
                )}>
                  Words and phrases that will be automatically filtered from messages
                </p>
              </div>
            </div>

            {/* Punishment Escalation */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center mb-6">
                <UserMinusIcon className="h-6 w-6 mr-3 text-yellow-500" />
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Punishment Escalation
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Warning Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.warning_threshold || 3}
                    onChange={(e) => updateSetting('warning_threshold', parseInt(e.target.value))}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                  <p className="text-xs text-gray-500 mt-1">Warnings before timeout</p>
                </div>

                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Auto-Timeout Duration
                  </label>
                  <input
                    type="number"
                    min="60"
                    max="86400"
                    value={settings.auto_timeout_duration || 600}
                    onChange={(e) => updateSetting('auto_timeout_duration', parseInt(e.target.value))}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                  <p className="text-xs text-gray-500 mt-1">Seconds</p>
                </div>

                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Auto-Kick Threshold
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="15"
                    value={settings.auto_kick_threshold || 5}
                    onChange={(e) => updateSetting('auto_kick_threshold', parseInt(e.target.value))}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                  <p className="text-xs text-gray-500 mt-1">Warnings before kick</p>
                </div>

                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Auto-Ban Threshold
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="20"
                    value={settings.auto_ban_threshold || 7}
                    onChange={(e) => updateSetting('auto_ban_threshold', parseInt(e.target.value))}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                  <p className="text-xs text-gray-500 mt-1">Warnings before ban</p>
                </div>
              </div>
            </div>

            {/* Bypass Settings */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center mb-6">
                <NoSymbolIcon className="h-6 w-6 mr-3 text-gray-500" />
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Bypass Settings
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Bypass Roles */}
                <div>
                  <h4 className={classNames(
                    "text-lg font-semibold mb-4",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    Bypass Roles
                  </h4>
                  <p className={classNames(
                    "text-sm mb-4",
                    darkMode ? "text-gray-400" : "text-gray-600"
                  )}>
                    Roles that are exempt from auto-moderation
                  </p>
                  <div className="space-y-2">
                    {roles.map((role) => (
                      <label
                        key={role.id}
                        className={classNames(
                          "flex items-center p-3 rounded-lg border cursor-pointer transition-all",
                          isInArray('bypass_roles', role.id)
                            ? darkMode
                              ? "bg-gray-700 border-gray-600"
                              : "bg-gray-50 border-gray-300"
                            : darkMode
                              ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                              : "bg-white border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isInArray('bypass_roles', role.id)}
                          onChange={(e) => handleArraySetting('bypass_roles', role.id, e.target.checked)}
                          className="mr-3 h-4 w-4 text-blue-600 rounded"
                        />
                        <div
                          className="w-4 h-4 rounded mr-2"
                          style={{ backgroundColor: role.color }}
                        />
                        <span className={classNames(
                          "font-medium",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                          {role.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Whitelisted Channels */}
                <div>
                  <h4 className={classNames(
                    "text-lg font-semibold mb-4",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    Whitelisted Channels
                  </h4>
                  <p className={classNames(
                    "text-sm mb-4",
                    darkMode ? "text-gray-400" : "text-gray-600"
                  )}>
                    Channels where auto-moderation is disabled
                  </p>
                  <div className="space-y-2">
                    {channels.slice(0, 8).map((channel) => (
                      <label
                        key={channel.id}
                        className={classNames(
                          "flex items-center p-3 rounded-lg border cursor-pointer transition-all",
                          isInArray('whitelist_channels', channel.id)
                            ? darkMode
                              ? "bg-gray-700 border-gray-600"
                              : "bg-gray-50 border-gray-300"
                            : darkMode
                              ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                              : "bg-white border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isInArray('whitelist_channels', channel.id)}
                          onChange={(e) => handleArraySetting('whitelist_channels', channel.id, e.target.checked)}
                          className="mr-3 h-4 w-4 text-blue-600 rounded"
                        />
                        <span className={classNames(
                          "font-medium",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                          #{channel.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
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
                ? "bg-red-500 text-white hover:bg-red-600"
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

const ModerationSettings: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['admin', 'system_admin', 'manage_servers']}
      fallbackMessage="You need administrator privileges to access moderation settings."
    >
      <ModerationSettingsContent />
    </PermissionGuard>
  );
};

export default ModerationSettings;