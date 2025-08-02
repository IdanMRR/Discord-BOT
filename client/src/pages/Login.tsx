import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Logo from '../components/common/Logo';
import toast from 'react-hot-toast';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const Login: React.FC = () => {
  const { isAuthenticated, login, loading } = useAuth();
  const { darkMode } = useTheme();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [callbackProcessed, setCallbackProcessed] = useState(false);
  const location = useLocation();

  // Discord OAuth configuration - Using the actual bot client ID
  const DISCORD_CLIENT_ID = '1368637479653216297'; // BotAI's actual client ID
  
  // Environment-based redirect URI for production/development
  const getRedirectUri = () => {
    // Check if we're in production mode or have a production domain set
    const isProduction = process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost';
    
    if (isProduction && !window.location.hostname.includes('localhost')) {
      // For production, use the current domain
      return window.location.origin + '/login';
    } else {
      // For development, use localhost
      return 'http://localhost:3002/login';
    }
  };
  
  const DISCORD_REDIRECT_URI = encodeURIComponent(getRedirectUri());
  const DISCORD_SCOPE = encodeURIComponent('identify email');
  
  // Generate Discord OAuth URL
  const getDiscordAuthUrl = () => {
    return `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${DISCORD_REDIRECT_URI}&response_type=code&scope=${DISCORD_SCOPE}`;
  };

  // Handle OAuth callback
  // Note: React StrictMode in development causes effects to run twice,
  // so we use sessionStorage to prevent double-processing of OAuth codes
  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      // Create a unique key for this OAuth code to prevent double processing
      const codeKey = code ? `oauth_${code.substring(0, 10)}` : null;
      
      // Check if this code has already been processed (survives React StrictMode)
      if (codeKey && sessionStorage.getItem(codeKey)) {
        console.log('OAuth code already processed, skipping');
        return;
      }

      // Prevent multiple calls or reprocessing
      if (isLoggingIn || callbackProcessed) {
        console.log('Callback already processed or in progress, skipping');
        return;
      }

      if (error) {
        console.error('Discord OAuth error:', error);
        toast.error('Discord authentication was cancelled or failed.', { id: 'oauth-error' });
        setCallbackProcessed(true);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      if (code && codeKey) {
        console.log('Processing Discord OAuth code:', code.substring(0, 10) + '...');
        
        // Mark this code as being processed immediately
        sessionStorage.setItem(codeKey, 'processing');
        setIsLoggingIn(true);
        setCallbackProcessed(true);
        
        try {
          const response = await apiService.handleAuthCallback(code);
          if (response.success && response.data) {
            // Mark as successfully processed
            sessionStorage.setItem(codeKey, 'completed');
            await login(response.data.token);
            toast.success(`Welcome ${response.data.user.username}! 🎉`, { 
              id: 'oauth-success',
              duration: 4000 
            });
          } else {
            console.error('Auth callback failed:', response.error);
            toast.error('Failed to authenticate with Discord.', { id: 'oauth-error' });
            // Remove the processing flag on failure so user can retry
            sessionStorage.removeItem(codeKey);
          }
        } catch (error) {
          console.error('Auth callback error:', error);
          toast.error('Discord authentication failed. Please try again.', { id: 'oauth-error' });
          // Remove the processing flag on failure so user can retry
          sessionStorage.removeItem(codeKey);
        } finally {
          setIsLoggingIn(false);
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    // Only process callback if we haven't already
    if (!callbackProcessed) {
      handleAuthCallback();
    }
  }, [location.search, login, isLoggingIn, callbackProcessed]);

  if (loading || isLoggingIn) {
    return (
      <div className={classNames(
        "min-h-screen flex items-center justify-center",
        darkMode ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-blue-500" />
          <p className={classNames(
            "mt-4 text-lg font-medium",
            darkMode ? "text-gray-300" : "text-gray-600"
          )}>
            {isLoggingIn ? 'Authenticating with Discord...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Handle Discord OAuth login
  const handleDiscordLogin = () => {
    if (isLoggingIn) return;
    
    setIsLoggingIn(true);
    setCallbackProcessed(false);
    
    // Clean up old OAuth codes from sessionStorage (older than 10 minutes)
    const cleanupOldOAuthCodes = () => {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('oauth_')) {
          // Remove old OAuth codes to prevent sessionStorage bloat
          sessionStorage.removeItem(key);
        }
      });
    };
    cleanupOldOAuthCodes();
    
    // Small delay to prevent rapid clicks
    setTimeout(() => {
      // Redirect to Discord OAuth
      window.location.href = getDiscordAuthUrl();
    }, 100);
  };



  return (
    <div className="page-container min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={classNames(
          "absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-20 animate-pulse",
          darkMode ? "bg-blue-500" : "bg-blue-400"
        )}></div>
        <div className={classNames(
          "absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl opacity-20 animate-pulse",
          darkMode ? "bg-purple-500" : "bg-purple-400"
        )} style={{ animationDelay: '2s' }}></div>
        <div className={classNames(
          "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-10 animate-pulse",
          darkMode ? "bg-pink-500" : "bg-pink-400"
        )} style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative max-w-md w-full space-y-8 z-10">
        {/* Header Section */}
        <div className="text-center">
          <div className="mx-auto mb-6 transform transition-all duration-500 hover:scale-110 hover:rotate-3">
            {/* Logo without background */}
            <div className="mx-auto w-20 h-20 flex items-center justify-center">
              <Logo size="lg" showText={false} />
            </div>
          </div>
          
          <h2 className="text-4xl font-bold bg-gradient-to-r bg-clip-text text-transparent mb-3 transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(to right, var(--foreground), var(--muted-foreground))',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text'
              }}>
            PanelOps
          </h2>
          
          <p className="text-lg font-medium transition-colors duration-300" 
             style={{ color: 'var(--muted-foreground)' }}>
            🚀 Sign in with Discord to manage your bot
          </p>
        </div>
        
        {/* Login Card */}
        <div className="card p-8 rounded-2xl backdrop-blur-xl transition-all duration-300 transform hover:scale-105 shadow-2xl ring-1">
          <div className="space-y-6">
            


            {/* Discord Login Button */}
            <button
              onClick={handleDiscordLogin}
              disabled={isLoggingIn}
              className="btn-primary w-full py-4 px-6 text-lg font-bold rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
              style={{
                background: 'linear-gradient(to right, var(--primary), var(--primary))',
                color: 'var(--primary-foreground)'
              }}
            >
              <div className="flex items-center justify-center">
                {isLoggingIn ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-3 text-white" />
                    <span>🔄 Redirecting to Discord...</span>
                  </>
                ) : (
                  <>
                    <div className="mr-3 p-1 bg-black/20 rounded-lg">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FFFFFF">
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0190 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z"/>
                      </svg>
                    </div>
                    <span>🚀 Login with Discord</span>
                  </>
                )}
              </div>
            </button>

            {/* Information Text */}
            <div className="text-center p-4 rounded-lg" 
                 style={{ backgroundColor: 'var(--muted)' }}>
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                🔐 Secure authentication via Discord OAuth2
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
                You'll be redirected to Discord to authorize access
              </p>
            </div>

            {/* Features Preview */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="content-area p-4 rounded-xl text-center transition-all duration-300 hover:scale-105">
                <div className="text-2xl mb-2">🎫</div>
                <p className="text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>Ticket System</p>
              </div>
              <div className="content-area p-4 rounded-xl text-center transition-all duration-300 hover:scale-105">
                <div className="text-2xl mb-2">⚠️</div>
                <p className="text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>Warnings</p>
              </div>
              <div className="content-area p-4 rounded-xl text-center transition-all duration-300 hover:scale-105">
                <div className="text-2xl mb-2">📊</div>
                <p className="text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>Analytics</p>
              </div>
              <div className="content-area p-4 rounded-xl text-center transition-all duration-300 hover:scale-105">
                <div className="text-2xl mb-2">⚙️</div>
                <p className="text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>Settings</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center">
          <p className="text-sm transition-colors duration-300" 
             style={{ color: 'var(--muted-foreground)' }}>
            🔒 By signing in, you agree to our{' '}
            <span className="font-medium hover:underline cursor-pointer transition-colors duration-200"
                  style={{ color: 'var(--primary)' }}>
              Terms of Service
            </span>
            {' '}and{' '}
            <span className="font-medium hover:underline cursor-pointer transition-colors duration-200"
                  style={{ color: 'var(--primary)' }}>
              Privacy Policy
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
