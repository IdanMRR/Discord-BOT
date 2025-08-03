import React, { useState } from 'react';
import ConfigModal from '../common/ConfigModal';
import FormField from '../common/FormField';

interface TicketPanelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: TicketPanelConfig) => Promise<void>;
  initialConfig?: TicketPanelConfig;
}

export interface TicketPanelConfig {
  title: string;
  description: string;
  color: string;
  footer: string;
  buttonText: string;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

export const TicketPanelConfigModal: React.FC<TicketPanelConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig
}) => {
  const [config, setConfig] = useState<TicketPanelConfig>(
    initialConfig || {
      title: '🎫 Support Ticket System',
      description: '**Need help?** Create a support ticket and our staff team will assist you!\n\n📋 **Before creating a ticket:**\n• Check our rules and FAQ first\n• Be clear and detailed about your issue\n• Be patient - we\'ll respond as soon as possible\n\n🔒 **Your ticket will be private** between you and our staff team.',
      color: '#7C3AED',
      footer: 'Support System • Click the button below to get started',
      buttonText: 'Create Ticket',
      fields: [
        { name: '🔹 How to Create a Ticket', value: 'Click the button below to create a new support ticket.' },
        { name: '🔹 Response Time', value: 'Our staff team typically responds within a few hours.' },
        { name: '🔹 Categories Available', value: 'Select the category that best matches your request when creating a ticket.' }
      ]
    }
  );

  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!config.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!config.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!config.footer.trim()) {
      newErrors.footer = 'Footer is required';
    }

    if (!config.buttonText.trim()) {
      newErrors.buttonText = 'Button text is required';
    }

    // Validate color format
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!colorRegex.test(config.color)) {
      newErrors.color = 'Please enter a valid hex color (e.g., #7C3AED)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateConfig()) return;

    setIsSaving(true);
    try {
      await onSave(config);
      onClose();
    } catch (error) {
      console.error('Error saving ticket panel config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addField = () => {
    setConfig(prev => ({
      ...prev,
      fields: [...prev.fields, { name: '', value: '', inline: false }]
    }));
  };

  const removeField = (index: number) => {
    setConfig(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }));
  };

  const updateField = (index: number, field: { name: string; value: string; inline?: boolean }) => {
    setConfig(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? field : f)
    }));
  };

  const resetToDefault = () => {
    setConfig({
      title: '🎫 Support Ticket System',
      description: '**Need help?** Create a support ticket and our staff team will assist you!\n\n📋 **Before creating a ticket:**\n• Check our rules and FAQ first\n• Be clear and detailed about your issue\n• Be patient - we\'ll respond as soon as possible\n\n🔒 **Your ticket will be private** between you and our staff team.',
      color: '#7C3AED',
      footer: 'Support System • Click the button below to get started',
      buttonText: 'Create Ticket',
      fields: [
        { name: '🔹 How to Create a Ticket', value: 'Click the button below to create a new support ticket.' },
        { name: '🔹 Response Time', value: 'Our staff team typically responds within a few hours.' },
        { name: '🔹 Categories Available', value: 'Select the category that best matches your request when creating a ticket.' }
      ]
    });
    setErrors({});
  };

  return (
    <ConfigModal
      isOpen={isOpen}
      onClose={onClose}
      title="🎫 Customize Ticket Panel"
      description="Configure your custom ticket panel appearance and content"
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Basic Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Panel Title"
            type="input"
            value={config.title}
            onChange={(value) => setConfig(prev => ({ ...prev, title: value }))}
            placeholder="🎫 Support Ticket System"
            error={errors.title}
          />
          
          <FormField
            label="Button Text"
            type="input"
            value={config.buttonText}
            onChange={(value) => setConfig(prev => ({ ...prev, buttonText: value }))}
            placeholder="Create Ticket"
            error={errors.buttonText}
          />
        </div>

        <FormField
          label="Description"
          type="textarea"
          value={config.description}
          onChange={(value) => setConfig(prev => ({ ...prev, description: value }))}
          placeholder="Enter the main description for your ticket panel..."
          rows={4}
          error={errors.description}
          description="Supports Discord markdown formatting (**, *, etc.)"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Embed Color"
            type="color"
            value={config.color}
            onChange={(value) => setConfig(prev => ({ ...prev, color: value }))}
            error={errors.color}
            description="Choose the color for the ticket panel embed"
          />
          
          <FormField
            label="Footer Text"
            type="input"
            value={config.footer}
            onChange={(value) => setConfig(prev => ({ ...prev, footer: value }))}
            placeholder="Support System • Click the button below to get started"
            error={errors.footer}
          />
        </div>

        {/* Custom Fields */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Custom Fields</h3>
            <button
              type="button"
              onClick={addField}
              className="px-3 py-1 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 text-white bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              ➕ Add Field
            </button>
          </div>
          
          <div className="space-y-3">
            {config.fields.map((field, index) => (
              <div key={index} className="content-area p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Field {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    className="p-1 text-destructive hover:text-destructive/80 transition-colors"
                  >
                    🗑️
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    label="Field Name"
                    type="input"
                    value={field.name}
                    onChange={(value) => updateField(index, { ...field, name: value })}
                    placeholder="🔹 Field Title"
                  />
                  <FormField
                    label="Field Value"
                    type="input"
                    value={field.value}
                    onChange={(value) => updateField(index, { ...field, value })}
                    placeholder="Field description..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Preview</h3>
          <div className="content-area p-4 rounded-lg border border-border">
            <div 
              className="p-4 rounded-lg border-l-4 space-y-3"
              style={{ borderLeftColor: config.color, backgroundColor: `${config.color}10` }}
            >
              <h4 className="text-lg font-bold text-foreground">{config.title}</h4>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{config.description}</p>
              {config.fields.map((field, index) => (
                <div key={index} className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{field.name}</p>
                  <p className="text-xs text-muted-foreground">{field.value}</p>
                </div>
              ))}
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">{config.footer}</p>
              </div>
              <div className="pt-2">
                <div 
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm"
                  style={{ backgroundColor: config.color }}
                >
                  🎫 {config.buttonText}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={resetToDefault}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80"
          disabled={isSaving}
        >
          🔄 Reset to Default
        </button>
        
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!config.title.trim() || !config.description.trim() || isSaving}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 text-white bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '🔄 Creating...' : '🎫 Create Custom Panel'}
          </button>
        </div>
      </div>
    </ConfigModal>
  );
};