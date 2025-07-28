import { Request, Response, NextFunction } from 'express';
import { logError, logInfo } from '../utils/logger';

// Input validation schemas
export interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'discord_id';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    allowedValues?: any[];
    sanitize?: boolean;
  };
}

// Sanitize string input
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .substring(0, 10000); // Limit length to prevent DoS
}

// Validate Discord ID format
export function isValidDiscordId(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Main validation function
export function validateInput(data: any, schema: ValidationSchema): { isValid: boolean; errors: string[]; sanitizedData: any } {
  const errors: string[] = [];
  const sanitizedData: any = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`Field '${field}' is required`);
      continue;
    }

    // Skip validation for optional empty fields
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    let processedValue = value;

    // Type validation and conversion
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Field '${field}' must be a string`);
          continue;
        }
        processedValue = rules.sanitize ? sanitizeString(value) : value;
        
        if (rules.minLength && processedValue.length < rules.minLength) {
          errors.push(`Field '${field}' must be at least ${rules.minLength} characters long`);
        }
        if (rules.maxLength && processedValue.length > rules.maxLength) {
          errors.push(`Field '${field}' must be no more than ${rules.maxLength} characters long`);
        }
        if (rules.pattern && !rules.pattern.test(processedValue)) {
          errors.push(`Field '${field}' format is invalid`);
        }
        break;

      case 'number':
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue) || typeof numValue !== 'number') {
          errors.push(`Field '${field}' must be a valid number`);
          continue;
        }
        processedValue = numValue;
        
        if (rules.min !== undefined && numValue < rules.min) {
          errors.push(`Field '${field}' must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && numValue > rules.max) {
          errors.push(`Field '${field}' must be no more than ${rules.max}`);
        }
        break;

      case 'boolean':
        if (typeof value === 'string') {
          processedValue = value.toLowerCase() === 'true';
        } else if (typeof value !== 'boolean') {
          errors.push(`Field '${field}' must be a boolean`);
          continue;
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`Field '${field}' must be an array`);
          continue;
        }
        processedValue = value;
        break;

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push(`Field '${field}' must be an object`);
          continue;
        }
        processedValue = value;
        break;

      case 'email':
        if (typeof value !== 'string' || !isValidEmail(value)) {
          errors.push(`Field '${field}' must be a valid email address`);
          continue;
        }
        processedValue = value.toLowerCase().trim();
        break;

      case 'discord_id':
        if (typeof value !== 'string' || !isValidDiscordId(value)) {
          errors.push(`Field '${field}' must be a valid Discord ID`);
          continue;
        }
        processedValue = value;
        break;
    }

    // Check allowed values
    if (rules.allowedValues && !rules.allowedValues.includes(processedValue)) {
      errors.push(`Field '${field}' must be one of: ${rules.allowedValues.join(', ')}`);
    }

    sanitizedData[field] = processedValue;
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
}

// Express middleware factory for validation
export function createValidationMiddleware(schema: ValidationSchema, dataSource: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[dataSource];
      const validation = validateInput(dataToValidate, schema);

      if (!validation.isValid) {
        logError('Validation', `Input validation failed for ${req.method} ${req.path}: ${validation.errors.join(', ')}`);
        return res.status(400).json({
          success: false,
          error: 'Input validation failed',
          details: validation.errors
        });
      }

      // Replace the original data with sanitized data
      req[dataSource] = { ...req[dataSource], ...validation.sanitizedData };
      
      logInfo('Validation', `Input validation passed for ${req.method} ${req.path}`);
      next();
    } catch (error: any) {
      logError('Validation', `Validation middleware error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Internal validation error'
      });
    }
  };
}

// Common validation schemas
export const commonSchemas = {
  discordId: {
    type: 'discord_id' as const,
    required: true
  },
  
  paginationQuery: {
    page: {
      type: 'number' as const,
      required: false,
      min: 1,
      max: 1000
    },
    limit: {
      type: 'number' as const,
      required: false,
      min: 1,
      max: 100
    }
  },

  serverIdParam: {
    serverId: {
      type: 'discord_id' as const,
      required: true
    }
  }
};

// Sanitize all string inputs in an object recursively
export function deepSanitize(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(deepSanitize);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = deepSanitize(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Global sanitization middleware
export function globalSanitizationMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = deepSanitize(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = deepSanitize(req.query);
    }
    
    next();
  } catch (error: any) {
    logError('Sanitization', `Global sanitization error: ${error.message}`);
    next(); // Continue even if sanitization fails
  }
}