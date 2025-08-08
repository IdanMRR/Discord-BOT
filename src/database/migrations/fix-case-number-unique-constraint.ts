import Database from 'better-sqlite3';
import { logInfo, logError } from '../../utils/logger';

export const fixCaseNumberUniqueConstraint = {
  version: '014',
  name: 'fix-case-number-unique-constraint',
  up: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Adding unique constraint to case_number per guild...');

      // Check if warnings table exists
      const tablesInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='warnings'").get();
      if (!tablesInfo) {
        logInfo('Migration', 'Warnings table does not exist, skipping migration');
        return;
      }

      // First, let's fix any duplicate case numbers by updating them
      const duplicates = db.prepare(`
        SELECT guild_id, case_number, COUNT(*) as count 
        FROM warnings 
        WHERE case_number IS NOT NULL
        GROUP BY guild_id, case_number 
        HAVING COUNT(*) > 1
        ORDER BY guild_id, case_number
      `).all();

      if (duplicates.length > 0) {
        logInfo('Migration', `Found ${duplicates.length} groups of duplicate case numbers, fixing...`);
        
        for (const dup of duplicates) {
          // Get all warnings with this duplicate case number
          const duplicateWarnings = db.prepare(`
            SELECT id, guild_id, case_number 
            FROM warnings 
            WHERE guild_id = ? AND case_number = ?
            ORDER BY created_at ASC
          `).all((dup as any).guild_id, (dup as any).case_number);

          // Keep the first one, renumber the rest
          for (let i = 1; i < duplicateWarnings.length; i++) {
            const warning = duplicateWarnings[i];
            
            // Find the next available case number for this guild
            const maxCaseNumber = db.prepare(`
              SELECT COALESCE(MAX(case_number), 0) as max_num 
              FROM warnings 
              WHERE guild_id = ?
            `).get((warning as any).guild_id) as any;
            
            const newCaseNumber = (maxCaseNumber?.max_num || 0) + 1;
            
            // Update the duplicate warning with new case number
            db.prepare(`
              UPDATE warnings 
              SET case_number = ? 
              WHERE id = ?
            `).run(newCaseNumber, (warning as any).id);
            
            logInfo('Migration', `Updated warning ${(warning as any).id} from case #${(warning as any).case_number} to case #${newCaseNumber} in guild ${(warning as any).guild_id}`);
          }
        }
      }

      // Now create the unique constraint by recreating the table
      db.exec('DROP TABLE IF EXISTS warnings_backup');
      db.exec(`
        CREATE TABLE warnings_backup AS 
        SELECT * FROM warnings
      `);

      // Drop the old table
      db.exec('DROP TABLE warnings');

      // Create the new table without inline unique constraint
      db.exec(`
        CREATE TABLE warnings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          moderator_id TEXT NOT NULL,
          reason TEXT,
          active INTEGER DEFAULT 1,
          removed_by TEXT,
          removed_at TIMESTAMP,
          removal_reason TEXT,
          case_number INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Restore data from backup
      db.exec(`
        INSERT INTO warnings 
        SELECT * FROM warnings_backup
      `);

      // Drop the backup table
      db.exec('DROP TABLE warnings_backup');

      // Recreate indexes and add unique constraint as partial index
      db.exec(`CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_warnings_guild_active ON warnings(guild_id, active)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_warnings_case_number ON warnings(guild_id, case_number)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_warnings_created_at ON warnings(created_at)`);
      
      // Create partial unique index for the constraint (only for non-null case_numbers)
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_warnings_unique_case_per_guild ON warnings(guild_id, case_number) WHERE case_number IS NOT NULL`);

      logInfo('Migration', 'Unique constraint added to case_number per guild successfully');
    } catch (error) {
      logError('Migration', `Error adding unique constraint to warnings: ${error}`);
      throw error;
    }
  },

  down: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Removing unique constraint from case_number...');

      // Create backup
      db.exec('DROP TABLE IF EXISTS warnings_backup');
      db.exec(`
        CREATE TABLE warnings_backup AS 
        SELECT * FROM warnings
      `);

      // Drop the current table
      db.exec('DROP TABLE warnings');

      // Create the table without unique constraint (original schema)
      db.exec(`
        CREATE TABLE warnings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          moderator_id TEXT NOT NULL,
          reason TEXT,
          active INTEGER DEFAULT 1,
          removed_by TEXT,
          removed_at TIMESTAMP,
          removal_reason TEXT,
          case_number INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Restore data from backup
      db.exec(`
        INSERT INTO warnings 
        SELECT * FROM warnings_backup
      `);

      // Drop the backup table
      db.exec('DROP TABLE warnings_backup');

      // Recreate indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_warnings_guild_active ON warnings(guild_id, active)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_warnings_case_number ON warnings(guild_id, case_number)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_warnings_created_at ON warnings(created_at)`);

      logInfo('Migration', 'Unique constraint removed from warnings table');
    } catch (error) {
      logError('Migration', `Error removing unique constraint from warnings: ${error}`);
      throw error;
    }
  }
};

export default fixCaseNumberUniqueConstraint;