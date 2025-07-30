import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
// import { useAuth } from '../contexts/AuthContext'; // Currently unused
import { Server } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PageHeader from '../components/common/PageHeader';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import { 
  ServerIcon, 
  ArrowRightIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const ServerSelection: React.FC = () => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { darkMode } = useTheme();
  // const { permissions } = useAuth(); // Not currently used but may be needed for future permission checks
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetFeature = searchParams.get('feature');

  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true);
        const response = await apiService.getServerList();
        
        if (response && response.success && response.data && Array.isArray(response.data)) {
          setServers(response.data);
          
          // Auto-redirect logic from PDR: if user has access to only one server, redirect automatically
          if (response.data.length === 1) {
            const server = response.data[0];
            const targetPath = targetFeature ? `/server/${server.id}/${targetFeature}` : `/server/${server.id}`;
            navigate(targetPath, { replace: true });
            return;
          }
        } else {
          setServers([]);
          setError('Failed to load servers');
        }
      } catch (error: any) {
        console.error('Error fetching servers:', error);
        setError(error.message || 'Failed to load servers');
        setServers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, [navigate, targetFeature]);

  const handleServerSelect = (serverId: string, serverName: string) => {
    const targetPath = targetFeature ? `/server/${serverId}/${targetFeature}` : `/server/${serverId}`;
    toast.success(`Switching to ${serverName}`);
    navigate(targetPath);
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
            )}>Loading your accessible servers...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={classNames(
        "min-h-screen p-6",
        darkMode ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <ExclamationTriangleIcon className={classNames(
              "mx-auto h-12 w-12 mb-4",
              darkMode ? "text-red-400" : "text-red-500"
            )} />
            <h3 className={classNames(
              "text-xl font-semibold mb-2",
              darkMode ? "text-red-400" : "text-red-500"
            )}>Error Loading Servers</h3>
            <p className={classNames(
              "text-base mb-4",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={classNames("space-y-8", darkMode ? "bg-gray-900" : "bg-gray-50")}>
      <PageHeader
        title="Select Server"
        subtitle={targetFeature 
          ? `Choose a server to access ${targetFeature}` 
          : "Choose a server to access the dashboard"
        }
        icon={ServerIcon}
      />

      {servers.length === 0 ? (
        <div className={classNames(
          "rounded-lg border p-12 text-center",
          darkMode 
            ? "bg-gray-800 border-gray-700" 
            : "bg-white border-gray-200"
        )}>
          <ServerIcon className={classNames(
            "mx-auto h-16 w-16 mb-4",
            darkMode ? "text-gray-500" : "text-gray-400"
          )} />
          <h3 className={classNames(
            "text-xl font-semibold mb-4",
            darkMode ? "text-white" : "text-gray-900"
          )}>No Servers Available</h3>
          <p className={classNames(
            "text-base mb-6 max-w-md mx-auto",
            darkMode ? "text-gray-400" : "text-gray-600"
          )}>
            You don't have permission to access any servers. Please contact an administrator to grant you dashboard permissions.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            View Profile
          </button>
        </div>
      ) : (
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
            <h3 className={classNames(
              "text-xl font-semibold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Available Servers
            </h3>
            <p className={classNames(
              "mt-1 text-sm",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              Select a server to access its dashboard
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servers.map((server) => (
                <button
                  key={server.id}
                  onClick={() => handleServerSelect(server.id, server.name)}
                  className={classNames(
                    "group relative rounded-lg p-6 text-left border-2 transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary-500",
                    darkMode
                      ? "bg-gray-700 border-gray-600 hover:border-primary-500 hover:bg-gray-600"
                      : "bg-gray-50 border-gray-200 hover:border-primary-500 hover:bg-white hover:shadow-md"
                  )}
                >
                  <div className="flex items-center space-x-4">
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
                          ? "bg-gray-600 text-gray-300" 
                          : "bg-gray-300 text-gray-600"
                      )}>
                        {server.name.substring(0, 1).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h4 className={classNames(
                        "text-lg font-semibold truncate",
                        darkMode ? "text-white" : "text-gray-900"
                      )}>
                        {server.name}
                      </h4>
                      {server.memberCount > 0 && (
                        <p className={classNames(
                          "text-sm truncate",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          {server.memberCount.toLocaleString()} members
                        </p>
                      )}
                    </div>

                    <ArrowRightIcon className={classNames(
                      "h-5 w-5 transition-transform group-hover:translate-x-1",
                      darkMode ? "text-gray-400" : "text-gray-500"
                    )} />
                  </div>

                  {targetFeature && (
                    <div className={classNames(
                      "mt-3 px-3 py-1 rounded-md text-xs font-medium inline-block",
                      darkMode ? "bg-primary-500/20 text-primary-400" : "bg-primary-100 text-primary-700"
                    )}>
                      Opening {targetFeature}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerSelection;