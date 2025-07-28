import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import PermissionGuard from '../components/common/PermissionGuard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import {
  CogIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  StarIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  GiftIcon,
  ChartBarIcon,
  CommandLineIcon,
  BellIcon,
  WrenchScrewdriverIcon,
  SparklesIcon,
  HomeIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface ServerInfo {
  id: string;
  name: string;
  memberCount: number;
  icon?: string;
}

interface SettingsCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  path: string;
  enabled: boolean;
  comingSoon?: boolean;
}

const AdvancedServerSettingsContent: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Settings categories configuration
  const settingsCategories: SettingsCategory[] = [
    {
      id: 'general',
      name: 'General Settings',
      description: 'Basic server configuration, bot appearance, and core features',
      icon: Cog6ToothIcon,
      color: 'bg-blue-500',
      path: `/servers/${serverId}/settings/general`,
      enabled: true
    },
    {
      id: 'moderation',
      name: 'Auto-Moderation',
      description: 'Anti-spam, anti-raid, content filters, and automated punishments',
      icon: ShieldCheckIcon,
      color: 'bg-red-500',
      path: `/servers/${serverId}/settings/moderation`,
      enabled: true
    },
    {
      id: 'welcome',
      name: 'Welcome & Leave',
      description: 'Welcome messages, role assignment, member screening, and goodbye messages',
      icon: HomeIcon,
      color: 'bg-green-500',
      path: `/servers/${serverId}/settings/welcome`,
      enabled: true
    },
    {
      id: 'roles',
      name: 'Role Management',
      description: 'Auto-roles, reaction roles, level roles, and role hierarchy',
      icon: UserGroupIcon,
      color: 'bg-purple-500',
      path: `/servers/${serverId}/settings/roles`,
      enabled: true
    },
    {
      id: 'tickets',
      name: 'Ticket System',
      description: 'Support tickets, categories, staff management, and transcripts',
      icon: ChatBubbleLeftRightIcon,
      color: 'bg-indigo-500',
      path: `/servers/${serverId}/settings/tickets`,
      enabled: true
    },
    {
      id: 'logging',
      name: 'Logging & Monitoring',
      description: 'Event logging, audit trails, and server monitoring',
      icon: DocumentTextIcon,
      color: 'bg-gray-500',
      path: `/servers/${serverId}/settings/logging`,
      enabled: true
    },
    {
      id: 'economy',
      name: 'Economy System',
      description: 'Virtual currency, shops, rewards, and gambling games',
      icon: StarIcon,
      color: 'bg-yellow-500',
      path: `/servers/${serverId}/settings/economy`,
      enabled: true
    },
    {
      id: 'leveling',
      name: 'Leveling & XP',
      description: 'Experience points, level rewards, leaderboards, and progression',
      icon: ChartBarIcon,
      color: 'bg-emerald-500',
      path: `/servers/${serverId}/settings/leveling`,
      enabled: true
    },
    {
      id: 'giveaways',
      name: 'Giveaways',
      description: 'Contest management, entry requirements, and winner selection',
      icon: GiftIcon,
      color: 'bg-pink-500',
      path: `/servers/${serverId}/settings/giveaways`,
      enabled: true
    },
    {
      id: 'commands',
      name: 'Custom Commands',
      description: 'Create custom bot commands with variables and permissions',
      icon: CommandLineIcon,
      color: 'bg-cyan-500',
      path: `/servers/${serverId}/settings/commands`,
      enabled: true,
      comingSoon: true
    },
    {
      id: 'notifications',
      name: 'Notifications',
      description: 'Alerts, announcements, and automated messaging',
      icon: BellIcon,
      color: 'bg-orange-500',
      path: `/servers/${serverId}/settings/notifications`,
      enabled: true,
      comingSoon: true
    },
    {
      id: 'integrations',
      name: 'Integrations',
      description: 'Third-party services, webhooks, and API connections',
      icon: WrenchScrewdriverIcon,
      color: 'bg-teal-500',
      path: `/servers/${serverId}/settings/integrations`,
      enabled: true,
      comingSoon: true
    }
  ];

  // Load server data
  useEffect(() => {
    if (!serverId) return;

    const loadServerData = async () => {
      try {
        setLoading(true);
        const serverResponse = await apiService.getServerInfo(serverId);

        if (serverResponse.success && serverResponse.data) {
          setServerInfo(serverResponse.data);
        } else {
          toast.error('Failed to load server information');
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

  // Filter categories based on search term
  const filteredCategories = settingsCategories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-6">
          <div className={classNames(
            "p-3 rounded-lg",
            darkMode ? "bg-blue-900/20" : "bg-blue-100"
          )}>
            <SparklesIcon className={classNames(
              "h-8 w-8",
              darkMode ? "text-blue-400" : "text-blue-600"
            )} />
          </div>
          <div>
            <h1 className={classNames(
              "text-4xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Advanced Settings
            </h1>
            {serverInfo && (
              <p className={classNames(
                "text-lg font-medium mt-2",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                {serverInfo.name} • Professional Bot Configuration
              </p>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-md">
          <input
            type="text"
            placeholder="Search settings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={classNames(
              "w-full px-4 py-2 rounded-lg border transition-colors",
              darkMode 
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500" 
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            )}
          />
        </div>
      </div>

      {/* Info Banner */}
      <div className={classNames(
        "mb-8 p-6 rounded-lg border-l-4 border-blue-500",
        darkMode ? "bg-blue-900/20 border-blue-400" : "bg-blue-50 border-blue-500"
      )}>
        <div className="flex items-start">
          <SparklesIcon className="h-6 w-6 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className={classNames(
              "text-lg font-semibold",
              darkMode ? "text-blue-300" : "text-blue-800"
            )}>
              Professional Bot Configuration
            </h3>
            <p className={classNames(
              "text-sm mt-1",
              darkMode ? "text-blue-200" : "text-blue-700"
            )}>
              Configure every aspect of your Discord bot with professional-grade features. Each category provides comprehensive customization options to make your server unique.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredCategories.map((category) => (
          <div
            key={category.id}
            className={classNames(
              "relative group cursor-pointer rounded-xl border-2 p-6 transition-all duration-200 transform hover:scale-105",
              darkMode 
                ? "bg-gray-800 border-gray-700 hover:border-gray-600" 
                : "bg-white border-gray-200 hover:border-gray-300",
              "hover:shadow-xl"
            )}
            onClick={() => {
              if (category.comingSoon) {
                toast(`${category.name} is coming soon!`, { icon: 'ℹ️' });
              } else {
                navigate(category.path);
              }
            }}
          >
            {/* Coming Soon Badge */}
            {category.comingSoon && (
              <div className="absolute top-3 right-3 z-10">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Soon
                </span>
              </div>
            )}

            {/* Category Icon */}
            <div className={classNames(
              "w-12 h-12 rounded-lg flex items-center justify-center mb-4",
              category.color,
              category.comingSoon ? "opacity-50" : ""
            )}>
              <category.icon className="h-6 w-6 text-white" />
            </div>

            {/* Category Title */}
            <h3 className={classNames(
              "text-lg font-semibold mb-2",
              darkMode ? "text-white" : "text-gray-900",
              category.comingSoon ? "opacity-50" : ""
            )}>
              {category.name}
            </h3>

            {/* Category Description */}
            <p className={classNames(
              "text-sm",
              darkMode ? "text-gray-400" : "text-gray-600",
              category.comingSoon ? "opacity-50" : ""
            )}>
              {category.description}
            </p>

            {/* Arrow Icon */}
            <div className={classNames(
              "absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity",
              category.comingSoon ? "hidden" : ""
            )}>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Section */}
      <div className={classNames(
        "mt-12 rounded-lg border p-6",
        darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <h2 className={classNames(
          "text-xl font-bold mb-6 flex items-center",
          darkMode ? "text-white" : "text-gray-900"
        )}>
          <WrenchScrewdriverIcon className="h-6 w-6 mr-2" />
          Quick Actions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Basic Settings */}
          <button
            onClick={() => navigate(`/servers/${serverId}/settings`)}
            className="flex items-center justify-center space-x-3 px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-200 transform hover:scale-105 font-medium"
          >
            <CogIcon className="h-5 w-5" />
            <span>Basic Settings</span>
          </button>

          {/* View Tickets */}
          <button
            onClick={() => navigate(`/servers/${serverId}/tickets`)}
            className="flex items-center justify-center space-x-3 px-6 py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all duration-200 transform hover:scale-105 font-medium"
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5" />
            <span>View Tickets</span>
          </button>

          {/* Activity Logs */}
          <button
            onClick={() => navigate(`/servers/${serverId}/logs`)}
            className="flex items-center justify-center space-x-3 px-6 py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-200 transform hover:scale-105 font-medium"
          >
            <DocumentTextIcon className="h-5 w-5" />
            <span>Activity Logs</span>
          </button>

          {/* Server Overview */}
          <button
            onClick={() => navigate(`/servers/${serverId}`)}
            className="flex items-center justify-center space-x-3 px-6 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-all duration-200 transform hover:scale-105 font-medium"
          >
            <ChartBarIcon className="h-5 w-5" />
            <span>Server Overview</span>
          </button>
        </div>
      </div>

      {/* No Results */}
      {filteredCategories.length === 0 && (
        <div className="text-center py-12">
          <SparklesIcon className={classNames(
            "h-12 w-12 mx-auto mb-4",
            darkMode ? "text-gray-600" : "text-gray-400"
          )} />
          <h3 className={classNames(
            "text-lg font-semibold mb-2",
            darkMode ? "text-gray-300" : "text-gray-600"
          )}>
            No settings found
          </h3>
          <p className={classNames(
            "text-sm",
            darkMode ? "text-gray-400" : "text-gray-500"
          )}>
            Try adjusting your search term to find the settings you're looking for.
          </p>
        </div>
      )}
    </div>
  );
};

const AdvancedServerSettings: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['admin', 'system_admin', 'manage_servers']}
      fallbackMessage="You need administrator privileges to access advanced server settings."
    >
      <AdvancedServerSettingsContent />
    </PermissionGuard>
  );
};

export default AdvancedServerSettings;