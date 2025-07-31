import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import {
  XMarkIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface AutoRole {
  roleId: string;
  roleName: string;
  level?: number;
  condition: 'join' | 'level' | 'reaction' | 'time';
  description: string;
}

interface RolesConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
}

const RolesConfigModal: React.FC<RolesConfigModalProps> = ({
  isOpen,
  onClose,
  serverId
}) => {
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [roles, setRoles] = useState<any[]>([]);
  const [autoRoles, setAutoRoles] = useState<AutoRole[]>([]);
  const [enableAutoRoles, setEnableAutoRoles] = useState<boolean>(true);
  const [joinRole, setJoinRole] = useState<string>('');
  const [mutedRole, setMutedRole] = useState<string>('');
  const [modRole, setModRole] = useState<string>('');
  const [adminRole, setAdminRole] = useState<string>('');

  const loadRolesConfig = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load server roles
      const rolesResponse = await apiService.getServerChannelsAndRoles(serverId);
      if (rolesResponse.success && rolesResponse.data) {
        setRoles(rolesResponse.data.roles || []);
      }
      
      // Load auto-roles configuration
      const configResponse = await apiService.getAutoRolesConfig(serverId);
      if (configResponse.success && configResponse.data) {
        setAutoRoles(configResponse.data.autoRoles || []);
        setEnableAutoRoles(configResponse.data.enabled || true);
        setJoinRole(configResponse.data.joinRole || '');
        setMutedRole(configResponse.data.mutedRole || '');
        setModRole(configResponse.data.modRole || '');
        setAdminRole(configResponse.data.adminRole || '');
      }
    } catch (error) {
      console.error('Error loading roles config:', error);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  // Load existing configuration
  useEffect(() => {
    if (isOpen && serverId) {
      loadRolesConfig();
    }
  }, [isOpen, serverId, loadRolesConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await apiService.saveAutoRolesConfig(serverId, {
        enabled: enableAutoRoles,
        autoRoles,
        joinRole,
        mutedRole,
        modRole,
        adminRole
      });
      
      if (response.success) {
        toast.success('Roles configuration saved!');
        onClose();
      } else {
        toast.error('Failed to save roles configuration');
      }
    } catch (error) {
      console.error('Error saving roles config:', error);
      toast.error('Failed to save roles configuration');
    } finally {
      setSaving(false);
    }
  };

  const addAutoRole = () => {
    setAutoRoles([
      ...autoRoles,
      {
        roleId: '',
        roleName: '',
        condition: 'join',
        description: 'New auto role'
      }
    ]);
  };

  const updateAutoRole = (index: number, updates: Partial<AutoRole>) => {
    const newAutoRoles = [...autoRoles];
    newAutoRoles[index] = { ...newAutoRoles[index], ...updates };
    
    // Update role name when role ID changes
    if (updates.roleId) {
      const role = roles.find(r => r.id === updates.roleId);
      if (role) {
        newAutoRoles[index].roleName = role.name;
      }
    }
    
    setAutoRoles(newAutoRoles);
  };

  const removeAutoRole = (index: number) => {
    setAutoRoles(autoRoles.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        {/* Backdrop */}
        <div 
          className={classNames(
            "fixed inset-0 backdrop-blur-md",
            darkMode ? "bg-black/95" : "bg-black/90"
          )}
        />
        
        {/* Modal Content */}
        <div className="relative">
      <div 
        className={classNames(
          "max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-xl",
          darkMode ? "bg-gray-800" : "bg-white"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={classNames(
          "flex items-center justify-between p-6 border-b",
          darkMode ? "border-gray-700" : "border-gray-200"
        )}>
          <div>
            <h2 className={classNames(
              "text-2xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              👥 Roles & Auto-Roles Configuration
            </h2>
            <p className={classNames(
              "text-sm mt-1",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              Manage server roles and automatic role assignment
            </p>
          </div>
          <button
            onClick={onClose}
            className={classNames(
              "p-2 rounded-lg transition-colors",
              darkMode 
                ? "hover:bg-gray-700 text-gray-400 hover:text-gray-200" 
                : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            )}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className={classNames(
              "mt-4",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              Loading roles configuration...
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Enable Auto-Roles */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="enableAutoRoles"
                checked={enableAutoRoles}
                onChange={(e) => setEnableAutoRoles(e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="enableAutoRoles" className={classNames(
                "font-medium",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Enable Auto-Roles System
              </label>
            </div>

            {/* Staff Roles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Moderator Role
                </label>
                <select
                  value={modRole}
                  onChange={(e) => setModRole(e.target.value)}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-purple-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-purple-500",
                    "focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  )}
                >
                  <option value="">-- Select Role --</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      @{role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Administrator Role
                </label>
                <select
                  value={adminRole}
                  onChange={(e) => setAdminRole(e.target.value)}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-purple-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-purple-500",
                    "focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  )}
                >
                  <option value="">-- Select Role --</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      @{role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Join Role (Auto-assigned)
                </label>
                <select
                  value={joinRole}
                  onChange={(e) => setJoinRole(e.target.value)}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-purple-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-purple-500",
                    "focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  )}
                >
                  <option value="">-- Select Role --</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      @{role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Muted Role
                </label>
                <select
                  value={mutedRole}
                  onChange={(e) => setMutedRole(e.target.value)}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-purple-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-purple-500",
                    "focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  )}
                >
                  <option value="">-- Select Role --</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      @{role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto-Roles */}
            {enableAutoRoles && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={classNames(
                    "text-lg font-semibold",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    Auto-Role Rules
                  </h3>
                  <button
                    onClick={addAutoRole}
                    className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4 inline mr-1" />
                    Add Rule
                  </button>
                </div>

                <div className="space-y-4">
                  {autoRoles.map((autoRole, index) => (
                    <div key={index} className={classNames(
                      "p-4 rounded-lg border",
                      darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                    )}>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className={classNames(
                            "block text-xs font-medium mb-1",
                            darkMode ? "text-gray-400" : "text-gray-600"
                          )}>
                            Role
                          </label>
                          <select
                            value={autoRole.roleId}
                            onChange={(e) => updateAutoRole(index, { roleId: e.target.value })}
                            className={classNames(
                              "w-full px-2 py-1 rounded border text-sm transition-colors",
                              darkMode 
                                ? "bg-gray-600 border-gray-500 text-white focus:border-purple-500" 
                                : "bg-white border-gray-300 text-gray-900 focus:border-purple-500"
                            )}
                          >
                            <option value="">-- Select Role --</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                @{role.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className={classNames(
                            "block text-xs font-medium mb-1",
                            darkMode ? "text-gray-400" : "text-gray-600"
                          )}>
                            Condition
                          </label>
                          <select
                            value={autoRole.condition}
                            onChange={(e) => updateAutoRole(index, { condition: e.target.value as any })}
                            className={classNames(
                              "w-full px-2 py-1 rounded border text-sm transition-colors",
                              darkMode 
                                ? "bg-gray-600 border-gray-500 text-white focus:border-purple-500" 
                                : "bg-white border-gray-300 text-gray-900 focus:border-purple-500"
                            )}
                          >
                            <option value="join">On Join</option>
                            <option value="level">Level Reached</option>
                            <option value="reaction">Reaction Role</option>
                            <option value="time">Time-based</option>
                          </select>
                        </div>

                        {autoRole.condition === 'level' && (
                          <div>
                            <label className={classNames(
                              "block text-xs font-medium mb-1",
                              darkMode ? "text-gray-400" : "text-gray-600"
                            )}>
                              Level
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={autoRole.level || 1}
                              onChange={(e) => updateAutoRole(index, { level: parseInt(e.target.value) })}
                              className={classNames(
                                "w-full px-2 py-1 rounded border text-sm transition-colors",
                                darkMode 
                                  ? "bg-gray-600 border-gray-500 text-white focus:border-purple-500" 
                                  : "bg-white border-gray-300 text-gray-900 focus:border-purple-500"
                              )}
                            />
                          </div>
                        )}

                        <div className="flex items-end">
                          <button
                            onClick={() => removeAutoRole(index)}
                            className="p-2 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                            title="Remove Rule"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className={classNames(
                          "block text-xs font-medium mb-1",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          Description
                        </label>
                        <input
                          type="text"
                          value={autoRole.description}
                          onChange={(e) => updateAutoRole(index, { description: e.target.value })}
                          className={classNames(
                            "w-full px-2 py-1 rounded border text-sm transition-colors",
                            darkMode 
                              ? "bg-gray-600 border-gray-500 text-white focus:border-purple-500" 
                              : "bg-white border-gray-300 text-gray-900 focus:border-purple-500"
                          )}
                          placeholder="Description of this auto-role rule"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end pt-6 border-t border-gray-200 dark:border-gray-700 space-x-3">
              <button
                onClick={onClose}
                className={classNames(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  darkMode 
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                )}
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className={classNames(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  "bg-purple-600 hover:bg-purple-700 text-white",
                  saving ? "opacity-50 cursor-not-allowed" : ""
                )}
              >
                <CheckIcon className="h-4 w-4 inline mr-2" />
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
};

export default RolesConfigModal; 