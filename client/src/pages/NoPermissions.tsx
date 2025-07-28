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
      "min-h-screen overflow-y-scroll",
      darkMode ? "bg-gray-900" : "bg-gray-50"
    )} style={{ height: '100vh' }}>
      <div className="py-12 px-6">
        <div className={classNames(
          "max-w-2xl mx-auto rounded-2xl shadow-2xl border-0",
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

          {/* Content Section - Now fully scrollable */}
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
                    'view_logs',
                    'system_admin',
                    'manage_users',
                    'manage_tickets',
                    'manage_warnings',
                    'moderate_users',
                    'manage_roles'
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
                      or for specific permission:
                    </div>
                    <div>/dashboard-perms grant-perm user:@{user?.username} permission:view_dashboard</div>
                  </div>
                </div>
              </div>

              {/* Available Permission Levels */}
              <div className={classNames(
                "p-6 rounded-xl border-2",
                darkMode ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
              )}>
                <h3 className={classNames(
                  "text-lg font-semibold mb-3",
                  darkMode ? "text-green-400" : "text-green-800"
                )}>
                  Available Permission Levels
                </h3>
                <div className="space-y-3">
                  <div className={classNames("p-3 rounded-lg", darkMode ? "bg-gray-700" : "bg-white")}>
                    <div className="font-semibold text-purple-500">Owner</div>
                    <div className={classNames("text-sm", darkMode ? "text-gray-300" : "text-gray-600")}>Full access to all features</div>
                  </div>
                  <div className={classNames("p-3 rounded-lg", darkMode ? "bg-gray-700" : "bg-white")}>
                    <div className="font-semibold text-red-500">Admin</div>
                    <div className={classNames("text-sm", darkMode ? "text-gray-300" : "text-gray-600")}>Most administrative features</div>
                  </div>
                  <div className={classNames("p-3 rounded-lg", darkMode ? "bg-gray-700" : "bg-white")}>
                    <div className="font-semibold text-yellow-500">Moderator</div>
                    <div className={classNames("text-sm", darkMode ? "text-gray-300" : "text-gray-600")}>Moderation and ticket management</div>
                  </div>
                  <div className={classNames("p-3 rounded-lg", darkMode ? "bg-gray-700" : "bg-white")}>
                    <div className="font-semibold text-blue-500">Support</div>
                    <div className={classNames("text-sm", darkMode ? "text-gray-300" : "text-gray-600")}>View tickets and warnings</div>
                  </div>
                  <div className={classNames("p-3 rounded-lg", darkMode ? "bg-gray-700" : "bg-white")}>
                    <div className="font-semibold text-green-500">Viewer</div>
                    <div className={classNames("text-sm", darkMode ? "text-gray-300" : "text-gray-600")}>Basic dashboard access</div>
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
                    <span>User ID:</span>
                    <span className="font-mono">{user?.id}</span>
                  </div>
                  <div className={classNames(
                    "flex justify-between",
                    darkMode ? "text-gray-300" : "text-gray-600"
                  )}>
                    <span>Username:</span>
                    <span>{user?.username}</span>
                  </div>
                  <div className={classNames(
                    "flex justify-between",
                    darkMode ? "text-gray-300" : "text-gray-600"
                  )}>
                    <span>Dashboard Access:</span>
                    <span className="text-red-500 font-semibold">❌ Denied</span>
                  </div>
                </div>
              </div>

              {/* Need Help Section */}
              <div className={classNames(
                "p-6 rounded-xl border-2",
                darkMode ? "bg-yellow-900/20 border-yellow-700" : "bg-yellow-50 border-yellow-200"
              )}>
                <h3 className={classNames(
                  "text-lg font-semibold mb-3",
                  darkMode ? "text-yellow-400" : "text-yellow-800"
                )}>
                  Need Help?
                </h3>
                <div className="space-y-3 text-sm">
                  <div className={classNames(
                    darkMode ? "text-yellow-300" : "text-yellow-700"
                  )}>
                    <strong>1. Contact Server Admin:</strong> Ask a server administrator to grant you permissions
                  </div>
                  <div className={classNames(
                    darkMode ? "text-yellow-300" : "text-yellow-700"
                  )}>
                    <strong>2. Check Your Role:</strong> Make sure you have the appropriate server role
                  </div>
                  <div className={classNames(
                    darkMode ? "text-yellow-300" : "text-yellow-700"
                  )}>
                    <strong>3. Wait for Processing:</strong> Permission changes may take a few minutes to take effect
                  </div>
                  <div className={classNames(
                    darkMode ? "text-yellow-300" : "text-yellow-700"
                  )}>
                    <strong>4. Refresh Page:</strong> Try refreshing this page after permissions are granted
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={() => window.location.reload()}
                  className={classNames(
                    "flex-1 px-6 py-3 rounded-lg font-medium transition-colors",
                    darkMode 
                      ? "bg-blue-600 hover:bg-blue-700 text-white" 
                      : "bg-blue-500 hover:bg-blue-600 text-white"
                  )}
                >
                  🔄 Refresh Page
                </button>
                <button
                  onClick={logout}
                  className={classNames(
                    "flex-1 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center",
                    darkMode 
                      ? "bg-gray-600 hover:bg-gray-700 text-gray-200" 
                      : "bg-gray-500 hover:bg-gray-600 text-white"
                  )}
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoPermissions; 