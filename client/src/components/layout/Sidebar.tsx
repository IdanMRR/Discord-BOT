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
import { wsService } from '../../services/websocket';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        'fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-500 ease-in-out shadow-2xl',
        'bg-sidebar border-r border-sidebar-border',
        collapsed ? 'w-20' : 'w-72',
        isMobile && collapsed ? '-translate-x-full' : 'translate-x-0'
      )}>
        {/* Header */}
        <div className={classNames(
          'relative h-20 flex items-center backdrop-blur-sm border-b border-sidebar-border bg-sidebar',
          collapsed ? 'justify-center px-3' : 'justify-between px-6'
        )}>
          <div className="flex items-center">
            {isMobile && (
              <button
                onClick={onToggle}
                className="p-2 mr-2 rounded-lg transition-colors lg:hidden hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
            )}
            
            {collapsed ? (
              <div className="relative group">
                <div className={classNames(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                  "bg-gradient-to-br from-sidebar-primary via-primary to-sidebar-primary",
                  "shadow-lg shadow-sidebar-primary/25 group-hover:shadow-xl group-hover:shadow-sidebar-primary/40",
                  "border border-sidebar-primary/30 group-hover:border-sidebar-primary/50",
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
                <div className="absolute -inset-1 bg-gradient-to-r from-sidebar-primary to-primary rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="relative group">
                  <div className={classNames(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                    "bg-gradient-to-br from-sidebar-primary via-primary to-sidebar-primary",
                    "shadow-lg shadow-sidebar-primary/25 group-hover:shadow-xl group-hover:shadow-sidebar-primary/40",
                    "border border-sidebar-primary/30 group-hover:border-sidebar-primary/50"
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
                  <div className="absolute -inset-1 bg-gradient-to-r from-sidebar-primary to-primary rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-sidebar-primary to-primary bg-clip-text text-transparent tracking-tight">
                    PanelOps
                  </h1>
                  <p className="text-xs font-medium text-sidebar-foreground/70">
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
              className="p-1.5 rounded-lg transition-colors hidden lg:block hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Connection Status */}
        <div className={classNames(
          'border-b backdrop-blur-sm border-sidebar-border bg-sidebar/30',
          collapsed ? 'px-3 py-4' : 'px-6 py-4'
        )}>
          <div className={classNames(
            'flex items-center',
            collapsed ? 'justify-center' : 'space-x-3'
          )}>
            <div className="relative">
              <div className={classNames(
                'w-3 h-3 rounded-full transition-all duration-300',
                connectionStatus 
                  ? 'bg-success shadow-lg shadow-success/50' 
                  : 'bg-destructive shadow-lg shadow-destructive/50'
              )}></div>
              {connectionStatus && (
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-success animate-ping opacity-20"></div>
              )}
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className={classNames(
                  'text-xs font-semibold tracking-wide',
                  connectionStatus 
                    ? 'text-success'
                    : 'text-destructive'
                )}>
                  {connectionStatus ? 'ONLINE' : 'OFFLINE'}
                </span>
                <span className="text-xs opacity-75 text-sidebar-foreground/70">
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
                <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest mb-2 text-sidebar-foreground/50">
                  <div className="flex items-center space-x-2">
                    <div className="w-1 h-3 rounded-full bg-gradient-to-b from-sidebar-primary to-primary"></div>
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
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg' 
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-md'
                      )}
                      title={collapsed ? item.name : undefined}
                    >
                      {/* Active state background gradient */}
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-sidebar-primary/20 via-primary/20 to-sidebar-primary/20 rounded-lg blur-sm"></div>
                      )}
                      
                      <div className={classNames(
                        'flex items-center justify-center rounded-md transition-all duration-300 relative z-10',
                        collapsed ? 'w-8 h-8' : 'w-6 h-6 mr-3',
                        isActive 
                          ? 'text-sidebar-primary-foreground bg-white/10' 
                          : 'text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground'
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
                        !isActive ? 'bg-gradient-to-r from-sidebar-primary/5 via-primary/5 to-sidebar-primary/5' : ''
                      )}></div>
                    </NavLink>
                  );
                })}
              </div>
            </div>

            {/* Gap/Divider */}
            <div className="border-t border-sidebar-border/30"></div>

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
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg' 
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-md'
                      )}
                      title={collapsed ? item.name : undefined}
                    >
                      {/* Active state background gradient */}
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-sidebar-primary/20 via-primary/20 to-sidebar-primary/20 rounded-lg blur-sm"></div>
                      )}
                      
                      <div className={classNames(
                        'flex items-center justify-center rounded-md transition-all duration-300 relative z-10',
                        collapsed ? 'w-8 h-8' : 'w-6 h-6 mr-3',
                        isActive 
                          ? 'text-sidebar-primary-foreground bg-white/10' 
                          : 'text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground'
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
                        !isActive ? 'bg-gradient-to-r from-sidebar-primary/5 via-primary/5 to-sidebar-primary/5' : ''
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
          'flex-shrink-0 border-t backdrop-blur-sm relative border-sidebar-border/30 bg-sidebar/30',
          collapsed ? 'px-3 py-4' : 'px-6 py-5'
        )}>
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-sidebar-primary/5 via-transparent to-transparent opacity-50"></div>
          
          <div className={classNames(
            'flex items-center rounded-xl transition-all duration-300 group cursor-pointer relative z-10',
            collapsed ? 'justify-center p-3' : 'p-4',
            'hover:bg-gradient-to-r hover:from-sidebar-primary/10 hover:via-primary/10 hover:to-sidebar-primary/10',
            'hover:backdrop-blur-sm hover:shadow-lg hover:shadow-sidebar-primary/10'
          )}
          onClick={() => navigate('/profile')}
          >
            <div className="flex-shrink-0 relative">
              <div className="relative">
                <img
                  className={classNames(
                    'rounded-full border-3 transition-all duration-300',
                    collapsed ? 'h-12 w-12' : 'h-14 w-14',
                    'border-gradient-to-r from-sidebar-primary via-primary to-sidebar-primary',
                    'group-hover:shadow-lg group-hover:shadow-sidebar-primary/25 group-hover:scale-105'
                  )}
                  style={{
                    border: '3px solid',
                    borderImage: 'linear-gradient(45deg, var(--sidebar-primary), var(--primary), var(--sidebar-primary)) 1'
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
                  'bg-success shadow-lg shadow-success/50 border-sidebar'
                )}>
                  <div className="absolute inset-0 w-full h-full rounded-full bg-success animate-ping opacity-20"></div>
                </div>
              </div>
            </div>
            
            {!collapsed && (
              <>
                <div className="ml-4 flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-base font-bold transition-colors truncate text-sidebar-foreground group-hover:text-sidebar-primary">
                      {user?.username || 'Unknown User'}
                    </p>
                    <div className={classNames(
                      'px-2 py-0.5 rounded-full text-xs font-semibold',
                      'bg-gradient-to-r from-sidebar-primary/20 to-primary/20 text-sidebar-primary'
                    )}>
                      ADMIN
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <p className="text-xs transition-colors text-sidebar-foreground/70 group-hover:text-sidebar-foreground">
                      #{user?.discriminator || '0000'}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-sidebar-border"></span>
                    <p className="text-xs font-medium transition-colors text-success">
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
                    className="p-2.5 rounded-lg transition-all duration-200 group/btn hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-primary hover:shadow-lg hover:scale-105"
                    title="Settings"
                  >
                    <CogIcon className="h-4 w-4 transition-transform duration-200 group-hover/btn:rotate-90" />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogout();
                    }}
                    className="p-2.5 rounded-lg transition-all duration-200 group/btn hover:bg-destructive/20 text-sidebar-foreground/70 hover:text-destructive hover:shadow-lg hover:scale-105"
                    title="Logout"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                  </button>
                </div>
              </>
            )}
            
            {/* Hover glow effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-sidebar-primary/10 via-primary/10 to-sidebar-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;