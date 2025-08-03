import { 
  TextChannel, 
  Message, 
  AttachmentBuilder, 
  EmbedBuilder, 
  GuildMember,
  User,
  ActionRowBuilder,
  ButtonBuilder
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { db } from '../../database/sqlite';
import { settingsManager } from '../../utils/settings';
import { logTicketEvent } from '../../utils/databaseLogger';
import { createRatingButton } from './ticket-rating';
import { formatIsraeliTime, formatIsraeliDateForTranscript } from '../../utils/time-formatter';

// Create a map to track recently generated transcripts to prevent duplicates
const recentTranscripts = new Map<string, number>();

/**
 * Save and send a transcript of a ticket channel
 * 
 * @param channel The ticket channel to create a transcript for
 * @param closedBy The user who closed the ticket
 * @param reason The reason for closing the ticket
 * @param isDeleting Indicates if the ticket is being deleted
 * @returns Promise resolving to true if successful
 */
export async function saveAndSendTranscript(
  channel: TextChannel,
  closedBy: GuildMember | User | string,
  reason?: string,
  isDeleting: boolean = false,
  sendToUser: boolean = true
): Promise<boolean> {
  try {
    // Get ticket info from database
    const ticketInfo = await getTicketInfo(channel.id);
    
    if (!ticketInfo) {
      logError('Transcript', `Could not find ticket info for channel ${channel.id}`);
      return false;
    }
    
    // Check if a transcript has already been generated recently for this ticket
    // to prevent duplicate transcripts
    const lastTranscriptTime = recentTranscripts.get(channel.id);
    if (lastTranscriptTime && (Date.now() - lastTranscriptTime) < 30000) {
      logInfo('Transcript', `Transcript for ticket #${ticketInfo.ticket_number} was already generated within the last 30 seconds. Skipping duplicate.`);
      return true; // Return success without generating another transcript
    }
    
    // Mark this ticket as having a transcript generated
    recentTranscripts.set(channel.id, Date.now());
    
    // Format ticket number with leading zeros
    const formattedTicketNumber = ticketInfo.ticket_number.toString().padStart(4, '0');
    
    // Get all messages in the channel (up to 100 for now)
    let messages;
    let sortedMessages: Message[] = [];
    
    try {
      messages = await channel.messages.fetch({ limit: 100 });
      // Sort messages by timestamp (oldest first)
      sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    } catch (fetchError: any) {
      if (fetchError.code === 10003) {
        // Channel was deleted, create a minimal transcript
        logError('Transcript', `Channel ${channel.id} was deleted while generating transcript for ticket #${ticketInfo.ticket_number}`);
        sortedMessages = []; // Empty messages array
      } else {
        throw fetchError;
      }
    }
    
    // Get the proper user data for the person who closed the ticket
    let closedByUser: User | GuildMember | null = null;
    let closedByDisplay = 'Unknown User';
    let closedById = 'Unknown';
    
    try {
      if (closedBy instanceof GuildMember) {
        // If it's a GuildMember object
        closedByUser = closedBy;
        closedByDisplay = closedBy.user.tag;
        closedById = closedBy.id;
      } else if (closedBy instanceof User) {
        // If it's a User object
        closedByUser = closedBy;
        closedByDisplay = closedBy.tag;
        closedById = closedBy.id;
      } else if (typeof closedBy === 'string') {
        // If it's just a string ID, fetch the user
        closedById = closedBy;
        try {
          const fetchedUser = await channel.client.users.fetch(closedBy);
          if (fetchedUser) {
            closedByUser = fetchedUser;
            closedByDisplay = fetchedUser.tag;
          } else {
            closedByDisplay = `Unknown User (${closedBy})`;
          }
        } catch (fetchError) {
          logError('Transcript', `Error fetching user ${closedBy}: ${fetchError}`);
          closedByDisplay = `Unknown User (${closedBy})`;
        }
      } else if (typeof closedBy === 'object' && closedBy && 'id' in closedBy) {
        // If it's an object with an ID property
        closedById = (closedBy as any).id;
        try {
          const fetchedUser = await channel.client.users.fetch((closedBy as any).id);
          if (fetchedUser) {
            closedByUser = fetchedUser;
            closedByDisplay = fetchedUser.tag;
          } else {
            closedByDisplay = `Unknown User (${(closedBy as any).id})`;
          }
        } catch (fetchError) {
          logError('Transcript', `Error fetching user ${(closedBy as any).id}: ${fetchError}`);
          closedByDisplay = `Unknown User (${(closedBy as any).id})`;
        }
      }
    } catch (error) {
      logError('Transcript', `Error processing closedBy user: ${error}`);
      closedByDisplay = 'Unknown User';
    }
    
    // Build plain text transcript instead of HTML
    let textContent = `=============== TICKET TRANSCRIPT #${formattedTicketNumber} ===============\n`;
    textContent += `Category: ${ticketInfo.category}\n`;
    textContent += `Created by: ${ticketInfo.username} (${ticketInfo.user_id})\n`;
    textContent += `Created at: ${ticketInfo.created_at}\n`;
    textContent += `Closed by: ${closedByDisplay} (${closedById})\n`;
    textContent += `Closed at: ${formatIsraeliDateForTranscript()}\n`;
    if (reason) textContent += `Reason: ${reason}\n`;
    textContent += `\n=== MESSAGES ===\n\n`;
    
    // Add each message to the transcript
    if (sortedMessages.length > 0) {
      for (const message of sortedMessages) {
        const timestamp = new Date(message.createdTimestamp).toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).replace(',', '');
        
        textContent += `[${timestamp}] ${message.author.username}: ${message.content || '(No text content)'}\n`;
        
        // Add embeds as text summaries
        if (message.embeds.length > 0) {
          for (const embed of message.embeds) {
            textContent += `  [Embed] `;
            if (embed.title) textContent += `Title: ${embed.title} `;
            if (embed.description) textContent += `Content: ${embed.description}`;
            textContent += `\n`;
          }
        }
        
        // Add attachments
        if (message.attachments.size > 0) {
          for (const [, attachment] of message.attachments) {
            textContent += `  [Attachment] ${attachment.name || 'Unnamed file'}: ${attachment.url}\n`;
          }
        }
        
        textContent += `\n`;
      }
    } else {
      textContent += `No messages found - channel may have been deleted before transcript generation.\n\n`;
    }
    
    // Add footer
    textContent += `\n=============== END OF TRANSCRIPT ===============\n`;
    textContent += `Generated on ${new Date().toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(',', '')} • Support Ticket System`;
    
    // Create attachment
    const buffer = Buffer.from(textContent, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: `ticket-${formattedTicketNumber}-transcript.txt` });
    
    // Store structured transcript in database for API access
    try {
      const { TicketTranscriptService } = require('../../database/services/ticketTranscriptService');
      
      // Create structured transcript data
      const structuredTranscript = sortedMessages.map((msg: Message) => ({
        id: msg.id,
        author: {
          id: msg.author.id,
          username: msg.author.username,
          bot: msg.author.bot
        },
        content: msg.content,
        timestamp: msg.createdAt,
        attachments: Array.from(msg.attachments.values()).map((att: any) => ({
          url: att.url,
          name: att.name,
          contentType: att.contentType
        })),
        embeds: msg.embeds.map((embed: any) => ({
          title: embed.title,
          description: embed.description,
          color: embed.color,
          fields: embed.fields
        }))
      }));
      
      // Save to database (use ticket ID from database, not ticket number)
      const ticketQuery = db.prepare('SELECT id FROM tickets WHERE channel_id = ?');
      const ticketRecord = ticketQuery.get(channel.id) as { id: number } | undefined;
      
      if (ticketRecord) {
        await TicketTranscriptService.saveTranscript(ticketRecord.id, structuredTranscript);
      } else {
        logError('Transcript', `Could not find ticket ID for channel ${channel.id}`);
      }
      logInfo('Transcript', `Stored structured transcript in database for ticket #${formattedTicketNumber}`);
    } catch (dbError) {
      logError('Transcript', `Error storing structured transcript in database: ${dbError}`);
      // Continue even if database storage fails
    }
    
    // Initialize success flag
    let transcriptSuccess = false;
    
    // Send to log channel
    try {
      // Get settings to find log channel
      const settings = await settingsManager.getSettings(channel.guild.id);
      
      if (settings && settings.ticket_logs_channel_id) {
        // Get log channel with proper error handling
        let logChannel;
        try {
          logChannel = await channel.guild.channels.fetch(settings.ticket_logs_channel_id);
        } catch (channelError: any) {
          if (channelError.code === 10003) {
            // Unknown Channel error - channel was deleted
            logError('Transcript', `Ticket logs channel ${settings.ticket_logs_channel_id} no longer exists (deleted). Please reconfigure ticket logs channel.`);
            
            // Clear the invalid channel ID from settings to prevent future errors
            try {
              delete settings.ticket_logs_channel_id;
              await settingsManager.updateSettings(channel.guild.id, settings);
              logInfo('Transcript', 'Cleared invalid ticket logs channel ID from settings');
            } catch (updateError) {
              logError('Transcript', `Error clearing invalid channel ID: ${updateError}`);
            }
          } else {
            logError('Transcript', `Error fetching ticket logs channel: ${channelError}`);
          }
          return false; // Return false if we can't send the transcript
        }
        
        if (logChannel && logChannel.isTextBased()) {
          // Format the current time for the footer in Israeli timezone
          const timeString = formatIsraeliTime();
          
          // Create embed
          const embed = new EmbedBuilder()
            .setColor(Colors.INFO)
            .setTitle(`🗒️ Ticket Transcript | #${formattedTicketNumber}`)
            .setDescription(`Transcript for ticket #${formattedTicketNumber} (${ticketInfo.category})`)
            .addFields([
              { name: '👤 Opened By', value: `<@${ticketInfo.user_id}>`, inline: true },
              { name: '🔒 Closed By', value: `<@${closedById}>`, inline: true },
              { name: '📋 Reason', value: reason || 'No reason provided', inline: false },
              { name: '📊 Status', value: isDeleting ? 'Deleted' : 'Closed', inline: true }
            ])
            .setFooter({ text: `Made by Soggra. • ${timeString}` });
          
          // Send transcript to log channel with error handling
          try {
            await logChannel.send({
              embeds: [embed],
              files: [attachment]
            });
            
            // Log the success
            logInfo('Transcript', `Sent transcript to log channel for ticket #${formattedTicketNumber}`);
            transcriptSuccess = true;
          } catch (sendError: any) {
            if (sendError.code === 10003) {
              logError('Transcript', `Ticket logs channel was deleted while sending transcript for ticket #${formattedTicketNumber}`);
            } else {
              logError('Transcript', `Error sending transcript to log channel: ${sendError}`);
            }
            // Don't mark as success if we can't send
            return false;
          }
        } else {
          logError('Transcript', `Invalid ticket log channel: ${settings.ticket_logs_channel_id}`);
        }
      } else {
        logError('Transcript', 'No ticket log channel configured');
      }
    } catch (error) {
      logError('Transcript', `Error sending transcript to log channel: ${error}`);
    }
    
    // Only send transcript to user if the ticket is being closed (not deleted) and sendToUser is true
    if (!isDeleting && sendToUser) {
      try {
        const user = await channel.client.users.fetch(ticketInfo.user_id);
        
        if (user) {
          // Format time for user message in Israeli timezone
          const timeString = formatIsraeliTime();
          
          // Create a more styled embed
          const userEmbed = new EmbedBuilder()
            .setColor(Colors.INFO)
            .setTitle(`🗒️ Ticket Transcript | #${formattedTicketNumber}`)
            .setDescription(`Your ticket #${formattedTicketNumber} has been closed.\nA transcript is attached for your records.`)
            .addFields([
              { name: '📋 Category', value: ticketInfo.category, inline: true },
              { name: '🔒 Closed By', value: `<@${closedById}>`, inline: true },
              { name: '📝 Reason', value: reason || 'No reason provided', inline: false }
            ])
            .setFooter({ text: `Made by Soggra. • Today at ${timeString}` })
            .setTimestamp();
          
          // Create a new attachment for the user to ensure it's not consumed by the previous send
          const userAttachment = new AttachmentBuilder(buffer, { name: `ticket-${formattedTicketNumber}-transcript.txt` });
          
          // Send transcript to user WITHOUT a rating button (the rating will be sent separately via DM)
          await user.send({
            embeds: [userEmbed],
            files: [userAttachment]
          });
          
          // Log the success
          logInfo('Transcript', `Sent transcript to user ${user.tag} for ticket #${formattedTicketNumber}`);
          transcriptSuccess = true;
        }
      } catch (userError) {
        logError('Transcript', `Failed to send transcript to user: ${userError}`);
        // We'll still consider it a success if we managed to send to the log channel
      }
    }
    
    // Log the ticket close event with transcript information
    await logTicketEvent({
      guildId: channel.guild.id,
      actionType: isDeleting ? 'ticketDelete' : 'ticketClose',
      userId: closedById,
      channelId: channel.id,
      ticketNumber: ticketInfo.ticket_number,
      subject: ticketInfo.category,
      closedBy: closedById,
      note: `Transcript saved: ticket-${formattedTicketNumber}-transcript.txt`, // Include transcript filename in the logs
      skipChannelLog: true // Skip sending to channel since we're already sending a transcript
    });
    
    // Also log the reason separately if provided
    if (reason) {
      logInfo(isDeleting ? 'Ticket Delete' : 'Ticket Close', `Reason for ${isDeleting ? 'deleting' : 'closing'} ticket #${ticketInfo.ticket_number}: ${reason}`);
    }
    
    return transcriptSuccess;
  } catch (error) {
    logError('Transcript', `Error creating transcript: ${error}`);
    return false;
  }
}

/**
 * Get ticket information from the database
 * 
 * @param channelId The channel ID of the ticket
 * @returns Promise resolving to ticket info or null if not found
 */
async function getTicketInfo(channelId: string): Promise<{
  ticket_number: number;
  user_id: string;
  username: string;
  category: string;
  created_at: string;
} | null> {
  try {
    // First check if the users table exists
    let usersTableExists = false;
    try {
      const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
      const tableResult = tableCheck.get();
      usersTableExists = !!tableResult;
    } catch (error) {
      // Table doesn't exist, we'll handle this
      usersTableExists = false;
    }
    
    // Query based on whether users table exists
    let stmt;
    if (usersTableExists) {
      stmt = db.prepare(`
        SELECT t.ticket_number, t.user_id, t.category, t.created_at, u.username
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.user_id
        WHERE t.channel_id = ?
      `);
    } else {
      stmt = db.prepare(`
        SELECT ticket_number, user_id, category, created_at
        FROM tickets
        WHERE channel_id = ?
      `);
    }
    
    const result = stmt.get(channelId) as any;
    
    if (!result) {
      return null;
    }
    
    // If username is not in database, try to fetch it
    if (!result.username) {
      try {
        // Try to get the user from the client cache or fetch them
        const client = require('../../index').client;
        const user = await client.users.fetch(result.user_id).catch(() => null);
        
        if (user) {
          result.username = user.username;
          
          // Try to create users table if it doesn't exist
          if (!usersTableExists) {
            try {
              db.prepare(`
                CREATE TABLE IF NOT EXISTS users (
                  user_id TEXT PRIMARY KEY,
                  username TEXT,
                  updated_at TEXT
                )
              `).run();
              usersTableExists = true;
            } catch (tableError) {
              logError('Transcript', `Error creating users table: ${tableError}`);
            }
          }
          
          // Save username to database for future reference if table exists
          if (usersTableExists) {
            try {
              const updateStmt = db.prepare(`
                INSERT OR REPLACE INTO users (user_id, username, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
              `);
              
              updateStmt.run(result.user_id, user.username);
            } catch (insertError) {
              logError('Transcript', `Error saving username: ${insertError}`);
            }
          }
        } else {
          result.username = 'Unknown User';
        }
      } catch (error) {
        logError('Transcript', `Error fetching user: ${error}`);
        result.username = 'Unknown User';
      }
    }
    
    return result;
  } catch (error) {
    logError('Transcript', `Error getting ticket info: ${error}`);
    return null;
  }
}
