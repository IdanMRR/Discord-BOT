import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<any>;
  actions?: React.ReactNode;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  actions,
  className = ""
}) => {
  const { darkMode } = useTheme();

  const containerClasses = classNames(
    "relative",
    className
  );

  const iconContainerClasses = classNames(
    "p-3 rounded-lg border",
    darkMode 
      ? "bg-gray-800 border-gray-700" 
      : "bg-white border-gray-200"
  );

  const titleClasses = classNames(
    "text-2xl font-bold",
    darkMode ? "text-white" : "text-gray-900"
  );

  const subtitleClasses = classNames(
    "text-sm",
    darkMode ? "text-gray-400" : "text-gray-600"
  );

  return (
    <div className={containerClasses}>
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {Icon && (
            <div className={iconContainerClasses}>
              <Icon className="h-6 w-6 text-primary-600" />
            </div>
          )}
          <div>
            <h1 className={titleClasses}>{title}</h1>
            {subtitle && (
              <p className={subtitleClasses}>{subtitle}</p>
            )}
          </div>
        </div>
        
        {actions && (
          <div className="flex items-center space-x-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;