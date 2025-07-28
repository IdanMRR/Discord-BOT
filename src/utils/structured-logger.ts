import { Request } from 'express';

// Log levels enum
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Log categories for better organization
export enum LogCategory {
  AUTH = 'auth',
  API = 'api',
  DATABASE = 'database',
  DISCORD = 'discord',
  COMMAND = 'command',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  CORS = 'cors',
  WEBHOOK = 'webhook',
  GENERAL = 'general'
}

// Structured log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  correlationId?: string;
  userId?: string;
  guildId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  metadata?: Record<string, any>;
}

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableStructured: boolean;
  correlationHeader: string;
}

class StructuredLogger {
  private config: LoggerConfig;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.config = {
      level: this.isProduction ? LogLevel.INFO : LogLevel.DEBUG,
      enableConsole: true,
      enableFile: false, // Can be enabled for production logging
      enableStructured: this.isProduction,
      correlationHeader: 'x-correlation-id'
    };
  }

  // Generate correlation ID for request tracking
  generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Extract correlation ID from request
  getCorrelationId(req?: Request): string | undefined {
    if (!req) return undefined;
    return req.headers[this.config.correlationHeader] as string || 
           req.headers['x-request-id'] as string ||
           (req as any).correlationId;
  }

  // Extract user info from request
  private extractUserInfo(req?: Request): { userId?: string; ip?: string; userAgent?: string } {
    if (!req) return {};
    
    return {
      userId: req.headers['x-user-id'] as string || (req as any).userId,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent']
    };
  }

  // Core logging method
  private log(entry: Partial<LogEntry>): void {
    const fullEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: entry.level || LogLevel.INFO,
      category: entry.category || LogCategory.GENERAL,
      message: entry.message || 'No message provided',
      ...entry
    };

    // Skip if log level is below configured threshold
    if (fullEntry.level > this.config.level) {
      return;
    }

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(fullEntry);
    }

    // Structured logging (JSON format for log aggregation)
    if (this.config.enableStructured) {
      this.logStructured(fullEntry);
    }
  }

  // Console logging with colors and formatting
  private logToConsole(entry: LogEntry): void {
    const colors = {
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.INFO]: '\x1b[36m',  // Cyan
      [LogLevel.DEBUG]: '\x1b[37m', // White
    };

    const levelNames = {
      [LogLevel.ERROR]: 'ERROR',
      [LogLevel.WARN]: 'WARN ',
      [LogLevel.INFO]: 'INFO ',
      [LogLevel.DEBUG]: 'DEBUG'
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level];
    const levelName = levelNames[entry.level];
    
    const prefix = `${color}[${levelName}][${entry.category.toUpperCase()}]${reset}`;
    const correlationPart = entry.correlationId ? ` [${entry.correlationId}]` : '';
    
    console.log(`${prefix}${correlationPart} ${entry.message}`);
    
    // Log additional metadata if present
    if (entry.error) {
      console.error(`${prefix} Error Details:`, entry.error);
    }
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.log(`${prefix} Metadata:`, entry.metadata);
    }
  }

  // Structured JSON logging for production
  private logStructured(entry: LogEntry): void {
    // Remove ANSI color codes and format for JSON
    const structuredEntry = {
      ...entry,
      level: LogLevel[entry.level],
      category: entry.category
    };
    
    console.log(JSON.stringify(structuredEntry));
  }

  // Public logging methods
  error(category: LogCategory, message: string, error?: Error | any, metadata?: Record<string, any>, req?: Request): void {
    const userInfo = this.extractUserInfo(req);
    
    this.log({
      level: LogLevel.ERROR,
      category,
      message,
      correlationId: this.getCorrelationId(req),
      error: error ? {
        name: error.name || 'Error',
        message: error.message || String(error),
        stack: error.stack,
        code: error.code
      } : undefined,
      metadata,
      ...userInfo
    });
  }

  warn(category: LogCategory, message: string, metadata?: Record<string, any>, req?: Request): void {
    const userInfo = this.extractUserInfo(req);
    
    this.log({
      level: LogLevel.WARN,
      category,
      message,
      correlationId: this.getCorrelationId(req),
      metadata,
      ...userInfo
    });
  }

  info(category: LogCategory, message: string, metadata?: Record<string, any>, req?: Request): void {
    const userInfo = this.extractUserInfo(req);
    
    this.log({
      level: LogLevel.INFO,
      category,
      message,
      correlationId: this.getCorrelationId(req),
      metadata,
      ...userInfo
    });
  }

  debug(category: LogCategory, message: string, metadata?: Record<string, any>, req?: Request): void {
    const userInfo = this.extractUserInfo(req);
    
    this.log({
      level: LogLevel.DEBUG,
      category,
      message,
      correlationId: this.getCorrelationId(req),
      metadata,
      ...userInfo
    });
  }

  // Specialized logging methods
  logRequest(req: Request, res: any, duration?: number): void {
    const userInfo = this.extractUserInfo(req);
    
    this.log({
      level: LogLevel.INFO,
      category: LogCategory.API,
      message: `${req.method} ${req.path}`,
      correlationId: this.getCorrelationId(req),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      metadata: {
        query: req.query,
        params: req.params
      },
      ...userInfo
    });
  }

  logSecurityEvent(message: string, severity: 'low' | 'medium' | 'high', metadata?: Record<string, any>, req?: Request): void {
    const userInfo = this.extractUserInfo(req);
    
    this.log({
      level: severity === 'high' ? LogLevel.ERROR : severity === 'medium' ? LogLevel.WARN : LogLevel.INFO,
      category: LogCategory.SECURITY,
      message,
      correlationId: this.getCorrelationId(req),
      metadata: {
        severity,
        ...metadata
      },
      ...userInfo
    });
  }

  logPerformance(operation: string, duration: number, metadata?: Record<string, any>, req?: Request): void {
    const userInfo = this.extractUserInfo(req);
    
    this.log({
      level: duration > 1000 ? LogLevel.WARN : LogLevel.INFO,
      category: LogCategory.PERFORMANCE,
      message: `${operation} took ${duration}ms`,
      correlationId: this.getCorrelationId(req),
      duration,
      metadata,
      ...userInfo
    });
  }

  logDatabaseQuery(query: string, duration: number, error?: Error, req?: Request): void {
    const userInfo = this.extractUserInfo(req);
    
    this.log({
      level: error ? LogLevel.ERROR : LogLevel.DEBUG,
      category: LogCategory.DATABASE,
      message: error ? `Database query failed: ${query}` : `Database query: ${query}`,
      correlationId: this.getCorrelationId(req),
      duration,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      ...userInfo
    });
  }

  // Express middleware factory
  createRequestMiddleware() {
    return (req: Request, res: any, next: any) => {
      const startTime = Date.now();
      
      // Add correlation ID to request
      if (!req.headers[this.config.correlationHeader]) {
        const correlationId = this.generateCorrelationId();
        req.headers[this.config.correlationHeader] = correlationId;
        (req as any).correlationId = correlationId;
      }

      // Log request start
      this.debug(LogCategory.API, `Request started: ${req.method} ${req.path}`, {
        query: req.query,
        params: req.params
      }, req);

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(chunk: any, encoding: any) {
        const duration = Date.now() - startTime;
        
        logger.logRequest(req, res, duration);
        
        // Log slow requests as warnings
        if (duration > 5000) {
          logger.warn(LogCategory.PERFORMANCE, `Slow request detected: ${req.method} ${req.path}`, {
            duration,
            statusCode: res.statusCode
          }, req);
        }

        originalEnd.call(res, chunk, encoding);
      };

      next();
    };
  }
}

// Create singleton instance
export const logger = new StructuredLogger();

// Legacy compatibility functions
export function logInfo(category: string, message: string, req?: Request): void {
  logger.info(category as LogCategory, message, undefined, req);
}

export function logError(category: string, error: any, req?: Request): void {
  const message = typeof error === 'string' ? error : error?.message || 'Unknown error';
  logger.error(category as LogCategory, message, error, undefined, req);
}

export function logWarning(category: string, message: string, req?: Request): void {
  logger.warn(category as LogCategory, message, undefined, req);
}

export function logDebug(category: string, message: string, req?: Request): void {
  logger.debug(category as LogCategory, message, undefined, req);
}

// Export types and enums are already exported above at their declaration