import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import ErrorBoundary from './components/common/ErrorBoundary';

// Import global settings CSS
import './styles/global-settings.css';
import { wsService } from './services/websocket';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Warnings from './pages/Warnings';
import Tickets from './pages/Tickets';
import Servers from './pages/Servers';
import ServerDetail from './pages/ServerDetail';
import Members from './pages/Members';
import LoadingSpinner from './components/common/LoadingSpinner';
import Logs from './pages/Logs';
import Profile from './pages/Profile';
import DashboardLogs from './pages/DashboardLogs';
import ServerLogs from './pages/ServerLogs';
import Admin from './pages/Admin';
import NoPermissions from './pages/NoPermissions';
import { Analytics } from './pages/Analytics';
import ServerSettings from './pages/ServerSettings';
import AdvancedServerSettings from './pages/AdvancedServerSettings';
import GeneralSettings from './pages/settings/GeneralSettings';
import ModerationSettings from './pages/settings/ModerationSettings';
import WelcomeSettings from './pages/settings/WelcomeSettings';
import RoleSettings from './pages/settings/RoleSettings';
import EconomySettings from './pages/settings/EconomySettings';
import LevelingSettings from './pages/settings/LevelingSettings';
import Leveling from './pages/Leveling';
// Fix import for Settings component
const Settings = React.lazy(() => import('./pages/Settings'));


// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading, permissions } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has any dashboard permissions
  const hasAnyDashboardPermissions = permissions.length > 0;
  
  if (!hasAnyDashboardPermissions) {
    return <NoPermissions />;
  }

  return <>{children}</>;
};

// App Routes Component
const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  React.useEffect(() => {
    if (isAuthenticated) {
      // Connect to WebSocket when authenticated
      wsService.connect();
    } else {
      // Disconnect when not authenticated
      wsService.disconnect();
    }

    return () => {
      wsService.disconnect();
    };
  }, [isAuthenticated]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/servers" element={<Servers />} />
                <Route path="/servers/:serverId" element={<ServerDetail />} />
                <Route path="/servers/:serverId/members" element={<Members />} />
                <Route path="/servers/:serverId/logs" element={<ServerLogs />} />
                <Route path="/servers/:serverId/settings" element={<ServerSettings />} />
                <Route path="/servers/:serverId/settings/advanced" element={<AdvancedServerSettings />} />
                <Route path="/servers/:serverId/settings/general" element={<GeneralSettings />} />
                <Route path="/servers/:serverId/settings/moderation" element={<ModerationSettings />} />
                <Route path="/servers/:serverId/settings/welcome" element={<WelcomeSettings />} />
                <Route path="/servers/:serverId/settings/roles" element={<RoleSettings />} />
                <Route path="/servers/:serverId/settings/economy" element={<EconomySettings />} />
                <Route path="/servers/:serverId/settings/leveling" element={<LevelingSettings />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/warnings" element={<Warnings />} />
                <Route path="/leveling" element={<Leveling />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/servers/:serverId/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/dashboard-logs" element={<DashboardLogs />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

// Settings Applier Component - applies theme and modern settings
const SettingsApplier: React.FC = () => {
  const { settings } = useSettings();
  const { darkMode } = useTheme();

  // Apply settings immediately on load
  React.useEffect(() => {
    // Apply font size scaling immediately
    const root = document.documentElement;
    const fontSizeMap = {
      small: '0.9',
      medium: '1.0', 
      large: '1.1'
    };
    
    const scale = fontSizeMap[settings.fontSize] || '1.0';
    root.style.setProperty('--font-scale', scale);
    
    // Apply primary color immediately
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    const rgb = hexToRgb(settings.primaryColor);
    if (rgb) {
      root.style.setProperty('--primary-color', settings.primaryColor);
      root.style.setProperty('--primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }
    
    // Apply other settings
    const body = document.body;
    if (settings.animationsEnabled) {
      body.classList.remove('no-animations');
    } else {
      body.classList.add('no-animations');
    }
    
    if (settings.compactMode) {
      body.classList.add('compact-mode');
    } else {
      body.classList.remove('compact-mode');
    }
  }, [settings.animationsEnabled, settings.compactMode, settings.fontSize, settings.primaryColor]);

  React.useEffect(() => {
    // Apply dark mode classes to all necessary elements
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    
    if (darkMode) {
      html.classList.add('dark');
      body.classList.add('dark');
      if (root) root.classList.add('dark');
      // Apply dark mode CSS variables
      html.style.setProperty('--bg-primary', 'var(--dark-bg)');
      html.style.setProperty('--bg-secondary', 'var(--dark-surface)');
      html.style.setProperty('--text-primary', 'var(--dark-text)');
      html.style.setProperty('--text-secondary', 'var(--dark-text-muted)');
      html.style.setProperty('--border-color', 'var(--dark-border)');
    } else {
      html.classList.remove('dark');
      body.classList.remove('dark');
      if (root) root.classList.remove('dark');
      // Apply light mode CSS variables
      html.style.setProperty('--bg-primary', 'white');
      html.style.setProperty('--bg-secondary', 'var(--gray-50)');
      html.style.setProperty('--text-primary', 'var(--gray-900)');
      html.style.setProperty('--text-secondary', 'var(--gray-600)');
      html.style.setProperty('--border-color', 'var(--gray-200)');
    }
  }, [darkMode]);

  React.useEffect(() => {
    // Apply primary color CSS variables
    const root = document.documentElement;
    
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    const rgb = hexToRgb(settings.primaryColor);
    if (rgb) {
      root.style.setProperty('--primary-color', settings.primaryColor);
      root.style.setProperty('--primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }
  }, [settings.primaryColor]);

  React.useEffect(() => {
    // Apply animations setting
    const body = document.body;
    if (settings.animationsEnabled) {
      body.classList.remove('no-animations');
    } else {
      body.classList.add('no-animations');
    }
  }, [settings.animationsEnabled]);

  React.useEffect(() => {
    // Apply modern compact mode
    const body = document.body;
    if (settings.compactMode) {
      body.classList.add('compact-mode');
    } else {
      body.classList.remove('compact-mode');
    }
  }, [settings.compactMode]);

  React.useEffect(() => {
    // Apply font size scaling
    const root = document.documentElement;
    const fontSizeMap = {
      small: '0.9',
      medium: '1.0', 
      large: '1.1'
    };
    
    const scale = fontSizeMap[settings.fontSize] || '1.0';
    root.style.setProperty('--font-scale', scale);
  }, [settings.fontSize]);

  return null;
};

function App() {
  // Set the document title when the app loads
  React.useEffect(() => {
    document.title = 'PanelOps - Modern Dashboard';
  }, []);
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <Router>
              <div className="App app-container">
                <SettingsApplier />
                <AppRoutes />
                <Toaster 
                position="top-center" 
                containerStyle={{
                  position: 'fixed',
                  top: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 999999,
                  pointerEvents: 'none',
                }}
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                    fontWeight: '500',
                    borderRadius: '12px',
                    border: '1px solid #4f4f4f',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
                    zIndex: 999999,
                    pointerEvents: 'auto',
                    minWidth: '300px',
                    maxWidth: '500px',
                    padding: '16px 20px',
                    fontSize: '14px',
                    backdropFilter: 'blur(10px)',
                  },
                  success: {
                    duration: 2500,
                    style: {
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#fff',
                      border: '1px solid #10B981',
                    },
                    iconTheme: {
                      primary: '#fff',
                      secondary: '#10B981',
                    },
                  },
                  error: {
                    duration: 4000,
                    style: {
                      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                      color: '#fff',
                      border: '1px solid #EF4444',
                    },
                    iconTheme: {
                      primary: '#fff',
                      secondary: '#EF4444',
                    },
                  },
                  loading: {
                    style: {
                      background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                      color: '#fff',
                      border: '1px solid #3B82F6',
                    },
                    iconTheme: {
                      primary: '#fff',
                      secondary: '#3B82F6',
                    },
                  },
                }}
                />
              </div>
            </Router>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
