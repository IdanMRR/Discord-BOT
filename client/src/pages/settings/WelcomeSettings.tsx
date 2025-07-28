import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import PermissionGuard from '../../components/common/PermissionGuard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  HomeIcon,
  UserPlusIcon,
  UserMinusIcon,
  EnvelopeIcon,
  CameraIcon,
  EyeIcon,
  QuestionMarkCircleIcon,
  CheckBadgeIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface WelcomeLeaveSettings {
  guild_id: string;
  welcome_enabled?: boolean;
  welcome_channel_id?: string;
  welcome_message?: string;
  welcome_embed_enabled?: boolean;
  welcome_embed_config?: string;
  welcome_dm_enabled?: boolean;
  welcome_dm_message?: string;
  welcome_role_id?: string;
  welcome_delay?: number;
  leave_enabled?: boolean;
  leave_channel_id?: string;
  leave_message?: string;
  leave_embed_enabled?: boolean;
  leave_embed_config?: string;
  welcome_card_enabled?: boolean;
  welcome_card_background?: string;
  welcome_preview_channel_id?: string;
  welcome_variables?: string;
  screening_enabled?: boolean;
  screening_questions?: string;
  screening_role_id?: string;
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

const WelcomeSettingsContent: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [settings, setSettings] = useState<WelcomeLeaveSettings | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<WelcomeLeaveSettings | null>(null);
  // const [previewMode, setPreviewMode] = useState<'welcome' | 'leave' | null>(null);

  // Default settings helper
  const getDefaultSettings = useCallback((): WelcomeLeaveSettings => ({
    guild_id: serverId!,
    welcome_enabled: true,
    welcome_channel_id: '',
    welcome_message: 'Welcome to {server}, {user}! 🎉\n\nWe\'re excited to have you here! Please take a moment to read our rules and introduce yourself.',
    welcome_embed_enabled: true,
    welcome_embed_config: JSON.stringify({
      title: 'Welcome to {server}!',
      description: 'Hey {user}, welcome to our awesome community! We hope you enjoy your stay.',
      color: '#5865F2',
      thumbnail: true,
      footer: 'Member #{server.members}',
      timestamp: true
    }),
    welcome_dm_enabled: false,
    welcome_dm_message: 'Welcome to {server}! Thanks for joining our community.',
    welcome_role_id: '',
    welcome_delay: 0,
    leave_enabled: true,
    leave_channel_id: '',
    leave_message: '{user.name} has left {server}. We\'ll miss you! 👋',
    leave_embed_enabled: false,
    leave_embed_config: JSON.stringify({
      title: 'Goodbye!',
      description: '{user.name} has left the server.',
      color: '#ED4245',
      thumbnail: false,
      footer: 'Member count: {server.members}',
      timestamp: true
    }),
    welcome_card_enabled: false,
    welcome_card_background: 'discord_blue',
    welcome_preview_channel_id: '',
    welcome_variables: JSON.stringify({}),
    screening_enabled: false,
    screening_questions: JSON.stringify([]),
    screening_role_id: ''
  }), [serverId]);

  // Available variables for messages
  const availableVariables = [
    { name: '{user}', description: 'Mentions the new user (@username)' },
    { name: '{user.name}', description: 'User\'s display name' },
    { name: '{user.id}', description: 'User\'s Discord ID' },
    { name: '{server}', description: 'Server name' },
    { name: '{server.members}', description: 'Total member count' },
    { name: '{server.id}', description: 'Server ID' },
    { name: '{date}', description: 'Current date' },
    { name: '{time}', description: 'Current time' }
  ];

  // Welcome card backgrounds
  const cardBackgrounds = [
    { name: 'Discord Blue', value: 'discord_blue', preview: '#5865F2' },
    { name: 'Gradient Purple', value: 'gradient_purple', preview: 'linear-gradient(45deg, #667eea, #764ba2)' },
    { name: 'Gradient Blue', value: 'gradient_blue', preview: 'linear-gradient(45deg, #4facfe, #00f2fe)' },
    { name: 'Gradient Green', value: 'gradient_green', preview: 'linear-gradient(45deg, #43e97b, #38f9d7)' },
    { name: 'Dark', value: 'dark', preview: '#2C2F33' },
    { name: 'Light', value: 'light', preview: '#F8F9FA' },
    { name: 'Custom URL', value: 'custom', preview: '#99AAB5' }
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
          fetch(`/api/settings/${serverId}/welcome-leave`)
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
          { id: '1', name: 'Member', color: '#99AAB5' },
          { id: '2', name: 'Verified', color: '#57F287' },
          { id: '3', name: 'VIP', color: '#FEE75C' },
          { id: '4', name: 'Contributor', color: '#EB459E' }
        ]);

        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          if (settingsData.success && settingsData.data) {
            const loadedSettings = settingsData.data;
            setSettings(loadedSettings);
            setOriginalSettings(JSON.parse(JSON.stringify(loadedSettings)));
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

  const updateSetting = (key: keyof WelcomeLeaveSettings, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [key]: value
    });
  };

  const updateEmbedConfig = (type: 'welcome' | 'leave', field: string, value: any) => {
    if (!settings) return;
    
    const configKey = type === 'welcome' ? 'welcome_embed_config' : 'leave_embed_config';
    const currentConfig = settings[configKey];
    
    try {
      const config = currentConfig ? JSON.parse(currentConfig) : {};
      config[field] = value;
      updateSetting(configKey, JSON.stringify(config));
    } catch (error) {
      console.error('Error updating embed config:', error);
    }
  };

  const getEmbedConfig = (type: 'welcome' | 'leave'): any => {
    if (!settings) return {};
    
    const configKey = type === 'welcome' ? 'welcome_embed_config' : 'leave_embed_config';
    const currentConfig = settings[configKey];
    
    try {
      return currentConfig ? JSON.parse(currentConfig) : {};
    } catch {
      return {};
    }
  };

  const handleSave = async () => {
    if (!settings || !serverId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/settings/${serverId}/welcome-leave`, {
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
        toast.success('Welcome & Leave settings saved successfully!');
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

  const sendTestMessage = async (type: 'welcome' | 'leave') => {
    if (!settings || !serverId) return;
    
    const channelId = type === 'welcome' ? settings.welcome_channel_id : settings.leave_channel_id;
    
    if (!channelId) {
      toast.error(`Please select a ${type} channel first`);
      return;
    }

    try {
      // This would send a test message to the selected channel
      toast.success(`Test ${type} message sent!`);
    } catch (error) {
      toast.error(`Failed to send test ${type} message`);
    }
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
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
        checked ? "bg-green-600" : (darkMode ? "bg-gray-600" : "bg-gray-300"),
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
          <HomeIcon className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Settings</h3>
          <p>Unable to load welcome & leave settings. Please try refreshing the page.</p>
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
            darkMode ? "bg-green-900/20" : "bg-green-100"
          )}>
            <HomeIcon className={classNames(
              "h-8 w-8",
              darkMode ? "text-green-400" : "text-green-600"
            )} />
          </div>
          
          <div>
            <h1 className={classNames(
              "text-4xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Welcome & Leave Settings
            </h1>
            {serverInfo && (
              <p className={classNames(
                "text-lg font-medium mt-2",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                {serverInfo.name} • Member Greetings & Farewells
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Available Variables */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center mb-4">
            <QuestionMarkCircleIcon className="h-6 w-6 mr-3 text-blue-500" />
            <h3 className={classNames(
              "text-xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Available Variables
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {availableVariables.map((variable) => (
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
                  darkMode ? "text-blue-300" : "text-blue-600"
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

        {/* Welcome Settings */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <UserPlusIcon className="h-6 w-6 mr-3 text-green-500" />
              <div>
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Welcome Messages
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Greet new members when they join your server
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.welcome_enabled || false}
              onChange={(checked) => updateSetting('welcome_enabled', checked)}
            />
          </div>

          {settings.welcome_enabled && (
            <div className="space-y-6">
              {/* Basic Welcome Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Welcome Channel
                  </label>
                  <select
                    value={settings.welcome_channel_id || ''}
                    onChange={(e) => updateSetting('welcome_channel_id', e.target.value)}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                      "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    )}
                  >
                    <option value="">Select a channel</option>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        #{channel.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Auto-Assign Role
                  </label>
                  <select
                    value={settings.welcome_role_id || ''}
                    onChange={(e) => updateSetting('welcome_role_id', e.target.value)}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                      "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    )}
                  >
                    <option value="">No auto-role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Welcome Message */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Welcome Message
                </label>
                <textarea
                  value={settings.welcome_message || ''}
                  onChange={(e) => updateSetting('welcome_message', e.target.value)}
                  placeholder="Welcome to {server}, {user}! 🎉"
                  rows={4}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500",
                    "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  )}
                />
              </div>

              {/* Embed Settings */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className={classNames(
                    "text-sm font-medium",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Use Rich Embed
                  </label>
                  <ToggleSwitch
                    checked={settings.welcome_embed_enabled || false}
                    onChange={(checked) => updateSetting('welcome_embed_enabled', checked)}
                  />
                </div>

                {settings.welcome_embed_enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium mb-1">Embed Title</label>
                      <input
                        type="text"
                        value={getEmbedConfig('welcome').title || ''}
                        onChange={(e) => updateEmbedConfig('welcome', 'title', e.target.value)}
                        placeholder="Welcome to {server}!"
                        className={classNames(
                          "w-full px-3 py-2 rounded border text-sm",
                          darkMode ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Embed Color</label>
                      <input
                        type="color"
                        value={getEmbedConfig('welcome').color || '#57F287'}
                        onChange={(e) => updateEmbedConfig('welcome', 'color', e.target.value)}
                        className="w-full h-10 rounded border"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Embed Description</label>
                      <textarea
                        value={getEmbedConfig('welcome').description || ''}
                        onChange={(e) => updateEmbedConfig('welcome', 'description', e.target.value)}
                        placeholder="We're excited to have you here, {user}!"
                        rows={3}
                        className={classNames(
                          "w-full px-3 py-2 rounded border text-sm",
                          darkMode ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* DM Settings */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <EnvelopeIcon className="h-5 w-5 mr-2 text-blue-500" />
                    <label className={classNames(
                      "text-sm font-medium",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Send Welcome DM
                    </label>
                  </div>
                  <ToggleSwitch
                    checked={settings.welcome_dm_enabled || false}
                    onChange={(checked) => updateSetting('welcome_dm_enabled', checked)}
                  />
                </div>

                {settings.welcome_dm_enabled && (
                  <textarea
                    value={settings.welcome_dm_message || ''}
                    onChange={(e) => updateSetting('welcome_dm_message', e.target.value)}
                    placeholder="Welcome to {server}! Thanks for joining our community."
                    rows={3}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                    )}
                  />
                )}
              </div>

              {/* Welcome Cards */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <CameraIcon className="h-5 w-5 mr-2 text-purple-500" />
                    <label className={classNames(
                      "text-sm font-medium",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Welcome Cards
                    </label>
                  </div>
                  <ToggleSwitch
                    checked={settings.welcome_card_enabled || false}
                    onChange={(checked) => updateSetting('welcome_card_enabled', checked)}
                  />
                </div>

                {settings.welcome_card_enabled && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {cardBackgrounds.map((bg) => (
                      <div
                        key={bg.value}
                        className={classNames(
                          "relative cursor-pointer rounded-lg border-2 p-3 transition-all",
                          settings.welcome_card_background === bg.value
                            ? "border-purple-500 scale-105"
                            : "border-gray-300 dark:border-gray-600 hover:border-gray-400"
                        )}
                        onClick={() => updateSetting('welcome_card_background', bg.value)}
                      >
                        <div
                          className="w-full h-12 rounded mb-2"
                          style={{ background: bg.preview }}
                        />
                        <p className="text-xs text-center font-medium">{bg.name}</p>
                        {settings.welcome_card_background === bg.value && (
                          <CheckIcon className="absolute top-1 right-1 h-4 w-4 text-purple-500" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Test Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => sendTestMessage('welcome')}
                  disabled={!settings.welcome_channel_id}
                  className={classNames(
                    "px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2",
                    settings.welcome_channel_id
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  )}
                >
                  <EyeIcon className="h-4 w-4" />
                  <span>Send Test Message</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Leave Settings */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <UserMinusIcon className="h-6 w-6 mr-3 text-red-500" />
              <div>
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Leave Messages
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Say goodbye when members leave your server
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.leave_enabled || false}
              onChange={(checked) => updateSetting('leave_enabled', checked)}
            />
          </div>

          {settings.leave_enabled && (
            <div className="space-y-6">
              {/* Leave Channel */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Leave Channel
                </label>
                <select
                  value={settings.leave_channel_id || ''}
                  onChange={(e) => updateSetting('leave_channel_id', e.target.value)}
                  className={classNames(
                    "w-full max-w-md px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-red-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-red-500",
                    "focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  )}
                >
                  <option value="">Select a channel</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Leave Message */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Leave Message
                </label>
                <textarea
                  value={settings.leave_message || ''}
                  onChange={(e) => updateSetting('leave_message', e.target.value)}
                  placeholder="{user.name} has left the server. We'll miss them! 👋"
                  rows={3}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500",
                    "focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  )}
                />
              </div>

              {/* Leave Embed Settings */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className={classNames(
                    "text-sm font-medium",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Use Rich Embed
                  </label>
                  <ToggleSwitch
                    checked={settings.leave_embed_enabled || false}
                    onChange={(checked) => updateSetting('leave_embed_enabled', checked)}
                  />
                </div>

                {settings.leave_embed_enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium mb-1">Embed Title</label>
                      <input
                        type="text"
                        value={getEmbedConfig('leave').title || ''}
                        onChange={(e) => updateEmbedConfig('leave', 'title', e.target.value)}
                        placeholder="Member Left"
                        className={classNames(
                          "w-full px-3 py-2 rounded border text-sm",
                          darkMode ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Embed Color</label>
                      <input
                        type="color"
                        value={getEmbedConfig('leave').color || '#ED4245'}
                        onChange={(e) => updateEmbedConfig('leave', 'color', e.target.value)}
                        className="w-full h-10 rounded border"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Embed Description</label>
                      <textarea
                        value={getEmbedConfig('leave').description || ''}
                        onChange={(e) => updateEmbedConfig('leave', 'description', e.target.value)}
                        placeholder="{user.name} has left {server}"
                        rows={3}
                        className={classNames(
                          "w-full px-3 py-2 rounded border text-sm",
                          darkMode ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Test Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => sendTestMessage('leave')}
                  disabled={!settings.leave_channel_id}
                  className={classNames(
                    "px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2",
                    settings.leave_channel_id
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  )}
                >
                  <EyeIcon className="h-4 w-4" />
                  <span>Send Test Message</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Member Screening */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <CheckBadgeIcon className="h-6 w-6 mr-3 text-blue-500" />
              <div>
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Member Screening
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Require new members to answer questions before gaining access
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.screening_enabled || false}
              onChange={(checked) => updateSetting('screening_enabled', checked)}
            />
          </div>

          {settings.screening_enabled && (
            <div className="space-y-4">
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Verified Role
                </label>
                <select
                  value={settings.screening_role_id || ''}
                  onChange={(e) => updateSetting('screening_role_id', e.target.value)}
                  className={classNames(
                    "w-full max-w-md px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  )}
                >
                  <option value="">Select a role to assign after screening</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Screening Questions
                </label>
                <textarea
                  placeholder="Enter screening questions, one per line&#10;Example:&#10;Do you agree to follow the server rules?&#10;How did you find our server?&#10;What are you most interested in?"
                  rows={5}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  )}
                />
              </div>
            </div>
          )}
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
                ? "bg-green-500 text-white hover:bg-green-600"
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

const WelcomeSettings: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['admin', 'system_admin', 'manage_servers']}
      fallbackMessage="You need administrator privileges to access welcome settings."
    >
      <WelcomeSettingsContent />
    </PermissionGuard>
  );
};

export default WelcomeSettings;