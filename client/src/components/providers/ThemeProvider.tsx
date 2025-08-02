import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeTheme, toggleTheme, setCustomPrimaryColor, colorPresets, updatePrimaryColorsForCurrentTheme } from '../../lib/utils';
import { useSettings } from '../../contexts/SettingsContext';

interface ThemeContextType {
  isDark: boolean;
  setIsDark: (isDark: boolean) => void;
  toggleTheme: () => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  applyColorPreset: (preset: keyof typeof colorPresets) => void;
  colorPresets: typeof colorPresets;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { settings, updateSetting } = useSettings();
  const [isDark, setIsDark] = useState(false);
  const [primaryColor, setPrimaryColorState] = useState(settings.primaryColor || '#8b5cf6');

  useEffect(() => {
    // Initialize theme on mount
    initializeTheme();
    
    // Check current theme
    const currentIsDark = document.documentElement.classList.contains('dark');
    setIsDark(currentIsDark);
    
    // Load saved primary color from settings
    if (settings.primaryColor) {
      setPrimaryColorState(settings.primaryColor);
      setCustomPrimaryColor(settings.primaryColor);
    }
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        const newIsDark = mediaQuery.matches;
        setIsDark(newIsDark);
        if (newIsDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.primaryColor]);

  const handleToggleTheme = () => {
    toggleTheme();
    setIsDark(!isDark);
    
    // Ensure colors update after theme toggle
    setTimeout(() => {
      updatePrimaryColorsForCurrentTheme();
    }, 50);
  };

  const handleSetPrimaryColor = (color: string) => {
    setCustomPrimaryColor(color);
    setPrimaryColorState(color);
    updateSetting('primaryColor', color);
    
    // Ensure colors are applied to current theme
    setTimeout(() => {
      updatePrimaryColorsForCurrentTheme();
    }, 10);
  };

  const handleApplyColorPreset = (preset: keyof typeof colorPresets) => {
    const color = colorPresets[preset];
    setCustomPrimaryColor(color);
    setPrimaryColorState(color);
    updateSetting('primaryColor', color);
    
    // Ensure colors are applied to current theme
    setTimeout(() => {
      updatePrimaryColorsForCurrentTheme();
    }, 10);
  };

  const value: ThemeContextType = {
    isDark,
    setIsDark,
    toggleTheme: handleToggleTheme,
    primaryColor,
    setPrimaryColor: handleSetPrimaryColor,
    applyColorPreset: handleApplyColorPreset,
    colorPresets,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}