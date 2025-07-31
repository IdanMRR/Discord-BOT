import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
  className?: string;
  id?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  enabled,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  variant = 'default',
  loading = false,
  className = '',
  id
}) => {
  const { darkMode } = useTheme();

  // Size configurations
  const sizeConfig = {
    sm: {
      switch: 'h-5 w-9',
      thumb: 'h-3 w-3',
      translate: enabled ? 'translate-x-5' : 'translate-x-1'
    },
    md: {
      switch: 'h-6 w-11',
      thumb: 'h-4 w-4',
      translate: enabled ? 'translate-x-6' : 'translate-x-1'
    },
    lg: {
      switch: 'h-7 w-13',
      thumb: 'h-5 w-5',
      translate: enabled ? 'translate-x-7' : 'translate-x-1'
    }
  };

  // Variant colors
  const variantColors = {
    default: enabled ? 'bg-primary hover:bg-primary/90' : 'bg-muted hover:bg-muted/80',
    success: enabled ? 'bg-green-600 hover:bg-green-700' : darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300',
    warning: enabled ? 'bg-yellow-600 hover:bg-yellow-700' : darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300',
    danger: enabled ? 'bg-red-600 hover:bg-red-700' : darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300',
    info: enabled ? 'bg-primary hover:bg-primary/90' : 'bg-muted hover:bg-muted/80'
  };

  const handleToggle = () => {
    if (!disabled && !loading) {
      onChange(!enabled);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  const config = sizeConfig[size];

  return (
    <div className={classNames('flex items-start', className)}>
      {/* Toggle Switch */}
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={enabled}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled || loading}
        onClick={handleToggle}
        onKeyDown={handleKeyPress}
        className={classNames(
          'relative inline-flex items-center rounded-full border-2 border-transparent transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2',
          config.switch,
          variantColors[variant],
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          !disabled && !loading && 'cursor-pointer hover:shadow-lg hover:scale-105',
          'focus:ring-offset-background',
          enabled ? 'focus:ring-primary' : 'focus:ring-muted-foreground'
        )}
      >
        <span className="sr-only">{label || 'Toggle setting'}</span>
        
        {/* Loading spinner overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
          </div>
        )}
        
        {/* Toggle thumb */}
        <span
          className={classNames(
            'inline-block transform rounded-full bg-white shadow-lg ring-0 transition-all duration-300',
            config.thumb,
            config.translate,
            !loading && 'shadow-lg',
            loading && 'opacity-50'
          )}
        />
        
        {/* Animated background gradient */}
        <span 
          className={classNames(
            'absolute inset-0 rounded-full opacity-20 transition-opacity duration-300',
            enabled ? 'bg-gradient-to-r from-primary/40 to-primary/60' : 'bg-transparent'
          )}
        />
      </button>

      {/* Label and Description */}
      {(label || description) && (
        <div className="ml-4 flex-1">
          {label && (
            <label 
              htmlFor={id}
              className={classNames(
                'block text-sm font-medium cursor-pointer',
                'text-foreground',
                disabled && 'opacity-50'
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p 
              id={description ? `${id}-description` : undefined}
              className={classNames(
                'mt-1 text-sm',
                'text-muted-foreground',
                disabled && 'opacity-50'
              )}
            >
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ToggleSwitch;