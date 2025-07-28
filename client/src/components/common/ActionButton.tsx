import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface ActionButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ComponentType<any>;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
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
  type = 'button'
}) => {
  const { darkMode } = useTheme();

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  // Variant classes
  const variantClasses = {
    primary: darkMode 
      ? "bg-primary-600 text-white hover:bg-primary-700 border-primary-600" 
      : "bg-primary-600 text-white hover:bg-primary-700 border-primary-600",
    secondary: darkMode 
      ? "bg-gray-600 text-white hover:bg-gray-700 border-gray-600" 
      : "bg-gray-600 text-white hover:bg-gray-700 border-gray-600",
    success: "bg-green-600 text-white hover:bg-green-700 border-green-600",
    danger: "bg-red-600 text-white hover:bg-red-700 border-red-600",
    outline: darkMode 
      ? "border-gray-600 text-gray-300 bg-gray-700 hover:bg-gray-600" 
      : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
  };

  const buttonClasses = classNames(
    "inline-flex items-center justify-center border rounded-lg font-medium transition-colors",
    sizeClasses[size],
    variantClasses[variant],
    (disabled || loading) && "opacity-50 cursor-not-allowed",
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