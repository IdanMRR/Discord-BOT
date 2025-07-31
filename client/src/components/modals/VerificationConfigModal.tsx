import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import {
  XMarkIcon,
  EyeIcon,
  CheckIcon,
  ShieldCheckIcon,
  TrashIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface VerificationField {
  name: string;
  value: string;
  inline?: boolean;
}

interface VerificationConfig {
  title: string;
  description: string;
  color: string;
  buttonText: string;
  fields: VerificationField[];
}

interface VerificationConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
}

const VerificationConfigModal: React.FC<VerificationConfigModalProps> = ({
  isOpen,
  onClose,
  serverId
}) => {
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const [config, setConfig] = useState<VerificationConfig>({
    title: '✅ Server Verification Required',
    description: '**Welcome to our server!**\n\nTo access all channels and features, please verify yourself by clicking the button below.\n\nThis helps us maintain a safe and friendly community for everyone.',
    color: '#00D166',
    buttonText: '✅ Verify Me',
    fields: [
      {
        name: '📋 What happens next?',
        value: '• You\'ll get access to all channels\n• You can participate in discussions\n• You\'ll receive the **Verified** role',
        inline: false
      },
      {
        name: '🛡️ Why verify?',
        value: 'Verification helps us prevent spam and keep our community safe.',
        inline: true
      },
      {
        name: '⏱️ How long does it take?',
        value: 'Instant! Just click the button.',
        inline: true
      }
    ]
  });

  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [verificationChannel, setVerificationChannel] = useState<string>('');
  const [verifiedRole, setVerifiedRole] = useState<string>('');
  const [verificationType, setVerificationType] = useState<string>('button');
  const [panelStyle, setPanelStyle] = useState<string>('modern');
  const [showFooter, setShowFooter] = useState<boolean>(true);
  const [footerText, setFooterText] = useState<string>('Click the button below to get verified!');
  const [thumbnail, setThumbnail] = useState<string>('');
  const [author, setAuthor] = useState<string>('');

  // Predefined styles
  const panelStyles = {
    modern: {
      name: 'Modern',
      description: 'Clean modern design with gradient accents',
      color: '#00D166',
      previewClass: 'border-l-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20'
    },
    classic: {
      name: 'Classic',
      description: 'Traditional Discord-style embed',
      color: '#5865F2',
      previewClass: 'border-l-4 bg-gray-50 dark:bg-gray-800'
    },
    security: {
      name: 'Security',
      description: 'Professional security-focused design',
      color: '#ED4245',
      previewClass: 'border-l-4 bg-red-50 dark:bg-red-900/20'
    },
    minimal: {
      name: 'Minimal',
      description: 'Simple and clean design',
      color: '#57F287',
      previewClass: 'border-l-4 bg-white dark:bg-gray-700'
    },
    premium: {
      name: 'Premium',
      description: 'Elegant premium design with gold accents',
      color: '#FEE75C',
      previewClass: 'border-l-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20'
    }
  };

  const loadVerificationConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getVerificationConfig(serverId);
      
      if (response.success && response.data) {
        setConfig({
          title: response.data.title || config.title,
          description: response.data.description || config.description,
          color: response.data.color || config.color,
          buttonText: response.data.buttonText || config.buttonText,
          fields: response.data.fields || config.fields
        });
      }
    } catch (error) {
      console.error('Error loading verification config:', error);
    } finally {
      setLoading(false);
    }
  }, [serverId, config.title, config.description, config.color, config.buttonText, config.fields]);

  const loadChannelsAndRoles = useCallback(async () => {
    try {
      const response = await apiService.getServerChannelsAndRoles(serverId);
      
      if (response.success && response.data) {
        setChannels(response.data.channels || []);
        setRoles(response.data.roles || []);
      }
    } catch (error) {
      console.error('Error loading channels and roles:', error);
    }
  }, [serverId]);

  // Load existing configuration
  useEffect(() => {
    if (isOpen && serverId) {
      loadVerificationConfig();
      loadChannelsAndRoles();
    }
  }, [isOpen, serverId, loadVerificationConfig, loadChannelsAndRoles]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await apiService.saveVerificationConfig(serverId, config);
      
      if (response.success) {
        toast.success('Verification configuration saved!');
      } else {
        toast.error('Failed to save verification configuration');
      }
    } catch (error) {
      console.error('Error saving verification config:', error);
      toast.error('Failed to save verification configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePanel = async () => {
    if (!verificationChannel) {
      toast.error('Please select a verification channel first');
      return;
    }

    try {
      setCreating(true);
      
      // Save configuration first
      await apiService.saveVerificationConfig(serverId, config);
      
      // Update verification settings
      await apiService.updateVerificationSettings(serverId, {
        verification_channel_id: verificationChannel,
        verified_role_id: verifiedRole,
        verification_type: verificationType
      });
      
      // Create verification message
      const response = await apiService.createVerificationMessage(serverId, verificationChannel);
      
      if (response.success) {
        toast.success('Verification panel created successfully!');
        onClose();
      } else {
        toast.error('Failed to create verification panel');
      }
    } catch (error) {
      console.error('Error creating verification panel:', error);
      toast.error('Failed to create verification panel');
    } finally {
      setCreating(false);
    }
  };

  const handleTest = async () => {
    if (!verificationChannel) {
      toast.error('Please select a verification channel first');
      return;
    }

    try {
      const response = await apiService.testVerificationMessage(serverId, config);
      
      if (response.success) {
        toast.success('Test verification message sent! Check your server.');
      } else {
        toast.error('Failed to send test verification message');
      }
    } catch (error) {
      console.error('Error testing verification message:', error);
      toast.error('Failed to send test verification message');
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset to default verification configuration?')) {
      try {
        setSaving(true);
        const response = await apiService.resetVerificationConfig(serverId);
        
        if (response.success) {
          toast.success('Verification configuration reset to defaults');
          loadVerificationConfig();
        } else {
          toast.error('Failed to reset verification configuration');
        }
      } catch (error) {
        console.error('Error resetting verification config:', error);
        toast.error('Failed to reset verification configuration');
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

  const updateField = (index: number, field: Partial<VerificationField>) => {
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

  const handleStyleChange = (styleKey: string) => {
    setPanelStyle(styleKey);
    const style = panelStyles[styleKey as keyof typeof panelStyles];
    setConfig({ ...config, color: style.color });
  };

  if (!isOpen) return null;

  return (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[45] flex items-center justify-center p-4">
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
              ✅ Verification System Configuration
            </h2>
            <p className={classNames(
              "text-sm mt-1",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              Set up member verification to keep your server secure
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <p className={classNames(
              "mt-4",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              Loading configuration...
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Settings Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Verification Channel */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Verification Channel
                </label>
                <select
                  value={verificationChannel}
                  onChange={(e) => setVerificationChannel(e.target.value)}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                    "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  )}
                >
                  <option value="">-- Select Channel --</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Verified Role */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Verified Role
                </label>
                <select
                  value={verifiedRole}
                  onChange={(e) => setVerifiedRole(e.target.value)}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                    "focus:outline-none focus:ring-2 focus:ring-green-500/20"
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

              {/* Verification Type */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Verification Type
                </label>
                <select
                  value={verificationType}
                  onChange={(e) => setVerificationType(e.target.value)}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                    "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  )}
                >
                  <option value="button">🔘 Button Click</option>
                  <option value="captcha">🤖 Captcha</option>
                  <option value="custom_question">❓ Custom Question</option>
                  <option value="age_verification">🔞 Age Verification</option>
                </select>
              </div>
            </div>

            {/* Panel Configuration */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Panel Title
                </label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                    "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  )}
                />
              </div>

              {/* Description */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Panel Description
                </label>
                <textarea
                  value={config.description}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  rows={4}
                  className={classNames(
                    "w-full px-3 py-2 rounded-lg border transition-colors",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                      : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                    "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  )}
                />
              </div>

              {/* Button Text & Color */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Button Text
                  </label>
                  <input
                    type="text"
                    value={config.buttonText}
                    onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                      "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    )}
                  />
                </div>

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
                          ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                          : "bg-white border-gray-300 text-gray-900 focus:border-green-500"
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-3">
                <h3 className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Custom Fields
                </h3>
                {config.fields.map((field, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Field Name"
                      value={field.name}
                      onChange={(e) => updateField(index, { name: e.target.value })}
                      className={classNames(
                        "w-full px-3 py-2 rounded-lg border transition-colors",
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                          : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                        "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      )}
                    />
                    <input
                      type="text"
                      placeholder="Field Value"
                      value={field.value}
                      onChange={(e) => updateField(index, { value: e.target.value })}
                      className={classNames(
                        "w-full px-3 py-2 rounded-lg border transition-colors",
                        darkMode 
                          ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                          : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                        "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      )}
                    />
                                         <button
                       onClick={() => removeField(index)}
                       className="p-2 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                       title="Remove Field"
                     >
                       <TrashIcon className="h-4 w-4" />
                     </button>
                  </div>
                ))}
                                 <button
                   onClick={addField}
                   className="p-2 rounded-lg text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/20"
                   title="Add Field"
                 >
                   <PlusIcon className="h-4 w-4" />
                 </button>
              </div>

              {/* Panel Style */}
              <div className="space-y-2">
                <h3 className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Panel Style
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(panelStyles).map(([key, style]) => (
                    <button
                      key={key}
                      onClick={() => handleStyleChange(key)}
                      className={classNames(
                        "px-4 py-2 rounded-lg font-medium transition-colors border",
                        config.color === style.color
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white border-gray-300 text-gray-900 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      )}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showFooter"
                  checked={showFooter}
                  onChange={(e) => setShowFooter(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="showFooter" className={classNames(
                  "text-sm",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Show Footer
                </label>
              </div>
              {showFooter && (
                <div className="flex items-center space-x-2">
                  <label className={classNames(
                    "block text-sm font-medium",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Footer Text
                  </label>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                      "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    )}
                  />
                </div>
              )}

              {/* Thumbnail & Author */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Thumbnail URL
                  </label>
                  <input
                    type="text"
                    value={thumbnail}
                    onChange={(e) => setThumbnail(e.target.value)}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                      "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    )}
                  />
                </div>
                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Author Name
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white focus:border-green-500" 
                        : "bg-white border-gray-300 text-gray-900 focus:border-green-500",
                      "focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Enhanced Preview */}
            <div className={classNames(
              "p-4 rounded-lg border",
              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Live Preview
                </h3>
                <div className={classNames(
                  "px-2 py-1 rounded text-xs font-medium",
                  panelStyles[panelStyle as keyof typeof panelStyles]?.color === config.color
                    ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                )}>
                  {panelStyles[panelStyle as keyof typeof panelStyles]?.name || 'Custom'} Style
                </div>
              </div>
              
              <div className={classNames(
                "p-4 rounded-lg relative overflow-hidden",
                panelStyles[panelStyle as keyof typeof panelStyles]?.previewClass || "border-l-4 bg-white dark:bg-gray-800"
              )} style={{ borderLeftColor: config.color }}>
                {/* Author */}
                {author && (
                  <div className="flex items-center mb-2">
                    <div className="w-6 h-6 bg-gray-400 rounded-full mr-2"></div>
                    <span className={classNames(
                      "text-sm font-medium",
                      darkMode ? "text-gray-200" : "text-gray-800"
                    )}>
                      {author}
                    </span>
                  </div>
                )}
                
                {/* Thumbnail */}
                {thumbnail && (
                  <div className="absolute top-4 right-4 w-20 h-20">
                    <img 
                      src={thumbnail} 
                      alt="Thumbnail" 
                      className="w-full h-full object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                {/* Title */}
                <h4 className={classNames(
                  "font-bold mb-2 text-lg",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {config.title}
                </h4>
                
                {/* Description */}
                <div className={classNames(
                  "text-sm whitespace-pre-wrap mb-4 leading-relaxed",
                  darkMode ? "text-gray-300" : "text-gray-600"
                )}>
                  {config.description}
                </div>
                
                {/* Fields */}
                {config.fields && config.fields.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {config.fields.map((field, index) => (
                      <div key={index} className={classNames(
                        field.inline ? "col-span-1" : "col-span-full"
                      )}>
                        <div className={classNames(
                          "font-semibold text-sm mb-1",
                          darkMode ? "text-gray-200" : "text-gray-800"
                        )}>
                          {field.name}
                        </div>
                        <div className={classNames(
                          "text-xs leading-relaxed",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          {field.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Button */}
                <div className="flex justify-start mb-3">
                  <button 
                    className={classNames(
                      "px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md",
                      panelStyle === 'modern' ? "bg-gradient-to-r from-green-600 to-blue-600 text-white" :
                      panelStyle === 'security' ? "bg-red-600 text-white" :
                      panelStyle === 'premium' ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white" :
                      "bg-green-600 text-white"
                    )}
                    style={panelStyle === 'classic' || panelStyle === 'minimal' ? { backgroundColor: config.color } : {}}
                  >
                    {config.buttonText}
                  </button>
                </div>
                
                {/* Footer */}
                {showFooter && footerText && (
                  <div className={classNames(
                    "text-xs border-t pt-2 mt-2",
                    darkMode ? "text-gray-500 border-gray-600" : "text-gray-400 border-gray-200"
                  )}>
                    {footerText}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-3">
                <button
                  onClick={handleTest}
                  disabled={!verificationChannel}
                  className={classNames(
                    "px-4 py-2 rounded-lg font-medium transition-colors border",
                    darkMode 
                      ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                      : "border-gray-300 text-gray-700 hover:bg-gray-50",
                    !verificationChannel ? "opacity-50 cursor-not-allowed" : ""
                  )}
                >
                  <EyeIcon className="h-4 w-4 inline mr-2" />
                  Test Panel
                </button>

                <button
                  onClick={handleReset}
                  disabled={saving}
                  className={classNames(
                    "px-4 py-2 rounded-lg font-medium transition-colors border",
                    "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20",
                    saving ? "opacity-50 cursor-not-allowed" : ""
                  )}
                >
                  Reset to Default
                </button>
              </div>

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
                      ? "bg-blue-600 text-white hover:bg-blue-700" 
                      : "bg-blue-600 text-white hover:bg-blue-700",
                    saving ? "opacity-50 cursor-not-allowed" : ""
                  )}
                >
                  <CheckIcon className="h-4 w-4 inline mr-2" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>

                <button
                  onClick={handleCreatePanel}
                  disabled={creating || !verificationChannel}
                  className={classNames(
                    "px-4 py-2 rounded-lg font-medium transition-colors",
                    "bg-green-600 hover:bg-green-700 text-white",
                    (creating || !verificationChannel) ? "opacity-50 cursor-not-allowed" : ""
                  )}
                >
                  <ShieldCheckIcon className="h-4 w-4 inline mr-2" />
                  {creating ? 'Creating...' : 'Create Panel'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationConfigModal;