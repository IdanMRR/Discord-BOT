import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams } from 'react-router-dom';
import { Warning } from '../types';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import PermissionGuard from '../components/common/PermissionGuard';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon as Shield,
  ClockIcon as Clock,
  UserMinusIcon as UserX,
  NoSymbolIcon as Ban,
  UsersIcon as Users,
  MinusIcon as UserMinus,
  PlusIcon as UserPlus,
  PlusIcon as Plus,
  TrashIcon as Trash2,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

// Helper function to check if a warning is active (handles different data types)
function isWarningActive(active: any): boolean {
  return active === true || active === 1 || active === '1' || active === 'true';
}

// Automod interfaces
interface AutomodSettings {
  id?: number;
  guild_id: string;
  enabled: boolean;
  reset_warnings_after_days: number;
  created_at?: string;
  updated_at?: string;
}

interface AutomodRule {
  id?: number;
  guild_id: string;
  warning_threshold: number;
  punishment_type: 'timeout' | 'kick' | 'ban' | 'role_remove' | 'role_add' | 'nothing';
  punishment_duration?: number;
  punishment_reason: string;
  role_id?: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

interface AutomodStats {
  totalRules: number;
  activeRules: number;
  totalActions: number;
  successfulActions: number;
  recentActions: number;
}

const WarningsContent: React.FC = () => {
  const { darkMode } = useTheme();
  const { settings, registerAutoRefresh } = useSettings();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalWarnings, setTotalWarnings] = useState(0);
  const [statusFilter] = useState<'all' | 'active' | 'removed'>('all');
  const [selectedWarningId, setSelectedWarningId] = useState<number | null>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [isBulkRemoveConfirmOpen, setIsBulkRemoveConfirmOpen] = useState(false);
  const [selectedWarnings, setSelectedWarnings] = useState<Set<number>>(new Set());
  const { serverId } = useParams<{ serverId: string }>();
  const itemsPerPage = 20;

  // Automod state
  const [automodSettings, setAutomodSettings] = useState<AutomodSettings | null>(null);
  const [automodRules, setAutomodRules] = useState<AutomodRule[]>([]);
  const [automodStats, setAutomodStats] = useState<AutomodStats | null>(null);
  const [automodLoading, setAutomodLoading] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [resetDaysInput, setResetDaysInput] = useState<string>('');
  
  // Update resetDaysInput when automodSettings changes
  useEffect(() => {
    if (automodSettings?.reset_warnings_after_days) {
      setResetDaysInput(automodSettings.reset_warnings_after_days.toString());
    } else if (automodSettings && typeof automodSettings.reset_warnings_after_days === 'number') {
      setResetDaysInput(automodSettings.reset_warnings_after_days.toString());
    } else {
      setResetDaysInput('30'); // Default value
    }
  }, [automodSettings]);
  const [newRule, setNewRule] = useState<Partial<AutomodRule>>({
    warning_threshold: 3,
    punishment_type: 'timeout',
    punishment_duration: 60,
    punishment_reason: 'Automatic punishment for excessive warnings',
    enabled: true
  });

  const fetchWarnings = useCallback(async (page: number = 1) => {
    if (!serverId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      // Don't send status in the API request - we'll filter client-side
      // This ensures we get all warnings and can count them correctly
      const options: any = {
        page: page,
        limit: itemsPerPage,
        guildId: serverId
      };

      const response = await apiService.getWarnings(options);
      
      if (response.success && response.data) {
        // Handle different response formats
        let warningsData: Warning[] = [];
        if (Array.isArray(response.data)) {
          warningsData = response.data;
        } else if (typeof response.data === 'object' && response.data !== null) {
          // Check if the data has a warnings property
          const responseObj = response.data as Record<string, any>;
          if (responseObj.warnings && Array.isArray(responseObj.warnings)) {
            warningsData = responseObj.warnings;
          } else {
            // Assume the data itself is the warnings array
            warningsData = response.data as unknown as Warning[];
          }
        } else {
          // Fallback to empty array if data format is unexpected
          warningsData = [];
        }
        
        // Count total warnings before filtering
        const totalActiveWarnings = warningsData.filter(warning => isWarningActive(warning.active)).length;
        const totalRemovedWarnings = warningsData.filter(warning => !isWarningActive(warning.active)).length;
        
        // Filter warnings based on status if needed
        const filteredWarnings = statusFilter === 'all'
          ? warningsData
          : statusFilter === 'active'
            ? warningsData.filter(warning => isWarningActive(warning.active))
            : warningsData.filter(warning => !isWarningActive(warning.active));
        
        // Set the warnings data
        setWarnings(filteredWarnings);
        
        // Set the total warnings count based on the filter
        if (statusFilter === 'all') {
          setTotalWarnings(warningsData.length);
        } else if (statusFilter === 'active') {
          setTotalWarnings(totalActiveWarnings);
        } else {
          setTotalWarnings(totalRemovedWarnings);
        }
        
        // Calculate pages based on filtered data
        const totalPages = Math.max(1, Math.ceil(filteredWarnings.length / itemsPerPage));
        setTotalPages(totalPages);
        setCurrentPage(Math.min(page, totalPages));
      } else {
        toast.error('Failed to fetch warnings');
      }
    } catch (error) {
      console.error('Error fetching warnings:', error);
      toast.error('Failed to fetch warnings');
    } finally {
      setLoading(false);
      // Clear selections when changing pages
      setSelectedWarnings(new Set());
    }
  }, [statusFilter, itemsPerPage, serverId]);

  // Fetch automod data
  const fetchAutomodData = useCallback(async () => {
    if (!serverId) return;
    
    try {
      setAutomodLoading(true);
      const [settingsRes, rulesRes, statsRes] = await Promise.all([
        apiService.getAutomodSettings(serverId),
        apiService.getAutomodRules(serverId),
        apiService.getAutomodStats(serverId)
      ]);

      setAutomodSettings(settingsRes.data);
      setAutomodRules(rulesRes.data || []);
      setAutomodStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching automod data:', error);
      toast.error('Failed to load automod data');
    } finally {
      setAutomodLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchWarnings(1);
    fetchAutomodData();
  }, [fetchWarnings, fetchAutomodData]);
  
  // Register auto-refresh
  useEffect(() => {
    if (settings.autoRefresh) {
      const unregister = registerAutoRefresh('warnings-page', () => {
        console.log('Auto-refreshing warnings...');
        fetchWarnings(currentPage);
      });

      return unregister;
    }
  }, [settings.autoRefresh, registerAutoRefresh, fetchWarnings, currentPage]);
  
  // Toggle warning selection
  const toggleWarningSelection = (warningId: number) => {
    setSelectedWarnings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(warningId)) {
        newSet.delete(warningId);
      } else {
        newSet.add(warningId);
      }
      return newSet;
    });
  };
  
  // Select all warnings on current page
  const selectAllWarnings = () => {
    if (selectedWarnings.size === warnings.length) {
      // If all are selected, deselect all
      setSelectedWarnings(new Set());
    } else {
      // Otherwise select all
      setSelectedWarnings(new Set(warnings.map(w => w.id)));
    }
  };
  
  // Open bulk remove confirmation
  const openBulkRemoveConfirm = () => {
    if (selectedWarnings.size === 0) return;
    setIsBulkRemoveConfirmOpen(true);
  };
  
  // Close bulk remove confirmation
  const closeBulkRemoveConfirm = () => {
    setIsBulkRemoveConfirmOpen(false);
  };
  
  // Confirm bulk remove
  const confirmBulkRemove = async () => {
    if (selectedWarnings.size === 0) {
      closeBulkRemoveConfirm();
      return;
    }
    
    try {
      const results = await Promise.allSettled(
        Array.from(selectedWarnings).map(id => 
          apiService.removeWarning(id, 'Bulk removal from dashboard')
        )
      );
      
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      const errorCount = results.length - successCount;
      
      if (errorCount > 0) {
        toast.success(`Successfully removed ${successCount} warnings. ${errorCount} failed.`);
      } else {
        toast.success(`Successfully removed ${successCount} warnings.`);
      }
      
      // Refresh the warning list
      setSelectedWarnings(new Set());
      fetchWarnings(currentPage);
    } catch (error) {
      console.error('Error in bulk remove:', error);
      toast.error('An error occurred during bulk removal');
    } finally {
      closeBulkRemoveConfirm();
    }
  };

  // Automod management functions
  const updateAutomodSettings = async (updatedSettings: Partial<AutomodSettings>) => {
    if (!serverId) return;
    try {
      // Update local state immediately for better UX
      setAutomodSettings(prev => prev ? { ...prev, ...updatedSettings } : null);
      
      const response = await apiService.updateAutomodSettings(serverId, updatedSettings);
      
      // Only update with response if it contains complete data
      if (response.success && response.data && typeof response.data === 'object') {
        setAutomodSettings(response.data);
      }
      
      toast.success('Automod settings updated successfully');
    } catch (error) {
      console.error('Error updating automod settings:', error);
      toast.error('Failed to update automod settings');
      
      // Revert local state on error
      fetchAutomodData();
    }
  };

  const createAutomodRule = async () => {
    if (!serverId) return;
    
    try {
      const response = await apiService.createAutomodRule(serverId, newRule);
      setAutomodRules([...automodRules, response.data]);
      setShowAddRule(false);
      setNewRule({
        warning_threshold: 3,
        punishment_type: 'timeout',
        punishment_duration: 60,
        punishment_reason: 'Automatic punishment for excessive warnings',
        enabled: true
      });
      fetchAutomodData();
      toast.success('Automod rule created successfully');
    } catch (error) {
      console.error('Error creating automod rule:', error);
      toast.error('Failed to create automod rule');
    }
  };

  const deleteAutomodRule = async (ruleId: number) => {
    if (!serverId || !window.confirm('Are you sure you want to delete this automod rule?')) return;
    
    try {
      await apiService.deleteAutomodRule(serverId, ruleId);
      setAutomodRules(automodRules.filter(rule => rule.id !== ruleId));
      fetchAutomodData();
      toast.success('Automod rule deleted successfully');
    } catch (error) {
      console.error('Error deleting automod rule:', error);
      toast.error('Failed to delete automod rule');
    }
  };

  // Helper functions for automod UI
  const getPunishmentIcon = (type: string) => {
    switch (type) {
      case 'timeout': return <Clock className="w-4 h-4" />;
      case 'kick': return <UserX className="w-4 h-4" />;
      case 'ban': return <Ban className="w-4 h-4" />;
      case 'role_remove': return <UserMinus className="w-4 h-4" />;
      case 'role_add': return <UserPlus className="w-4 h-4" />;
      default: return <ExclamationTriangleIcon className="w-4 h-4" />;
    }
  };

  const getPunishmentColor = (type: string) => {
    switch (type) {
      case 'timeout': return 'bg-yellow-100 text-yellow-800';
      case 'kick': return 'bg-orange-100 text-orange-800';
      case 'ban': return 'bg-red-100 text-red-800';
      case 'role_remove': return 'bg-purple-100 text-purple-800';
      case 'role_add': return 'bg-blue-100 text-blue-800';
      default: return 'bg-muted/50 text-muted-foreground';
    }
  };

  const formatPunishmentType = (type: string) => {
    switch (type) {
      case 'timeout': return 'Timeout';
      case 'kick': return 'Kick';
      case 'ban': return 'Ban';
      case 'role_remove': return 'Remove Role';
      case 'role_add': return 'Add Role';
      case 'nothing': return 'Warning Only';
      default: return type;
    }
  };

  const handlePageChange = (page: number) => {
    fetchWarnings(page);
  };

  const formatDate = (dateString: string) => {
    // Create a date object from the input string
    const date = new Date(dateString);
    
    // Force the date to be interpreted as UTC
    const utcYear = date.getUTCFullYear();
    const utcMonth = date.getUTCMonth();
    const utcDay = date.getUTCDate();
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const utcSeconds = date.getUTCSeconds();
    
    // Create a new date object with the UTC values
    const utcDate = new Date(Date.UTC(utcYear, utcMonth, utcDay, utcHours, utcMinutes, utcSeconds));
    
    // Add 3 hours for Israeli time (UTC+3)
    const israeliTime = new Date(utcDate.getTime() + (3 * 60 * 60 * 1000));
    
    // Format the date in Israeli style (DD.MM.YYYY, HH:MM)
    const day = israeliTime.getDate().toString().padStart(2, '0');
    const month = (israeliTime.getMonth() + 1).toString().padStart(2, '0');
    const year = israeliTime.getFullYear();
    const hours = israeliTime.getHours().toString().padStart(2, '0');
    const minutes = israeliTime.getMinutes().toString().padStart(2, '0');
    
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  };

  const getStatusBadge = (active: any) => {
    if (isWarningActive(active)) {
      return (
        <span className={classNames(
          "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm",
          darkMode ? "bg-green-900/30 text-green-300 ring-1 ring-green-500/50" : "bg-green-100 text-green-800 ring-1 ring-green-200"
        )}>
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
          ✅ Active
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm bg-muted text-muted-foreground ring-1 ring-border">
          <div className="w-2 h-2 bg-muted-foreground rounded-full mr-2"></div>
          ❌ Removed
        </span>
      );
    }
  };

  const handleRemoveWarning = async () => {
    if (!selectedWarningId) return;
    
    try {
      const response = await apiService.removeWarning(selectedWarningId, removalReason);
      
      if (response.success) {
        toast.success('Warning removed successfully');
        setShowRemoveModal(false);
        setRemovalReason('');
        fetchWarnings(currentPage);
      } else {
        toast.error(`Failed to remove warning: ${response.error}`);
      }
    } catch (error) {
      console.error('Error removing warning:', error);
      toast.error('Failed to remove warning');
    }
  };
  
  const openRemoveModal = (warningId: number) => {
    setSelectedWarningId(warningId);
    setRemovalReason('');
    setShowRemoveModal(true);
  };

  return (
    <div className="page-container p-6 space-y-6">
      <div className="space-y-8">
        {/* Header */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="card-title text-2xl font-bold">
                    User Warnings
                  </h1>
              <p className="card-description text-base mt-1">
                    Review and manage user moderation actions
                  </p>
            </div>
          </div>
          <div className="flex items-center justify-end space-x-4">
            <button
              onClick={() => fetchWarnings(currentPage)}
              disabled={loading}
              className={classNames(
                "btn-refresh",
                loading ? "spinning" : ""
              )}
              title="Refresh warnings"
            >
              <ArrowPathIcon className="icon" />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <div className={classNames(
              'flex items-center px-3 py-1 rounded-lg text-sm',
              darkMode ? 'bg-muted text-muted-foreground' : 'bg-muted/30 text-muted-foreground'
            )}>
              Total: {totalWarnings}
            </div>
            <div className={classNames(
              'flex items-center px-3 py-1 rounded-lg text-sm',
              selectedWarnings.size > 0 
                ? (darkMode ? 'bg-primary-500/20 text-primary-400' : 'bg-primary-100 text-primary-600')
                : (darkMode ? 'bg-muted text-muted-foreground' : 'bg-muted/30 text-muted-foreground')
            )}>
              Selected: {selectedWarnings.size}
            </div>
          </div>
        </div>
      </div>


        <Card className="content-area shadow-xl border-0 rounded-xl overflow-hidden ring-1 ring-border">
        <div className="p-6 border-b border-border bg-muted/50">
          <div className="flex items-center justify-between">
          <div>
            <h3 className={classNames(
                "text-xl font-semibold",
                darkMode ? "text-white" : "text-gray-900"
              )}>Warnings Overview</h3>
            <span className={classNames(
                "text-sm font-medium",
                darkMode ? "text-gray-300" : "text-gray-600"
              )}>
                {totalWarnings} total warnings • 
                {statusFilter === 'all' 
                  ? ` ${warnings.filter(w => isWarningActive(w.active)).length} active, ${warnings.filter(w => !isWarningActive(w.active)).length} removed`
                  : ` ${warnings.length} ${statusFilter}`
                }
              </span>
          </div>
          {selectedWarnings.size > 0 && (
              <div className="flex items-center space-x-4">
              <span className={classNames(
                  "text-sm font-medium px-3 py-1 rounded-full",
                  darkMode ? "text-blue-300 bg-blue-900/30" : "text-blue-700 bg-blue-100"
              )}>{selectedWarnings.size} selected</span>
              <button
                onClick={openBulkRemoveConfirm}
                className={classNames(
                    "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105",
                    "text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
                    darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                )}
              >
                  🗑️ Remove Selected
              </button>
            </div>
          )}
          </div>
        </div>

        <div className="p-6 bg-card">
        {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner className="text-blue-500" size="lg" />
              <span className={classNames(
                "ml-3 text-lg",
                darkMode ? "text-gray-300" : "text-gray-600"
              )}>Loading warnings...</span>
            </div>
        ) : warnings.length === 0 ? (
            <div className="text-center py-16">
          <div className={classNames(
                "text-6xl mb-4",
                darkMode ? "text-gray-600" : "text-gray-400"
              )}>⚠️</div>
              <h3 className={classNames(
                "text-xl font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>No warnings found</h3>
              <p className={classNames(
                "text-sm",
            darkMode ? "text-gray-400" : "text-gray-500"
          )}>
                {statusFilter === 'all' 
                  ? "No warnings have been issued yet." 
                  : `No ${statusFilter} warnings found.`
                }
              </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[65vh] overflow-auto rounded-lg">
              <table className={classNames(
                  "min-w-full divide-y-2",
                darkMode ? "divide-gray-700" : "divide-gray-200"
              )}>
                <thead className="sticky top-0 z-10 rounded-t-lg bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
                  <tr>
                      <th className="relative w-12 px-6 py-4 sm:w-16 sm:px-8">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-2 text-primary border-input bg-background focus:ring-primary focus:ring-2 transition-all duration-200"
                        checked={selectedWarnings.size > 0 && selectedWarnings.size === warnings.length}
                        onChange={selectAllWarnings}
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        🔢 Case #
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        🏠 Server
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        👤 User
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        📝 Reason
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        📊 Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        🛡️ Warned By
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        📅 Date
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        ⚙️ Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {warnings.map((warning) => (
                    <tr 
                      key={warning.id} 
                      className={classNames(
                          "transition-all duration-200 hover:shadow-lg relative group odd:bg-muted/30",
                        selectedWarnings.has(warning.id) 
                            ? 'bg-primary/10 ring-1 ring-primary/30'
                            : 'hover:bg-muted/50'
                      )}
                    >
                        <td className="relative w-12 px-6 py-4 sm:w-16 sm:px-8">
                        {selectedWarnings.has(warning.id) && (
                            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-primary/80 rounded-r" />
                        )}
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-2 text-primary border-input bg-background focus:ring-primary focus:ring-2 transition-all duration-200"
                          checked={selectedWarnings.has(warning.id)}
                          onChange={() => toggleWarningSelection(warning.id)}
                            disabled={!isWarningActive(warning.active)}
                        />
                      </td>
                      <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm font-bold",
                          darkMode ? "text-blue-400" : "text-blue-600"
                      )}>
                        {(warning as any).case_number ? `#${(warning as any).case_number}` : 'N/A'}
                      </td>
                      <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm font-medium",
                          darkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        {(warning as any).server_name || (warning as any).guild_name || 'Unknown Server'}
                      </td>
                      <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm font-semibold",
                        darkMode ? "text-gray-100" : "text-gray-900"
                      )}>
                          <div className="flex items-center space-x-2">
                            <div className={classNames(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                              darkMode ? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              {((warning as any).username || `User ${warning.user_id}`).charAt(0).toUpperCase()}
                            </div>
                            <span>{(warning as any).username || `User ${warning.user_id}`}</span>
                          </div>
                      </td>
                      <td className={classNames(
                          "px-6 py-4 text-sm max-w-xs",
                          darkMode ? "text-gray-200" : "text-gray-900"
                      )}>
                          <div className="truncate group-hover:whitespace-normal transition-all duration-200">
                        {warning.reason}
                          </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(warning.active)}
                      </td>
                      <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm font-medium",
                          darkMode ? "text-gray-300" : "text-gray-600"
                      )}>
                        {(warning as any).adminUsername || (warning as any).moderator_name || warning.moderator_id}
                      </td>
                      <td className={classNames(
                        "px-6 py-4 whitespace-nowrap text-sm",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>
                        {formatDate(warning.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {isWarningActive(warning.active) && (
                          <button
                            onClick={() => openRemoveModal(warning.id)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 transform hover:scale-105 text-white bg-gradient-to-r from-destructive to-destructive/90 hover:from-destructive/90 hover:to-destructive focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:ring-offset-2 shadow-sm"
                          >
                              🗑️ Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  itemsPerPage={itemsPerPage}
                  totalItems={totalWarnings}
                />
              </div>
            )}
          </>
        )}
        </div>
      </Card>

      {/* Automod Escalation Section */}
      <Card className="content-area shadow-xl border-0 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className={classNames(
                  "text-xl font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Automod Escalation
                </h3>
                <p className={classNames(
                  "text-sm",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Configure automatic punishments based on warning thresholds
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-card">
          {automodLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner className="text-blue-500" size="lg" />
              <span className={classNames(
                "ml-3",
                darkMode ? "text-gray-300" : "text-gray-600"
              )}>Loading automod settings...</span>
            </div>
          ) : (
            <div className="space-y-6">
                {/* Stats Cards */}
                {automodStats && (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="content-area p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={classNames(
                            "text-sm font-medium",
                            darkMode ? "text-gray-400" : "text-gray-600"
                          )}>Total Rules</p>
                          <p className={classNames(
                            "text-2xl font-bold",
                            darkMode ? "text-white" : "text-gray-900"
                          )}>{automodStats.totalRules}</p>
                        </div>
                        <Users className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                    
                    <div className="content-area p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={classNames(
                            "text-sm font-medium",
                            darkMode ? "text-gray-400" : "text-gray-600"
                          )}>Active Rules</p>
                          <p className="text-2xl font-bold text-green-600">{automodStats.activeRules}</p>
                        </div>
                        <Shield className="w-8 h-8 text-green-600" />
                      </div>
                    </div>

                    <div className="content-area p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={classNames(
                            "text-sm font-medium",
                            darkMode ? "text-gray-400" : "text-gray-600"
                          )}>Total Actions</p>
                          <p className={classNames(
                            "text-2xl font-bold",
                            darkMode ? "text-white" : "text-gray-900"
                          )}>{automodStats.totalActions}</p>
                        </div>
                        <ExclamationTriangleIcon className="w-8 h-8 text-orange-600" />
                      </div>
                    </div>

                    <div className="content-area p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={classNames(
                            "text-sm font-medium",
                            darkMode ? "text-gray-400" : "text-gray-600"
                          )}>Success Rate</p>
                          <p className="text-2xl font-bold text-green-600">
                            {automodStats.totalActions > 0 ? Math.round((automodStats.successfulActions / automodStats.totalActions) * 100) : 0}%
                          </p>
                        </div>
                        <Shield className="w-8 h-8 text-green-600" />
                      </div>
                    </div>

                    <div className="content-area p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={classNames(
                            "text-sm font-medium",
                            darkMode ? "text-gray-400" : "text-gray-600"
                          )}>Recent (24h)</p>
                          <p className="text-2xl font-bold text-blue-600">{automodStats.recentActions}</p>
                        </div>
                        <Clock className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Settings */}
                {automodSettings && (
                  <div className="content-area p-4 rounded-lg">
                    <h4 className={classNames(
                      "text-lg font-medium mb-4",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Settings</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className={classNames(
                            "text-sm font-medium",
                            darkMode ? "text-gray-300" : "text-gray-700"
                          )}>Enable Automod Escalation</label>
                          <p className={classNames(
                            "text-sm",
                            darkMode ? "text-gray-400" : "text-gray-500"
                          )}>Automatically punish users based on warning count</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={automodSettings.enabled || false}
                            onChange={(e) => updateAutomodSettings({ enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className={classNames(
                            "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all",
                            darkMode 
                              ? "bg-gray-700 peer-checked:bg-blue-600 peer-focus:ring-blue-800" 
                              : "peer-checked:bg-blue-600"
                          )}></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className={classNames(
                            "text-sm font-medium",
                            darkMode ? "text-gray-300" : "text-gray-700"
                          )}>Reset warnings after (days)</label>
                          <input
                            type="number"
                            value={resetDaysInput}
                            onChange={(e) => {
                              const value = e.target.value;
                              setResetDaysInput(value);
                            }}
                            onBlur={(e) => {
                              const value = parseInt(e.target.value);
                              if (!isNaN(value) && value >= 1 && value <= 365) {
                                updateAutomodSettings({ reset_warnings_after_days: value });
                              } else {
                                // Reset to current value if invalid
                                setResetDaysInput(automodSettings?.reset_warnings_after_days?.toString() || '30');
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const value = parseInt(e.currentTarget.value);
                                if (!isNaN(value) && value >= 1 && value <= 365) {
                                  updateAutomodSettings({ reset_warnings_after_days: value });
                                }
                              }
                            }}
                            min="1"
                            max="365"
                            placeholder="Enter number of days"
                            className={classNames(
                              "mt-2 block w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
                              darkMode 
                                ? "input-field text-white placeholder-gray-400 hover:border-gray-500" 
                                : "input-field text-gray-900 placeholder-gray-500 hover:border-gray-300"
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rules */}
                <div className="content-area p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className={classNames(
                      "text-lg font-medium",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Escalation Rules</h4>
                    <button
                      onClick={() => setShowAddRule(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Rule
                    </button>
                  </div>
                  
                  {automodRules.length === 0 ? (
                    <div className="text-center py-8">
                      <ExclamationTriangleIcon className={classNames(
                        "w-12 h-12 mx-auto mb-4",
                        darkMode ? "text-gray-600" : "text-gray-400"
                      )} />
                      <h5 className={classNames(
                        "text-lg font-medium mb-2",
                        darkMode ? "text-gray-300" : "text-gray-900"
                      )}>No Rules Configured</h5>
                      <p className={classNames(
                        "mb-4",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Create your first escalation rule to get started</p>
                      <button
                        onClick={() => setShowAddRule(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Rule
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {automodRules.map((rule) => (
                        <div key={rule.id} className={classNames(
                          "border rounded-lg p-4 flex items-center justify-between",
                          darkMode ? "border-gray-600" : "border-gray-200"
                        )}>
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${getPunishmentColor(rule.punishment_type)}`}>
                              {getPunishmentIcon(rule.punishment_type)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={classNames(
                                  "font-medium",
                                  darkMode ? "text-white" : "text-gray-900"
                                )}>
                                  {rule.warning_threshold} warning{rule.warning_threshold !== 1 ? 's' : ''}
                                </span>
                                <span className={classNames(
                                  darkMode ? "text-gray-400" : "text-gray-500"
                                )}>→</span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPunishmentColor(rule.punishment_type)}`}>
                                  {formatPunishmentType(rule.punishment_type)}
                                  {rule.punishment_duration && ` (${rule.punishment_duration}min)`}
                                </span>
                                {!rule.enabled && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                    Disabled
                                  </span>
                                )}
                              </div>
                              <p className={classNames(
                                "text-sm mt-1",
                                darkMode ? "text-gray-400" : "text-gray-600"
                              )}>{rule.punishment_reason}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => rule.id && deleteAutomodRule(rule.id)}
                              className={classNames(
                                "p-2 hover:text-red-600",
                                darkMode ? "text-red-400" : "text-red-400"
                              )}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            </div>
          )}
        </div>
      </Card>

      {/* Bulk Remove Confirmation Modal */}
      <Transition appear show={isBulkRemoveConfirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[9999]" onClose={closeBulkRemoveConfirm}>
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
              "fixed inset-0 bg-black bg-opacity-25",
              darkMode ? "bg-opacity-75" : ""
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
                  "w-full max-w-md transform overflow-hidden rounded-2xl p-6 text-left align-middle shadow-xl transition-all",
                  darkMode ? "bg-gray-800" : "bg-white"
                )}>
                  <Dialog.Title
                    as="h3"
                    className={classNames(
                      "text-lg font-medium leading-6 flex justify-between items-center",
                      darkMode ? "text-gray-100" : "text-gray-900"
                    )}
                  >
                    <span>Remove {selectedWarnings.size} Warnings</span>
                    <button
                      type="button"
                      className={classNames(
                        "rounded-md text-gray-400 hover:text-gray-500",
                        darkMode ? "hover:text-gray-300" : ""
                      )}
                      onClick={closeBulkRemoveConfirm}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className={classNames(
                      "text-sm",
                      darkMode ? "text-gray-400" : "text-gray-500"
                    )}>
                      Are you sure you want to remove {selectedWarnings.size} selected warnings? This action cannot be undone.
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      className={classNames(
                        "inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium focus:outline-none",
                        darkMode ? "bg-gray-700 text-gray-100 hover:bg-gray-600" : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                      )}
                      onClick={closeBulkRemoveConfirm}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      onClick={confirmBulkRemove}
                    >
                      Remove {selectedWarnings.size} Warnings
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Remove Warning Modal */}
      <Transition appear show={showRemoveModal} as={Fragment}>
        <Dialog as="div" className="relative z-[9999]" onClose={() => setShowRemoveModal(false)}>
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
                  "w-full max-w-3xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all",
                  "content-area"
                )}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className={classNames(
                        "w-16 h-16 rounded-full flex items-center justify-center mr-6",
                        darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"
                      )}>
                        <span className="text-3xl">🗑️</span>
                      </div>
                      <div>
                        <Dialog.Title
                          as="h3"
                          className={classNames(
                            "text-2xl font-bold",
                            darkMode ? "text-gray-100" : "text-gray-900"
                          )}
                        >
                          Remove Warning
                        </Dialog.Title>
                        <p className={classNames(
                          "text-sm mt-1",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          This action cannot be undone
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={classNames(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200",
                        darkMode 
                          ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700" 
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      )}
                      onClick={() => setShowRemoveModal(false)}
                    >
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className={classNames(
                    "p-6 rounded-xl mb-6",
                    darkMode ? "bg-gray-700/30" : "bg-gray-50"
                  )}>
                    <p className={classNames(
                      "text-base leading-relaxed",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Please provide a reason for removing this warning. This action will be logged for audit purposes and cannot be undone.
                    </p>
                  </div>

                  {/* Form */}
                  <div className="mb-8">
                    <label className={classNames(
                      "block text-base font-semibold mb-4",
                      darkMode ? "text-gray-200" : "text-gray-700"
                    )}>
                      Reason for removal
                      <span className={classNames(
                        "ml-2 text-sm font-normal",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>(optional)</span>
                    </label>
                    <textarea
                      className={classNames(
                        "w-full px-6 py-4 rounded-xl border-2 shadow-sm focus:outline-none focus:ring-3 focus:border-blue-500 transition-all duration-200 text-base resize-none",
                        darkMode 
                          ? "bg-gray-700 text-gray-100 border-gray-600 placeholder-gray-400 focus:ring-blue-500/30" 
                          : "bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:ring-blue-500/30"
                      )}
                      rows={4}
                      value={removalReason}
                      onChange={(e) => setRemovalReason(e.target.value)}
                      placeholder="Enter reason for removal (e.g., warning was issued in error, user appealed successfully, etc.)"
                    />
                    <div className={classNames(
                      "mt-2 text-sm",
                      darkMode ? "text-gray-400" : "text-gray-500"
                    )}>
                      {removalReason.length}/1000 characters
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
                    <button
                      type="button"
                      className={classNames(
                        "flex-1 px-8 py-4 border-2 text-base font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-gray-500/30",
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                      onClick={() => setShowRemoveModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-8 py-4 border border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-3 focus:ring-red-500/30 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                      onClick={handleRemoveWarning}
                    >
                      🗑️ Remove Warning
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Add Automod Rule Modal */}
      <Transition appear show={showAddRule} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowAddRule(false)}>
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
              "fixed inset-0 backdrop-blur-sm",
              darkMode ? "bg-gray-900/80" : "bg-black/60"
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
                  "w-full max-w-lg transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all",
                  "content-area"
                )}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-full bg-blue-500/10">
                      <svg className={classNames("h-6 w-6", darkMode ? "text-blue-400" : "text-blue-600")} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className={classNames(
                        "text-xl font-semibold",
                        darkMode ? "text-white" : "text-gray-900"
                      )}>
                        Add Escalation Rule
                      </h3>
                      <p className={classNames(
                        "text-sm mt-1",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Configure automatic punishment rules</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddRule(false)}
                    className={classNames(
                      "p-2 rounded-lg transition-colors",
                      darkMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"
                    )}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Info Box */}
                <div className={classNames(
                  "p-4 rounded-lg mb-6",
                  darkMode ? "bg-gray-700/50" : "bg-gray-50"
                )}>
                  <p className={classNames(
                    "text-sm",
                    darkMode ? "text-gray-300" : "text-gray-600"
                  )}>Create a rule that automatically applies punishment when a user reaches a specific warning threshold. This action will be logged for audit purposes.</p>
                </div>
                  <div className="space-y-4">
                    <div>
                      <label className={classNames(
                        "text-sm font-medium",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>Warning Threshold</label>
                      <input
                        type="number"
                        value={newRule.warning_threshold || ''}
                        onChange={(e) => setNewRule({ ...newRule, warning_threshold: parseInt(e.target.value) })}
                        min="1"
                        placeholder="Number of warnings"
                        className={classNames(
                          "mt-2 block w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
                          darkMode 
                            ? "input-field text-white placeholder-gray-400 hover:border-gray-500" 
                            : "input-field text-gray-900 placeholder-gray-500 hover:border-gray-300"
                        )}
                      />
                    </div>

                    <div>
                      <label className={classNames(
                        "text-sm font-medium",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>Punishment Type</label>
                      <select
                        value={newRule.punishment_type || ''}
                        onChange={(e) => setNewRule({ ...newRule, punishment_type: e.target.value as any })}
                        className={classNames(
                          "mt-2 block w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none bg-no-repeat bg-right pr-10",
                          darkMode 
                            ? "input-field text-white hover:border-gray-500" 
                            : "input-field text-gray-900 hover:border-gray-300",
                          "bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzZCNzI4MCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                        )}
                      >
                        <option value="timeout">Timeout</option>
                        <option value="kick">Kick</option>
                        <option value="ban">Ban</option>
                        <option value="role_remove">Remove Role</option>
                        <option value="role_add">Add Role</option>
                        <option value="nothing">Warning Only</option>
                      </select>
                    </div>

                    {newRule.punishment_type === 'timeout' && (
                      <div>
                        <label className={classNames(
                          "text-sm font-medium",
                          darkMode ? "text-gray-300" : "text-gray-700"
                        )}>Duration (minutes)</label>
                        <input
                          type="number"
                          value={newRule.punishment_duration || ''}
                          onChange={(e) => setNewRule({ ...newRule, punishment_duration: parseInt(e.target.value) })}
                          min="1"
                          placeholder="Timeout duration in minutes"
                          className={classNames(
                            "mt-2 block w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
                            darkMode 
                              ? "input-field text-white placeholder-gray-400 hover:border-gray-500" 
                              : "input-field text-gray-900 placeholder-gray-500 hover:border-gray-300"
                          )}
                        />
                      </div>
                    )}

                    <div>
                      <label className={classNames(
                        "text-sm font-medium",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>Reason</label>
                      <input
                        value={newRule.punishment_reason || ''}
                        onChange={(e) => setNewRule({ ...newRule, punishment_reason: e.target.value })}
                        placeholder="Reason for the punishment"
                        className={classNames(
                          "mt-2 block w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
                          darkMode 
                            ? "input-field text-white placeholder-gray-400 hover:border-gray-500" 
                            : "input-field text-gray-900 placeholder-gray-500 hover:border-gray-300"
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className={classNames(
                        "text-sm font-medium",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>Enabled</label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newRule.enabled !== false}
                          onChange={(e) => setNewRule({ ...newRule, enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className={classNames(
                          "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all",
                          darkMode 
                            ? "bg-gray-700 peer-checked:bg-blue-600 peer-focus:ring-blue-800" 
                            : "peer-checked:bg-blue-600"
                        )}></div>
                      </label>
                    </div>

                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-6">
                  <button
                    onClick={() => setShowAddRule(false)}
                    className={classNames(
                      "flex-1 px-6 py-3 text-sm font-medium rounded-lg border transition-colors",
                      darkMode 
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createAutomodRule}
                    className="flex-1 inline-flex justify-center items-center px-6 py-3 text-sm font-medium rounded-lg transition-all text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Create Rule
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

const Warnings: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['view_warnings', 'manage_warnings', 'admin']}
      fallbackMessage="You need warning management permissions to access this page."
    >
      <WarningsContent />
    </PermissionGuard>
  );
};

export default Warnings;
