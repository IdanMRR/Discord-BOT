import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { toast } from 'react-hot-toast';
import { 
  SunIcon, 
  MoonIcon, 
  ComputerDesktopIcon,
  SwatchIcon,
  ArrowsPointingOutIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  BellIcon,
  EyeIcon,
  Cog6ToothIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface SettingCategory {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
}

const Settings: React.FC = () => {
  const { darkMode, toggleDarkMode } = useTheme();
  const { settings, updateSetting } = useSettings();
  
  // Track if this is the initial load to prevent infinite loops
  const isInitialLoad = React.useRef(true);
  
  // Active category
  const [activeCategory, setActiveCategory] = useState('appearance');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local state for settings
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [primaryColor, setPrimaryColor] = useState('#64748b');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [hasChanges, setHasChanges] = useState(false);

  // Setting categories
  const categories: SettingCategory[] = [
    {
      id: 'appearance',
      name: 'Appearance',
      icon: SwatchIcon,
      description: 'Theme, colors, and visual settings'
    },
    {
      id: 'interface',
      name: 'Interface',
      icon: ArrowsPointingOutIcon,
      description: 'Layout, scaling, and UI preferences'
    },
    {
      id: 'notifications',
      name: 'Notifications',
      icon: BellIcon,
      description: 'Auto-refresh and alert settings'
    },
    {
      id: 'accessibility',
      name: 'Accessibility',
      icon: EyeIcon,
      description: 'Accessibility and usability options'
    },
    {
      id: 'advanced',
      name: 'Advanced',
      icon: Cog6ToothIcon,
      description: 'Developer and debug options'
    }
  ];

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


  // Load settings on mount
  useEffect(() => {
    if (settings && isInitialLoad.current) {
      isInitialLoad.current = false;
      
      setTheme(settings.theme || 'auto');
      setPrimaryColor(settings.primaryColor || '#64748b');
      setFontSize(settings.fontSize || 'medium');
      setAnimationsEnabled(settings.animationsEnabled ?? true);
      setCompactMode(settings.compactMode ?? false);
      setAutoRefresh(settings.autoRefresh ?? true);
      setRefreshInterval(settings.refreshInterval || 30);
      
      // Apply settings immediately when loaded - but only set CSS, don't update context
      const primaryColorToApply = settings.primaryColor || '#64748b';
      const fontSizeToApply = settings.fontSize || 'medium';
      
      // Apply primary color directly to DOM
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };
      
      const rgb = hexToRgb(primaryColorToApply);
      if (rgb) {
        document.documentElement.style.setProperty('--primary-color', primaryColorToApply);
        document.documentElement.style.setProperty('--primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      }
      
      // Apply font size directly to DOM
      const fontSizeMap = {
        small: '0.9',
        medium: '1.0', 
        large: '1.1'
      };
      const scale = fontSizeMap[fontSizeToApply] || '1.0';
      document.documentElement.style.setProperty('--font-scale', scale);
    }
  }, [settings]);

  // Track changes
  useEffect(() => {
    const changed = 
      theme !== (settings?.theme || 'auto') ||
      primaryColor !== (settings?.primaryColor || '#64748b') ||
      fontSize !== (settings?.fontSize || 'medium') ||
      animationsEnabled !== (settings?.animationsEnabled ?? true) ||
      compactMode !== (settings?.compactMode ?? false) ||
      autoRefresh !== (settings?.autoRefresh ?? true) ||
      refreshInterval !== (settings?.refreshInterval || 30);
    setHasChanges(changed);
  }, [theme, primaryColor, fontSize, animationsEnabled, compactMode, autoRefresh, refreshInterval, settings]);

  // Apply theme changes
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    setTheme(newTheme);
    
    // Update the context immediately for persistence
    updateSetting('theme', newTheme);
    
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

  // Handle animation toggle
  const handleAnimationsToggle = () => {
    const newValue = !animationsEnabled;
    setAnimationsEnabled(newValue);
    updateSetting('animationsEnabled', newValue);
  };

  // Handle compact mode toggle
  const handleCompactModeToggle = () => {
    const newValue = !compactMode;
    setCompactMode(newValue);
    updateSetting('compactMode', newValue);
  };

  // Handle auto refresh toggle
  const handleAutoRefreshToggle = () => {
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    updateSetting('autoRefresh', newValue);
  };

  // Handle refresh interval change
  const handleRefreshIntervalChange = (newInterval: number) => {
    setRefreshInterval(newInterval);
    updateSetting('refreshInterval', newInterval);
  };

  // Apply primary color
  const handleColorChange = (color: string) => {
    setPrimaryColor(color);
    
    // Update the context immediately for instant effect
    updateSetting('primaryColor', color);
    
    // Convert hex to RGB for CSS variables
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    const rgb = hexToRgb(color);
    if (rgb) {
      document.documentElement.style.setProperty('--primary-color', color);
      document.documentElement.style.setProperty('--primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }
  };

  // Apply font size
  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    
    // Update the context immediately for instant effect and persistence
    updateSetting('fontSize', size);
    
    // Apply font size scaling using CSS custom property
    const fontSizeMap = {
      small: '0.9',
      medium: '1.0', 
      large: '1.1'
    };
    
    const scale = fontSizeMap[size] || '1.0';
    document.documentElement.style.setProperty('--font-scale', scale);
  };


  // Save all settings
  const handleSave = () => {
    if (!hasChanges) return;
    
    try {
      updateSetting('theme', theme);
      updateSetting('primaryColor', primaryColor);
      updateSetting('fontSize', fontSize);
      updateSetting('animationsEnabled', animationsEnabled);
      updateSetting('compactMode', compactMode);
      updateSetting('autoRefresh', autoRefresh);
      updateSetting('refreshInterval', refreshInterval);
      
      setHasChanges(false);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    }
  };

  // Reset settings
  const handleReset = () => {
    if (!settings) return;
    
    setTheme(settings.theme || 'auto');
    setPrimaryColor(settings.primaryColor || '#64748b');
    setFontSize(settings.fontSize || 'medium');
    setAnimationsEnabled(settings.animationsEnabled ?? true);
    setCompactMode(settings.compactMode ?? false);
    setAutoRefresh(settings.autoRefresh ?? true);
    setRefreshInterval(settings.refreshInterval || 30);
    
    // Re-apply current settings
    handleColorChange(settings.primaryColor || '#64748b');
    handleFontSizeChange(settings.fontSize || 'medium');
    
    toast.success('Settings reset');
  };

  // Filter categories based on search
  const filteredCategories = searchQuery 
    ? categories.filter(category => 
        category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories;

  // Render category content
  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'appearance':
        return (
          <div className="space-y-8">
            {/* Theme Selection */}
            <div className="space-y-4">
              <h3 className={classNames(
                'text-lg font-semibold',
                darkMode ? 'text-white' : 'text-gray-900'
              )}>
                🎨 Theme
              </h3>
              
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'light', name: 'Light', icon: SunIcon },
                  { id: 'dark', name: 'Dark', icon: MoonIcon },
                  { id: 'auto', name: 'Auto', icon: ComputerDesktopIcon }
                ].map(({ id, name, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleThemeChange(id as any)}
                    className={classNames(
                      'relative p-4 rounded-lg border-2 transition-all duration-300 btn-modern group hover:-translate-y-1 hover:shadow-lg',
                      theme === id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                        : darkMode
                          ? 'border-gray-600 bg-gray-700 hover:border-primary-500 hover:bg-gray-600'
                          : 'border-gray-200 bg-white hover:border-primary-400 hover:bg-gray-50'
                    )}
                  >
                    <Icon className={classNames(
                      'w-6 h-6 mx-auto mb-2 transition-all duration-300 group-hover:scale-110',
                      theme === id
                        ? 'text-primary-600'
                        : darkMode ? 'text-gray-400 group-hover:text-primary-400' : 'text-gray-500 group-hover:text-primary-600'
                    )} />
                    <span className={classNames(
                      'text-sm font-medium',
                      theme === id
                        ? 'text-primary-700 dark:text-primary-300'
                        : darkMode ? 'text-gray-300' : 'text-gray-700'
                    )}>{name}</span>
                    {theme === id && (
                      <CheckIcon className="absolute top-2 right-2 w-5 h-5 text-primary-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Color */}
            <div className="space-y-4">
              <h3 className={classNames(
                'text-lg font-semibold',
                darkMode ? 'text-white' : 'text-gray-900'
              )}>
                🌈 Primary Color
              </h3>
              
              <div className="grid grid-cols-5 gap-3">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handleColorChange(preset.value)}
                    className={classNames(
                      'relative h-12 rounded-lg border-2 transition-all duration-300 hover:shadow-lg',
                      primaryColor === preset.value
                        ? 'border-gray-900 dark:border-white scale-110 shadow-lg'
                        : 'border-gray-300 dark:border-gray-600 hover:scale-110 hover:border-gray-400 dark:hover:border-gray-500'
                    )}
                    style={{ backgroundColor: preset.value }}
                    title={preset.name}
                  >
                    {primaryColor === preset.value && (
                      <CheckIcon className="absolute inset-0 m-auto w-6 h-6 text-white drop-shadow-lg" />
                    )}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center space-x-4 pt-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="h-12 w-20 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  placeholder="#64748b"
                  className={classNames(
                    'flex-1 px-4 py-3 rounded-lg border transition-colors',
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-primary-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-primary-500',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                  )}
                />
              </div>
            </div>
          </div>
        );

      case 'interface':
        return (
          <div className="space-y-8">
            {/* Font Size */}
            <div className="space-y-4">
              <h3 className={classNames(
                'text-lg font-semibold',
                darkMode ? 'text-white' : 'text-gray-900'
              )}>
                📏 Font Size
              </h3>
              
              <div className="grid grid-cols-3 gap-4">
                {fontSizePresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handleFontSizeChange(preset.value)}
                    className={classNames(
                      'relative p-4 rounded-lg border-2 transition-all duration-300 btn-modern group hover:-translate-y-1 hover:shadow-lg',
                      fontSize === preset.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
                        : darkMode
                          ? 'border-gray-600 bg-gray-700 hover:border-primary-500 hover:bg-gray-600'
                          : 'border-gray-200 bg-white hover:border-primary-400 hover:bg-gray-50'
                    )}
                  >
                    <span className={classNames(
                      'font-medium',
                      preset.value === 'small' ? 'text-sm' : preset.value === 'large' ? 'text-lg' : 'text-base',
                      fontSize === preset.value
                        ? 'text-primary-700 dark:text-primary-300'
                        : darkMode ? 'text-gray-300' : 'text-gray-700'
                    )}>{preset.label}</span>
                    {fontSize === preset.value && (
                      <CheckIcon className="absolute top-2 right-2 w-5 h-5 text-primary-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>


            {/* Interface Options */}
            <div className="space-y-6">
              <h3 className={classNames(
                'text-lg font-semibold',
                darkMode ? 'text-white' : 'text-gray-900'
              )}>
                🎛️ Interface Options
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className={classNames(
                      'text-sm font-medium',
                      darkMode ? 'text-gray-200' : 'text-gray-800'
                    )}>
                      Enable Animations
                    </label>
                    <p className={classNames(
                      'text-sm',
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Show smooth transitions and animations
                    </p>
                  </div>
                  <button
                    onClick={handleAnimationsToggle}
                    className={classNames(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 hover:shadow-lg hover:scale-105',
                      animationsEnabled ? 'bg-primary-600 hover:bg-primary-700' : darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                    )}
                  >
                    <span
                      className={classNames(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        animationsEnabled ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className={classNames(
                      'text-sm font-medium',
                      darkMode ? 'text-gray-200' : 'text-gray-800'
                    )}>
                      Compact Mode
                    </label>
                    <p className={classNames(
                      'text-sm',
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Reduce spacing for more content
                    </p>
                  </div>
                  <button
                    onClick={handleCompactModeToggle}
                    className={classNames(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 hover:shadow-lg hover:scale-105',
                      compactMode ? 'bg-primary-600 hover:bg-primary-700' : darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                    )}
                  >
                    <span
                      className={classNames(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        compactMode ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-8">
            <div className="space-y-6">
              <h3 className={classNames(
                'text-lg font-semibold',
                darkMode ? 'text-white' : 'text-gray-900'
              )}>Auto Refresh</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className={classNames(
                      'text-sm font-medium',
                      darkMode ? 'text-gray-200' : 'text-gray-800'
                    )}>
                      Enable Auto Refresh
                    </label>
                    <p className={classNames(
                      'text-sm',
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Automatically refresh data at set intervals
                    </p>
                  </div>
                  <button
                    onClick={handleAutoRefreshToggle}
                    className={classNames(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 hover:shadow-lg hover:scale-105',
                      autoRefresh ? 'bg-primary-600 hover:bg-primary-700' : darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                    )}
                  >
                    <span
                      className={classNames(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        autoRefresh ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>

                {autoRefresh && (
                  <div>
                    <label className={classNames(
                      'block text-sm font-medium mb-2',
                      darkMode ? 'text-gray-200' : 'text-gray-800'
                    )}>
                      Refresh Interval (seconds)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={refreshInterval}
                      onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value))}
                      className={classNames(
                        'w-32 px-3 py-2 rounded-lg border transition-colors',
                        darkMode
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-primary-500'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-primary-500',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'accessibility':
        return (
          <div className="space-y-8">
            <div className={classNames(
              'p-6 rounded-lg border-2 border-dashed',
              darkMode ? 'border-gray-600' : 'border-gray-300'
            )}>
              <div className="text-center">
                <EyeIcon className={classNames(
                  'mx-auto h-12 w-12 mb-4',
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                )} />
                <h3 className={classNames(
                  'text-lg font-semibold mb-2',
                  darkMode ? 'text-white' : 'text-gray-900'
                )}>
                  Accessibility Features
                </h3>
                <p className={classNames(
                  'text-sm',
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Accessibility options will be available in a future update
                </p>
              </div>
            </div>
          </div>
        );

      case 'advanced':
        return (
          <div className="space-y-8">
            <div className={classNames(
              'p-6 rounded-lg border-2 border-dashed',
              darkMode ? 'border-gray-600' : 'border-gray-300'
            )}>
              <div className="text-center">
                <CommandLineIcon className={classNames(
                  'mx-auto h-12 w-12 mb-4',
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                )} />
                <h3 className={classNames(
                  'text-lg font-semibold mb-2',
                  darkMode ? 'text-white' : 'text-gray-900'
                )}>
                  Advanced Settings
                </h3>
                <p className={classNames(
                  'text-sm',
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Developer and debug options will be available in a future update
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={classNames(
      'min-h-full w-full',
      darkMode ? 'bg-transparent' : 'bg-transparent'
    )}>
      <div className="w-full h-full px-0 py-0">
        {/* Header */}
        <div className="mb-6">
          <h1 className={classNames(
            'text-2xl font-bold',
            darkMode ? 'text-white' : 'text-gray-900'
          )}>
            ⚙️ Settings
          </h1>
          <p className={classNames(
            'mt-2 text-base',
            darkMode ? 'text-gray-400' : 'text-gray-600'
          )}>
            Customize your dashboard experience
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <div className={classNames(
              'rounded-lg border p-4 space-y-4 card-modern transition-all duration-300 hover:shadow-lg',
              darkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'
            )}>
              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className={classNames(
                  'absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4',
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                )} />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={classNames(
                    'w-full pl-10 pr-3 py-2 text-sm rounded-lg border transition-colors',
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-primary-500' 
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-primary-500',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                  )}
                />
              </div>

              {/* Categories */}
              <nav className="space-y-1">
                {filteredCategories.map((category) => {
                  const Icon = category.icon;
                  const isActive = activeCategory === category.id;
                  
                  return (
                    <button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      className={classNames(
                        'w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 text-left group hover:shadow-md',
                        isActive
                          ? darkMode
                            ? 'bg-primary-600 text-white shadow-lg'
                            : 'bg-primary-600 text-white shadow-lg'
                          : darkMode
                            ? 'text-gray-300 hover:bg-gray-700 hover:text-white hover:-translate-y-0.5'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:-translate-y-0.5'
                      )}
                    >
                      <Icon className={classNames(
                        'h-5 w-5 mr-3 transition-all duration-300 group-hover:scale-110',
                        isActive ? 'text-white' : darkMode ? 'text-gray-400 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-gray-700'
                      )} />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{category.name}</div>
                        <div className={classNames(
                          'text-xs mt-0.5',
                          isActive 
                            ? 'text-white/80' 
                            : darkMode ? 'text-gray-500' : 'text-gray-500'
                        )}>
                          {category.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className={classNames(
              'rounded-lg border p-6 card-modern transition-all duration-300 hover:shadow-lg',
              darkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'
            )}>
              {renderCategoryContent()}
            </div>

            {/* Action Buttons */}
            {hasChanges && (
              <div className={classNames(
                'mt-6 p-4 rounded-lg border flex items-center justify-between card-modern transition-all duration-300 hover:shadow-lg',
                darkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'
              )}>
                <div className="flex items-center">
                  <div className={classNames(
                    'w-2 h-2 rounded-full mr-2 animate-pulse',
                    'bg-orange-500'
                  )}></div>
                  <p className={classNames(
                    'text-sm font-medium',
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    You have unsaved changes
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleReset}
                    className={classNames(
                      'px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-300 btn-modern hover:-translate-y-1 hover:shadow-md',
                      darkMode
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    )}
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-all duration-300 btn-modern hover:-translate-y-1 hover:shadow-lg"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;