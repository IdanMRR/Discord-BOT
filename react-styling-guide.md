# Complete React Site Styling Guide

This guide provides everything you need to implement consistent styling across your entire React application with proper light/dark mode support.

## CSS Variables Setup

### 1. Add Root Variables to Your Global CSS

```css
:root {
  /* Light Mode Colors */
  --background: oklch(0.9232 0.0026 48.7171);
  --foreground: oklch(0.2795 0.0368 260.0310);
  --card: oklch(0.9699 0.0013 106.4238);
  --card-foreground: oklch(0.2795 0.0368 260.0310);
  --popover: oklch(0.9699 0.0013 106.4238);
  --popover-foreground: oklch(0.2795 0.0368 260.0310);
  --primary: oklch(0.5854 0.2041 277.1173);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.8687 0.0043 56.3660);
  --secondary-foreground: oklch(0.4461 0.0263 256.8018);
  --muted: oklch(0.9232 0.0026 48.7171);
  --muted-foreground: oklch(0.5510 0.0234 264.3637);
  --accent: oklch(0.9376 0.0260 321.9388);
  --accent-foreground: oklch(0.3729 0.0306 259.7328);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.8687 0.0043 56.3660);
  --input: oklch(0.8687 0.0043 56.3660);
  --ring: oklch(0.5854 0.2041 277.1173);
  
  /* Chart Colors */
  --chart-1: oklch(0.5854 0.2041 277.1173);
  --chart-2: oklch(0.5106 0.2301 276.9656);
  --chart-3: oklch(0.4568 0.2146 277.0229);
  --chart-4: oklch(0.3984 0.1773 277.3662);
  --chart-5: oklch(0.3588 0.1354 278.6973);
  
  /* Sidebar Colors */
  --sidebar: oklch(0.8687 0.0043 56.3660);
  --sidebar-foreground: oklch(0.2795 0.0368 260.0310);
  --sidebar-primary: oklch(0.5854 0.2041 277.1173);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.9376 0.0260 321.9388);
  --sidebar-accent-foreground: oklch(0.3729 0.0306 259.7328);
  --sidebar-border: oklch(0.8687 0.0043 56.3660);
  --sidebar-ring: oklch(0.5854 0.2041 277.1173);
  
  /* Typography */
  --font-sans: Plus Jakarta Sans, sans-serif;
  --font-serif: Lora, serif;
  --font-mono: Roboto Mono, monospace;
  
  /* Border Radius */
  --radius: 1.25rem;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  
  /* Shadows */
  --shadow-2xs: 2px 2px 10px 4px hsl(240 4% 60% / 0.09);
  --shadow-xs: 2px 2px 10px 4px hsl(240 4% 60% / 0.09);
  --shadow-sm: 2px 2px 10px 4px hsl(240 4% 60% / 0.18), 2px 1px 2px 3px hsl(240 4% 60% / 0.18);
  --shadow: 2px 2px 10px 4px hsl(240 4% 60% / 0.18), 2px 1px 2px 3px hsl(240 4% 60% / 0.18);
  --shadow-md: 2px 2px 10px 4px hsl(240 4% 60% / 0.18), 2px 2px 4px 3px hsl(240 4% 60% / 0.18);
  --shadow-lg: 2px 2px 10px 4px hsl(240 4% 60% / 0.18), 2px 4px 6px 3px hsl(240 4% 60% / 0.18);
  --shadow-xl: 2px 2px 10px 4px hsl(240 4% 60% / 0.18), 2px 8px 10px 3px hsl(240 4% 60% / 0.18);
  --shadow-2xl: 2px 2px 10px 4px hsl(240 4% 60% / 0.45);
  
  /* Spacing */
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}

/* Dark Mode Colors */
.dark {
  --background: oklch(0.2244 0.0074 67.4370);
  --foreground: oklch(0.9288 0.0126 255.5078);
  --card: oklch(0.2801 0.0080 59.3379);
  --card-foreground: oklch(0.9288 0.0126 255.5078);
  --popover: oklch(0.2801 0.0080 59.3379);
  --popover-foreground: oklch(0.9288 0.0126 255.5078);
  --primary: oklch(0.6801 0.1583 276.9349);
  --primary-foreground: oklch(0.2244 0.0074 67.4370);
  --secondary: oklch(0.3359 0.0077 59.4197);
  --secondary-foreground: oklch(0.8717 0.0093 258.3382);
  --muted: oklch(0.2801 0.0080 59.3379);
  --muted-foreground: oklch(0.7137 0.0192 261.3246);
  --accent: oklch(0.3896 0.0074 59.4734);
  --accent-foreground: oklch(0.8717 0.0093 258.3382);
  --destructive: oklch(0.6368 0.2078 25.3313);
  --destructive-foreground: oklch(0.2244 0.0074 67.4370);
  --border: oklch(0.3359 0.0077 59.4197);
  --input: oklch(0.3359 0.0077 59.4197);
  --ring: oklch(0.6801 0.1583 276.9349);
  
  /* Chart Colors - Dark Mode */
  --chart-1: oklch(0.6801 0.1583 276.9349);
  --chart-2: oklch(0.5854 0.2041 277.1173);
  --chart-3: oklch(0.5106 0.2301 276.9656);
  --chart-4: oklch(0.4568 0.2146 277.0229);
  --chart-5: oklch(0.3984 0.1773 277.3662);
  
  /* Sidebar Colors - Dark Mode */
  --sidebar: oklch(0.3359 0.0077 59.4197);
  --sidebar-foreground: oklch(0.9288 0.0126 255.5078);
  --sidebar-primary: oklch(0.6801 0.1583 276.9349);
  --sidebar-primary-foreground: oklch(0.2244 0.0074 67.4370);
  --sidebar-accent: oklch(0.3896 0.0074 59.4734);
  --sidebar-accent-foreground: oklch(0.8717 0.0093 258.3382);
  --sidebar-border: oklch(0.3359 0.0077 59.4197);
  --sidebar-ring: oklch(0.6801 0.1583 276.9349);
  
  /* Shadows - Dark Mode */
  --shadow-2xs: 2px 2px 10px 4px hsl(0 0% 0% / 0.09);
  --shadow-xs: 2px 2px 10px 4px hsl(0 0% 0% / 0.09);
  --shadow-sm: 2px 2px 10px 4px hsl(0 0% 0% / 0.18), 2px 1px 2px 3px hsl(0 0% 0% / 0.18);
  --shadow: 2px 2px 10px 4px hsl(0 0% 0% / 0.18), 2px 1px 2px 3px hsl(0 0% 0% / 0.18);
  --shadow-md: 2px 2px 10px 4px hsl(0 0% 0% / 0.18), 2px 2px 4px 3px hsl(0 0% 0% / 0.18);
  --shadow-lg: 2px 2px 10px 4px hsl(0 0% 0% / 0.18), 2px 4px 6px 3px hsl(0 0% 0% / 0.18);
  --shadow-xl: 2px 2px 10px 4px hsl(0 0% 0% / 0.18), 2px 8px 10px 3px hsl(0 0% 0% / 0.18);
  --shadow-2xl: 2px 2px 10px 4px hsl(0 0% 0% / 0.45);
}
```

## Base Styles for All Elements

### 2. Global Base Styles

```css
/* Apply base styles to body and html */
html {
  font-family: var(--font-sans);
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  border-color: var(--border);
}
```

## Component-Specific Styles

### 3. Page Containers

```css
.page-container {
  background-color: var(--background);
  color: var(--foreground);
  min-height: 100vh;
}

.content-area {
  background-color: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
```

### 4. Form Controls

#### Input Fields
```css
.input-field {
  background-color: var(--background);
  border: 1px solid var(--input);
  color: var(--foreground);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  font-family: var(--font-sans);
  transition: all 0.2s ease-in-out;
}

.input-field:focus {
  outline: none;
  border-color: var(--ring);
  box-shadow: 0 0 0 2px var(--ring);
}

.input-field:disabled {
  background-color: var(--muted);
  color: var(--muted-foreground);
  cursor: not-allowed;
}

.input-field::placeholder {
  color: var(--muted-foreground);
}
```

#### Select Boxes
```css
.select-box {
  background-color: var(--background);
  border: 1px solid var(--input);
  color: var(--foreground);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  font-family: var(--font-sans);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
}

.select-box:focus {
  outline: none;
  border-color: var(--ring);
  box-shadow: 0 0 0 2px var(--ring);
}

.select-box:disabled {
  background-color: var(--muted);
  color: var(--muted-foreground);
  cursor: not-allowed;
}

/* Select dropdown options */
.select-box option {
  background-color: var(--popover);
  color: var(--popover-foreground);
}
```

#### Checkboxes
```css
.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox {
  width: 1rem;
  height: 1rem;
  border: 1px solid var(--input);
  border-radius: var(--radius-sm);
  background-color: var(--background);
  cursor: pointer;
  position: relative;
  appearance: none;
}

.checkbox:checked {
  background-color: var(--primary);
  border-color: var(--primary);
}

.checkbox:checked::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 5px;
  width: 4px;
  height: 8px;
  border: solid var(--primary-foreground);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--ring);
}

.checkbox:disabled {
  background-color: var(--muted);
  border-color: var(--muted);
  cursor: not-allowed;
}

.checkbox-label {
  color: var(--foreground);
  font-family: var(--font-sans);
  cursor: pointer;
  user-select: none;
}
```

#### Radio Buttons
```css
.radio-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.radio {
  width: 1rem;
  height: 1rem;
  border: 1px solid var(--input);
  border-radius: 50%;
  background-color: var(--background);
  cursor: pointer;
  position: relative;
  appearance: none;
}

.radio:checked {
  background-color: var(--primary);
  border-color: var(--primary);
}

.radio:checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--primary-foreground);
  transform: translate(-50%, -50%);
}

.radio:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--ring);
}

.radio-label {
  color: var(--foreground);
  font-family: var(--font-sans);
  cursor: pointer;
  user-select: none;
}
```

### 5. Buttons

```css
/* Primary Button */
.btn-primary {
  background-color: var(--primary);
  color: var(--primary-foreground);
  border: none;
  border-radius: var(--radius-md);
  padding: 0.5rem 1rem;
  font-family: var(--font-sans);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover {
  opacity: 0.9;
  box-shadow: var(--shadow-md);
}

.btn-primary:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--ring);
}

.btn-primary:disabled {
  background-color: var(--muted);
  color: var(--muted-foreground);
  cursor: not-allowed;
  opacity: 0.5;
}

/* Secondary Button */
.btn-secondary {
  background-color: var(--secondary);
  color: var(--secondary-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.5rem 1rem;
  font-family: var(--font-sans);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.btn-secondary:hover {
  background-color: var(--accent);
  color: var(--accent-foreground);
}

.btn-secondary:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--ring);
}

/* Destructive Button */
.btn-destructive {
  background-color: var(--destructive);
  color: var(--destructive-foreground);
  border: none;
  border-radius: var(--radius-md);
  padding: 0.5rem 1rem;
  font-family: var(--font-sans);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.btn-destructive:hover {
  opacity: 0.9;
}

.btn-destructive:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--ring);
}
```

### 6. Cards and Containers

```css
.card {
  background-color: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
}

.card-header {
  border-bottom: 1px solid var(--border);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--card-foreground);
  margin: 0;
}

.card-description {
  color: var(--muted-foreground);
  font-size: 0.875rem;
  margin: 0.25rem 0 0 0;
}
```

### 7. Navigation and Sidebar

```css
.sidebar {
  background-color: var(--sidebar);
  color: var(--sidebar-foreground);
  border-right: 1px solid var(--sidebar-border);
  min-height: 100vh;
}

.sidebar-nav-item {
  color: var(--sidebar-foreground);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  transition: all 0.2s ease-in-out;
  text-decoration: none;
  display: block;
}

.sidebar-nav-item:hover {
  background-color: var(--sidebar-accent);
  color: var(--sidebar-accent-foreground);
}

.sidebar-nav-item.active {
  background-color: var(--sidebar-primary);
  color: var(--sidebar-primary-foreground);
}

.sidebar-nav-item:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--sidebar-ring);
}
```

### 8. Tables

```css
.table {
  width: 100%;
  border-collapse: collapse;
  background-color: var(--card);
  color: var(--card-foreground);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.table th {
  background-color: var(--muted);
  color: var(--muted-foreground);
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}

.table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}

.table tbody tr:hover {
  background-color: var(--accent);
  color: var(--accent-foreground);
}

.table tbody tr:last-child td {
  border-bottom: none;
}
```

### 9. Modals and Popovers

```css
.modal-overlay {
  background-color: rgba(0, 0, 0, 0.5);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--popover);
  color: var(--popover-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.popover {
  background-color: var(--popover);
  color: var(--popover-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 1rem;
}
```

### 10. Toast Notifications

```css
.toast {
  background-color: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 1rem;
  max-width: 400px;
}

.toast.success {
  border-left: 4px solid var(--primary);
}

.toast.error {
  border-left: 4px solid var(--destructive);
}

.toast.warning {
  border-left: 4px solid var(--accent);
}
```

## React Implementation

### 11. Theme Context Setup

```jsx
// ThemeContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

### 12. Component Examples

```jsx
// Example components using the theme
const Button = ({ variant = 'primary', children, ...props }) => {
  return (
    <button className={`btn-${variant}`} {...props}>
      {children}
    </button>
  );
};

const Input = ({ ...props }) => {
  return (
    <input className="input-field" {...props} />
  );
};

const Select = ({ children, ...props }) => {
  return (
    <select className="select-box" {...props}>
      {children}
    </select>
  );
};

const Checkbox = ({ label, id, ...props }) => {
  return (
    <div className="checkbox-wrapper">
      <input type="checkbox" className="checkbox" id={id} {...props} />
      <label htmlFor={id} className="checkbox-label">{label}</label>
    </div>
  );
};

const Card = ({ title, description, children }) => {
  return (
    <div className="card">
      {(title || description) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {description && <p className="card-description">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
};
```

## Implementation Checklist

### ✅ Pages
- [ ] Apply `.page-container` class to all page wrappers
- [ ] Use `.content-area` for main content sections
- [ ] Ensure all text uses CSS variables for colors

### ✅ Form Elements
- [ ] Style all `<input>` elements with `.input-field`
- [ ] Style all `<select>` elements with `.select-box`
- [ ] Replace all checkboxes with custom styled versions
- [ ] Replace all radio buttons with custom styled versions
- [ ] Update all button variants

### ✅ Navigation
- [ ] Apply sidebar styles to navigation menus
- [ ] Update active states for navigation items
- [ ] Apply focus states to all interactive elements

### ✅ Data Display
- [ ] Style all tables with `.table` class
- [ ] Update card components with new styles
- [ ] Apply consistent spacing using CSS variables

### ✅ Interactive Elements
- [ ] Style modals and popovers
- [ ] Update toast notification styles
- [ ] Ensure all hover states use CSS variables

### ✅ Typography
- [ ] Apply font families from CSS variables
- [ ] Ensure all text colors use theme variables
- [ ] Update heading styles consistently

### ✅ Dark Mode
- [ ] Implement ThemeProvider in your app root
- [ ] Add theme toggle component
- [ ] Test all components in both light and dark modes
- [ ] Verify all colors adapt properly

## Final Notes

1. **Import fonts**: Make sure to import Plus Jakarta Sans, Lora, and Roboto Mono fonts in your HTML head or CSS
2. **Test thoroughly**: Check every component in both light and dark modes
3. **Consistency**: Use the CSS variables everywhere instead of hardcoded colors
4. **Accessibility**: All focus states and contrast ratios are maintained
5. **Performance**: CSS variables allow for efficient theme switching

This implementation ensures every single element on your site will have consistent styling that properly adapts to both light and dark modes.