import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Apply settings immediately on page load
const applyInitialSettings = () => {
  try {
    const savedSettings = localStorage.getItem('dashboard_settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      const root = document.documentElement;
      const body = document.body;
      
      // Apply font size scaling
      const fontSizeMap = {
        small: '0.9',
        medium: '1.0', 
        large: '1.1'
      };
      const scale = fontSizeMap[settings.fontSize as keyof typeof fontSizeMap] || '1.0';
      root.style.setProperty('--font-scale', scale);
      
      // Apply primary color
      if (settings.primaryColor) {
        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : null;
        };
        
        const rgb = hexToRgb(settings.primaryColor);
        if (rgb) {
          root.style.setProperty('--primary-color', settings.primaryColor);
          root.style.setProperty('--primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        }
      }
      
      // Apply other settings
      if (!settings.animationsEnabled) {
        body.classList.add('no-animations');
      }
      
      if (settings.compactMode) {
        body.classList.add('compact-mode');
      }
    }
  } catch (error) {
    console.error('Error applying initial settings:', error);
  }
};

// Apply settings before React renders
applyInitialSettings();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
