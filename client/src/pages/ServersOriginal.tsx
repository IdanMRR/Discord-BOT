import React, { useState, useEffect, useRef } from 'react';
import { Server } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { 
  ServerIcon, 
  UsersIcon, 
  PlusIcon, 
  ArrowPathIcon,
  EyeIcon,
  CogIcon
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
      } 
      // Handle case where we got a response but it's not in the expected format
      else if (response && Array.isArray(response)) {
        // If the API returned an array directly
        setServers(response);
        console.log(`Successfully loaded ${response.length} servers (direct array)`);
        setError(null);
      }
      // Handle error response or empty results
      else {
        console.warn('No servers available or API returned error:', response?.error);
        setServers([]);
        
        // Set a more helpful error message based on the response
        if (response?.error) {
          if (response.error.includes('starting up') || response.error.includes('connecting')) {
            setError('Discord bot is starting up. This usually takes 10-30 seconds. Please wait and refresh the page.');
          } else if (response.error.includes('not currently invited')) {
            setError('Your Discord bot is not invited to any servers yet. Please invite the bot to a Discord server to see it here.');
          } else {
            setError(response.error);
          }
        } else {
          setError('No Discord servers found. Please ensure your bot is invited to servers and has proper permissions, or try refreshing in a few moments if the bot is still starting up.');
        }
      }
    } catch (error: any) {
      console.error('Error fetching servers:', error);
      setServers([]);
      
      // Provide more specific error messages based on error type
      if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        setError('Cannot connect to the Discord bot API. Please ensure the bot is running and try again.');
      } else if (error.response?.status === 503) {
        setError('Discord bot services are temporarily unavailable. Please wait a moment and try again.');
      } else if (error.response?.status >= 500) {
        setError('Server error occurred. Please check the bot logs and try again.');
      } else {
        setError('Failed to connect to the Discord bot API. Please check if the bot is running and properly configured.');
      }
    } finally {
      setLoading(false);
    }  
  };

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

  return (
    <div className={classNames("space-y-8", darkMode ? "bg-gray-900" : "bg-gray-50")}>
      {/* Professional Header Section */}
      <div className="relative">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className={classNames(
              "p-3 rounded-lg border",
              darkMode 
                ? "bg-gray-800 border-gray-700" 
                : "bg-white border-gray-200"
            )}>
              <ServerIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h1 className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                Server Management
              </h1>
              <p className={classNames(
                "text-sm",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                Configure and monitor your Discord bot across all connected servers
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={classNames(
                "inline-flex items-center px-4 py-2 border rounded-lg text-sm font-medium transition-colors",
              darkMode 
                  ? "border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600"
                  : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50",
                refreshing && "opacity-50 cursor-not-allowed"
            )}
          >
            <ArrowPathIcon className={classNames(
                "h-4 w-4 mr-2",
                refreshing && "animate-spin"
            )} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={classNames(
          "p-6 rounded-lg border transition-colors",
          darkMode 
            ? "bg-gray-800 border-gray-700 hover:border-gray-600" 
            : "bg-white border-gray-200 hover:border-gray-300"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg",
              darkMode ? "bg-primary-500/20" : "bg-primary-100"
            )}>
              <ServerIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-primary-400" : "text-primary-600"
              )} />
            </div>
            <div className="ml-4">
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>Total Servers</p>
              <p className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>{servers.length}</p>
            </div>
          </div>
        </div>

        <div className={classNames(
          "p-6 rounded-lg border transition-colors",
          darkMode 
            ? "bg-gray-800 border-gray-700 hover:border-gray-600" 
            : "bg-white border-gray-200 hover:border-gray-300"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg",
              darkMode ? "bg-secondary-500/20" : "bg-secondary-100"
            )}>
              <UsersIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-secondary-400" : "text-secondary-600"
              )} />
            </div>
            <div className="ml-4">
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>Total Members</p>
              <p className={classNames(
                "text-2xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>{servers.reduce((acc, server) => acc + (server.memberCount || 0), 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className={classNames(
          "p-6 rounded-lg border transition-colors",
          darkMode 
            ? "bg-gray-800 border-gray-700 hover:border-gray-600" 
            : "bg-white border-gray-200 hover:border-gray-300"
        )}>
          <div className="flex items-center">
            <div className={classNames(
              "p-3 rounded-lg",
              darkMode ? "bg-green-500/20" : "bg-green-100"
            )}>
              <ServerIcon className={classNames(
                "h-6 w-6",
                darkMode ? "text-green-400" : "text-green-600"
              )} />
            </div>
            <div className="ml-4">
              <p className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>Bot Status</p>
              <p className={classNames(
                "text-2xl font-bold text-green-500"
              )}>Online</p>
            </div>
          </div>
        </div>
      </div>

      {/* Servers Grid */}
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
              <button
                onClick={handleRefresh}
                  disabled={refreshing}
                className={classNames(
                    "inline-flex items-center space-x-2 px-4 py-2 border rounded-lg font-medium transition-colors",
                  darkMode
                    ? "border-primary-600 text-white bg-primary-600 hover:bg-primary-700"
                    : "border-primary-600 text-white bg-primary-600 hover:bg-primary-700",
                  refreshing && "opacity-50 cursor-not-allowed"
                )}
              >
                  <ArrowPathIcon className={classNames(
                    "h-4 w-4",
                    refreshing && "animate-spin"
                  )} />
                  <span>{refreshing ? 'Refreshing...' : 'Try Again'}</span>
              </button>
                
                {error.includes('not invited') && (
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
                    <span>Invite Bot to Server</span>
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
          ) : servers.length === 0 ? (
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {servers.map((server, index) => (
                <Link 
                  key={server.id} 
                  to={`/servers/${server.id}`}
                  className="block group"
                >
                  <div className={classNames(
                    "relative p-6 rounded-lg border transition-colors",
                    darkMode 
                      ? "border-gray-700 bg-gray-800 hover:border-gray-600" 
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}>
                  
                  {/* Content */}
                  <div className="relative">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="relative">
                        {server.icon ? (
                          <img 
                            src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`} 
                            alt={server.name} 
                            className="w-12 h-12 rounded-lg"
                          />
                        ) : (
                          <div className={classNames(
                            "w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold",
                            darkMode 
                              ? "bg-gray-700 text-gray-300" 
                              : "bg-gray-200 text-gray-600"
                          )}>
                            {server.name.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        {/* Online indicator */}
                        <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className={classNames(
                          "font-semibold text-base truncate",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>{server.name}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <UsersIcon className={classNames(
                            "h-4 w-4",
                            darkMode ? "text-gray-400" : "text-gray-500"
                          )} />
                          <p className={classNames(
                            "text-sm",
                            darkMode ? "text-gray-400" : "text-gray-500"
                          )}>
                            {server.memberCount > 0 ? `${server.memberCount.toLocaleString()} members` : 'Member count unavailable'}
                          </p>
                        </div>
                        {/* Owner Information */}
                        {server.owner && (
                          <div className="flex items-center space-x-2 mt-2">
                            <div className={classNames(
                              "w-4 h-4 rounded-full flex items-center justify-center text-xs",
                              darkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-600"
                            )}>
                              ★
                            </div>
                            <p className={classNames(
                              "text-xs",
                              darkMode ? "text-yellow-400" : "text-yellow-600"
                            )}>
                              Owner: {server.owner.displayName || server.owner.username}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 flex space-x-2">
                      <button
                        onClick={(e) => handleViewDetails(e, server.id, server.name)}
                        className={classNames(
                          "flex-1 px-3 py-2 rounded-lg text-center text-sm font-medium transition-colors",
                          darkMode ? "bg-primary-600 text-white hover:bg-primary-700" : "bg-primary-600 text-white hover:bg-primary-700"
                        )}
                      >
                        <EyeIcon className="h-4 w-4 inline mr-1" />
                        View Details
                      </button>
                      <button
                        onClick={(e) => handleLoginConfig(e, server.id, server.name)}
                        className={classNames(
                          "flex-1 px-3 py-2 rounded-lg text-center text-sm font-medium transition-colors",
                          darkMode ? "bg-gray-600 text-white hover:bg-gray-700" : "bg-gray-600 text-white hover:bg-gray-700"
                        )}
                      >
                        <CogIcon className="h-4 w-4 inline mr-1" />
                        Login Config
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);
};

export default Servers;
