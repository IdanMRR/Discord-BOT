import { useAuth } from '../contexts/AuthContext';

export const usePermissions = () => {
  const { user, isAdmin, permissions } = useAuth();

  const hasPermission = (requiredPermission: string | string[]): boolean => {
    if (!user) {
      return false;
    }
    
    // If user has no permissions at all, deny access
    if (!permissions || permissions.length === 0) {
      return false;
    }
    
    // Admin always has access
    if (isAdmin) {
      return true;
    }
    
    // Check specific permissions
    if (Array.isArray(requiredPermission)) {
      return requiredPermission.some(perm => permissions.includes(perm));
    } else {
      return permissions.includes(requiredPermission);
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