import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import PermissionGuard from '../../components/common/PermissionGuard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  UserGroupIcon,
  PlusIcon,
  TrashIcon,
  StarIcon,
  ClockIcon,
  ShieldCheckIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface RoleManagementSettings {
  guild_id: string;
  auto_roles_enabled?: boolean;
  auto_roles?: string;
  auto_role_delay?: number;
  reaction_roles_enabled?: boolean;
  reaction_role_configs?: string;
  level_roles_enabled?: boolean;
  level_role_configs?: string;
  level_role_mode?: string;
  role_hierarchy_enabled?: boolean;
  protected_roles?: string;
  admin_roles?: string;
  mod_roles?: string;
  temporary_roles_enabled?: boolean;
  role_shop_enabled?: boolean;
  role_shop_configs?: string;
}

interface ServerInfo {
  id: string;
  name: string;
  memberCount: number;
  icon?: string;
}

interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface ReactionRole {
  id: string;
  emoji: string;
  roleId: string;
  description: string;
}

interface LevelRole {
  id: string;
  level: number;
  roleId: string;
  remove_previous?: boolean;
}

const RoleSettingsContent: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [settings, setSettings] = useState<RoleManagementSettings | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<RoleManagementSettings | null>(null);

  // State for managing different role configurations
  const [reactionRoles, setReactionRoles] = useState<ReactionRole[]>([]);
  const [levelRoles, setLevelRoles] = useState<LevelRole[]>([]);
  const [newReactionRole, setNewReactionRole] = useState<Partial<ReactionRole>>({});
  const [newLevelRole, setNewLevelRole] = useState<Partial<LevelRole>>({});

  // Default settings helper
  const getDefaultSettings = useCallback((): RoleManagementSettings => ({
    guild_id: serverId!,
    auto_roles_enabled: false,
    auto_roles: '[]',
    auto_role_delay: 0,
    reaction_roles_enabled: false,
    reaction_role_configs: '[]',
    level_roles_enabled: false,
    level_role_configs: '[]',
    level_role_mode: 'add',
    role_hierarchy_enabled: true,
    protected_roles: '[]',
    admin_roles: '[]',
    mod_roles: '[]',
    temporary_roles_enabled: false,
    role_shop_enabled: false,
    role_shop_configs: '[]'
  }), [serverId]);

  // Role mode options
  const roleModeOptions = [
    { value: 'add', label: 'Add Roles', description: 'Keep all previous roles when leveling up' },
    { value: 'replace', label: 'Replace Roles', description: 'Remove previous level roles when leveling up' },
    { value: 'highest', label: 'Highest Only', description: 'Only keep the highest level role achieved' }
  ];

  // Load data
  useEffect(() => {
    if (!serverId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Load server info and settings
        const [serverResponse, settingsResponse] = await Promise.all([
          apiService.getServerInfo(serverId),
          fetch(`/api/settings/${serverId}/role-management`)
        ]);

        if (serverResponse.success && serverResponse.data) {
          setServerInfo(serverResponse.data);
        }

        // Mock roles data (in a real implementation, this would come from Discord API)
        setRoles([
          { id: '1', name: 'Admin', color: '#ff0000', position: 10 },
          { id: '2', name: 'Moderator', color: '#00ff00', position: 9 },
          { id: '3', name: 'VIP', color: '#ffff00', position: 8 },
          { id: '4', name: 'Member', color: '#99AAB5', position: 7 },
          { id: '5', name: 'Level 10', color: '#9932cc', position: 6 },
          { id: '6', name: 'Level 20', color: '#ff6347', position: 5 },
          { id: '7', name: 'Level 50', color: '#ffd700', position: 4 },
          { id: '8', name: 'Nitro Booster', color: '#f47fff', position: 3 }
        ]);

        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          if (settingsData.success && settingsData.data) {
            const loadedSettings = settingsData.data;
            setSettings(loadedSettings);
            setOriginalSettings(JSON.parse(JSON.stringify(loadedSettings)));
            
            // Parse complex settings
            parseComplexSettings(loadedSettings);
          } else {
            const defaultSettings = getDefaultSettings();
            setSettings(defaultSettings);
            setOriginalSettings(JSON.parse(JSON.stringify(defaultSettings)));
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load settings');
        const defaultSettings = getDefaultSettings();
        setSettings(defaultSettings);
        setOriginalSettings(JSON.parse(JSON.stringify(defaultSettings)));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [serverId, getDefaultSettings]);

  // Check for changes
  useEffect(() => {
    if (!settings || !originalSettings) return;
    
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const parseComplexSettings = (loadedSettings: RoleManagementSettings) => {
    try {
      // Parse reaction roles
      const reactionRoleConfigs = JSON.parse(loadedSettings.reaction_role_configs || '[]');
      setReactionRoles(reactionRoleConfigs);
      
      // Parse level roles
      const levelRoleConfigs = JSON.parse(loadedSettings.level_role_configs || '[]');
      setLevelRoles(levelRoleConfigs);
    } catch (error) {
      console.error('Error parsing complex settings:', error);
    }
  };

  const updateSetting = (key: keyof RoleManagementSettings, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [key]: value
    });
  };

  const handleArraySetting = (key: keyof RoleManagementSettings, itemId: string, checked: boolean) => {
    if (!settings) return;
    
    try {
      const currentArray = JSON.parse((settings[key] as string) || '[]');
      const updatedArray = checked
        ? [...currentArray, itemId]
        : currentArray.filter((id: string) => id !== itemId);
      
      updateSetting(key, JSON.stringify(updatedArray));
    } catch (error) {
      console.error('Error updating array setting:', error);
    }
  };

  const isInArray = (key: keyof RoleManagementSettings, itemId: string): boolean => {
    if (!settings) return false;
    
    try {
      const array = JSON.parse((settings[key] as string) || '[]');
      return array.includes(itemId);
    } catch {
      return false;
    }
  };

  const addReactionRole = () => {
    if (!newReactionRole.emoji || !newReactionRole.roleId) {
      toast.error('Please fill in all required fields');
      return;
    }

    const reactionRole: ReactionRole = {
      id: Date.now().toString(),
      emoji: newReactionRole.emoji,
      roleId: newReactionRole.roleId,
      description: newReactionRole.description || ''
    };

    const updatedReactionRoles = [...reactionRoles, reactionRole];
    setReactionRoles(updatedReactionRoles);
    updateSetting('reaction_role_configs', JSON.stringify(updatedReactionRoles));
    setNewReactionRole({});
    toast.success('Reaction role added');
  };

  const removeReactionRole = (id: string) => {
    const updatedReactionRoles = reactionRoles.filter(rr => rr.id !== id);
    setReactionRoles(updatedReactionRoles);
    updateSetting('reaction_role_configs', JSON.stringify(updatedReactionRoles));
    toast.success('Reaction role removed');
  };

  const addLevelRole = () => {
    if (!newLevelRole.level || !newLevelRole.roleId) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check if level already exists
    if (levelRoles.some(lr => lr.level === newLevelRole.level)) {
      toast.error('A role for this level already exists');
      return;
    }

    const levelRole: LevelRole = {
      id: Date.now().toString(),
      level: newLevelRole.level,
      roleId: newLevelRole.roleId,
      remove_previous: newLevelRole.remove_previous || false
    };

    const updatedLevelRoles = [...levelRoles, levelRole].sort((a, b) => a.level - b.level);
    setLevelRoles(updatedLevelRoles);
    updateSetting('level_role_configs', JSON.stringify(updatedLevelRoles));
    setNewLevelRole({});
    toast.success('Level role added');
  };

  const removeLevelRole = (id: string) => {
    const updatedLevelRoles = levelRoles.filter(lr => lr.id !== id);
    setLevelRoles(updatedLevelRoles);
    updateSetting('level_role_configs', JSON.stringify(updatedLevelRoles));
    toast.success('Level role removed');
  };

  const handleSave = async () => {
    if (!settings || !serverId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/settings/${serverId}/role-management`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_API_KEY}`
        },
        body: JSON.stringify(settings)
      });

      const result = await response.json();

      if (result.success) {
        setOriginalSettings(JSON.parse(JSON.stringify(settings)));
        setHasChanges(false);
        toast.success('Role management settings saved successfully!');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!originalSettings) return;
    setSettings(JSON.parse(JSON.stringify(originalSettings)));
    parseComplexSettings(originalSettings);
    toast.success('Settings reset to last saved state');
  };

  const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
  }> = ({ checked, onChange, disabled = false }) => (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={classNames(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2",
        checked ? "bg-purple-600" : (darkMode ? "bg-gray-600" : "bg-gray-300"),
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
      )}
    >
      <span
        className={classNames(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );

  const getRoleById = (roleId: string) => {
    return roles.find(role => role.id === roleId);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!settings) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className={classNames(
          "text-center p-8 rounded-lg border",
          darkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-600"
        )}>
          <UserGroupIcon className="h-12 w-12 mx-auto mb-4 text-purple-500" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Settings</h3>
          <p>Unable to load role management settings. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => navigate(`/servers/${serverId}/settings/advanced`)}
            className={classNames(
              "p-2 rounded-lg transition-colors",
              darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
            )}
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          
          <div className={classNames(
            "p-3 rounded-lg",
            darkMode ? "bg-purple-900/20" : "bg-purple-100"
          )}>
            <UserGroupIcon className={classNames(
              "h-8 w-8",
              darkMode ? "text-purple-400" : "text-purple-600"
            )} />
          </div>
          
          <div>
            <h1 className={classNames(
              "text-4xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Role Management
            </h1>
            {serverInfo && (
              <p className={classNames(
                "text-lg font-medium mt-2",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                {serverInfo.name} • Automated Role Assignment
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Auto-Roles */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <PlusIcon className="h-6 w-6 mr-3 text-green-500" />
              <div>
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Auto-Roles
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Automatically assign roles to new members when they join
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.auto_roles_enabled || false}
              onChange={(checked) => updateSetting('auto_roles_enabled', checked)}
            />
          </div>

          {settings.auto_roles_enabled && (
            <div className="space-y-6">
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Delay (seconds)
                </label>
                <input
                  type="number"
                  min="0"
                  max="3600"
                  value={settings.auto_role_delay || 0}
                  onChange={(e) => updateSetting('auto_role_delay', parseInt(e.target.value))}
                  className={classNames(
                    "w-full max-w-xs px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  )}
                />
                <p className="text-xs text-gray-500 mt-1">Delay before assigning roles (0 for immediate)</p>
              </div>

              <div>
                <h4 className={classNames(
                  "text-lg font-semibold mb-4",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Roles to Auto-Assign
                </h4>
                <div className="space-y-2">
                  {roles.filter(role => role.name !== 'Admin').map((role) => (
                    <label
                      key={role.id}
                      className={classNames(
                        "flex items-center p-3 rounded-lg border cursor-pointer transition-all",
                        isInArray('auto_roles', role.id)
                          ? darkMode
                            ? "bg-gray-700 border-gray-600"
                            : "bg-gray-50 border-gray-300"
                          : darkMode
                            ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isInArray('auto_roles', role.id)}
                        onChange={(e) => handleArraySetting('auto_roles', role.id, e.target.checked)}
                        className="mr-3 h-4 w-4 text-purple-600 rounded"
                      />
                      <div
                        className="w-4 h-4 rounded mr-2"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className={classNames(
                        "font-medium",
                        darkMode ? "text-white" : "text-gray-900"
                      )}>
                        {role.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reaction Roles */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <StarIcon className="h-6 w-6 mr-3 text-yellow-500" />
              <div>
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Reaction Roles
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Let users assign themselves roles by reacting to messages
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.reaction_roles_enabled || false}
              onChange={(checked) => updateSetting('reaction_roles_enabled', checked)}
            />
          </div>

          {settings.reaction_roles_enabled && (
            <div className="space-y-6">
              {/* Add New Reaction Role */}
              <div className={classNames(
                "p-4 rounded-lg border-2 border-dashed",
                darkMode ? "border-gray-600" : "border-gray-300"
              )}>
                <h4 className={classNames(
                  "text-lg font-semibold mb-4",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Add Reaction Role
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Emoji</label>
                    <input
                      type="text"
                      placeholder="🎯"
                      value={newReactionRole.emoji || ''}
                      onChange={(e) => setNewReactionRole({...newReactionRole, emoji: e.target.value})}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Role</label>
                    <select
                      value={newReactionRole.roleId || ''}
                      onChange={(e) => setNewReactionRole({...newReactionRole, roleId: e.target.value})}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    >
                      <option value="">Select role</option>
                      {roles.filter(role => role.name !== 'Admin').map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="Optional description"
                      value={newReactionRole.description || ''}
                      onChange={(e) => setNewReactionRole({...newReactionRole, description: e.target.value})}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={addReactionRole}
                      className="w-full px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Existing Reaction Roles */}
              {reactionRoles.length > 0 && (
                <div>
                  <h4 className={classNames(
                    "text-lg font-semibold mb-4",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    Configured Reaction Roles
                  </h4>
                  <div className="space-y-2">
                    {reactionRoles.map((reactionRole) => {
                      const role = getRoleById(reactionRole.roleId);
                      return (
                        <div
                          key={reactionRole.id}
                          className={classNames(
                            "flex items-center justify-between p-3 rounded-lg border",
                            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-300"
                          )}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{reactionRole.emoji}</span>
                            <div>
                              <div className="flex items-center space-x-2">
                                {role && (
                                  <div
                                    className="w-3 h-3 rounded"
                                    style={{ backgroundColor: role.color }}
                                  />
                                )}
                                <span className={classNames(
                                  "font-medium",
                                  darkMode ? "text-white" : "text-gray-900"
                                )}>
                                  {role?.name || 'Unknown Role'}
                                </span>
                              </div>
                              {reactionRole.description && (
                                <p className={classNames(
                                  "text-sm",
                                  darkMode ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {reactionRole.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeReactionRole(reactionRole.id)}
                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Level Roles */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <ClockIcon className="h-6 w-6 mr-3 text-blue-500" />
              <div>
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Level Roles
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Automatically assign roles based on user activity levels
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.level_roles_enabled || false}
              onChange={(checked) => updateSetting('level_roles_enabled', checked)}
            />
          </div>

          {settings.level_roles_enabled && (
            <div className="space-y-6">
              {/* Role Mode Selection */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-3",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Role Assignment Mode
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {roleModeOptions.map((mode) => (
                    <label
                      key={mode.value}
                      className={classNames(
                        "relative p-4 rounded-lg border-2 cursor-pointer transition-all",
                        settings.level_role_mode === mode.value
                          ? darkMode
                            ? "bg-blue-900/20 border-blue-500"
                            : "bg-blue-50 border-blue-500"
                          : darkMode
                            ? "bg-gray-700 border-gray-600 hover:border-gray-500"
                            : "bg-white border-gray-300 hover:border-gray-400"
                      )}
                    >
                      <input
                        type="radio"
                        name="roleMode"
                        value={mode.value}
                        checked={settings.level_role_mode === mode.value}
                        onChange={(e) => updateSetting('level_role_mode', e.target.value)}
                        className="sr-only"
                      />
                      <div>
                        <h4 className={classNames(
                          "font-semibold mb-1",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                          {mode.label}
                        </h4>
                        <p className={classNames(
                          "text-sm",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          {mode.description}
                        </p>
                      </div>
                      {settings.level_role_mode === mode.value && (
                        <CheckIcon className="absolute top-2 right-2 h-5 w-5 text-blue-500" />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Add New Level Role */}
              <div className={classNames(
                "p-4 rounded-lg border-2 border-dashed",
                darkMode ? "border-gray-600" : "border-gray-300"
              )}>
                <h4 className={classNames(
                  "text-lg font-semibold mb-4",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Add Level Role
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Level Required</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="10"
                      value={newLevelRole.level || ''}
                      onChange={(e) => setNewLevelRole({...newLevelRole, level: parseInt(e.target.value)})}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Role to Assign</label>
                    <select
                      value={newLevelRole.roleId || ''}
                      onChange={(e) => setNewLevelRole({...newLevelRole, roleId: e.target.value})}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    >
                      <option value="">Select role</option>
                      {roles.filter(role => role.name !== 'Admin').map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={addLevelRole}
                      className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Existing Level Roles */}
              {levelRoles.length > 0 && (
                <div>
                  <h4 className={classNames(
                    "text-lg font-semibold mb-4",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    Configured Level Roles
                  </h4>
                  <div className="space-y-2">
                    {levelRoles.map((levelRole) => {
                      const role = getRoleById(levelRole.roleId);
                      return (
                        <div
                          key={levelRole.id}
                          className={classNames(
                            "flex items-center justify-between p-3 rounded-lg border",
                            darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-300"
                          )}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={classNames(
                              "px-3 py-1 rounded-full text-sm font-medium",
                              darkMode ? "bg-blue-900 text-blue-300" : "bg-blue-100 text-blue-800"
                            )}>
                              Level {levelRole.level}
                            </div>
                            <div className="flex items-center space-x-2">
                              {role && (
                                <div
                                  className="w-3 h-3 rounded"
                                  style={{ backgroundColor: role.color }}
                                />
                              )}
                              <span className={classNames(
                                "font-medium",
                                darkMode ? "text-white" : "text-gray-900"
                              )}>
                                {role?.name || 'Unknown Role'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeLevelRole(levelRole.id)}
                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Role Hierarchy & Protection */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-6 w-6 mr-3 text-red-500" />
              <div>
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Role Hierarchy & Protection
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Protect important roles and define role hierarchies
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.role_hierarchy_enabled || false}
              onChange={(checked) => updateSetting('role_hierarchy_enabled', checked)}
            />
          </div>

          {settings.role_hierarchy_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Admin Roles */}
              <div>
                <h4 className={classNames(
                  "text-lg font-semibold mb-4",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Admin Roles
                </h4>
                <p className={classNames(
                  "text-sm mb-4",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Roles with full administrative privileges
                </p>
                <div className="space-y-2">
                  {roles.slice(0, 4).map((role) => (
                    <label
                      key={role.id}
                      className={classNames(
                        "flex items-center p-3 rounded-lg border cursor-pointer transition-all",
                        isInArray('admin_roles', role.id)
                          ? darkMode
                            ? "bg-gray-700 border-gray-600"
                            : "bg-gray-50 border-gray-300"
                          : darkMode
                            ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isInArray('admin_roles', role.id)}
                        onChange={(e) => handleArraySetting('admin_roles', role.id, e.target.checked)}
                        className="mr-3 h-4 w-4 text-red-600 rounded"
                      />
                      <div
                        className="w-4 h-4 rounded mr-2"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className={classNames(
                        "font-medium text-sm",
                        darkMode ? "text-white" : "text-gray-900"
                      )}>
                        {role.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Moderator Roles */}
              <div>
                <h4 className={classNames(
                  "text-lg font-semibold mb-4",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Moderator Roles
                </h4>
                <p className={classNames(
                  "text-sm mb-4",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Roles with moderation privileges
                </p>
                <div className="space-y-2">
                  {roles.slice(0, 4).map((role) => (
                    <label
                      key={role.id}
                      className={classNames(
                        "flex items-center p-3 rounded-lg border cursor-pointer transition-all",
                        isInArray('mod_roles', role.id)
                          ? darkMode
                            ? "bg-gray-700 border-gray-600"
                            : "bg-gray-50 border-gray-300"
                          : darkMode
                            ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isInArray('mod_roles', role.id)}
                        onChange={(e) => handleArraySetting('mod_roles', role.id, e.target.checked)}
                        className="mr-3 h-4 w-4 text-orange-600 rounded"
                      />
                      <div
                        className="w-4 h-4 rounded mr-2"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className={classNames(
                        "font-medium text-sm",
                        darkMode ? "text-white" : "text-gray-900"
                      )}>
                        {role.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Protected Roles */}
              <div>
                <h4 className={classNames(
                  "text-lg font-semibold mb-4",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Protected Roles
                </h4>
                <p className={classNames(
                  "text-sm mb-4",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Roles that cannot be removed by automated systems
                </p>
                <div className="space-y-2">
                  {roles.slice(0, 4).map((role) => (
                    <label
                      key={role.id}
                      className={classNames(
                        "flex items-center p-3 rounded-lg border cursor-pointer transition-all",
                        isInArray('protected_roles', role.id)
                          ? darkMode
                            ? "bg-gray-700 border-gray-600"
                            : "bg-gray-50 border-gray-300"
                          : darkMode
                            ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isInArray('protected_roles', role.id)}
                        onChange={(e) => handleArraySetting('protected_roles', role.id, e.target.checked)}
                        className="mr-3 h-4 w-4 text-purple-600 rounded"
                      />
                      <div
                        className="w-4 h-4 rounded mr-2"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className={classNames(
                        "font-medium text-sm",
                        darkMode ? "text-white" : "text-gray-900"
                      )}>
                        {role.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className={classNames(
              "px-6 py-2 rounded-lg border-2 transition-all",
              hasChanges
                ? darkMode
                  ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-100"
                : "border-gray-400 text-gray-400 cursor-not-allowed"
            )}
          >
            Reset Changes
          </button>
          
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={classNames(
              "px-8 py-2 rounded-lg font-medium transition-all flex items-center space-x-2",
              hasChanges && !saving
                ? "bg-purple-500 text-white hover:bg-purple-600"
                : darkMode
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            <span>{saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const RoleSettings: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['admin', 'system_admin', 'manage_servers']}
      fallbackMessage="You need administrator privileges to access role settings."
    >
      <RoleSettingsContent />
    </PermissionGuard>
  );
};

export default RoleSettings;