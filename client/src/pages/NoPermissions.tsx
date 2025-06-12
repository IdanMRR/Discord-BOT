import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  ShieldExclamationIcon,
  CommandLineIcon,
  UserGroupIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const NoPermissions: React.FC = () => {
  const { darkMode } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div className={classNames(
      "min-h-screen flex items-center justify-center p-6",
      darkMode ? "bg-gray-900" : "bg-gray-50"
    )}>
      <div className={classNames(
        "max-w-2xl w-full rounded-2xl shadow-2xl border-0 overflow-hidden",
        darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
      )}>
        {/* Header Section */}
        <div className={classNames(
          "px-8 py-12 text-center border-b",
          darkMode ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"
        )}>
          <div className={classNames(
            "mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6",
            darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"
          )}>
            <ShieldExclamationIcon className="w-10 h-10" />
          </div>
          
          <h1 className={classNames(
            "text-3xl font-bold mb-4",
            darkMode ? "text-red-400" : "text-red-600"
          )}>
            🚫 Access Denied
          </h1>
          
          <p className={classNames(
            "text-xl mb-2",
            darkMode ? "text-gray-300" : "text-gray-600"
          )}>
            Welcome, <span className="font-semibold text-blue-500">{user?.username}</span>!
          </p>
          
          <p className={classNames(
            "text-lg",
            darkMode ? "text-gray-400" : "text-gray-500"
          )}>
            You don't have permission to access this dashboard.
          </p>
        </div>

        {/* Content Section */}
        <div className="px-8 py-8">
          <div className="space-y-6">
            {/* Permission Info */}
            <div className={classNames(
              "p-6 rounded-xl border-2",
              darkMode ? "bg-gray-700/30 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <h3 className={classNames(
                "text-lg font-semibold mb-3 flex items-center",
                darkMode ? "text-gray-200" : "text-gray-800"
              )}>
                <UserGroupIcon className="w-5 h-5 mr-2" />
                Required Permissions
              </h3>
              <p className={classNames(
                "text-sm mb-4",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                To access this dashboard, you need one of the following permissions:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'view_dashboard',
                  'admin',
                  'manage_settings',
                  'view_tickets',
                  'view_warnings',
                  'view_logs'
                ].map((permission) => (
                  <div key={permission} className={classNames(
                    "px-3 py-2 rounded-lg text-sm font-mono",
                    darkMode ? "bg-gray-600 text-gray-300" : "bg-gray-200 text-gray-700"
                  )}>
                    {permission}
                  </div>
                ))}
              </div>
            </div>

            {/* How to Get Access */}
            <div className={classNames(
              "p-6 rounded-xl border-2",
              darkMode ? "bg-blue-900/20 border-blue-700" : "bg-blue-50 border-blue-200"
            )}>
              <h3 className={classNames(
                "text-lg font-semibold mb-3 flex items-center",
                darkMode ? "text-blue-400" : "text-blue-800"
              )}>
                <CommandLineIcon className="w-5 h-5 mr-2" />
                How to Get Access
              </h3>
              <p className={classNames(
                "text-sm mb-4",
                darkMode ? "text-blue-300" : "text-blue-700"
              )}>
                Contact a server administrator and ask them to grant you permissions using this Discord command:
              </p>
              <div className={classNames(
                "p-4 rounded-lg font-mono text-sm",
                darkMode ? "bg-gray-800 text-green-400" : "bg-gray-100 text-gray-800"
              )}>
                <div className="space-y-2">
                  <div>/dashboard-perms grant user:@{user?.username} level:viewer</div>
                  <div className={classNames(
                    "text-xs",
                    darkMode ? "text-gray-400" : "text-gray-500"
                  )}>
                    or
                  </div>
                  <div>/dashboard-perms grant user:@{user?.username} permission:view_dashboard</div>
                </div>
              </div>
            </div>

            {/* Current Status */}
            <div className={classNames(
              "p-6 rounded-xl border-2",
              darkMode ? "bg-gray-700/30 border-gray-600" : "bg-gray-50 border-gray-200"
            )}>
              <h3 className={classNames(
                "text-lg font-semibold mb-3",
                darkMode ? "text-gray-200" : "text-gray-800"
              )}>
                Your Current Status
              </h3>
              <div className="space-y-2 text-sm">
                <div className={classNames(
                  "flex justify-between",
                  darkMode ? "text-gray-300" : "text-gray-600"
                )}>
                  <span>Discord Username:</span>
                  <span className="font-mono text-blue-500">{user?.username}#{user?.discriminator}</span>
                </div>
                <div className={classNames(
                  "flex justify-between",
                  darkMode ? "text-gray-300" : "text-gray-600"
                )}>
                  <span>User ID:</span>
                  <span className="font-mono text-gray-500">{user?.id}</span>
                </div>
                <div className={classNames(
                  "flex justify-between",
                  darkMode ? "text-gray-300" : "text-gray-600"
                )}>
                  <span>Dashboard Permissions:</span>
                  <span className={classNames(
                    "font-semibold",
                    darkMode ? "text-red-400" : "text-red-600"
                  )}>
                    {user?.permissions?.length && user.permissions.length > 0 ? user.permissions.join(', ') : 'None'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex justify-center space-x-4">
            <button
              onClick={() => window.location.reload()}
              className={classNames(
                "inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105",
                "text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
              )}
            >
              🔄 Refresh
            </button>
            <button
              onClick={logout}
              className={classNames(
                "inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105",
                darkMode 
                  ? "text-gray-300 bg-gray-700 hover:bg-gray-600" 
                  : "text-gray-700 bg-gray-200 hover:bg-gray-300"
              )}
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoPermissions; 