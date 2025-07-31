import React, { useState, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate, NavLink, Navigate } from 'react-router-dom';
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
      <div className="page-container p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <LoadingSpinner size="lg" className="text-primary-600" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">Loading server dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !server || !hasServerAccess) {
    return (
      <div className="page-container p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <ServerIcon className="mx-auto h-12 w-12 mb-4 text-destructive" />
            <h3 className="text-xl font-semibold mb-2 text-destructive">Access Denied</h3>
            <p className="text-base mb-4 text-muted-foreground">
              {error || 'You do not have permission to access this server dashboard.'}
            </p>
            <button
              onClick={() => navigate('/select-server')}
              className="btn-primary"
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
    <div className="page-container">
      {/* Server Header */}
      <div className="border-b sticky top-0 z-30 bg-card border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Server Info */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/select-server')}
                className="p-2 rounded-lg transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
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
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold bg-muted text-muted-foreground">
                  {server.name.substring(0, 1).toUpperCase()}
                </div>
              )}
              
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {server.name}
                </h1>
                {server.memberCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {server.memberCount.toLocaleString()} members
                  </p>
                )}
              </div>
            </div>

            {/* Server Actions */}
            <div className="flex items-center space-x-2">
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-success/20 text-success">
                Online
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b sticky top-16 z-20 bg-card border-border">
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
                      ? "border-primary text-primary"
                      : "border-transparent hover:border-border text-muted-foreground hover:text-foreground"
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