import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import axios from 'axios';

// Layout Components
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Layout from './components/Layout';

// Feature Pages
import ServerSettings from './pages/ServerSettings';
import TicketSettings from './pages/TicketSettings';
import TicketStats from './pages/TicketStats';
import VerificationSettings from './pages/VerificationSettings';
import WelcomeSettings from './pages/WelcomeSettings';
import LiveLogs from './pages/LiveLogs';

// Context for managing auth state
export const AuthContext = React.createContext();

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#5865F2', // Discord blue
    },
    secondary: {
      main: '#EB459E', // Discord pink
    },
    background: {
      default: '#36393f', // Discord dark
      paper: '#2f3136',   // Discord darker
    },
  },
  typography: {
    fontFamily: '"Whitney", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on app load or use mock user in development
  useEffect(() => {
    const checkAuth = async () => {
      if (process.env.NODE_ENV === 'development') {
        // In development mode, just use a mock user and skip the API call
        setUser({
          id: '123456789',
          username: 'DevUser',
          discriminator: '0000',
          avatar: null,
          guilds: [
            {
              id: '123456789012345678',
              name: 'Test Server',
              icon: null,
              owner: true,
              permissions: 0x20
            },
            {
              id: '876543210987654321',
              name: 'Another Server',
              icon: null,
              owner: false,
              permissions: 0x20
            }
          ]
        });
        setLoading(false);
        return; // Skip the API call
      }
      
      try {
        const response = await axios.get('/api/auth/user', { withCredentials: true });
        setUser(response.data);
      } catch (err) {
        console.log('Not authenticated:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Protected route component
  const ProtectedRoute = ({ children }) => {
    if (loading) {
      return <div>Loading...</div>;
    }
    
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    
    return children;
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AuthContext.Provider value={{ user, setUser }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="servers/:serverId">
                <Route index element={<ServerSettings />} />
                <Route path="tickets">
                  <Route index element={<TicketSettings />} />
                  <Route path="stats" element={<TicketStats />} />
                </Route>
                <Route path="verification" element={<VerificationSettings />} />
                <Route path="welcome" element={<WelcomeSettings />} />
              <Route path="logs" element={<LiveLogs />} />
              </Route>
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

export default App; 