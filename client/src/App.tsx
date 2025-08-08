import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider as OldThemeProvider } from './contexts/ThemeContext';
import { ThemeProvider } from './components/providers/ThemeProvider';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import ToastPortal from './components/common/ToastPortal';



// Import global settings CSS
import './styles/global-settings.css';
import { wsService } from './services/websocket';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LoadingSpinner from './components/common/LoadingSpinner';
import Profile from './pages/Profile';
import DashboardLogs from './pages/DashboardLogs';
import Admin from './pages/Admin';
import NoPermissions from './pages/NoPermissions';
import ServerDashboardLayout from './components/layout/ServerDashboardLayout';
import ServerSelection from './pages/ServerSelection';
import Settings from './pages/Settings';


// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading, permissions } = useAuth();

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center">
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
                {/* Root dashboard - will redirect based on server access */}
                <Route path="/" element={<Dashboard />} />
                
                {/* Server selection page for multi-server users */}
                <Route path="/servers" element={<ServerSelection />} />
                <Route path="/select-server" element={<Navigate to="/servers" replace />} />
                
                {/* Unified server dashboard with all features */}
                <Route path="/server/:serverId/*" element={<ServerDashboardLayout />} />
                
                {/* Legacy routes - redirect to server-scoped equivalents */}
                <Route path="/servers/:serverId" element={<Navigate to="/server/:serverId" replace />} />
                <Route path="/servers/:serverId/*" element={<Navigate to="/server/:serverId" replace />} />
                
                {/* Global pages (not server-specific) */}
                <Route path="/profile" element={<Profile />} />
                <Route path="/logs" element={<DashboardLogs />} />
                <Route path="/dashboard-logs" element={<Navigate to="/logs" replace />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/settings" element={<Settings />} />
                
                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

// Settings Applier Component - applies custom settings using clean CSS variables
const SettingsApplier: React.FC = () => {
  const { settings } = useSettings();

  // Apply custom settings
  React.useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    // Apply font size scaling
    const fontSizeMap = {
      small: '0.9',
      medium: '1.0', 
      large: '1.1'
    };
    
    const scale = fontSizeMap[settings.fontSize] || '1.0';
    root.style.setProperty('--font-scale', scale);
    
    // Convert hex to HSL and apply primary color
    const hexToHsl = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return null;
      
      let r = parseInt(result[1], 16) / 255;
      let g = parseInt(result[2], 16) / 255;
      let b = parseInt(result[3], 16) / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      
      return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
      };
    };
    
    const hsl = hexToHsl(settings.primaryColor);
    
    if (hsl) {
      // Update CSS custom properties
      root.style.setProperty('--primary-hue', hsl.h.toString());
      root.style.setProperty('--primary-saturation', `${hsl.s}%`);
      
    }
    
    // Apply animations setting
    if (settings.animationsEnabled) {
      body.classList.remove('no-animations');
    } else {
      body.classList.add('no-animations');
    }
    
    // Apply compact mode
    if (settings.compactMode) {
      body.classList.add('compact-mode');
    } else {
      body.classList.remove('compact-mode');
    }
  }, [settings]);

  return null;
};

function App() {
  // Set the document title when the app loads
  React.useEffect(() => {
    document.title = 'PanelOps - Modern Dashboard';
  }, []);
  return (
    <ErrorBoundary>
      <OldThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <ThemeProvider>
              <Router>
              <div className="App app-container">
                <SettingsApplier />
                <AppRoutes />
              </div>
              {/* Use ToastPortal to ensure toasts appear above everything */}
              <ToastPortal>
                <Toaster 
                position="top-center" 
                containerStyle={{
                  position: 'fixed',
                  top: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 2147483647, // Maximum z-index value
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
                  zIndex: 2147483647, // Maximum z-index value
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
              </ToastPortal>
              </Router>
            </ThemeProvider>
          </SettingsProvider>
        </AuthProvider>
      </OldThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
