import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { Warning } from '../types';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import ServerSelector from '../components/common/ServerSelector';
import PermissionGuard from '../components/common/PermissionGuard';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const itemsPerPage = 20;

  const fetchWarnings = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      // Don't send status in the API request - we'll filter client-side
      // This ensures we get all warnings and can count them correctly
      const options: any = {
        page: page,
        limit: itemsPerPage
      };
      
      if (selectedServerId) {
        options.guildId = selectedServerId;
      }

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
  }, [statusFilter, itemsPerPage, selectedServerId]);

  useEffect(() => {
    fetchWarnings(1);
  }, [fetchWarnings]);
  
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
        <span className={classNames(
          "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm",
          darkMode ? "bg-gray-800/50 text-gray-400 ring-1 ring-gray-600/50" : "bg-gray-100 text-gray-600 ring-1 ring-gray-200"
        )}>
          <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
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
    <div className={classNames(
      "min-h-screen p-6 space-y-6",
      darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
    )}>
      <div className="space-y-8">
        {/* Header */}
        <div className={classNames(
          'rounded-lg border p-6',
          darkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        )}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className={classNames(
                    'text-2xl font-bold',
                    darkMode ? 'text-white' : 'text-gray-900'
                  )}>
                    User Warnings
                  </h1>
              <p className={classNames(
                    'text-base mt-1',
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Review and manage user moderation actions
                  </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <ExclamationTriangleIcon className={classNames(
                  "h-5 w-5",
                  darkMode ? "text-gray-400" : "text-gray-500"
                )} />
                <label className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Filter by Server:
                </label>
              </div>
              <div className="w-64">
                <ServerSelector
                  selectedServerId={selectedServerId}
                  onServerSelect={(serverId) => {
                    setSelectedServerId(serverId);
                    setCurrentPage(1);
                  }}
                  placeholder="Select a server"
                  showAllOption={true}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end space-x-4">
            <button
              onClick={() => fetchWarnings(currentPage)}
              disabled={loading}
              className={classNames(
                "inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105",
                "text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
                darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white",
                loading ? "opacity-50 cursor-not-allowed" : ""
              )}
              title="Refresh warnings"
            >
              🔄 Refresh
            </button>
            <div className={classNames(
              'flex items-center px-3 py-1 rounded-lg text-sm',
              darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
            )}>
              Total: {totalWarnings}
            </div>
            <div className={classNames(
              'flex items-center px-3 py-1 rounded-lg text-sm',
              selectedWarnings.size > 0 
                ? (darkMode ? 'bg-primary-500/20 text-primary-400' : 'bg-primary-100 text-primary-600')
                : (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')
            )}>
              Selected: {selectedWarnings.size}
            </div>
          </div>
        </div>
      </div>

      <Card className={classNames(
        "shadow-xl border-0 rounded-xl overflow-hidden",
        darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
      )}>
        <div className={classNames(
          "p-6 border-b",
          darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
        )}>
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

        <div className={classNames(
          "p-6",
          darkMode ? "bg-gray-900" : "bg-white"
        )}>
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
              <div className="overflow-x-auto rounded-lg">
              <table className={classNames(
                  "min-w-full divide-y-2",
                darkMode ? "divide-gray-700" : "divide-gray-200"
              )}>
                <thead className={classNames(
                    "rounded-t-lg",
                    darkMode ? "bg-gray-800" : "bg-gray-100"
                )}>
                  <tr>
                      <th className="relative w-12 px-6 py-4 sm:w-16 sm:px-8">
                      <input
                        type="checkbox"
                        className={classNames(
                            "h-5 w-5 rounded border-2 text-blue-600 focus:ring-blue-500 focus:ring-2 transition-all duration-200",
                            darkMode ? "border-gray-500 bg-gray-700" : "border-gray-400 bg-white"
                        )}
                        checked={selectedWarnings.size > 0 && selectedWarnings.size === warnings.length}
                        onChange={selectAllWarnings}
                      />
                    </th>
                    <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                        🔢 Case #
                    </th>
                    <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                        🏠 Server
                    </th>
                    <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                        👤 User
                    </th>
                    <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                        📝 Reason
                    </th>
                    <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                        📊 Status
                    </th>
                    <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                        🛡️ Warned By
                    </th>
                    <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                        📅 Date
                    </th>
                    <th className={classNames(
                        "px-6 py-4 text-left text-sm font-bold uppercase tracking-wider",
                        darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                        ⚙️ Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={classNames(
                  "divide-y",
                    darkMode ? "bg-gray-900 divide-gray-800" : "bg-white divide-gray-100"
                )}>
                  {warnings.map((warning) => (
                    <tr 
                      key={warning.id} 
                      className={classNames(
                          "transition-all duration-200 hover:shadow-lg",
                        selectedWarnings.has(warning.id) 
                            ? darkMode ? 'bg-blue-900/30 ring-1 ring-blue-500' : 'bg-blue-50 ring-1 ring-blue-300'
                            : darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50',
                          'relative group'
                      )}
                    >
                        <td className="relative w-12 px-6 py-4 sm:w-16 sm:px-8">
                        {selectedWarnings.has(warning.id) && (
                            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 to-blue-600 rounded-r" />
                        )}
                        <input
                          type="checkbox"
                          className={classNames(
                              "h-5 w-5 rounded border-2 text-blue-600 focus:ring-blue-500 focus:ring-2 transition-all duration-200",
                              darkMode ? "border-gray-500 bg-gray-700" : "border-gray-400 bg-white"
                          )}
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
                              darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
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
                            className={classNames(
                                "inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg transition-all duration-200 transform hover:scale-105",
                                "text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
                                darkMode ? "focus:ring-offset-gray-900" : "focus:ring-offset-white"
                            )}
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

      {/* Bulk Remove Confirmation Modal */}
      <Transition appear show={isBulkRemoveConfirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={closeBulkRemoveConfirm}>
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
        <Dialog as="div" className="relative z-10" onClose={() => setShowRemoveModal(false)}>
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
                  darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
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
