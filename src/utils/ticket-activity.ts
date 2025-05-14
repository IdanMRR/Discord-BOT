import { Message, ChannelType } from 'discord.js';
import { db } from '../database/sqlite';
import { logInfo, logError } from './logger';

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
    
    // Update the last_activity_at timestamp in the database
    db.prepare(`
      UPDATE tickets 
      SET last_activity_at = CURRENT_TIMESTAMP
      WHERE guild_id = ? AND ticket_number = ?
    `).run(message.guild.id, ticketNumber);
    
    logInfo('Ticket Activity', `Updated activity timestamp for ticket #${ticketNumber} in ${message.guild.name}`);
    return true;
  } catch (error) {
    logError('Ticket Activity', `Error updating ticket activity: ${error}`);
    return false;
  }
} 