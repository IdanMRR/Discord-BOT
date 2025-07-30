import React from 'react';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';
import {
  CogIcon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  HomeIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  ServerIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { wsService } from '../../services/websocket';
import SidebarServerList from '../common/SidebarServerList';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, isMobile = false }) => {
  const { user, logout } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [connectionStatus, setConnectionStatus] = React.useState(wsService.isConnected());

  React.useEffect(() => {
    const checkConnection = () => {
      setConnectionStatus(wsService.isConnected());
    };

    const interval = setInterval(checkConnection, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Navigation items - reorganized as requested
  const mainNavigationItems = [
    {
      name: 'Home',
      href: '/',
      icon: HomeIcon,
      emoji: '🏠'
    },
    {
      name: 'Server Selection',
      href: '/servers',
      icon: ServerIcon,
      emoji: '🖥️'
    },
    {
      name: 'Admin Panel',
      href: '/admin',
      icon: ShieldCheckIcon,
      emoji: '🛡️'
    },
    {
      name: 'Logs',
      href: '/logs',
      icon: ClipboardDocumentListIcon,
      emoji: '📋'
    }
  ];

  const settingsNavigationItems = [
    {
      name: 'Profile',
      href: '/profile',
      icon: UserCircleIcon,
      emoji: '👤'
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: CogIcon,
      emoji: '⚙️'
    }
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && !collapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
          onClick={onToggle}
        />
      )}
      
      <div className={classNames(
        'fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-500 ease-in-out',
        collapsed ? 'w-20' : 'w-72',
        isMobile && collapsed ? '-translate-x-full' : 'translate-x-0',
        darkMode 
          ? 'bg-gradient-to-b from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-r border-slate-700/50' 
          : 'bg-gradient-to-b from-white/95 via-slate-50/95 to-white/95 backdrop-blur-xl border-r border-slate-200/50',
        'shadow-2xl shadow-black/10'
      )}>
        {/* Header */}
        <div className={classNames(
          'relative h-20 flex items-center border-b backdrop-blur-sm',
          collapsed ? 'justify-center px-3' : 'justify-between px-6',
          darkMode 
            ? 'bg-slate-800/50 border-slate-600/30' 
            : 'bg-white/50 border-slate-300/30'
        )}>
          <div className="flex items-center">
            {isMobile && (
              <button
                onClick={onToggle}
                className={classNames(
                  'p-2 mr-2 rounded-lg transition-colors lg:hidden',
                  darkMode 
                    ? 'hover:bg-gray-700 text-gray-300' 
                    : 'hover:bg-gray-100 text-gray-600'
                )}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
            )}
            
            {collapsed ? (
              <div className="relative group">
                <div className={classNames(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                  "bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700",
                  "shadow-lg shadow-blue-500/25 group-hover:shadow-xl group-hover:shadow-blue-500/40",
                  "border border-blue-400/30 group-hover:border-blue-400/50",
                  "transform group-hover:scale-105"
                )}>
                  <svg className="w-7 h-7 text-white" viewBox="0 0 100 100" fill="none">
                    <ellipse cx="50" cy="50" rx="35" ry="18" stroke="currentColor" strokeWidth="2.5" fill="none" transform="rotate(45 50 50)"/>
                    <ellipse cx="50" cy="50" rx="35" ry="18" stroke="currentColor" strokeWidth="2.5" fill="none" transform="rotate(-45 50 50)"/>
                    <ellipse cx="50" cy="50" rx="35" ry="18" stroke="currentColor" strokeWidth="2.5" fill="none" transform="rotate(0 50 50)"/>
                    <circle cx="50" cy="50" r="3" fill="currentColor"/>
                    <rect x="38" y="38" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                    <circle cx="45" cy="46" r="2" fill="currentColor"/>
                    <circle cx="55" cy="46" r="2" fill="currentColor"/>
                    <path d="M 44 54 Q 50 58 56 54" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="relative group">
                  <div className={classNames(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                    "bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700",
                    "shadow-lg shadow-blue-500/25 group-hover:shadow-xl group-hover:shadow-blue-500/40",
                    "border border-blue-400/30 group-hover:border-blue-400/50"
                  )}>
                    <svg className="w-7 h-7 text-white" viewBox="0 0 100 100" fill="none">
                      <ellipse cx="50" cy="50" rx="35" ry="18" stroke="currentColor" strokeWidth="2.5" fill="none" transform="rotate(45 50 50)"/>
                      <ellipse cx="50" cy="50" rx="35" ry="18" stroke="currentColor" strokeWidth="2.5" fill="none" transform="rotate(-45 50 50)"/>
                      <ellipse cx="50" cy="50" rx="35" ry="18" stroke="currentColor" strokeWidth="2.5" fill="none" transform="rotate(0 50 50)"/>
                      <circle cx="50" cy="50" r="3" fill="currentColor"/>
                      <rect x="38" y="38" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                      <circle cx="45" cy="46" r="2" fill="currentColor"/>
                      <circle cx="55" cy="46" r="2" fill="currentColor"/>
                      <path d="M 44 54 Q 50 58 56 54" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                </div>
                <div>
                  <h1 className={classNames(
                    "text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent",
                    "tracking-tight"
                  )}>
                    PanelOps
                  </h1>
                  <p className={classNames(
                    "text-xs font-medium",
                    darkMode ? "text-slate-400" : "text-slate-500"
                  )}>
                    Admin Suite
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Toggle Button - Desktop only */}
          {!collapsed && !isMobile && (
            <button
              onClick={onToggle}
              className={classNames(
                'p-1.5 rounded-lg transition-colors hidden lg:block',
                darkMode 
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300' 
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-600'
              )}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Connection Status */}
        <div className={classNames(
          'border-b backdrop-blur-sm',
          collapsed ? 'px-3 py-4' : 'px-6 py-4',
          darkMode ? 'bg-slate-800/30 border-slate-600/30' : 'bg-white/30 border-slate-300/30'
        )}>
          <div className={classNames(
            'flex items-center',
            collapsed ? 'justify-center' : 'space-x-3'
          )}>
            <div className="relative">
              <div className={classNames(
                'w-3 h-3 rounded-full transition-all duration-300',
                connectionStatus 
                  ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' 
                  : 'bg-red-500 shadow-lg shadow-red-500/50'
              )}></div>
              {connectionStatus && (
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-20"></div>
              )}
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className={classNames(
                  'text-xs font-semibold tracking-wide',
                  connectionStatus 
                    ? darkMode ? 'text-emerald-400' : 'text-emerald-600'
                    : darkMode ? 'text-red-400' : 'text-red-600'
                )}>
                  {connectionStatus ? 'ONLINE' : 'OFFLINE'}
                </span>
                <span className={classNames(
                  'text-xs opacity-75',
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                )}>
                  {connectionStatus ? 'All systems operational' : 'Connection lost'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className={classNames(
          'flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent',
          collapsed ? 'px-3 py-4' : 'px-6 py-4'
        )}>
          <div className="space-y-6">
            {/* Main Navigation Items */}
            <div>
              {!collapsed && (
                <div className={classNames(
                  'px-3 py-2 text-xs font-bold uppercase tracking-widest mb-2',
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                )}>
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-3 rounded-full bg-gradient-to-b from-blue-500 to-blue-600"></div>
                    <span>Navigation</span>
                  </div>
                </div>
              )}
              
              <div className="space-y-1">
                {mainNavigationItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={classNames(
                        'group flex items-center text-sm font-medium rounded-lg transition-all duration-300 relative overflow-hidden',
                        collapsed ? 'px-2 py-3 justify-center' : 'px-3 py-2.5',
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25' 
                          : darkMode 
                            ? 'text-slate-300 hover:bg-slate-700/50 hover:text-white hover:shadow-md hover:shadow-slate-900/20'
                            : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 hover:shadow-md hover:shadow-slate-900/10'
                      )}
                      title={collapsed ? item.name : undefined}
                    >
                      {/* Active state background gradient */}
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-blue-500/20 to-blue-600/20 rounded-lg blur-sm"></div>
                      )}
                      
                      <div className={classNames(
                        'flex items-center justify-center rounded-md transition-all duration-300 relative z-10',
                        collapsed ? 'w-8 h-8' : 'w-6 h-6 mr-3',
                        isActive 
                          ? 'text-white bg-white/10' 
                          : darkMode 
                            ? 'text-slate-400 group-hover:text-slate-200'
                            : 'text-slate-500 group-hover:text-slate-700'
                      )}>
                        <item.icon className={collapsed ? "h-5 w-5" : "h-4 w-4"} />
                      </div>
                      
                      {!collapsed && (
                        <div className="flex-1 relative z-10">
                          <span className="font-medium tracking-wide text-sm">{item.name}</span>
                          {item.emoji && (
                            <span className="ml-2 text-xs opacity-60">{item.emoji}</span>
                          )}
                        </div>
                      )}
                      
                      {/* Hover effect overlay */}
                      <div className={classNames(
                        'absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                        !isActive ? 'bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5' : ''
                      )}></div>
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {/* Gap/Divider */}
            <div className={classNames(
              'border-t',
              darkMode ? 'border-slate-600/30' : 'border-slate-300/30'
            )}></div>

            {/* Settings Section */}
            <div>
              <div className="space-y-1">
                {settingsNavigationItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={classNames(
                        'group flex items-center text-sm font-medium rounded-lg transition-all duration-300 relative overflow-hidden',
                        collapsed ? 'px-2 py-3 justify-center' : 'px-3 py-2.5',
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25' 
                          : darkMode 
                            ? 'text-slate-300 hover:bg-slate-700/50 hover:text-white hover:shadow-md hover:shadow-slate-900/20'
                            : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 hover:shadow-md hover:shadow-slate-900/10'
                      )}
                      title={collapsed ? item.name : undefined}
                    >
                      {/* Active state background gradient */}
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-blue-500/20 to-blue-600/20 rounded-lg blur-sm"></div>
                      )}
                      
                      <div className={classNames(
                        'flex items-center justify-center rounded-md transition-all duration-300 relative z-10',
                        collapsed ? 'w-8 h-8' : 'w-6 h-6 mr-3',
                        isActive 
                          ? 'text-white bg-white/10' 
                          : darkMode 
                            ? 'text-slate-400 group-hover:text-slate-200'
                            : 'text-slate-500 group-hover:text-slate-700'
                      )}>
                        <item.icon className={collapsed ? "h-5 w-5" : "h-4 w-4"} />
                      </div>
                      
                      {!collapsed && (
                        <div className="flex-1 relative z-10">
                          <span className="font-medium tracking-wide text-sm">{item.name}</span>
                          {item.emoji && (
                            <span className="ml-2 text-xs opacity-60">{item.emoji}</span>
                          )}
                        </div>
                      )}
                      
                      {/* Hover effect overlay */}
                      <div className={classNames(
                        'absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                        !isActive ? 'bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5' : ''
                      )}></div>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced User Profile */}
        <div className={classNames(
          'flex-shrink-0 border-t backdrop-blur-sm relative',
          collapsed ? 'px-3 py-4' : 'px-6 py-5',
          darkMode ? 'border-slate-600/30 bg-slate-800/30' : 'border-slate-300/30 bg-white/30'
        )}>
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 via-transparent to-transparent opacity-50"></div>
          
          <div className={classNames(
            'flex items-center rounded-xl transition-all duration-300 group cursor-pointer relative z-10',
            collapsed ? 'justify-center p-3' : 'p-4',
            'hover:bg-gradient-to-r hover:from-blue-500/10 hover:via-purple-500/10 hover:to-blue-500/10',
            'hover:backdrop-blur-sm hover:shadow-lg hover:shadow-blue-500/10'
          )}
          onClick={() => navigate('/profile')}
          >
            <div className="flex-shrink-0 relative">
              <div className="relative">
                <img
                  className={classNames(
                    'rounded-full border-3 transition-all duration-300',
                    collapsed ? 'h-12 w-12' : 'h-14 w-14',
                    'border-gradient-to-r from-blue-400 via-purple-400 to-blue-400',
                    'group-hover:shadow-lg group-hover:shadow-blue-500/25 group-hover:scale-105'
                  )}
                  style={{
                    border: '3px solid',
                    borderImage: collapsed 
                      ? 'linear-gradient(45deg, #60a5fa, #a855f7, #60a5fa) 1'
                      : 'linear-gradient(45deg, #60a5fa, #a855f7, #60a5fa) 1'
                  }}
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
                {/* Enhanced online indicator with pulse */}
                <div className={classNames(
                  'absolute -bottom-1 -right-1 rounded-full border-3 transition-all duration-300',
                  collapsed ? 'w-4 h-4' : 'w-5 h-5',
                  'bg-emerald-500 shadow-lg shadow-emerald-500/50',
                  darkMode ? 'border-slate-800' : 'border-white'
                )}>
                  <div className="absolute inset-0 w-full h-full rounded-full bg-emerald-500 animate-ping opacity-20"></div>
                </div>
              </div>
            </div>
            
            {!collapsed && (
              <>
                <div className="ml-4 flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className={classNames(
                      'text-base font-bold transition-colors truncate',
                      darkMode ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'
                    )}>
                      {user?.username || 'Unknown User'}
                    </p>
                    <div className={classNames(
                      'px-2 py-0.5 rounded-full text-xs font-semibold',
                      'bg-gradient-to-r from-blue-500/20 to-purple-500/20',
                      darkMode ? 'text-blue-400' : 'text-blue-600'
                    )}>
                      ADMIN
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <p className={classNames(
                      'text-xs transition-colors',
                      darkMode ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-400'
                    )}>
                      #{user?.discriminator || '0000'}
                    </p>
                    <span className={classNames(
                      'w-1 h-1 rounded-full',
                      darkMode ? 'bg-slate-600' : 'bg-slate-400'
                    )}></span>
                    <p className={classNames(
                      'text-xs font-medium transition-colors',
                      darkMode ? 'text-emerald-400' : 'text-emerald-600'
                    )}>
                      Online
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/settings');
                    }}
                    className={classNames(
                      'p-2.5 rounded-lg transition-all duration-200 group/btn',
                      darkMode 
                        ? 'hover:bg-slate-600/50 text-slate-400 hover:text-blue-400' 
                        : 'hover:bg-slate-200/50 text-slate-500 hover:text-blue-500',
                      'hover:shadow-lg hover:scale-105'
                    )}
                    title="Settings"
                  >
                    <CogIcon className="h-4 w-4 transition-transform duration-200 group-hover/btn:rotate-90" />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogout();
                    }}
                    className={classNames(
                      'p-2.5 rounded-lg transition-all duration-200 group/btn',
                      darkMode 
                        ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400' 
                        : 'hover:bg-red-50 text-slate-500 hover:text-red-500',
                      'hover:shadow-lg hover:scale-105'
                    )}
                    title="Logout"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                  </button>
                </div>
              </>
            )}
            
            {/* Hover glow effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;