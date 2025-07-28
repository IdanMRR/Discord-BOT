import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  iconColor: 'primary' | 'secondary' | 'green' | 'blue' | 'yellow' | 'red';
  className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  iconColor,
  className = ""
}) => {
  const { darkMode } = useTheme();

  // Icon color mappings
  const iconColorClasses = {
    primary: darkMode ? "bg-primary-500/20 text-primary-400" : "bg-primary-100 text-primary-600",
    secondary: darkMode ? "bg-secondary-500/20 text-secondary-400" : "bg-secondary-100 text-secondary-600",
    green: darkMode ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-600",
    blue: darkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600",
    yellow: darkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-600",
    red: darkMode ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"
  };

  const cardClasses = classNames(
    "p-6 rounded-lg border transition-colors",
    darkMode 
      ? "bg-gray-800 border-gray-700 hover:border-gray-600" 
      : "bg-white border-gray-200 hover:border-gray-300",
    className
  );

  const iconContainerClasses = classNames(
    "p-3 rounded-lg",
    iconColorClasses[iconColor]
  );

  const titleClasses = classNames(
    "text-sm font-medium",
    darkMode ? "text-gray-400" : "text-gray-600"
  );

  const valueClasses = classNames(
    "text-2xl font-bold",
    iconColor === 'green' ? "text-green-500" : (darkMode ? "text-white" : "text-gray-900")
  );

  return (
    <div className={cardClasses}>
      <div className="flex items-center">
        <div className={iconContainerClasses}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="ml-4">
          <p className={titleClasses}>{title}</p>
          <p className={valueClasses}>{value}</p>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;