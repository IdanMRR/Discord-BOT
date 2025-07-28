import express, { Request, Response } from 'express';
import { AutomodEscalationService, AutomodEscalationSettings, AutomodEscalationRule } from '../database/services/automodEscalationService';
import { logInfo, logError } from '../utils/structured-logger';
import { LogCategory } from '../utils/structured-logger';

const router = express.Router();

// CORS headers middleware
router.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003', 'http://127.0.0.1:3000', 'http://127.0.0.1:3002', 'http://127.0.0.1:3003'];
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key, x-user-id, x-request-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// GET /api/automod-escalation/:guildId/settings - Get automod settings
router.get('/:guildId/settings', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    
    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID is required'
      });
    }

    const settings = await AutomodEscalationService.getSettings(guildId);
    
    // Return default settings if none exist
    const defaultSettings: AutomodEscalationSettings = {
      guild_id: guildId,
      enabled: false,
      reset_warnings_after_days: 30
    };

    res.json({
      success: true,
      data: settings || defaultSettings
    });
  } catch (error) {
    logError(LogCategory.API, `Error getting automod settings: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PUT /api/automod-escalation/:guildId/settings - Update automod settings
router.put('/:guildId/settings', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const { enabled, reset_warnings_after_days } = req.body;
    
    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID is required'
      });
    }

    // Validate only if fields are provided
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid enabled field format - must be boolean'
      });
    }
    
    if (reset_warnings_after_days !== undefined && typeof reset_warnings_after_days !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid reset_warnings_after_days field format - must be number'
      });
    }

    // Get existing settings first for partial updates
    const existingSettings = await AutomodEscalationService.getSettings(guildId);
    
    const settings: AutomodEscalationSettings = {
      guild_id: guildId,
      enabled: enabled !== undefined ? enabled : (existingSettings?.enabled ?? false),
      reset_warnings_after_days: reset_warnings_after_days !== undefined ? reset_warnings_after_days : (existingSettings?.reset_warnings_after_days ?? 30)
    };

    const updatedSettings = await AutomodEscalationService.createOrUpdateSettings(settings);
    
    logInfo(LogCategory.API, `Updated automod settings for guild ${guildId}: enabled=${enabled}, reset_days=${reset_warnings_after_days}`);

    res.json({
      success: true,
      data: updatedSettings
    });
  } catch (error) {
    logError(LogCategory.API, `Error updating automod settings: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/automod-escalation/:guildId/rules - Get escalation rules
router.get('/:guildId/rules', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    
    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID is required'
      });
    }

    const rules = await AutomodEscalationService.getRules(guildId);

    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    logError(LogCategory.API, `Error getting automod rules: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/automod-escalation/:guildId/rules - Create escalation rule
router.post('/:guildId/rules', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const { warning_threshold, punishment_type, punishment_duration, punishment_reason, role_id, enabled } = req.body;
    
    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID is required'
      });
    }

    // Validate required fields
    if (!warning_threshold || !punishment_type || !punishment_reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: warning_threshold, punishment_type, punishment_reason'
      });
    }

    // Validate punishment type
    const validPunishments = ['timeout', 'kick', 'ban', 'role_remove', 'role_add', 'nothing'];
    if (!validPunishments.includes(punishment_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid punishment type'
      });
    }

    // Validate role_id for role punishments
    if ((punishment_type === 'role_add' || punishment_type === 'role_remove') && !role_id) {
      return res.status(400).json({
        success: false,
        error: 'Role ID is required for role-based punishments'
      });
    }

    const ruleData: Omit<AutomodEscalationRule, 'id' | 'created_at' | 'updated_at'> = {
      guild_id: guildId,
      warning_threshold: parseInt(warning_threshold),
      punishment_type,
      punishment_duration: punishment_duration ? parseInt(punishment_duration) : undefined,
      punishment_reason,
      role_id: role_id || undefined,
      enabled: enabled !== false // Default to true
    };

    const newRule = await AutomodEscalationService.createRule(ruleData);
    
    logInfo(LogCategory.API, `Created automod rule for guild ${guildId}: ${warning_threshold} warnings -> ${punishment_type}`);

    res.status(201).json({
      success: true,
      data: newRule
    });
  } catch (error) {
    logError(LogCategory.API, `Error creating automod rule: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PUT /api/automod-escalation/:guildId/rules/:ruleId - Update escalation rule
router.put('/:guildId/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { guildId, ruleId } = req.params;
    const updates = req.body;
    
    if (!guildId || !ruleId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID and Rule ID are required'
      });
    }

    // Validate punishment type if provided
    if (updates.punishment_type) {
      const validPunishments = ['timeout', 'kick', 'ban', 'role_remove', 'role_add', 'nothing'];
      if (!validPunishments.includes(updates.punishment_type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid punishment type'
        });
      }
    }

    // Convert string numbers to integers
    if (updates.warning_threshold) {
      updates.warning_threshold = parseInt(updates.warning_threshold);
    }
    if (updates.punishment_duration) {
      updates.punishment_duration = parseInt(updates.punishment_duration);
    }

    const updatedRule = await AutomodEscalationService.updateRule(parseInt(ruleId), updates);
    
    logInfo(LogCategory.API, `Updated automod rule ${ruleId} for guild ${guildId}`);

    res.json({
      success: true,
      data: updatedRule
    });
  } catch (error) {
    logError(LogCategory.API, `Error updating automod rule: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// DELETE /api/automod-escalation/:guildId/rules/:ruleId - Delete escalation rule
router.delete('/:guildId/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { guildId, ruleId } = req.params;
    
    if (!guildId || !ruleId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID and Rule ID are required'
      });
    }

    const deleted = await AutomodEscalationService.deleteRule(parseInt(ruleId));
    
    if (deleted) {
      logInfo(LogCategory.API, `Deleted automod rule ${ruleId} for guild ${guildId}`);
      res.json({
        success: true,
        message: 'Rule deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }
  } catch (error) {
    logError(LogCategory.API, `Error deleting automod rule: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/automod-escalation/:guildId/logs - Get escalation logs
router.get('/:guildId/logs', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID is required'
      });
    }

    const logs = await AutomodEscalationService.getEscalationLogs(
      guildId, 
      parseInt(limit as string), 
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    logError(LogCategory.API, `Error getting automod logs: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/automod-escalation/:guildId/stats - Get escalation statistics
router.get('/:guildId/stats', async (req: Request, res: Response) => {
  try {
    const { guildId } = req.params;
    
    if (!guildId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID is required'
      });
    }

    const stats = await AutomodEscalationService.getEscalationStats(guildId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logError(LogCategory.API, `Error getting automod stats: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/automod-escalation/:guildId/users/:userId/history - Get user escalation history
router.get('/:guildId/users/:userId/history', async (req: Request, res: Response) => {
  try {
    const { guildId, userId } = req.params;
    
    if (!guildId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Guild ID and User ID are required'
      });
    }

    const history = await AutomodEscalationService.getUserEscalationHistory(guildId, userId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logError(LogCategory.API, `Error getting user escalation history: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;