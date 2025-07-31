import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import {
  XMarkIcon,
  EyeIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface GoodbyeMessageField {
  name: string;
  value: string;
  inline?: boolean;
}

interface GoodbyeMessageConfig {
  title: string;
  description: string;
  color: string;
  fields: GoodbyeMessageField[];
}

interface GoodbyeMessageConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
}

const GoodbyeMessageConfigModal: React.FC<GoodbyeMessageConfigModalProps> = ({
  isOpen,
  onClose,
  serverId
}) => {
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState<GoodbyeMessageConfig>({
    title: 'Goodbye! 👋',
    description: 'See you later, {user}! Thanks for being part of **{server}**.\n\nWe hope you enjoyed your time here and wish you the best!',
    color: '#FF6B35',
    fields: [
      {
        name: '💝 Thank you for being part of our community',
        value: 'Your contributions made a difference!',
        inline: false
      },
      {
        name: '🚪 Always welcome back',
        value: 'Our doors are always open for you to return.',
        inline: true
      },
      {
        name: '🌟 Stay awesome',
        value: 'Keep being amazing wherever you go!',
        inline: true
      }
    ]
  });

  const loadGoodbyeConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getGoodbyeMessageConfig(serverId);
      
      if (response.success && response.data) {
        setConfig(prevConfig => ({
          title: response.data!.title || prevConfig.title,
          description: response.data!.description || prevConfig.description,
          color: response.data!.color || prevConfig.color,
          fields: response.data!.fields || prevConfig.fields
        }));
      }
    } catch (error) {
      console.error('Error loading goodbye config:', error);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  // Load existing configuration
  useEffect(() => {
    if (isOpen && serverId) {
      loadGoodbyeConfig();
    }
  }, [isOpen, serverId, loadGoodbyeConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await apiService.saveGoodbyeMessageConfig(serverId, config);
      
      if (response.success) {
        toast.success('Goodbye message configuration saved!');
        onClose();
      } else {
        toast.error('Failed to save goodbye message configuration');
      }
    } catch (error) {
      console.error('Error saving goodbye config:', error);
      toast.error('Failed to save goodbye message configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      const response = await apiService.testGoodbyeMessage(serverId, config);
      
      if (response.success) {
        toast.success('Test goodbye message sent! Check your server.');
      } else {
        toast.error('Failed to send test goodbye message');
      }
    } catch (error) {
      console.error('Error testing goodbye message:', error);
      toast.error('Failed to send test goodbye message');
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

  const updateField = (index: number, field: Partial<GoodbyeMessageField>) => {
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
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className={classNames(
        "max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-xl",
        darkMode ? "bg-gray-800" : "bg-white"
      )}>
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
              👋 Goodbye Message Configuration
            </h2>
            <p className={classNames(
              "text-sm mt-1",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              Customize messages shown when members leave your server
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
            <p className={classNames(
              "mt-4",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              Loading configuration...
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Variables Help */}
            <div className={classNames(
              "p-4 rounded-lg border-l-4 border-orange-500",
              darkMode ? "bg-orange-900/20" : "bg-orange-50"
            )}>
              <h3 className={classNames(
                "text-sm font-medium mb-2",
                darkMode ? "text-orange-300" : "text-orange-800"
              )}>
                Available Variables:
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <code className={classNames(
                  "px-2 py-1 rounded",
                  darkMode ? "bg-gray-700 text-orange-300" : "bg-orange-100 text-orange-800"
                )}>
                  {'{user}'} - User name
                </code>
                <code className={classNames(
                  "px-2 py-1 rounded",
                  darkMode ? "bg-gray-700 text-orange-300" : "bg-orange-100 text-orange-800"
                )}>
                  {'{server}'} - Server name
                </code>
                <code className={classNames(
                  "px-2 py-1 rounded",
                  darkMode ? "bg-gray-700 text-orange-300" : "bg-orange-100 text-orange-800"
                )}>
                  {'{memberCount}'} - Member count
                </code>
                <code className={classNames(
                  "px-2 py-1 rounded",
                  darkMode ? "bg-gray-700 text-orange-300" : "bg-orange-100 text-orange-800"
                )}>
                  {'{date}'} - Current date
                </code>
              </div>
            </div>

            {/* Basic Configuration */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Message Title
                </label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-orange-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-orange-500",
                    "focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  )}
                />
              </div>

              {/* Description */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Message Description
                </label>
                <textarea
                  value={config.description}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  rows={4}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-orange-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-orange-500",
                    "focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  )}
                />
              </div>

              {/* Color */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Embed Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={config.color}
                    onChange={(e) => setConfig({ ...config, color: e.target.value })}
                    className="w-12 h-10 rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={config.color}
                    onChange={(e) => setConfig({ ...config, color: e.target.value })}
                    className={classNames(
                      "flex-1 px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white focus:border-orange-500" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-orange-500"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Fields Configuration */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className={classNames(
                  "text-lg font-medium",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Message Fields
                </h3>
                <button
                  onClick={addField}
                  className={classNames(
                    "px-3 py-1 rounded text-sm font-medium transition-colors",
                    "bg-orange-600 hover:bg-orange-700 text-white"
                  )}
                >
                  Add Field
                </button>
              </div>

              <div className="space-y-3">
                {config.fields.map((field, index) => (
                  <div key={index} className={classNames(
                    "p-4 rounded-lg border",
                    darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={classNames(
                          "block text-sm font-medium mb-1",
                          darkMode ? "text-gray-300" : "text-gray-700"
                        )}>
                          Field Name
                        </label>
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => updateField(index, { name: e.target.value })}
                          className={classNames(
                            "w-full px-3 py-2 rounded border transition-colors text-sm",
                            darkMode 
                              ? "bg-gray-600 border-gray-500 text-white" 
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                        />
                      </div>
                      <div>
                        <label className={classNames(
                          "block text-sm font-medium mb-1",
                          darkMode ? "text-gray-300" : "text-gray-700"
                        )}>
                          Field Value
                        </label>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => updateField(index, { value: e.target.value })}
                          className={classNames(
                            "w-full px-3 py-2 rounded border transition-colors text-sm",
                            darkMode 
                              ? "bg-gray-600 border-gray-500 text-white" 
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={field.inline || false}
                          onChange={(e) => updateField(index, { inline: e.target.checked })}
                          className="mr-2"
                        />
                        <span className={classNames(
                          "text-sm",
                          darkMode ? "text-gray-300" : "text-gray-700"
                        )}>
                          Inline field
                        </span>
                      </label>
                      <button
                        onClick={() => removeField(index)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className={classNames(
              "p-4 rounded-lg border",
              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <h3 className={classNames(
                "text-sm font-medium mb-3",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Preview
              </h3>
              <div className={classNames(
                "p-4 rounded border-l-4",
                darkMode ? "bg-gray-800" : "bg-white"
              )} style={{ borderLeftColor: config.color }}>
                <h4 className={classNames(
                  "font-bold mb-2",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {config.title}
                </h4>
                <div className={classNames(
                  "text-sm whitespace-pre-wrap mb-3",
                  darkMode ? "text-gray-300" : "text-gray-600"
                )}>
                  {config.description}
                </div>
                {config.fields.length > 0 && (
                  <div className="space-y-2">
                    {config.fields.map((field, index) => (
                      <div key={index}>
                        <div className={classNames(
                          "text-sm font-medium",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                          {field.name}
                        </div>
                        <div className={classNames(
                          "text-sm",
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

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleTest}
                className={classNames(
                  "px-4 py-2 rounded-lg font-medium transition-colors border",
                  darkMode 
                    ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                <EyeIcon className="h-4 w-4 inline mr-2" />
                Test Message
              </button>

              <div className="flex space-x-3">
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
                    darkMode 
                      ? "bg-orange-600 text-white hover:bg-orange-700" 
                      : "bg-orange-600 text-white hover:bg-orange-700",
                    saving ? "opacity-50 cursor-not-allowed" : ""
                  )}
                >
                  <CheckIcon className="h-4 w-4 inline mr-2" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoodbyeMessageConfigModal;