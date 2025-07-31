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
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import SettingsCard from '../components/common/SettingsCard';
import ActionButton from '../components/common/ActionButton';
import ToggleSwitch from '../components/common/ToggleSwitch';

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
  const { darkMode, toggleTheme } = useTheme();
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
  
  // Accessibility settings
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const [keyboardNavigation, setKeyboardNavigation] = useState(true);
  const [focusIndicators, setFocusIndicators] = useState(true);
  
  // Notification settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopNotifications, setDesktopNotifications] = useState(false);
  const [toastPosition, setToastPosition] = useState<'top' | 'bottom' | 'top-right' | 'bottom-right'>('top');
  const [notificationTypes] = useState({
    success: true,
    error: true,
    warning: true,
    info: true
  });
  
  // Advanced settings
  const [debugMode, setDebugMode] = useState(false);
  const [performanceMonitoring, setPerformanceMonitoring] = useState(false);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  // API endpoint configuration (placeholder for future implementation)
  // const [apiEndpoint, setApiEndpoint] = useState('');
  
  // Loading states
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);

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
      id: 'accessibility',
      name: 'Accessibility',
      icon: EyeIcon,
      description: 'Screen reader, keyboard, and visual accessibility'
    },
    {
      id: 'notifications',
      name: 'Notifications',
      icon: BellIcon,
      description: 'Alerts, sounds, and refresh settings'
    },
    {
      id: 'advanced',
      name: 'Advanced',
      icon: Cog6ToothIcon,
      description: 'Debug, performance, and developer options'
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
    { name: 'Orange', value: '#f97316' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Lime', value: '#84cc16' }
  ];
  
  // Toast position options
  const toastPositions = [
    { label: 'Top Center', value: 'top' as const },
    { label: 'Bottom Center', value: 'bottom' as const },
    { label: 'Top Right', value: 'top-right' as const },
    { label: 'Bottom Right', value: 'bottom-right' as const }
  ];
  
  // Refresh interval options
  const refreshIntervals = [
    { label: '5 seconds', value: 5 },
    { label: '10 seconds', value: 10 },
    { label: '15 seconds', value: 15 },
    { label: '30 seconds', value: 30 },
    { label: '1 minute', value: 60 },
    { label: '2 minutes', value: 120 },
    { label: '5 minutes', value: 300 }
  ];

  // Font size presets
  const fontSizePresets = [
    { label: 'Small (90%)', value: 'small' as const, preview: 'text-sm' },
    { label: 'Medium (100%)', value: 'medium' as const, preview: 'text-base' },
    { label: 'Large (110%)', value: 'large' as const, preview: 'text-lg' },
    { label: 'Extra Large (125%)', value: 'xl' as const, preview: 'text-xl' }
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
      
      // Convert hex to HSL for CSS variables
      const hexToHsl = (hex: string) => {
        const rgb = hexToRgb(hex);
        if (!rgb) return null;
        
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        
        return {
          h: Math.round(h * 360),
          s: Math.round(s * 100),
          l: Math.round(l * 100)
        };
      };
      
      const rgb = hexToRgb(primaryColorToApply);
      if (rgb) {
        // Convert hex to HSL and update CSS variables
        const hsl = hexToHsl(primaryColorToApply);
        if (hsl) {
          document.documentElement.style.setProperty('--primary', `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`);
          document.documentElement.style.setProperty('--ring', `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`);
        }
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
      refreshInterval !== (settings?.refreshInterval || 30) ||
      highContrast !== (settings?.highContrast ?? false) ||
      reducedMotion !== (settings?.reducedMotion ?? false) ||
      soundEnabled !== (settings?.soundEnabled ?? true) ||
      debugMode !== (settings?.debugMode ?? false);
    setHasChanges(changed);
  }, [theme, primaryColor, fontSize, animationsEnabled, compactMode, autoRefresh, refreshInterval, 
      highContrast, reducedMotion, soundEnabled, debugMode, settings]);
  
  // Initialize accessibility settings from browser preferences
  useEffect(() => {
    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion && !settings?.reducedMotion) {
      setReducedMotion(true);
      updateSetting('reducedMotion', true);
    }
    
    // Check for prefers-contrast
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    if (prefersHighContrast && !settings?.highContrast) {
      setHighContrast(true);
      updateSetting('highContrast', true);
    }
  }, [settings, updateSetting]);

  // Apply theme changes (but don't save until Save button is clicked)
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    setTheme(newTheme);
    
    // Don't update the context immediately - let the save button handle it
    // updateSetting('theme', newTheme);
    
    if (newTheme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark !== darkMode) {
        toggleTheme();
      }
    } else {
      const shouldBeDark = newTheme === 'dark';
      if (shouldBeDark !== darkMode) {
        toggleTheme();
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

  // Apply primary color (but don't save until Save button is clicked)
  const handleColorChange = (color: string) => {
    setPrimaryColor(color);
    
    // Don't update the context immediately - let the save button handle it
    // updateSetting('primaryColor', color);
    
    // Convert hex to RGB for CSS variables
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    
    // Convert hex to HSL for CSS variables
    const hexToHsl = (hex: string) => {
      const rgb = hexToRgb(hex);
      if (!rgb) return null;
      
      const r = rgb.r / 255;
      const g = rgb.g / 255;
      const b = rgb.b / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      
      return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
      };
    };
    
    const rgb = hexToRgb(color);
    if (rgb) {
      // Convert hex to HSL and update CSS variables for immediate visual feedback
      const hsl = hexToHsl(color);
      if (hsl) {
        const primaryHsl = `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`;
        const primaryForegroundHsl = hsl.l > 50 ? `hsl(${hsl.h} ${hsl.s}% 10%)` : `hsl(${hsl.h} ${hsl.s}% 98%)`;
        
        // Update all primary color variables
        document.documentElement.style.setProperty('--primary', primaryHsl);
        document.documentElement.style.setProperty('--primary-foreground', primaryForegroundHsl);
        document.documentElement.style.setProperty('--ring', primaryHsl);
        
        // Update sidebar colors
        document.documentElement.style.setProperty('--sidebar-primary', primaryHsl);
        document.documentElement.style.setProperty('--sidebar-primary-foreground', primaryForegroundHsl);
        document.documentElement.style.setProperty('--sidebar-ring', primaryHsl);
        
        // Update chart colors to match primary
        document.documentElement.style.setProperty('--chart-1', primaryHsl);
        
        // Update additional color variables from global-settings.css
        document.documentElement.style.setProperty('--primary-color', color);
        document.documentElement.style.setProperty('--primary-dark', `hsl(${hsl.h} ${hsl.s}% ${Math.max(hsl.l - 10, 10)}%)`);
        document.documentElement.style.setProperty('--primary-light', `hsl(${hsl.h} ${hsl.s}% ${Math.min(hsl.l + 10, 90)}%)`);
      }
    }
  };

  // Apply font size (but don't save until Save button is clicked)
  const handleFontSizeChange = (size: 'small' | 'medium' | 'large' | 'xl') => {
    setFontSize(size as any);
    
    // Don't update the context immediately - let the save button handle it
    // updateSetting('fontSize', size);
    
    // Apply font size scaling using CSS custom property for immediate visual feedback
    const fontSizeMap = {
      small: '0.9',
      medium: '1.0', 
      large: '1.1',
      xl: '1.25'
    };
    
    const scale = fontSizeMap[size] || '1.0';
    document.documentElement.style.setProperty('--font-scale', scale);
  };
  
  // Accessibility handlers
  const handleHighContrastToggle = () => {
    const newValue = !highContrast;
    setHighContrast(newValue);
    updateSetting('highContrast', newValue);
    
    if (newValue) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  };
  
  const handleReducedMotionToggle = () => {
    const newValue = !reducedMotion;
    setReducedMotion(newValue);
    updateSetting('reducedMotion', newValue);
    
    if (newValue) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  };
  
  // Notification handlers
  const handleDesktopNotificationToggle = async () => {
    if (!desktopNotifications) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setDesktopNotifications(true);
        updateSetting('desktopNotifications', true);
        toast.success('Desktop notifications enabled!');
      } else {
        toast.error('Desktop notification permission denied');
      }
    } else {
      setDesktopNotifications(false);
      updateSetting('desktopNotifications', false);
    }
  };
  
  // Advanced settings handlers
  const handleClearCache = async () => {
    setClearing(true);
    try {
      // Clear localStorage
      const keysToKeep = ['auth-token', 'user-settings'];
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      toast.success('Cache cleared successfully!');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };
  
  // Export settings
  const handleExportSettings = async () => {
    setExporting(true);
    try {
      const settingsData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        settings: {
          theme,
          primaryColor,
          fontSize,
          animationsEnabled,
          compactMode,
          autoRefresh,
          refreshInterval,
          highContrast,
          reducedMotion,
          screenReader,
          keyboardNavigation,
          focusIndicators,
          soundEnabled,
          desktopNotifications,
          toastPosition,
          notificationTypes,
          debugMode,
          performanceMonitoring,
          cacheEnabled
        }
      };
      
      const blob = new Blob([JSON.stringify(settingsData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `panelops-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Settings exported successfully!');
    } catch (error) {
      console.error('Failed to export settings:', error);
      toast.error('Failed to export settings');
    } finally {
      setExporting(false);
    }
  };
  
  // Import settings
  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.settings) {
        const imported = data.settings;
        
        // Apply imported settings
        if (imported.theme) handleThemeChange(imported.theme);
        if (imported.primaryColor) handleColorChange(imported.primaryColor);
        if (imported.fontSize) handleFontSizeChange(imported.fontSize);
        if (typeof imported.animationsEnabled === 'boolean') {
          setAnimationsEnabled(imported.animationsEnabled);
          updateSetting('animationsEnabled', imported.animationsEnabled);
        }
        
        toast.success('Settings imported successfully!');
      } else {
        toast.error('Invalid settings file format');
      }
    } catch (error) {
      console.error('Failed to import settings:', error);
      toast.error('Failed to import settings file');
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };


  // Save all settings
  const handleSave = async () => {
    if (!hasChanges) return;
    
    setSaving(true);
    try {
      updateSetting('theme', theme);
      updateSetting('primaryColor', primaryColor);
      updateSetting('fontSize', fontSize);
      updateSetting('animationsEnabled', animationsEnabled);
      updateSetting('compactMode', compactMode);
      updateSetting('autoRefresh', autoRefresh);
      updateSetting('refreshInterval', refreshInterval);
      updateSetting('highContrast', highContrast);
      updateSetting('reducedMotion', reducedMotion);
      updateSetting('soundEnabled', soundEnabled);
      updateSetting('debugMode', debugMode);
      
      // Simulate network delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setHasChanges(false);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
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
            <SettingsCard 
              title="Theme" 
              icon="🎨" 
              description="Choose your preferred color scheme"
              variant="default"
            >
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'light', name: 'Light', icon: SunIcon, desc: 'Clean & bright' },
                  { id: 'dark', name: 'Dark', icon: MoonIcon, desc: 'Easy on the eyes' },
                  { id: 'auto', name: 'Auto', icon: ComputerDesktopIcon, desc: 'Matches system' }
                ].map(({ id, name, icon: Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => handleThemeChange(id as any)}
                    className={classNames(
                      'relative p-4 rounded-xl border-2 transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg text-left',
                      theme === id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md scale-105'
                        : darkMode
                          ? 'border-gray-600 bg-gray-700/50 hover:border-primary-500 hover:bg-gray-600/50'
                          : 'border-gray-200 bg-gray-50/50 hover:border-primary-400 hover:bg-white'
                    )}
                  >
                    <Icon className={classNames(
                      'w-8 h-8 mb-3 transition-all duration-300 group-hover:scale-110',
                      theme === id
                        ? 'text-primary-600'
                        : darkMode ? 'text-gray-400 group-hover:text-primary-400' : 'text-gray-500 group-hover:text-primary-600'
                    )} />
                    <div>
                      <div className={classNames(
                        'text-sm font-semibold mb-1',
                        theme === id
                          ? 'text-primary-700 dark:text-primary-300'
                          : darkMode ? 'text-gray-200' : 'text-gray-900'
                      )}>{name}</div>
                      <div className={classNames(
                        'text-xs',
                        theme === id
                          ? 'text-primary-600 dark:text-primary-400'
                          : darkMode ? 'text-gray-400' : 'text-gray-600'
                      )}>{desc}</div>
                    </div>
                    {theme === id && (
                      <CheckIcon className="absolute top-3 right-3 w-5 h-5 text-primary-600" />
                    )}
                  </button>
                ))}
              </div>
            </SettingsCard>

            <SettingsCard 
              title="Primary Color" 
              icon="🌈" 
              description="Customize your brand color throughout the interface"
            >
              <div className="space-y-6">
                <div className="grid grid-cols-5 gap-3">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleColorChange(preset.value)}
                      className={classNames(
                        'relative h-12 rounded-xl border-2 transition-all duration-300 hover:shadow-lg group',
                        primaryColor === preset.value
                          ? 'border-gray-900 dark:border-white scale-110 shadow-lg ring-2 ring-offset-2 ring-primary-500'
                          : 'border-gray-300 dark:border-gray-600 hover:scale-110 hover:border-gray-400 dark:hover:border-gray-500'
                      )}
                      style={{ backgroundColor: preset.value }}
                      title={preset.name}
                    >
                      {primaryColor === preset.value && (
                        <CheckIcon className="absolute inset-0 m-auto w-6 h-6 text-white drop-shadow-lg" />
                      )}
                      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {preset.name}
                      </div>
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <label className={classNames(
                      'block text-sm font-medium mb-2',
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    )}>Custom Color</label>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="h-12 w-20 rounded-xl cursor-pointer border-2 border-gray-300 dark:border-gray-600 hover:border-primary-500 transition-colors"
                    />
                  </div>
                  <div className="flex-1">
                    <label className={classNames(
                      'block text-sm font-medium mb-2',
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    )}>Hex Value</label>
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      placeholder="#64748b"
                      className={classNames(
                        'w-full px-4 py-3 rounded-xl border-2 transition-all duration-200',
                        darkMode
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-primary-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-primary-500',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500/20'
                      )}
                    />
                  </div>
                </div>
              </div>
            </SettingsCard>
          </div>
        );

      case 'interface':
        return (
          <div className="space-y-8">
            <SettingsCard 
              title="Font Size" 
              icon="📏" 
              description="Adjust text size throughout the interface"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {fontSizePresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handleFontSizeChange(preset.value as any)}
                    className={classNames(
                      'relative p-4 rounded-xl border-2 transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg text-center',
                      fontSize === preset.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md scale-105'
                        : darkMode
                          ? 'border-gray-600 bg-gray-700/50 hover:border-primary-500 hover:bg-gray-600/50'
                          : 'border-gray-200 bg-gray-50/50 hover:border-primary-400 hover:bg-white'
                    )}
                  >
                    <div className={classNames(
                      'font-semibold mb-2 transition-all duration-300',
                      preset.preview,
                      fontSize === preset.value
                        ? 'text-primary-700 dark:text-primary-300'
                        : darkMode ? 'text-gray-200' : 'text-gray-900'
                    )}>Aa</div>
                    <div className={classNames(
                      'text-xs font-medium',
                      fontSize === preset.value
                        ? 'text-primary-600 dark:text-primary-400'
                        : darkMode ? 'text-gray-400' : 'text-gray-600'
                    )}>{preset.label}</div>
                    {fontSize === preset.value && (
                      <CheckIcon className="absolute top-2 right-2 w-4 h-4 text-primary-600" />
                    )}
                  </button>
                ))}
              </div>
            </SettingsCard>

            <SettingsCard 
              title="Interface Options" 
              icon="🎛️" 
              description="Customize layout and interaction preferences"
            >
              <div className="space-y-6">
                <ToggleSwitch
                  id="animations"
                  enabled={animationsEnabled}
                  onChange={handleAnimationsToggle}
                  label="Enable Animations"
                  description="Show smooth transitions and hover effects throughout the interface"
                  variant="default"
                />
                
                <ToggleSwitch
                  id="compact-mode"
                  enabled={compactMode}
                  onChange={handleCompactModeToggle}
                  label="Compact Mode"
                  description="Reduce spacing and padding to fit more content on screen"
                  variant="default"
                />
              </div>
            </SettingsCard>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-8">
            <SettingsCard 
              title="Auto Refresh" 
              icon="🔄" 
              description="Configure automatic data refresh settings"
            >
              <div className="space-y-6">
                <ToggleSwitch
                  id="auto-refresh"
                  enabled={autoRefresh}
                  onChange={handleAutoRefreshToggle}
                  label="Enable Auto Refresh"
                  description="Automatically refresh dashboard data at regular intervals"
                  variant="success"
                />
                
                {autoRefresh && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary-500/30">
                    <div>
                      <label className={classNames(
                        'block text-sm font-medium mb-3',
                        darkMode ? 'text-gray-200' : 'text-gray-800'
                      )}>
                        Refresh Interval
                      </label>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {refreshIntervals.map((interval) => (
                          <button
                            key={interval.value}
                            onClick={() => handleRefreshIntervalChange(interval.value)}
                            className={classNames(
                              'p-3 text-sm rounded-lg border-2 transition-all duration-200 hover:scale-105',
                              refreshInterval === interval.value
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                : darkMode
                                  ? 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-primary-500'
                                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary-400'
                            )}
                          >
                            {interval.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </SettingsCard>
            
            <SettingsCard 
              title="Sound & Alerts" 
              icon="🔔" 
              description="Configure notification sounds and desktop alerts"
            >
              <div className="space-y-6">
                <ToggleSwitch
                  id="sound-enabled"
                  enabled={soundEnabled}
                  onChange={() => {
                    setSoundEnabled(!soundEnabled);
                    updateSetting('soundEnabled', !soundEnabled);
                  }}
                  label="Notification Sounds"
                  description="Play sounds for important notifications and alerts"
                  variant="default"
                />
                
                <ToggleSwitch
                  id="desktop-notifications"
                  enabled={desktopNotifications}
                  onChange={handleDesktopNotificationToggle}
                  label="Desktop Notifications"
                  description="Show browser notifications for critical events (requires permission)"
                  variant="warning"
                />
                
                <div>
                  <label className={classNames(
                    'block text-sm font-medium mb-3',
                    darkMode ? 'text-gray-200' : 'text-gray-800'
                  )}>
                    Toast Position
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {toastPositions.map((position) => (
                      <button
                        key={position.value}
                        onClick={() => {
                          setToastPosition(position.value);
                          updateSetting('toastPosition', position.value);
                        }}
                        className={classNames(
                          'p-3 text-sm rounded-lg border-2 transition-all duration-200 hover:scale-105',
                          toastPosition === position.value
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : darkMode
                              ? 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-primary-500'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary-400'
                        )}
                      >
                        {position.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SettingsCard>
          </div>
        );

      case 'accessibility':
        return (
          <div className="space-y-8">
            <SettingsCard 
              title="Visual Accessibility" 
              icon="👁️" 
              description="Enhance visibility and contrast for better readability"
            >
              <div className="space-y-6">
                <ToggleSwitch
                  id="high-contrast"
                  enabled={highContrast}
                  onChange={handleHighContrastToggle}
                  label="High Contrast Mode"
                  description="Increase color contrast for better visibility and readability"
                  variant="default"
                />
                
                <ToggleSwitch
                  id="reduced-motion"
                  enabled={reducedMotion}
                  onChange={handleReducedMotionToggle}
                  label="Reduce Motion"
                  description="Minimize animations and transitions to reduce motion sensitivity"
                  variant="warning"
                />
                
                <ToggleSwitch
                  id="focus-indicators"
                  enabled={focusIndicators}
                  onChange={() => {
                    setFocusIndicators(!focusIndicators);
                    updateSetting('focusIndicators', !focusIndicators);
                  }}
                  label="Enhanced Focus Indicators"
                  description="Show prominent visual indicators when navigating with keyboard"
                  variant="success"
                />
              </div>
            </SettingsCard>
            
            <SettingsCard 
              title="Navigation & Interaction" 
              icon="⌨️" 
              description="Configure keyboard navigation and interaction methods"
            >
              <div className="space-y-6">
                <ToggleSwitch
                  id="keyboard-navigation"
                  enabled={keyboardNavigation}
                  onChange={() => {
                    setKeyboardNavigation(!keyboardNavigation);
                    updateSetting('keyboardNavigation', !keyboardNavigation);
                  }}
                  label="Full Keyboard Navigation"
                  description="Enable complete keyboard navigation throughout the interface"
                  variant="default"
                />
                
                <ToggleSwitch
                  id="screen-reader"
                  enabled={screenReader}
                  onChange={() => {
                    setScreenReader(!screenReader);
                    updateSetting('screenReader', !screenReader);
                  }}
                  label="Screen Reader Optimizations"
                  description="Enhance compatibility with screen reading software"
                  variant="success"
                />
              </div>
            </SettingsCard>
            
            <SettingsCard 
              title="Accessibility Information" 
              icon="ℹ️" 
              description="Learn about available accessibility features"
              variant="highlighted"
            >
              <div className="space-y-4">
                <div className={classNames(
                  'p-4 rounded-lg',
                  darkMode ? 'bg-blue-900/20 border border-blue-700/30' : 'bg-blue-50 border border-blue-200'
                )}>
                  <h4 className={classNames(
                    'font-semibold mb-2',
                    darkMode ? 'text-blue-300' : 'text-blue-900'
                  )}>Keyboard Shortcuts</h4>
                  <ul className={classNames(
                    'text-sm space-y-1',
                    darkMode ? 'text-blue-200' : 'text-blue-800'
                  )}>
                    <li>• <kbd className="px-2 py-1 bg-black/10 rounded">Tab</kbd> - Navigate between elements</li>
                    <li>• <kbd className="px-2 py-1 bg-black/10 rounded">Space/Enter</kbd> - Activate buttons and toggles</li>
                    <li>• <kbd className="px-2 py-1 bg-black/10 rounded">Esc</kbd> - Close modals and dialogs</li>
                    <li>• <kbd className="px-2 py-1 bg-black/10 rounded">Alt + S</kbd> - Focus search</li>
                  </ul>
                </div>
                
                <div className={classNames(
                  'p-4 rounded-lg',
                  darkMode ? 'bg-green-900/20 border border-green-700/30' : 'bg-green-50 border border-green-200'
                )}>
                  <h4 className={classNames(
                    'font-semibold mb-2',
                    darkMode ? 'text-green-300' : 'text-green-900'
                  )}>Screen Reader Support</h4>
                  <p className={classNames(
                    'text-sm',
                    darkMode ? 'text-green-200' : 'text-green-800'
                  )}>
                    This interface includes ARIA labels, landmarks, and semantic markup for compatibility with screen readers like NVDA, JAWS, and VoiceOver.
                  </p>
                </div>
              </div>
            </SettingsCard>
          </div>
        );

      case 'advanced':
        return (
          <div className="space-y-8">
            <SettingsCard 
              title="Developer Options" 
              icon="🛠️" 
              description="Debug and development tools for troubleshooting"
            >
              <div className="space-y-6">
                <ToggleSwitch
                  id="debug-mode"
                  enabled={debugMode}
                  onChange={() => {
                    setDebugMode(!debugMode);
                    updateSetting('debugMode', !debugMode);
                    if (!debugMode) {
                      console.log('Debug mode enabled - Check console for detailed logs');
                    }
                  }}
                  label="Debug Mode"
                  description="Enable detailed console logging and error reporting"
                  variant="warning"
                />
                
                <ToggleSwitch
                  id="performance-monitoring"
                  enabled={performanceMonitoring}
                  onChange={() => {
                    setPerformanceMonitoring(!performanceMonitoring);
                    updateSetting('performanceMonitoring', !performanceMonitoring);
                  }}
                  label="Performance Monitoring"
                  description="Track and log performance metrics and render times"
                  variant="info"
                />
                
                <ToggleSwitch
                  id="cache-enabled"
                  enabled={cacheEnabled}
                  onChange={() => {
                    setCacheEnabled(!cacheEnabled);
                    updateSetting('cacheEnabled', !cacheEnabled);
                  }}
                  label="Enable Caching"
                  description="Cache API responses and static resources for better performance"
                  variant="success"
                />
              </div>
            </SettingsCard>
            
            <SettingsCard 
              title="Cache Management" 
              icon="🗄️" 
              description="Manage stored data and temporary files"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted border-border">
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">Clear Application Cache</h4>
                    <p className="text-sm mt-1 text-muted-foreground">Remove temporary files, cached responses, and stored data</p>
                  </div>
                  <ActionButton
                    onClick={handleClearCache}
                    loading={clearing}
                    variant="outline"
                    size="sm"
                    icon={TrashIcon}
                  >
                    {clearing ? 'Clearing...' : 'Clear Cache'}
                  </ActionButton>
                </div>
              </div>
            </SettingsCard>
            
            <SettingsCard 
              title="Settings Management" 
              icon="💾" 
              description="Backup, restore, and manage your settings"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={classNames(
                    'p-4 rounded-lg border text-center',
                    darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                  )}>
                    <ArrowDownTrayIcon className={classNames(
                      'w-8 h-8 mx-auto mb-2',
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    )} />
                    <h4 className={classNames(
                      'font-medium mb-2',
                      darkMode ? 'text-white' : 'text-gray-900'
                    )}>Export Settings</h4>
                    <p className={classNames(
                      'text-sm mb-4',
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    )}>Download your current settings as a backup file</p>
                    <ActionButton
                      onClick={handleExportSettings}
                      loading={exporting}
                      variant="primary"
                      size="sm"
                      fullWidth
                      icon={ArrowDownTrayIcon}
                    >
                      {exporting ? 'Exporting...' : 'Export'}
                    </ActionButton>
                  </div>
                  
                  <div className={classNames(
                    'p-4 rounded-lg border text-center',
                    darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                  )}>
                    <ArrowUpTrayIcon className={classNames(
                      'w-8 h-8 mx-auto mb-2',
                      darkMode ? 'text-gray-400' : 'text-gray-500'
                    )} />
                    <h4 className={classNames(
                      'font-medium mb-2',
                      darkMode ? 'text-white' : 'text-gray-900'
                    )}>Import Settings</h4>
                    <p className={classNames(
                      'text-sm mb-4',
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    )}>Restore settings from a previously exported file</p>
                    <label className="block">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportSettings}
                        className="hidden"
                      />
                      <ActionButton
                        variant="secondary"
                        size="sm"
                        fullWidth
                        icon={ArrowUpTrayIcon}
                        loading={importing}
                        onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
                      >
                        {importing ? 'Importing...' : 'Import'}
                      </ActionButton>
                    </label>
                  </div>
                </div>
              </div>
            </SettingsCard>
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
          <h1 className="text-2xl font-bold text-foreground">
            ⚙️ Settings
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Customize your dashboard experience
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="card rounded-lg border p-4 space-y-4 transition-all duration-300 hover:shadow-lg">
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
                  className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border transition-colors bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                          ? 'bg-primary text-primary-foreground shadow-lg'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:-translate-y-0.5'
                      )}
                    >
                      <Icon className={classNames(
                        'h-5 w-5 mr-3 transition-all duration-300 group-hover:scale-110',
                        isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                      )} />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{category.name}</div>
                        <div className={classNames(
                          'text-xs mt-0.5',
                          isActive 
                            ? 'text-primary-foreground/80' 
                            : 'text-muted-foreground'
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
            <div className="card rounded-lg border p-6 transition-all duration-300 hover:shadow-lg">
              {renderCategoryContent()}
            </div>

            {/* Action Buttons - Always visible */}
            <div className={classNames(
              "card mt-6 p-4 rounded-lg border flex items-center justify-between transition-all duration-300 hover:shadow-lg",
              hasChanges ? "ring-2 ring-orange-500/50" : ""
            )}>
              <div className="flex items-center">
                {hasChanges ? (
                  <>
                    <div className={classNames(
                      'w-2 h-2 rounded-full mr-2 animate-pulse',
                      'bg-orange-500'
                    )}></div>
                    <p className="text-sm font-medium text-foreground">
                      You have unsaved changes
                    </p>
                  </>
                ) : (
                  <>
                    <div className={classNames(
                      'w-2 h-2 rounded-full mr-2',
                      'bg-green-500'
                    )}></div>
                    <p className="text-sm font-medium text-foreground">
                      All changes saved
                    </p>
                  </>
                )}
              </div>
              <div className="flex space-x-3">
                <ActionButton
                  onClick={handleReset}
                  variant="outline"
                  size="sm"
                  disabled={!hasChanges}
                >
                  Reset
                </ActionButton>
                <ActionButton
                  onClick={handleSave}
                  loading={saving}
                  variant={hasChanges ? "primary" : "secondary"}
                  size="sm"
                  icon={saving ? undefined : CheckIcon}
                  disabled={!hasChanges && !saving}
                >
                  {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;