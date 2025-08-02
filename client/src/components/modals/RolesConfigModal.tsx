import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import {
  CheckIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import ConfigModal from '../common/ConfigModal';
import FormField from '../common/FormField';
import ActionButton from '../common/ActionButton';
import ToggleSwitch from '../common/ToggleSwitch';

// Utility function for conditional class names (if needed in future)
// function classNames(...classes: string[]) {
//   return classes.filter(Boolean).join(' ');
// }

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
  // const { darkMode } = useTheme(); // Not needed with ConfigModal
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

  return (
    <ConfigModal
      isOpen={isOpen}
      onClose={onClose}
      title="Roles & Auto-Roles Configuration"
      description="Manage server roles and automatic role assignment"
      icon="👥"
      maxWidth="4xl"
      loading={loading}
      loadingText="Loading roles configuration..."
      actions={
        <div className="flex items-center justify-between w-full">
          <div className="flex space-x-3">
            <ActionButton
              onClick={onClose}
              variant="outline"
              disabled={saving}
            >
              Cancel
            </ActionButton>
          </div>
          <div className="flex space-x-3">
            <ActionButton
              onClick={handleSave}
              disabled={saving}
              loading={saving}
              variant="primary"
              icon={CheckIcon}
            >
              Save Configuration
            </ActionButton>
          </div>
        </div>
      }
    >

          <div className="space-y-6">
            {/* Enable Auto-Roles Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border card">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Auto-Roles System
                </h3>
                <p className="text-sm text-muted-foreground">
                  Automatically assign roles to members based on conditions
                </p>
              </div>
              <ToggleSwitch
                enabled={enableAutoRoles}
                onChange={setEnableAutoRoles}
                label="Enable Auto-Roles"
              />
            </div>

            {/* Staff Roles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                type="select"
                label="Moderator Role"
                value={modRole}
                onChange={setModRole}
                options={[
                  { value: "", label: "-- Select Role --" },
                  ...roles.map(role => ({ value: role.id, label: `@${role.name}` }))
                ]}
                description="Role for server moderators"
              />

              <FormField
                type="select"
                label="Administrator Role"
                value={adminRole}
                onChange={setAdminRole}
                options={[
                  { value: "", label: "-- Select Role --" },
                  ...roles.map(role => ({ value: role.id, label: `@${role.name}` }))
                ]}
                description="Role for server administrators"
              />

              <FormField
                type="select"
                label="Join Role (Auto-assigned)"
                value={joinRole}
                onChange={setJoinRole}
                options={[
                  { value: "", label: "-- Select Role --" },
                  ...roles.map(role => ({ value: role.id, label: `@${role.name}` }))
                ]}
                description="Role automatically assigned when members join"
              />

              <FormField
                type="select"
                label="Muted Role"
                value={mutedRole}
                onChange={setMutedRole}
                options={[
                  { value: "", label: "-- Select Role --" },
                  ...roles.map(role => ({ value: role.id, label: `@${role.name}` }))
                ]}
                description="Role used for muting members"
              />
            </div>

            {/* Auto-Roles */}
            {enableAutoRoles && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">
                    Auto-Role Rules
                  </h3>
                  <ActionButton
                    onClick={addAutoRole}
                    variant="success"
                    size="sm"
                    icon={PlusIcon}
                  >
                    Add Rule
                  </ActionButton>
                </div>

                <div className="space-y-4">
                  {autoRoles.map((autoRole, index) => (
                    <div key={index} className="p-4 rounded-lg border card">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <FormField
                          type="select"
                          label="Role"
                          value={autoRole.roleId}
                          onChange={(value) => updateAutoRole(index, { roleId: value })}
                          options={[
                            { value: "", label: "-- Select Role --" },
                            ...roles.map(role => ({ value: role.id, label: `@${role.name}` }))
                          ]}
                        />

                        <FormField
                          type="select"
                          label="Condition"
                          value={autoRole.condition}
                          onChange={(value) => updateAutoRole(index, { condition: value as any })}
                          options={[
                            { value: "join", label: "On Join" },
                            { value: "level", label: "Level Reached" },
                            { value: "reaction", label: "Reaction Role" },
                            { value: "time", label: "Time-based" }
                          ]}
                        />

                        {autoRole.condition === 'level' && (
                          <FormField
                            type="input"
                            inputType="number"
                            label="Level"
                            value={autoRole.level?.toString() || "1"}
                            onChange={(value) => updateAutoRole(index, { level: parseInt(value) || 1 })}
                            min={1}
                          />
                        )}

                        <div className="flex items-end">
                          <ActionButton
                            onClick={() => removeAutoRole(index)}
                            variant="danger"
                            size="sm"
                            icon={TrashIcon}
                          >
                            Remove
                          </ActionButton>
                        </div>
                      </div>

                      <div className="mt-3">
                        <FormField
                          type="input"
                          label="Description"
                          value={autoRole.description}
                          onChange={(value) => updateAutoRole(index, { description: value })}
                          placeholder="Description of this auto-role rule"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
    </ConfigModal>
  );
};

export default RolesConfigModal; 