import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface ActionButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'outline' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ComponentType<any>;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  children,
  className = "",
  type = 'button',
  fullWidth = false
}) => {
  const { darkMode } = useTheme();

  // Size classes
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg'
  };

  // Variant classes
  const variantClasses = {
    primary: darkMode 
      ? "bg-purple-600 text-white hover:bg-purple-700 border-purple-600 focus:ring-purple-500" 
      : "bg-purple-600 text-white hover:bg-purple-700 border-purple-600 focus:ring-purple-500",
    secondary: darkMode 
      ? "bg-gray-600 text-white hover:bg-gray-700 border-gray-600 focus:ring-gray-500" 
      : "bg-gray-600 text-white hover:bg-gray-700 border-gray-600 focus:ring-gray-500",
    success: darkMode
      ? "bg-green-600 text-white hover:bg-green-700 border-green-600 focus:ring-green-500"
      : "bg-green-600 text-white hover:bg-green-700 border-green-600 focus:ring-green-500",
    danger: darkMode
      ? "bg-red-600 text-white hover:bg-red-700 border-red-600 focus:ring-red-500"
      : "bg-red-600 text-white hover:bg-red-700 border-red-600 focus:ring-red-500",
    warning: darkMode
      ? "bg-yellow-600 text-white hover:bg-yellow-700 border-yellow-600 focus:ring-yellow-500"
      : "bg-yellow-600 text-white hover:bg-yellow-700 border-yellow-600 focus:ring-yellow-500",
    info: darkMode
      ? "bg-blue-600 text-white hover:bg-blue-700 border-blue-600 focus:ring-blue-500"
      : "bg-blue-600 text-white hover:bg-blue-700 border-blue-600 focus:ring-blue-500",
    outline: darkMode 
      ? "border-gray-600 text-gray-300 bg-transparent hover:bg-gray-700 focus:ring-gray-500" 
      : "border-gray-300 text-gray-700 bg-transparent hover:bg-gray-50 focus:ring-gray-500",
    ghost: darkMode
      ? "border-transparent text-gray-300 bg-transparent hover:bg-gray-700 focus:ring-gray-500"
      : "border-transparent text-gray-700 bg-transparent hover:bg-gray-100 focus:ring-gray-500"
  };

  const buttonClasses = classNames(
    "inline-flex items-center justify-center border rounded-lg font-medium transition-all duration-200",
    "focus:outline-none focus:ring-2 focus:ring-offset-2",
    darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white",
    sizeClasses[size],
    variantClasses[variant],
    (disabled || loading) && "opacity-50 cursor-not-allowed",
    fullWidth && "w-full",
    className
  );

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={buttonClasses}
    >
      {loading && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
      )}
      {Icon && !loading && (
        <Icon className={classNames(
          "h-4 w-4", 
          children ? "mr-2" : ""
        )} />
      )}
      {children}
    </button>
  );
};

export default ActionButton;