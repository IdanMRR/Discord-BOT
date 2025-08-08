import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to fix the CASCADE constraint on ticket_transcripts table
 * This prevents transcripts from being deleted when ticket status changes to 'deleted'
 */
export async function fixTranscriptCascade() {
  try {
    logInfo('Migration', 'Fixing ticket_transcripts CASCADE constraint...');
    
    // Check if the table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='ticket_transcripts'
    `).get();
    
    if (!tableExists) {
      logInfo('Migration', 'ticket_transcripts table does not exist, skipping CASCADE fix');
      return true;
    }
    
    // Check if there's existing data
    const existingData = db.prepare('SELECT * FROM ticket_transcripts').all() as any[];
    logInfo('Migration', `Found ${existingData.length} existing transcripts to preserve`);
    
    // Recreate the table without CASCADE
    db.exec(`
      -- Create new table without CASCADE
      CREATE TABLE ticket_transcripts_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        transcript TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id)
      );
    `);
    
    // Copy existing data if any
    if (existingData.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO ticket_transcripts_new (id, ticket_id, transcript, created_at)
        VALUES (?, ?, ?, ?)
      `);
      
      for (const transcript of existingData) {
        insertStmt.run(transcript.id, transcript.ticket_id, transcript.transcript, transcript.created_at);
      }
      
      logInfo('Migration', `Migrated ${existingData.length} transcripts to new table`);
    }
    
    // Drop old table and rename new one
    db.exec(`
      DROP TABLE IF EXISTS ticket_transcripts;
      ALTER TABLE ticket_transcripts_new RENAME TO ticket_transcripts;
    `);
    
    // Recreate the index
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ticket_transcripts_ticket_id
      ON ticket_transcripts (ticket_id);
    `);
    
    logInfo('Migration', 'Successfully fixed ticket_transcripts CASCADE constraint');
    return true;
  } catch (error) {
    logError('Migration', `Failed to fix transcript CASCADE constraint: ${error}`);
    return false;
  }
}