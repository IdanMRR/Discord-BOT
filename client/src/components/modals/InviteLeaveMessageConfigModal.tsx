import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import {
  EyeIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import ConfigModal from '../common/ConfigModal';
import FormField from '../common/FormField';
import ActionButton from '../common/ActionButton';
import CompactField from '../common/CompactField';

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface InviteLeaveMessageField {
  name: string;
  value: string;
  inline?: boolean;
}

interface InviteLeaveMessageConfig {
  title: string;
  description: string;
  color: string;
  fields: InviteLeaveMessageField[];
}

interface InviteLeaveMessageConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
}

const InviteLeaveMessageConfigModal: React.FC<InviteLeaveMessageConfigModalProps> = ({
  isOpen,
  onClose,
  serverId
}) => {
  const { darkMode } = useTheme();
  // const { primaryColor } = useNewTheme(); // Removed unused variable
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState<InviteLeaveMessageConfig>({
    title: 'Member Left 😢',
    description: '{user} left the server (was invited by {inviter})\n\nThey spent {timeInServer} with us.',
    color: '#DC2626',
    fields: [
      {
        name: '📊 Member Stats',
        value: 'Time in server: {timeInServer}\nInvited by: {inviter}',
        inline: true
      },
      {
        name: '🎫 Invite Info',
        value: 'Invite code: {inviteCode}',
        inline: true
      },
      {
        name: '💔 We\'ll miss them',
        value: 'Thanks {inviter} for bringing them to our community.',
        inline: false
      }
    ]
  });

  const loadInviteLeaveConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getInviteLeaveMessageConfig(serverId);
      
      if (response.success && response.data) {
        setConfig(prevConfig => ({
          title: response.data!.title || prevConfig.title,
          description: response.data!.description || prevConfig.description,
          color: response.data!.color || prevConfig.color,
          fields: response.data!.fields || prevConfig.fields
        }));
      }
    } catch (error) {
      console.error('Error loading invite leave config:', error);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  // Load existing configuration
  useEffect(() => {
    if (isOpen && serverId) {
      loadInviteLeaveConfig();
    }
  }, [isOpen, serverId, loadInviteLeaveConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await apiService.saveInviteLeaveMessageConfig(serverId, config);
      
      if (response.success) {
        toast.success('Invite leave message configuration saved!');
        onClose();
      } else {
        toast.error('Failed to save invite leave message configuration');
      }
    } catch (error) {
      console.error('Error saving invite leave config:', error);
      toast.error('Failed to save invite leave message configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    // Validate configuration before testing
    if (!config.title || config.title.trim() === '') {
      toast.error('Please enter a message title before testing');
      return;
    }
    
    if (!config.description || config.description.trim() === '') {
      toast.error('Please enter a message description before testing');
      return;
    }
    
    try {
      const response = await apiService.testInviteLeaveMessage(serverId, config);
      
      if (response.success) {
        toast.success('Test invite leave message sent! Check your server.');
      } else {
        toast.error('Failed to send test invite leave message');
      }
    } catch (error) {
      console.error('Error testing invite leave message:', error);
      toast.error('Failed to send test invite leave message');
    }
  };

  const addField = () => {
    setConfig({
      ...config,
      fields: [
        ...config.fields,
        { name: 'New Field', value: 'Field value', inline: false }
      ]
    });
  };

  const updateField = (index: number, field: Partial<InviteLeaveMessageField>) => {
    const newFields = [...config.fields];
    newFields[index] = { ...newFields[index], ...field };
    setConfig({ ...config, fields: newFields });
  };

  const removeField = (index: number) => {
    setConfig({
      ...config,
      fields: config.fields.filter((_, i) => i !== index)
    });
  };

  return (
    <ConfigModal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Leave Message Configuration"
      description="Customize messages shown when members with tracked invites leave"
      icon="📤"
      maxWidth="2xl"
      loading={loading}
      loadingText="Loading configuration..."
      actions={
        <>
          <ActionButton
            variant="outline"
            onClick={handleTest}
            icon={EyeIcon}
          >
            Test Message
          </ActionButton>
          <ActionButton
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            onClick={handleSave}
            loading={saving}
            icon={CheckIcon}
          >
            Save Configuration
          </ActionButton>
        </>
      }
    >
          <div className="space-y-4">
            {/* Variables Help */}
            <div className={classNames(
              "p-3 rounded-lg border-l-4 border-red-500",
              darkMode ? "bg-red-900/20" : "bg-red-50"
            )}>
              <h3 className={classNames(
                "text-xs font-medium mb-2",
                darkMode ? "text-red-300" : "text-red-800"
              )}>
                Available Variables:
              </h3>
              <div className="grid grid-cols-3 gap-1 text-xs">
                <code className={classNames(
                  "px-1.5 py-0.5 rounded",
                  darkMode ? "bg-gray-700 text-red-300" : "bg-red-100 text-red-800"
                )}>
                  {'{user}'}
                </code>
                <code className={classNames(
                  "px-1.5 py-0.5 rounded",
                  darkMode ? "bg-gray-700 text-red-300" : "bg-red-100 text-red-800"
                )}>
                  {'{inviter}'}
                </code>
                <code className={classNames(
                  "px-1.5 py-0.5 rounded",
                  darkMode ? "bg-gray-700 text-red-300" : "bg-red-100 text-red-800"
                )}>
                  {'{inviteCode}'}
                </code>
                <code className={classNames(
                  "px-1.5 py-0.5 rounded",
                  darkMode ? "bg-gray-700 text-red-300" : "bg-red-100 text-red-800"
                )}>
                  {'{timeInServer}'}
                </code>
                <code className={classNames(
                  "px-1.5 py-0.5 rounded",
                  darkMode ? "bg-gray-700 text-red-300" : "bg-red-100 text-red-800"
                )}>
                  {'{server}'}
                </code>
                <code className={classNames(
                  "px-1.5 py-0.5 rounded",
                  darkMode ? "bg-gray-700 text-red-300" : "bg-red-100 text-red-800"
                )}>
                  {'{memberCount}'}
                </code>
              </div>
            </div>

            {/* Basic Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField
                type="input"
                label="Message Title"
                value={config.title}
                onChange={(value) => setConfig({ ...config, title: value })}
                placeholder="Member Left 😢"
                className="text-sm"
              />
              <FormField
                type="color"
                label="Embed Color"
                value={config.color}
                onChange={(value) => setConfig({ ...config, color: value })}
                className="text-sm"
              />
              <div className="md:col-span-1"></div>
            </div>
            
            <FormField
              type="textarea"
              label="Message Description"
              value={config.description}
              onChange={(value) => setConfig({ ...config, description: value })}
              rows={3}
              placeholder="{user} left the server (was invited by {inviter})"
              className="text-sm"
            />

            {/* Fields Configuration */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Message Fields
                </h3>
                <ActionButton
                  onClick={addField}
                  variant="success"
                  size="sm"
                >
                  Add Field
                </ActionButton>
              </div>

              <div className="space-y-2">
                {config.fields.map((field, index) => (
                  <CompactField
                    key={index}
                    index={index}
                    field={field}
                    onUpdate={updateField}
                    onRemove={removeField}
                  />
                ))}
              </div>
            </div>

            {/* Compact Preview */}
            <div className={classNames(
              "p-3 rounded-lg border",
              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <h3 className={classNames(
                "text-xs font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Preview
              </h3>
              <div className={classNames(
                "p-3 rounded border-l-4 text-sm",
                darkMode ? "bg-gray-800" : "bg-white"
              )} style={{ borderLeftColor: config.color }}>
                <h4 className={classNames(
                  "font-semibold mb-1.5 text-sm",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {config.title}
                </h4>
                <div className={classNames(
                  "text-xs whitespace-pre-wrap mb-2",
                  darkMode ? "text-gray-300" : "text-gray-600"
                )}>
                  {config.description}
                </div>
                {config.fields.length > 0 && (
                  <div className="space-y-1">
                    {config.fields.map((field, index) => (
                      <div key={index}>
                        <div className={classNames(
                          "text-xs font-medium",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                          {field.name}
                        </div>
                        <div className={classNames(
                          "text-xs",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          {field.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
    </ConfigModal>
  );
};

export default InviteLeaveMessageConfigModal;