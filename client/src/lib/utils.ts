import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convert hex color to OKLCH
export function hexToOKLCH(hex: string): { l: number; c: number; h: number } {
  // Remove the # if present
  hex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Convert RGB to linear RGB
  const linearR = r <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const linearG = g <= 0.04045 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const linearB = b <= 0.04045 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  
  // Convert to XYZ
  const x = linearR * 0.4124564 + linearG * 0.3575761 + linearB * 0.1804375;
  const y = linearR * 0.2126729 + linearG * 0.7151522 + linearB * 0.0721750;
  const z = linearR * 0.0193339 + linearG * 0.1191920 + linearB * 0.9503041;
  
  // Convert to LAB
  const xn = x / 0.95047;
  const yn = y / 1.00000;
  const zn = z / 1.08883;
  
  const fx = xn > 0.008856 ? Math.pow(xn, 1/3) : (7.787 * xn + 16/116);
  const fy = yn > 0.008856 ? Math.pow(yn, 1/3) : (7.787 * yn + 16/116);
  const fz = zn > 0.008856 ? Math.pow(zn, 1/3) : (7.787 * zn + 16/116);
  
  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bValue = 200 * (fy - fz);
  
  // Convert LAB to OKLCH (simplified approximation)
  const c = Math.sqrt(a * a + bValue * bValue) / 100;
  const h = Math.atan2(bValue, a) * 180 / Math.PI;
  
  return {
    l: l / 100,
    c: c,
    h: h < 0 ? h + 360 : h
  };
}

// Convert OKLCH to CSS format
export function oklchToCSS(oklch: { l: number; c: number; h: number }): string {
  return `oklch(${oklch.l.toFixed(4)} ${oklch.c.toFixed(4)} ${oklch.h.toFixed(4)})`;
}

// Set custom primary color
export function setCustomPrimaryColor(color: string) {
  const oklch = hexToOKLCH(color);
  const root = document.documentElement;
  
  // Create both light and dark versions
  const lightOklch = oklch;
  const darkOklch = { ...oklch, l: Math.max(0.35, Math.min(0.65, oklch.l * 0.8)) };
  
  // Store the color values so we can apply them dynamically
  root.style.setProperty('--custom-primary-light', oklchToCSS(lightOklch));
  root.style.setProperty('--custom-primary-dark', oklchToCSS(darkOklch));
  
  // Set appropriate foreground colors
  const lightForeground = oklch.l > 0.5 ? 'oklch(0.2046 0 0)' : 'oklch(0.9911 0 0)';
  const darkForeground = 'oklch(0.9911 0 0)';
  
  root.style.setProperty('--custom-primary-foreground-light', lightForeground);
  root.style.setProperty('--custom-primary-foreground-dark', darkForeground);
  
  // Apply the current theme's colors immediately
  updatePrimaryColorsForCurrentTheme();
  
  // Store in both systems for compatibility
  localStorage.setItem('customPrimaryColor', color);
  
  // Also update the existing settings system
  try {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    settings.primaryColor = color;
    localStorage.setItem('settings', JSON.stringify(settings));
  } catch (e) {
    console.warn('Could not update settings system:', e);
  }
}

// Helper function to update colors based on current theme
export function updatePrimaryColorsForCurrentTheme() {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');
  
  const primaryColor = isDark 
    ? root.style.getPropertyValue('--custom-primary-dark') || 'oklch(0.4365 0.1044 156.7556)'
    : root.style.getPropertyValue('--custom-primary-light') || 'oklch(0.8348 0.1302 160.9080)';
    
  const primaryForeground = isDark
    ? root.style.getPropertyValue('--custom-primary-foreground-dark') || 'oklch(0.9911 0 0)'
    : root.style.getPropertyValue('--custom-primary-foreground-light') || 'oklch(0.2626 0.0147 166.4589)';
  
  // Update all primary-related variables
  root.style.setProperty('--primary', primaryColor);
  root.style.setProperty('--primary-foreground', primaryForeground);
  root.style.setProperty('--ring', primaryColor);
  
  // Update sidebar colors to match
  root.style.setProperty('--sidebar-primary', primaryColor);
  root.style.setProperty('--sidebar-primary-foreground', primaryForeground);
  root.style.setProperty('--sidebar-ring', primaryColor);
}

// Load saved custom primary color
export function loadCustomPrimaryColor() {
  const savedColor = localStorage.getItem('customPrimaryColor');
  if (savedColor) {
    setCustomPrimaryColor(savedColor);
  }
}

// Get the current custom primary color
export function getCustomPrimaryColor(): string | null {
  return localStorage.getItem('customPrimaryColor');
}

// Reset to default primary color
export function resetPrimaryColor() {
  const root = document.documentElement;
  root.style.removeProperty('--custom-primary-light');
  root.style.removeProperty('--custom-primary-dark');
  root.style.removeProperty('--custom-primary-foreground-light');
  root.style.removeProperty('--custom-primary-foreground-dark');
  localStorage.removeItem('customPrimaryColor');
  
  // Reset to default values
  const isDark = root.classList.contains('dark');
  if (isDark) {
    root.style.setProperty('--primary', 'oklch(0.4365 0.1044 156.7556)');
    root.style.setProperty('--primary-foreground', 'oklch(0.9213 0.0135 167.1556)');
  } else {
    root.style.setProperty('--primary', 'oklch(0.8348 0.1302 160.9080)');
    root.style.setProperty('--primary-foreground', 'oklch(0.2626 0.0147 166.4589)');
  }
}

// Color presets
export const colorPresets = {
  purple: '#8b5cf6',
  blue: '#3b82f6',
  green: '#10b981',
  pink: '#ec4899',
  orange: '#f97316',
  red: '#ef4444',
  yellow: '#eab308',
  teal: '#14b8a6',
  indigo: '#6366f1',
  slate: '#64748b',
};

// Apply a color preset
export function applyColorPreset(presetName: keyof typeof colorPresets) {
  const color = colorPresets[presetName];
  setCustomPrimaryColor(color);
}

// Theme utilities
export function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }
  
  // Update primary colors for the new theme
  setTimeout(() => {
    updatePrimaryColorsForCurrentTheme();
  }, 10);
}

export function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  
  // Update primary colors for the loaded theme
  setTimeout(() => {
    updatePrimaryColorsForCurrentTheme();
  }, 10);
}

// Initialize theme and custom colors
export function initializeTheme() {
  loadTheme();
  loadCustomPrimaryColor();
}