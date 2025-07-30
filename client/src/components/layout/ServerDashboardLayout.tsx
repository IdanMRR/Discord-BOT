import React, { useState, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate, NavLink, Navigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Server } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import { apiService } from '../../services/api';

// Import all server-scoped pages
import { Analytics } from '../../pages/Analytics';
import Logs from '../../pages/Logs';
import Warnings from '../../pages/Warnings';
import Tickets from '../../pages/Tickets';
import Leveling from '../../pages/LevelingEnhanced';
import ServerSettings from '../../pages/ServerSettings';
import Members from '../../pages/Members';

import {
  DocumentTextIcon,
  ExclamationTriangleIcon,
  TicketIcon,
  TrophyIcon,
  Cog6ToothIcon,
  UsersIcon,
  ServerIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const ServerDashboardLayout: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const { darkMode } = useTheme();
  const { permissions } = useAuth();
  const navigate = useNavigate();
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Define navigation tabs based on PDR requirements
  const navigationTabs = [
    {
      name: 'Overview',
      href: '',
      icon: ServerIcon,
      component: Analytics,
      description: 'Server analytics and insights'
    },
    {
      name: 'Logs',
      href: 'logs',
      icon: DocumentTextIcon,
      component: Logs,
      description: 'Message, member, role, and channel logs'
    },
    {
      name: 'Warnings',
      href: 'warnings',
      icon: ExclamationTriangleIcon,
      component: Warnings,
      description: 'Issue and manage user warnings'
    },
    {
      name: 'Tickets',
      href: 'tickets',
      icon: TicketIcon,
      component: Tickets,
      description: 'Support ticket management'
    },
    {
      name: 'Leveling',
      href: 'leveling',
      icon: TrophyIcon,
      component: Leveling,
      description: 'XP system, leaderboards, and management'
    },
    {
      name: 'Members',
      href: 'members',
      icon: UsersIcon,
      component: Members,
      description: 'Server member management'
    },
    {
      name: 'Settings',
      href: 'settings',
      icon: Cog6ToothIcon,
      component: ServerSettings,
      description: 'Server configuration and preferences'
    }
  ];

  useEffect(() => {
    const fetchServerData = async () => {
      if (!serverId) {
        setError('No server ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await apiService.getServerById(serverId);
        
        if (response && response.success && response.data) {
          setServer(response.data);
        } else {
          setError('Server not found or access denied');
        }
      } catch (error: any) {
        console.error('Error fetching server:', error);
        setError(error.message || 'Failed to load server data');
      } finally {
        setLoading(false);
      }
    };

    fetchServerData();
  }, [serverId]);

  // Check if user has permission to access this server
  // For now, we'll check if user has any permissions (this will be enhanced based on actual permission structure)
  const hasServerAccess = serverId && permissions.length > 0;

  if (loading) {
    return (
      <div className={classNames(
        "min-h-screen p-6",
        darkMode ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <LoadingSpinner size="lg" className="text-primary-600" />
            <p className={classNames(
              "mt-4 text-lg font-medium",
              darkMode ? "text-gray-300" : "text-gray-600"
            )}>Loading server dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !server || !hasServerAccess) {
    return (
      <div className={classNames(
        "min-h-screen p-6",
        darkMode ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <ServerIcon className={classNames(
              "mx-auto h-12 w-12 mb-4",
              darkMode ? "text-red-400" : "text-red-500"
            )} />
            <h3 className={classNames(
              "text-xl font-semibold mb-2",
              darkMode ? "text-red-400" : "text-red-500"
            )}>Access Denied</h3>
            <p className={classNames(
              "text-base mb-4",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              {error || 'You do not have permission to access this server dashboard.'}
            </p>
            <button
              onClick={() => navigate('/select-server')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Select Different Server
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={classNames("min-h-screen", darkMode ? "bg-gray-900" : "bg-gray-50")}>
      {/* Server Header */}
      <div className={classNames(
        "border-b sticky top-0 z-30",
        darkMode 
          ? "bg-gray-800 border-gray-700" 
          : "bg-white border-gray-200"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Server Info */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/select-server')}
                className={classNames(
                  "p-2 rounded-lg transition-colors",
                  darkMode 
                    ? "hover:bg-gray-700 text-gray-400 hover:text-gray-200" 
                    : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                )}
                title="Back to server selection"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              
              {server.icon ? (
                <img 
                  src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`} 
                  alt={server.name} 
                  className="w-10 h-10 rounded-lg"
                />
              ) : (
                <div className={classNames(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold",
                  darkMode 
                    ? "bg-gray-700 text-gray-300" 
                    : "bg-gray-200 text-gray-600"
                )}>
                  {server.name.substring(0, 1).toUpperCase()}
                </div>
              )}
              
              <div>
                <h1 className={classNames(
                  "text-xl font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {server.name}
                </h1>
                {server.memberCount > 0 && (
                  <p className={classNames(
                    "text-sm",
                    darkMode ? "text-gray-400" : "text-gray-600"
                  )}>
                    {server.memberCount.toLocaleString()} members
                  </p>
                )}
              </div>
            </div>

            {/* Server Actions */}
            <div className="flex items-center space-x-2">
              <div className={classNames(
                "px-3 py-1 rounded-full text-xs font-medium",
                darkMode ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700"
              )}>
                Online
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={classNames(
        "border-b sticky top-16 z-20",
        darkMode 
          ? "bg-gray-800 border-gray-700" 
          : "bg-white border-gray-200"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {navigationTabs.map((tab) => (
              <NavLink
                key={tab.name}
                to={`/server/${serverId}/${tab.href}`}
                end={tab.href === ''}
                className={({ isActive }) =>
                  classNames(
                    "group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors",
                    isActive
                      ? "border-primary-500 text-primary-600"
                      : classNames(
                          "border-transparent hover:border-gray-300",
                          darkMode 
                            ? "text-gray-400 hover:text-gray-200" 
                            : "text-gray-500 hover:text-gray-700"
                        )
                  )
                }
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="" element={<Analytics />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="logs" element={<Logs />} />
          <Route path="warnings" element={<Warnings />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="leveling" element={<Leveling />} />
          <Route path="members" element={<Members />} />
          <Route path="settings/*" element={<ServerSettings />} />
          <Route path="*" element={<Navigate to={`/server/${serverId}`} replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default ServerDashboardLayout;