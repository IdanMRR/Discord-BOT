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
import { ColorCustomizer } from '../components/ui/ColorCustomizer';
import { dashboardLogger } from '../services/dashboardLogger';

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

const Settings: React.FC = (): React.ReactElement => {
  const { darkMode, toggleTheme } = useTheme();
  const { settings, updateSetting } = useSettings();
  
  // Track if this is the initial load to prevent infinite loops
  const isInitialLoad = React.useRef(true);
  
  // Active category
  const [activeCategory, setActiveCategory] = useState('appearance');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Local state for settings
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  
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

  // Removed unused color presets - using ColorCustomizer component instead
  // const colorPresets = [
  //   { name: 'Blue', value: '#3b82f6' },
  //   { name: 'Slate', value: '#64748b' },
  //   { name: 'Gray', value: '#6b7280' },
  //   { name: 'Zinc', value: '#71717a' },
  //   { name: 'Stone', value: '#78716c' },
  //   { name: 'Indigo', value: '#6366f1' },
  //   { name: 'Purple', value: '#8b5cf6' },
  //   { name: 'Emerald', value: '#10b981' },
  //   { name: 'Rose', value: '#f43f5e' },
  //   { name: 'Orange', value: '#f97316' },
  //   { name: 'Teal', value: '#14b8a6' },
  //   { name: 'Cyan', value: '#06b6d4' },
  //   { name: 'Pink', value: '#ec4899' },
  //   { name: 'Amber', value: '#f59e0b' },
  //   { name: 'Lime', value: '#84cc16' }
  // ];
  
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
    console.log('Settings loading:', settings); // Debug log
    if (settings && isInitialLoad.current) {
      isInitialLoad.current = false;
      console.log('Loading saved settings:', settings); // Debug log
      
      setTheme(settings.theme || 'auto');
      setPrimaryColor(settings.primaryColor || '#3b82f6');
      setFontSize(settings.fontSize || 'medium');
      setAnimationsEnabled(settings.animationsEnabled ?? true);
      setCompactMode(settings.compactMode ?? false);
      setAutoRefresh(settings.autoRefresh ?? true);
      setRefreshInterval(settings.refreshInterval || 30);
      
      // Load other settings
      setHighContrast(settings.highContrast ?? false);
      setReducedMotion(settings.reducedMotion ?? false);
      setScreenReader(settings.screenReader ?? false);
      setKeyboardNavigation(settings.keyboardNavigation ?? true);
      setFocusIndicators(settings.focusIndicators ?? true);
      setSoundEnabled(settings.soundEnabled ?? true);
      setDesktopNotifications(settings.desktopNotifications ?? false);
      setToastPosition((settings.toastPosition as 'top' | 'bottom' | 'top-right' | 'bottom-right') || 'top');
      setDebugMode(settings.debugMode ?? false);
      setPerformanceMonitoring(settings.performanceMonitoring ?? false);
      setCacheEnabled(settings.cacheEnabled ?? true);
      
      console.log('Settings loaded in Settings page:', settings);
    }
  }, [settings]);

  // Settings are saved immediately, no change tracking needed
  
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

  // Apply theme changes (save immediately for better UX)
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    const oldTheme = theme;
    setTheme(newTheme);
    
    // Save the theme setting immediately
    updateSetting('theme', newTheme);
    
    // Log the settings change
    dashboardLogger.logSettingsChanged('dashboard', 'Theme', oldTheme, newTheme, 'User');
    
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
    const oldValue = animationsEnabled;
    const newValue = !animationsEnabled;
    setAnimationsEnabled(newValue);
    updateSetting('animationsEnabled', newValue);
    
    // Log the settings change
    dashboardLogger.logSettingsChanged('dashboard', 'Animations', oldValue ? 'enabled' : 'disabled', newValue ? 'enabled' : 'disabled', 'User');
  };

  // Handle compact mode toggle
  const handleCompactModeToggle = () => {
    const oldValue = compactMode;
    const newValue = !compactMode;
    setCompactMode(newValue);
    updateSetting('compactMode', newValue);
    
    // Log the settings change
    dashboardLogger.logSettingsChanged('dashboard', 'Compact Mode', oldValue ? 'enabled' : 'disabled', newValue ? 'enabled' : 'disabled', 'User');
  };

  // Handle auto refresh toggle
  const handleAutoRefreshToggle = () => {
    const oldValue = autoRefresh;
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    updateSetting('autoRefresh', newValue);
    
    // Log the settings change
    dashboardLogger.logSettingsChanged('dashboard', 'Auto Refresh', oldValue ? 'enabled' : 'disabled', newValue ? 'enabled' : 'disabled', 'User');
  };

  // Handle refresh interval change
  const handleRefreshIntervalChange = (newInterval: number) => {
    const oldInterval = refreshInterval;
    setRefreshInterval(newInterval);
    updateSetting('refreshInterval', newInterval);
    
    // Log the settings change
    dashboardLogger.logSettingsChanged('dashboard', 'Refresh Interval', `${oldInterval}s`, `${newInterval}s`, 'User');
  };

  // Apply primary color (save immediately and let SettingsApplier handle the CSS)
  const handleColorChange = React.useCallback((color: string) => {
    console.log('Color changing to:', color);
    const oldColor = primaryColor;
    setPrimaryColor(color);
    updateSetting('primaryColor', color);
    console.log('Color setting saved to context');
    
    // Log the settings change
    dashboardLogger.logSettingsChanged('dashboard', 'Primary Color', oldColor, color, 'User');
  }, [updateSetting, primaryColor]);

  // Apply font size (save immediately for better UX)
  const handleFontSizeChange = (size: 'small' | 'medium' | 'large' | 'xl') => {
    const oldSize = fontSize;
    setFontSize(size as any);
    
    // Save the font size setting immediately
    updateSetting('fontSize', size);
    
    // Log the settings change
    dashboardLogger.logSettingsChanged('dashboard', 'Font Size', oldSize, size, 'User');
    
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


  // Save all settings (now only used for manual save if needed)
  const handleSave = async () => {
    setSaving(true);
    try {
      // Settings are already saved automatically, this is just for user feedback
      await new Promise(resolve => setTimeout(resolve, 300));
      toast.success('All settings are saved!');
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
    setPrimaryColor(settings.primaryColor || '#3b82f6');
    setFontSize(settings.fontSize || 'medium');
    setAnimationsEnabled(settings.animationsEnabled ?? true);
    setCompactMode(settings.compactMode ?? false);
    setAutoRefresh(settings.autoRefresh ?? true);
    setRefreshInterval(settings.refreshInterval || 30);
    
    // Re-apply current settings
    handleColorChange(settings.primaryColor || '#3b82f6');
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
                        ? 'border-primary bg-primary/10 shadow-md scale-105'
                        : 'border-border bg-muted/50 hover:border-primary hover:bg-muted'
                    )}
                  >
                    <Icon className={classNames(
                      'w-8 h-8 mb-3 transition-all duration-300 group-hover:scale-110',
                      theme === id
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-primary'
                    )} />
                    <div>
                      <div className={classNames(
                        'text-sm font-semibold mb-1',
                        theme === id
                          ? 'text-primary'
                          : 'text-foreground'
                      )}>{name}</div>
                      <div className={classNames(
                        'text-xs',
                        theme === id
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      )}>{desc}</div>
                    </div>
                    {theme === id && (
                      <CheckIcon className="absolute top-3 right-3 w-5 h-5 text-primary" />
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
              <ColorCustomizer />
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
                        ? 'border-primary bg-primary/10 shadow-md scale-105'
                        : 'border-border bg-muted/50 hover:border-primary hover:bg-muted'
                    )}
                  >
                    <div className={classNames(
                      'font-semibold mb-2 transition-all duration-300',
                      preset.preview,
                      fontSize === preset.value
                        ? 'text-primary'
                        : 'text-foreground'
                    )}>Aa</div>
                    <div className={classNames(
                      'text-xs font-medium',
                      fontSize === preset.value
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    )}>{preset.label}</div>
                    {fontSize === preset.value && (
                      <CheckIcon className="absolute top-2 right-2 w-4 h-4 text-primary" />
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
                  <div className="space-y-4 pl-4 border-l-2 border-primary/30">
                    <div>
                      <label className="block text-sm font-medium mb-3 text-foreground">
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
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-muted text-foreground hover:border-primary'
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
                  <label className="block text-sm font-medium mb-3 text-foreground">
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
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted text-foreground hover:border-primary'
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
                <div className="flex items-center justify-between p-4 rounded-lg border content-area">
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
                  <div className="card p-4 text-center">
                    <ArrowDownTrayIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <h4 className="font-medium mb-2 text-foreground">Export Settings</h4>
                    <p className="text-sm mb-4 text-muted-foreground">Download your current settings as a backup file</p>
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
                  
                  <div className="card p-4 text-center">
                    <ArrowUpTrayIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <h4 className="font-medium mb-2 text-foreground">Import Settings</h4>
                    <p className="text-sm mb-4 text-muted-foreground">Restore settings from a previously exported file</p>
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
    <div className="page-container p-8">
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
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                          : 'text-foreground hover:bg-muted hover:text-foreground hover:-translate-y-0.5'
                      )}
                    >
                      <Icon className={classNames(
                        'h-5 w-5 mr-3 transition-all duration-300 group-hover:scale-110',
                        isActive ? 'text-primary-foreground' : 'text-foreground group-hover:text-foreground'
                      )} />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{category.name}</div>
                        <div className={classNames(
                          'text-xs mt-0.5',
                          isActive 
                            ? 'text-primary-foreground/80' 
                            : 'text-foreground/70'
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
              "card mt-6 p-4 rounded-lg border flex items-center justify-between transition-all duration-300 hover:shadow-lg"
            )}>
              <div className="flex items-center">
                <div className={classNames(
                  'w-2 h-2 rounded-full mr-2',
                  'bg-green-500'
                )}></div>
                <p className="text-sm font-medium text-foreground">
                  Settings are saved automatically
                </p>
              </div>
              <div className="flex space-x-3">
                <ActionButton
                  onClick={handleReset}
                  variant="outline"
                  size="sm"
                >
                  Reset to Defaults
                </ActionButton>
                <ActionButton
                  onClick={handleSave}
                  loading={saving}
                  variant="secondary"
                  size="sm"
                  icon={saving ? undefined : CheckIcon}
                >
                  {saving ? 'Confirming...' : 'All Saved'}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
};

export default Settings;