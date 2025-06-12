import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  TicketIcon,
  ExclamationTriangleIcon,
  CogIcon,
  ServerIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { wsService } from '../../services/websocket';
import Logo from '../common/Logo';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  permission?: string;
  badge?: number;
  emoji?: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { user, permissions } = useAuth();
  const { darkMode } = useTheme();
  const location = useLocation();
  const [connectionStatus, setConnectionStatus] = React.useState(wsService.isConnected());

  React.useEffect(() => {
    const checkConnection = () => {
      setConnectionStatus(wsService.isConnected());
    };

    const interval = setInterval(checkConnection, 1000);
    return () => clearInterval(interval);
  }, []);

  const navigation: NavigationItem[] = [
    { name: 'Dashboard', href: '/', icon: HomeIcon, permission: 'view_dashboard', emoji: '📊' },
    { name: 'Servers', href: '/servers', icon: ServerIcon, permission: 'view_dashboard', emoji: '🖥️' },
    { name: 'Tickets', href: '/tickets', icon: TicketIcon, permission: 'view_tickets', emoji: '🎫' },
    { name: 'Warnings', href: '/warnings', icon: ExclamationTriangleIcon, permission: 'view_warnings', emoji: '⚠️' },
    { name: 'Admin Panel', href: '/admin', icon: CogIcon, permission: 'admin', emoji: '👑' },
    { name: 'Settings', href: '/settings', icon: CogIcon, emoji: '⚙️' },
  ];

  const hasPermission = (permission?: string): boolean => {
    if (!permission) return true;
    return permissions.includes(permission);
  };

  const filteredNavigation = navigation.filter(item => hasPermission(item.permission));

  return (
    <div className={classNames(
      'fixed left-0 top-0 h-full z-50 flex flex-col border-r transition-all duration-200',
      collapsed ? 'w-20' : 'w-64',
      darkMode 
        ? 'bg-gray-900 border-gray-700' 
        : 'bg-white border-gray-200'
    )}>
      {/* Logo and Brand */}
      <div className={classNames(
        'relative h-16 flex items-center justify-center border-b',
        collapsed ? 'px-4' : 'px-4',
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
      )}>
        <div className="relative flex items-center justify-center w-full">
          {collapsed ? (
            <div className="transition-colors">
              <div className={classNames(
                "w-10 h-10 rounded-lg flex items-center justify-center border",
                darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-100 border-gray-200"
              )}>
                <span className={classNames(
                  "font-bold text-lg",
                  darkMode ? "text-gray-200" : "text-gray-700"
                )}>S</span>
              </div>
            </div>
          ) : (
            <div className="transition-colors">
              <Logo size="md" />
            </div>
          )}
        </div>

        {/* Toggle Button - Only show when not collapsed */}
        {!collapsed && (
          <button
            onClick={onToggle}
            className={classNames(
              'absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg border transition-colors',
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' 
                : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
            )}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Connection Status */}
      {!collapsed && (
        <div className={classNames(
          'px-4 py-3 border-b',
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
        )}>
          <div className="flex items-center text-sm">
            <div className={classNames(
              'w-3 h-3 rounded-full mr-3',
              connectionStatus 
                ? 'bg-green-500' 
                : 'bg-red-500'
            )}></div>
            <span className={classNames(
              'font-medium',
              connectionStatus 
                ? darkMode ? 'text-green-400' : 'text-green-700'
                : darkMode ? 'text-red-400' : 'text-red-700'
            )}>
              {connectionStatus ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      )}

      {/* Collapsed Connection Indicator */}
      {collapsed && (
        <div className={classNames(
          'px-4 py-3 border-b flex justify-center',
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
        )}>
          <div className={classNames(
            'w-3 h-3 rounded-full',
            connectionStatus 
              ? 'bg-green-500' 
              : 'bg-red-500'
          )}></div>
        </div>
      )}

      {/* Navigation */}
      <nav className={classNames(
        'flex-1 overflow-y-auto',
        collapsed ? 'px-3 py-6 space-y-3' : 'px-3 py-4 space-y-2'
      )}>
        {filteredNavigation.map((item, index) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={classNames(
                'group flex items-center text-sm font-semibold rounded-lg border transition-colors relative',
                collapsed ? 'px-3 py-4 justify-center' : 'px-3 py-3',
                isActive
                  ? darkMode 
                    ? 'bg-primary-600 border-primary-600 text-white' 
                    : 'bg-primary-600 border-primary-600 text-white'
                  : darkMode 
                    ? 'border-transparent text-gray-300 hover:bg-gray-700 hover:border-gray-600 hover:text-white'
                    : 'border-transparent text-gray-600 hover:bg-gray-100 hover:border-gray-200 hover:text-gray-900'
              )}
              title={collapsed ? item.name : undefined}
            >
              <div className={classNames(
                'flex items-center justify-center rounded-lg transition-colors',
                collapsed ? 'w-10 h-10' : 'w-8 h-8 mr-3',
                isActive 
                  ? 'bg-white/20 text-white' 
                  : darkMode 
                    ? 'bg-gray-700 text-gray-400 group-hover:bg-gray-600 group-hover:text-gray-300'
                    : 'bg-gray-200 text-gray-500 group-hover:bg-gray-300 group-hover:text-gray-600'
              )}>
                  <item.icon className={collapsed ? "h-6 w-6" : "h-5 w-5"} aria-hidden="true" />
              </div>
              
              {!collapsed && (
                <>
                  <span className="relative z-10 flex-1">{item.name}</span>
                  {item.badge && (
                    <span className={classNames(
                      "ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full border",
                      darkMode 
                        ? "bg-red-600 border-red-600 text-white" 
                        : "bg-red-500 border-red-500 text-white"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info */}
      <div className={classNames(
        'flex-shrink-0 border-t',
        collapsed ? 'px-3 py-4' : 'px-4 py-4',
        darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
      )}>
        <div className={classNames(
          'flex items-center rounded-lg border transition-colors group',
          collapsed ? 'justify-center p-2' : 'p-3',
          darkMode 
            ? 'border-gray-700 hover:border-gray-600 hover:bg-gray-700' 
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-100'
        )}>
          <div className="flex-shrink-0 relative">
            <img
              className={classNames(
                'rounded-full border-2 transition-colors',
                collapsed ? 'h-10 w-10' : 'h-10 w-10',
                darkMode 
                  ? 'border-primary-600 group-hover:border-primary-500' 
                  : 'border-primary-600 group-hover:border-primary-500'
              )}
              src={
                user?.avatar
                  ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                  : `https://cdn.discordapp.com/embed/avatars/${(parseInt(user?.discriminator || '0') % 5)}.png`
              }
              alt={user?.username || 'User'}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://cdn.discordapp.com/embed/avatars/${(parseInt(user?.discriminator || '0') % 5)}.png`;
              }}
            />
            {/* Online indicator */}
            <div className={classNames(
              'absolute -bottom-1 -right-1 bg-green-500 rounded-full border-2 border-white',
              'w-4 h-4'
            )}></div>
          </div>
          
          {!collapsed && (
            <div className="ml-3 flex-1">
              <p className={classNames(
                'text-sm font-semibold transition-colors',
                darkMode ? 'text-white group-hover:text-primary-400' : 'text-gray-900 group-hover:text-primary-600'
              )}>
                {user?.username || 'Unknown User'}
              </p>
              <p className={classNames(
                'text-xs transition-colors',
                darkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-gray-400'
              )}>
                #{user?.discriminator || '0000'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
