import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { wsService } from '../../services/websocket';
import { useNavigate } from 'react-router-dom';
import Logo from '../common/Logo';
import {
  BellIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  SparklesIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  title, 
  subtitle, 
  icon, 
  sidebarCollapsed, 
  onSidebarToggle 
}) => {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    // Listen for real-time notifications
    const unsubscribe = wsService.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
      setUnreadCount(prev => prev + 1);
    });

    return unsubscribe;
  }, []);

  const handleLogout = () => {
    logout();
    wsService.disconnect();
  };

  const markNotificationsAsRead = () => {
    setUnreadCount(0);
  };

  return (
    <header className={classNames(
      'relative backdrop-blur-xl top-0 z-40 transition-all duration-500 border-b',
      darkMode 
        ? 'bg-gradient-to-r from-gray-900/95 via-gray-800/95 to-gray-900/95 border-gray-700/50 shadow-2xl shadow-blue-500/5' 
        : 'bg-gradient-to-r from-white/95 via-gray-50/95 to-white/95 border-gray-200/50 shadow-2xl shadow-blue-500/10'
    )}>
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={classNames(
          "absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-20 animate-pulse",
          darkMode ? "bg-blue-500" : "bg-blue-400"
        )} style={{ animationDuration: '4s' }}></div>
        <div className={classNames(
          "absolute -top-40 -left-40 w-80 h-80 rounded-full blur-3xl opacity-20 animate-pulse",
          darkMode ? "bg-purple-500" : "bg-purple-400"
        )} style={{ animationDuration: '6s', animationDelay: '2s' }}></div>
      </div>

      <div className="relative px-6 py-5">
        <div className="flex items-center justify-between">
          {/* Left Section - Logo, Sidebar Toggle, and Title */}
          <div className="flex items-center space-x-6">
            {/* Collapsed Sidebar Toggle (appears when sidebar is collapsed) */}
            {sidebarCollapsed && (
              <button
                onClick={onSidebarToggle}
                className={classNames(
                  'p-3 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-lg',
                  darkMode 
                    ? 'bg-gray-800/80 hover:bg-gray-700/80 text-gray-300 hover:text-white' 
                    : 'bg-white/80 hover:bg-gray-50/80 text-gray-600 hover:text-gray-900'
                )}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
            )}

            {/* Mobile Sidebar Toggle (visible on smaller screens) */}
            <button
              onClick={onSidebarToggle}
              className={classNames(
                'lg:hidden p-3 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-lg',
                darkMode 
                  ? 'bg-gray-800/80 hover:bg-gray-700/80 text-gray-300 hover:text-white' 
                  : 'bg-white/80 hover:bg-gray-50/80 text-gray-600 hover:text-gray-900'
              )}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>

            {/* Enhanced Logo (only when sidebar is collapsed on desktop) */}
            {sidebarCollapsed && (
              <div className="hidden lg:block relative group">
                <div className={classNames(
                  "absolute inset-0 rounded-2xl blur transition-all duration-300 opacity-0 group-hover:opacity-30",
                  darkMode ? "bg-gradient-to-r from-blue-400 to-purple-400" : "bg-gradient-to-r from-blue-500 to-purple-500"
                )}></div>
                <div className={classNames(
                  "relative p-3 rounded-2xl transition-all duration-300 transform group-hover:scale-110 group-hover:rotate-3 shadow-lg",
                  darkMode 
                    ? "bg-gradient-to-br from-gray-800 to-gray-700 ring-1 ring-gray-600" 
                    : "bg-gradient-to-br from-white to-gray-100 ring-1 ring-gray-200"
                )}>
                  <Logo size="sm" />
                </div>
              </div>
            )}

            {/* Enhanced Title Section */}
            <div className="relative group">
              <div className="flex flex-col">
                <h1 className={classNames(
                  'text-2xl lg:text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent transition-all duration-500 flex items-center gap-3',
                  darkMode 
                    ? 'from-white via-blue-200 to-purple-200 group-hover:from-blue-300 group-hover:via-purple-300 group-hover:to-pink-300' 
                    : 'from-gray-900 via-blue-700 to-purple-700 group-hover:from-blue-600 group-hover:via-purple-600 group-hover:to-pink-600'
                )}>
                  {icon && (
                    <span className="text-3xl lg:text-4xl filter drop-shadow-lg animate-pulse">
                      {icon}
                    </span>
                  )}
                  <span className="font-extrabold tracking-tight">{title}</span>
                  <SparklesIcon className={classNames(
                    "h-6 w-6 lg:h-7 lg:w-7 transition-all duration-300 group-hover:rotate-12",
                    darkMode ? "text-yellow-400" : "text-yellow-500"
                  )} />
                </h1>
                {subtitle && (
                  <p className={classNames(
                    'text-sm lg:text-base font-medium transition-all duration-300 mt-1 max-w-md',
                    darkMode 
                      ? 'text-gray-400 group-hover:text-gray-300' 
                      : 'text-gray-600 group-hover:text-gray-500'
                  )}>{subtitle}</p>
                )}
              </div>
              {/* Enhanced gradient line */}
              <div className={classNames(
                'absolute -bottom-2 left-0 h-1 bg-gradient-to-r rounded-full transition-all duration-700 opacity-60',
                darkMode ? 'from-blue-400 via-purple-400 to-pink-400' : 'from-blue-500 via-purple-500 to-pink-500',
                'w-0 group-hover:w-full'
              )}></div>
            </div>
          </div>

          {/* Enhanced Actions Section */}
          <div className="flex items-center space-x-3 lg:space-x-4">
            {/* Desktop Sidebar Toggle */}
            <button
              onClick={onSidebarToggle}
              className={classNames(
                'hidden lg:flex p-3 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-lg items-center space-x-2',
                darkMode 
                  ? 'bg-gray-800/80 hover:bg-gray-700/80 text-gray-300 hover:text-white' 
                  : 'bg-white/80 hover:bg-gray-50/80 text-gray-600 hover:text-gray-900'
              )}
            >
              <Bars3Icon className="h-5 w-5" />
              <span className="text-sm font-medium hidden xl:block">
                {sidebarCollapsed ? 'Expand' : 'Collapse'}
              </span>
            </button>

            {/* Enhanced Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className={classNames(
                'relative p-3 rounded-xl transition-all duration-300 ease-in-out transform hover:scale-110 active:scale-95 group overflow-hidden',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-lg',
                darkMode 
                  ? 'bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 text-gray-900 hover:from-yellow-300 hover:via-orange-300 hover:to-red-300 focus:ring-yellow-400 shadow-yellow-400/30'
                  : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white hover:from-indigo-400 hover:via-purple-400 hover:to-pink-400 focus:ring-purple-400 shadow-purple-500/30'
              )}
              aria-label="Toggle dark mode"
            >
              {/* Glowing background effect */}
              <div className={classNames(
                "absolute inset-0 transition-opacity duration-300 opacity-0 group-hover:opacity-30 blur-xl",
                darkMode ? "bg-yellow-400" : "bg-purple-500"
              )}></div>
              <div className="relative">
                {darkMode ? (
                  <SunIcon className="h-5 w-5 transform transition-transform duration-300 rotate-0 group-hover:rotate-180" aria-hidden="true" />
                ) : (
                  <MoonIcon className="h-5 w-5 transform transition-transform duration-300 rotate-0 group-hover:-rotate-180" aria-hidden="true" />
                )}
              </div>
            </button>

            {/* Enhanced Notifications */}
            <Menu as="div" className="relative">
              <Menu.Button
                className={classNames(
                  'relative p-3 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 group overflow-hidden',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-lg',
                  darkMode 
                    ? 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white hover:from-blue-400 hover:via-indigo-400 hover:to-purple-500 focus:ring-blue-400 shadow-blue-500/30'
                    : 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white hover:from-blue-400 hover:via-indigo-400 hover:to-purple-500 focus:ring-blue-400 shadow-blue-500/30'
                )}
                onClick={markNotificationsAsRead}
              >
                {/* Glowing background effect */}
                <div className="absolute inset-0 bg-blue-400 transition-opacity duration-300 opacity-0 group-hover:opacity-30 blur-xl"></div>
                <div className="relative">
                  <BellIcon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 h-5 w-5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg animate-pulse ring-2 ring-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95 translate-y-2"
                enterTo="transform opacity-100 scale-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="transform opacity-100 scale-100 translate-y-0"
                leaveTo="transform opacity-0 scale-95 translate-y-2"
              >
                <Menu.Items className={classNames(
                  'absolute right-0 z-30 mt-4 w-80 lg:w-96 origin-top-right rounded-2xl shadow-2xl ring-1 focus:outline-none transition-all duration-200 backdrop-blur-xl',
                  darkMode 
                    ? 'bg-gray-800/95 ring-gray-700/50' 
                    : 'bg-white/95 ring-gray-200/50'
                )}>
                  <div className="p-2">
                    <div className={classNames(
                      'px-4 py-3 border-b rounded-t-xl',
                      darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50/50'
                    )}>
                      <h3 className={classNames(
                        'text-sm font-semibold flex items-center',
                        darkMode ? 'text-white' : 'text-gray-900'
                      )}>
                        <BellIcon className="h-4 w-4 mr-2" />
                        Notifications
                      </h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification, index) => (
                          <Menu.Item key={index}>
                            {({ active }) => (
                              <div className={classNames(
                                'px-4 py-3 transition-all duration-200',
                                active 
                                  ? darkMode ? 'bg-gray-700/50' : 'bg-gray-100/50'
                                  : 'transparent'
                              )}>
                                <p className={classNames(
                                  'text-sm font-medium',
                                  darkMode ? 'text-white' : 'text-gray-900'
                                )}>{notification.title}</p>
                                <p className={classNames(
                                  'text-xs mt-1',
                                  darkMode ? 'text-gray-400' : 'text-gray-600'
                                )}>{notification.message}</p>
                              </div>
                            )}
                          </Menu.Item>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center">
                          <BellIcon className={classNames(
                            'h-8 w-8 mx-auto mb-2 opacity-50',
                            darkMode ? 'text-gray-500' : 'text-gray-400'
                          )} />
                          <p className={classNames(
                            'text-sm',
                            darkMode ? 'text-gray-400' : 'text-gray-600'
                          )}>No notifications</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>

            {/* Enhanced User Menu */}
            <Menu as="div" className="relative">
              <Menu.Button className={classNames(
                'flex items-center p-2 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 group',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-lg',
                darkMode 
                  ? 'bg-gray-800/80 hover:bg-gray-700/80 focus:ring-gray-400' 
                  : 'bg-white/80 hover:bg-gray-50/80 focus:ring-gray-300'
              )}>
                <img
                  className="h-10 w-10 rounded-xl ring-2 ring-offset-2 ring-blue-500 transition-all duration-300 group-hover:ring-purple-500"
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
                <div className="ml-3 hidden lg:block">
                  <p className={classNames(
                    'text-sm font-semibold transition-colors duration-300',
                    darkMode ? 'text-white group-hover:text-blue-400' : 'text-gray-900 group-hover:text-blue-600'
                  )}>
                    {user?.username || 'Unknown'}
                  </p>
                  <p className={classNames(
                    'text-xs transition-colors duration-300',
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  )}>
                    #{user?.discriminator || '0000'}
                  </p>
                </div>
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95 translate-y-2"
                enterTo="transform opacity-100 scale-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="transform opacity-100 scale-100 translate-y-0"
                leaveTo="transform opacity-0 scale-95 translate-y-2"
              >
                <Menu.Items className={classNames(
                  'absolute right-0 z-30 mt-4 w-56 origin-top-right rounded-2xl shadow-2xl ring-1 focus:outline-none backdrop-blur-xl',
                  darkMode 
                    ? 'bg-gray-800/95 ring-gray-700/50' 
                    : 'bg-white/95 ring-gray-200/50'
                )}>
                  <div className="p-2">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => navigate('/profile')}
                          className={classNames(
                            'group flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                            active
                              ? darkMode ? 'bg-gray-700/50 text-white' : 'bg-gray-100/50 text-gray-900'
                              : darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                          )}
                        >
                          <UserIcon className="mr-3 h-5 w-5" aria-hidden="true" />
                          Profile Settings
                        </button>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => navigate('/settings')}
                          className={classNames(
                            'group flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                            active
                              ? darkMode ? 'bg-gray-700/50 text-white' : 'bg-gray-100/50 text-gray-900'
                              : darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                          )}
                        >
                          <Cog6ToothIcon className="mr-3 h-5 w-5" aria-hidden="true" />
                          System Settings
                        </button>
                      )}
                    </Menu.Item>
                    <div className={classNames(
                      'my-2 h-px',
                      darkMode ? 'bg-gray-700/50' : 'bg-gray-200/50'
                    )} />
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleLogout}
                          className={classNames(
                            'group flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                            active
                              ? 'bg-red-500/10 text-red-600'
                              : 'text-red-500 hover:text-red-600'
                          )}
                        >
                          <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5" aria-hidden="true" />
                          Sign Out
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
