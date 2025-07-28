import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to create dashboard_logs table for tracking user activities
 */
export async function addDashboardLogsTable(): Promise<void> {
  try {
    // Check if dashboard_logs table exists
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dashboard_logs'");
    const tableExists = tableCheck.get();
    
    if (!tableExists) {
      logInfo('Migration', 'Creating dashboard_logs table...');
      
      // Create dashboard_logs table with all required columns
      db.exec(`
        CREATE TABLE dashboard_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT,
          user_id TEXT NOT NULL,
          username TEXT,
          action_type TEXT NOT NULL,
          page TEXT NOT NULL,
          target_type TEXT,
          target_id TEXT,
          old_value TEXT,
          new_value TEXT,
          ip_address TEXT,
          user_agent TEXT,
          details TEXT,
          success BOOLEAN DEFAULT 1,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes for better performance
      db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_user_id ON dashboard_logs(user_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_action ON dashboard_logs(action_type)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_page ON dashboard_logs(page)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_created ON dashboard_logs(created_at)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_target ON dashboard_logs(target_type, target_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_guild ON dashboard_logs(guild_id)');
      
      logInfo('Migration', 'dashboard_logs table created successfully');
    } else {
      logInfo('Migration', 'dashboard_logs table already exists, checking and adding missing columns...');
      
      // Get existing columns
      const columns = db.prepare("PRAGMA table_info(dashboard_logs)").all() as any[];
      const columnNames = columns.map(col => col.name);
      
      // Check and add missing columns one by one
      const requiredColumns = [
        { name: 'guild_id', type: 'TEXT' },
        { name: 'username', type: 'TEXT' },
        { name: 'action_type', type: 'TEXT NOT NULL DEFAULT "unknown_action"' },
        { name: 'page', type: 'TEXT NOT NULL DEFAULT "unknown"' },
        { name: 'target_type', type: 'TEXT' },
        { name: 'target_id', type: 'TEXT' },
        { name: 'old_value', type: 'TEXT' },
        { name: 'new_value', type: 'TEXT' },
        { name: 'ip_address', type: 'TEXT' },
        { name: 'user_agent', type: 'TEXT' },
        { name: 'details', type: 'TEXT' },
        { name: 'success', type: 'BOOLEAN DEFAULT 1' },
        { name: 'error_message', type: 'TEXT' }
      ];
      
      for (const column of requiredColumns) {
        if (!columnNames.includes(column.name)) {
          try {
            logInfo('Migration', `Adding ${column.name} column to dashboard_logs table`);
            db.exec(`ALTER TABLE dashboard_logs ADD COLUMN ${column.name} ${column.type}`);
          } catch (error) {
            logError('Migration', `Error adding ${column.name} column: ${error}`);
          }
        }
      }
      
      // Create missing indexes
      try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_user_id ON dashboard_logs(user_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_action ON dashboard_logs(action_type)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_page ON dashboard_logs(page)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_created ON dashboard_logs(created_at)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_target ON dashboard_logs(target_type, target_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_dashboard_logs_guild ON dashboard_logs(guild_id)');
      } catch (error) {
        logError('Migration', `Error creating indexes: ${error}`);
      }
    }
    
  } catch (error) {
    logError('Migration', `Error creating dashboard_logs table: ${error}`);
    throw error;
  }
}

export { addDashboardLogsTable as migrate }; 