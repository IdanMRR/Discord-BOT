import React from 'react';
import { 
  MagnifyingGlassIcon, 
  ChevronDownIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface SimpleFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  selectValue?: string;
  onSelectChange?: (value: string) => void;
  selectOptions?: { value: string; label: string }[];
  selectPlaceholder?: string;
  showClear?: boolean;
  onClear?: () => void;
  className?: string;
}

const SimpleFilter: React.FC<SimpleFilterProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  selectValue,
  onSelectChange,
  selectOptions = [],
  selectPlaceholder = "All",
  showClear = true,
  onClear,
  className = ''
}) => {
  const { darkMode } = useTheme();

  const hasActiveFilters = searchValue || (selectValue && selectValue !== '');

  const handleClear = () => {
    onSearchChange('');
    if (onSelectChange) onSelectChange('');
    if (onClear) onClear();
  };

  const inputClasses = classNames(
    "block w-full rounded-lg border shadow-sm transition-all duration-200",
    "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
    "placeholder:text-gray-400 text-sm",
    darkMode 
      ? "bg-gray-800 border-gray-600 text-white hover:bg-gray-750" 
      : "bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
  );

  return (
    <div className={classNames(
      "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4",
      className
    )}>
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={classNames(inputClasses, "pl-10 pr-3 py-2.5")}
            />
          </div>
        </div>

        {/* Select Dropdown */}
        {selectOptions.length > 0 && onSelectChange && (
          <div className="sm:w-48">
            <div className="relative">
              <select
                value={selectValue || ''}
                onChange={(e) => onSelectChange(e.target.value)}
                className={classNames(
                  inputClasses,
                  "pl-3 pr-10 py-2.5 appearance-none cursor-pointer"
                )}
              >
                {selectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Clear Button */}
        {showClear && hasActiveFilters && (
          <div className="sm:w-auto">
            <button
              onClick={handleClear}
              className={classNames(
                "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg",
                "border border-gray-300 dark:border-gray-600",
                "text-gray-700 dark:text-gray-300",
                "hover:bg-gray-50 dark:hover:bg-gray-800",
                "transition-colors duration-200 w-full sm:w-auto"
              )}
            >
              <XMarkIcon className="h-4 w-4" />
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleFilter;