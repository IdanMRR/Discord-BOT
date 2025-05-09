import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add red_alert_channels column to server_settings table
 * This column will store a JSON array of channel IDs where red alerts should be sent
 */
export async function migrateAddRedAlertChannels(): Promise<void> {
  try {
    // Check if the column already exists
    const columns = db.prepare("PRAGMA table_info(server_settings)").all();
    const hasColumn = columns.some((col: any) => col.name === 'red_alert_channels');
    
    if (!hasColumn) {
      logInfo('Migration', 'Adding red_alert_channels column to server_settings table');
      db.exec('ALTER TABLE server_settings ADD COLUMN red_alert_channels TEXT DEFAULT "[]"');
      logInfo('Migration', 'Successfully added red_alert_channels column');
      
      // If there's an existing RED_ALERT_CHANNEL_IDS in the .env, we should migrate those
      // to the database for each server to maintain backward compatibility
      const envAlertChannels = process.env.RED_ALERT_CHANNEL_IDS?.split(',').filter(id => id) || [];
      
      if (envAlertChannels.length > 0) {
        // Get all server IDs from the database
        const servers = db.prepare('SELECT guild_id FROM server_settings').all() as { guild_id: string }[];
        
        if (servers.length > 0) {
          logInfo('Migration', `Migrating ${envAlertChannels.length} red alert channels from .env to database for ${servers.length} servers`);
          
          // For each server, set the red_alert_channels to the list from .env
          const updateStmt = db.prepare('UPDATE server_settings SET red_alert_channels = ? WHERE guild_id = ?');
          
          for (const server of servers) {
            try {
              updateStmt.run(JSON.stringify(envAlertChannels), server.guild_id);
            } catch (updateError) {
              logError('Migration', `Error updating red_alert_channels for server ${server.guild_id}: ${updateError}`);
            }
          }
          
          logInfo('Migration', 'Completed migration of red alert channels from .env to database');
        }
      }
    } else {
      logInfo('Migration', 'red_alert_channels column already exists in server_settings table');
    }
  } catch (error) {
    logError('Migration', `Error adding red_alert_channels column: ${error}`);
    throw error;
  }
} 