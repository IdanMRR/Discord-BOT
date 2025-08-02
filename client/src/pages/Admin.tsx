import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import PermissionGuard from '../components/common/PermissionGuard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { apiService } from '../services/api';
import {
  CogIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  EyeIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { Dialog, Transition } from '@headlessui/react';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  role: 'admin' | 'moderator' | 'user';
  permissions: string[];
  lastLogin: string;
  createdAt: string;
  dashboardAccess: boolean;
  status: 'active' | 'banned' | 'suspended';
}

interface PermissionGroup {
  name: string;
  permissions: string[];
  description: string;
}

const AdminContent: React.FC = () => {
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]); // Store all users from API
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('joinedAt');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Available permissions
  const availablePermissions = useMemo(() => [
    'dashboard_access',
    'view_logs',
    'manage_warnings',
    'manage_tickets',
    'manage_servers',
    'manage_members',
    'view_analytics',
    'system_admin',
    'moderate_users',
    'manage_roles'
  ], []);

  // Permission groups for easier management
  const permissionGroups: PermissionGroup[] = [
    {
      name: 'Dashboard Access',
      permissions: ['dashboard_access'],
      description: 'Basic access to the dashboard'
    },
    {
      name: 'Viewer',
      permissions: ['dashboard_access', 'view_logs', 'view_analytics'],
      description: 'Read-only access to most features'
    },
    {
      name: 'Moderator',
      permissions: ['dashboard_access', 'view_logs', 'manage_warnings', 'manage_tickets', 'moderate_users'],
      description: 'Standard moderation permissions'
    },
    {
      name: 'Admin',
      permissions: ['dashboard_access', 'view_logs', 'manage_warnings', 'manage_tickets', 'manage_servers', 'manage_members', 'view_analytics', 'moderate_users', 'manage_roles'],
      description: 'Full administrative access'
    },
    {
      name: 'Super Admin',
      permissions: availablePermissions,
      description: 'Complete system access'
    }
  ];

  const loadUsers = useCallback(async () => {
    console.log('🔄 loadUsers called with:', { selectedServer, serversLength: servers.length, page, searchTerm });
    
    try {
      setLoading(true);
      
      // First load servers if not already loaded
      if (servers.length === 0) {
        console.log('📡 Loading servers...');
        const serversResponse = await apiService.getServerList();
        console.log('📡 Servers response:', serversResponse);
        
        if (serversResponse.success && serversResponse.data) {
          setServers(serversResponse.data);
          if (serversResponse.data.length > 0 && !selectedServer) {
            console.log('🎯 Auto-selecting first server:', serversResponse.data[0].name);
            setSelectedServer(serversResponse.data[0].id);
            return; // Exit early, let the useEffect handle the server change
          }
        } else {
          console.error('❌ Failed to load servers:', serversResponse.error);
          toast.error('Failed to load servers: ' + (serversResponse.error || 'Unknown error'));
          setLoading(false);
          return;
        }
      }
      
      // If we have a selected server, load its members
      if (selectedServer) {
        console.log('👥 Loading members for server:', selectedServer);
        try {
          const membersResponse = await apiService.getServerMembers(selectedServer, {
            page: 1, // Always load first page, we'll handle pagination client-side
            limit: 1000, // Load more users for client-side filtering
            role: selectedRole !== 'all' ? selectedRole : undefined,
            status: selectedStatus !== 'all' ? selectedStatus : undefined
          });
          
          console.log('👥 Members response:', membersResponse);
          
          if (membersResponse.success && membersResponse.data?.members) {
            // Update pagination info
            setPagination(membersResponse.data.pagination);
            
            // Convert Discord members to User format
            const convertedUsers: User[] = membersResponse.data.members.map((member: any) => ({
              id: member.id,
              username: member.username,
              discriminator: member.discriminator || '0000',
              avatar: member.avatar,
              role: member.dashboardRole || 'user', // Use dashboard role from API
              permissions: member.dashboardPermissions || [],
              lastLogin: member.lastActivity || new Date().toISOString(),
              createdAt: member.joinedAt || new Date().toISOString(),
              dashboardAccess: member.dashboardAccess || false,
              status: member.status === 'offline' ? 'active' : member.status
            }));
            setAllUsers(convertedUsers);
            
            console.log(`✅ Loaded ${convertedUsers.length} members from ${membersResponse.data.serverInfo?.name || 'server'}`);
            console.log(`📊 Total members: ${membersResponse.data.pagination.total}`);
          } else {
            console.error('❌ Failed to load members:', membersResponse.error);
            toast.error('Failed to load members: ' + (membersResponse.error || 'Unknown error'));
            setAllUsers([]);
          }
        } catch (memberError) {
          console.error('❌ Error loading server members:', memberError);
          toast.error('Error loading server members');
          // Fallback to mock data if member loading fails
          const mockUsers: User[] = [
            {
              id: '1',
              username: 'soggra',
              discriminator: '0001',
              avatar: null,
              role: 'admin',
              permissions: availablePermissions,
              lastLogin: '2024-01-10T10:00:00Z',
              createdAt: '2024-01-01T00:00:00Z',
              dashboardAccess: true,
              status: 'active'
            }
          ];
          setAllUsers(mockUsers);
        }
      } else {
        console.log('⚠️ No server selected, showing empty state');
        setAllUsers([]);
      }
    } catch (error) {
      console.error('❌ Error in loadUsers:', error);
      toast.error('Failed to load data');
      setAllUsers([]);
    } finally {
      console.log('✅ loadUsers completed, setting loading to false');
      setLoading(false);
    }
  }, [selectedServer, servers.length, availablePermissions, selectedRole, selectedStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side filtered and paginated users
  const filteredUsers = useMemo(() => {
    let filtered = allUsers.filter(user => {
      const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.id.includes(searchTerm);
      const matchesRole = selectedRole === 'all' || user.role === selectedRole;
      const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'username':
          return a.username.localeCompare(b.username);
        case 'joinedAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    return filtered;
  }, [allUsers, searchTerm, selectedRole, selectedStatus, sortBy]);

  // Paginated users for display
  const paginatedUsers = useMemo(() => {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, page, limit]);

  // Update pagination info when filtered users change
  useEffect(() => {
    const totalFiltered = filteredUsers.length;
    const totalPages = Math.ceil(totalFiltered / limit);
    setPagination(prev => ({
      ...prev,
      total: totalFiltered,
      pages: totalPages,
      page: page
    }));
  }, [filteredUsers.length, limit, page]);

  // Initial load effect with timeout
  useEffect(() => {
    console.log('🚀 Initial load effect triggered');
    const timeoutId = setTimeout(() => {
      console.log('⏰ Loading timeout - forcing loading to false');
      setLoading(false);
      toast.error('Loading timed out. Please refresh the page.');
    }, 15000); // 15 second timeout
    
    loadUsers().finally(() => {
      clearTimeout(timeoutId);
    });
    
    return () => clearTimeout(timeoutId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load users when server changes
  useEffect(() => {
    if (selectedServer) {
      loadUsers();
    }
  }, [selectedServer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to first page when filtering (client-side only)
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedRole, selectedStatus, sortBy]);



  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      console.log('🔄 Updating user permissions:', { 
        userId, 
        updates, 
        role: updates.role,
        dashboardAccess: updates.dashboardAccess,
        permissions: updates.permissions 
      });
      
      // Call the real API to save permissions
      const response = await apiService.updateUserPermissions(userId, {
        role: updates.role,
        dashboardAccess: updates.dashboardAccess,
        permissions: updates.permissions,
        guildId: selectedServer // Include the current selected server
      });
      
      console.log('🔄 API Response:', response);
      
      if (response.success) {
        console.log('✅ Permissions saved successfully:', response.data);
        
        // Update local state with the response data
        setAllUsers(prev => prev.map(u => u.id === userId ? { 
          ...u, 
          ...updates,
          permissions: response.data?.permissions || updates.permissions || [],
          role: updates.role || u.role,
          dashboardAccess: response.data?.dashboardAccess !== undefined ? response.data.dashboardAccess : (updates.dashboardAccess !== undefined ? updates.dashboardAccess : u.dashboardAccess)
        } : u));
        
        toast.success(response.data?.message || 'User permissions updated successfully');
        setEditingUser(null);
        
        // Reload users to get fresh data from server
        setTimeout(() => {
          console.log('🔄 Reloading users to verify permissions...');
          loadUsers();
        }, 1000);
      } else {
        console.error('❌ API returned error:', response.error);
        throw new Error(response.error || 'Failed to update user permissions');
      }
    } catch (error: any) {
      console.error('❌ Error updating user:', error);
      toast.error(error.message || 'Failed to update user permissions');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      // API call would go here
      setAllUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };



  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'moderator':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-muted/50 text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'banned':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-muted/50 text-muted-foreground';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={classNames(
              "p-3 rounded-lg",
              darkMode ? "bg-purple-900/20" : "bg-purple-100"
            )}>
              <CogIcon className={classNames(
                "h-8 w-8",
                darkMode ? "text-purple-400" : "text-purple-600"
              )} />
            </div>
            <div>
              <h1 className={classNames(
                "text-4xl font-bold",
                "text-foreground"
              )}>
                User Management
              </h1>
              <p className={classNames(
                "text-lg font-medium mt-2",
                "text-muted-foreground"
              )}>
                Manage dashboard access and user permissions
              </p>
            </div>
          </div>
          
          <button
            onClick={() => toast('Add User functionality coming soon!', { icon: 'ℹ️' })}
            className={classNames(
              "inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105",
              "text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800",
              "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
              darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
            )}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add User
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Users', value: pagination.total || allUsers.length, icon: UsersIcon, color: 'blue' },
          { label: 'Active Users', value: allUsers.filter(u => u.status === 'active').length, icon: CheckCircleIcon, color: 'green' },
          { label: 'Dashboard Access', value: allUsers.filter(u => u.dashboardAccess).length, icon: EyeIcon, color: 'purple' },
          { label: 'Admins', value: allUsers.filter(u => u.role === 'admin').length, icon: ShieldCheckIcon, color: 'red' }
        ].map((stat, index) => (
          <div
            key={index}
            className="p-6 rounded-lg border bg-card border-border"
          >
            <div className="flex items-center space-x-3">
              <stat.icon className={classNames(
                "h-8 w-8",
                stat.color === 'blue' ? "text-blue-500" :
                stat.color === 'green' ? "text-green-500" :
                stat.color === 'purple' ? "text-purple-500" :
                "text-red-500"
              )} />
              <div>
                <p className="text-3xl font-bold text-card-foreground">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Enhanced Filters */}
      <div className="p-6 rounded-lg border mb-8 bg-card border-border">
        <h3 className="text-lg font-semibold mb-4 text-card-foreground">
          Filters & Search
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className={classNames(
              "block text-sm font-medium mb-2",
              "text-foreground"
            )}>
              Search Users
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by username or ID..."
                className={classNames(
                  "w-full pl-10 pr-4 py-2 rounded-lg border transition-colors",
                  darkMode 
                    ? "input-field text-white placeholder-gray-400 focus:border-purple-500" 
                    : "input-field text-gray-900 placeholder-gray-500 focus:border-purple-500",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                )}
              />
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <label className={classNames(
              "block text-sm font-medium mb-2",
              "text-foreground"
            )}>
              Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className={classNames(
                "w-full px-3 py-2 rounded-lg border transition-colors",
                darkMode 
                  ? "input-field text-white focus:border-purple-500" 
                  : "input-field text-gray-900 focus:border-purple-500",
                "focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              )}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="user">User</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className={classNames(
              "block text-sm font-medium mb-2",
              "text-foreground"
            )}>
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={classNames(
                "w-full px-3 py-2 rounded-lg border transition-colors",
                darkMode 
                  ? "input-field text-white focus:border-purple-500" 
                  : "input-field text-gray-900 focus:border-purple-500",
                "focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              )}
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="idle">Idle</option>
              <option value="dnd">Do Not Disturb</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className={classNames(
              "block text-sm font-medium mb-2",
              "text-foreground"
            )}>
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={classNames(
                "w-full px-3 py-2 rounded-lg border transition-colors",
                darkMode 
                  ? "input-field text-white focus:border-purple-500" 
                  : "input-field text-gray-900 focus:border-purple-500",
                "focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              )}
            >
              <option value="joinedAt">Join Date</option>
              <option value="username">Username</option>
              <option value="displayName">Display Name</option>
              <option value="warningCount">Warning Count</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

        {/* Results Info */}
        <div className={classNames(
          "mt-4 text-sm",
          darkMode ? "text-gray-400" : "text-gray-600"
        )}>
          Showing {paginatedUsers.length} of {pagination.total} users
          {selectedServer && servers.find(s => s.id === selectedServer) && (
            <span> from {servers.find(s => s.id === selectedServer)?.name}</span>
          )}
        </div>
      </div>

      {/* Server Selection Only */}
      <div className={classNames(
        "mb-6 p-4 rounded-lg border",
        "bg-card border-border"
      )}>
        <div className="flex flex-col md:flex-row gap-4">
          {/* Server Selection */}
          <div className="flex-1">
            <label className={classNames(
              "block text-sm font-medium mb-2",
              "text-foreground"
            )}>
              Select Discord Server
            </label>
            <select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              className={classNames(
                "w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-purple-500 focus:border-transparent",
                darkMode 
                  ? "input-field text-white" 
                  : "input-field text-gray-900"
              )}
            >
              <option value="">Select a server...</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name} ({server.memberCount} members)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className={classNames(
        "rounded-lg border overflow-hidden",
        "bg-card border-border"
      )}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={"bg-muted"}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Dashboard Access
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.username}#{user.discriminator}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ID: {user.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={classNames(
                      "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
                      getRoleColor(user.role)
                    )}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={classNames(
                      "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
                      user.dashboardAccess 
                        ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                    )}>
                      {user.dashboardAccess ? 'Granted' : 'Denied'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={classNames(
                      "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
                      getStatusColor(user.status)
                    )}>
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(user.lastLogin).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className={classNames(
          "flex items-center justify-between px-6 py-4 border-t",
          "bg-card border-border"
        )}>
          <div className="flex items-center space-x-2">
            <span className={classNames(
              "text-sm",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              Page {page} of {pagination.pages} ({pagination.total} total users)
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className={classNames(
                "px-3 py-1 rounded border text-sm transition-colors",
                page === 1
                  ? darkMode 
                    ? "border-gray-600 text-gray-500 cursor-not-allowed"
                    : "border-gray-300 text-gray-400 cursor-not-allowed"
                  : darkMode
                    ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              Previous
            </button>
            
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={classNames(
                    "px-3 py-1 rounded border text-sm transition-colors",
                    page === pageNum
                      ? "bg-purple-600 border-purple-600 text-white"
                      : darkMode
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => setPage(Math.min(pagination.pages, page + 1))}
              disabled={page === pagination.pages}
              className={classNames(
                "px-3 py-1 rounded border text-sm transition-colors",
                page === pagination.pages
                  ? darkMode 
                    ? "border-gray-600 text-gray-500 cursor-not-allowed"
                    : "border-gray-300 text-gray-400 cursor-not-allowed"
                  : darkMode
                    ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      <Transition appear show={!!editingUser} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setEditingUser(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className={classNames(
              "fixed inset-0 bg-black/60 backdrop-blur-sm",
              darkMode ? "bg-gray-900/80" : "bg-black/50"
            )} />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className={classNames(
                  "w-full max-w-3xl transform overflow-hidden rounded-2xl p-6 text-left align-middle shadow-2xl transition-all",
                  "content-area"
                )}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className={classNames(
                        "w-12 h-12 rounded-full flex items-center justify-center mr-4",
                        darkMode ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-600"
                      )}>
                        <span className="text-2xl">👤</span>
                      </div>
                      <div>
                        <Dialog.Title
                          as="h3"
                          className={classNames(
                            "text-xl font-bold",
                            "text-foreground"
                          )}
                        >
                          Edit User Permissions
                        </Dialog.Title>
                        <p className={classNames(
                          "text-sm mt-1",
                          "text-muted-foreground"
                        )}>
                          {editingUser?.username}#{editingUser?.discriminator}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={classNames(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200",
                        darkMode 
                          ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700" 
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      )}
                      onClick={() => setEditingUser(null)}
                    >
                      <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>

                  {editingUser && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Role Selection */}
                        <div className={classNames(
                          "p-4 rounded-xl border",
                          darkMode ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"
                        )}>
                          <label className={classNames(
                            "block text-base font-semibold mb-3",
                            "text-foreground"
                          )}>
                            Role
                          </label>
                          <select
                            value={editingUser.role}
                            onChange={(e) => {
                              const newRole = e.target.value as any;
                              let newPermissions = editingUser.permissions;
                              let newDashboardAccess = editingUser.dashboardAccess;
                              
                              // Auto-assign permissions based on role
                              switch (newRole) {
                                case 'admin':
                                  newPermissions = ['dashboard_access', 'view_logs', 'manage_warnings', 'manage_tickets', 'manage_servers', 'manage_members', 'view_analytics', 'system_admin', 'moderate_users', 'manage_roles'];
                                  newDashboardAccess = true;
                                  break;
                                case 'moderator':
                                  newPermissions = ['dashboard_access', 'view_logs', 'manage_warnings', 'manage_tickets', 'moderate_users'];
                                  newDashboardAccess = true;
                                  break;
                                case 'user':
                                  newPermissions = ['dashboard_access'];
                                  newDashboardAccess = false;
                                  break;
                                default:
                                  newPermissions = [];
                                  newDashboardAccess = false;
                              }
                              
                              setEditingUser({
                                ...editingUser, 
                                role: newRole,
                                permissions: newPermissions,
                                dashboardAccess: newDashboardAccess
                              });
                            }}
                            className={classNames(
                              "w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-purple-500 transition-all duration-200",
                              "bg-card border-border text-card-foreground"
                            )}
                          >
                            <option value="user">User</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                          </select>

                          {/* Dashboard Access */}
                          <div className="mt-3">
                            <label className="flex items-center p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={editingUser.dashboardAccess}
                                  onChange={(e) => setEditingUser({...editingUser, dashboardAccess: e.target.checked})}
                                  className="sr-only"
                                />
                                <div className={classNames(
                                  "block w-10 h-6 rounded-full transition-colors duration-200",
                                  editingUser.dashboardAccess 
                                    ? "bg-purple-600" 
                                    : (darkMode ? "bg-gray-600" : "bg-gray-300")
                                )}>
                                  <div className={classNames(
                                    "dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200",
                                    editingUser.dashboardAccess ? "transform translate-x-4" : ""
                                  )}></div>
                                </div>
                              </div>
                              <span className={classNames(
                                "ml-3 text-sm font-medium",
                                "text-muted-foreground"
                              )}>
                                Grant Dashboard Access
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Permission Groups */}
                        <div className={classNames(
                          "p-4 rounded-xl border",
                          darkMode ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"
                        )}>
                          <label className={classNames(
                            "block text-base font-semibold mb-3",
                            "text-foreground"
                          )}>
                            Permission Groups
                          </label>
                          <div className="space-y-2">
                            {permissionGroups.map((group) => (
                              <button
                                key={group.name}
                                onClick={() => setEditingUser({...editingUser, permissions: group.permissions})}
                                className={classNames(
                                  "w-full text-left p-3 rounded-lg border transition-all duration-200",
                                  editingUser.permissions.length === group.permissions.length &&
                                  group.permissions.every(p => editingUser.permissions.includes(p))
                                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md"
                                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                                )}
                              >
                                <div className={classNames(
                                  "font-medium text-sm",
                                  "text-foreground"
                                )}>{group.name}</div>
                                <div className={classNames(
                                  "text-xs mt-1",
                                  "text-muted-foreground"
                                )}>{group.description}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Individual Permissions */}
                      <div className={classNames(
                        "p-4 rounded-xl border",
                        darkMode ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"
                      )}>
                        <label className={classNames(
                          "block text-base font-semibold mb-3",
                          "text-foreground"
                        )}>
                          Individual Permissions
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {availablePermissions.map((permission) => (
                            <label key={permission} className="flex items-center p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={editingUser.permissions.includes(permission)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditingUser({
                                        ...editingUser,
                                        permissions: [...editingUser.permissions, permission]
                                      });
                                    } else {
                                      setEditingUser({
                                        ...editingUser,
                                        permissions: editingUser.permissions.filter(p => p !== permission)
                                      });
                                    }
                                  }}
                                  className="sr-only"
                                />
                                <div className={classNames(
                                  "w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200",
                                  editingUser.permissions.includes(permission)
                                    ? "bg-purple-600 border-purple-600"
                                    : (darkMode ? "border-gray-500 bg-gray-700" : "border-gray-300 bg-white")
                                )}>
                                  {editingUser.permissions.includes(permission) && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <span className={classNames(
                                "ml-2 text-xs font-medium",
                                "text-muted-foreground"
                              )}>
                                {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0 mt-6">
                    <button
                      type="button"
                      className={classNames(
                        "flex-1 px-4 py-2.5 border text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400/30",
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                      onClick={() => setEditingUser(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
                      onClick={() => {
                        if (editingUser) {
                          console.log('💾 Save Changes clicked. Current editingUser:', {
                            id: editingUser.id,
                            username: editingUser.username,
                            role: editingUser.role,
                            dashboardAccess: editingUser.dashboardAccess,
                            permissions: editingUser.permissions
                          });
                          handleUpdateUser(editingUser.id, editingUser);
                        }
                      }}
                    >
                      💾 Save Changes
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

const Admin: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['admin', 'system_admin', 'manage_users']}
      fallbackMessage="You need administrator privileges to access the user management panel."
    >
      <AdminContent />
    </PermissionGuard>
  );
};

export default Admin; 