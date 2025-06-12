import { db } from './sqlite';
import { logInfo, logError } from '../utils/logger';

export async function seedServerSettings() {
  try {
    // Check if database is available
    if (!db) {
      logError('Database', 'Database not available for seeding');
      return;
    }

    // Check if server settings already exist  
    const guildId = process.env.TEST_GUILD_ID || 'default';
    const existingSettings = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
    
    if (!existingSettings) {
      // Insert new server settings with sample channel IDs
      const insertStmt = db.prepare(`
        INSERT INTO server_settings (
          guild_id,
          name,
          member_log_channel_id,
          mod_log_channel_id,
          ticket_logs_channel_id,
          welcome_channel_id,
          log_channel_id,
          server_log_channel_id,
          language
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertStmt.run(
        guildId,
        'Coding API',
        '1375122365557510248', // member logs
        '1375122370880213112', // mod logs
        '1375122264797745272', // ticket logs
        '1372279045693247488', // welcome channel
        '1375122264797745272', // general logs
        '1375122370880213112', // server logs
        'en'
      );
      
      logInfo('Database', 'Server settings seeded successfully');
    } else {
      // Update existing settings to add channel IDs if they're missing
      const updateStmt = db.prepare(`
        UPDATE server_settings 
        SET 
          member_log_channel_id = COALESCE(member_log_channel_id, ?),
          mod_log_channel_id = COALESCE(mod_log_channel_id, ?),
          ticket_logs_channel_id = COALESCE(ticket_logs_channel_id, ?),
          welcome_channel_id = COALESCE(welcome_channel_id, ?),
          log_channel_id = COALESCE(log_channel_id, ?),
          server_log_channel_id = COALESCE(server_log_channel_id, ?)
        WHERE guild_id = ?
      `);
      
      updateStmt.run(
        '1375122365557510248', // member logs
        '1375122370880213112', // mod logs
        '1375122264797745272', // ticket logs
        '1372279045693247488', // welcome channel
        '1375122264797745272', // general logs
        '1375122370880213112', // server logs
        guildId
      );
      
      logInfo('Database', 'Server settings updated with channel IDs');
    }
  } catch (error) {
    logError('Database', `Error seeding server settings: ${error}`);
  }
} 