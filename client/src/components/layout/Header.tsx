import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTheme as useNewTheme } from '../providers/ThemeProvider';
import { wsService } from '../../services/websocket';
import { useNavigate } from 'react-router-dom';
import Logo from '../common/Logo';
import {
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

// Removed unused classNames function

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
  const { toggleTheme: oldToggleTheme } = useTheme();
  const { isDark, toggleTheme: newToggleTheme } = useNewTheme();
  const navigate = useNavigate();
  // Notification state removed per user request

  // Notification effect removed per user request

  const handleLogout = () => {
    logout();
    wsService.disconnect();
  };

  // Notification handler removed per user request

  return (
    <header className="relative backdrop-blur-xl top-0 z-40 transition-all duration-500 border-b bg-card/95 border-border shadow-2xl">
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-20 animate-pulse bg-primary" style={{ animationDuration: '4s' }}></div>
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full blur-3xl opacity-20 animate-pulse bg-accent" style={{ animationDuration: '6s', animationDelay: '2s' }}></div>
      </div>

      <div className="relative px-6 py-5">
        <div className="flex items-center justify-between">
          {/* Left Section - Logo, Sidebar Toggle, and Title */}
          <div className="flex items-center space-x-6">
            {/* Collapsed Sidebar Toggle (appears when sidebar is collapsed) */}
            {sidebarCollapsed && (
              <button
                onClick={onSidebarToggle}
                className="p-3 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-lg bg-card/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
            )}

            {/* Mobile Sidebar Toggle (visible on smaller screens) */}
            <button
              onClick={onSidebarToggle}
              className="lg:hidden p-3 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-lg bg-card/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>

            {/* Enhanced Logo (only when sidebar is collapsed on desktop) */}
            {sidebarCollapsed && (
              <div className="hidden lg:block relative group">
                <div className="absolute inset-0 rounded-2xl blur transition-all duration-300 opacity-0 group-hover:opacity-30 bg-gradient-to-r from-primary to-accent"></div>
                <div className="relative p-3 rounded-2xl transition-all duration-300 transform group-hover:scale-110 group-hover:rotate-3 shadow-lg bg-gradient-to-br from-card to-muted ring-1 ring-border">
                  <Logo size="sm" />
                </div>
              </div>
            )}

            {/* Enhanced Title Section */}
            <div className="relative group">
              <div className="flex flex-col">
                <h1 className="text-2xl lg:text-3xl font-bold transition-all duration-500 flex items-center gap-3 text-foreground">
                  {icon && (
                    <span className="text-3xl lg:text-4xl filter drop-shadow-lg animate-pulse">
                      {icon}
                    </span>
                  )}
                  <span className="font-extrabold tracking-tight">{title}</span>
                  <SparklesIcon className="h-6 w-6 lg:h-7 lg:w-7 transition-all duration-300 group-hover:rotate-12 text-accent" />
                </h1>
                {subtitle && (
                  <p className="text-sm lg:text-base font-medium transition-all duration-300 mt-1 max-w-md text-muted-foreground group-hover:text-foreground">{subtitle}</p>
                )}
              </div>
              {/* Enhanced gradient line */}
              <div className="absolute -bottom-2 left-0 h-1 bg-gradient-to-r rounded-full transition-all duration-700 opacity-60 from-primary via-accent to-secondary w-0 group-hover:w-full"></div>
            </div>
          </div>

          {/* Enhanced Actions Section */}
          <div className="flex items-center space-x-3 lg:space-x-4">
            {/* Desktop Sidebar Toggle */}
            <button
              onClick={onSidebarToggle}
              className="hidden lg:flex p-3 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-lg items-center space-x-2 bg-card/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            >
              <Bars3Icon className="h-5 w-5" />
              <span className="text-sm font-medium hidden xl:block">
                {sidebarCollapsed ? 'Expand' : 'Collapse'}
              </span>
            </button>

            {/* Enhanced Dark Mode Toggle */}
            <button
              onClick={() => {
                oldToggleTheme();
                newToggleTheme();
              }}
              className="relative p-3 rounded-xl transition-all duration-300 ease-in-out transform hover:scale-110 active:scale-95 group overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-lg bg-gradient-to-br from-accent via-primary to-secondary text-foreground hover:opacity-90 focus:ring-primary"
              aria-label="Toggle dark mode"
            >
              {/* Glowing background effect */}
              <div className="absolute inset-0 transition-opacity duration-300 opacity-0 group-hover:opacity-30 blur-xl bg-primary"></div>
              <div className="relative">
                {isDark ? (
                  <SunIcon className="h-5 w-5 transform transition-transform duration-300 rotate-0 group-hover:rotate-180" aria-hidden="true" />
                ) : (
                  <MoonIcon className="h-5 w-5 transform transition-transform duration-300 rotate-0 group-hover:-rotate-180" aria-hidden="true" />
                )}
              </div>
            </button>

            {/* Notifications removed per user request */}

            {/* Enhanced User Menu */}
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center p-2 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 group focus:outline-none shadow-lg bg-card/80 hover:bg-muted/80">
                <img
className="h-10 w-10 rounded-xl transition-all duration-300"
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
                  <p className="text-sm font-semibold transition-colors duration-300 text-foreground group-hover:text-primary">
                    {user?.username || 'Unknown'}
                  </p>
                  <p className="text-xs transition-colors duration-300 text-muted-foreground">
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
                <Menu.Items className="absolute right-0 z-30 mt-4 w-56 origin-top-right rounded-2xl shadow-2xl ring-1 focus:outline-none backdrop-blur-xl bg-card/95 ring-border">
                  <div className="p-2">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => navigate('/profile')}
                          className={`group flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                            active
                              ? 'bg-muted/50 text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
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
                          className={`group flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                            active
                              ? 'bg-muted/50 text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Cog6ToothIcon className="mr-3 h-5 w-5" aria-hidden="true" />
                          System Settings
                        </button>
                      )}
                    </Menu.Item>
                    <div className="my-2 h-px bg-border" />
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleLogout}
                          className={`group flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                            active
                              ? 'bg-destructive/10 text-destructive'
                              : 'text-destructive hover:text-destructive'
                          }`}
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
