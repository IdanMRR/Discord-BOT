import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Generate log filename with timestamp
const logFilename = `console-${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.txt`;
const logPath = path.join(logsDir, logFilename);

// Create write stream for log file
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

// Helper function to format log messages
function formatLogMessage(level: string, args: any[]): string {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  return `[${timestamp}] [${level}] ${message}\n`;
}

// Override console methods
console.log = (...args: any[]) => {
  const message = formatLogMessage('LOG', args);
  logStream.write(message);
  originalConsole.log(...args);
};

console.error = (...args: any[]) => {
  const message = formatLogMessage('ERROR', args);
  logStream.write(message);
  originalConsole.error(...args);
};

console.warn = (...args: any[]) => {
  const message = formatLogMessage('WARN', args);
  logStream.write(message);
  originalConsole.warn(...args);
};

console.info = (...args: any[]) => {
  const message = formatLogMessage('INFO', args);
  logStream.write(message);
  originalConsole.info(...args);
};

console.debug = (...args: any[]) => {
  const message = formatLogMessage('DEBUG', args);
  logStream.write(message);
  originalConsole.debug(...args);
};

// Export function to get current log file path
export function getCurrentLogFile(): string {
  return logPath;
}

// Export function to close log stream
export function closeLogStream(): void {
  logStream.end();
}

// Log startup message
console.log('Console logging initialized. Log file:', logPath); 