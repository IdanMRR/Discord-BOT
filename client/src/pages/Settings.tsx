import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { toast } from 'react-hot-toast';
import { 
  SunIcon, 
  MoonIcon, 
  ComputerDesktopIcon,
  SwatchIcon,
  DocumentTextIcon,
  ArrowsPointingOutIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const Settings: React.FC = () => {
  const { darkMode, toggleDarkMode } = useTheme();
  const { settings, updateSetting } = useSettings();
  
  // Local state for settings
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [primaryColor, setPrimaryColor] = useState('#64748b');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [interfaceScale, setInterfaceScale] = useState(100);
  const [hasChanges, setHasChanges] = useState(false);

  // Predefined color options
  const colorPresets = [
    { name: 'Slate', value: '#64748b' },
    { name: 'Gray', value: '#6b7280' },
    { name: 'Zinc', value: '#71717a' },
    { name: 'Stone', value: '#78716c' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Orange', value: '#f97316' }
  ];

  // Font size presets
  const fontSizePresets = [
    { label: 'Small', value: 'small' as const },
    { label: 'Medium', value: 'medium' as const },
    { label: 'Large', value: 'large' as const }
  ];

  // Interface scale presets
  const scalePresets = [
    { label: '75%', value: 75 },
    { label: '90%', value: 90 },
    { label: '100%', value: 100 },
    { label: '110%', value: 110 },
    { label: '125%', value: 125 }
  ];

  // Load settings on mount
  useEffect(() => {
    if (settings) {
      setTheme(settings.theme || 'auto');
      setPrimaryColor(settings.primaryColor || '#64748b');
      setFontSize(settings.fontSize || 'medium');
      setInterfaceScale(settings.scale || 100);
      
      // Apply settings immediately when loaded
      handleColorChange(settings.primaryColor || '#64748b');
      handleScaleChange(settings.scale || 100);
      handleFontSizeChange(settings.fontSize || 'medium');
    }
  }, [settings]);

  // Track changes
  useEffect(() => {
    const changed = 
      theme !== (settings?.theme || 'auto') ||
      primaryColor !== (settings?.primaryColor || '#64748b') ||
      fontSize !== (settings?.fontSize || 'medium') ||
      interfaceScale !== (settings?.scale || 100);
    setHasChanges(changed);
  }, [theme, primaryColor, fontSize, interfaceScale, settings]);

  // Apply theme changes
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    setTheme(newTheme);
    
    if (newTheme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark !== darkMode) {
        toggleDarkMode();
      }
    } else {
      const shouldBeDark = newTheme === 'dark';
      if (shouldBeDark !== darkMode) {
        toggleDarkMode();
      }
    }
  };

  // Apply primary color
  const handleColorChange = (color: string) => {
    setPrimaryColor(color);
    document.documentElement.style.setProperty('--primary-color', color);
    
    // Calculate RGB values for opacity variants
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    document.documentElement.style.setProperty('--primary-color-rgb', `${r}, ${g}, ${b}`);
  };

  // Apply font size
  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    // Apply font size class to root element
    document.documentElement.classList.remove('font-small', 'font-medium', 'font-large');
    document.documentElement.classList.add(`font-${size}`);
  };

  // Apply interface scale
  const handleScaleChange = (scale: number) => {
    setInterfaceScale(scale);
    // Remove any existing scale classes
    document.documentElement.className = document.documentElement.className
      .replace(/interface-scale-\d+/g, '');
    // Add the new scale class
    document.documentElement.classList.add(`interface-scale-${scale}`);
  };

  // Save all settings
  const handleSave = async () => {
    try {
      // Apply the primary color immediately when saving
      handleColorChange(primaryColor);
      handleScaleChange(interfaceScale);
      handleFontSizeChange(fontSize);
      
      updateSetting('theme', theme);
      updateSetting('primaryColor', primaryColor);
      updateSetting('fontSize', fontSize);
      updateSetting('scale', interfaceScale);
      
      setHasChanges(false);
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error('Error saving settings:', error);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    handleThemeChange('auto');
    handleColorChange('#64748b');
    handleFontSizeChange('medium');
    handleScaleChange(100);
    toast.success('Settings reset to defaults');
  };

  // Get font size display text
  const getFontSizeDisplay = (size: 'small' | 'medium' | 'large') => {
    switch (size) {
      case 'small': return '14px';
      case 'medium': return '16px';
      case 'large': return '18px';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Settings
        </h1>
        <p className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Customize your dashboard appearance and preferences
        </p>
      </div>

      <div className="space-y-8">
        {/* Theme Selection */}
        <div className={`p-6 rounded-lg border-2 ${
          darkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center mb-4">
            <SunIcon className="w-5 h-5 mr-2 text-primary" />
            <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Theme
            </h2>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: 'light' as const, label: 'Light', icon: SunIcon },
              { value: 'dark' as const, label: 'Dark', icon: MoonIcon },
              { value: 'auto' as const, label: 'System', icon: ComputerDesktopIcon }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleThemeChange(option.value)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  theme === option.value
                    ? darkMode
                      ? 'bg-gray-700 border-primary text-white'
                      : 'bg-gray-100 border-primary text-gray-900'
                    : darkMode
                      ? 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <option.icon className="w-8 h-8 mx-auto mb-2" />
                <span className="block text-sm font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Primary Color */}
        <div className={`p-6 rounded-lg border-2 ${
          darkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center mb-4">
            <SwatchIcon className="w-5 h-5 mr-2 text-primary" />
            <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Primary Color
            </h2>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-3">
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handleColorChange(preset.value)}
                  className={`relative h-12 rounded-lg border-2 transition-all ${
                    primaryColor === preset.value
                      ? 'border-gray-900 dark:border-white scale-110'
                      : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.name}
                >
                  {primaryColor === preset.value && (
                    <CheckIcon className="absolute inset-0 m-auto w-6 h-6 text-white" />
                  )}
                </button>
              ))}
            </div>
            
            <div className="flex items-center space-x-4">
              <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Custom Color:
              </label>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="h-10 w-20 rounded cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className={`px-3 py-2 rounded-lg border ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        {/* Font Size */}
        <div className={`p-6 rounded-lg border-2 ${
          darkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center mb-4">
            <DocumentTextIcon className="w-5 h-5 mr-2 text-primary" />
            <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Font Size
            </h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Current size: {fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}
              </span>
              <span className={`text-sm font-mono ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {getFontSizeDisplay(fontSize)}
              </span>
            </div>
            
            <div className="flex justify-between">
              {fontSizePresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handleFontSizeChange(preset.value)}
                  className={`flex-1 mx-1 px-4 py-2 rounded-lg border-2 transition-all ${
                    fontSize === preset.value
                      ? 'bg-primary text-white border-primary'
                      : darkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <p className={`
                ${fontSize === 'small' ? 'text-sm' : ''}
                ${fontSize === 'medium' ? 'text-base' : ''}
                ${fontSize === 'large' ? 'text-lg' : ''}
              `}>
                The quick brown fox jumps over the lazy dog. 1234567890
              </p>
            </div>
          </div>
        </div>

        {/* Interface Scale */}
        <div className={`p-6 rounded-lg border-2 ${
          darkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center mb-4">
            <ArrowsPointingOutIcon className="w-5 h-5 mr-2 text-primary" />
            <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Interface Scale
            </h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Adjust the overall size of the interface
              </span>
              <span className={`text-sm font-mono ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {interfaceScale}%
              </span>
            </div>
            
            <input
              type="range"
              min="75"
              max="150"
              step="5"
              value={interfaceScale}
              onChange={(e) => handleScaleChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            
            <div className="flex justify-between">
              {scalePresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handleScaleChange(preset.value)}
                  className={`text-xs px-3 py-1 rounded ${
                    interfaceScale === preset.value
                      ? 'bg-primary text-white'
                      : darkMode
                        ? 'text-gray-400 hover:text-gray-300'
                        : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6">
          <button
            onClick={handleReset}
            className={`px-6 py-2 rounded-lg border-2 transition-all ${
              darkMode
                ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Reset to Defaults
          </button>
          
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`px-8 py-2 rounded-lg font-medium transition-all ${
              hasChanges
                ? 'bg-primary text-white hover:opacity-90'
                : darkMode
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {hasChanges ? 'Save Changes' : 'No Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
