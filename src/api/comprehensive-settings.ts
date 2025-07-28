import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { settingsManager } from '../services/settingsManager';
import { logInfo, logError } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/settings', limiter);

// Authentication middleware for all settings routes
app.use('/api/settings', authenticateToken);

// Validation middleware
const validateGuildId = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { guildId } = req.params;
  if (!guildId || !/^\d{17,19}$/.test(guildId)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid guild ID format' 
    });
  }
  next();
};

// Helper function for standardized responses
const sendResponse = (res: express.Response, success: boolean, data?: any, error?: string) => {
  res.json({
    success,
    data: success ? data : undefined,
    error: success ? undefined : error,
    timestamp: new Date().toISOString()
  });
};

// === ADVANCED SERVER SETTINGS ===

// GET /api/settings/:guildId/advanced-server
app.get('/api/settings/:guildId/advanced-server', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = settingsManager.getAdvancedServerSettings(guildId);
    
    sendResponse(res, true, settings);
    logInfo('SettingsAPI', `Retrieved advanced server settings for guild ${guildId}`);
  } catch (error) {
    logError('SettingsAPI', `Error retrieving advanced server settings: ${error}`);
    sendResponse(res, false, null, 'Failed to retrieve advanced server settings');
  }
});

// PUT /api/settings/:guildId/advanced-server
app.put('/api/settings/:guildId/advanced-server', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    const success = await settingsManager.updateAdvancedServerSettings(guildId, settings);
    
    if (success) {
      const updatedSettings = settingsManager.getAdvancedServerSettings(guildId);
      sendResponse(res, true, updatedSettings);
      logInfo('SettingsAPI', `Updated advanced server settings for guild ${guildId}`);
    } else {
      sendResponse(res, false, null, 'Failed to update advanced server settings');
    }
  } catch (error) {
    logError('SettingsAPI', `Error updating advanced server settings: ${error}`);
    sendResponse(res, false, null, 'Failed to update advanced server settings');
  }
});

// === AUTOMOD SETTINGS ===

// GET /api/settings/:guildId/automod
app.get('/api/settings/:guildId/automod', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = settingsManager.getAutomodSettings(guildId);
    
    sendResponse(res, true, settings);
    logInfo('SettingsAPI', `Retrieved automod settings for guild ${guildId}`);
  } catch (error) {
    logError('SettingsAPI', `Error retrieving automod settings: ${error}`);
    sendResponse(res, false, null, 'Failed to retrieve automod settings');
  }
});

// PUT /api/settings/:guildId/automod
app.put('/api/settings/:guildId/automod', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    const success = await settingsManager.updateAutomodSettings(guildId, settings);
    
    if (success) {
      const updatedSettings = settingsManager.getAutomodSettings(guildId);
      sendResponse(res, true, updatedSettings);
      logInfo('SettingsAPI', `Updated automod settings for guild ${guildId}`);
    } else {
      sendResponse(res, false, null, 'Failed to update automod settings');
    }
  } catch (error) {
    logError('SettingsAPI', `Error updating automod settings: ${error}`);
    sendResponse(res, false, null, 'Failed to update automod settings');
  }
});

// === WELCOME/LEAVE SETTINGS ===

// GET /api/settings/:guildId/welcome-leave
app.get('/api/settings/:guildId/welcome-leave', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = settingsManager.getWelcomeLeaveSettings(guildId);
    
    sendResponse(res, true, settings);
    logInfo('SettingsAPI', `Retrieved welcome/leave settings for guild ${guildId}`);
  } catch (error) {
    logError('SettingsAPI', `Error retrieving welcome/leave settings: ${error}`);
    sendResponse(res, false, null, 'Failed to retrieve welcome/leave settings');
  }
});

// PUT /api/settings/:guildId/welcome-leave
app.put('/api/settings/:guildId/welcome-leave', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    const success = await settingsManager.updateWelcomeLeaveSettings(guildId, settings);
    
    if (success) {
      const updatedSettings = settingsManager.getWelcomeLeaveSettings(guildId);
      sendResponse(res, true, updatedSettings);
      logInfo('SettingsAPI', `Updated welcome/leave settings for guild ${guildId}`);
    } else {
      sendResponse(res, false, null, 'Failed to update welcome/leave settings');
    }
  } catch (error) {
    logError('SettingsAPI', `Error updating welcome/leave settings: ${error}`);
    sendResponse(res, false, null, 'Failed to update welcome/leave settings');
  }
});

// === ROLE MANAGEMENT SETTINGS ===

// GET /api/settings/:guildId/role-management
app.get('/api/settings/:guildId/role-management', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = settingsManager.getRoleManagementSettings(guildId);
    
    sendResponse(res, true, settings);
    logInfo('SettingsAPI', `Retrieved role management settings for guild ${guildId}`);
  } catch (error) {
    logError('SettingsAPI', `Error retrieving role management settings: ${error}`);
    sendResponse(res, false, null, 'Failed to retrieve role management settings');
  }
});

// PUT /api/settings/:guildId/role-management
app.put('/api/settings/:guildId/role-management', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    const success = await settingsManager.updateRoleManagementSettings(guildId, settings);
    
    if (success) {
      const updatedSettings = settingsManager.getRoleManagementSettings(guildId);
      sendResponse(res, true, updatedSettings);
      logInfo('SettingsAPI', `Updated role management settings for guild ${guildId}`);
    } else {
      sendResponse(res, false, null, 'Failed to update role management settings');
    }
  } catch (error) {
    logError('SettingsAPI', `Error updating role management settings: ${error}`);
    sendResponse(res, false, null, 'Failed to update role management settings');
  }
});

// === ECONOMY SETTINGS ===

// GET /api/settings/:guildId/economy
app.get('/api/settings/:guildId/economy', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = settingsManager.getEconomySettings(guildId);
    
    sendResponse(res, true, settings);
    logInfo('SettingsAPI', `Retrieved economy settings for guild ${guildId}`);
  } catch (error) {
    logError('SettingsAPI', `Error retrieving economy settings: ${error}`);
    sendResponse(res, false, null, 'Failed to retrieve economy settings');
  }
});

// PUT /api/settings/:guildId/economy
app.put('/api/settings/:guildId/economy', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    const success = await settingsManager.updateEconomySettings(guildId, settings);
    
    if (success) {
      const updatedSettings = settingsManager.getEconomySettings(guildId);
      sendResponse(res, true, updatedSettings);
      logInfo('SettingsAPI', `Updated economy settings for guild ${guildId}`);
    } else {
      sendResponse(res, false, null, 'Failed to update economy settings');
    }
  } catch (error) {
    logError('SettingsAPI', `Error updating economy settings: ${error}`);
    sendResponse(res, false, null, 'Failed to update economy settings');
  }
});

// === LEVELING SETTINGS ===

// GET /api/settings/:guildId/leveling
app.get('/api/settings/:guildId/leveling', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = settingsManager.getLevelingSettings(guildId);
    
    sendResponse(res, true, settings);
    logInfo('SettingsAPI', `Retrieved leveling settings for guild ${guildId}`);
  } catch (error) {
    logError('SettingsAPI', `Error retrieving leveling settings: ${error}`);
    sendResponse(res, false, null, 'Failed to retrieve leveling settings');
  }
});

// PUT /api/settings/:guildId/leveling
app.put('/api/settings/:guildId/leveling', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    const success = await settingsManager.updateLevelingSettings(guildId, settings);
    
    if (success) {
      const updatedSettings = settingsManager.getLevelingSettings(guildId);
      sendResponse(res, true, updatedSettings);
      logInfo('SettingsAPI', `Updated leveling settings for guild ${guildId}`);
    } else {
      sendResponse(res, false, null, 'Failed to update leveling settings');
    }
  } catch (error) {
    logError('SettingsAPI', `Error updating leveling settings: ${error}`);
    sendResponse(res, false, null, 'Failed to update leveling settings');
  }
});

// === ENHANCED TICKET SETTINGS ===

// GET /api/settings/:guildId/tickets
app.get('/api/settings/:guildId/tickets', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = settingsManager.getEnhancedTicketSettings(guildId);
    
    sendResponse(res, true, settings);
    logInfo('SettingsAPI', `Retrieved ticket settings for guild ${guildId}`);
  } catch (error) {
    logError('SettingsAPI', `Error retrieving ticket settings: ${error}`);
    sendResponse(res, false, null, 'Failed to retrieve ticket settings');
  }
});

// PUT /api/settings/:guildId/tickets
app.put('/api/settings/:guildId/tickets', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    const success = await settingsManager.updateEnhancedTicketSettings(guildId, settings);
    
    if (success) {
      const updatedSettings = settingsManager.getEnhancedTicketSettings(guildId);
      sendResponse(res, true, updatedSettings);
      logInfo('SettingsAPI', `Updated ticket settings for guild ${guildId}`);
    } else {
      sendResponse(res, false, null, 'Failed to update ticket settings');
    }
  } catch (error) {
    logError('SettingsAPI', `Error updating ticket settings: ${error}`);
    sendResponse(res, false, null, 'Failed to update ticket settings');
  }
});

// === ENHANCED LOGGING SETTINGS ===

// GET /api/settings/:guildId/logging
app.get('/api/settings/:guildId/logging', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = settingsManager.getEnhancedLoggingSettings(guildId);
    
    sendResponse(res, true, settings);
    logInfo('SettingsAPI', `Retrieved logging settings for guild ${guildId}`);
  } catch (error) {
    logError('SettingsAPI', `Error retrieving logging settings: ${error}`);
    sendResponse(res, false, null, 'Failed to retrieve logging settings');
  }
});

// PUT /api/settings/:guildId/logging
app.put('/api/settings/:guildId/logging', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    const success = await settingsManager.updateEnhancedLoggingSettings(guildId, settings);
    
    if (success) {
      const updatedSettings = settingsManager.getEnhancedLoggingSettings(guildId);
      sendResponse(res, true, updatedSettings);
      logInfo('SettingsAPI', `Updated logging settings for guild ${guildId}`);
    } else {
      sendResponse(res, false, null, 'Failed to update logging settings');
    }
  } catch (error) {
    logError('SettingsAPI', `Error updating logging settings: ${error}`);
    sendResponse(res, false, null, 'Failed to update logging settings');
  }
});

// === GIVEAWAY SETTINGS ===

// GET /api/settings/:guildId/giveaways
app.get('/api/settings/:guildId/giveaways', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = settingsManager.getGiveawaySettings(guildId);
    
    sendResponse(res, true, settings);
    logInfo('SettingsAPI', `Retrieved giveaway settings for guild ${guildId}`);
  } catch (error) {
    logError('SettingsAPI', `Error retrieving giveaway settings: ${error}`);
    sendResponse(res, false, null, 'Failed to retrieve giveaway settings');
  }
});

// PUT /api/settings/:guildId/giveaways
app.put('/api/settings/:guildId/giveaways', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = req.body;
    
    const success = await settingsManager.updateGiveawaySettings(guildId, settings);
    
    if (success) {
      const updatedSettings = settingsManager.getGiveawaySettings(guildId);
      sendResponse(res, true, updatedSettings);
      logInfo('SettingsAPI', `Updated giveaway settings for guild ${guildId}`);
    } else {
      sendResponse(res, false, null, 'Failed to update giveaway settings');
    }
  } catch (error) {
    logError('SettingsAPI', `Error updating giveaway settings: ${error}`);
    sendResponse(res, false, null, 'Failed to update giveaway settings');
  }
});

// === BULK OPERATIONS ===

// GET /api/settings/:guildId/all - Get all settings for a guild
app.get('/api/settings/:guildId/all', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const allSettings = await settingsManager.getAllSettings(guildId);
    
    sendResponse(res, true, allSettings);
    logInfo('SettingsAPI', `Retrieved all settings for guild ${guildId}`);
  } catch (error) {
    logError('SettingsAPI', `Error retrieving all settings: ${error}`);
    sendResponse(res, false, null, 'Failed to retrieve all settings');
  }
});

// PUT /api/settings/:guildId/bulk - Bulk update multiple setting categories
app.put('/api/settings/:guildId/bulk', validateGuildId, async (req, res) => {
  try {
    const { guildId } = req.params;
    const { settings } = req.body;
    
    const results: Record<string, boolean> = {};
    
    // Process each settings category
    for (const [category, categorySettings] of Object.entries(settings)) {
      switch (category) {
        case 'advanced_server':
          results[category] = await settingsManager.updateAdvancedServerSettings(guildId, categorySettings as any);
          break;
        case 'automod':
          results[category] = await settingsManager.updateAutomodSettings(guildId, categorySettings as any);
          break;
        case 'welcome_leave':
          results[category] = await settingsManager.updateWelcomeLeaveSettings(guildId, categorySettings as any);
          break;
        case 'role_management':
          results[category] = await settingsManager.updateRoleManagementSettings(guildId, categorySettings as any);
          break;
        case 'economy':
          results[category] = await settingsManager.updateEconomySettings(guildId, categorySettings as any);
          break;
        case 'leveling':
          results[category] = await settingsManager.updateLevelingSettings(guildId, categorySettings as any);
          break;
        case 'tickets':
          results[category] = await settingsManager.updateEnhancedTicketSettings(guildId, categorySettings as any);
          break;
        case 'logging':
          results[category] = await settingsManager.updateEnhancedLoggingSettings(guildId, categorySettings as any);
          break;
        case 'giveaways':
          results[category] = await settingsManager.updateGiveawaySettings(guildId, categorySettings as any);
          break;
      }
    }
    
    const allSuccessful = Object.values(results).every(result => result);
    
    if (allSuccessful) {
      const updatedSettings = await settingsManager.getAllSettings(guildId);
      sendResponse(res, true, { results, settings: updatedSettings });
      logInfo('SettingsAPI', `Bulk updated settings for guild ${guildId}`);
    } else {
      sendResponse(res, false, results, 'Some settings failed to update');
    }
  } catch (error) {
    logError('SettingsAPI', `Error in bulk settings update: ${error}`);
    sendResponse(res, false, null, 'Failed to bulk update settings');
  }
});

// === SETTINGS TEMPLATES ===

// GET /api/settings/templates - Get all public settings templates
app.get('/api/settings/templates', async (req, res) => {
  try {
    const { category } = req.query;
    const templates = settingsManager.getSettingsTemplates(category as string);
    
    sendResponse(res, true, templates);
    logInfo('SettingsAPI', `Retrieved settings templates${category ? ` for category ${category}` : ''}`);
  } catch (error) {
    logError('SettingsAPI', `Error retrieving settings templates: ${error}`);
    sendResponse(res, false, null, 'Failed to retrieve settings templates');
  }
});

// POST /api/settings/templates - Save a new settings template
app.post('/api/settings/templates', async (req, res) => {
  try {
    const { name, description, category, templateData, createdBy } = req.body;
    
    if (!name || !description || !category || !templateData) {
      return sendResponse(res, false, null, 'Missing required fields');
    }
    
    const success = await settingsManager.saveSettingsTemplate(name, description, category, templateData, createdBy);
    
    if (success) {
      sendResponse(res, true, { message: 'Settings template saved successfully' });
      logInfo('SettingsAPI', `Saved settings template: ${name}`);
    } else {
      sendResponse(res, false, null, 'Failed to save settings template');
    }
  } catch (error) {
    logError('SettingsAPI', `Error saving settings template: ${error}`);
    sendResponse(res, false, null, 'Failed to save settings template');
  }
});

// === VALIDATION ENDPOINTS ===

// POST /api/settings/validate - Validate settings before saving
app.post('/api/settings/validate', async (req, res) => {
  try {
    const { category, settings } = req.body;
    
    // This would implement validation logic based on the category
    // For now, we'll return success as the validation is done in the settings manager
    sendResponse(res, true, { valid: true, errors: [] });
  } catch (error) {
    logError('SettingsAPI', `Error validating settings: ${error}`);
    sendResponse(res, false, null, 'Failed to validate settings');
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logError('SettingsAPI', `Unhandled error: ${error.message}`);
  sendResponse(res, false, null, 'Internal server error');
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  sendResponse(res, false, null, 'Endpoint not found');
});

const PORT = process.env.SETTINGS_API_PORT || 3003;

app.listen(PORT, () => {
  logInfo('SettingsAPI', `Comprehensive Settings API server running on port ${PORT}`);
});

export { app };