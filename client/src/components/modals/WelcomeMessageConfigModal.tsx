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
// function classNames(...classes: string[]) {
//   return classes.filter(Boolean).join(' ');
// }

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
      maxWidth="2xl"
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
            <div className="p-4 rounded-lg border-l-4 border-primary bg-primary/10">
              <h3 className="font-semibold mb-2 text-primary">
                Available Variables
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <code className="px-2 py-1 rounded bg-muted text-primary">
                  {'{user}'}
                </code>
                <code className="px-2 py-1 rounded bg-muted text-primary">
                  {'{server}'}
                </code>
                <code className="px-2 py-1 rounded bg-muted text-primary">
                  {'{memberCount}'}
                </code>
                <code className="px-2 py-1 rounded bg-muted text-primary">
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
                <label className="block text-sm font-medium text-foreground">
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
                  <div key={index} className="p-4 rounded-lg border border-border bg-muted/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-foreground">
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
                      />

                      <FormField
                        type="textarea"
                        label="Field Value"
                        value={field.value}
                        onChange={(value) => updateField(index, { value: value })}
                        rows={2}
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
            <div className="pt-4 border-t border-border">
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