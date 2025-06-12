import { useAuth } from '../contexts/AuthContext';

export const usePermissions = () => {
  const { user, isAdmin, permissions } = useAuth();

  const hasPermission = (requiredPermission: string | string[]): boolean => {
    if (!user) {
      console.log('No user - permission denied');
      return false;
    }
    
    // If user has no permissions at all, deny access
    if (!permissions || permissions.length === 0) {
      console.log('User has no permissions - access denied');
      return false;
    }
    
    // Admin always has access
    if (isAdmin) {
      console.log('User is admin - access granted');
      return true;
    }
    
    // Check specific permissions
    if (Array.isArray(requiredPermission)) {
      const hasAccess = requiredPermission.some(perm => permissions.includes(perm));
      console.log('Array permission check:', { requiredPermission, userPermissions: permissions, hasAccess });
      return hasAccess;
    } else {
      const hasAccess = permissions.includes(requiredPermission);
      console.log('Single permission check:', { requiredPermission, userPermissions: permissions, hasAccess });
      return hasAccess;
    }
  };

  const requiresPermission = (requiredPermission: string | string[]): boolean => {
    return hasPermission(requiredPermission);
  };

  return {
    user,
    isAdmin,
    permissions,
    hasPermission,
    requiresPermission,
    // Specific permission checks
    canViewLogs: hasPermission(['view_logs', 'admin']),
    canManageWarnings: hasPermission(['manage_warnings', 'admin']),
    canManageTickets: hasPermission(['manage_tickets', 'admin']),
    canManageSettings: hasPermission(['manage_settings', 'admin']),
    canAccessAdmin: hasPermission(['admin', 'system_admin', 'manage_users']),
  };
};

export default usePermissions; 