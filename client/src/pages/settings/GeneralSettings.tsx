import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import PermissionGuard from '../../components/common/PermissionGuard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  CogIcon,
  SwatchIcon,
  GlobeAltIcon,
  CommandLineIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}


interface AdvancedServerSettings {
  guild_id: string;
  bot_prefix?: string;
  bot_nickname?: string;
  custom_status?: string;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  primary_color?: string;
  secondary_color?: string;
  embed_color?: string;
  bot_avatar_url?: string;
  custom_emojis?: string;
  modules_enabled?: string;
  features_enabled?: string;
  api_settings?: string;
  webhook_settings?: string;
  integration_settings?: string;
}

interface ServerInfo {
  id: string;
  name: string;
  memberCount: number;
  icon?: string;
}

const GeneralSettingsContent: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [settings, setSettings] = useState<AdvancedServerSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<AdvancedServerSettings | null>(null);

  // Color presets
  const colorPresets = [
    { name: 'Discord Blue', value: '#5865F2' },
    { name: 'Green', value: '#57F287' },
    { name: 'Yellow', value: '#FEE75C' },
    { name: 'Fuchsia', value: '#EB459E' },
    { name: 'Red', value: '#ED4245' },
    { name: 'White', value: '#FFFFFF' },
    { name: 'Blurple', value: '#7289DA' },
    { name: 'Greyple', value: '#99AAB5' },
    { name: 'Dark', value: '#2C2F33' },
    { name: 'Orange', value: '#FF7849' },
    { name: 'Purple', value: '#9C84EF' },
    { name: 'Teal', value: '#1ABC9C' }
  ];

  // Timezone options
  const timezones = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai',
    'Australia/Sydney', 'America/Toronto'
  ];

  // Date format options
  const dateFormats = [
    { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
    { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
    { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
    { label: 'Month DD, YYYY', value: 'MMMM DD, YYYY' }
  ];

  // Time format options
  const timeFormats = [
    { label: '12 Hour (AM/PM)', value: '12' },
    { label: '24 Hour', value: '24' }
  ];

  // Default settings helper
  const getDefaultSettings = useCallback((serverId: string): AdvancedServerSettings => ({
    guild_id: serverId,
    bot_prefix: '!',
    bot_nickname: '',
    custom_status: '',
    timezone: 'UTC',
    date_format: 'MM/DD/YYYY',
    time_format: '12',
    primary_color: '#5865F2',
    secondary_color: '#57F287',
    embed_color: '#5865F2',
    bot_avatar_url: '',
    custom_emojis: '[]',
    modules_enabled: '["moderation", "tickets", "utilities"]',
    features_enabled: '[]',
    api_settings: '{}',
    webhook_settings: '{}',
    integration_settings: '{}'
  }), []);

  // Available modules
  const availableModules = [
    { id: 'moderation', name: 'Moderation', description: 'Auto-moderation and punishment system' },
    { id: 'economy', name: 'Economy', description: 'Virtual currency and shop system' },
    { id: 'leveling', name: 'Leveling', description: 'XP and level progression system' },
    { id: 'tickets', name: 'Tickets', description: 'Support ticket system' },
    { id: 'giveaways', name: 'Giveaways', description: 'Contest and giveaway management' },
    { id: 'music', name: 'Music', description: 'Music playback functionality' },
    { id: 'games', name: 'Games', description: 'Fun games and activities' },
    { id: 'utilities', name: 'Utilities', description: 'Useful utility commands' }
  ];

  // Load data
  useEffect(() => {
    if (!serverId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Load server info and settings in parallel
        const [serverResponse, settingsResponse] = await Promise.all([
          apiService.getServerInfo(serverId),
          fetch(`/api/settings/${serverId}/advanced-server`)
        ]);

        if (serverResponse.success && serverResponse.data) {
          setServerInfo(serverResponse.data);
        }

        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          if (settingsData.success) {
            const loadedSettings = settingsData.data || getDefaultSettings(serverId!);
            setSettings(loadedSettings);
            setOriginalSettings(JSON.parse(JSON.stringify(loadedSettings)));
          } else {
            const defaultSettings = getDefaultSettings(serverId!);
            setSettings(defaultSettings);
            setOriginalSettings(JSON.parse(JSON.stringify(defaultSettings)));
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load settings');
        const defaultSettings = getDefaultSettings(serverId!);
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

  const updateSetting = (key: keyof AdvancedServerSettings, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [key]: value
    });
  };

  const handleModuleToggle = (moduleId: string) => {
    if (!settings) return;
    
    try {
      const enabledModules = JSON.parse(settings.modules_enabled || '[]');
      const isEnabled = enabledModules.includes(moduleId);
      
      const updatedModules = isEnabled
        ? enabledModules.filter((id: string) => id !== moduleId)
        : [...enabledModules, moduleId];
      
      updateSetting('modules_enabled', JSON.stringify(updatedModules));
    } catch (error) {
      console.error('Error toggling module:', error);
    }
  };

  const isModuleEnabled = (moduleId: string): boolean => {
    if (!settings?.modules_enabled) return false;
    
    try {
      const enabledModules = JSON.parse(settings.modules_enabled);
      return enabledModules.includes(moduleId);
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    if (!settings || !serverId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/settings/${serverId}/advanced-server`, {
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
        toast.success('Settings saved successfully!');
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
    toast.success('Settings reset to last saved state');
  };

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
          <CogIcon className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Settings</h3>
          <p>Unable to load general settings. Please try refreshing the page.</p>
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
            darkMode ? "bg-blue-900/20" : "bg-blue-100"
          )}>
            <CogIcon className={classNames(
              "h-8 w-8",
              darkMode ? "text-blue-400" : "text-blue-600"
            )} />
          </div>
          
          <div>
            <h1 className={classNames(
              "text-4xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              General Settings
            </h1>
            {serverInfo && (
              <p className={classNames(
                "text-lg font-medium mt-2",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                {serverInfo.name} • Basic Configuration
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Bot Configuration */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center mb-6">
            <CommandLineIcon className="h-6 w-6 mr-3 text-blue-500" />
            <h2 className={classNames(
              "text-2xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Bot Configuration
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bot Prefix */}
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Command Prefix
              </label>
              <input
                type="text"
                value={settings.bot_prefix || ''}
                onChange={(e) => updateSetting('bot_prefix', e.target.value)}
                placeholder="!"
                maxLength={5}
                className={classNames(
                  "w-full px-3 py-2 rounded-lg border transition-colors",
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-white focus:border-blue-500" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-blue-500",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                )}
              />
              <p className={classNames(
                "text-xs mt-1",
                darkMode ? "text-gray-400" : "text-gray-500"
              )}>
                The prefix used to trigger bot commands (e.g., !help)
              </p>
            </div>

            {/* Bot Nickname */}
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Bot Nickname
              </label>
              <input
                type="text"
                value={settings.bot_nickname || ''}
                onChange={(e) => updateSetting('bot_nickname', e.target.value)}
                placeholder="Leave empty for default"
                maxLength={32}
                className={classNames(
                  "w-full px-3 py-2 rounded-lg border transition-colors",
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-white focus:border-blue-500" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-blue-500",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                )}
              />
              <p className={classNames(
                "text-xs mt-1",
                darkMode ? "text-gray-400" : "text-gray-500"
              )}>
                Custom nickname for the bot in this server
              </p>
            </div>

            {/* Custom Status */}
            <div className="md:col-span-2">
              <label className={classNames(
                "block text-sm font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Custom Status
              </label>
              <input
                type="text"
                value={settings.custom_status || ''}
                onChange={(e) => updateSetting('custom_status', e.target.value)}
                placeholder="Playing with awesome servers!"
                maxLength={128}
                className={classNames(
                  "w-full px-3 py-2 rounded-lg border transition-colors",
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-white focus:border-blue-500" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-blue-500",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                )}
              />
              <p className={classNames(
                "text-xs mt-1",
                darkMode ? "text-gray-400" : "text-gray-500"
              )}>
                Custom activity status shown in the bot's profile
              </p>
            </div>
          </div>
        </div>

        {/* Localization Settings */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center mb-6">
            <GlobeAltIcon className="h-6 w-6 mr-3 text-green-500" />
            <h2 className={classNames(
              "text-2xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Localization
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Timezone */}
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Timezone
              </label>
              <select
                value={settings.timezone || 'UTC'}
                onChange={(e) => updateSetting('timezone', e.target.value)}
                className={classNames(
                  "w-full px-3 py-2 rounded-lg border transition-colors",
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                  "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                )}
              >
                {timezones.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {/* Date Format */}
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Date Format
              </label>
              <select
                value={settings.date_format || 'MM/DD/YYYY'}
                onChange={(e) => updateSetting('date_format', e.target.value)}
                className={classNames(
                  "w-full px-3 py-2 rounded-lg border transition-colors",
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                  "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                )}
              >
                {dateFormats.map(format => (
                  <option key={format.value} value={format.value}>{format.label}</option>
                ))}
              </select>
            </div>

            {/* Time Format */}
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Time Format
              </label>
              <select
                value={settings.time_format || '12'}
                onChange={(e) => updateSetting('time_format', e.target.value)}
                className={classNames(
                  "w-full px-3 py-2 rounded-lg border transition-colors",
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                  "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                )}
              >
                {timeFormats.map(format => (
                  <option key={format.value} value={format.value}>{format.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Appearance Settings */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center mb-6">
            <SwatchIcon className="h-6 w-6 mr-3 text-purple-500" />
            <h2 className={classNames(
              "text-2xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Appearance
            </h2>
          </div>

          <div className="space-y-6">
            {/* Primary Color */}
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-3",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Primary Color
              </label>
              <div className="grid grid-cols-6 gap-3 mb-3">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => updateSetting('primary_color', preset.value)}
                    className={classNames(
                      "relative h-12 rounded-lg border-2 transition-all",
                      settings.primary_color === preset.value
                        ? "border-gray-900 dark:border-white scale-110"
                        : "border-gray-300 dark:border-gray-600 hover:scale-105"
                    )}
                    style={{ backgroundColor: preset.value }}
                    title={preset.name}
                  >
                    {settings.primary_color === preset.value && (
                      <CheckIcon className="absolute inset-0 m-auto w-6 h-6 text-white drop-shadow-lg" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center space-x-4">
                <input
                  type="color"
                  value={settings.primary_color || '#5865F2'}
                  onChange={(e) => updateSetting('primary_color', e.target.value)}
                  className="h-10 w-20 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.primary_color || ''}
                  onChange={(e) => updateSetting('primary_color', e.target.value)}
                  placeholder="#5865F2"
                  className={classNames(
                    "px-3 py-2 rounded-lg border",
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  )}
                />
              </div>
            </div>

            {/* Secondary and Embed Colors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Secondary Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={settings.secondary_color || '#57F287'}
                    onChange={(e) => updateSetting('secondary_color', e.target.value)}
                    className="h-10 w-16 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.secondary_color || ''}
                    onChange={(e) => updateSetting('secondary_color', e.target.value)}
                    placeholder="#57F287"
                    className={classNames(
                      "flex-1 px-3 py-2 rounded-lg border",
                      darkMode
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>
              </div>

              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Embed Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={settings.embed_color || '#5865F2'}
                    onChange={(e) => updateSetting('embed_color', e.target.value)}
                    className="h-10 w-16 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.embed_color || ''}
                    onChange={(e) => updateSetting('embed_color', e.target.value)}
                    placeholder="#5865F2"
                    className={classNames(
                      "flex-1 px-3 py-2 rounded-lg border",
                      darkMode
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enabled Modules */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center mb-6">
            <EyeIcon className="h-6 w-6 mr-3 text-indigo-500" />
            <h2 className={classNames(
              "text-2xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Enabled Modules
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {availableModules.map((module) => {
              const isEnabled = isModuleEnabled(module.id);
              
              return (
                <div
                  key={module.id}
                  className={classNames(
                    "relative p-4 rounded-lg border-2 cursor-pointer transition-all",
                    isEnabled
                      ? darkMode
                        ? "bg-indigo-900/20 border-indigo-500"
                        : "bg-indigo-50 border-indigo-500"
                      : darkMode
                        ? "bg-gray-700 border-gray-600 hover:border-gray-500"
                        : "bg-gray-50 border-gray-300 hover:border-gray-400"
                  )}
                  onClick={() => handleModuleToggle(module.id)}
                >
                  {/* Toggle indicator */}
                  <div className="absolute top-3 right-3">
                    {isEnabled ? (
                      <CheckIcon className="h-5 w-5 text-indigo-500" />
                    ) : (
                      <XMarkIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  <h3 className={classNames(
                    "font-semibold mb-1",
                    isEnabled
                      ? darkMode ? "text-indigo-300" : "text-indigo-700"
                      : darkMode ? "text-gray-200" : "text-gray-700"
                  )}>
                    {module.name}
                  </h3>
                  
                  <p className={classNames(
                    "text-sm",
                    isEnabled
                      ? darkMode ? "text-indigo-200" : "text-indigo-600"
                      : darkMode ? "text-gray-400" : "text-gray-600"
                  )}>
                    {module.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

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
                ? "bg-blue-500 text-white hover:bg-blue-600"
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

const GeneralSettings: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['admin', 'system_admin', 'manage_servers']}
      fallbackMessage="You need administrator privileges to access general settings."
    >
      <GeneralSettingsContent />
    </PermissionGuard>
  );
};

export default GeneralSettings;