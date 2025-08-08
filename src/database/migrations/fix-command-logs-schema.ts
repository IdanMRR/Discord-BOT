import Database from 'better-sqlite3';
import { logInfo, logError } from '../../utils/logger';

export const fixCommandLogsSchema = {
  version: '012',
  name: 'fix-command-logs-schema',
  up: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Fixing command_logs table schema...');

      // Check if error_message column exists
      const tableInfo = db.prepare("PRAGMA table_info(command_logs)").all();
      const hasErrorMessageColumn = tableInfo.some((col: any) => col.name === 'error_message');
      
      if (!hasErrorMessageColumn) {
        // Add the missing error_message column
        db.exec('ALTER TABLE command_logs ADD COLUMN error_message TEXT');
        
        // Migrate data from old 'error' column if it exists
        const hasErrorColumn = tableInfo.some((col: any) => col.name === 'error');
        if (hasErrorColumn) {
          db.exec('UPDATE command_logs SET error_message = error WHERE error IS NOT NULL');
        }
      }

      logInfo('Migration', 'Command_logs table schema fixed successfully');
    } catch (error) {
      logError('Migration', `Error fixing command_logs schema: ${error}`);
      throw error;
    }
  },

  down: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Reverting command_logs table schema...');
      
      // Note: SQLite doesn't support DROP COLUMN, so we'll leave the column
      logInfo('Migration', 'Command_logs schema revert completed (column preserved due to SQLite limitations)');
    } catch (error) {
      logError('Migration', `Error reverting command_logs schema: ${error}`);
      throw error;
    }
  }
};

export default fixCommandLogsSchema;