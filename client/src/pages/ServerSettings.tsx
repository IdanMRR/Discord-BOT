import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { ServerSettings as ServerSettingsType } from '../types';
import { apiService } from '../services/api';
import PermissionGuard from '../components/common/PermissionGuard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SettingsCard from '../components/common/SettingsCard';
import ActionButton from '../components/common/ActionButton';
import VerificationConfigModal from '../components/modals/VerificationConfigModal';
import WelcomeMessageConfigModal from '../components/modals/WelcomeMessageConfigModal';
import GoodbyeMessageConfigModal from '../components/modals/GoodbyeMessageConfigModal';
import InviteJoinMessageConfigModal from '../components/modals/InviteJoinMessageConfigModal';
import InviteLeaveMessageConfigModal from '../components/modals/InviteLeaveMessageConfigModal';
import RolesConfigModal from '../components/modals/RolesConfigModal';
import toast from 'react-hot-toast';
import {
  UserPlusIcon,
  CheckBadgeIcon,
  TrophyIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  CogIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

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


interface Category {
  id: string;
  name: string;
  type: number;
  position: number;
}

interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
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
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [loggingSettings, setLoggingSettings] = useState<LoggingSettings | null>(null);
  const [serverSettings, setServerSettings] = useState<ServerSettingsType | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Modal states
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [goodbyeModalOpen, setGoodbyeModalOpen] = useState(false);
  const [inviteJoinModalOpen, setInviteJoinModalOpen] = useState(false);
  const [inviteLeaveModalOpen, setInviteLeaveModalOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [rolesConfigModalOpen, setRolesConfigModalOpen] = useState(false);

  // Load server data
  useEffect(() => {
    if (!serverId) return;

    const loadServerData = async () => {
      try {
        setLoading(true);

        // Load server info, settings, channels, and roles in parallel
        const [serverResponse, channelsResponse, settingsResponse, rolesResponse] = await Promise.all([
          apiService.getServerInfo(serverId),
          apiService.getServerChannels(serverId, 'all'), // Get all channel types including categories
          apiService.getServerSettings(serverId),
          apiService.getServerChannelsAndRoles(serverId)
        ]);

        if (serverResponse.success && serverResponse.data) {
          setServerInfo(serverResponse.data);
        } else {
          toast.error('Failed to load server information');
        }

        if (channelsResponse.success && channelsResponse.data) {
          // Filter for text channels and categories
          const textChannels = channelsResponse.data.filter((channel: Channel) => channel.type === 0);
          const categoryChannels = channelsResponse.data.filter((channel: Category) => channel.type === 4);
          setChannels(textChannels);
          setCategories(categoryChannels);
        } else {
          toast.error('Failed to load server channels');
        }

        if (rolesResponse.success && rolesResponse.data) {
          // Set roles from the channels and roles API response
          setRoles(rolesResponse.data.roles || []);
        } else {
          console.warn('Failed to load server roles');
        }

        if (settingsResponse.success && settingsResponse.data) {
          setServerSettings(settingsResponse.data);
        } else {
          // Create default server settings
          setServerSettings({
            guild_id: serverId,
            name: serverInfo?.name || 'Unknown Server',
            language: 'en'
          });
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
  }, [serverId, serverInfo?.name]);

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

  const handleServerChannelChange = async (setting: keyof ServerSettingsType, channelId: string) => {
    if (!serverSettings || !serverId) return;

    setSaving(true);
    try {
      const updatedSettings = {
        ...serverSettings,
        [setting]: channelId || undefined
      };

      const response = await apiService.updateServerSettings(serverId, updatedSettings);
      
      if (response.success) {
        setServerSettings(updatedSettings);
        const channelName = channels.find(c => c.id === channelId)?.name || 'None';
        toast.success(`${getServerSettingDisplayName(setting)} set to #${channelName}`);
      } else {
        toast.error('Failed to update server setting');
      }
    } catch (error) {
      console.error('Error updating server setting:', error);
      toast.error('Failed to update server setting');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = async (setting: keyof ServerSettingsType, categoryId: string) => {
    if (!serverSettings || !serverId) return;

    setSaving(true);
    try {
      const updatedSettings = {
        ...serverSettings,
        [setting]: categoryId || undefined
      };

      const response = await apiService.updateServerSettings(serverId, updatedSettings);
      
      if (response.success) {
        setServerSettings(updatedSettings);
        const categoryName = categories.find(c => c.id === categoryId)?.name || 'None';
        toast.success(`${getServerSettingDisplayName(setting)} set to ${categoryName}`);
      } else {
        toast.error('Failed to update server setting');
      }
    } catch (error) {
      console.error('Error updating server setting:', error);
      toast.error('Failed to update server setting');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTicketPanel = async (channelId: string) => {
    if (!serverId || !channelId) return;

    setSaving(true);
    try {
      const response = await apiService.createTicketPanel(serverId, {
        channel_id: channelId,
        panel_type: 'default'
      });

      if (response.success) {
        toast.success('Ticket panel created successfully!');
        // Update server settings with new panel info
        if (serverSettings) {
          setServerSettings({
            ...serverSettings,
            ticket_panel_channel_id: channelId,
            ticket_panel_message_id: response.data?.messageId
          });
        }
      } else {
        toast.error('Failed to create ticket panel');
      }
    } catch (error) {
      console.error('Error creating ticket panel:', error);
      toast.error('Failed to create ticket panel');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCustomTicketPanel = async (channelId: string) => {
    if (!serverId || !channelId) return;

    setSaving(true);
    try {
      // Create a custom ticket panel with enhanced styling
      const response = await apiService.createCustomTicketPanelMessage(serverId, channelId, {
        title: '🎫 Support Ticket System',
        description: '**Need help?** Create a support ticket and our staff team will assist you!\n\n📋 **Before creating a ticket:**\n• Check our rules and FAQ first\n• Be clear and detailed about your issue\n• Be patient - we\'ll respond as soon as possible\n\n🔒 **Your ticket will be private** between you and our staff team.',
        color: '#7C3AED',
        footer: 'Support System • Click the button below to get started',
        buttonText: '🎫 Create Support Ticket',
        fields: [
          {
            name: '⏰ Response Time',
            value: 'Usually within 24 hours',
            inline: true
          },
          {
            name: '👥 Staff Available',
            value: 'Mon-Sun 9AM-11PM EST',
            inline: true
          }
        ]
      });

      if (response.success) {
        toast.success('Custom ticket panel created successfully!');
        // Update server settings with new panel info
        if (serverSettings) {
          setServerSettings({
            ...serverSettings,
            ticket_panel_channel_id: channelId,
            ticket_panel_message_id: response.data?.messageId
          });
        }
      } else {
        toast.error('Failed to create custom ticket panel');
      }
    } catch (error) {
      console.error('Error creating custom ticket panel:', error);
      toast.error('Failed to create custom ticket panel');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateVerificationPanel = async (channelId: string) => {
    if (!serverId || !channelId) return;

    setSaving(true);
    try {
      // Create a custom verification panel with enhanced styling
      const response = await apiService.createCustomVerificationMessage(serverId, channelId, {
        title: '✅ Server Verification Required',
        description: '**Welcome to our server!**\n\nTo access all channels and features, please verify yourself by clicking the button below.\n\nThis helps us maintain a safe and friendly community for everyone.',
        color: '#00D166',
        buttonText: '✅ Verify Me',
        fields: [
          {
            name: '📋 What happens next?',
            value: '• You\'ll get access to all channels\n• You can participate in discussions\n• You\'ll receive the **Verified** role',
            inline: false
          },
          {
            name: '🛡️ Why verify?',
            value: 'Verification helps us prevent spam and keep our community safe.',
            inline: true
          },
          {
            name: '⏱️ How long does it take?',
            value: 'Instant! Just click the button.',
            inline: true
          }
        ]
      });

      if (response.success) {
        toast.success('Verification panel created successfully!');
        // Update server settings with new panel info
        if (serverSettings) {
          setServerSettings({
            ...serverSettings,
            verification_channel_id: channelId,
            verification_panel_message_id: response.data?.messageId
          });
        }
      } else {
        toast.error('Failed to create verification panel');
      }
    } catch (error) {
      console.error('Error creating verification panel:', error);
      toast.error('Failed to create verification panel');
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

  const getServerSettingDisplayName = (setting: string): string => {
    const names: Record<string, string> = {
      'mod_log_channel_id': 'Mod Logs Channel',
      'server_log_channel_id': 'General Logs Channel',
      'ticket_panel_channel_id': 'Ticket Panel Channel',
      'ticket_logs_channel_id': 'Ticket Logs Channel',
      'ticket_category_id': 'Ticket Category'
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
    placeholder?: string;
  }> = ({ value, onChange, disabled = false, placeholder = "-- Select Channel --" }) => (
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
      <option value="">{placeholder}</option>
      {channels.map((channel) => (
        <option key={channel.id} value={channel.id}>
          #{channel.name}
        </option>
      ))}
    </select>
  );

  const CategorySelector: React.FC<{
    value?: string;
    onChange: (categoryId: string) => void;
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
      <option value="">-- Select Category --</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );

  const RoleSelector: React.FC<{
    value?: string;
    onChange: (roleId: string) => void;
    disabled?: boolean;
    placeholder?: string;
  }> = ({ value, onChange, disabled = false, placeholder = "-- Select Role --" }) => (
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
      <option value="">{placeholder}</option>
      {roles.map((role) => (
        <option key={role.id} value={role.id}>
          @{role.name}
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


      {/* Settings Navigation */}
      <div className={classNames(
        "rounded-lg border p-6 mb-8",
        darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <h2 className={classNames(
          "text-xl font-bold mb-6 flex items-center",
          darkMode ? "text-white" : "text-gray-900"
        )}>
          ⚙️ Server Configuration
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Welcome & Leave Messages */}
          <button
            onClick={() => setWelcomeModalOpen(true)}
            className="flex flex-col items-center justify-center p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <UserPlusIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Welcome Messages</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">Configure welcome & leave messages</span>
          </button>

          {/* Verification System */}
          <button
            onClick={() => setVerificationModalOpen(true)}
            className="flex flex-col items-center justify-center p-6 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
          >
            <CheckBadgeIcon className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Verification</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">Member verification system</span>
          </button>

          {/* Leveling System */}
          <button
            onClick={() => {
              toast('🏆 Leveling system configuration coming soon!', { duration: 3000 });
            }}
            className="flex flex-col items-center justify-center p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
          >
            <TrophyIcon className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-2" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Leveling</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">XP and ranking system</span>
          </button>

          {/* Role Management */}
          <button
            onClick={() => setRolesConfigModalOpen(true)}
            className="flex flex-col items-center justify-center p-6 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
          >
            <UserGroupIcon className="h-8 w-8 text-orange-600 dark:text-orange-400 mb-2" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Roles</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">Role management & auto-roles</span>
          </button>

          {/* Economy System */}
          <button
            onClick={() => {
              toast('💰 Economy system configuration coming soon!', { duration: 3000 });
            }}
            className="flex flex-col items-center justify-center p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors"
          >
            <CurrencyDollarIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mb-2" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Economy</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">Virtual currency system</span>
          </button>

          {/* General Settings */}
          <button
            onClick={() => {
              toast('⚙️ General settings configuration coming soon!', { duration: 3000 });
            }}
            className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-700/20 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900/40 transition-colors"
          >
            <InformationCircleIcon className="h-8 w-8 text-gray-600 dark:text-gray-400 mb-2" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">General</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">Basic server settings</span>
          </button>
        </div>
      </div>

      {/* System Channels */}
      <SettingsCard
        title="System Channels"
        description="Configure logging and system message channels"
        icon="📋"
        variant="compact"
        className="mb-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mod Logs */}
          <div className={classNames(
            "p-3 rounded-lg border space-y-2",
            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center">
              <span className="text-red-600 dark:text-red-400 mr-2">🛡️</span>
              <h4 className={classNames("font-medium", darkMode ? "text-white" : "text-gray-900")}>
                Mod Logs
              </h4>
            </div>
            <ChannelSelector
              value={serverSettings?.mod_log_channel_id}
              onChange={(channelId) => handleServerChannelChange('mod_log_channel_id', channelId)}
              disabled={saving}
              placeholder="-- Select Channel --"
            />
            <div className="flex items-center">
              {serverSettings?.mod_log_channel_id ? (
                <span className="text-green-600 dark:text-green-400 text-xs">✅ Configured</span>
              ) : (
                <span className="text-red-600 dark:text-red-400 text-xs">❌ Not configured</span>
              )}
            </div>
          </div>

          {/* General Logs */}
          <div className={classNames(
            "p-3 rounded-lg border space-y-2",
            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center">
              <span className="text-blue-600 dark:text-blue-400 mr-2">📜</span>
              <h4 className={classNames("font-medium", darkMode ? "text-white" : "text-gray-900")}>
                General Logs
              </h4>
            </div>
            <ChannelSelector
              value={serverSettings?.server_log_channel_id}
              onChange={(channelId) => handleServerChannelChange('server_log_channel_id', channelId)}
              disabled={saving}
              placeholder="-- Select Channel --"
            />
            <div className="flex items-center">
              {serverSettings?.server_log_channel_id ? (
                <span className="text-green-600 dark:text-green-400 text-xs">✅ Configured</span>
              ) : (
                <span className="text-red-600 dark:text-red-400 text-xs">❌ Not configured</span>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Ticket System */}
      <SettingsCard
        title="Ticket System"
        description="Configure support ticket system and panel creation"
        icon="🎫"
        variant="compact"
        className="mb-8"
      >

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ticket Panel Channel */}
          <div className={classNames(
            "p-3 rounded-lg border space-y-2",
            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center">
              <span className="text-purple-600 dark:text-purple-400 mr-2">📧</span>
              <h4 className={classNames("font-medium", darkMode ? "text-white" : "text-gray-900")}>
                Ticket Panel Channel
              </h4>
            </div>
            <ChannelSelector
              value={serverSettings?.ticket_panel_channel_id}
              onChange={(channelId) => handleServerChannelChange('ticket_panel_channel_id', channelId)}
              disabled={saving}
              placeholder="-- Select Channel --"
            />
            <div className="flex items-center">
              {serverSettings?.ticket_panel_channel_id ? (
                <span className="text-green-600 dark:text-green-400 text-xs">✅ Configured</span>
              ) : (
                <span className="text-red-600 dark:text-red-400 text-xs">❌ Not configured</span>
              )}
            </div>
          </div>

          {/* Ticket Logs Channel */}
          <div className={classNames(
            "p-3 rounded-lg border space-y-2",
            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center">
              <span className="text-green-600 dark:text-green-400 mr-2">📄</span>
              <h4 className={classNames("font-medium", darkMode ? "text-white" : "text-gray-900")}>
                Ticket Logs Channel
              </h4>
            </div>
            <ChannelSelector
              value={serverSettings?.ticket_logs_channel_id}
              onChange={(channelId) => handleServerChannelChange('ticket_logs_channel_id', channelId)}
              disabled={saving}
              placeholder="-- Select Channel --"
            />
            <div className="flex items-center">
              {serverSettings?.ticket_logs_channel_id ? (
                <span className="text-green-600 dark:text-green-400 text-xs">✅ Configured</span>
              ) : (
                <span className="text-red-600 dark:text-red-400 text-xs">❌ Not configured</span>
              )}
            </div>
          </div>

          {/* Ticket Category */}
          <div className={classNames(
            "p-3 rounded-lg border space-y-2",
            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center">
              <span className="text-gray-600 dark:text-gray-400 mr-2">📁</span>
              <h4 className={classNames("font-medium", darkMode ? "text-white" : "text-gray-900")}>
                Ticket Category
              </h4>
            </div>
            <CategorySelector
              value={serverSettings?.ticket_category_id}
              onChange={(categoryId) => handleCategoryChange('ticket_category_id', categoryId)}
              disabled={saving}
            />
            <div className="flex items-center">
              {serverSettings?.ticket_category_id ? (
                <span className="text-green-600 dark:text-green-400 text-xs">✅ Configured</span>
              ) : (
                <span className="text-red-600 dark:text-red-400 text-xs">❌ Not configured</span>
              )}
            </div>
          </div>

          {/* Create Ticket Panel */}
          <div className={classNames(
            "p-3 rounded-lg border space-y-2 md:col-span-2",
            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center">
              <span className="text-indigo-600 dark:text-indigo-400 mr-2">🔧</span>
              <h4 className={classNames("font-medium", darkMode ? "text-white" : "text-gray-900")}>
                Create Ticket Panel
              </h4>
            </div>
            <p className={classNames(
              "text-xs",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              Create a ticket panel message in your selected channel.
            </p>
            <div className="flex gap-2">
              <ActionButton
                onClick={() => {
                  if (serverSettings?.ticket_panel_channel_id) {
                    handleCreateTicketPanel(serverSettings.ticket_panel_channel_id);
                  } else {
                    toast.error('Please select a ticket panel channel first');
                  }
                }}
                disabled={saving || !serverSettings?.ticket_panel_channel_id}
                loading={saving}
                variant="primary"
                size="sm"
                className="flex-1"
              >
                Create Default Panel
              </ActionButton>
              <ActionButton
                onClick={() => {
                  if (serverSettings?.ticket_panel_channel_id) {
                    handleCreateCustomTicketPanel(serverSettings.ticket_panel_channel_id);
                  } else {
                    toast.error('Please select a ticket panel channel first');
                  }
                }}
                disabled={saving || !serverSettings?.ticket_panel_channel_id}
                loading={saving}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                🎨 Customize Panel
              </ActionButton>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Member Verification */}
      <SettingsCard
        title="Member Verification"
        description="Configure verification system for new members"
        icon="✅"
        variant="compact"
        className="mb-8"
      >

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Verification Channel */}
          <div className={classNames(
            "p-3 rounded-lg border space-y-2",
            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center">
              <span className="text-green-600 dark:text-green-400 mr-2">📝</span>
              <h4 className={classNames("font-medium", darkMode ? "text-white" : "text-gray-900")}>
                Verification Channel
              </h4>
            </div>
            <ChannelSelector
              value={serverSettings?.verification_channel_id}
              onChange={(channelId) => handleServerChannelChange('verification_channel_id', channelId)}
              disabled={saving}
              placeholder="-- Select Channel --"
            />
            <div className="flex items-center">
              {serverSettings?.verification_channel_id ? (
                <span className="text-green-600 dark:text-green-400 text-xs">✅ Configured</span>
              ) : (
                <span className="text-red-600 dark:text-red-400 text-xs">❌ Not configured</span>
              )}
            </div>
          </div>

          {/* Verified Role */}
          <div className={classNames(
            "p-3 rounded-lg border space-y-2",
            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center">
              <span className="text-blue-600 dark:text-blue-400 mr-2">🏷️</span>
              <h4 className={classNames("font-medium", darkMode ? "text-white" : "text-gray-900")}>
                Verified Role
              </h4>
            </div>
            <RoleSelector
              value={serverSettings?.verified_role_id}
              onChange={(roleId) => handleServerChannelChange('verified_role_id', roleId)}
              disabled={saving}
              placeholder="-- Select Role --"
            />
            <div className="flex items-center">
              {serverSettings?.verified_role_id ? (
                <span className="text-green-600 dark:text-green-400 text-xs">✅ Configured</span>
              ) : (
                <span className="text-red-600 dark:text-red-400 text-xs">❌ Not configured</span>
              )}
            </div>
          </div>

          {/* Verification Type */}
          <div className={classNames(
            "p-3 rounded-lg border space-y-2",
            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center">
              <span className="text-purple-600 dark:text-purple-400 mr-2">⚙️</span>
              <h4 className={classNames("font-medium", darkMode ? "text-white" : "text-gray-900")}>
                Verification Type
              </h4>
            </div>
            <select
              value={serverSettings?.verification_type || 'button'}
              onChange={(e) => handleServerChannelChange('verification_type', e.target.value)}
              disabled={saving}
              className={classNames(
                "w-full px-3 py-2 rounded-lg border transition-colors",
                darkMode 
                  ? "bg-gray-700 border-gray-600 text-white focus:border-purple-500" 
                  : "bg-white border-gray-300 text-gray-900 focus:border-purple-500",
                "focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              )}
            >
              <option value="button">🔘 Button Verification</option>
              <option value="captcha">🤖 Captcha Verification</option>
              <option value="custom_question">❓ Custom Question</option>
              <option value="age_verification">🔞 Age Verification</option>
            </select>
          </div>

          {/* Create Verification Panel */}
          <div className={classNames(
            "p-3 rounded-lg border space-y-2",
            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center">
              <span className="text-indigo-600 dark:text-indigo-400 mr-2">🚀</span>
              <h4 className={classNames("font-medium", darkMode ? "text-white" : "text-gray-900")}>
                Create Verification
              </h4>
            </div>
            <p className={classNames(
              "text-xs",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              Create verification panel in selected channel.
            </p>
            <ActionButton
              onClick={() => {
                if (serverSettings?.verification_channel_id) {
                  handleCreateVerificationPanel(serverSettings.verification_channel_id);
                } else {
                  toast.error('Please select a verification channel first');
                }
              }}
              disabled={saving || !serverSettings?.verification_channel_id}
              loading={saving}
              variant="primary"
              size="sm"
              fullWidth
            >
              Create Verification Panel
            </ActionButton>
          </div>
        </div>
      </SettingsCard>

      {/* Welcome Messages */}
      <div className={classNames(
        "rounded-lg border mb-8",
        darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <div className="p-6">
          <h2 className={classNames(
            "text-2xl font-bold mb-6 flex items-center",
            darkMode ? "text-white" : "text-gray-900"
          )}>
            👋 Welcome Messages
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Welcome Channel */}
            <div className={classNames(
              "p-4 rounded-lg border",
              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-green-600 dark:text-green-400">👋</span>
                </div>
                <h3 className={classNames(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Welcome Channel
                </h3>
              </div>
              <ChannelSelector
                value={serverSettings?.welcome_channel_id}
                onChange={(channelId) => handleServerChannelChange('welcome_channel_id', channelId)}
                disabled={saving}
                placeholder="-- Select Channel --"
              />
              <div className="mt-2 flex items-center">
                {serverSettings?.welcome_channel_id ? (
                  <span className="text-green-600 dark:text-green-400 text-sm">✅ Configured</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400 text-sm">❌ Not configured</span>
                )}
              </div>
            </div>

            {/* Goodbye Channel */}
            <div className={classNames(
              "p-4 rounded-lg border",
              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-red-600 dark:text-red-400">👋</span>
                </div>
                <h3 className={classNames(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Goodbye Channel
                </h3>
              </div>
              <ChannelSelector
                value={serverSettings?.goodbye_channel_id}
                onChange={(channelId) => handleServerChannelChange('goodbye_channel_id', channelId)}
                disabled={saving}
                placeholder="-- Select Channel --"
              />
              <div className="mt-2 flex items-center">
                {serverSettings?.goodbye_channel_id ? (
                  <span className="text-green-600 dark:text-green-400 text-sm">✅ Configured</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400 text-sm">❌ Not configured</span>
                )}
              </div>
            </div>

            {/* Rules Channel */}
            <div className={classNames(
              "p-4 rounded-lg border",
              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-yellow-600 dark:text-yellow-400">📜</span>
                </div>
                <h3 className={classNames(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Rules Channel
                </h3>
              </div>
              <ChannelSelector
                value={serverSettings?.rules_channel_id}
                onChange={(channelId) => handleServerChannelChange('rules_channel_id', channelId)}
                disabled={saving}
                placeholder="-- Select Channel --"
              />
              <div className="mt-2 flex items-center">
                {serverSettings?.rules_channel_id ? (
                  <span className="text-green-600 dark:text-green-400 text-sm">✅ Configured</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400 text-sm">❌ Not configured</span>
                )}
              </div>
            </div>

            {/* Welcome Message Configuration */}
            <div className={classNames(
              "p-4 rounded-lg border",
              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-blue-600 dark:text-blue-400">✨</span>
                </div>
                <h3 className={classNames(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Custom Welcome Messages
                </h3>
              </div>
              <p className={classNames(
                "text-sm mb-3",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Create rich, customizable welcome messages with placeholders.
              </p>
              
              {/* Available Variables */}
              <div className={classNames(
                "mb-4 p-3 rounded border-l-4 border-blue-500 text-xs",
                darkMode ? "bg-blue-900/20" : "bg-blue-50"
              )}>
                <div className={classNames(
                  "font-semibold mb-2",
                  darkMode ? "text-blue-300" : "text-blue-800"
                )}>
                  Available Variables:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-blue-300" : "bg-blue-100 text-blue-800"
                  )}>
                    {'{user}'} - User mention
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-blue-300" : "bg-blue-100 text-blue-800"
                  )}>
                    {'{server}'} - Server name
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-blue-300" : "bg-blue-100 text-blue-800"
                  )}>
                    {'{memberCount}'} - Member count
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-blue-300" : "bg-blue-100 text-blue-800"
                  )}>
                    {'{date}'} - Current date
                  </code>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setWelcomeModalOpen(true)}
                  className={classNames(
                    "w-full px-4 py-2 rounded-lg font-medium transition-colors",
                    "bg-blue-600 hover:bg-blue-700 text-white"
                  )}
                >
                  🎨 Configure Welcome Message
                </button>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      if (!serverId) return;
                      try {
                        const response = await apiService.testWelcomeMessage(serverId, {
                          title: 'Welcome to the Server! 👋',
                          description: 'Hey {user}! Welcome to **{server}**!',
                          color: '#5865F2',
                          fields: []
                        });
                        if (response.success) {
                          toast.success('Test welcome message sent!');
                        } else {
                          toast.error('Failed to send test message');
                        }
                      } catch (error) {
                        toast.error('Error sending test message');
                      }
                    }}
                    className={classNames(
                      "px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                      darkMode 
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    🧪 Test Message
                  </button>
                  
                  <button
                    onClick={async () => {
                      if (!serverId) return;
                      if (window.confirm('Reset welcome message to default?')) {
                        try {
                          const response = await apiService.resetWelcomeMessageConfig(serverId);
                          if (response.success) {
                            toast.success('Welcome message reset to default!');
                          } else {
                            toast.error('Failed to reset welcome message');
                          }
                        } catch (error) {
                          toast.error('Error resetting welcome message');
                        }
                      }
                    }}
                    className={classNames(
                      "px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                      "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                    )}
                  >
                    🔄 Reset to Default
                  </button>
                </div>
              </div>
            </div>

            {/* Goodbye/Leave Message Configuration */}
            <div className={classNames(
              "p-4 rounded-lg border",
              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-orange-600 dark:text-orange-400">👋</span>
                </div>
                <h3 className={classNames(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Custom Goodbye Messages
                </h3>
              </div>
              <p className={classNames(
                "text-sm mb-3",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Create rich, customizable goodbye messages when members leave.
              </p>
              
              {/* Available Variables */}
              <div className={classNames(
                "mb-4 p-3 rounded border-l-4 border-orange-500 text-xs",
                darkMode ? "bg-orange-900/20" : "bg-orange-50"
              )}>
                <div className={classNames(
                  "font-semibold mb-2",
                  darkMode ? "text-orange-300" : "text-orange-800"
                )}>
                  Available Variables:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-orange-300" : "bg-orange-100 text-orange-800"
                  )}>
                    {'{user}'} - User name
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-orange-300" : "bg-orange-100 text-orange-800"
                  )}>
                    {'{server}'} - Server name
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-orange-300" : "bg-orange-100 text-orange-800"
                  )}>
                    {'{memberCount}'} - Member count
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-orange-300" : "bg-orange-100 text-orange-800"
                  )}>
                    {'{date}'} - Current date
                  </code>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setGoodbyeModalOpen(true)}
                  className={classNames(
                    "w-full px-4 py-2 rounded-lg font-medium transition-colors",
                    "bg-orange-600 hover:bg-orange-700 text-white"
                  )}
                >
                  🎨 Configure Goodbye Message
                </button>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      if (!serverId) return;
                      try {
                        const response = await apiService.testGoodbyeMessage(serverId, {
                          title: 'Goodbye! 👋',
                          description: 'See you later, {user}! Thanks for being part of **{server}**.',
                          color: '#FF6B35',
                          fields: []
                        });
                        if (response.success) {
                          toast.success('Test goodbye message sent!');
                        } else {
                          toast.error('Failed to send test message');
                        }
                      } catch (error) {
                        toast.error('Error sending test message');
                      }
                    }}
                    className={classNames(
                      "px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                      darkMode 
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    🧪 Test Message
                  </button>
                  
                  <button
                    onClick={async () => {
                      if (!serverId) return;
                      if (window.confirm('Reset goodbye message to default?')) {
                        try {
                          const response = await apiService.resetGoodbyeMessageConfig(serverId);
                          if (response.success) {
                            toast.success('Goodbye message reset to default!');
                          } else {
                            toast.error('Failed to reset goodbye message');
                          }
                        } catch (error) {
                          toast.error('Error resetting goodbye message');
                        }
                      }
                    }}
                    className={classNames(
                      "px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                      "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                    )}
                  >
                    🔄 Reset to Default
                  </button>
                </div>
              </div>
            </div>

            {/* Invite Tracking Join Messages */}
            <div className={classNames(
              "p-4 rounded-lg border",
              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-green-600 dark:text-green-400">📥</span>
                </div>
                <h3 className={classNames(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Invite Join Messages
                </h3>
              </div>
              <p className={classNames(
                "text-sm mb-3",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Configure messages when members join via invites with tracking.
              </p>
              
              {/* Available Variables */}
              <div className={classNames(
                "mb-4 p-3 rounded border-l-4 border-green-500 text-xs",
                darkMode ? "bg-green-900/20" : "bg-green-50"
              )}>
                <div className={classNames(
                  "font-semibold mb-2",
                  darkMode ? "text-green-300" : "text-green-800"
                )}>
                  Available Variables:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-green-300" : "bg-green-100 text-green-800"
                  )}>
                    {'{user}'} - User mention
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-green-300" : "bg-green-100 text-green-800"
                  )}>
                    {'{inviter}'} - Inviter mention
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-green-300" : "bg-green-100 text-green-800"
                  )}>
                    {'{inviteCode}'} - Invite code
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-green-300" : "bg-green-100 text-green-800"
                  )}>
                    {'{inviteUses}'} - Total uses
                  </code>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setInviteJoinModalOpen(true)}
                  className={classNames(
                    "w-full px-4 py-2 rounded-lg font-medium transition-colors",
                    "bg-green-600 hover:bg-green-700 text-white"
                  )}
                >
                  🎨 Configure Invite Join Message
                </button>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      if (!serverId) return;
                      try {
                        const response = await apiService.testInviteJoinMessage(serverId, {
                          title: 'Welcome via Invite! 🎉',
                          description: '{user} joined via {inviter}\'s invite ({inviteCode})!',
                          color: '#00D166',
                          fields: []
                        });
                        if (response.success) {
                          toast.success('Test invite join message sent!');
                        } else {
                          toast.error('Failed to send test message');
                        }
                      } catch (error) {
                        toast.error('Error sending test message');
                      }
                    }}
                    className={classNames(
                      "px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                      darkMode 
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    🧪 Test Message
                  </button>
                  
                  <button
                    onClick={async () => {
                      if (!serverId) return;
                      if (window.confirm('Reset invite join message to default?')) {
                        try {
                          const response = await apiService.resetInviteJoinMessageConfig(serverId);
                          if (response.success) {
                            toast.success('Invite join message reset to default!');
                          } else {
                            toast.error('Failed to reset invite join message');
                          }
                        } catch (error) {
                          toast.error('Error resetting invite join message');
                        }
                      }
                    }}
                    className={classNames(
                      "px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                      "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                    )}
                  >
                    🔄 Reset to Default
                  </button>
                </div>
              </div>
            </div>

            {/* Invite Tracking Leave Messages */}
            <div className={classNames(
              "p-4 rounded-lg border",
              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-red-600 dark:text-red-400">📤</span>
                </div>
                <h3 className={classNames(
                  "text-lg font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Invite Leave Messages
                </h3>
              </div>
              <p className={classNames(
                "text-sm mb-3",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Configure messages when members with tracked invites leave.
              </p>
              
              {/* Available Variables */}
              <div className={classNames(
                "mb-4 p-3 rounded border-l-4 border-red-500 text-xs",
                darkMode ? "bg-red-900/20" : "bg-red-50"
              )}>
                <div className={classNames(
                  "font-semibold mb-2",
                  darkMode ? "text-red-300" : "text-red-800"
                )}>
                  Available Variables:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-red-300" : "bg-red-100 text-red-800"
                  )}>
                    {'{user}'} - User name
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-red-300" : "bg-red-100 text-red-800"
                  )}>
                    {'{inviter}'} - Inviter name
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-red-300" : "bg-red-100 text-red-800"
                  )}>
                    {'{inviteCode}'} - Invite code
                  </code>
                  <code className={classNames(
                    "px-2 py-1 rounded",
                    darkMode ? "bg-gray-700 text-red-300" : "bg-red-100 text-red-800"
                  )}>
                    {'{timeInServer}'} - Time spent
                  </code>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setInviteLeaveModalOpen(true)}
                  className={classNames(
                    "w-full px-4 py-2 rounded-lg font-medium transition-colors",
                    "bg-red-600 hover:bg-red-700 text-white"
                  )}
                >
                  🎨 Configure Invite Leave Message
                </button>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      if (!serverId) return;
                      try {
                        const response = await apiService.testInviteLeaveMessage(serverId, {
                          title: 'Member Left 😢',
                          description: '{user} left the server (was invited by {inviter})',
                          color: '#DC2626',
                          fields: []
                        });
                        if (response.success) {
                          toast.success('Test invite leave message sent!');
                        } else {
                          toast.error('Failed to send test message');
                        }
                      } catch (error) {
                        toast.error('Error sending test message');
                      }
                    }}
                    className={classNames(
                      "px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                      darkMode 
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    🧪 Test Message
                  </button>
                  
                  <button
                    onClick={async () => {
                      if (!serverId) return;
                      if (window.confirm('Reset invite leave message to default?')) {
                        try {
                          const response = await apiService.resetInviteLeaveMessageConfig(serverId);
                          if (response.success) {
                            toast.success('Invite leave message reset to default!');
                          } else {
                            toast.error('Failed to reset invite leave message');
                          }
                        } catch (error) {
                          toast.error('Error resetting invite leave message');
                        }
                      }
                    }}
                    className={classNames(
                      "px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                      "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                    )}
                  >
                    🔄 Reset to Default
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logging Settings */}
      <SettingsCard
        title="Logging Preferences"
        description="Configure event logging and audit trails"
        icon="📋"
        variant="compact"
        collapsible
        defaultExpanded={false}
      >

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
      </SettingsCard>

      {/* Modals */}
      <WelcomeMessageConfigModal
        isOpen={welcomeModalOpen}
        onClose={() => setWelcomeModalOpen(false)}
        serverId={serverId || ''}
      />
      <GoodbyeMessageConfigModal
        isOpen={goodbyeModalOpen}
        onClose={() => setGoodbyeModalOpen(false)}
        serverId={serverId || ''}
      />
      <InviteJoinMessageConfigModal
        isOpen={inviteJoinModalOpen}
        onClose={() => setInviteJoinModalOpen(false)}
        serverId={serverId || ''}
      />
      <InviteLeaveMessageConfigModal
        isOpen={inviteLeaveModalOpen}
        onClose={() => setInviteLeaveModalOpen(false)}
        serverId={serverId || ''}
      />
      <VerificationConfigModal
        isOpen={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
        serverId={serverId || ''}
      />
      <RolesConfigModal
        isOpen={rolesConfigModalOpen}
        onClose={() => setRolesConfigModalOpen(false)}
        serverId={serverId || ''}
      />
    </div>
  );
};

const ServerSettingsPage: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['admin', 'system_admin', 'manage_servers']}
      fallbackMessage="You need administrator privileges to access server settings."
    >
      <ServerSettingsContent />
    </PermissionGuard>
  );
};

export default ServerSettingsPage;