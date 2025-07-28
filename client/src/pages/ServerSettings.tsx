import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import PermissionGuard from '../components/common/PermissionGuard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { apiService } from '../services/api';
import {
  CogIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface LoggingSettings {
  id?: number;
  guild_id: string;
  message_delete_logging: boolean;
  message_edit_logging: boolean;
  command_logging: boolean;
  dm_logging: boolean;
  log_channel_id?: string;
  message_log_channel_id?: string;
  command_log_channel_id?: string;
  dm_log_channel_id?: string;
}

interface Channel {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId?: string;
  parent?: string;
}

interface ServerInfo {
  id: string;
  name: string;
  memberCount: number;
  icon?: string;
}

const ServerSettingsContent: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [loggingSettings, setLoggingSettings] = useState<LoggingSettings | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);

  // Load server data
  useEffect(() => {
    if (!serverId) return;

    const loadServerData = async () => {
      try {
        setLoading(true);

        // Load server info, logging settings, and channels in parallel
        const [serverResponse, channelsResponse] = await Promise.all([
          apiService.getServerInfo(serverId),
          apiService.getServerChannels(serverId)
        ]);

        if (serverResponse.success && serverResponse.data) {
          setServerInfo(serverResponse.data);
        } else {
          toast.error('Failed to load server information');
        }

        if (channelsResponse.success && channelsResponse.data) {
          // Filter for text channels only
          const textChannels = channelsResponse.data.filter((channel: Channel) => channel.type === 0);
          setChannels(textChannels);
        } else {
          toast.error('Failed to load server channels');
        }

        // Load logging settings (with default fallback)
        try {
          const loggingResponse = await apiService.getLoggingSettings(serverId);
          if (loggingResponse.success && loggingResponse.data) {
            setLoggingSettings(loggingResponse.data);
          } else {
            // Set default settings
            setLoggingSettings({
              guild_id: serverId,
              message_delete_logging: true,
              message_edit_logging: true,
              command_logging: true,
              dm_logging: false
            });
          }
        } catch (error) {
          // Set default settings on error
          setLoggingSettings({
            guild_id: serverId,
            message_delete_logging: true,
            message_edit_logging: true,
            command_logging: true,
            dm_logging: false
          });
        }

      } catch (error) {
        console.error('Error loading server data:', error);
        toast.error('Failed to load server data');
      } finally {
        setLoading(false);
      }
    };

    loadServerData();
  }, [serverId]);

  const handleSettingToggle = async (setting: keyof LoggingSettings, value: boolean) => {
    if (!loggingSettings || !serverId) return;

    setSaving(true);
    try {
      const updatedSettings = {
        ...loggingSettings,
        [setting]: value
      };

      const response = await apiService.updateLoggingSettings(serverId, updatedSettings);
      
      if (response.success) {
        setLoggingSettings(updatedSettings);
        toast.success(`${getSettingDisplayName(setting)} ${value ? 'enabled' : 'disabled'}`);
      } else {
        toast.error('Failed to update setting');
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const handleChannelChange = async (setting: keyof LoggingSettings, channelId: string) => {
    if (!loggingSettings || !serverId) return;

    setSaving(true);
    try {
      const updatedSettings = {
        ...loggingSettings,
        [setting]: channelId || undefined
      };

      const response = await apiService.updateLoggingSettings(serverId, updatedSettings);
      
      if (response.success) {
        setLoggingSettings(updatedSettings);
        const channelName = channels.find(c => c.id === channelId)?.name || 'None';
        toast.success(`${getSettingDisplayName(setting)} set to #${channelName}`);
      } else {
        toast.error('Failed to update channel setting');
      }
    } catch (error) {
      console.error('Error updating channel setting:', error);
      toast.error('Failed to update channel setting');
    } finally {
      setSaving(false);
    }
  };

  const getSettingDisplayName = (setting: string): string => {
    const names: Record<string, string> = {
      'message_delete_logging': 'Message Delete Logging',
      'message_edit_logging': 'Message Edit Logging',
      'command_logging': 'Command Logging',
      'dm_logging': 'DM Logging',
      'message_log_channel_id': 'Message Log Channel',
      'command_log_channel_id': 'Command Log Channel',
      'dm_log_channel_id': 'DM Log Channel'
    };
    return names[setting] || setting;
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
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2",
        checked ? "bg-purple-600" : (darkMode ? "bg-gray-600" : "bg-gray-300"),
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

  const ChannelSelector: React.FC<{
    value?: string;
    onChange: (channelId: string) => void;
    disabled?: boolean;
  }> = ({ value, onChange, disabled = false }) => (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={classNames(
        "w-full px-3 py-2 rounded-lg border transition-colors",
        darkMode 
          ? "bg-gray-700 border-gray-600 text-white focus:border-purple-500" 
          : "bg-white border-gray-300 text-gray-900 focus:border-purple-500",
        "focus:outline-none focus:ring-2 focus:ring-purple-500/20",
        disabled ? "opacity-50 cursor-not-allowed" : ""
      )}
    >
      <option value="">No specific channel (use default)</option>
      {channels.map((channel) => (
        <option key={channel.id} value={channel.id}>
          #{channel.name}
        </option>
      ))}
    </select>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!loggingSettings) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className={classNames(
          "text-center p-8 rounded-lg border",
          darkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-600"
        )}>
          <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Settings</h3>
          <p>Unable to load server settings. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4">
          <div className={classNames(
            "p-3 rounded-lg",
            darkMode ? "bg-purple-900/20" : "bg-purple-100"
          )}>
            <CogIcon className={classNames(
              "h-8 w-8",
              darkMode ? "text-purple-400" : "text-purple-600"
            )} />
          </div>
          <div>
            <h1 className={classNames(
              "text-4xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Server Settings
            </h1>
            {serverInfo && (
              <p className={classNames(
                "text-lg font-medium mt-2",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                {serverInfo.name} • {serverInfo.memberCount} members
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className={classNames(
        "mb-8 p-4 rounded-lg border-l-4 border-blue-500",
        darkMode ? "bg-blue-900/20 border-blue-400" : "bg-blue-50 border-blue-500"
      )}>
        <div className="flex items-start">
          <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className={classNames(
              "text-sm font-medium",
              darkMode ? "text-blue-300" : "text-blue-800"
            )}>
              Message Logs
            </h3>
            <p className={classNames(
              "text-sm mt-1",
              darkMode ? "text-blue-200" : "text-blue-700"
            )}>
              Configure which Discord events are logged and where they are sent. These settings only affect logging for this server.
            </p>
          </div>
        </div>
      </div>

      {/* Server Info Section */}
      <div className={classNames(
        "rounded-lg border p-6 mb-8",
        darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center space-x-4">
          {/* Server Icon */}
          <div className={classNames(
            "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold",
            darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
          )}>
            {serverInfo?.icon ? (
              <img 
                src={`https://cdn.discordapp.com/icons/${serverId}/${serverInfo.icon}.png`} 
                alt={serverInfo.name} 
                className="w-16 h-16 rounded-full"
              />
            ) : (
              serverInfo?.name?.charAt(0).toUpperCase() || 'S'
            )}
          </div>
          
          {/* Server Details */}
          <div>
            <h1 className={classNames(
              "text-2xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              {serverInfo?.name || 'Server Name'}
            </h1>
            <p className={classNames(
              "text-sm",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              ID: {serverId}
            </p>
            <p className={classNames(
              "text-sm flex items-center",
              darkMode ? "text-blue-400" : "text-blue-600"
            )}>
              👥 {serverInfo?.memberCount || 0} members
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className={classNames(
        "rounded-lg border p-6 mb-8",
        darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <h2 className={classNames(
          "text-xl font-bold mb-6 flex items-center",
          darkMode ? "text-white" : "text-gray-900"
        )}>
          ⚡ Quick Actions
        </h2>
        
        <div className="space-y-4">
          {/* View Tickets */}
          <button
            onClick={() => navigate(`/servers/${serverId}/tickets`)}
            className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] font-medium text-lg"
          >
            <span className="text-xl">🎫</span>
            <span>View Tickets</span>
          </button>

          {/* View Warnings */}
          <button
            onClick={() => navigate(`/warnings?serverId=${serverId}`)}
            className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] font-medium text-lg"
          >
            <span className="text-xl">⚠️</span>
            <span>View Warnings</span>
          </button>

          {/* Manage Members */}
          <button
            onClick={() => navigate(`/servers/${serverId}/members`)}
            className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] font-medium text-lg"
          >
            <span className="text-xl">👥</span>
            <span>Manage Members</span>
          </button>

          {/* Activity Logs */}
          <button
            onClick={() => navigate(`/servers/${serverId}/logs`)}
            className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] font-medium text-lg"
          >
            <span className="text-xl">📊</span>
            <span>Activity Logs</span>
          </button>

          {/* Server Configuration */}
          <button
            onClick={() => navigate(`/servers/${serverId}`)}
            className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all duration-200 transform hover:scale-[1.02] font-medium text-lg"
          >
            <CogIcon className="h-6 w-6" />
            <span>Server Configuration</span>
          </button>
        </div>
      </div>

      {/* Logging Settings */}
      <div className={classNames(
        "rounded-lg border",
        darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <div className="p-6">
          <h2 className={classNames(
            "text-2xl font-bold mb-6",
            darkMode ? "text-white" : "text-gray-900"
          )}>
            Logging Preferences
          </h2>

          <div className="space-y-8">
            {/* Message Delete Logging */}
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-6">
                <h3 className={classNames(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  🗑️ Message Deletion Logging
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Log when messages are deleted, including content and attachments
                </p>
                <div className="mt-3">
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Log Channel
                  </label>
                  <ChannelSelector
                    value={loggingSettings.message_log_channel_id}
                    onChange={(channelId) => handleChannelChange('message_log_channel_id', channelId)}
                    disabled={saving || !loggingSettings.message_delete_logging}
                  />
                </div>
              </div>
              <ToggleSwitch
                checked={loggingSettings.message_delete_logging}
                onChange={(checked) => handleSettingToggle('message_delete_logging', checked)}
                disabled={saving}
              />
            </div>

            <hr className={darkMode ? "border-gray-700" : "border-gray-200"} />

            {/* Message Edit Logging */}
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-6">
                <h3 className={classNames(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  ✏️ Message Edit Logging
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Log when messages are edited, showing before and after content
                </p>
                <div className="mt-3">
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Log Channel (shares with delete logs if not set)
                  </label>
                  <ChannelSelector
                    value={loggingSettings.message_log_channel_id}
                    onChange={(channelId) => handleChannelChange('message_log_channel_id', channelId)}
                    disabled={saving || !loggingSettings.message_edit_logging}
                  />
                </div>
              </div>
              <ToggleSwitch
                checked={loggingSettings.message_edit_logging}
                onChange={(checked) => handleSettingToggle('message_edit_logging', checked)}
                disabled={saving}
              />
            </div>

            <hr className={darkMode ? "border-gray-700" : "border-gray-200"} />

            {/* Command Logging */}
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-6">
                <h3 className={classNames(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  ⚡ Command Logging
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Log when bot commands are used, including success/failure status
                </p>
                <div className="mt-3">
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Log Channel
                  </label>
                  <ChannelSelector
                    value={loggingSettings.command_log_channel_id}
                    onChange={(channelId) => handleChannelChange('command_log_channel_id', channelId)}
                    disabled={saving || !loggingSettings.command_logging}
                  />
                </div>
              </div>
              <ToggleSwitch
                checked={loggingSettings.command_logging}
                onChange={(checked) => handleSettingToggle('command_logging', checked)}
                disabled={saving}
              />
            </div>

            <hr className={darkMode ? "border-gray-700" : "border-gray-200"} />

            {/* DM Logging */}
            <div className="flex items-start justify-between">
              <div className="flex-1 mr-6">
                <h3 className={classNames(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  💬 Direct Message Logging
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Log DMs sent to the bot from server members (privacy sensitive)
                </p>
                <div className="mt-3">
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Log Channel
                  </label>
                  <ChannelSelector
                    value={loggingSettings.dm_log_channel_id}
                    onChange={(channelId) => handleChannelChange('dm_log_channel_id', channelId)}
                    disabled={saving || !loggingSettings.dm_logging}
                  />
                </div>
              </div>
              <ToggleSwitch
                checked={loggingSettings.dm_logging}
                onChange={(checked) => handleSettingToggle('dm_logging', checked)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Save Status */}
          {saving && (
            <div className="mt-6 flex items-center justify-center">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                <span className={classNames(
                  "text-sm",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Saving changes...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ServerSettings: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['admin', 'system_admin', 'manage_servers']}
      fallbackMessage="You need administrator privileges to access server settings."
    >
      <ServerSettingsContent />
    </PermissionGuard>
  );
};

export default ServerSettings;