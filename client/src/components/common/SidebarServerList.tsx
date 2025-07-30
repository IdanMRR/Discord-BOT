import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { Server } from '../../types';
import { apiService } from '../../services/api';
import LoadingSpinner from './LoadingSpinner';
import { 
  ServerIcon, 
  ArrowRightIcon,
  ExclamationTriangleIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface SidebarServerListProps {
  collapsed?: boolean;
  onServerSelect?: (serverId: string) => void;
}

const SidebarServerList: React.FC<SidebarServerListProps> = ({ 
  collapsed = false, 
  onServerSelect 
}) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiService.getServerList();
        
        if (response && response.success && response.data && Array.isArray(response.data)) {
          setServers(response.data);
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
  }, []);

  const handleServerClick = (server: Server) => {
    if (onServerSelect) {
      onServerSelect(server.id);
    } else {
      toast.success(`Switching to ${server.name}`);
      navigate(`/server/${server.id}`);
    }
  };

  const formatMemberCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  if (loading) {
    return (
      <div className={classNames(
        'flex flex-col items-center justify-center py-8 px-4',
        collapsed ? 'px-2' : 'px-4'
      )}>
        <LoadingSpinner size="sm" />
        {!collapsed && (
          <p className={classNames(
            'text-xs mt-3 text-center',
            darkMode ? 'text-gray-400' : 'text-gray-600'
          )}>
            Loading servers...
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className={classNames(
        'flex flex-col items-center justify-center py-8 px-4',
        collapsed ? 'px-2' : 'px-4'
      )}>
        <ExclamationTriangleIcon className={classNames(
          'mb-2',
          collapsed ? 'h-6 w-6' : 'h-8 w-8',
          darkMode ? 'text-red-400' : 'text-red-500'
        )} />
        {!collapsed && (
          <p className={classNames(
            'text-xs text-center',
            darkMode ? 'text-red-400' : 'text-red-500'
          )}>
            {error}
          </p>
        )}
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className={classNames(
        'flex flex-col items-center justify-center py-8 px-4',
        collapsed ? 'px-2' : 'px-4'
      )}>
        <ServerIcon className={classNames(
          'mb-2',
          collapsed ? 'h-6 w-6' : 'h-8 w-8',
          darkMode ? 'text-gray-400' : 'text-gray-500'
        )} />
        {!collapsed && (
          <p className={classNames(
            'text-xs text-center',
            darkMode ? 'text-gray-400' : 'text-gray-600'
          )}>
            No servers available
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!collapsed && (
        <div className={classNames(
          'px-4 py-2 text-xs font-bold uppercase tracking-widest',
          darkMode ? 'text-slate-400' : 'text-slate-500'
        )}>
          <div className="flex items-center space-x-2">
            <div className={classNames(
              'w-1 h-4 rounded-full bg-gradient-to-b from-blue-500 to-blue-600'
            )}></div>
            <span>Your Servers</span>
          </div>
        </div>
      )}
      
      <div className="space-y-1">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => handleServerClick(server)}
            className={classNames(
              'group flex items-center w-full text-sm font-medium rounded-xl transition-all duration-300 relative overflow-hidden',
              collapsed ? 'px-3 py-4 justify-center' : 'px-4 py-3.5',
              'hover:bg-gradient-to-r hover:from-blue-500/10 hover:via-purple-500/10 hover:to-blue-500/10',
              darkMode 
                ? 'text-slate-300 hover:bg-slate-700/50 hover:text-white hover:shadow-lg hover:shadow-slate-900/20'
                : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 hover:shadow-lg hover:shadow-slate-900/10'
            )}
            title={collapsed ? server.name : undefined}
          >
            {/* Server Icon */}
            <div className={classNames(
              'flex items-center justify-center rounded-lg transition-all duration-300 relative z-10 flex-shrink-0',
              collapsed ? 'w-10 h-10' : 'w-10 h-10 mr-3',
              'bg-gradient-to-br from-blue-500/20 to-purple-500/20',
              'group-hover:from-blue-500/30 group-hover:to-purple-500/30'
            )}>
              {server.icon ? (
                <img
                  src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png?size=64`}
                  alt={server.name}
                  className="w-8 h-8 rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className={classNames(
                  'flex items-center justify-center w-8 h-8 rounded-lg text-white font-bold text-sm',
                  'bg-gradient-to-br from-blue-500 to-purple-500',
                  server.icon ? 'hidden' : 'flex'
                )}
                style={{ display: server.icon ? 'none' : 'flex' }}
              >
                {server.name.charAt(0).toUpperCase()}
              </div>
            </div>
            
            {!collapsed && (
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="font-semibold tracking-wide truncate">
                    {server.name}
                  </span>
                  <ArrowRightIcon className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 ml-2" />
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <UserGroupIcon className="h-3 w-3 opacity-60" />
                  <span className={classNames(
                    'text-xs opacity-75',
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  )}>
                    {formatMemberCount(server.memberCount || 0)} members
                  </span>
                </div>
              </div>
            )}
            
            {/* Hover effect overlay */}
            <div className={classNames(
              'absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300',
              'bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5'
            )}></div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SidebarServerList;