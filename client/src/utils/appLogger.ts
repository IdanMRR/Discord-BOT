// Log levels enum
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
} as const;

export type LogLevelType = typeof LogLevel[keyof typeof LogLevel];

// Get the string name of a log level
export function getLogLevelName(level: LogLevelType): string {
  switch (level) {
    case LogLevel.DEBUG: return 'DEBUG';
    case LogLevel.INFO: return 'INFO';
    case LogLevel.WARN: return 'WARN';
    case LogLevel.ERROR: return 'ERROR';
    default: return 'UNKNOWN';
  }
}

type LogEntry = {
  timestamp: Date;
  level: LogLevelType;
  module: string;
  message: string;
  data?: any;
};

// In-memory log storage
const logHistory: LogEntry[] = [];
const MAX_HISTORY = 1000; // Maximum number of log entries to keep in memory

// Default log level is INFO
let currentLogLevel: LogLevelType = LogLevel.INFO;

// Format a log message with timestamp, level, and module
function formatLogMessage(level: LogLevelType, module: string, message: string): string {
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
export function setLogLevel(level: LogLevelType): void {
  currentLogLevel = level;
  console.log(`Log level set to: ${getLogLevelName(level)}`);
}

// Get the current log level
export function getCurrentLogLevel(): LogLevelType {
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
  error: (module: string, message: string, errorData?: any) => error(module, message, errorData),
  setLevel: (level: LogLevelType) => setLogLevel(level),
  getLevel: () => getCurrentLogLevel(),
  getHistory: (limit?: number) => getLogHistory(limit)
};

export default logger;
