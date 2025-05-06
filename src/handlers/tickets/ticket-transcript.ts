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
import { formatIsraeliDate, formatIsraeliTime } from '../../utils/time-formatter';

/**
 * Save and send a transcript of a ticket channel
 * 
 * @param channel The ticket channel to create a transcript for
 * @param closedBy The user who closed the ticket
 * @param reason The reason for closing the ticket
 * @returns Promise resolving to true if successful
 */
export async function saveAndSendTranscript(
  channel: TextChannel,
  closedBy: GuildMember | User,
  reason?: string
): Promise<boolean> {
  try {
    // Get ticket info from database
    const ticketInfo = await getTicketInfo(channel.id);
    
    if (!ticketInfo) {
      logError('Transcript', `Could not find ticket info for channel ${channel.id}`);
      return false;
    }
    
    // Format ticket number with leading zeros
    const formattedTicketNumber = ticketInfo.ticket_number.toString().padStart(4, '0');
    
    // Get all messages in the channel (up to 100 for now)
    const messages = await channel.messages.fetch({ limit: 100 });
    
    // Sort messages by timestamp (oldest first)
    const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    
    // Build HTML transcript
    let htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ticket #${formattedTicketNumber} Transcript</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .header {
            background-color: #2c2f33;
            color: white;
            padding: 15px;
            border-radius: 5px 5px 0 0;
            margin-bottom: 20px;
          }
          .message {
            background-color: white;
            padding: 10px 15px;
            margin-bottom: 10px;
            border-radius: 5px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .message-header {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
          }
          .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 10px;
          }
          .username {
            font-weight: bold;
            color: #7289da;
          }
          .timestamp {
            color: #99aab5;
            font-size: 0.8em;
            margin-left: 10px;
          }
          .content {
            word-break: break-word;
          }
          .embed {
            border-left: 4px solid #7289da;
            padding: 8px 12px;
            margin: 5px 0;
            background-color: #f6f6f6;
          }
          .attachment {
            display: block;
            margin: 5px 0;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #99aab5;
            font-size: 0.8em;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Ticket #${formattedTicketNumber} Transcript</h1>
          <p>Category: ${ticketInfo.category}</p>
          <p>Created by: ${ticketInfo.username} (${ticketInfo.user_id})</p>
          <p>Created at: ${new Date(ticketInfo.created_at).toLocaleString()}</p>
          <p>Closed by: ${closedBy instanceof GuildMember ? closedBy.user.tag : closedBy.tag} (${closedBy.id})</p>
          <p>Closed at: ${new Date().toLocaleString()}</p>
          ${reason ? `<p>Reason: ${reason}</p>` : ''}
        </div>
    `;
    
    // Add each message to the transcript
    for (const message of sortedMessages) {
      const timestamp = new Date(message.createdTimestamp).toLocaleString();
      const avatarUrl = message.author.displayAvatarURL({ extension: 'png', size: 128 });
      
      htmlContent += `
        <div class="message">
          <div class="message-header">
            <img class="avatar" src="${avatarUrl}" alt="${message.author.username}">
            <span class="username">${message.author.username}</span>
            <span class="timestamp">${timestamp}</span>
          </div>
          <div class="content">${message.content || ''}</div>
      `;
      
      // Add embeds
      if (message.embeds.length > 0) {
        for (const embed of message.embeds) {
          htmlContent += `
            <div class="embed">
              ${embed.title ? `<strong>${embed.title}</strong><br>` : ''}
              ${embed.description ? `${embed.description}<br>` : ''}
            </div>
          `;
        }
      }
      
      // Add attachments
      if (message.attachments.size > 0) {
        for (const [, attachment] of message.attachments) {
          htmlContent += `
            <a class="attachment" href="${attachment.url}" target="_blank">
              ${attachment.name || 'Attachment'}
            </a>
          `;
        }
      }
      
      htmlContent += `</div>`;
    }
    
    // Close HTML
    htmlContent += `
        <div class="footer">
          <p>Transcript generated on ${new Date().toLocaleString()}</p>
          <p>Coded by IdanMR</p>
        </div>
      </body>
      </html>
    `;
    
    // Create attachment
    const buffer = Buffer.from(htmlContent, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: `ticket-${formattedTicketNumber}-transcript.html` });
    
    // Get settings to find log channel
    const settings = await settingsManager.getSettings(channel.guild.id);
    
    if (!settings || !settings.ticket_logs_channel_id) {
      logError('Transcript', 'No ticket log channel configured');
      return false;
    }
    
    // Get log channel
    const logChannel = await channel.guild.channels.fetch(settings.ticket_logs_channel_id) as TextChannel;
    
    if (!logChannel || !logChannel.isTextBased()) {
      logError('Transcript', `Invalid ticket log channel: ${settings.ticket_logs_channel_id}`);
      return false;
    }
    
    // Format the current time for the footer using the utility
    const now = new Date();
    const timeString = formatIsraeliTime(now);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor(Colors.INFO)
      .setTitle(`🗒️ Ticket Transcript | #${formattedTicketNumber}`)
      .setDescription(`Transcript for ticket #${formattedTicketNumber} (${ticketInfo.category})`)
      .addFields([
        { name: '👤 Opened By', value: `<@${ticketInfo.user_id}>`, inline: true },
        { name: '🔒 Closed By', value: `<@${closedBy.id}>`, inline: true },
        { name: '📋 Reason', value: reason || 'No reason provided', inline: false }
      ])
      .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
    
    // Send transcript to log channel
    await logChannel.send({
      embeds: [embed],
      files: [attachment]
    });
    
    // Try to send transcript to user as well
    try {
      const user = await channel.client.users.fetch(ticketInfo.user_id);
      
      if (user) {
        const userEmbed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle(`🗒️ Ticket Transcript | #${formattedTicketNumber}`)
          .setDescription(`Your ticket #${formattedTicketNumber} has been closed.\nA transcript is attached for your records.`)
          .addFields([
            { name: '📋 Category', value: ticketInfo.category, inline: true },
            { name: '🔒 Closed By', value: `<@${closedBy.id}>`, inline: true },
            { name: '📝 Reason', value: reason || 'No reason provided', inline: false }
          ])
          .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });
        
        // Send transcript and rating button to user
        const ratingButton = createRatingButton(ticketInfo.ticket_number);
        const ratingRow = new ActionRowBuilder<ButtonBuilder>().addComponents(ratingButton);
        
        await user.send({
          embeds: [userEmbed],
          files: [attachment],
          components: [ratingRow]
        });
      }
    } catch (error) {
      logError('Transcript', `Failed to send transcript to user: ${error}`);
      // Continue even if we can't send to the user
    }
    
    // Log the ticket close event with transcript information
    await logTicketEvent({
      guildId: channel.guild.id,
      actionType: 'ticketClose',
      userId: closedBy.id,
      channelId: channel.id,
      ticketNumber: ticketInfo.ticket_number,
      subject: ticketInfo.category,
      closedBy: closedBy.id,
      note: `Transcript saved: ticket-${formattedTicketNumber}-transcript.html` // Include transcript filename in the logs
    });
    
    // Also log the reason separately if provided
    if (reason) {
      logInfo('Ticket Close', `Reason for closing ticket #${ticketInfo.ticket_number}: ${reason}`);
    }
    
    logInfo('Transcript', `Created transcript for ticket #${formattedTicketNumber}`);
    return true;
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
