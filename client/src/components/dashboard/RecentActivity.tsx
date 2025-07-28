import React from 'react';
import { ActivityLog } from '../../types';
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import { useTheme } from '../../contexts/ThemeContext';
import { ClockIcon } from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface RecentActivityProps {
  activities: ActivityLog[];
  loading?: boolean;
}

const RecentActivity: React.FC<RecentActivityProps> = ({ activities, loading = false }) => {
  const { darkMode } = useTheme();
  
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ticket_created':
        return '🎫';
      case 'ticket_closed':
        return '✅';
      case 'warning_issued':
      case 'warning':
        return '⚠️';
      case 'warning_removed':
        return '🗑️';
      case 'user_joined':
        return '👋';
      case 'user_left':
        return '👋';
      case 'command_used':
        return '⚡';
      default:
        return '📝';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'ticket_created':
        return darkMode ? 'text-blue-400' : 'text-blue-600';
      case 'ticket_closed':
        return darkMode ? 'text-green-400' : 'text-green-600';
      case 'warning_issued':
      case 'warning':
        return darkMode ? 'text-red-400' : 'text-red-600';
      case 'warning_removed':
        return darkMode ? 'text-gray-400' : 'text-gray-600';
      case 'user_joined':
        return darkMode ? 'text-green-400' : 'text-green-600';
      case 'user_left':
        return darkMode ? 'text-gray-400' : 'text-gray-600';
      case 'command_used':
        return darkMode ? 'text-purple-400' : 'text-purple-600';
      default:
        return darkMode ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const israeliDate = new Date(date.getTime() + (3 * 60 * 60 * 1000)); // Add 3 hours for Jerusalem timezone
    const now = new Date();
    const israeliNow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    
    const diffInMinutes = Math.floor((israeliNow.getTime() - israeliDate.getTime()) / (1000 * 60));
    
    // For very recent activities, show relative time
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    
    // For anything over 24 hours, show full date and time in Jerusalem timezone
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jerusalem'
    };
    
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  };

  const formatDescription = (description: string, type: string, activity?: ActivityLog) => {
    // Handle different activity types with better formatting
    switch (type) {
      case 'warning_issued':
      case 'warning': {
        // Check for case number in activity metadata or description
        const caseMatch = description.match(/Case #(\d+)/i) || description.match(/#(\d+)/);
        const caseNumber = caseMatch ? caseMatch[1] : null;
        
        // If the description already starts with "Warning issued", use it as-is
        if (description.toLowerCase().startsWith('warning issued')) {
          return (
            <span className={getActivityColor(type)}>
              {description}
            </span>
          );
        }
        
        // Parse warning format: "Warns (admin) warns (user) reason" or simpler formats
        const warnMatch = description.match(/Warns \(([^)]+)\) warns \(([^)]+)\) (.+)/);
        
        if (warnMatch) {
          const [, adminName, targetName, reason] = warnMatch;
          return (
            <span className={getActivityColor(type)}>
              <span className="font-semibold">
                {caseNumber ? `Warning Case #${caseNumber}` : 'Warning issued'}
              </span> to{' '}
              <span className={classNames("font-medium", darkMode ? "text-blue-400" : "text-blue-600")}>
                {targetName}
              </span>{' '}
              by{' '}
              <span className={classNames("font-medium", darkMode ? "text-purple-400" : "text-purple-600")}>
                {adminName}
              </span>
              {reason && (
                <>
                  <br />
                  <span className="text-sm opacity-80">Reason: {reason}</span>
                </>
              )}
            </span>
          );
        } else {
          // Fallback for other warning formats
          return (
            <span className={getActivityColor(type)}>
              <span className="font-semibold">
                {caseNumber ? `Warning Case #${caseNumber}` : 'Warning issued'}
              </span>
              {description.includes('Warns') ? 
                <span className="ml-1">{description.replace('Warns', '').replace(/Case #\d+/i, '').trim()}</span> : 
                <span className="ml-1">{description.replace(/Case #\d+/i, '').trim()}</span>
              }
            </span>
          );
        }
      }
      
      case 'warning_removed': {
        // Check for case number in description
        const caseMatch = description.match(/Case #(\d+)/i) || description.match(/#(\d+)/);
        const caseNumber = caseMatch ? caseMatch[1] : null;
        
        // Handle warning removal
        const removalText = description.replace(/^Warning removed:?\s*/i, '').replace(/Case #\d+/i, '').trim();
        return (
          <span className={getActivityColor(type)}>
            <span className="font-semibold">
              {caseNumber ? `Warning Case #${caseNumber} removed` : 'Warning removed'}
            </span>
            {removalText && (
              <span className="ml-1 text-sm opacity-80">• {removalText}</span>
            )}
          </span>
        );
      }
      
      case 'ticket_created': {
        // Extract ticket number from description if available
        const ticketMatch = description.match(/Ticket #(\d+)/);
        const ticketNumber = ticketMatch ? ticketMatch[1] : '';
        
        return (
          <span className={getActivityColor(type)}>
            <span className="font-semibold">Ticket created</span>
            {ticketNumber && (
              <span className="ml-1 text-sm opacity-80">• Ticket #{ticketNumber}</span>
            )}
            {description && !description.includes('Ticket #') && (
              <span className="ml-1 text-sm opacity-80">• {description}</span>
            )}
          </span>
        );
      }
      
      case 'ticket_closed': {
        // Extract ticket number from description if available
        const ticketMatch = description.match(/Ticket #(\d+)/);
        const ticketNumber = ticketMatch ? ticketMatch[1] : '';
        
        return (
          <span className={getActivityColor(type)}>
            <span className="font-semibold">Ticket closed</span>
            {ticketNumber && (
              <span className="ml-1 text-sm opacity-80">• Ticket #{ticketNumber}</span>
            )}
            {description && !description.includes('Ticket #') && (
              <span className="ml-1 text-sm opacity-80">• {description}</span>
            )}
          </span>
        );
      }
      
      case 'user_joined': {
        return (
          <span className={getActivityColor(type)}>
            <span className="font-semibold">User joined</span>
            {description && <span className="ml-1 text-sm opacity-80">• {description}</span>}
          </span>
        );
      }
      
      case 'user_left': {
        return (
          <span className={getActivityColor(type)}>
            <span className="font-semibold">User left</span>
            {description && <span className="ml-1 text-sm opacity-80">• {description}</span>}
          </span>
        );
      }
      
      case 'command_used': {
        // Clean up the description to show just the command name
        const cleanDescription = description.replace(/^Used command:\s*/, '');
        
        return (
          <span className={getActivityColor(type)}>
            <span className="font-semibold">Command used</span>
            {cleanDescription && (
              <span className="ml-1 text-sm opacity-80">• {cleanDescription}</span>
            )}
          </span>
        );
      }
      
      case 'member_kick':
      case 'kick': {
        const caseMatch = description.match(/Case #(\d+)/i) || description.match(/#(\d+)/);
        const caseNumber = caseMatch ? caseMatch[1] : null;
        const cleanDescription = description.replace(/Case #\d+/i, '').trim();
        
        return (
          <span className={getActivityColor(type)}>
            <span className="font-semibold">
              {caseNumber ? `Member Kick Case #${caseNumber}` : 'Member kicked'}
            </span>
            {cleanDescription && (
              <span className="ml-1 text-sm opacity-80">• {cleanDescription}</span>
            )}
          </span>
        );
      }
      
      case 'member_ban':
      case 'ban': {
        const caseMatch = description.match(/Case #(\d+)/i) || description.match(/#(\d+)/);
        const caseNumber = caseMatch ? caseMatch[1] : null;
        const cleanDescription = description.replace(/Case #\d+/i, '').trim();
        
        return (
          <span className={getActivityColor(type)}>
            <span className="font-semibold">
              {caseNumber ? `Member Ban Case #${caseNumber}` : 'Member banned'}
            </span>
            {cleanDescription && (
              <span className="ml-1 text-sm opacity-80">• {cleanDescription}</span>
            )}
          </span>
        );
      }
      
      case 'member_timeout':
      case 'timeout': {
        const caseMatch = description.match(/Case #(\d+)/i) || description.match(/#(\d+)/);
        const caseNumber = caseMatch ? caseMatch[1] : null;
        const cleanDescription = description.replace(/Case #\d+/i, '').trim();
        
        return (
          <span className={getActivityColor(type)}>
            <span className="font-semibold">
              {caseNumber ? `Member Timeout Case #${caseNumber}` : 'Member timed out'}
            </span>
            {cleanDescription && (
              <span className="ml-1 text-sm opacity-80">• {cleanDescription}</span>
            )}
          </span>
        );
      }

      default: {
        // For all other activities, return normal formatting with fallback for empty descriptions
        const displayDescription = description || 'Activity recorded';
        return <span className={getActivityColor(type)}>{displayDescription}</span>;
      }
    }
  };

  return (
    <Card className={classNames(
      "shadow-xl border-0 rounded-xl overflow-hidden",
      darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
    )}>
      <div className={classNames(
        "p-6 border-b",
        darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
      )}>
        <div className="flex items-center justify-between">
          <h3 className={classNames(
            "text-xl font-semibold flex items-center",
            darkMode ? "text-white" : "text-gray-900"
          )}>
            <ClockIcon className="w-5 h-5 mr-2" />
            Recent Activity
          </h3>
          <span className={classNames(
            "text-sm font-medium px-3 py-1 rounded-full",
            darkMode ? "text-blue-300 bg-blue-900/30" : "text-blue-700 bg-blue-100"
          )}>
            {activities.length} activities
          </span>
        </div>
      </div>
      
      <div className={classNames(
        "p-6",
        darkMode ? "bg-gray-900" : "bg-white"
      )}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner className="text-blue-500" size="lg" />
            <span className={classNames(
              "ml-3 text-lg",
              darkMode ? "text-gray-300" : "text-gray-600"
            )}>Loading activities...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-16">
            <div className={classNames(
              "text-6xl mb-4",
              darkMode ? "text-gray-600" : "text-gray-400"
            )}>📝</div>
            <h3 className={classNames(
              "text-xl font-medium mb-2",
              darkMode ? "text-gray-300" : "text-gray-700"
            )}>No recent activity</h3>
            <p className={classNames(
              "text-sm",
              darkMode ? "text-gray-400" : "text-gray-500"
            )}>Activity will appear here as it happens</p>
          </div>
        ) : (
          <div className="flow-root">
            <ul className="-mb-8 space-y-6">
              {activities.map((activity, index) => (
                <li key={`${activity.id}-${index}`}>
                  <div className="relative">
                    {index !== activities.length - 1 && (
                      <span
                        className={classNames(
                          "absolute top-10 left-6 -ml-px h-full w-0.5",
                          darkMode ? "bg-gray-700" : "bg-gray-200"
                        )}
                        aria-hidden="true"
                      />
                    )}
                    <div className={classNames(
                      "relative flex space-x-4 p-4 rounded-xl transition-all duration-200 hover:scale-105",
                      darkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-50 hover:bg-gray-100"
                    )}>
                      <div>
                        <span className={classNames(
                          "h-12 w-12 rounded-xl flex items-center justify-center text-xl ring-2 ring-offset-2 transition-all duration-200",
                          darkMode ? "bg-gray-700 ring-gray-600 ring-offset-gray-900" : "bg-white ring-gray-200 ring-offset-white"
                        )}>
                          {getActivityIcon(activity.type)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex justify-between items-start">
                          <p className={classNames(
                            "text-sm font-medium leading-relaxed",
                            darkMode ? "text-gray-200" : "text-gray-900"
                          )}>
                            <span className={classNames(
                              "font-semibold mr-2",
                              darkMode ? "text-blue-400" : "text-blue-600"
                            )}>
                              {activity.user}
                            </span>
                            {formatDescription(activity.description, activity.type, activity)}
                          </p>
                          <div className={classNames(
                            "text-xs font-medium px-2 py-1 rounded-lg flex items-center",
                            darkMode ? "text-gray-400 bg-gray-800" : "text-gray-500 bg-gray-200"
                          )}>
                            <ClockIcon className="w-3 h-3 mr-1" />
                            <time dateTime={activity.timestamp}>
                              {formatTimestamp(activity.timestamp)}
                            </time>
                          </div>
                        </div>
                        {activity.details && (
                          <p className={classNames(
                            "text-sm px-3 py-2 rounded-lg",
                            darkMode ? "text-gray-400 bg-gray-800/50" : "text-gray-500 bg-gray-100"
                          )}>
                            {activity.details}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
};

export default RecentActivity;
