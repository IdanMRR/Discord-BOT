import { LogLevel, getLogLevelName } from './logLevels';

type LogEntry = {
  timestamp: Date;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
};

// In-memory log storage
const logHistory: LogEntry[] = [];
const MAX_HISTORY = 1000; // Maximum number of log entries to keep in memory

// Default log level is INFO
let currentLogLevel: LogLevel = LogLevel.INFO;

// Format a log message with timestamp, level, and module
function formatLogMessage(level: LogLevel, module: string, message: string): string {
  const timestamp = new Date().toISOString();
  const levelName = getLogLevelName(level).padEnd(5);
  return `[${timestamp}] [${levelName}] [${module}] ${message}`;
}

// Add log entry to history
function addToHistory(entry: LogEntry): void {
  logHistory.push(entry);
  
  // Remove old entries if we exceed the maximum history
  while (logHistory.length > MAX_HISTORY) {
    logHistory.shift();
  }
}

// Set the current log level
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  console.log(`Log level set to: ${getLogLevelName(level)}`);
}

// Get the current log level
export function getCurrentLogLevel(): LogLevel {
  return currentLogLevel;
}

// Get recent log entries
export function getLogHistory(limit: number = 100): LogEntry[] {
  return logHistory.slice(-limit);
}

// Log a debug message
export function debug(module: string, message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.DEBUG) {
    const formattedMessage = formatLogMessage(LogLevel.DEBUG, module, message);
    console.debug(formattedMessage, data !== undefined ? data : '');
    addToHistory({
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      module,
      message,
      data
    });
  }
}

// Log an info message
export function info(module: string, message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.INFO) {
    const formattedMessage = formatLogMessage(LogLevel.INFO, module, message);
    console.info(formattedMessage, data !== undefined ? data : '');
    addToHistory({
      timestamp: new Date(),
      level: LogLevel.INFO,
      module,
      message,
      data
    });
  }
}

// Log a warning message
export function warn(module: string, message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.WARN) {
    const formattedMessage = formatLogMessage(LogLevel.WARN, module, message);
    console.warn(formattedMessage, data !== undefined ? data : '');
    addToHistory({
      timestamp: new Date(),
      level: LogLevel.WARN,
      module,
      message,
      data
    });
  }
}

// Log an error message
export function error(module: string, message: string, error?: Error | any): void {
  if (currentLogLevel <= LogLevel.ERROR) {
    const formattedMessage = formatLogMessage(LogLevel.ERROR, module, message);
    console.error(formattedMessage, error || '');
    
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;

    addToHistory({
      timestamp: new Date(),
      level: LogLevel.ERROR,
      module,
      message,
      data: errorData
    });
  }
}

// Export a default logger instance for convenience
export const logger = {
  debug: (module: string, message: string, data?: any) => debug(module, message, data),
  info: (module: string, message: string, data?: any) => info(module, message, data),
  warn: (module: string, message: string, data?: any) => warn(module, message, data),
  error: (module: string, message: string, error?: any) => error(module, message, error),
  setLevel: (level: LogLevel) => setLogLevel(level),
  getLevel: () => getCurrentLogLevel(),
  getHistory: (limit?: number) => getLogHistory(limit)
};

export default logger;
