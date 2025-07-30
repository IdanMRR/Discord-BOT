import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface StatusIndicatorProps {
  status: 'configured' | 'not-configured' | 'warning' | 'error' | 'loading';
  label?: string;
  customIcon?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  customIcon,
  className = '',
  size = 'md'
}) => {
  const { darkMode } = useTheme();

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1.5',
    lg: 'text-base px-3 py-2'
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'configured':
        return {
          icon: customIcon || '✅',
          text: label || 'Configured',
          bgColor: darkMode ? 'bg-green-900/20 text-green-400' : 'bg-green-100 text-green-800',
          borderColor: 'border-green-500/30'
        };
      case 'not-configured':
        return {
          icon: customIcon || '❌',
          text: label || 'Not configured',
          bgColor: darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-800',
          borderColor: 'border-red-500/30'
        };
      case 'warning':
        return {
          icon: customIcon || '⚠️',
          text: label || 'Warning',
          bgColor: darkMode ? 'bg-yellow-900/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800',
          borderColor: 'border-yellow-500/30'
        };
      case 'error':
        return {
          icon: customIcon || '❌',
          text: label || 'Error',
          bgColor: darkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-800',
          borderColor: 'border-red-500/30'
        };
      case 'loading':
        return {
          icon: customIcon || '⏳',
          text: label || 'Loading...',
          bgColor: darkMode ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-100 text-blue-800',
          borderColor: 'border-blue-500/30'
        };
      default:
        return {
          icon: customIcon || '❓',
          text: label || 'Unknown',
          bgColor: darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600',
          borderColor: 'border-gray-500/30'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={classNames(
      "inline-flex items-center rounded-full font-medium border transition-all duration-200",
      sizeClasses[size],
      config.bgColor,
      config.borderColor,
      className
    )}>
      <span className="mr-1.5">{config.icon}</span>
      {config.text}
    </div>
  );
};

export default StatusIndicator;