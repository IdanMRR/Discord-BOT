import { Message, ChannelType } from 'discord.js';
import { db } from '../database/sqlite';
import { logInfo, logError } from './logger';
import { ServerSettingsService } from '../database/services/serverSettingsService';

/**
 * Update the last activity timestamp for a ticket
 * Called whenever a message is sent in a ticket channel
 * 
 * @param message The Discord message
 * @returns Whether the update was successful
 */
export async function updateTicketActivity(message: Message): Promise<boolean> {
  try {
    // Skip if not in a guild or not a text channel
    if (!message.guild || !message.channel || message.channel.type !== ChannelType.GuildText) {
      return false;
    }
    
    // Only process ticket channels (by name pattern)
    const channelName = message.channel.name;
    if (!channelName.toLowerCase().includes('ticket-')) {
      return false;
    }
    
    // Try to extract the ticket number from the channel name
    const match = channelName.match(/ticket-(\d+)/i);
    if (!match) {
      return false;
    }
    
    const ticketNumber = parseInt(match[1]);
    
    // Update the last_activity_at and updated_at timestamps in the database
    try {
      db.prepare(`
        UPDATE tickets 
        SET last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE guild_id = ? AND ticket_number = ?
      `).run(message.guild.id, ticketNumber);
    } catch (dbError: any) {
      // Fallback: try last_message_at if last_activity_at column doesn't exist
      if (dbError.message && dbError.message.includes('no such column: last_activity_at')) {
        try {
          db.prepare(`
            UPDATE tickets 
            SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = ? AND ticket_number = ?
          `).run(message.guild.id, ticketNumber);
        } catch (fallbackError: any) {
          // Final fallback: just update updated_at if it exists
          if (fallbackError.message && fallbackError.message.includes('no such column: last_message_at')) {
            db.prepare(`
              UPDATE tickets 
              SET updated_at = CURRENT_TIMESTAMP
              WHERE guild_id = ? AND ticket_number = ?
            `).run(message.guild.id, ticketNumber);
          } else {
            throw fallbackError;
          }
        }
      } else {
        throw dbError;
      }
    }
    
    // If message is from a staff member, update staff activity
    if (!message.author.bot) {
      await updateStaffActivity(message, ticketNumber);
    }
    
    // Only log on errors - activity updates are too frequent for console logging
    return true;
  } catch (error) {
    logError('Ticket Activity', `Error updating ticket activity: ${error}`);
    return false;
  }
}

/**
 * Update the staff activity for a ticket
 * Called when a staff member sends a message in a ticket channel
 * 
 * @param message The Discord message
 * @param ticketNumber The ticket number
 * @returns Whether the update was successful
 */
async function updateStaffActivity(message: Message, ticketNumber: number): Promise<boolean> {
  try {
    if (!message.guild || !message.member) return false;
    
    // Get server settings to check if the user is a staff member
    const serverSettings = await ServerSettingsService.getOrCreate(message.guild.id, message.guild.name);
    if (!serverSettings || !serverSettings.staff_role_ids) return false;
    
    // Handle staff role IDs - could be an array or a string depending on how it was stored
    let staffRoleIds: string[] = [];
    
    if (Array.isArray(serverSettings.staff_role_ids)) {
      staffRoleIds = serverSettings.staff_role_ids;
    } else if (typeof serverSettings.staff_role_ids === 'string') {
      // Handle comma-separated string format
      const roleIdsStr: string = serverSettings.staff_role_ids;
      staffRoleIds = roleIdsStr.split(',').map((id: string) => id.trim());
    }
    
    // Check if the user has any staff role
    const isStaff = message.member.roles.cache.some(role => staffRoleIds.includes(role.id));
    if (!isStaff) return false;
    
    // Get the ticket ID from the database
    const ticketQuery = db.prepare('SELECT id FROM tickets WHERE guild_id = ? AND ticket_number = ?');
    const ticket = ticketQuery.get(message.guild.id, ticketNumber) as any;
    
    if (!ticket) {
      logError('Ticket Activity', `Could not find ticket #${ticketNumber} in database`);
      return false;
    }
    
    // Check if the ticket_staff_activity table exists
    try {
      // Try to update existing record first
      const updateStmt = db.prepare(`
        UPDATE ticket_staff_activity 
        SET last_activity = CURRENT_TIMESTAMP 
        WHERE ticket_id = ? AND staff_id = ?
      `);
      
      const updateResult = updateStmt.run(ticket.id, message.author.id);
      
      // If no record was updated, insert a new one
      if (updateResult.changes === 0) {
        const insertStmt = db.prepare(`
          INSERT INTO ticket_staff_activity (ticket_id, guild_id, staff_id, last_activity)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        insertStmt.run(ticket.id, message.guild.id, message.author.id);
      }
      
      // Only log on errors - staff activity updates are too frequent for console logging
      return true;
    } catch (error) {
      // If there's an error (like table doesn't exist), log it but don't fail
      logError('Ticket Chatbot', `Error logging staff activity: ${error}`);
      return false;
    }
  } catch (error) {
    logError('Ticket Staff Activity', `Error updating staff activity: ${error}`);
    return false;
  }
}