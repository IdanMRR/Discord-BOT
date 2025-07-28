import React from 'react';
import { Link } from 'react-router-dom';
import { 
  UsersIcon, 
  EyeIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';
import { Server } from '../../types';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface ServerCardProps {
  server: Server;
  onViewDetails: (e: React.MouseEvent, serverId: string, serverName: string) => void;
  onLoginConfig: (e: React.MouseEvent, serverId: string, serverName: string) => void;
}

const ServerCard: React.FC<ServerCardProps> = ({ 
  server, 
  onViewDetails, 
  onLoginConfig 
}) => {
  const { darkMode } = useTheme();

  // Theme-aware classes
  const cardClasses = classNames(
    "relative p-6 rounded-lg border transition-colors",
    darkMode 
      ? "border-gray-700 bg-gray-800 hover:border-gray-600" 
      : "border-gray-200 bg-white hover:border-gray-300"
  );

  const textPrimaryClasses = darkMode ? "text-white" : "text-gray-900";
  const textSecondaryClasses = darkMode ? "text-gray-400" : "text-gray-500";

  const avatarFallbackClasses = classNames(
    "w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold",
    darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
  );

  const ownerBadgeClasses = classNames(
    "w-4 h-4 rounded-full flex items-center justify-center text-xs",
    darkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-600"
  );

  const primaryButtonClasses = classNames(
    "flex-1 px-3 py-2 rounded-lg text-center text-sm font-medium transition-colors",
    darkMode ? "bg-primary-600 text-white hover:bg-primary-700" : "bg-primary-600 text-white hover:bg-primary-700"
  );

  const secondaryButtonClasses = classNames(
    "flex-1 px-3 py-2 rounded-lg text-center text-sm font-medium transition-colors",
    darkMode ? "bg-gray-600 text-white hover:bg-gray-700" : "bg-gray-600 text-white hover:bg-gray-700"
  );

  return (
    <Link 
      to={`/servers/${server.id}`}
      className="block group"
    >
      <div className={cardClasses}>
        {/* Content */}
        <div className="relative">
          <div className="flex items-center space-x-4 mb-4">
            <div className="relative">
              {server.icon ? (
                <img 
                  src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`} 
                  alt={server.name} 
                  className="w-12 h-12 rounded-lg"
                />
              ) : (
                <div className={avatarFallbackClasses}>
                  {server.name.substring(0, 1).toUpperCase()}
                </div>
              )}
              {/* Online indicator */}
              <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className={classNames("font-semibold text-base truncate", textPrimaryClasses)}>
                {server.name}
              </h4>
              <div className="flex items-center space-x-2 mt-1">
                <UsersIcon className={classNames("h-4 w-4", textSecondaryClasses)} />
                <p className={classNames("text-sm", textSecondaryClasses)}>
                  {server.memberCount > 0 ? `${server.memberCount.toLocaleString()} members` : 'Member count unavailable'}
                </p>
              </div>
              
              {/* Owner Information */}
              {server.owner && (
                <div className="flex items-center space-x-2 mt-2">
                  <div className={ownerBadgeClasses}>★</div>
                  <p className={classNames("text-xs", darkMode ? "text-yellow-400" : "text-yellow-600")}>
                    Owner: {server.owner.displayName || server.owner.username}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex space-x-2">
            <button
              onClick={(e) => onViewDetails(e, server.id, server.name)}
              className={primaryButtonClasses}
            >
              <EyeIcon className="h-4 w-4 inline mr-1" />
              View Details
            </button>
            <button
              onClick={(e) => onLoginConfig(e, server.id, server.name)}
              className={secondaryButtonClasses}
            >
              <CogIcon className="h-4 w-4 inline mr-1" />
              Login Config
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ServerCard;