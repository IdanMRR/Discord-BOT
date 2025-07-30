import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import {
  EyeIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import FormField from '../common/FormField';
import ActionButton from '../common/ActionButton';
import ConfigModal, { ModalActions } from '../common/ConfigModal';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface WelcomeMessageField {
  name: string;
  value: string;
  inline?: boolean;
}

interface WelcomeMessageConfig {
  title: string;
  description: string;
  color: string;
  fields: WelcomeMessageField[];
}

interface WelcomeMessageConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
}

const WelcomeMessageConfigModal: React.FC<WelcomeMessageConfigModalProps> = ({
  isOpen,
  onClose,
  serverId
}) => {
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [config, setConfig] = useState<WelcomeMessageConfig>({
    title: 'Welcome to the Server! 👋',
    description: 'Hey {user}! Welcome to **{server}**!\n\nWe\'re excited to have you here. Make sure to read the rules and introduce yourself!',
    color: '#5865F2',
    fields: [
      {
        name: '📋 Getting Started',
        value: '• Read <#rules-channel>\n• Get your roles in <#roles-channel>\n• Say hi in <#general-chat>',
        inline: false
      },
      {
        name: '👥 Member Count',
        value: 'You are member #{memberCount}!',
        inline: true
      },
      {
        name: '🎉 Have Fun!',
        value: 'Enjoy your stay!',
        inline: true
      }
    ]
  });

  const loadWelcomeConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getWelcomeMessageConfig(serverId);
      
      if (response.success && response.data) {
        setConfig(prevConfig => ({
          title: response.data!.title || prevConfig.title,
          description: response.data!.description || prevConfig.description,
          color: response.data!.color || prevConfig.color,
          fields: response.data!.fields || prevConfig.fields
        }));
      }
    } catch (error) {
      console.error('Error loading welcome config:', error);
      // Keep default config on error
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  // Load existing configuration
  useEffect(() => {
    if (isOpen && serverId) {
      loadWelcomeConfig();
    }
  }, [isOpen, serverId, loadWelcomeConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await apiService.saveWelcomeMessageConfig(serverId, config);
      
      if (response.success) {
        toast.success('Welcome message configuration saved!');
        onClose();
      } else {
        toast.error('Failed to save welcome message configuration');
      }
    } catch (error) {
      console.error('Error saving welcome config:', error);
      toast.error('Failed to save welcome message configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const response = await apiService.testWelcomeMessage(serverId, config);
      
      if (response.success) {
        toast.success('Test welcome message sent! Check your server.');
      } else {
        toast.error('Failed to send test welcome message');
      }
    } catch (error) {
      console.error('Error testing welcome message:', error);
      toast.error('Failed to send test welcome message');
    } finally {
      setTesting(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset to default welcome message configuration?')) {
      try {
        setSaving(true);
        const response = await apiService.resetWelcomeMessageConfig(serverId);
        
        if (response.success) {
          toast.success('Welcome message configuration reset to defaults');
          loadWelcomeConfig(); // Reload the defaults
        } else {
          toast.error('Failed to reset welcome message configuration');
        }
      } catch (error) {
        console.error('Error resetting welcome config:', error);
        toast.error('Failed to reset welcome message configuration');
      } finally {
        setSaving(false);
      }
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

  const updateField = (index: number, field: Partial<WelcomeMessageField>) => {
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

  if (!isOpen) return null;

  return (
    <ConfigModal
      isOpen={isOpen}
      onClose={onClose}
      title="Welcome Message Configuration"
      description="Customize the message new members see when they join your server"
      icon="👋"
      loading={loading}
      loadingText="Loading configuration..."
      actions={
        <ModalActions.TestSaveCancel
          onTest={handleTest}
          onSave={handleSave}
          onCancel={onClose}
          testing={testing}
          saving={saving}
          testText="Test Message"
          saveText="Save Configuration"
          testIcon={EyeIcon}
          saveIcon={CheckIcon}
        />
      }
    >
      <div className="space-y-6">
            {/* Available Variables Info */}
            <div className={classNames(
              "p-4 rounded-lg border-l-4 border-blue-500",
              darkMode ? "bg-blue-900/20" : "bg-blue-50"
            )}>
              <h3 className={classNames(
                "font-semibold mb-2",
                darkMode ? "text-blue-300" : "text-blue-800"
              )}>
                Available Variables
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <code className={classNames(
                  "px-2 py-1 rounded",
                  darkMode ? "bg-gray-700 text-blue-300" : "bg-blue-100 text-blue-800"
                )}>
                  {'{user}'}
                </code>
                <code className={classNames(
                  "px-2 py-1 rounded",
                  darkMode ? "bg-gray-700 text-blue-300" : "bg-blue-100 text-blue-800"
                )}>
                  {'{server}'}
                </code>
                <code className={classNames(
                  "px-2 py-1 rounded",
                  darkMode ? "bg-gray-700 text-blue-300" : "bg-blue-100 text-blue-800"
                )}>
                  {'{memberCount}'}
                </code>
                <code className={classNames(
                  "px-2 py-1 rounded",
                  darkMode ? "bg-gray-700 text-blue-300" : "bg-blue-100 text-blue-800"
                )}>
                  {'{date}'}
                </code>
              </div>
            </div>

            {/* Title */}
            <FormField
              type="input"
              label="Message Title"
              value={config.title}
              onChange={(value) => setConfig({ ...config, title: value })}
              placeholder="Welcome to the Server! 👋"
            />

            {/* Description */}
            <FormField
              type="textarea"
              label="Message Description"
              value={config.description}
              onChange={(value) => setConfig({ ...config, description: value })}
              placeholder="Hey {user}! Welcome to **{server}**!"
              rows={4}
            />

            {/* Color */}
            <FormField
              type="color"
              label="Embed Color"
              value={config.color}
              onChange={(value) => setConfig({ ...config, color: value })}
            />

            {/* Fields */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className={classNames(
                  "block text-sm font-medium",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Embed Fields
                </label>
                <ActionButton
                  onClick={addField}
                  variant="success"
                  size="sm"
                  icon={PlusIcon}
                >
                  Add Field
                </ActionButton>
              </div>

              <div className="space-y-4">
                {config.fields.map((field, index) => (
                  <div key={index} className={classNames(
                    "p-4 rounded-lg border",
                    darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={classNames(
                        "text-sm font-medium",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        Field {index + 1}
                      </span>
                      <ActionButton
                        onClick={() => removeField(index)}
                        variant="ghost"
                        size="xs"
                        icon={TrashIcon}
                        className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                      >
                        Remove
                      </ActionButton>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FormField
                        type="input"
                        label="Field Name"
                        value={field.name}
                        onChange={(value) => updateField(index, { name: value })}
                        className="text-sm"
                      />

                      <FormField
                        type="textarea"
                        label="Field Value"
                        value={field.value}
                        onChange={(value) => updateField(index, { value: value })}
                        rows={2}
                        className="text-sm"
                      />
                    </div>

                    <div className="mt-3">
                      <FormField
                        type="checkbox"
                        label="Display inline"
                        checked={field.inline || false}
                        onChange={(checked) => updateField(index, { inline: checked })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reset Button */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <ActionButton
                onClick={handleReset}
                disabled={saving}
                variant="danger"
                size="sm"
              >
                Reset to Default
              </ActionButton>
            </div>

      </div>
    </ConfigModal>
  );
};

export default WelcomeMessageConfigModal;