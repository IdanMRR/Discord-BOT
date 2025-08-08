import { db } from '../database/sqlite';
import { logError, logInfo } from '../utils/logger';
import { ServerSettingsService } from '../database/services/serverSettingsService';
import { TicketTranscriptService } from '../database/services/ticketTranscriptService';
import { createTextTranscript } from '../utils/transcript-utils';
import { TextChannel, NewsChannel, ThreadChannel, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
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
export async function sendTicketNotification(ticket: any, action: 'closed' | 'reopened' | 'deleted', reason?: string, closedBy?: { id?: string, username?: string }): Promise<void> {
  try {
    const client = getClient();
    if (!client) {
      logError('TicketHandlers', 'Discord client not available');
      return;
    }
    
    // For closed tickets, send a transcript to the user (but not for deleted)
    if (action === 'closed') {
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
            
            // Format ticket number with leading zeros
            const formattedTicketNumber = String(ticket.ticket_number).padStart(4, '0');
            
            // Get current time in a nice format
            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            const dateString = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
            
            // Get guild name
            const guild = client.guilds.cache.get(ticket.guild_id);
            const guildName = guild ? guild.name : 'Unknown Server';
            
            // Create the comprehensive closure notification embed (only for closed tickets)
            const notificationEmbed = {
              color: 0xFEE75C, // Yellow for closed
              title: `🔒 Your Ticket Has Been Closed | #${formattedTicketNumber}`,
              description: `Your support ticket in **${guildName}** has been closed.`,
              fields: [
                { name: '📋 Ticket Number', value: `#${formattedTicketNumber}`, inline: true },
                { name: '🏷️ Category', value: ticket.category || 'General Support', inline: true },
                { name: '📝 Reason', value: reason || 'Information Provided', inline: false },
                { name: '🔒 Closed By', value: closedBy?.username ? `@${closedBy.username}` : '@API Request', inline: true },
                { name: '🕒 Closed At', value: timeString, inline: true }
              ],
              footer: {
                text: `Made by Soggra. • ${timeString}`,
              },
              timestamp: new Date().toISOString()
            };
            
            // Create transcript info embed
            const transcriptEmbed = {
              color: 0x5865F2, // Discord blue
              title: `🗒️ Ticket Transcript | #${formattedTicketNumber}`,
              description: `A complete transcript of your ticket conversation is attached for your records.`,
              fields: [
                { name: '📊 Total Messages', value: 'See attachment', inline: true },
                { name: '📅 Closed On', value: `${dateString}, ${timeString}`, inline: true }
              ],
              footer: {
                text: `Transcript generated • ${timeString}`
              }
            };
            
            // Send both embeds together first
            
            // Create a buffer from the text transcript
            const buffer = Buffer.from(textTranscript, 'utf-8');
            
            // Send both embeds and the transcript file in a single message
            await user.send({
              embeds: [notificationEmbed, transcriptEmbed],
              files: [{
                attachment: buffer,
                name: `ticket-${String(ticket.ticket_number).padStart(4, '0')}-transcript.txt`
              }]
            });
            
            // Send rating experience embed for closed tickets
            try {
              const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
              
              const ratingEmbed = {
                color: 0x5865F2, // Discord blue
                title: '⭐ Rate Your Support Experience',
                description: 'We value your feedback! Please rate your support experience to help us improve our service.',
                fields: [
                  { name: '📋 Ticket', value: `#${formattedTicketNumber}`, inline: true },
                  { name: '🏷️ Category', value: ticket.category || 'General Support', inline: true }
                ],
                footer: {
                  text: 'Your feedback helps us improve • Made by Soggra'
                },
                timestamp: new Date().toISOString()
              };
              
              // Create rating button
              const ratingButton = new ButtonBuilder()
                .setCustomId(`rate_ticket_${ticket.ticket_number}`)
                .setLabel('Rate Support Experience')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⭐');
              
              const ratingRow = new ActionRowBuilder()
                .addComponents(ratingButton);
              
              // Send the rating request via DM
              await user.send({ 
                embeds: [ratingEmbed],
                components: [ratingRow]
              });
              
              logInfo('TicketHandlers', `Sent rating request for ticket #${ticket.ticket_number} to user ${user.tag}`);
            } catch (ratingError) {
              logError('TicketHandlers', `Could not send rating request to user ${user.tag}: ${ratingError}`);
            }
            
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
                // Format ticket number with leading zeros for log channel
                const formattedTicketNumber = String(ticket.ticket_number).padStart(4, '0');
                const closingUserDisplay = closedBy?.username ? `@${closedBy.username}` : '@Unknown User';
                
                // Create enhanced embed for log channel
                let logEmbed;
                
                if (action === 'reopened') {
                  logEmbed = {
                    color: 0x00ff00, // Green for reopened
                    title: '🔓 Ticket Reopened',
                    description: `Ticket #${formattedTicketNumber} has been reopened via Dashboard by ${closingUserDisplay}.`,
                    fields: [
                      { name: '🎫 Ticket ID', value: `#${formattedTicketNumber}`, inline: true },
                      { name: '👤 User', value: ticket.user_id ? `<@${ticket.user_id}>` : 'Unknown', inline: true },
                      { name: '📝 Reason', value: reason || 'User Request', inline: true },
                      { name: '📊 Status', value: 'OPEN - Accepting messages', inline: false }
                    ],
                    footer: {
                      text: 'Reopened via Dashboard • Made by Soggra'
                    },
                    timestamp: new Date().toISOString()
                  };
                } else if (action === 'closed') {
                  logEmbed = {
                    color: 0xff0000, // Red for closed
                    title: '🔒 Ticket Closed',
                    description: `Ticket #${formattedTicketNumber} has been closed via Dashboard by ${closingUserDisplay}.`,
                    fields: [
                      { name: '🎫 Ticket ID', value: `#${formattedTicketNumber}`, inline: true },
                      { name: '👤 User', value: ticket.user_id ? `<@${ticket.user_id}>` : 'Unknown', inline: true },
                      { name: '📝 Reason', value: reason || 'Issue Resolved', inline: true }
                    ],
                    footer: {
                      text: 'Closed via Dashboard • Made by Soggra'
                    },
                    timestamp: new Date().toISOString()
                  };
                } else {
                  // Deleted case
                  logEmbed = {
                    color: 0x5865F2, // Discord blue for deleted
                    title: '🗑️ Ticket Deleted',
                    description: `Ticket #${formattedTicketNumber} has been deleted via Dashboard by ${closingUserDisplay}.`,
                    fields: [
                      { name: '🎫 Ticket ID', value: `#${formattedTicketNumber}`, inline: true },
                      { name: '👤 User', value: ticket.user_id ? `<@${ticket.user_id}>` : 'Unknown', inline: true },
                      { name: '📝 Reason', value: reason || 'No reason provided', inline: true }
                    ],
                    footer: {
                      text: 'Deleted via Dashboard • Made by Soggra'
                    },
                    timestamp: new Date().toISOString()
                  };
                }
                
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
            // Format ticket number with leading zeros
            const formattedTicketNumber = String(ticket.ticket_number).padStart(4, '0');
            
            // Get current time in a nice format
            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            // Get closing user display name
            const closingUserDisplay = closedBy?.username ? `@${closedBy.username}` : '@Unknown User';
            
            // Get full date for reopened tickets
            const dateString = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
            
            // Create enhanced embed for ticket channel
            let embed;
            
            if (action === 'reopened') {
              embed = {
                color: 0x00ff00, // Green for reopened
                title: '🔓 Ticket Reopened',
                description: `This ticket has been reopened by ${closingUserDisplay}.`,
                fields: [
                  { name: '📝 Reason', value: reason || 'User Request', inline: false },
                  { name: '🎫 Ticket ID', value: `#${formattedTicketNumber}`, inline: true },
                  { name: '👤 Reopened By', value: closingUserDisplay, inline: true },
                  { name: '📅 Reopened At', value: dateString, inline: true },
                  { name: '📊 Status', value: 'This ticket is now **OPEN** and accepting messages.', inline: false },
                  { name: '⚙️ Actions', value: 'You can continue the conversation. The ticket can be closed again when the issue is resolved.', inline: false }
                ],
                footer: {
                  text: `Reopened via Discord • Made by Soggra • Today at ${timeString}`
                },
                timestamp: new Date().toISOString()
              };
            } else if (action === 'closed') {
              embed = {
                color: 0xff0000, // Red for closed
                title: '🔒 Ticket Closed',
                description: `This ticket has been closed by ${closingUserDisplay}.`,
                fields: [
                  { name: '📝 Reason', value: reason || 'Issue Resolved', inline: false },
                  { name: '🎫 Ticket ID', value: `#${formattedTicketNumber}`, inline: true },
                  { name: '👤 Closed By', value: closingUserDisplay, inline: true },
                  { name: '🕒 Closed At', value: timeString, inline: true },
                  { name: '⚙️ Actions', value: 'Staff can reopen or permanently delete this ticket using the buttons below.', inline: false }
                ],
                footer: {
                  text: `Closed via Discord • Made by Soggra • Today at ${timeString}`
                },
                timestamp: new Date().toISOString()
              };
            } else {
              // Deleted case
              embed = {
                color: 0x5865F2, // Discord blue for deleted
                title: '🗑️ Ticket Deleted',
                description: `This ticket has been deleted by ${closingUserDisplay}.`,
                fields: [
                  { name: '📝 Reason', value: reason || 'No reason provided', inline: false },
                  { name: '🎫 Ticket ID', value: `#${formattedTicketNumber}`, inline: true },
                  { name: '👤 Deleted By', value: closingUserDisplay, inline: true },
                  { name: '📅 Deleted At', value: timeString, inline: true }
                ],
                footer: {
                  text: `Deleted via Discord • Made by Soggra • Today at ${timeString}`
                },
                timestamp: new Date().toISOString()
              };
            }
            
            // Add appropriate buttons based on action
            if (action === 'closed') {
              const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
              
              const row = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`reopen_ticket_${ticket.id}`)
                    .setLabel('Reopen Ticket')
                    .setStyle(ButtonStyle.Success),
                  new ButtonBuilder()
                    .setCustomId(`delete_ticket_${ticket.id}`)
                    .setLabel('Delete Ticket')
                    .setStyle(ButtonStyle.Danger)
                );
              
              await channel.send({ embeds: [embed], components: [row] });
            } else if (action === 'reopened') {
              const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
              
              const row = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(`close_ticket_${ticket.id}`)
                    .setLabel('Close Ticket')
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
