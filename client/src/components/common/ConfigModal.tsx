import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ActionButton from './ActionButton';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  className?: string;
}

const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  children,
  actions,
  loading = false,
  loadingText = 'Loading...',
  maxWidth = '4xl',
  className = ''
}) => {
  const { darkMode } = useTheme();

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        {/* Backdrop */}
        <div className={classNames(
          "fixed inset-0 backdrop-blur-sm",
          darkMode ? "bg-gray-900/90" : "bg-black/75"
        )} />
        
        {/* Modal Content */}
        <div className="relative">
          <div className={classNames(
            "w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-xl transition-all duration-200",
            maxWidthClasses[maxWidth],
            darkMode ? "bg-gray-800" : "bg-white",
            className
          )}>
            {/* Header */}
            <div className={classNames(
              "flex items-start justify-between p-6 border-b",
              darkMode ? "border-gray-700" : "border-gray-200"
            )}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  {icon && (
                    <span className="text-2xl mr-3 flex-shrink-0">{icon}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className={classNames(
                      "text-2xl font-bold truncate",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>
                      {title}
                    </h2>
                    {description && (
                      <p className={classNames(
                        "text-sm mt-1",
                        darkMode ? "text-gray-400" : "text-gray-600"
                      )}>
                        {description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className={classNames(
                  "ml-4 p-2 rounded-lg transition-colors flex-shrink-0",
                  darkMode 
                    ? "hover:bg-gray-700 text-gray-400 hover:text-gray-200" 
                    : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                )}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
                  <span className={classNames(
                    "text-lg",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    {loadingText}
                  </span>
                </div>
              ) : (
                children
              )}
            </div>

            {/* Actions */}
            {actions && !loading && (
              <div className={classNames(
                "flex items-center justify-end space-x-3 px-6 py-4 border-t",
                darkMode ? "border-gray-700 bg-gray-750" : "border-gray-200 bg-gray-50"
              )}>
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Default action buttons for common use cases
export const ModalActions = {
  SaveCancel: ({ 
    onSave, 
    onCancel, 
    saving = false, 
    saveText = 'Save',
    cancelText = 'Cancel',
    saveIcon
  }: {
    onSave: () => void;
    onCancel: () => void;
    saving?: boolean;
    saveText?: string;
    cancelText?: string;
    saveIcon?: React.ComponentType<any>;
  }) => (
    <>
      <ActionButton
        variant="outline"
        onClick={onCancel}
        disabled={saving}
      >
        {cancelText}
      </ActionButton>
      <ActionButton
        variant="primary"
        onClick={onSave}
        loading={saving}
        icon={saveIcon}
      >
        {saving ? 'Saving...' : saveText}
      </ActionButton>
    </>
  ),

  TestSaveCancel: ({
    onTest,
    onSave,
    onCancel,
    testing = false,
    saving = false,
    testText = 'Test',
    saveText = 'Save',
    cancelText = 'Cancel',
    testIcon,
    saveIcon
  }: {
    onTest: () => void;
    onSave: () => void;
    onCancel: () => void;
    testing?: boolean;
    saving?: boolean;
    testText?: string;
    saveText?: string;
    cancelText?: string;
    testIcon?: React.ComponentType<any>;
    saveIcon?: React.ComponentType<any>;
  }) => (
    <>
      <ActionButton
        variant="outline"
        onClick={onTest}
        loading={testing}
        icon={testIcon}
        disabled={saving}
      >
        {testing ? 'Testing...' : testText}
      </ActionButton>
      <div className="flex space-x-3">
        <ActionButton
          variant="outline"
          onClick={onCancel}
          disabled={saving || testing}
        >
          {cancelText}
        </ActionButton>
        <ActionButton
          variant="primary"
          onClick={onSave}
          loading={saving}
          icon={saveIcon}
          disabled={testing}
        >
          {saving ? 'Saving...' : saveText}
        </ActionButton>
      </div>
    </>
  )
};

export default ConfigModal;