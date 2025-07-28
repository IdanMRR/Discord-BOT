import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  fontSize: 'small' | 'medium' | 'large';
  animationsEnabled: boolean;
  compactMode: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
}

interface SettingsContextType {
  settings: UserSettings;
  updateSetting: (key: keyof UserSettings, value: any) => void;
  resetSettings: () => void;
  isAutoRefreshEnabled: () => boolean;
  getRefreshInterval: () => number;
  // Auto-refresh management
  registerAutoRefresh: (id: string, callback: () => void) => () => void;
  unregisterAutoRefresh: (id: string) => void;
}

const defaultSettings: UserSettings = {
  theme: 'dark',
  primaryColor: '#3b82f6',
  fontSize: 'medium',
  animationsEnabled: true,
  compactMode: false,
  autoRefresh: true,
  refreshInterval: 30
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const autoRefreshCallbacks = useRef<Map<string, () => void>>(new Map());
  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('dashboard_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  // Set up auto-refresh interval with proper cleanup
  useEffect(() => {
    // Clear any existing interval first
    if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
      autoRefreshInterval.current = null;
    }

    if (settings.autoRefresh && autoRefreshCallbacks.current.size > 0) {
      // Set up new interval
      autoRefreshInterval.current = setInterval(() => {
        // Call all registered refresh callbacks
        autoRefreshCallbacks.current.forEach((callback) => {
          try {
            callback();
          } catch (error) {
            console.error('Error in auto-refresh callback:', error);
          }
        });
      }, settings.refreshInterval * 1000);
    }

    // Cleanup function
    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
        autoRefreshInterval.current = null;
      }
    };
  }, [settings.autoRefresh, settings.refreshInterval]);

  // Separate effect to handle callback changes without recreating interval
  useEffect(() => {
    // If we have no callbacks, clear the interval
    if (autoRefreshCallbacks.current.size === 0 && autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
      autoRefreshInterval.current = null;
    }
  });

  // Cleanup effect on unmount
  useEffect(() => {
    const callbacks = autoRefreshCallbacks.current;
    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
        autoRefreshInterval.current = null;
      }
      callbacks.clear();
    };
  }, []);

  const updateSetting = (key: keyof UserSettings, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      
      // Save to localStorage
      try {
        localStorage.setItem('dashboard_settings', JSON.stringify(newSettings));
      } catch (error) {
        console.error('Error saving setting:', error);
      }
      
      return newSettings;
    });
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('dashboard_settings');
  };

  const isAutoRefreshEnabled = () => settings.autoRefresh;
  const getRefreshInterval = () => settings.refreshInterval;

  const registerAutoRefresh = (id: string, callback: () => void) => {
    autoRefreshCallbacks.current.set(id, callback);
    
    // Return unregister function
    return () => {
      autoRefreshCallbacks.current.delete(id);
    };
  };

  const unregisterAutoRefresh = (id: string) => {
    autoRefreshCallbacks.current.delete(id);
  };

  const value: SettingsContextType = {
    settings,
    updateSetting,
    resetSettings,
    isAutoRefreshEnabled,
    getRefreshInterval,
    registerAutoRefresh,
    unregisterAutoRefresh
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}; 