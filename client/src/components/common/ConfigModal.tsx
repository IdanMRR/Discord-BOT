import React, { Fragment, memo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useTheme } from '../../contexts/ThemeContext';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ActionButton from './ActionButton';

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

const ConfigModal: React.FC<ConfigModalProps> = memo(({
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

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className={classNames(
            "fixed inset-0 bg-black/60 backdrop-blur-sm",
            darkMode ? "bg-gray-900/80" : "bg-black/50"
          )} />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={classNames(
                "w-full max-h-[85vh] overflow-y-auto rounded-xl shadow-xl transition-all",
                maxWidthClasses[maxWidth],
                "content-area",
                className
              )}>
                {/* Header */}
                <div className={classNames(
                  "flex items-center justify-between p-4 border-b",
                  darkMode ? "border-gray-700" : "border-gray-200"
                )}>
                  <div className="flex items-center">
                    {icon && (
                      <span className="text-xl mr-2 flex-shrink-0">{icon}</span>
                    )}
                    <div>
                      <Dialog.Title className={classNames(
                        "text-lg font-semibold",
                        darkMode ? "text-white" : "text-gray-900"
                      )}>
                        {title}
                      </Dialog.Title>
                      {description && (
                        <p className={classNames(
                          "text-xs mt-0.5",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          {description}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className={classNames(
                      "p-1.5 rounded-md transition-colors",
                      darkMode 
                        ? "hover:bg-gray-700 text-gray-400 hover:text-gray-200" 
                        : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-3"></div>
                    <span className={classNames(
                      "text-sm",
                      darkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      {loadingText}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Body */}
                    <div className="p-4">
                      {children}
                    </div>

                    {/* Actions */}
                    {actions && (
                      <div className={classNames(
                        "flex justify-end p-4 border-t space-x-2",
                        darkMode ? "border-gray-700" : "border-gray-200"
                      )}>
                        {actions}
                      </div>
                    )}
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
});

ConfigModal.displayName = 'ConfigModal';

export default ConfigModal;

// Default action buttons for common use cases
export const ModalActions = {
  SaveCancel: ({ 
    onSave, 
    onCancel, 
    saving = false, 
    saveText = 'Save', 
    cancelText = 'Cancel', 
    saveIcon,
    testing = false
  }: {
    onSave: () => void;
    onCancel: () => void;
    saving?: boolean;
    saveText?: string;
    cancelText?: string;
    saveIcon?: React.ComponentType<any>;
    testing?: boolean;
  }) => (
    <>
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
  ),
};