import React, { useState, Fragment } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';
import { useTheme } from '../../contexts/ThemeContext';

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface DMModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  member: {
    id: string;
    displayName: string;
    username: string;
    discriminator: string;
    avatar: string | null;
  } | null;
  loading: boolean;
}

const DMModal: React.FC<DMModalProps> = ({
  isOpen,
  onClose,
  onSend,
  member,
  loading
}) => {
  const { darkMode } = useTheme();
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const getAvatarUrl = () => {
    if (!member) return '';
    if (member.avatar) {
      return `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png?size=128`;
    }
    return `https://cdn.discordapp.com/embed/avatars/${parseInt(member.discriminator) % 5}.png`;
  };

  if (!member) return null;

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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                "w-full max-w-3xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all border",
                "content-area backdrop-blur-lg"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className={classNames(
                "w-16 h-16 rounded-full flex items-center justify-center mr-6",
                darkMode ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-600"
              )}>
                <span className="text-3xl">💬</span>
              </div>
              <div>
                <h3 className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-gray-100" : "text-gray-900"
                )}>
                  Send Direct Message
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Message will be sent as official server staff
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={classNames(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200",
                darkMode 
                  ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              )}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Member info */}
          <div className={classNames(
            "p-6 rounded-xl mb-6",
            darkMode ? "bg-gray-700/30" : "bg-gray-50"
          )}>
            <div className="flex items-center space-x-4">
              <img
                src={getAvatarUrl()}
                alt={member.displayName}
                className="w-16 h-16 rounded-full ring-4 ring-purple-500/20"
              />
              <div>
                <h4 className={classNames(
                  "text-xl font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {member.displayName}
                </h4>
                <p className={classNames(
                  "text-sm",
                  darkMode ? "text-gray-400" : "text-gray-500"
                )}>
                  @{member.username}#{member.discriminator}
                </p>
                <p className={classNames(
                  "text-xs mt-1",
                  darkMode ? "text-gray-500" : "text-gray-400"
                )}>
                  ID: {member.id}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className={classNames(
            "p-6 rounded-xl mb-6",
            darkMode ? "bg-gray-700/30" : "bg-gray-50"
          )}>
            <p className={classNames(
              "text-base leading-relaxed mb-6",
              darkMode ? "text-gray-300" : "text-gray-700"
            )}>
              Compose your direct message below. This message will be sent privately to the member with your server's official branding.
            </p>

            <div className="space-y-4">
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Message Content
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={6}
                  maxLength={2000}
                  className={classNames(
                    "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  )}
                  disabled={loading}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className={classNames(
                    "text-xs",
                    darkMode ? "text-gray-400" : "text-gray-500"
                  )}>
                    {message.length}/2000 characters
                  </p>
                  <div className={classNames(
                    "text-xs px-2 py-1 rounded-full",
                    message.length > 1800 
                      ? (darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600")
                      : message.length > 1500
                        ? (darkMode ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-600")
                        : (darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-600")
                  )}>
                    {message.length > 1800 ? "Almost full" : message.length > 1500 ? "Getting long" : "Good length"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
            <button
              onClick={onClose}
              disabled={loading}
              className={classNames(
                "flex-1 px-8 py-4 border-2 text-base font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-gray-500/30",
                darkMode 
                  ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500 disabled:opacity-50" 
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50"
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={loading || !message.trim() || message.length > 2000}
              className={classNames(
                "flex-1 px-8 py-4 border border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
                loading || !message.trim() || message.length > 2000
                  ? "bg-gray-400 text-white cursor-not-allowed" 
                  : "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white focus:ring-purple-500/30"
              )}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending...
                </>
              ) : (
                '💬 Send Message'
              )}
            </button>
          </div>
                </Dialog.Panel>
              </Transition.Child>
        </div>
      </div>
        </Dialog>
      </Transition>
  );
};

export default DMModal; 