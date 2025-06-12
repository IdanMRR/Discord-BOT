import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add case_number column to tickets table
 * This provides unique sequential case numbers for tickets per server
 */
export async function addTicketCaseNumber() {
  try {
    // Check if the tickets table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'"
    ).get();
    
    if (!tableExists) {
      logInfo('Migration', 'Tickets table does not exist yet, will be created with case_number column');
      return true;
    }
    
    // Check if case_number column exists
    const columns = db.pragma('table_info(tickets)') as { name: string }[];
    const hasCaseNumber = columns.some(col => col.name === 'case_number');
    
    if (!hasCaseNumber) {
      // Add the case_number column
      db.exec(`ALTER TABLE tickets ADD COLUMN case_number INTEGER`);
      logInfo('Migration', 'Added case_number column to tickets table');
      
      // Generate case numbers for existing tickets
      const existingTickets = db.prepare(`
        SELECT id, guild_id, created_at 
        FROM tickets 
        WHERE case_number IS NULL 
        ORDER BY guild_id, created_at ASC
      `).all() as { id: number; guild_id: string; created_at: string }[];
      
      if (existingTickets.length > 0) {
        const caseNumbers: { [guildId: string]: number } = {};
        
        // Update each ticket with a case number
        const updateStmt = db.prepare(`UPDATE tickets SET case_number = ? WHERE id = ?`);
        
        for (const ticket of existingTickets) {
          if (!caseNumbers[ticket.guild_id]) {
            caseNumbers[ticket.guild_id] = 1;
          } else {
            caseNumbers[ticket.guild_id]++;
          }
          
          updateStmt.run(caseNumbers[ticket.guild_id], ticket.id);
        }
        
        logInfo('Migration', `Updated ${existingTickets.length} existing tickets with case numbers`);
      }
    } else {
      logInfo('Migration', 'case_number column already exists in tickets table');
    }
    
    logInfo('Migration', 'Successfully completed ticket case number migration');
    return true;
  } catch (error) {
    logError('Migration', `Error during ticket case number migration: ${error}`);
    return false;
  }
} 