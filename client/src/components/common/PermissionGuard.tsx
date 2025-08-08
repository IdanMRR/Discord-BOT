import React, { useState } from 'react';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import usePermissions from '../../hooks/usePermissions';
import LoadingSpinner from './LoadingSpinner';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermission: string | string[];
  fallbackMessage?: string;
  showReturnButton?: boolean;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredPermission,
  fallbackMessage = 'You do not have permission to access this page.',
  showReturnButton = true
}) => {
  const { darkMode } = useTheme();
  const { user, hasPermission } = usePermissions();
  const { checkAuth } = useAuth();
  const [isSettingUpAdmin, setIsSettingUpAdmin] = useState(false);

  // Check if this is an admin-level permission that could be set up
  const isAdminPermission = Array.isArray(requiredPermission) 
    ? requiredPermission.some(p => ['admin', 'system_admin', 'manage_users'].includes(p))
    : ['admin', 'system_admin', 'manage_users'].includes(requiredPermission);

  // Show loading if user is not loaded yet
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const handleSetupAdmin = async () => {
    try {
      setIsSettingUpAdmin(true);
      const response = await apiService.setupAdmin();
      
      if (response.success) {
        toast.success(response.data?.message || 'Admin permissions granted!');
        // Refresh auth to get updated permissions
        await checkAuth();
      } else {
        toast.error(response.error || 'Failed to setup admin permissions');
      }
    } catch (error: any) {
      console.error('Setup admin error:', error);
      toast.error('Failed to setup admin permissions');
    } finally {
      setIsSettingUpAdmin(false);
    }
  };

  // Check permissions - users with no permissions get denied access
  const userHasAnyPermissions = user?.permissions && user.permissions.length > 0;
  const userHasRequiredPermission = hasPermission(requiredPermission);
  
  // Debug logging (removed to prevent console spam)
  // console.log('PermissionGuard check:', {
  //   user: user?.username,
  //   userPermissions: user?.permissions,
  //   requiredPermission,
  //   userHasAnyPermissions,
  //   userHasRequiredPermission
  // });
  
  if (!userHasAnyPermissions || !userHasRequiredPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <ShieldCheckIcon className="mx-auto h-16 w-16 text-red-500 mb-6" />
          <h1 className={`text-3xl font-bold mb-4 ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Access Denied
          </h1>
          <p className={`text-lg mb-6 ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {fallbackMessage}
          </p>
          
          <div className="space-y-4">
            {/* Setup Admin Button - Only show for admin permissions and authenticated users */}
            {isAdminPermission && user && (
              <button
                onClick={handleSetupAdmin}
                disabled={isSettingUpAdmin}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {isSettingUpAdmin ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Setting up...
                  </>
                ) : (
                  <>
                    🔐 Setup Admin Access
                  </>
                )}
              </button>
            )}
            
            {/* Return Button */}
            {showReturnButton && (
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Return to Dashboard
              </button>
            )}
          </div>
          
          {/* Help Text */}
          {isAdminPermission && (
            <div className={`mt-6 p-4 rounded-lg text-sm ${
              darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
            }`}>
              <p className="mb-2">
                <strong>Need access?</strong>
              </p>
              <p>
                If you're the server owner, click "Setup Admin Access" above. 
                Otherwise, ask an administrator to grant you permissions using the 
                <code className={`px-2 py-1 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  /dashboard-perms
                </code> command.
              </p>
              
              {/* Debug Button (Development only) */}
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={async () => {
                    try {
                      const response = await apiService.debugPermissions();
                      console.log('🔍 Debug Permissions:', response);
                      alert('Check console for debug info');
                    } catch (error) {
                      console.error('Debug error:', error);
                    }
                  }}
                  className="mt-3 text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded"
                >
                  🔍 Debug Permissions (Dev)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // User has permission, render the protected content
  return <>{children}</>;
};

export default PermissionGuard; 