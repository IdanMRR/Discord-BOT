import React, { createContext, useContext, useEffect, useState } from 'react';
import { updatePrimaryColorsForCurrentTheme } from '../lib/utils';

const ThemeContext = createContext<{
  theme: string;
  darkMode: boolean;
  toggleTheme: () => void;
} | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return saved || (prefersDark ? 'dark' : 'light');
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const rootElement = document.getElementById('root');
    const themeColorMeta = document.getElementById('theme-color-meta') as HTMLMetaElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
      if (rootElement) rootElement.classList.add('dark');
      if (themeColorMeta) {
        themeColorMeta.content = 'hsl(263, 70%, 70%)';
      }
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      if (rootElement) rootElement.classList.remove('dark');
      if (themeColorMeta) {
        themeColorMeta.content = 'hsl(262, 83%, 58%)';
      }
    }
    localStorage.setItem('theme', theme);
    
    // Update primary colors for the new theme
    setTimeout(() => {
      updatePrimaryColorsForCurrentTheme();
    }, 50);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const darkMode = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
