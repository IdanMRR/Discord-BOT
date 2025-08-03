import express, { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { integrationService } from '../services/integrationService';
import { scheduledTaskService } from '../services/scheduledTaskService';
import { getIntegrationManager, getWebhookHandler } from '../handlers/integrations/integration-initializer';
import { logInfo, logError } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// Validation middleware
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// ==========================================
// INTEGRATION ROUTES
// ==========================================

// Get all integrations for a guild
router.get('/', 
  query('guild_id').isString().notEmpty(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { guild_id } = req.query;
    
    try {
      const integrations = await integrationService.getGuildIntegrations(guild_id as string);
      res.json({
        success: true,
        data: integrations
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error fetching integrations: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch integrations'
      });
    }
  })
);

// Get specific integration
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const integrationId = parseInt(req.params.id);
    
    try {
      const integration = await integrationService.getIntegration(integrationId);
      if (!integration) {
        return res.status(404).json({
          success: false,
          message: 'Integration not found'
        });
      }
      
      res.json({
        success: true,
        data: integration
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error fetching integration: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch integration'
      });
    }
  })
);

// Create new integration
router.post('/',
  body('guild_id').isString().notEmpty(),
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('integration_type').isIn(['webhook', 'api', 'rss', 'github', 'twitter', 'twitch', 'youtube', 'minecraft', 'steam', 'custom']),
  body('provider').isString().notEmpty(),
  body('config').isObject(),
  body('target_channel_id').optional().isString(),
  body('sync_frequency').optional().isInt({ min: 0 }),
  body('message_template').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const integrationData = {
        ...req.body,
        is_active: req.body.is_active ?? true,
        sync_count: 0,
        error_count: 0,
        created_by: req.body.created_by || 'api'
      };
      
      const integrationId = await integrationService.createIntegration(integrationData);
      
      logInfo('IntegrationsAPI', `Created integration ${integrationData.name} with ID ${integrationId}`);
      
      res.status(201).json({
        success: true,
        message: 'Integration created successfully',
        data: { id: integrationId }
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error creating integration: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to create integration'
      });
    }
  })
);

// Update integration
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().isLength({ min: 1, max: 100 }),
  body('config').optional().isObject(),
  body('target_channel_id').optional().isString(),
  body('sync_frequency').optional().isInt({ min: 0 }),
  body('message_template').optional().isString(),
  body('is_active').optional().isBoolean(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const integrationId = parseInt(req.params.id);
    
    try {
      await integrationService.updateIntegration(integrationId, req.body);
      
      logInfo('IntegrationsAPI', `Updated integration ${integrationId}`);
      
      res.json({
        success: true,
        message: 'Integration updated successfully'
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error updating integration: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to update integration'
      });
    }
  })
);

// Toggle integration status
router.patch('/:id',
  param('id').isInt({ min: 1 }),
  body('is_active').isBoolean(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const integrationId = parseInt(req.params.id);
    
    try {
      await integrationService.updateIntegration(integrationId, { is_active: req.body.is_active });
      
      logInfo('IntegrationsAPI', `Toggled integration ${integrationId} to ${req.body.is_active ? 'active' : 'inactive'}`);
      
      res.json({
        success: true,
        message: `Integration ${req.body.is_active ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error toggling integration: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle integration'
      });
    }
  })
);

// Delete integration
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const integrationId = parseInt(req.params.id);
    
    try {
      await integrationService.deleteIntegration(integrationId);
      
      logInfo('IntegrationsAPI', `Deleted integration ${integrationId}`);
      
      res.json({
        success: true,
        message: 'Integration deleted successfully'
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error deleting integration: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to delete integration'
      });
    }
  })
);

// Manually sync integration
router.post('/:id/sync',
  param('id').isInt({ min: 1 }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const integrationId = parseInt(req.params.id);
    
    try {
      const integrationManager = getIntegrationManager();
      if (!integrationManager) {
        return res.status(503).json({
          success: false,
          message: 'Integration manager not initialized'
        });
      }
      
      // This would trigger a manual sync - implementation depends on your integration manager
      logInfo('IntegrationsAPI', `Manual sync requested for integration ${integrationId}`);
      
      res.json({
        success: true,
        message: 'Integration sync started'
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error syncing integration: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to sync integration'
      });
    }
  })
);

// Get integration logs
router.get('/:id/logs',
  param('id').isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const integrationId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    
    try {
      const logs = await integrationService.getIntegrationLogs(integrationId, limit);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error fetching integration logs: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch integration logs'
      });
    }
  })
);

// ==========================================
// WEBHOOK ROUTES
// ==========================================

// Get all webhooks for a guild
router.get('/webhooks',
  query('guild_id').isString().notEmpty(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { guild_id } = req.query;
    
    try {
      const webhooks = await integrationService.getGuildWebhooks(guild_id as string);
      res.json({
        success: true,
        data: webhooks
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error fetching webhooks: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch webhooks'
      });
    }
  })
);

// Create new webhook
router.post('/webhooks',
  body('guild_id').isString().notEmpty(),
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('webhook_url').isURL(),
  body('events').isArray().notEmpty(),
  body('secret_token').optional().isString(),
  body('rate_limit_per_minute').optional().isInt({ min: 1, max: 1000 }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const webhookData = {
        ...req.body,
        is_active: req.body.is_active ?? true,
        rate_limit_per_minute: req.body.rate_limit_per_minute || 60,
        max_payload_size: req.body.max_payload_size || 1048576,
        timeout_seconds: req.body.timeout_seconds || 30,
        retry_attempts: req.body.retry_attempts || 3,
        success_count: 0,
        failure_count: 0,
        created_by: req.body.created_by || 'api'
      };
      
      const webhookId = await integrationService.createWebhook(webhookData);
      
      logInfo('IntegrationsAPI', `Created webhook ${webhookData.name} with ID ${webhookId}`);
      
      res.status(201).json({
        success: true,
        message: 'Webhook created successfully',
        data: { id: webhookId }
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error creating webhook: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to create webhook'
      });
    }
  })
);

// Webhook handler endpoint
router.post('/webhooks/:id/receive',
  param('id').isInt({ min: 1 }),
  asyncHandler(async (req: Request, res: Response) => {
    const webhookId = parseInt(req.params.id);
    
    try {
      const webhookHandler = getWebhookHandler();
      if (!webhookHandler) {
        return res.status(503).json({
          success: false,
          message: 'Webhook handler not initialized'
        });
      }
      
      // Set the webhook ID in the request params for the handler
      req.params.webhookId = webhookId.toString();
      
      // Let the webhook handler process this request
      await webhookHandler.handleWebhook(req, res);
    } catch (error) {
      logError('IntegrationsAPI', `Error processing webhook: ${error}`);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Failed to process webhook'
        });
      }
    }
  })
);

// ==========================================
// SCHEDULED TASKS ROUTES
// ==========================================

// Get all scheduled tasks for a guild
router.get('/scheduled-tasks',
  query('guild_id').isString().notEmpty(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { guild_id } = req.query;
    
    try {
      const tasks = await scheduledTaskService.getGuildScheduledTasks(guild_id as string);
      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error fetching scheduled tasks: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch scheduled tasks'
      });
    }
  })
);

// Create new scheduled task
router.post('/scheduled-tasks',
  body('guild_id').isString().notEmpty(),
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('task_type').isIn(['message', 'announcement', 'role_assignment', 'channel_action', 'moderation', 'custom']),
  body('trigger_type').isIn(['cron', 'interval', 'once', 'event']),
  body('cron_expression').optional().isString(),
  body('interval_seconds').optional().isInt({ min: 60 }),
  body('scheduled_time').optional().isISO8601(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const taskData = {
        ...req.body,
        is_active: req.body.is_active ?? true,
        execution_count: 0,
        error_count: 0,
        timezone: req.body.timezone || 'UTC',
        created_by: req.body.created_by || 'api'
      };
      
      const taskId = await scheduledTaskService.createScheduledTask(taskData);
      
      logInfo('IntegrationsAPI', `Created scheduled task ${taskData.name} with ID ${taskId}`);
      
      res.status(201).json({
        success: true,
        message: 'Scheduled task created successfully',
        data: { id: taskId }
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error creating scheduled task: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to create scheduled task'
      });
    }
  })
);

// Get all automation rules for a guild
router.get('/automation-rules',
  query('guild_id').isString().notEmpty(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { guild_id } = req.query;
    
    try {
      const rules = await scheduledTaskService.getGuildAutomationRules(guild_id as string);
      res.json({
        success: true,
        data: rules
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error fetching automation rules: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch automation rules'
      });
    }
  })
);

// Create new automation rule
router.post('/automation-rules',
  body('guild_id').isString().notEmpty(),
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('trigger_event').isIn(['member_join', 'member_leave', 'message_sent', 'reaction_added', 'role_assigned', 'voice_join', 'voice_leave', 'custom']),
  body('actions').isArray().notEmpty(),
  body('priority').optional().isInt({ min: 0, max: 100 }),
  body('cooldown_seconds').optional().isInt({ min: 0 }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const ruleData = {
        ...req.body,
        is_active: req.body.is_active ?? true,
        priority: req.body.priority || 0,
        cooldown_seconds: req.body.cooldown_seconds || 0,
        execution_count: 0,
        success_count: 0,
        error_count: 0,
        created_by: req.body.created_by || 'api'
      };
      
      const ruleId = await scheduledTaskService.createAutomationRule(ruleData);
      
      logInfo('IntegrationsAPI', `Created automation rule ${ruleData.name} with ID ${ruleId}`);
      
      res.status(201).json({
        success: true,
        message: 'Automation rule created successfully',
        data: { id: ruleId }
      });
    } catch (error) {
      logError('IntegrationsAPI', `Error creating automation rule: ${error}`);
      res.status(500).json({
        success: false,
        message: 'Failed to create automation rule'
      });
    }
  })
);

export default router;