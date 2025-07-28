import { logInfo, logError } from './logger';
import { TicketTranscriptService } from '../database/services/ticketTranscriptService';
import { getClient } from './client-utils';
import { db } from '../database/sqlite';

/**
 * Check and regenerate missing transcripts for closed/deleted tickets
 * This function can be called periodically to ensure all tickets have transcripts
 */
export async function regenerateMissingTranscripts(): Promise<{ processed: number; generated: number; errors: number }> {
  try {
    logInfo('TranscriptManagement', 'Starting missing transcript regeneration process...');
    
    // Get all closed/deleted tickets that don't have transcripts
    const ticketsWithoutTranscripts = db.prepare(`
      SELECT t.id, t.ticket_number, t.channel_id, t.status, t.guild_id
      FROM tickets t
      LEFT JOIN ticket_transcripts tt ON t.id = tt.ticket_id
      WHERE t.status IN ('closed', 'deleted') 
      AND tt.id IS NULL
      ORDER BY t.id DESC
      LIMIT 50
    `).all() as Array<{
      id: number;
      ticket_number: number;
      channel_id: string;
      status: string;
      guild_id: string;
    }>;
    
    logInfo('TranscriptManagement', `Found ${ticketsWithoutTranscripts.length} tickets without stored transcripts`);
    
    if (ticketsWithoutTranscripts.length === 0) {
      return { processed: 0, generated: 0, errors: 0 };
    }
    
    const client = getClient();
    if (!client) {
      logError('TranscriptManagement', 'Discord client not available for transcript regeneration');
      return { processed: 0, generated: 0, errors: 0 };
    }
    
    let processed = 0;
    let generated = 0;
    let errors = 0;
    
    for (const ticket of ticketsWithoutTranscripts) {
      processed++;
      
      try {
        logInfo('TranscriptManagement', `Processing ticket #${ticket.ticket_number} (ID: ${ticket.id})`);
        
        // Try to fetch the channel
        const channel = await client.channels.fetch(ticket.channel_id).catch(() => null);
        
        if (!channel || !channel.isTextBased()) {
          // Channel doesn't exist, create a placeholder transcript
          const placeholderTranscript = [{
            id: 'placeholder',
            author: {
              id: 'system',
              username: 'System',
              bot: true
            },
            content: `This ticket channel (${ticket.channel_id}) no longer exists. The transcript was not saved when the ticket was closed.`,
            timestamp: new Date(),
            attachments: [],
            embeds: []
          }];
          
          await TicketTranscriptService.saveTranscript(ticket.id, placeholderTranscript);
          logInfo('TranscriptManagement', `Created placeholder transcript for ticket #${ticket.ticket_number}`);
          generated++;
          continue;
        }
        
        // Channel exists, try to fetch messages
        const messages = await (channel as any).messages.fetch({ limit: 100 }).catch(() => null);
        
        if (!messages || messages.size === 0) {
          // No messages found, create a minimal transcript
          const minimalTranscript = [{
            id: 'no-messages',
            author: {
              id: 'system',
              username: 'System',
              bot: true
            },
            content: 'No messages found in this ticket channel.',
            timestamp: new Date(),
            attachments: [],
            embeds: []
          }];
          
          await TicketTranscriptService.saveTranscript(ticket.id, minimalTranscript);
          logInfo('TranscriptManagement', `Created minimal transcript for ticket #${ticket.ticket_number} (no messages)`);
          generated++;
          continue;
        }
        
        // Format the messages into a structured transcript
        const structuredTranscript = Array.from(messages.values())
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
        await TicketTranscriptService.saveTranscript(ticket.id, structuredTranscript);
        logInfo('TranscriptManagement', `Generated transcript for ticket #${ticket.ticket_number} with ${structuredTranscript.length} messages`);
        generated++;
        
      } catch (error) {
        logError('TranscriptManagement', `Error processing ticket #${ticket.ticket_number}: ${error}`);
        errors++;
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logInfo('TranscriptManagement', `Transcript regeneration completed. Processed: ${processed}, Generated: ${generated}, Errors: ${errors}`);
    return { processed, generated, errors };
    
  } catch (error) {
    logError('TranscriptManagement', `Error in transcript regeneration process: ${error}`);
    return { processed: 0, generated: 0, errors: 0 };
  }
}

/**
 * Get transcript statistics
 */
export async function getTranscriptStats(): Promise<{
  totalTickets: number;
  ticketsWithTranscripts: number;
  ticketsWithoutTranscripts: number;
  transcriptCoverage: number;
}> {
  try {
    const totalTickets = db.prepare(`
      SELECT COUNT(*) as count 
      FROM tickets 
      WHERE status IN ('closed', 'deleted')
    `).get() as { count: number };
    
    const ticketsWithTranscripts = db.prepare(`
      SELECT COUNT(*) as count 
      FROM tickets t
      INNER JOIN ticket_transcripts tt ON t.id = tt.ticket_id
      WHERE t.status IN ('closed', 'deleted')
    `).get() as { count: number };
    
    const ticketsWithoutTranscripts = totalTickets.count - ticketsWithTranscripts.count;
    const transcriptCoverage = totalTickets.count > 0 
      ? Math.round((ticketsWithTranscripts.count / totalTickets.count) * 100)
      : 0;
    
    return {
      totalTickets: totalTickets.count,
      ticketsWithTranscripts: ticketsWithTranscripts.count,
      ticketsWithoutTranscripts,
      transcriptCoverage
    };
  } catch (error) {
    logError('TranscriptManagement', `Error getting transcript stats: ${error}`);
    return {
      totalTickets: 0,
      ticketsWithTranscripts: 0,
      ticketsWithoutTranscripts: 0,
      transcriptCoverage: 0
    };
  }
} 