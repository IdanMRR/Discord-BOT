import { logInfo, logError } from './logger';
import { TicketTranscriptService } from '../database/services/ticketTranscriptService';
import { getClient } from './client-utils';

/**
 * Fetch and store a ticket transcript in the database
 * @param ticketId The ID of the ticket
 * @param channelId The Discord channel ID for the ticket
 * @param sendToUser Whether to send the transcript to the user
 * @returns True if successful, false otherwise
 */
export async function storeTicketTranscript(ticketId: number, channelId: string, sendToUser: boolean = true): Promise<boolean> {
  try {
    // Get the Discord client
    const client = getClient();
    if (!client) {
      logError('Transcript', 'Discord client not available for transcript');
      return false;
    }

    try {
      // Try to get the channel
      const channel = await client.channels.fetch(channelId);
      
      if (!channel || !channel.isTextBased()) {
        logInfo('Transcript', `Channel ${channelId} not found or not text-based - likely deleted`);
        return false;
      }
      
      // Fetch the messages from the channel (limited to 100 most recent)
      const messages = await (channel as any).messages.fetch({ limit: 100 });
      
      // Format the messages into a structured transcript for database storage
      const formattedTranscript = Array.from(messages.values())
        .reverse() // Show oldest messages first
        .map((msg: any) => ({
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
      
      // Save the transcript to the database
      const result = await TicketTranscriptService.saveTranscript(ticketId, formattedTranscript);
      
      if (result) {
        logInfo('Transcript', `Saved transcript for ticket #${ticketId} to database`);
        return true;
      } else {
        logError('Transcript', `Failed to save transcript for ticket #${ticketId}`);
        return false;
      }
    } catch (error: any) {
      // Only log as error if it's not a "channel not found" error
      if (error.code === 10003) {
        logInfo('Transcript', `Channel ${channelId} no longer exists - cannot generate transcript`);
      } else {
        logError('Transcript', `Error fetching or saving transcript: ${error}`);
      }
      return false;
    }
  } catch (error) {
    logError('Transcript', `Error in storeTicketTranscript: ${error}`);
    return false;
  }
}

/**
 * Create a simple text transcript from a structured transcript
 * @param transcript The structured transcript
 * @returns A plain text version of the transcript
 */
export function createTextTranscript(transcript: any[]): string {
  return transcript
    .map((msg: any) => {
      const timestamp = new Date(msg.timestamp).toLocaleString();
      const author = msg.author.bot ? `${msg.author.username} (Bot)` : msg.author.username;
      return `[${timestamp}] ${author}: ${msg.content}`;
    })
    .join('\n');
}
