import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  TicketIcon,
  ExclamationTriangleIcon,
  CogIcon,
  ServerIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon
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
  children?: NavigationItem[];
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, isMobile = false }) => {
  const { user, permissions, logout } = useAuth();
  const { darkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [connectionStatus, setConnectionStatus] = React.useState(wsService.isConnected());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['dashboard']));

  React.useEffect(() => {
    const checkConnection = () => {
      setConnectionStatus(wsService.isConnected());
    };

    const interval = setInterval(checkConnection, 1000);
    return () => clearInterval(interval);
  }, []);

  const navigationSections: NavigationSection[] = [
    {
      title: 'Dashboard',
      items: [
        { name: 'Overview', href: '/', icon: HomeIcon, permission: 'view_dashboard', emoji: '📊' },
        { name: 'Analytics', href: '/analytics', icon: ClipboardDocumentListIcon, permission: 'view_analytics', emoji: '📈' },
      ]
    },
    {
      title: 'Server Management',
      items: [
        { name: 'All Servers', href: '/servers', icon: ServerIcon, permission: 'view_dashboard', emoji: '🖥️' },
        { name: 'Tickets', href: '/tickets', icon: TicketIcon, permission: 'view_tickets', emoji: '🎫' },
        { name: 'Warnings', href: '/warnings', icon: ExclamationTriangleIcon, permission: 'view_warnings', emoji: '⚠️' },
      ]
    },
    {
      title: 'Administration',
      items: [
        { name: 'Admin Panel', href: '/admin', icon: ShieldCheckIcon, permission: 'admin', emoji: '👑' },
        { name: 'Dashboard Logs', href: '/dashboard-logs', icon: ClipboardDocumentListIcon, permission: 'view_logs', emoji: '📋' },
      ]
    },
    {
      title: 'Personal',
      items: [
        { name: 'Settings', href: '/settings', icon: CogIcon, emoji: '⚙️' },
        { name: 'Profile', href: '/profile', icon: UserCircleIcon, emoji: '👤' },
      ]
    },
  ];

  const hasPermission = (permission?: string): boolean => {
    if (!permission) return true;
    return permissions.includes(permission);
  };

  const toggleSection = (sectionTitle: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionTitle)) {
      newExpanded.delete(sectionTitle);
    } else {
      newExpanded.add(sectionTitle);
    }
    setExpandedSections(newExpanded);
  };

  const filteredSections = navigationSections.map(section => ({
    ...section,
    items: section.items.filter(item => hasPermission(item.permission))
  })).filter(section => section.items.length > 0);

  const allItems = filteredSections.flatMap(section => section.items);
  const filteredItems = searchQuery 
    ? allItems.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

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
        'fixed left-0 top-0 h-full z-50 flex flex-col border-r transition-all duration-300 shadow-xl',
        collapsed ? 'w-16' : 'w-72',
        isMobile && collapsed ? '-translate-x-full' : 'translate-x-0',
        darkMode 
          ? 'bg-gray-900 border-gray-700' 
          : 'bg-white border-gray-200'
      )}>
        {/* Header */}
        <div className={classNames(
          'relative h-16 flex items-center border-b',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
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
              <div className={classNames(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                darkMode ? "bg-primary-600" : "bg-primary-600"
              )}>
                <span className="font-bold text-sm text-white">D</span>
              </div>
            ) : (
              <Logo size="sm" />
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

        {/* Search Bar */}
        {!collapsed && (
          <div className={classNames(
            'px-4 py-3 border-b',
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
          )}>
            <div className="relative">
              <MagnifyingGlassIcon className={classNames(
                'absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4',
                darkMode ? 'text-gray-400' : 'text-gray-500'
              )} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={classNames(
                  'w-full pl-10 pr-3 py-2 text-sm rounded-lg border transition-colors',
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-primary-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-primary-500',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                )}
              />
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center justify-between mt-3 text-xs">
              <div className="flex items-center">
                <div className={classNames(
                  'w-2 h-2 rounded-full mr-2',
                  connectionStatus 
                    ? 'bg-green-500' 
                    : 'bg-red-500'
                )}></div>
                <span className={classNames(
                  'font-medium',
                  connectionStatus 
                    ? darkMode ? 'text-green-400' : 'text-green-600'
                    : darkMode ? 'text-red-400' : 'text-red-600'
                )}>
                  {connectionStatus ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed Connection Indicator */}
        {collapsed && (
          <div className={classNames(
            'px-2 py-3 border-b flex justify-center',
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
          )}>
            <div className={classNames(
              'w-2 h-2 rounded-full',
              connectionStatus 
                ? 'bg-green-500' 
                : 'bg-red-500'
            )}></div>
          </div>
        )}

        {/* Navigation */}
        <nav className={classNames(
          'flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent',
          collapsed ? 'px-2 py-4' : 'px-3 py-4'
        )}>
          {searchQuery ? (
            /* Search Results */
            <div className="space-y-1">
              {filteredItems?.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={classNames(
                      'group flex items-center text-sm font-medium rounded-lg transition-all duration-200',
                      collapsed ? 'px-2 py-3 justify-center' : 'px-3 py-2.5',
                      isActive
                        ? darkMode 
                          ? 'bg-primary-600 text-white shadow-lg' 
                          : 'bg-primary-600 text-white shadow-lg'
                        : darkMode 
                          ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )}
                    title={collapsed ? item.name : undefined}
                    onClick={() => setSearchQuery('')}
                  >
                    <div className={classNames(
                      'flex items-center justify-center rounded-md transition-colors',
                      collapsed ? 'w-8 h-8' : 'w-6 h-6 mr-3',
                      isActive 
                        ? 'text-white' 
                        : darkMode 
                          ? 'text-gray-400 group-hover:text-gray-300'
                          : 'text-gray-500 group-hover:text-gray-600'
                    )}>
                      <item.icon className={collapsed ? "h-5 w-5" : "h-4 w-4"} />
                    </div>
                    
                    {!collapsed && (
                      <span className="flex-1">{item.name}</span>
                    )}
                  </NavLink>
                );
              })}
              {filteredItems?.length === 0 && (
                <div className={classNames(
                  'px-3 py-6 text-center text-sm',
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                )}>
                  No results found
                </div>
              )}
            </div>
          ) : (
            /* Grouped Navigation */
            <div className="space-y-6">
              {filteredSections.map((section) => (
                <div key={section.title}>
                  {!collapsed && (
                    <button
                      onClick={() => toggleSection(section.title)}
                      className={classNames(
                        'w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                        darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'
                      )}
                    >
                      <span>{section.title}</span>
                      {expandedSections.has(section.title) ? (
                        <ChevronDownIcon className="h-3 w-3" />
                      ) : (
                        <ChevronRightIcon className="h-3 w-3" />
                      )}
                    </button>
                  )}
                  
                  <div className={classNames(
                    'space-y-1 transition-all duration-200',
                    !collapsed && !expandedSections.has(section.title) ? 'h-0 overflow-hidden opacity-0' : 'h-auto opacity-100'
                  )}>
                    {section.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <NavLink
                          key={item.name}
                          to={item.href}
                          className={classNames(
                            'group flex items-center text-sm font-medium rounded-lg transition-all duration-200',
                            collapsed ? 'px-2 py-3 justify-center mb-2' : 'px-3 py-2.5 ml-2',
                            isActive
                              ? darkMode 
                                ? 'bg-primary-600 text-white shadow-lg' 
                                : 'bg-primary-600 text-white shadow-lg'
                              : darkMode 
                                ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          )}
                          title={collapsed ? item.name : undefined}
                        >
                          <div className={classNames(
                            'flex items-center justify-center rounded-md transition-colors',
                            collapsed ? 'w-8 h-8' : 'w-6 h-6 mr-3',
                            isActive 
                              ? 'text-white' 
                              : darkMode 
                                ? 'text-gray-400 group-hover:text-gray-300'
                                : 'text-gray-500 group-hover:text-gray-600'
                          )}>
                            <item.icon className={collapsed ? "h-5 w-5" : "h-4 w-4"} />
                          </div>
                          
                          {!collapsed && (
                            <>
                              <span className="flex-1">{item.name}</span>
                              {item.badge && (
                                <span className={classNames(
                                  "ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full",
                                  isActive
                                    ? "bg-white/20 text-white"
                                    : darkMode 
                                      ? "bg-red-600 text-white" 
                                      : "bg-red-500 text-white"
                                )}>
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* User Profile */}
        <div className={classNames(
          'flex-shrink-0 border-t',
          collapsed ? 'px-2 py-3' : 'px-4 py-4',
          darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
        )}>
          <div className={classNames(
            'flex items-center rounded-lg transition-colors group cursor-pointer',
            collapsed ? 'justify-center p-2' : 'p-3',
            darkMode 
              ? 'hover:bg-gray-700' 
              : 'hover:bg-gray-100'
          )}
          onClick={() => navigate('/profile')}
          >
            <div className="flex-shrink-0 relative">
              <img
                className={classNames(
                  'rounded-full border-2 transition-colors',
                  collapsed ? 'h-8 w-8' : 'h-10 w-10',
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
                'absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full border-2',
                collapsed ? 'w-3 h-3' : 'w-3 h-3',
                darkMode ? 'border-gray-800' : 'border-gray-50'
              )}></div>
            </div>
            
            {!collapsed && (
              <div className="ml-3 flex-1 min-w-0">
                <p className={classNames(
                  'text-sm font-semibold transition-colors truncate',
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
            
            {!collapsed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                className={classNames(
                  'p-2 rounded-lg transition-colors',
                  darkMode 
                    ? 'hover:bg-gray-600 text-gray-400 hover:text-red-400' 
                    : 'hover:bg-gray-200 text-gray-500 hover:text-red-500'
                )}
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;