import express, { Request, Response } from 'express';
import { db } from '../database/sqlite';
import { logInfo, logError } from '../utils/logger';
// No authentication for now - can be added later if needed
const router = express.Router();

// Get command logs
router.get('/commands', async (req: Request, res: Response) => {
  try {
    const {
      guild_id,
      user_id,
      command,
      success,
      page = 1,
      limit = 50,
      start_date,
      end_date
    } = req.query;

    let query = 'SELECT * FROM command_logs WHERE 1=1';
    const params: any[] = [];

    if (guild_id) {
      query += ' AND guild_id = ?';
      params.push(guild_id);
    }

    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }

    if (command) {
      query += ' AND command LIKE ?';
      params.push(`%${command}%`);
    }

    if (success !== undefined) {
      query += ' AND success = ?';
      params.push(success === 'true' ? 1 : 0);
    }

    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = db.prepare(countQuery).get(...params) as { count: number };

    // Add pagination
    const offset = (Number(page) - 1) * Number(limit);
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const logs = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total: countResult.count,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(countResult.count / Number(limit))
        }
      }
    });
  } catch (error) {
    logError('Comprehensive Logs API', `Error getting command logs: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve command logs'
    });
  }
});

// Get message logs (deleted/edited messages)
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const {
      guild_id,
      channel_id,
      user_id,
      action,
      page = 1,
      limit = 50,
      start_date,
      end_date
    } = req.query;

    let query = 'SELECT * FROM message_logs WHERE 1=1';
    const params: any[] = [];

    if (guild_id) {
      query += ' AND guild_id = ?';
      params.push(guild_id);
    }

    if (channel_id) {
      query += ' AND channel_id = ?';
      params.push(channel_id);
    }

    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = db.prepare(countQuery).get(...params) as { count: number };

    // Add pagination
    const offset = (Number(page) - 1) * Number(limit);
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const logs = db.prepare(query).all(...params);

    // Parse JSON fields
    const parsedLogs = logs.map((log: any) => ({
      ...log,
      attachment_urls: log.attachment_urls ? JSON.parse(log.attachment_urls) : [],
      embed_data: log.embed_data ? JSON.parse(log.embed_data) : null
    }));

    res.json({
      success: true,
      data: {
        logs: parsedLogs,
        pagination: {
          total: countResult.count,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(countResult.count / Number(limit))
        }
      }
    });
  } catch (error) {
    logError('Comprehensive Logs API', `Error getting message logs: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve message logs'
    });
  }
});

// Get DM logs
router.get('/dms', async (req: Request, res: Response) => {
  try {
    const {
      guild_id,
      sender_id,
      recipient_id,
      command,
      success,
      page = 1,
      limit = 50,
      start_date,
      end_date
    } = req.query;

    let query = 'SELECT * FROM dm_logs WHERE 1=1';
    const params: any[] = [];

    if (guild_id) {
      query += ' AND guild_id = ?';
      params.push(guild_id);
    }

    if (sender_id) {
      query += ' AND sender_id = ?';
      params.push(sender_id);
    }

    if (recipient_id) {
      query += ' AND recipient_id = ?';
      params.push(recipient_id);
    }

    if (command) {
      query += ' AND command LIKE ?';
      params.push(`%${command}%`);
    }

    if (success !== undefined) {
      query += ' AND success = ?';
      params.push(success === 'true' ? 1 : 0);
    }

    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = db.prepare(countQuery).get(...params) as { count: number };

    // Add pagination
    const offset = (Number(page) - 1) * Number(limit);
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const logs = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total: countResult.count,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(countResult.count / Number(limit))
        }
      }
    });
  } catch (error) {
    logError('Comprehensive Logs API', `Error getting DM logs: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve DM logs'
    });
  }
});

// Get moderation case logs
router.get('/moderation', async (req: Request, res: Response) => {
  try {
    const {
      guild_id,
      user_id,
      moderator_id,
      action,
      active,
      page = 1,
      limit = 50,
      start_date,
      end_date
    } = req.query;

    let query = 'SELECT * FROM moderation_cases WHERE 1=1';
    const params: any[] = [];

    if (guild_id) {
      query += ' AND guild_id = ?';
      params.push(guild_id);
    }

    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }

    if (moderator_id) {
      query += ' AND moderator_id = ?';
      params.push(moderator_id);
    }

    if (action) {
      query += ' AND action LIKE ?';
      params.push(`%${action}%`);
    }

    if (active !== undefined) {
      query += ' AND active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = db.prepare(countQuery).get(...params) as { count: number };

    // Add pagination
    const offset = (Number(page) - 1) * Number(limit);
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const logs = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total: countResult.count,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(countResult.count / Number(limit))
        }
      }
    });
  } catch (error) {
    logError('Comprehensive Logs API', `Error getting moderation logs: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve moderation logs'
    });
  }
});

export default router;