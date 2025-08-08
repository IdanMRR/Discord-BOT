import { Request, Response, NextFunction } from 'express';
import { logger, LogCategory } from '../utils/structured-logger';

// Error types
export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

// Create custom error classes
export class ValidationError extends Error implements ApiError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  isOperational = true;

  constructor(message: string, public details?: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error implements ApiError {
  statusCode = 401;
  code = 'AUTHENTICATION_ERROR';
  isOperational = true;

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error implements ApiError {
  statusCode = 403;
  code = 'AUTHORIZATION_ERROR';
  isOperational = true;

  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error implements ApiError {
  statusCode = 404;
  code = 'NOT_FOUND_ERROR';
  isOperational = true;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends Error implements ApiError {
  statusCode = 429;
  code = 'RATE_LIMIT_ERROR';
  isOperational = true;

  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends Error implements ApiError {
  statusCode = 500;
  code = 'DATABASE_ERROR';
  isOperational = true;

  constructor(message: string = 'Database operation failed') {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends Error implements ApiError {
  statusCode = 502;
  code = 'EXTERNAL_SERVICE_ERROR';
  isOperational = true;

  constructor(message: string = 'External service unavailable') {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

// Async wrapper to catch errors in async route handlers
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Error handling middleware
export function errorHandler(
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational ?? false;

  // Log error with appropriate level
  if (statusCode >= 500) {
    logger.error(LogCategory.API, 'Server error occurred', error, {
      url: req.url,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params
    }, req);
  } else if (statusCode >= 400) {
    logger.warn(LogCategory.API, `Client error: ${error.message}`, {
      statusCode,
      url: req.url,
      method: req.method,
      errorCode: error.code
    }, req);
  }

  // Security: Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const shouldExposeError = isOperational || isDevelopment;

  const errorResponse: any = {
    success: false,
    error: shouldExposeError ? error.message : 'Internal server error',
    code: error.code,
    timestamp: new Date().toISOString()
  };

  // Add additional details in development
  if (isDevelopment) {
    errorResponse.stack = error.stack;
    if ('details' in error && error.details) {
      errorResponse.details = error.details;
    }
  }

  // Add correlation ID if available
  const correlationId = req.headers['x-correlation-id'] || (req as any).correlationId;
  if (correlationId) {
    errorResponse.correlationId = correlationId;
  }

  res.status(statusCode).json(errorResponse);
}

// 404 handler for unmatched routes
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  // Skip creating error for webpack hot-update.json files to reduce noise
  if (req.originalUrl.includes('.hot-update.json')) {
    res.status(204).end();
    return;
  }
  
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
}

// Global uncaught exception handler
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error(LogCategory.GENERAL, 'Uncaught Exception', error, {
      fatal: true
    });
    
    // Graceful shutdown
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error(LogCategory.GENERAL, 'Unhandled Rejection', new Error(String(reason)), {
      promise: promise.toString(),
      reason: String(reason)
    });
  });
}

// Validation error formatter
export function formatValidationError(errors: string[]): ValidationError {
  const message = `Validation failed: ${errors.join(', ')}`;
  return new ValidationError(message, errors);
}

// Database error wrapper
export function wrapDatabaseError(error: any): DatabaseError | ApiError {
  if (error.code === 'SQLITE_CONSTRAINT') {
    return new ValidationError('Database constraint violation', [error.message]);
  }
  
  if (error.code === 'SQLITE_BUSY') {
    return new DatabaseError('Database is busy, please try again later');
  }
  
  return new DatabaseError(`Database operation failed: ${error.message}`);
}

// Discord API error wrapper
export function wrapDiscordError(error: any): ExternalServiceError | ApiError {
  if (error.code === 50013) {
    return new AuthorizationError('Bot lacks permissions for this action');
  }
  
  if (error.code === 50001) {
    return new NotFoundError('Discord resource not found');
  }
  
  if (error.code === 50035) {
    return new ValidationError('Invalid form body', [error.message]);
  }
  
  return new ExternalServiceError(`Discord API error: ${error.message}`);
}

export default errorHandler;