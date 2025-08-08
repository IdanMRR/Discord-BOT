import Database from 'better-sqlite3';
import { logInfo, logError } from '../../utils/logger';

export const fixTicketUniqueConstraint = {
  version: '013',
  name: 'fix-ticket-unique-constraint',
  up: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Adding unique constraint to ticket_number per guild...');

      // Check if tickets table exists
      const tablesInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'").get();
      if (!tablesInfo) {
        logInfo('Migration', 'Tickets table does not exist, skipping migration');
        return;
      }

      // First, let's fix any duplicate ticket numbers by updating them
      const duplicates = db.prepare(`
        SELECT guild_id, ticket_number, COUNT(*) as count 
        FROM tickets 
        GROUP BY guild_id, ticket_number 
        HAVING COUNT(*) > 1
        ORDER BY guild_id, ticket_number
      `).all();

      if (duplicates.length > 0) {
        logInfo('Migration', `Found ${duplicates.length} groups of duplicate ticket numbers, fixing...`);
        
        for (const dup of duplicates) {
          // Get all tickets with this duplicate number
          const duplicateTickets = db.prepare(`
            SELECT id, guild_id, ticket_number 
            FROM tickets 
            WHERE guild_id = ? AND ticket_number = ?
            ORDER BY created_at ASC
          `).all((dup as any).guild_id, (dup as any).ticket_number);

          // Keep the first one, renumber the rest
          for (let i = 1; i < duplicateTickets.length; i++) {
            const ticket = duplicateTickets[i];
            
            // Find the next available ticket number for this guild
            const maxTicketNumber = db.prepare(`
              SELECT COALESCE(MAX(ticket_number), 0) as max_num 
              FROM tickets 
              WHERE guild_id = ?
            `).get((ticket as any).guild_id) as any;
            
            const newTicketNumber = (maxTicketNumber?.max_num || 0) + 1;
            
            // Update the duplicate ticket with new number
            db.prepare(`
              UPDATE tickets 
              SET ticket_number = ? 
              WHERE id = ?
            `).run(newTicketNumber, (ticket as any).id);
            
            logInfo('Migration', `Updated ticket ${(ticket as any).id} from #${(ticket as any).ticket_number} to #${newTicketNumber} in guild ${(ticket as any).guild_id}`);
          }
        }
      }

      // Now create the unique constraint by recreating the table
      db.exec('DROP TABLE IF EXISTS tickets_backup');
      db.exec(`
        CREATE TABLE tickets_backup AS 
        SELECT * FROM tickets
      `);

      // Drop the old table
      db.exec('DROP TABLE tickets');

      // Create the new table with unique constraint - including all current columns
      db.exec(`
        CREATE TABLE tickets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          ticket_number INTEGER NOT NULL,
          case_number INTEGER,
          subject TEXT,
          status TEXT DEFAULT 'open',
          deleted INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          closed_at TIMESTAMP,
          closed_by TEXT,
          last_message_at TIMESTAMP,
          notes TEXT,
          last_activity_at TEXT,
          category TEXT,
          priority TEXT,
          rating INTEGER,
          feedback TEXT,
          UNIQUE(guild_id, ticket_number)
        )
      `);

      // Get current table columns to handle graceful column mapping
      const currentColumns = db.prepare("PRAGMA table_info(tickets_backup)").all().map((col: any) => col.name);
      
      // Build dynamic INSERT query based on existing columns
      const insertColumns = ['id', 'guild_id', 'channel_id', 'user_id', 'ticket_number', 'case_number', 'subject', 'status', 'deleted', 'created_at', 'closed_at', 'closed_by', 'last_message_at'];
      const selectColumns = [...insertColumns];
      
      // Add optional columns if they exist in backup
      const optionalColumns = ['notes', 'last_activity_at', 'category', 'priority', 'rating', 'feedback'];
      optionalColumns.forEach(col => {
        if (currentColumns.includes(col)) {
          insertColumns.push(col);
          selectColumns.push(col);
        } else {
          insertColumns.push(col);
          selectColumns.push('NULL as ' + col);
        }
      });

      // Restore data from backup with explicit column mapping
      db.exec(`
        INSERT INTO tickets (${insertColumns.join(', ')})
        SELECT ${selectColumns.join(', ')} FROM tickets_backup
      `);

      // Drop the backup table
      db.exec('DROP TABLE tickets_backup');

      // Recreate indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_guild_status ON tickets(guild_id, status)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets(channel_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at)`);

      logInfo('Migration', 'Unique constraint added to ticket_number per guild successfully');
    } catch (error) {
      logError('Migration', `Error adding unique constraint to tickets: ${error}`);
      throw error;
    }
  },

  down: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Removing unique constraint from ticket_number...');

      // Create backup
      db.exec('DROP TABLE IF EXISTS tickets_backup');
      db.exec(`
        CREATE TABLE tickets_backup AS 
        SELECT * FROM tickets
      `);

      // Drop the current table
      db.exec('DROP TABLE tickets');

      // Create the table without unique constraint (original schema with all columns)
      db.exec(`
        CREATE TABLE tickets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          ticket_number INTEGER NOT NULL,
          case_number INTEGER,
          subject TEXT,
          status TEXT DEFAULT 'open',
          deleted INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          closed_at TIMESTAMP,
          closed_by TEXT,
          last_message_at TIMESTAMP,
          notes TEXT,
          last_activity_at TEXT,
          category TEXT,
          priority TEXT,
          rating INTEGER,
          feedback TEXT
        )
      `);

      // Restore data from backup
      db.exec(`
        INSERT INTO tickets 
        SELECT * FROM tickets_backup
      `);

      // Drop the backup table
      db.exec('DROP TABLE tickets_backup');

      // Recreate indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_guild_status ON tickets(guild_id, status)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets(channel_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at)`);

      logInfo('Migration', 'Unique constraint removed from tickets table');
    } catch (error) {
      logError('Migration', `Error removing unique constraint from tickets: ${error}`);
      throw error;
    }
  }
};

export default fixTicketUniqueConstraint;