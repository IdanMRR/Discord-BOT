import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'highlighted';
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  icon,
  children,
  className = '',
  variant = 'default',
  collapsible = false,
  defaultExpanded = true
}) => {
  const { darkMode } = useTheme();
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  const cardClasses = classNames(
    "rounded-lg border transition-all duration-200",
    darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200",
    variant === 'highlighted' && (darkMode ? "bg-gray-750 border-purple-600/30" : "bg-purple-50 border-purple-200"),
    variant === 'compact' ? "p-4" : "p-6",
    "hover:shadow-md",
    className
  );

  const titleClasses = classNames(
    "font-semibold flex items-center",
    variant === 'compact' ? "text-lg" : "text-xl",
    darkMode ? "text-white" : "text-gray-900"
  );

  const descriptionClasses = classNames(
    "text-sm mt-1",
    darkMode ? "text-gray-400" : "text-gray-600"
  );

  const contentClasses = classNames(
    variant === 'compact' ? "mt-3" : "mt-6",
    !isExpanded && "hidden"
  );

  return (
    <div className={cardClasses}>
      <div 
        className={classNames(
          "flex items-center justify-between",
          collapsible && "cursor-pointer"
        )}
        onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex-1">
          <h3 className={titleClasses}>
            {icon && <span className="mr-3 text-xl">{icon}</span>}
            {title}
          </h3>
          {description && (
            <p className={descriptionClasses}>
              {description}
            </p>
          )}
        </div>
        
        {collapsible && (
          <div className={classNames(
            "ml-4 transition-transform duration-200",
            isExpanded ? "rotate-90" : "rotate-0"
          )}>
            <svg 
              className={classNames(
                "w-5 h-5",
                darkMode ? "text-gray-400" : "text-gray-600"
              )} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 5l7 7-7 7" 
              />
            </svg>
          </div>
        )}
      </div>
      
      <div className={contentClasses}>
        {children}
      </div>
    </div>
  );
};

export default SettingsCard;