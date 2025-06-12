/**
 * Log levels for the logging system
 * Lower values are more verbose, higher values are more severe
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

// Create a reverse mapping for number to name
const LogLevelNames = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR'
} as const;

/**
 * Get the string name of a log level
 */
export function getLogLevelName(level: LogLevel): string {
  return LogLevelNames[level as keyof typeof LogLevelNames] || 'UNKNOWN';
}
