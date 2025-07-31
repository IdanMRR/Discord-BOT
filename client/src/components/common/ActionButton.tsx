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
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 border-primary focus:ring-primary",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 border-secondary focus:ring-secondary",
    success: "bg-success text-success-foreground hover:bg-success/90 border-success focus:ring-success",
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive focus:ring-destructive",
    warning: darkMode
      ? "bg-yellow-600 text-white hover:bg-yellow-700 border-yellow-600 focus:ring-yellow-500"
      : "bg-yellow-600 text-white hover:bg-yellow-700 border-yellow-600 focus:ring-yellow-500",
    info: "bg-primary text-primary-foreground hover:bg-primary/90 border-primary focus:ring-primary",
    outline: "border-input text-foreground bg-transparent hover:bg-accent hover:text-accent-foreground focus:ring-ring",
    ghost: "border-transparent text-foreground bg-transparent hover:bg-accent hover:text-accent-foreground focus:ring-ring"
  };

  const buttonClasses = classNames(
    "inline-flex items-center justify-center border rounded-lg font-medium transition-all duration-200",
    "focus:outline-none focus:ring-2 focus:ring-offset-2",
    "focus:ring-offset-background",
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