import { Request, Response, NextFunction } from 'express';
import { logError } from '../utils/logger';

// Create logWarn function if it doesn't exist
const logWarn = (category: string, message: string) => {
  console.warn(`[WARN ][${category}] ${message}`);
};

/**
 * Middleware to handle malicious request patterns and prevent logging spam
 */

// Common malicious paths that scanners look for
const MALICIOUS_PATTERNS = [
  // WordPress/PHP files
  /\.(php|asp|aspx|jsp|cgi)$/i,
  /\/wp-(admin|content|includes|json)\//i,
  /\/(xmlrpc|wp-config|wp-login)/i,
  
  // Config/sensitive files
  /\/(\.env|\.git|\.aws|\.ssh|config|terraform)/i,
  /\/(phpinfo|phpmyadmin|admin|manager)/i,
  
  // Path traversal attempts
  /\.\.\/|\.\.\\|\%2e\%2e/i,
  /\%c0|\%c1|\%00/i,
  
  // Common vulnerability scans
  /\/(jndi:|ldap:|rmi:|dns:|iiop:)/i,
  /\/(actuator|metrics|health|info)$/i,
  
  // Script injections
  /<script|javascript:|onerror=/i,
  
  // SQL injection patterns
  /(\bselect\b.*\bfrom\b|\bunion\b.*\bselect\b|sleep\(|benchmark\()/i
];

// Paths that should return 404 without logging errors
const SILENT_404_PATHS = [
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/apple-touch-icon.png',
  '/browserconfig.xml'
];

/**
 * Check if a path contains malicious patterns
 */
function isMaliciousPath(path: string): boolean {
  return MALICIOUS_PATTERNS.some(pattern => pattern.test(path));
}

/**
 * Check if path should silently return 404
 */
function isSilent404(path: string): boolean {
  return SILENT_404_PATHS.includes(path);
}

/**
 * Safely decode URI components without throwing errors
 */
function safeDecodeURI(uri: string): string | null {
  try {
    // First, try normal decoding
    return decodeURIComponent(uri);
  } catch (e) {
    try {
      // Try decoding with single encoding
      return decodeURI(uri);
    } catch (e2) {
      // If both fail, the URI is malformed
      return null;
    }
  }
}

/**
 * Main middleware function
 */
export function maliciousRequestHandler(req: Request, res: Response, next: NextFunction): void {
  const originalUrl = req.originalUrl || req.url;
  
  // Try to safely decode the URL
  const decodedUrl = safeDecodeURI(originalUrl);
  
  // If URL couldn't be decoded, it's likely malicious
  if (decodedUrl === null) {
    logWarn('API', `Client error: Failed to decode param '${originalUrl.substring(0, 50)}...'`);
    res.status(400).json({
      success: false,
      error: 'Invalid URL encoding'
    });
    return;
  }
  
  // Check for malicious patterns
  if (isMaliciousPath(decodedUrl)) {
    // Log as warning, not error
    logWarn('API', `Client error: Route ${req.method} ${decodedUrl.substring(0, 100)} not found`);
    
    // Return 404 to not reveal we detected it as malicious
    res.status(404).json({
      success: false,
      error: 'Not found',
      errorCode: 'NOT_FOUND_ERROR'
    });
    return;
  }
  
  // Check for silent 404 paths
  if (isSilent404(originalUrl)) {
    res.status(404).json({
      success: false,
      error: 'Not found'
    });
    return;
  }
  
  // Attach decoded URL to request for downstream use
  (req as any).decodedUrl = decodedUrl;
  
  next();
}

/**
 * Error handler for catch-all routes
 */
export function handleCatchAllRoute(req: Request, res: Response): void {
  const path = req.path || req.url;
  
  // Don't log error for common scanner paths
  if (!isMaliciousPath(path) && !isSilent404(path)) {
    logWarn('API', `Route not found: ${req.method} ${path}`);
  }
  
  res.status(404).json({
    success: false,
    error: 'Route not found',
    errorCode: 'NOT_FOUND_ERROR'
  });
}

export default {
  middleware: maliciousRequestHandler,
  handleCatchAll: handleCatchAllRoute
};