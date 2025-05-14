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
  closedBy: GuildMember | User,
  reason?: string,
  isDeleting: boolean = false
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
    const messages = await channel.messages.fetch({ limit: 100 });
    
    // Sort messages by timestamp (oldest first)
    const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    
    // Build plain text transcript instead of HTML
    let textContent = `=============== TICKET TRANSCRIPT #${formattedTicketNumber} ===============\n`;
    textContent += `Category: ${ticketInfo.category}\n`;
    textContent += `Created by: ${ticketInfo.username} (${ticketInfo.user_id})\n`;
    textContent += `Created at: ${ticketInfo.created_at}\n`;
    textContent += `Closed by: ${closedBy instanceof GuildMember ? closedBy.user.tag : closedBy.tag} (${closedBy.id})\n`;
    textContent += `Closed at: ${new Date().toLocaleString()}\n`;
    if (reason) textContent += `Reason: ${reason}\n`;
    textContent += `\n=== MESSAGES ===\n\n`;
    
    // Add each message to the transcript
    for (const message of sortedMessages) {
      const timestamp = new Date(message.createdTimestamp).toLocaleString();
      
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
    
    // Add footer
    textContent += `\n=============== END OF TRANSCRIPT ===============\n`;
    textContent += `Generated on ${new Date().toLocaleString()} • Support Ticket System`;
    
    // Create attachment
    const buffer = Buffer.from(textContent, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: `ticket-${formattedTicketNumber}-transcript.txt` });
    
    // Initialize success flag
    let transcriptSuccess = false;
    
    // Send to log channel
    try {
      // Get settings to find log channel
      const settings = await settingsManager.getSettings(channel.guild.id);
      
      if (settings && settings.ticket_logs_channel_id) {
        // Get log channel
        const logChannel = await channel.guild.channels.fetch(settings.ticket_logs_channel_id);
        
        if (logChannel && logChannel.isTextBased()) {
          // Format the current time for the footer
          const now = new Date();
          const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          // Create embed
          const embed = new EmbedBuilder()
            .setColor(Colors.INFO)
            .setTitle(`🗒️ Ticket Transcript | #${formattedTicketNumber}`)
            .setDescription(`Transcript for ticket #${formattedTicketNumber} (${ticketInfo.category})`)
            .addFields([
              { name: '👤 Opened By', value: `<@${ticketInfo.user_id}>`, inline: true },
              { name: '🔒 Closed By', value: `<@${closedBy.id}>`, inline: true },
              { name: '📋 Reason', value: reason || 'No reason provided', inline: false },
              { name: '📊 Status', value: isDeleting ? 'Deleted' : 'Closed', inline: true }
            ])
            .setFooter({ text: `Made by Soggra. • ${timeString}` });
          
          // Send transcript to log channel
          await logChannel.send({
            embeds: [embed],
            files: [attachment]
          }).catch(err => {
            logError('Transcript', `Error sending to log channel: ${err}`);
            // Don't mark as success if we can't send
            return false;
          });
          
          // Log the success
          logInfo('Transcript', `Sent transcript to log channel for ticket #${formattedTicketNumber}`);
          transcriptSuccess = true;
        } else {
          logError('Transcript', `Invalid ticket log channel: ${settings.ticket_logs_channel_id}`);
        }
      } else {
        logError('Transcript', 'No ticket log channel configured');
      }
    } catch (error) {
      logError('Transcript', `Error sending transcript to log channel: ${error}`);
    }
    
    // Only send transcript to user if the ticket is being closed (not deleted)
    if (!isDeleting) {
      try {
        const user = await channel.client.users.fetch(ticketInfo.user_id);
        
        if (user) {
          // Format time for user message
          const now = new Date();
          const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          // Create a more styled embed
          const userEmbed = new EmbedBuilder()
            .setColor(Colors.INFO)
            .setTitle(`🗒️ Ticket Transcript | #${formattedTicketNumber}`)
            .setDescription(`Your ticket #${formattedTicketNumber} has been closed.\nA transcript is attached for your records.`)
            .addFields([
              { name: '📋 Category', value: ticketInfo.category, inline: true },
              { name: '🔒 Closed By', value: `<@${closedBy.id}>`, inline: true },
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
      userId: closedBy.id,
      channelId: channel.id,
      ticketNumber: ticketInfo.ticket_number,
      subject: ticketInfo.category,
      closedBy: closedBy.id,
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
