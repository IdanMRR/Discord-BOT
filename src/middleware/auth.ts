import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  guildId: string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  // Check for API key first (for dashboard access)
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_KEY || 'f8e7d6c5b4a3928170615243cba98765';
  
  // If API key is provided and matches expected value, allow access
  if (apiKey && apiKey === expectedApiKey) {
    console.log('Request authenticated via API key');
    // Add a default user for API key authentication
    req.user = {
      userId: 'dashboard',
      guildId: req.query.guildId as string || 'all',
    };
    return next();
  }
  
  // Otherwise, proceed with token-based authentication
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }
};
