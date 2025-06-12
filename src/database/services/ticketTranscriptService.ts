import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

export interface TicketTranscript {
  id?: number;
  ticket_id: number;
  transcript: string; // JSON string of transcript data
  created_at?: string;
}

// Ticket Transcript Service
export const TicketTranscriptService = {
  /**
   * Save a ticket transcript to the database
   * @param ticketId The ID of the ticket
   * @param transcript The transcript data (will be stringified)
   * @returns The created transcript record or null if there was an error
   */
  async saveTranscript(ticketId: number, transcript: any): Promise<TicketTranscript | null> {
    try {
      // Get the ticket number for better logging
      let ticketNumber = ticketId; // fallback to ID if we can't get the number
      try {
        const ticketStmt = db.prepare('SELECT ticket_number FROM tickets WHERE id = ?');
        const ticketData = ticketStmt.get(ticketId) as { ticket_number: number } | undefined;
        if (ticketData) {
          ticketNumber = ticketData.ticket_number;
        }
      } catch (e) {
        // Silent fail, use the database ID as fallback
      }
      
      // Check if a transcript already exists for this ticket
      const existingStmt = db.prepare('SELECT id FROM ticket_transcripts WHERE ticket_id = ?');
      const existing = existingStmt.get(ticketId) as { id: number } | undefined;
      
      if (existing) {
        // Update existing transcript
        const updateStmt = db.prepare(`
          UPDATE ticket_transcripts 
          SET transcript = ?, created_at = CURRENT_TIMESTAMP
          WHERE ticket_id = ?
        `);
        
        const transcriptStr = typeof transcript === 'string' 
          ? transcript 
          : JSON.stringify(transcript);
        
        updateStmt.run(transcriptStr, ticketId);
        
        logInfo('TicketTranscriptService', `Updated transcript for ticket #${ticketNumber}`);
        return {
          id: existing.id,
          ticket_id: ticketId,
          transcript: transcriptStr,
          created_at: new Date().toISOString()
        };
      } else {
        // Create new transcript
        const insertStmt = db.prepare(`
          INSERT INTO ticket_transcripts (ticket_id, transcript)
          VALUES (?, ?)
        `);
        
        const transcriptStr = typeof transcript === 'string' 
          ? transcript 
          : JSON.stringify(transcript);
        
        const result = insertStmt.run(ticketId, transcriptStr);
        
        if (result.changes > 0) {
          logInfo('TicketTranscriptService', `Saved transcript for ticket #${ticketNumber}`);
          return {
            id: result.lastInsertRowid as number,
            ticket_id: ticketId,
            transcript: transcriptStr,
            created_at: new Date().toISOString()
          };
        }
      }
      
      return null;
    } catch (error) {
      logError('TicketTranscriptService', `Error saving transcript for ticket ${ticketId}: ${error}`);
      return null;
    }
  },
  
  /**
   * Get a ticket transcript from the database
   * @param ticketId The ID of the ticket
   * @returns The transcript data (parsed from JSON) or null if not found
   */
  async getTranscript(ticketId: number): Promise<any | null> {
    try {
      const stmt = db.prepare('SELECT * FROM ticket_transcripts WHERE ticket_id = ?');
      const result = stmt.get(ticketId) as TicketTranscript | undefined;
      
      if (result && result.transcript) {
        try {
          // Parse the JSON transcript
          return {
            ...result,
            transcript: JSON.parse(result.transcript)
          };
        } catch (e) {
          // Return the raw string if parsing fails
          return result;
        }
      }
      
      return null;
    } catch (error) {
      logError('TicketTranscriptService', `Error getting transcript for ticket ${ticketId}: ${error}`);
      return null;
    }
  },
  
  /**
   * Check if a transcript exists for a ticket
   * @param ticketId The ID of the ticket
   * @returns True if a transcript exists, false otherwise
   */
  async hasTranscript(ticketId: number): Promise<boolean> {
    try {
      const stmt = db.prepare('SELECT id FROM ticket_transcripts WHERE ticket_id = ?');
      const result = stmt.get(ticketId);
      return !!result;
    } catch (error) {
      logError('TicketTranscriptService', `Error checking transcript for ticket ${ticketId}: ${error}`);
      return false;
    }
  }
};

export default TicketTranscriptService;
