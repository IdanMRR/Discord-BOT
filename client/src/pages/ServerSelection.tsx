import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

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

const ServerSelection: React.FC = () => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      <div className="page-container min-h-screen p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <LoadingSpinner size="lg" className="text-primary-600" />
            <p className="mt-4 text-lg font-medium" 
               style={{ color: 'var(--muted-foreground)' }}>
              Loading your accessible servers...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container min-h-screen p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 mb-4" 
                                     style={{ color: 'var(--destructive)' }} />
            <h3 className="text-xl font-semibold mb-2" 
                style={{ color: 'var(--destructive)' }}>
              Error Loading Servers
            </h3>
            <p className="text-base mb-4" 
               style={{ color: 'var(--muted-foreground)' }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-8">
      <PageHeader
        title="Select Server"
        subtitle={targetFeature 
          ? `Choose a server to access ${targetFeature}` 
          : "Choose a server to access the dashboard"
        }
        icon={ServerIcon}
      />

      {servers.length === 0 ? (
        <div className="card rounded-lg p-12 text-center">
          <ServerIcon className="mx-auto h-16 w-16 mb-4" 
                      style={{ color: 'var(--muted-foreground)' }} />
          <h3 className="card-title text-xl font-semibold mb-4">
            No Servers Available
          </h3>
          <p className="card-description text-base mb-6 max-w-md mx-auto">
            You don't have permission to access any servers. Please contact an administrator to grant you dashboard permissions.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md"
          >
            View Profile
          </button>
        </div>
      ) : (
        <div className="card rounded-lg overflow-hidden">
          <div className="card-header px-6 py-4">
            <h3 className="card-title text-xl font-semibold">
              Available Servers
            </h3>
            <p className="card-description mt-1 text-sm">
              Select a server to access its dashboard
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servers.map((server) => (
                <button
                  key={server.id}
                  onClick={() => handleServerSelect(server.id, server.name)}
                  className="content-area group relative rounded-lg p-4 text-left border-2 transition-all duration-200 hover:scale-[1.01] focus:outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--border)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div className="flex items-center space-x-4">
                    {server.icon ? (
                      <img 
                        src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`} 
                        alt={server.name} 
                        className="w-10 h-10 rounded-lg"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold"
                           style={{
                             backgroundColor: 'var(--secondary)',
                             color: 'var(--secondary-foreground)'
                           }}>
                        {server.name.substring(0, 1).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-semibold truncate" 
                          style={{ color: 'var(--card-foreground)' }}>
                        {server.name}
                      </h4>
                      {server.memberCount > 0 && (
                        <p className="text-sm truncate" 
                           style={{ color: 'var(--muted-foreground)' }}>
                          {server.memberCount.toLocaleString()} members
                        </p>
                      )}
                    </div>

                    <ArrowRightIcon className="h-5 w-5 transition-transform group-hover:translate-x-1"
                                    style={{ color: 'var(--muted-foreground)' }} />
                  </div>

                  {targetFeature && (
                    <div className="mt-3 px-3 py-1 rounded-md text-xs font-medium inline-block"
                         style={{
                           backgroundColor: 'var(--accent)',
                           color: 'var(--accent-foreground)'
                         }}>
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