import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { db } from '../database/sqlite';
import { logInfo, logError } from '../utils/logger';

const router = Router();

// Helper function to handle API responses
const sendResponse = (res: Response, status: number, data: any) => {
  res.status(status).json(data);};

// POST / endpoint for receiving logs
const handlePostLog: RequestHandler = async (req, res, next) => {
  try {
    const logData = req.body;
    
    if (!logData || !logData.guild_id || !logData.action) {
      return sendResponse(res, 400, {
        success: false,
        error: 'Invalid log data. Required fields: guild_id, action'
      });
    }
    
    logInfo('Dashboard API', `Received log: ${logData.action} for guild ${logData.guild_id}`);
    
    try {
      // Check if logs table exists
      const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dashboard_logs'").get();
      
      if (!tableExists) {
        // Create the logs table if it doesn't exist
        db.prepare(`
          CREATE TABLE IF NOT EXISTS dashboard_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            user_id TEXT,
            action TEXT NOT NULL,
            details TEXT,
            log_type TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
        logInfo('Dashboard API', 'Created dashboard_logs table');
      }
      
      // Insert the log entry
      const stmt = db.prepare(`
        INSERT INTO dashboard_logs (guild_id, user_id, action, details, log_type, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      
      stmt.run(
        logData.guild_id,
        logData.user_id || null,
        logData.action,
        logData.details || null,
        logData.log_type || 'general',
        logData.metadata ? JSON.stringify(logData.metadata) : null
      );
      
      sendResponse(res, 200, {
        success: true,
        message: 'Log entry created successfully'
      });
    } catch (dbError: any) {
      logError('Dashboard API', `Database error: ${dbError.message}`);
      sendResponse(res, 500, {
        success: false,
        error: 'Database error'
      });
    }
  } catch (error: any) {
    logError('Dashboard API', `Error processing log: ${error.message}`);
    sendResponse(res, 500, {
      success: false,
      error: 'Internal server error'
    });
  }
};

// GET / endpoint for retrieving logs
const handleGetLogs: RequestHandler = async (req, res, next) => {
  try {
    const { guild_id, limit = '50', offset = '0', action, user_id } = req.query;
    
    if (!guild_id) {
      return sendResponse(res, 400, {
        success: false,
        error: 'Guild ID is required'
      });
    }
    
    // Build the query with optional filters
    let query = 'SELECT * FROM dashboard_logs WHERE guild_id = ?';
    const params: any[] = [guild_id];
    
    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }
    
    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }
    
    // Add order and limit
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    // Check if the table exists first
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dashboard_logs'").get();
    
    if (!tableExists) {
      return sendResponse(res, 200, {
        success: true,
        data: [],
        pagination: {
          total: 0,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });
    }
    
    // Execute the query
    const logs = db.prepare(query).all(...params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM dashboard_logs WHERE guild_id = ?';
    const countParams: any[] = [guild_id];
    
    if (action) {
      countQuery += ' AND action = ?';
      countParams.push(action);
    }
    
    if (user_id) {
      countQuery += ' AND user_id = ?';
      countParams.push(user_id);
    }
    
    const { total } = db.prepare(countQuery).get(...countParams) as { total: number };
    
    sendResponse(res, 200, {
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error: any) {
    logError('Dashboard API', `Error getting logs: ${error.message}`);
    sendResponse(res, 500, {
      success: false,
      error: 'Internal server error'
    });
  }
};

// Register routes
router.post('/', handlePostLog);
router.get('/', handleGetLogs);

export default router;
