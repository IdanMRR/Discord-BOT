import { db } from '../database/sqlite';
import { logError, logInfo } from '../utils/logger';
import { ServerSettingsService } from '../database/services/serverSettingsService';
import { TicketTranscriptService } from '../database/services/ticketTranscriptService';
import { createTextTranscript } from '../utils/transcript-utils';
import { TextChannel, NewsChannel, ThreadChannel, PermissionFlagsBits } from 'discord.js';
import { createModerationEmbed } from '../utils/embeds';
import { getClient } from '../utils/client-utils';

/**
 * This file contains helper functions for the ticket API
 * to improve reliability and avoid duplicate code
 */

/**
 * Helper function to verify if a ticket can be modified
 * @param ticketId The ID of the ticket to check
 * @param allowDeleted Optional parameter to allow operations on deleted tickets (for transcript viewing)
 * @param actionType Optional parameter to specify the type of action being performed
 * @returns Object with ticket data and success/error info
 */
export async function validateTicketAction(ticketId: number, allowDeleted: boolean = false) {
  try {
    // Get the ticket to find its channel ID for sending a message
    const ticketQuery = db.prepare('SELECT * FROM tickets WHERE id = ?');
    const ticket = ticketQuery.get(ticketId) as any; // Use type assertion to avoid TypeScript errors
    
    if (!ticket) {
      return { 
        success: false, 
        error: 'Ticket not found',
        status: 404,
        ticket: null
      };
    }
    
    // Prevent operations on deleted tickets unless explicitly allowed
    if (ticket.status === 'deleted' && !allowDeleted) {
      return { 
        success: false, 
        error: 'Cannot modify a deleted ticket',
        status: 400,
        ticket: null
      };
    }
    
    return {
      success: true,
      error: null,
      status: 200,
      ticket
    };
  } catch (error) {
    logError('TicketHandlers', `Error validating ticket action: ${error}`);
    return {
      success: false,
      error: 'Error validating ticket',
      status: 500,
      ticket: null
    };
  }
}

/**
 * Helper function to send a ticket update notification to both the ticket channel and log channel
 * Also handles sending transcript to the user for closed and deleted tickets
 */
export async function sendTicketNotification(ticket: any, action: 'closed' | 'reopened' | 'deleted', reason?: string): Promise<void> {
  try {
    const client = getClient();
    if (!client) {
      logError('TicketHandlers', 'Discord client not available');
      return;
    }
    
    // For closed or deleted tickets, send a transcript to the user
    if (action === 'closed' || action === 'deleted') {
      try {
        // Get the user to send the transcript to
        const user = await client.users.fetch(ticket.user_id).catch((err: Error) => {
          logError('TicketHandlers', `Error fetching user for transcript: ${err.message}`);
          return null;
        });
        
        if (user) {
          // Get the stored transcript from the database
          const storedTranscript = await TicketTranscriptService.getTranscript(ticket.id);
          
          if (storedTranscript && storedTranscript.transcript) {
            // Create a simple text transcript for the user
            const textTranscript = createTextTranscript(storedTranscript.transcript);
            
            // Send the transcript to the user
            const transcriptEmbed = {
              color: 0x5865F2, // Discord blue
              title: `Ticket #${ticket.ticket_number} Transcript`,
              description: `Your ticket has been ${action}. A transcript is attached for your records.`,
              footer: {
                text: `Ticket ID: ${ticket.id} | ${action.charAt(0).toUpperCase() + action.slice(1)} on: ${new Date().toLocaleString()}`
              }
            };
            
            // Send the embed and the transcript as a text file
            await user.send({ embeds: [transcriptEmbed] });
            
            // Create a buffer from the text transcript
            const buffer = Buffer.from(textTranscript, 'utf-8');
            
            // Send the transcript as a file attachment
            await user.send({
              files: [{
                attachment: buffer,
                name: `ticket-${ticket.ticket_number}-transcript.txt`
              }]
            });
            
            logInfo('TicketHandlers', `Sent transcript for ticket #${ticket.ticket_number} to user ${user.tag}`);
          } else {
            logError('TicketHandlers', `Could not find stored transcript for ticket #${ticket.ticket_number}`);
          }
        }
      } catch (transcriptError) {
        logError('TicketHandlers', `Error sending transcript to user: ${transcriptError}`);
        // Continue with notification even if transcript fails
      }
    }
    
    // First try to get the server's log channel
    try {
      // Default to the guild ID in the ticket
      const guildId = ticket.guild_id;
      if (guildId) {
        const guild = await client.guilds.fetch(guildId);
        if (guild) {
          // Get the server settings to find the appropriate log channel
          const serverSettings = await ServerSettingsService.getOrCreate(guildId, guild.name);
          
          // Check for ticket logs channel first, then fall back to general log channel
          const logChannelId = serverSettings?.ticket_logs_channel_id || serverSettings?.log_channel_id;
          
          if (logChannelId) {
            try {
              const logChannel = await guild.channels.fetch(logChannelId) as TextChannel;
              
              if (logChannel && logChannel.isTextBased()) {
                // Create embed for log channel
                const logEmbed = {
                  color: action === 'reopened' ? 0x00ff00 : (action === 'closed' ? 0xff0000 : 0x5865F2), // Red for closed, Green for reopened, Discord blue for deleted
                  title: action === 'reopened' ? '🔓 Ticket Reopened' : (action === 'closed' ? '🔒 Ticket Closed' : '🗑️ Ticket Deleted'),
                  description: `Ticket #${ticket.id} has been ${action} via Dashboard.${reason ? `\n**Reason:** ${reason}` : ''}`,
                  fields: [
                    { name: 'Ticket ID', value: `${ticket.id}`, inline: true },
                    { name: 'User', value: ticket.user_id ? `<@${ticket.user_id}>` : 'Unknown', inline: true },
                    { name: 'Status', value: action === 'reopened' ? 'Reopened' : (action === 'closed' ? 'Closed' : 'Deleted'), inline: true }
                  ],
                  footer: {
                    text: `${action.charAt(0).toUpperCase() + action.slice(1)} via Dashboard`
                  },
                  timestamp: new Date().toISOString()
                };
                
                await logChannel.send({ embeds: [logEmbed] });
                logInfo('TicketHandlers', `Sent ticket ${action} notification to log channel ${logChannelId}`);
              }
            } catch (logChannelError: any) {
              logError('TicketHandlers', `Error sending to log channel: ${logChannelError}`);
            }
          }
        }
      }
    } catch (serverError) {
      logError('TicketHandlers', `Error getting server info for logging: ${serverError}`);
    }

    // Now try to send a message to the ticket channel itself
    if (ticket.channel_id) {
      // Validate the channel ID before attempting to fetch
      if (!/^\d+$/.test(ticket.channel_id)) {
        logError('TicketHandlers', `Invalid channel ID format: ${ticket.channel_id}`);
      } else {
        try {
          // Check if the channel exists and is accessible
          const channel = await client.channels.fetch(ticket.channel_id);
          
          // Ensure the channel is a TextChannel which has the required methods
          if (channel && channel.isTextBased() && (channel instanceof TextChannel || channel instanceof NewsChannel || channel instanceof ThreadChannel)) {
            // Create embed for ticket channel
            const embed = {
              color: action === 'reopened' ? 0x00ff00 : (action === 'closed' ? 0xff0000 : 0x5865F2), // Red for closed, Green for reopened, Discord blue for deleted
              title: action === 'reopened' ? '🔓 Ticket Reopened' : (action === 'closed' ? '🔒 Ticket Closed' : '🗑️ Ticket Deleted'),
              description: `This ticket has been ${action} via Dashboard.${reason ? `\n**Reason:** ${reason}` : ''}`,
              footer: {
                text: `Ticket ID: ${ticket.id}`
              },
              timestamp: new Date().toISOString()
            };
            
            // For closed tickets, add a delete button
            if (action === 'closed') {
              const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
              
              const row = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`delete_ticket_${ticket.id}`)
                    .setLabel('Delete Ticket')
                    .setStyle(ButtonStyle.Danger)
                );
              
              await channel.send({ embeds: [embed], components: [row] });
            } else {
              await channel.send({ embeds: [embed] });
            }
            
            // Update channel permissions - make sure it's a TextChannel which has permissionOverwrites
            if (ticket.user_id && channel instanceof TextChannel) {
              try {
                await channel.permissionOverwrites.edit(ticket.user_id, {
                  SendMessages: action === 'reopened', // false if closed, true if reopened
                  ViewChannel: true
                });
              } catch (permError) {
                logError('TicketHandlers', `Error updating channel permissions: ${permError}`);
              }
            }
          } else {
            logError('TicketHandlers', `Channel ${ticket.channel_id} is not a text channel`);
          }
        } catch (channelError: any) { // Type assertion to fix TypeScript error
          logError('TicketHandlers', `Channel not found or inaccessible: ${ticket.channel_id} - Error: ${channelError}`);
          
          // If the channel doesn't exist, update the ticket notes
          if (channelError.code === 10003) { // Unknown Channel error code
            try {
              const updateChannelStmt = db.prepare(`
                UPDATE tickets 
                SET notes = COALESCE(notes, '') || '\nChannel deleted or inaccessible'
                WHERE id = ?
              `);
              updateChannelStmt.run(ticket.id);
              logInfo('TicketHandlers', `Marked ticket ${ticket.id} as having an invalid channel`);
            } catch (dbUpdateError) {
              logError('TicketHandlers', `Error updating ticket with channel status: ${dbUpdateError}`);
            }
          }
        }
      }
    }
  } catch (error) {
    logError('TicketHandlers', `Error sending ticket notification: ${error}`);
  }
}
