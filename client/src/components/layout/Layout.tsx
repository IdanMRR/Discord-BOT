import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
        return {
          title: 'Control Center',
          subtitle: 'Real-time system monitoring and management dashboard',
          icon: '📊'
        };
      case '/servers':
        return {
          title: 'Server Management',
          subtitle: 'Configure and monitor Discord server environments',
          icon: '🖥️'
        };
      case '/tickets':
        return {
          title: 'Support System',
          subtitle: 'Advanced ticket management and user support tools',
          icon: '🎫'
        };
      case '/warnings':
        return {
          title: 'Moderation Hub',
          subtitle: 'User warnings, violations, and enforcement actions',
          icon: '⚠️'
        };
      case '/logs':
        return {
          title: 'System Logs',
          subtitle: 'Comprehensive activity monitoring and audit trails',
          icon: '📝'
        };
      case '/dashboard-logs':
        return {
          title: 'Dashboard Analytics',
          subtitle: 'User activity tracking and dashboard usage metrics',
          icon: '📈'
        };
      case '/analytics':
        return {
          title: 'Advanced Analytics',
          subtitle: 'Deep insights and performance metrics analysis',
          icon: '📊'
        };
      case '/settings':
        return {
          title: 'System Configuration',
          subtitle: 'Global settings and system preferences',
          icon: '⚙️'
        };
      case '/profile':
        return {
          title: 'User Profile',
          subtitle: 'Account settings and personal preferences',
          icon: '👤'
        };
      default:
        return {
          title: 'Management Platform',
          subtitle: 'Professional Discord bot administration suite',
          icon: '🚀'
        };
    }
  };

  const { title, subtitle, icon } = getPageInfo();

  return (
    <div className="page-container flex h-screen w-screen transition-all duration-300">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-0 transition-all duration-500 ease-in-out ${
        sidebarCollapsed ? 'ml-20' : 'ml-80'
      }`}>
        {/* Modern Header */}
        <Header
          title={title}
          subtitle={subtitle}
          icon={icon}
          sidebarCollapsed={sidebarCollapsed}
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Page Content with Enhanced Styling - Flex-1 to fill remaining space */}
        <main className="flex-1 min-h-0 relative bg-background">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.1\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'2\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />

          {/* Scrollable Content Container - Full height flex */}
          <div className="relative z-10 w-full h-full flex flex-col">
            <div className="flex-1 overflow-y-auto overflow-x-hidden main-content-scroll w-full h-full">
              <div className="container mx-auto px-6 py-8 space-y-8 min-h-full">
                {/* Page Content */}
                <div className="content-area transition-all duration-300">
                  <div className="p-8">
                    {children}
                    <Outlet />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
    </div>
  );
};

export default Layout;
