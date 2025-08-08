/**
 * Validation utilities for moderation actions and tickets
 */

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Validate reason input for moderation actions and tickets
 */
export function validateReason(reason: string): ValidationResult {
  if (!reason || typeof reason !== 'string') {
    return { 
      isValid: false, 
      message: '❌ **Invalid Reason:** Reason cannot be empty. Please provide a valid reason.' 
    };
  }
  
  const trimmedReason = reason.trim();
  
  if (trimmedReason.length === 0) {
    return { 
      isValid: false, 
      message: '❌ **Invalid Reason:** Reason cannot be empty or just spaces. Please provide a valid reason.' 
    };
  }
  
  if (trimmedReason.length < 3) {
    return { 
      isValid: false, 
      message: '❌ **Invalid Reason:** Reason must be at least 3 characters long.' 
    };
  }
  
  if (reason.length > 1000) {
    return { 
      isValid: false, 
      message: '❌ **Invalid Reason:** Reason cannot exceed 1000 characters.' 
    };
  }
  
  // Check for spam/repeated characters
  if (/(.)\1{50,}/.test(reason)) {
    return { 
      isValid: false, 
      message: '❌ **Invalid Reason:** Reason contains too many repeated characters.' 
    };
  }
  
  // Check for meaningless content (only punctuation or numbers)
  if (/^[\s\d\W]+$/.test(trimmedReason)) {
    return { 
      isValid: false, 
      message: '❌ **Invalid Reason:** Please provide a meaningful reason with actual words.' 
    };
  }
  
  return { isValid: true };
}

/**
 * Validate and sanitize reason input
 */
export function sanitizeReason(reason: string): string {
  return reason.trim().replace(/\s+/g, ' '); // Remove extra whitespace
}