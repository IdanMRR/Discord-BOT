import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AuthState, User } from '../types';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

interface AuthContextType extends AuthState {
  login: (token: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isAdmin: false,
    permissions: []
  });
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Prevent concurrent login attempts
  const loginPromiseRef = useRef<Promise<void> | null>(null);

  const login = async (token: string): Promise<void> => {
    // If already logging in with the same token, return existing promise
    if (loginPromiseRef.current && isLoggingIn) {
      return loginPromiseRef.current;
    }

    // Create new login promise
    const loginPromise = (async () => {
      try {
        setIsLoggingIn(true);
        setLoading(true);
        apiService.setAuthToken(token);
        
        const response = await apiService.getCurrentUser();
        if (response.success && response.data) {
          const user = response.data;
          const isAdmin = checkAdminPermissions(user);
          
          setAuthState({
            isAuthenticated: true,
            user,
            token,
            isAdmin,
            permissions: getPermissions(user)
          });
          
          // Only show welcome message if this is a fresh login, not on page refresh
          const isPageRefresh = localStorage.getItem('auth_token') === token;
          if (!isPageRefresh) {
            toast.success(`Welcome back, ${user.username}!`, { 
              id: 'login-success',
              duration: 3000 
            });
          }
        } else {
          throw new Error(response.error || 'Failed to get user data');
        }
      } catch (error: any) {
        toast.error('Login failed: ' + error.message, { id: 'login-error' });
        logout();
        throw error;
      } finally {
        setLoading(false);
        setIsLoggingIn(false);
        loginPromiseRef.current = null;
      }
    })();

    loginPromiseRef.current = loginPromise;
    return loginPromise;
  };

  const logout = (): void => {
    apiService.logout();
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      isAdmin: false,
      permissions: []
    });
    toast('Logged out successfully');
  };

  const checkAuth = async (): Promise<void> => {
    try {
      setLoading(true);
      const token = apiService.getAuthToken();
      
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await apiService.getCurrentUser();
      if (response.success && response.data) {
        const user = response.data;
        const isAdmin = checkAdminPermissions(user);
        
        setAuthState({
          isAuthenticated: true,
          user,
          token,
          isAdmin,
          permissions: getPermissions(user)
        });
      } else {
        // Token is invalid, remove it
        logout();
      }
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const checkAdminPermissions = (user: User): boolean => {
    // Check if user has admin permissions from the database
    const databasePermissions = user.permissions || [];
    
    // Check if user has admin permission in their permissions array (set by backend)
    const hasAdminPermission = databasePermissions.includes('admin') ||
                              databasePermissions.includes('system_admin') ||
                              databasePermissions.includes('manage_users');
    
    // Check Discord admin flags as fallback (only if no database permissions exist)
    const hasAdminFlags = databasePermissions.length === 0 && 
                         !!(user.flags && (user.flags & 0x1) !== 0);
    
    
    return hasAdminPermission || hasAdminFlags;
  };

  const getPermissions = (user: User): string[] => {
    // Use permissions directly from the database (sent by backend API)
    const databasePermissions = user.permissions || [];
    
    
    // If user has no database permissions, they only get basic view access
    if (databasePermissions.length === 0) {
      return []; // Return empty array - no permissions
    }
    
    // Return the permissions from the database
    return databasePermissions;
  };

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    checkAuth,
    loading
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
