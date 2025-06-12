import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add the ticket_transcripts table
 */
export async function addTicketTranscriptsTable() {
  try {
    // Create ticket_transcripts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        transcript TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      )
    `);

    // Add index for faster lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ticket_transcripts_ticket_id
      ON ticket_transcripts (ticket_id)
    `);

    logInfo('Migration', 'Successfully created ticket_transcripts table');
    return true;
  } catch (error) {
    logError('Migration', `Failed to create ticket_transcripts table: ${error}`);
    return false;
  }
}
