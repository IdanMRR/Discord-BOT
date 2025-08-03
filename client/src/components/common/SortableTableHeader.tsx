import React from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface SortableTableHeaderProps {
  label: string;
  sortKey: string;
  currentSort?: SortConfig;
  onSort: (sortConfig: SortConfig) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

const SortableTableHeader: React.FC<SortableTableHeaderProps> = ({
  label,
  sortKey,
  currentSort,
  onSort,
  className = '',
  align = 'left'
}) => {
  const { darkMode } = useTheme();

  const isActive = currentSort?.key === sortKey;
  const direction = isActive ? currentSort.direction : 'asc';

  const handleClick = () => {
    if (isActive) {
      // If already sorting by this column, toggle direction
      onSort({ key: sortKey, direction: direction === 'asc' ? 'desc' : 'asc' });
    } else {
      // If not sorting by this column, start with ascending
      onSort({ key: sortKey, direction: 'asc' });
    }
  };

  const alignmentClasses = {
    left: 'text-left justify-start',
    center: 'text-center justify-center',
    right: 'text-right justify-end'
  };

  return (
    <th
      className={classNames(
        "px-6 py-3 cursor-pointer select-none transition-colors duration-200",
        "hover:bg-gray-100 dark:hover:bg-gray-700",
        isActive && (darkMode ? "bg-gray-700" : "bg-gray-100"),
        className
      )}
      onClick={handleClick}
    >
      <div className={classNames(
        "flex items-center gap-2 font-medium text-xs uppercase tracking-wider",
        alignmentClasses[align],
        isActive 
          ? (darkMode ? "text-blue-400" : "text-blue-600")
          : (darkMode ? "text-gray-300" : "text-gray-500")
      )}>
        <span>{label}</span>
        <div className="flex flex-col">
          <ChevronUpIcon 
            className={classNames(
              "h-3 w-3 transition-colors duration-200",
              isActive && direction === 'asc'
                ? (darkMode ? "text-blue-400" : "text-blue-600")
                : "text-gray-400"
            )}
          />
          <ChevronDownIcon 
            className={classNames(
              "h-3 w-3 -mt-1 transition-colors duration-200",
              isActive && direction === 'desc'
                ? (darkMode ? "text-blue-400" : "text-blue-600")
                : "text-gray-400"
            )}
          />
        </div>
      </div>
    </th>
  );
};

export default SortableTableHeader;