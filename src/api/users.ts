import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { logError } from '../utils/logger';
const { getUserName } = require('./user-helper');
const { getClient } = require('../utils/client-utils');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Get user information by ID
 * GET /api/users/:userId
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    if (!userId || userId.length < 17 || userId.length > 19) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }
    
    // Get the Discord client
    const client = getClient();
    
    // First try to get user from Discord API
    try {
      const user = await client.users.fetch(userId);
      if (user) {
        return res.json({
          success: true,
          data: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            bot: user.bot
          }
        });
      }
    } catch (err) {
      // If direct fetch fails, try getUserName helper
      const username = await getUserName(client, userId);
      
      return res.json({
        success: true,
        data: {
          id: userId,
          username: username
        }
      });
    }
  } catch (error) {
    logError('API', `Error fetching user: ${error}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user information'
    });
  }
});

export default router;
