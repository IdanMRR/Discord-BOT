import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { TrashIcon } from '@heroicons/react/24/outline';

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface CompactFieldProps {
  index: number;
  field: {
    name: string;
    value: string;
    inline?: boolean;
  };
  onUpdate: (index: number, field: any) => void;
  onRemove: (index: number) => void;
  showRemove?: boolean;
}

const CompactField: React.FC<CompactFieldProps> = ({
  index,
  field,
  onUpdate,
  onRemove,
  showRemove = true
}) => {
  const { darkMode } = useTheme();

  return (
    <div className={classNames(
      "p-4 rounded-lg border transition-all duration-200 hover:shadow-md",
      darkMode ? "bg-gray-700/50 border-gray-600 hover:border-gray-500" : "bg-gray-50 border-gray-200 hover:border-gray-300"
    )}>
      <div className="space-y-3">
        {/* Header with remove button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={classNames(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              darkMode ? "bg-gray-600 text-gray-300" : "bg-gray-200 text-gray-600"
            )}>
              {index + 1}
            </div>
            <span className={classNames(
              "text-sm font-medium",
              darkMode ? "text-gray-200" : "text-gray-800"
            )}>
              Embed Field
            </span>
          </div>
          {showRemove && (
            <button
              onClick={() => onRemove(index)}
              className={classNames(
                "p-1.5 rounded-md transition-colors group",
                darkMode 
                  ? "text-gray-400 hover:text-red-400 hover:bg-red-900/20" 
                  : "text-gray-500 hover:text-red-600 hover:bg-red-50"
              )}
              title="Remove field"
            >
              <TrashIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>

        {/* Field inputs with better styling */}
        <div className="space-y-3">
          <div>
            <label className={classNames(
              "block text-xs font-medium mb-1",
              darkMode ? "text-gray-300" : "text-gray-700"
            )}>
              Field Name
            </label>
            <input
              type="text"
              value={field.name}
              onChange={(e) => onUpdate(index, { ...field, name: e.target.value })}
              placeholder="e.g., 📋 Rules, ❓ FAQ, 🎆 Benefits"
              className={classNames(
                "w-full px-3 py-2 rounded-md border text-sm transition-all duration-200",
                darkMode 
                  ? "bg-gray-600 border-gray-500 text-white placeholder-gray-400 focus:bg-gray-550" 
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:bg-gray-50",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              )}
            />
          </div>
          <div>
            <label className={classNames(
              "block text-xs font-medium mb-1",
              darkMode ? "text-gray-300" : "text-gray-700"
            )}>
              Field Value
            </label>
            <textarea
              value={field.value}
              onChange={(e) => onUpdate(index, { ...field, value: e.target.value })}
              placeholder="Enter the field content here...&#10;You can use multiple lines"
              rows={3}
              className={classNames(
                "w-full px-3 py-2 rounded-md border text-sm transition-all duration-200 resize-none",
                darkMode 
                  ? "bg-gray-600 border-gray-500 text-white placeholder-gray-400 focus:bg-gray-550" 
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:bg-gray-50",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              )}
            />
          </div>
        </div>

        {/* Inline checkbox with better styling */}
        <div className={classNames(
          "flex items-center p-2 rounded-md",
          darkMode ? "bg-gray-600/30" : "bg-gray-100/50"
        )}>
          <input
            type="checkbox"
            checked={field.inline || false}
            onChange={(e) => onUpdate(index, { ...field, inline: e.target.checked })}
            className={classNames(
              "mr-3 h-4 w-4 rounded border-2 transition-colors",
              "text-blue-600 focus:ring-blue-500 focus:ring-offset-0",
              darkMode ? "border-gray-500 bg-gray-600" : "border-gray-300 bg-white"
            )}
          />
          <div>
            <span className={classNames(
              "text-sm font-medium",
              darkMode ? "text-gray-200" : "text-gray-800"
            )}>
              Display inline
            </span>
            <p className={classNames(
              "text-xs mt-0.5",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              Inline fields appear side by side (up to 3 per row)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompactField;