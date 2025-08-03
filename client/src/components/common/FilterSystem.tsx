import React, { useState } from 'react';
import { 
  MagnifyingGlassIcon, 
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  ChevronDownIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'number';
  placeholder?: string;
  options?: { value: string; label: string; icon?: React.ReactNode }[];
  value?: any;
  onChange: (value: any) => void;
  width?: 'sm' | 'md' | 'lg' | 'full';
  icon?: React.ReactNode;
}


interface FilterSystemProps {
  fields: FilterField[];
  onClearAll?: () => void;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  showActiveCount?: boolean;
}

const FilterSystem: React.FC<FilterSystemProps> = ({
  fields,
  onClearAll,
  className = '',
  collapsible = true,
  defaultCollapsed = false,
  showActiveCount = true
}) => {
  const { darkMode } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [expandedMultiselect, setExpandedMultiselect] = useState<string | null>(null);

  // Count active filters
  const activeFilters = fields.filter(field => {
    if (Array.isArray(field.value)) return field.value.length > 0;
    return field.value && field.value !== '';
  }).length;

  const getFieldWidth = (width: FilterField['width']) => {
    switch (width) {
      case 'sm': return 'col-span-1';
      case 'md': return 'col-span-2';
      case 'lg': return 'col-span-3';
      case 'full': return 'col-span-full';
      default: return 'col-span-1';
    }
  };

  const renderField = (field: FilterField) => {
    const baseInputClasses = classNames(
      "block w-full rounded-lg border shadow-sm transition-colors duration-200",
      "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
      "placeholder:text-gray-400 text-sm",
      darkMode 
        ? "bg-gray-800 border-gray-600 text-white hover:bg-gray-750" 
        : "bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
    );

    const labelClasses = classNames(
      "block text-sm font-medium mb-2",
      darkMode ? "text-gray-300" : "text-gray-700"
    );

    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <div key={field.key} className={getFieldWidth(field.width)}>
            <label className={labelClasses}>
              <div className="flex items-center gap-2">
                {field.icon}
                {field.label}
              </div>
            </label>
            <div className="relative">
              <input
                type={field.type}
                value={field.value || ''}
                onChange={(e) => field.onChange(e.target.value)}
                placeholder={field.placeholder}
                className={classNames(
                  baseInputClasses,
                  field.icon ? "pl-10" : "pl-3",
                  "pr-3 py-2.5"
                )}
              />
              {field.type === 'text' && (
                <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={field.key} className={getFieldWidth(field.width)}>
            <label className={labelClasses}>
              <div className="flex items-center gap-2">
                {field.icon}
                {field.label}
              </div>
            </label>
            <div className="relative">
              <select
                value={field.value || ''}
                onChange={(e) => field.onChange(e.target.value)}
                className={classNames(
                  baseInputClasses,
                  "pl-3 pr-10 py-2.5 appearance-none cursor-pointer"
                )}
              >
                <option value="">{field.placeholder || `All ${field.label}`}</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        );

      case 'multiselect':
        return (
          <div key={field.key} className={getFieldWidth(field.width)}>
            <label className={labelClasses}>
              <div className="flex items-center gap-2">
                {field.icon}
                {field.label}
              </div>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setExpandedMultiselect(
                  expandedMultiselect === field.key ? null : field.key
                )}
                className={classNames(
                  baseInputClasses,
                  "pl-3 pr-10 py-2.5 text-left cursor-pointer",
                  "flex items-center justify-between"
                )}
              >
                <span className={field.value?.length ? "text-gray-900 dark:text-white" : "text-gray-400"}>
                  {field.value?.length 
                    ? `${field.value.length} selected`
                    : field.placeholder || `Select ${field.label}`
                  }
                </span>
                <ChevronDownIcon className={classNames(
                  "h-4 w-4 transition-transform duration-200",
                  expandedMultiselect === field.key ? "rotate-180" : ""
                )} />
              </button>
              
              {expandedMultiselect === field.key && (
                <div className={classNames(
                  "absolute z-50 mt-1 w-full rounded-lg shadow-lg border",
                  "max-h-60 overflow-auto",
                  darkMode 
                    ? "bg-gray-800 border-gray-600" 
                    : "bg-white border-gray-300"
                )}>
                  {field.options?.map((option) => (
                    <label
                      key={option.value}
                      className={classNames(
                        "flex items-center px-3 py-2 cursor-pointer",
                        "hover:bg-gray-100 dark:hover:bg-gray-700",
                        "first:rounded-t-lg last:rounded-b-lg"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={field.value?.includes(option.value) || false}
                        onChange={(e) => {
                          const currentValues = field.value || [];
                          if (e.target.checked) {
                            field.onChange([...currentValues, option.value]);
                          } else {
                            field.onChange(currentValues.filter((v: string) => v !== option.value));
                          }
                        }}
                        className="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2">
                        {option.icon}
                        <span className={darkMode ? "text-white" : "text-gray-900"}>
                          {option.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'date':
        return (
          <div key={field.key} className={getFieldWidth(field.width)}>
            <label className={labelClasses}>
              <div className="flex items-center gap-2">
                {field.icon}
                {field.label}
              </div>
            </label>
            <input
              type="date"
              value={field.value || ''}
              onChange={(e) => field.onChange(e.target.value)}
              className={classNames(baseInputClasses, "pl-3 pr-3 py-2.5")}
            />
          </div>
        );

      case 'daterange':
        return (
          <div key={field.key} className={getFieldWidth(field.width || 'md')}>
            <label className={labelClasses}>
              <div className="flex items-center gap-2">
                {field.icon}
                {field.label}
              </div>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={field.value?.start || ''}
                onChange={(e) => field.onChange({ ...field.value, start: e.target.value })}
                placeholder="Start date"
                className={classNames(baseInputClasses, "pl-3 pr-3 py-2.5")}
              />
              <input
                type="date"
                value={field.value?.end || ''}
                onChange={(e) => field.onChange({ ...field.value, end: e.target.value })}
                placeholder="End date"
                className={classNames(baseInputClasses, "pl-3 pr-3 py-2.5")}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={classNames(
      "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className={classNames(
            "p-2 rounded-lg",
            darkMode ? "bg-gray-800" : "bg-gray-100"
          )}>
            <FunnelIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h3 className={classNames(
              "text-lg font-semibold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Filters & Search
            </h3>
            {showActiveCount && activeFilters > 0 && (
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {activeFilters} filter{activeFilters !== 1 ? 's' : ''} active
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Clear all button */}
          {activeFilters > 0 && onClearAll && (
            <button
              onClick={onClearAll}
              className={classNames(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg",
                "border border-gray-300 dark:border-gray-600",
                "text-gray-700 dark:text-gray-300",
                "hover:bg-gray-50 dark:hover:bg-gray-800",
                "transition-colors duration-200"
              )}
            >
              <XMarkIcon className="h-4 w-4" />
              Clear All
            </button>
          )}

          {/* Collapse/Expand button */}
          {collapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={classNames(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg",
                "text-gray-700 dark:text-gray-300",
                "hover:bg-gray-100 dark:hover:bg-gray-800",
                "transition-colors duration-200"
              )}
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4" />
              {isCollapsed ? 'Show' : 'Hide'}
            </button>
          )}
        </div>
      </div>

      {/* Filter Fields */}
      {!isCollapsed && (
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {fields.map(renderField)}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSystem;