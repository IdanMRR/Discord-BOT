import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import {
  EyeIcon,
  CheckIcon,
  ShieldCheckIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import ConfigModal from '../common/ConfigModal';
import FormField from '../common/FormField';
import ActionButton from '../common/ActionButton';
import CompactField from '../common/CompactField';

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
  // const { primaryColor } = useNewTheme(); // Removed unused variable
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
  // Removed unused panel style variables
  // const [panelStyle, setPanelStyle] = useState<string>('modern');
  // const [showFooter, setShowFooter] = useState<boolean>(true);
  // const [footerText, setFooterText] = useState<string>('Click the button below to get verified!');
  // const [thumbnail, setThumbnail] = useState<string>('');
  // const [author, setAuthor] = useState<string>('');

  // Predefined styles
  // const panelStyles = {
  //   modern: {
  //     name: 'Modern',
  //     description: 'Clean modern design with gradient accents',
  //     color: '#00D166',
  //     previewClass: 'border-l-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20'
  //   },
  //   classic: {
  //     name: 'Classic',
  //     description: 'Traditional Discord-style embed',
  //     color: '#5865F2',
  //     previewClass: 'border-l-4 bg-gray-50 dark:bg-gray-800'
  //   },
  //   security: {
  //     name: 'Security',
  //     description: 'Professional security-focused design',
  //     color: '#ED4245',
  //     previewClass: 'border-l-4 bg-red-50 dark:bg-red-900/20'
  //   },
  //   minimal: {
  //     name: 'Minimal',
  //     description: 'Simple and clean design',
  //     color: '#57F287',
  //     previewClass: 'border-l-4 bg-white dark:bg-gray-700'
  //   },
  //   premium: {
  //     name: 'Premium',
  //     description: 'Elegant premium design with gold accents',
  //     color: '#FEE75C',
  //     previewClass: 'border-l-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20'
  //   }
  // };

  const loadVerificationConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getVerificationConfig(serverId);
      
      if (response.success && response.data) {
        const data = response.data;
        setConfig(prevConfig => ({
          title: data.title || prevConfig.title,
          description: data.description || prevConfig.description,
          color: data.color || prevConfig.color,
          buttonText: data.buttonText || prevConfig.buttonText,
          fields: data.fields || prevConfig.fields
        }));
      }
    } catch (error) {
      console.error('Error loading verification config:', error);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

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
    // Validate all required fields
    if (!verificationChannel || verificationChannel === '') {
      toast.error('Please select a verification channel');
      return;
    }
    
    if (!verifiedRole || verifiedRole === '') {
      toast.error('Please select a verified role');
      return;
    }
    
    if (!config.title || config.title.trim() === '') {
      toast.error('Please enter a panel title');
      return;
    }
    
    if (!config.description || config.description.trim() === '') {
      toast.error('Please enter a panel description');
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
    // Validate required fields for testing
    if (!verificationChannel || verificationChannel === '') {
      toast.error('Please select a verification channel to test in');
      return;
    }
    
    if (!config.title || config.title.trim() === '') {
      toast.error('Please enter a panel title before testing');
      return;
    }
    
    if (!config.description || config.description.trim() === '') {
      toast.error('Please enter a panel description before testing');
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

  // Removed unused style change handler
  // const handleStyleChange = (styleKey: string) => {
  //   setPanelStyle(styleKey);
  //   const style = panelStyles[styleKey as keyof typeof panelStyles];
  //   setConfig({ ...config, color: style.color });
  // };

  if (!isOpen) return null;

  return (
    <ConfigModal
      isOpen={isOpen}
      onClose={onClose}
      title="Verification System Configuration"
      description="Set up member verification to keep your server secure"
      icon="✅"
      maxWidth="2xl"
      loading={loading}
      loadingText="Loading configuration..."
      actions={
        <div className="flex items-center justify-between w-full">
          <div className="flex space-x-3">
            <ActionButton
              onClick={handleTest}
              disabled={!verificationChannel}
              variant="outline"
              icon={EyeIcon}
            >
              Test Panel
            </ActionButton>
            <ActionButton
              onClick={handleReset}
              disabled={saving}
              variant="danger"
            >
              Reset to Default
            </ActionButton>
          </div>
          <div className="flex space-x-3">
            <ActionButton
              onClick={onClose}
              variant="outline"
              disabled={saving || creating}
            >
              Cancel
            </ActionButton>
            <ActionButton
              onClick={handleSave}
              disabled={saving}
              loading={saving}
              variant="primary"
              icon={CheckIcon}
            >
              Save Configuration
            </ActionButton>
            <ActionButton
              onClick={handleCreatePanel}
              disabled={creating || !verificationChannel}
              loading={creating}
              variant="success"
              icon={ShieldCheckIcon}
            >
              Create Panel
            </ActionButton>
          </div>
        </div>
      }
    >
          <div className="space-y-6">
            {/* Settings Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Verification Channel */}
              <FormField
                type="select"
                label="Verification Channel"
                value={verificationChannel}
                onChange={setVerificationChannel}
                options={[
                  { value: "", label: "-- Select Channel --" },
                  ...channels.map(channel => ({ value: channel.id, label: `#${channel.name}` }))
                ]}
                className="text-sm"
              />

              {/* Verified Role */}
              <FormField
                type="select"
                label="Verified Role"
                value={verifiedRole}
                onChange={setVerifiedRole}
                options={[
                  { value: "", label: "-- Select Role --" },
                  ...roles.map(role => ({ value: role.id, label: `@${role.name}` }))
                ]}
                className="text-sm"
              />

              {/* Verification Type */}
              <FormField
                type="select"
                label="Verification Type"
                value={verificationType}
                onChange={setVerificationType}
                options={[
                  { value: "button", label: "🔘 Button Click" },
                  { value: "captcha", label: "🤖 Captcha" },
                  { value: "custom_question", label: "❓ Custom Question" },
                  { value: "age_verification", label: "🔞 Age Verification" }
                ]}
                className="text-sm"
              />
            </div>

            {/* Panel Configuration */}
            <div className="space-y-3">
              {/* Title & Button Text in one row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  type="input"
                  label="Panel Title"
                  value={config.title}
                  onChange={(value) => setConfig({ ...config, title: value })}
                  placeholder="✅ Server Verification Required"
                  description="This will be the main title of your verification embed"
                  required
                  className="text-sm"
                />
                <FormField
                  type="input"
                  label="Button Text"
                  value={config.buttonText}
                  onChange={(value) => setConfig({ ...config, buttonText: value })}
                  placeholder="✅ Verify Me"
                  description="Text displayed on the verification button"
                  required
                  className="text-sm"
                />
              </div>

              {/* Description & Color in one row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-3">
                  <FormField
                    type="textarea"
                    label="Panel Description"
                    value={config.description}
                    onChange={(value) => setConfig({ ...config, description: value })}
                    rows={3}
                    placeholder="Welcome to our server! To access all channels and features, please verify yourself by clicking the button below."
                    description="Main message explaining the verification process"
                    required
                    className="text-sm"
                  />
                </div>
                <FormField
                  type="color"
                  label="Embed Color"
                  value={config.color}
                  onChange={(value) => setConfig({ ...config, color: value })}
                  className="text-sm"
                />
              </div>

              {/* Fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
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

            </div>

            {/* Discord-style Preview */}
            <div className={classNames(
              "p-4 rounded-lg border",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={classNames(
                  "text-sm font-medium flex items-center gap-2",
                  darkMode ? "text-gray-200" : "text-gray-800"
                )}>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Live Preview
                </h3>
                <div className={classNames(
                  "px-2 py-1 rounded text-xs font-medium",
                  "bg-discord-blurple/10 text-discord-blurple border border-discord-blurple/20"
                )}>
                  Discord Embed
                </div>
              </div>
              
              {/* Discord Channel Header */}
              <div className={classNames(
                "flex items-center gap-2 mb-3 p-2 rounded",
                darkMode ? "bg-gray-700/50" : "bg-white/50"
              )}>
                <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  #
                </div>
                <span className={classNames(
                  "text-sm font-medium",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  verification
                </span>
              </div>
              
              {/* Bot Message */}
              <div className="flex gap-3 mb-2">
                <div className="w-8 h-8 bg-discord-blurple rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  🤖
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={classNames(
                      "text-sm font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>
                      Server Bot
                    </span>
                    <span className="bg-discord-blurple text-white text-xs px-1.5 py-0.5 rounded font-medium">
                      BOT
                    </span>
                    <span className={classNames(
                      "text-xs",
                      darkMode ? "text-gray-400" : "text-gray-500"
                    )}>
                      Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {/* Discord Embed */}
                  <div className={classNames(
                    "rounded-md overflow-hidden border-l-4 max-w-lg",
                    darkMode ? "bg-gray-750" : "bg-gray-50"
                  )} style={{ borderLeftColor: config.color }}>
                    <div className="p-4">
                      {/* Embed Title */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🔒</span>
                        <h4 className={classNames(
                          "font-semibold text-base",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                          {config.title || "Server Verification Required"}
                        </h4>
                      </div>
                      
                      {/* Embed Description */}
                      <div className={classNames(
                        "text-sm mb-4 whitespace-pre-wrap leading-relaxed",
                        darkMode ? "text-gray-300" : "text-gray-600"
                      )}>
                        {config.description || "Welcome to our server! Please verify yourself to gain access."}
                      </div>
                      
                      {/* Embed Fields */}
                      {config.fields && config.fields.length > 0 && (
                        <div className="mb-4">
                          <div className="grid gap-3">
                            {config.fields.map((field, index) => (
                              <div key={index} className={classNames(
                                field.inline ? "inline-block mr-6 min-w-0" : "block",
                                field.inline ? "max-w-xs" : ""
                              )}>
                                <div className={classNames(
                                  "font-semibold text-sm mb-1",
                                  darkMode ? "text-gray-200" : "text-gray-800"
                                )}>
                                  {field.name}
                                </div>
                                <div className={classNames(
                                  "text-sm leading-relaxed whitespace-pre-wrap",
                                  darkMode ? "text-gray-300" : "text-gray-600"
                                )}>
                                  {field.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Verification Button */}
                      <div className="mb-2">
                        <button 
                          className={classNames(
                            "px-4 py-2 rounded font-medium text-sm transition-all duration-200 shadow-sm hover:shadow-md",
                            "bg-green-600 hover:bg-green-700 text-white"
                          )}
                          style={{ backgroundColor: config.color }}
                        >
                          {config.buttonText || "✅ Verify Me"}
                        </button>
                      </div>
                      
                      {/* Embed Footer */}
                      <div className={classNames(
                        "text-xs flex items-center justify-between pt-2 border-t",
                        darkMode ? "text-gray-500 border-gray-600" : "text-gray-400 border-gray-300"
                      )}>
                        <span>Click the button above to get verified!</span>
                        <span>{new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
    </ConfigModal>
  );
};

export default VerificationConfigModal;