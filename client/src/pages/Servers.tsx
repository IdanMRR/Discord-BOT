import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { Server } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageHeader from '../components/common/PageHeader';
import ActionButton from '../components/common/ActionButton';
import StatsCard from '../components/servers/StatsCard';
import ServerCard from '../components/servers/ServerCard';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import { 
  ServerIcon, 
  UsersIcon, 
  PlusIcon, 
  ArrowPathIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const Servers: React.FC = () => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { darkMode } = useTheme();
  const { settings, registerAutoRefresh } = useSettings();
  const selectedServerIdRef = useRef<string | null>(null);
  const navigate = useNavigate();

  const fetchServers = async () => {
    try {
      setLoading(true);
      console.log('Fetching server list...');
      
      const response = await apiService.getServerList();
      
      // Handle successful response with data
      if (response && response.success && response.data && Array.isArray(response.data)) {
        setServers(response.data);
        console.log(`Successfully loaded ${response.data.length} servers`);
        
        // Only select first server if none selected and servers available
        if (response.data.length > 0 && !selectedServerIdRef.current) {
          const firstServer = response.data[0];
          if (firstServer?.id) {
            selectedServerIdRef.current = firstServer.id;
            console.log(`Auto-selected server: ${firstServer.name} (${firstServer.id})`);
          }
        }
        setError(null);
      } else {
        // Handle empty or invalid response
        console.warn('Invalid server response:', response);
        setServers([]);
        setError('Invalid response from server. Please try refreshing.');
      }
    } catch (error: any) {
      console.error('Error fetching servers:', error);
      
      // Provide more specific error messages based on error type
      if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
        setError('Network error. Please check your connection and try again.');
      } else if (error.message?.includes('500')) {
        setError('Server error. The bot may be starting up. Please wait a moment and try again.');
      } else if (error.message?.includes('401') || error.message?.includes('403')) {
        setError('Authentication error. Please log in again.');
      } else if (error.message?.includes('starting up')) {
        setError('The bot is starting up. Please wait a moment and try again.');
      } else {
        setError(`Failed to load servers: ${error.message || 'Unknown error'}`);
      }
      
      setServers([]);
    } finally {
      setLoading(false);
    }
  };

  // Load servers with retry logic on mount
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 2;

    const fetchServersWithRetry = async () => {
      if (!isMounted) return;
      
      try {
        await fetchServers();
      } catch (error: any) {
        if (!isMounted) return;
        
        // Only retry on network errors
        if (retryCount < maxRetries && (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR')) {
          retryCount++;
          console.log(`Retrying due to network error (${retryCount}/${maxRetries})...`);
          setTimeout(() => fetchServersWithRetry(), 3000 * retryCount);
          return;
        }
      }
    };

    fetchServersWithRetry();

    return () => {
      isMounted = false;
    };
  }, []);

  // Register auto-refresh
  useEffect(() => {
    if (settings.autoRefresh) {
      const unregister = registerAutoRefresh('servers-page', () => {
        console.log('Auto-refreshing servers...');
        fetchServers();
      });

      return unregister;
    }
  }, [settings.autoRefresh, registerAutoRefresh]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchServers();
      toast.success(`Refreshed! Found ${servers.length} servers`);
    } catch (error) {
      console.error('Error refreshing servers:', error);
      toast.error('Failed to refresh servers');
    } finally {
      setRefreshing(false);
    }
  };

  const handleViewDetails = (e: React.MouseEvent, serverId: string, serverName: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/servers/${serverId}`);
  };

  const handleLoginConfig = (e: React.MouseEvent, serverId: string, serverName: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/servers/${serverId}/login-config`);
  };

  // Calculate stats
  const totalMembers = servers.reduce((acc, server) => acc + (server.memberCount || 0), 0);
  const totalServers = servers.length;

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
            )}>Loading your Discord servers...</p>
          </div>
        </div>
      </div>
    );
  }

  const headerActions = (
    <ActionButton
      onClick={handleRefresh}
      disabled={refreshing}
      variant="outline"
      loading={refreshing}
      icon={ArrowPathIcon}
    >
      {refreshing ? 'Refreshing...' : 'Refresh'}
    </ActionButton>
  );

  return (
    <div className={classNames("space-y-8", darkMode ? "bg-gray-900" : "bg-gray-50")}>
      {/* Header */}
      <PageHeader
        title="Server Management"
        subtitle="Configure and monitor your Discord bot across all connected servers"
        icon={ServerIcon}
        actions={headerActions}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Total Servers"
          value={totalServers.toLocaleString()}
          icon={ServerIcon}
          iconColor="primary"
        />
        
        <StatsCard
          title="Total Members"
          value={totalMembers.toLocaleString()}
          icon={UsersIcon}
          iconColor="secondary"
        />
        
        <StatsCard
          title="Bot Status"
          value="Online"
          icon={ServerIcon}
          iconColor="green"
        />
      </div>

      {/* Servers Section */}
      <div className={classNames(
        "rounded-lg border overflow-hidden",
        darkMode 
          ? "bg-gray-800 border-gray-700" 
          : "bg-white border-gray-200"
      )}>
        <div className={classNames(
          "px-6 py-4 border-b",
          darkMode ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-gray-50"
        )}>
          <div className="flex items-center justify-between">
            <h3 className={classNames(
              "text-xl font-semibold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              All Servers
            </h3>
            <span className={classNames(
              "px-3 py-1 rounded-lg text-sm font-medium",
              darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
            )}>
              {servers.length} {servers.length === 1 ? 'server' : 'servers'}
            </span>
          </div>
        </div>

        <div className="p-6">
          {error ? (
            <ErrorState error={error} onRefresh={handleRefresh} refreshing={refreshing} />
          ) : servers.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {servers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  onViewDetails={handleViewDetails}
                  onLoginConfig={handleLoginConfig}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Error State Component
const ErrorState: React.FC<{
  error: string;
  onRefresh: () => void;
  refreshing: boolean;
}> = ({ error, onRefresh, refreshing }) => {
  const { darkMode } = useTheme();

  return (
    <div className="text-center py-12">
      <div className={classNames(
        "text-4xl font-bold mb-4",
        darkMode ? "text-red-400" : "text-red-500"
      )}>Error</div>
      <h3 className={classNames(
        "text-xl font-semibold mb-4",
        darkMode ? "text-red-400" : "text-red-500"
      )}>Something went wrong</h3>
      <p className={classNames(
        "text-base mb-6 max-w-2xl mx-auto",
        darkMode ? "text-gray-400" : "text-gray-600"
      )}>{error}</p>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <ActionButton
          onClick={onRefresh}
          disabled={refreshing}
          variant="primary"
          loading={refreshing}
          icon={ArrowPathIcon}
        >
          Try Again
        </ActionButton>
        
        {error.includes('Network') && (
          <a
            href="/servers"
            className={classNames(
              "inline-flex items-center space-x-2 px-4 py-2 border rounded-lg font-medium transition-colors",
              darkMode
                ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            )}
          >
            <span>Reload Page</span>
          </a>
        )}
        
        {error.includes('starting up') && (
          <div className={classNames(
            "inline-flex items-center space-x-2 px-4 py-2 rounded-lg",
            darkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
          )}>
            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
            <span>Bot is starting...</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Empty State Component
const EmptyState: React.FC = () => {
  const { darkMode } = useTheme();

  return (
    <div className="text-center py-12">
      <div className={classNames(
        "text-4xl font-bold mb-4",
        darkMode ? "text-gray-500" : "text-gray-400"
      )}>No Servers</div>
      <h3 className={classNames(
        "text-xl font-semibold mb-4",
        darkMode ? "text-white" : "text-gray-900"
      )}>No servers found</h3>
      <p className={classNames(
        "text-base mb-6 max-w-md mx-auto",
        darkMode ? "text-gray-400" : "text-gray-600"
      )}>
        Your bot isn't connected to any Discord servers yet. Add it to a server to see it here!
      </p>
      <a
        href="https://discord.com/developers/applications"
        target="_blank"
        rel="noopener noreferrer"
        className={classNames(
          "inline-flex items-center space-x-2 px-4 py-2 border rounded-lg font-medium transition-colors",
          "border-green-600 text-white bg-green-600 hover:bg-green-700"
        )}
      >
        <PlusIcon className="h-4 w-4" />
        <span>Add Bot to Server</span>
      </a>
    </div>
  );
};

export default Servers;