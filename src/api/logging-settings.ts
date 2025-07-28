import express from 'express';
import { Request, Response } from 'express';
import { db } from '../database/sqlite';
import { logInfo, logError } from '../utils/logger';
import { createValidationMiddleware, commonSchemas } from '../middleware/validation';
import { DashboardLogsService } from '../database/services/dashboardLogsService';
import { getClient, isClientReady } from '../utils/client-utils';

const router = express.Router();

interface LoggingSettings {
  id?: number;
  guild_id: string;
  message_delete_logging: number;
  message_edit_logging: number;
  command_logging: number;
  dm_logging: number;
  log_channel_id?: string;
  message_log_channel_id?: string;
  command_log_channel_id?: string;
  dm_log_channel_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Helper function to get logging settings
function getLoggingSettings(guildId: string): LoggingSettings | null {
  try {
    const stmt = db.prepare('SELECT * FROM logging_settings WHERE guild_id = ?');
    return stmt.get(guildId) as LoggingSettings | undefined || null;
  } catch (error) {
    logError('Logging Settings API', `Error getting settings: ${error}`);
    return null;
  }
}

// Helper function to ensure logging settings exist with defaults
function ensureLoggingSettings(guildId: string): LoggingSettings | null {
  try {
    const existing = getLoggingSettings(guildId);
    if (existing) return existing;
    
    const stmt = db.prepare(`
      INSERT INTO logging_settings (guild_id, message_delete_logging, message_edit_logging, command_logging, dm_logging)
      VALUES (?, 1, 1, 1, 0)
    `);
    stmt.run(guildId);
    
    return getLoggingSettings(guildId);
  } catch (error) {
    logError('Logging Settings API', `Error ensuring settings: ${error}`);
    return null;
  }
}

// Helper function to update logging settings
function updateLoggingSettings(guildId: string, updates: Partial<LoggingSettings>): boolean {
  try {
    // Ensure settings exist first
    ensureLoggingSettings(guildId);
    
    const fields: string[] = [];
    const values: any[] = [];
    
    // Build dynamic update query
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'guild_id' && key !== 'created_at' && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    if (fields.length === 0) {
      return true; // No updates needed
    }
    
    // Add updated_at timestamp
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(guildId);
    
    const query = `UPDATE logging_settings SET ${fields.join(', ')} WHERE guild_id = ?`;
    const stmt = db.prepare(query);
    const result = stmt.run(...values);
    
    return result.changes > 0;
  } catch (error) {
    logError('Logging Settings API', `Error updating settings: ${error}`);
    return false;
  }
}

// Convert database format (0/1) to boolean format for frontend
function convertToBoolean(settings: LoggingSettings): any {
  return {
    ...settings,
    message_delete_logging: !!settings.message_delete_logging,
    message_edit_logging: !!settings.message_edit_logging,
    command_logging: !!settings.command_logging,
    dm_logging: !!settings.dm_logging
  };
}

// Convert frontend format (boolean) to database format (0/1)
function convertToDatabase(settings: any): Partial<LoggingSettings> {
  const dbSettings: any = { ...settings };
  
  // Convert booleans to integers
  if (typeof settings.message_delete_logging === 'boolean') {
    dbSettings.message_delete_logging = settings.message_delete_logging ? 1 : 0;
  }
  if (typeof settings.message_edit_logging === 'boolean') {
    dbSettings.message_edit_logging = settings.message_edit_logging ? 1 : 0;
  }
  if (typeof settings.command_logging === 'boolean') {
    dbSettings.command_logging = settings.command_logging ? 1 : 0;
  }
  if (typeof settings.dm_logging === 'boolean') {
    dbSettings.dm_logging = settings.dm_logging ? 1 : 0;
  }
  
  return dbSettings;
}

// GET /api/servers/:serverId/logging-settings
router.get('/:serverId/logging-settings', 
  createValidationMiddleware({ serverId: commonSchemas.discordId }, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { serverId } = req.params;
      
      logInfo('Logging Settings API', `Getting logging settings for server ${serverId}`);
      
      // Get or create settings with defaults
      const settings = ensureLoggingSettings(serverId);
      
      if (!settings) {
        logError('Logging Settings API', `Failed to get/create settings for server ${serverId}`);
        return res.status(500).json({
          success: false,
          error: 'Failed to retrieve logging settings'
        });
      }
      
      // Convert to boolean format for frontend
      const responseSettings = convertToBoolean(settings);
      
      logInfo('Logging Settings API', `Successfully retrieved settings for server ${serverId}`);
      
      return res.json({
        success: true,
        data: responseSettings
      });
      
    } catch (error: any) {
      logError('Logging Settings API', `Error getting settings for server ${req.params.serverId}: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// PUT /api/servers/:serverId/logging-settings
router.put('/:serverId/logging-settings',
  createValidationMiddleware({ serverId: commonSchemas.discordId }, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { serverId } = req.params;
      const updates = req.body;
      
      logInfo('Logging Settings API', `Updating logging settings for server ${serverId}: ${JSON.stringify(updates)}`);
      
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Invalid settings data provided'
        });
      }
      
      // Convert boolean values to database format
      const dbUpdates = convertToDatabase(updates);
      
      // Update settings
      const success = updateLoggingSettings(serverId, dbUpdates);
      
      if (!success) {
        logError('Logging Settings API', `Failed to update settings for server ${serverId}`);
        return res.status(500).json({
          success: false,
          error: 'Failed to update logging settings'
        });
      }
      
      // Get updated settings to return
      const updatedSettings = getLoggingSettings(serverId);
      if (!updatedSettings) {
        logError('Logging Settings API', `Failed to retrieve updated settings for server ${serverId}`);
        return res.status(500).json({
          success: false,
          error: 'Failed to retrieve updated settings'
        });
      }
      
      // Convert to boolean format for frontend
      const responseSettings = convertToBoolean(updatedSettings);
      
      logInfo('Logging Settings API', `Successfully updated settings for server ${serverId}`);
      
      // Enhanced dashboard activity logging with Discord usernames
      try {
        // Get admin username from Discord
        let adminUsername = 'Unknown Admin';
        const adminUserId = req.user?.userId;
        if (adminUserId) {
          try {
            const client = getClient();
            if (client && isClientReady()) {
              const adminUser = await client.users.fetch(adminUserId).catch(() => null);
              if (adminUser) {
                adminUsername = adminUser.username;
              }
            }
          } catch (fetchError) {
            adminUsername = req.user?.username || `Admin ${adminUserId.slice(-4)}`;
          }
        }

        // Log the server settings update
        await DashboardLogsService.logActivity({
          user_id: adminUserId || 'unknown',
          username: adminUsername,
          action_type: 'logging_settings_update',
          page: 'server_settings',
          target_type: 'server',
          target_id: serverId,
          old_value: 'Previous logging settings', // Could fetch old settings for comparison
          new_value: JSON.stringify(responseSettings),
          details: `⚙️ Logging Settings Update: ${adminUsername} updated logging settings for server ${serverId}.\n📝 Changes: Message Delete=${responseSettings.message_delete_logging ? 'ENABLED' : 'DISABLED'} | Message Edit=${responseSettings.message_edit_logging ? 'ENABLED' : 'DISABLED'} | Commands=${responseSettings.command_logging ? 'ENABLED' : 'DISABLED'} | DMs=${responseSettings.dm_logging ? 'ENABLED' : 'DISABLED'}`,
          success: true,
          guild_id: serverId
        });
      } catch (logErr) {
        logError('Logging Settings API', `Error logging settings update activity: ${logErr}`);
      }
      
      return res.json({
        success: true,
        data: responseSettings
      });
      
    } catch (error: any) {
      logError('Logging Settings API', `Error updating settings for server ${req.params.serverId}: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

export default router;