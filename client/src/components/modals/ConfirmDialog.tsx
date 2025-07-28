import React from 'react';
import { XMarkIcon, ExclamationTriangleIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info' | 'success';
  loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  loading = false
}) => {
  const { darkMode } = useTheme();

  if (!isOpen) return null;

  const typeConfig = {
    warning: {
      icon: ExclamationTriangleIcon,
      iconColor: darkMode ? 'text-yellow-400' : 'text-yellow-600',
      iconBg: darkMode ? 'bg-yellow-900/20' : 'bg-yellow-100',
      buttonColor: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
    },
    danger: {
      icon: ExclamationTriangleIcon,
      iconColor: darkMode ? 'text-red-400' : 'text-red-600',
      iconBg: darkMode ? 'bg-red-900/20' : 'bg-red-100',
      buttonColor: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    },
    info: {
      icon: ExclamationTriangleIcon,
      iconColor: darkMode ? 'text-blue-400' : 'text-blue-600',
      iconBg: darkMode ? 'bg-blue-900/20' : 'bg-blue-100',
      buttonColor: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    },
    success: {
      icon: CheckIcon,
      iconColor: darkMode ? 'text-green-400' : 'text-green-600',
      iconBg: darkMode ? 'bg-green-900/20' : 'bg-green-100',
      buttonColor: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
    }
  };

  const config = typeConfig[type];
  const IconComponent = config.icon;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className={classNames(
          "inline-block align-bottom rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full",
          "animate-in slide-in-from-bottom-4 duration-300",
          darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"
        )}>
          {/* Header */}
          <div className={classNames(
            "px-6 py-4 border-b",
            darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={classNames("p-2 rounded-full", config.iconBg)}>
                  <IconComponent className={classNames("h-6 w-6", config.iconColor)} />
                </div>
                <div>
                  <h3 className={classNames(
                    "text-lg font-semibold",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    {title}
                  </h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className={classNames(
                  "p-2 rounded-lg transition-colors",
                  darkMode ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"
                )}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className={classNames(
            "px-6 py-4",
            darkMode ? "bg-gray-800" : "bg-white"
          )}>
            <p className={classNames(
              "text-sm",
              darkMode ? "text-gray-300" : "text-gray-600"
            )}>
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className={classNames(
            "px-6 py-4 flex justify-end space-x-3",
            darkMode ? "bg-gray-800" : "bg-gray-50"
          )}>
            <button
              onClick={onClose}
              disabled={loading}
              className={classNames(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                darkMode 
                  ? "text-gray-300 hover:bg-gray-700 disabled:opacity-50" 
                  : "text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              )}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={classNames(
                "inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                config.buttonColor,
                "focus:ring-2 focus:ring-offset-2",
                darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
              )}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog; 