
import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to add the ticket_staff_activity table
 */
export async function addTicketStaffActivityTable() {
  try {
    // Create ticket_staff_activity table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ticket_staff_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        guild_id TEXT NOT NULL,
        staff_id TEXT NOT NULL,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      )
    `);

    // Add index for faster lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ticket_staff_activity_ticket_id
      ON ticket_staff_activity (ticket_id)
    `);

    logInfo('Migration', 'Successfully created ticket_staff_activity table');
    return true;
  } catch (error) {
    logError('Migration', `Failed to create ticket_staff_activity table: ${error}`);
    return false;
  }
}
