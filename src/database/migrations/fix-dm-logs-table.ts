import { logInfo, logError } from '../../utils/logger';

/**
 * Migration to fix dm_logs table schema
 * Add missing columns that the logger expects
 */
export async function fixDmLogsTable() {
  try {
    // Import db dynamically to ensure connection is ready
    const { db } = await import('../sqlite');
    
    if (!db) {
      logError('Migration', 'Database connection not available for dm_logs migration');
      return false;
    }
    
    // Check if the dm_logs table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='dm_logs'"
    ).get();
    
    if (!tableExists) {
      logInfo('Migration', 'dm_logs table does not exist yet, will be created with correct schema');
      return true;
    }
    
    // Get current table info
    const columns = db.pragma('table_info(dm_logs)') as { name: string }[];
    const columnNames = columns.map(col => col.name);
    
    logInfo('Migration', `Current dm_logs columns: ${columnNames.join(', ')}`);
    
    // Add missing columns
    const columnsToAdd = [
      { name: 'guild_id', type: 'TEXT' },
      { name: 'sender_id', type: 'TEXT' },
      { name: 'recipient_id', type: 'TEXT' },
      { name: 'command', type: 'TEXT' },
      { name: 'success', type: 'INTEGER DEFAULT 1' },
      { name: 'error', type: 'TEXT' }
    ];
    
    for (const column of columnsToAdd) {
      if (!columnNames.includes(column.name)) {
        try {
          db.exec(`ALTER TABLE dm_logs ADD COLUMN ${column.name} ${column.type}`);
          logInfo('Migration', `Added ${column.name} column to dm_logs table`);
        } catch (addError: any) {
          if (!addError.message.includes('duplicate column name')) {
            logError('Migration', `Error adding ${column.name} column: ${addError}`);
          }
        }
      }
    }
    
    // If we have the old columns but new ones too, migrate data
    if (columnNames.includes('source_guild_id') && columnNames.includes('guild_id')) {
      try {
        // Update guild_id from source_guild_id where guild_id is null
        db.exec(`UPDATE dm_logs SET guild_id = source_guild_id WHERE guild_id IS NULL`);
        logInfo('Migration', 'Migrated data from source_guild_id to guild_id');
      } catch (updateError) {
        logError('Migration', `Error migrating data: ${updateError}`);
      }
    }
    
    logInfo('Migration', 'Successfully completed dm_logs table migration');
    return true;
  } catch (error) {
    logError('Migration', `Error during dm_logs table migration: ${error}`);
    return false;
  }
}

// Run the migration with proper async handling
(async () => {
  try {
    // Wait a bit for database to be initialized
    await new Promise(resolve => setTimeout(resolve, 100));
    await fixDmLogsTable();
  } catch (error) {
    logError('Migration', `Failed to run dm_logs migration: ${error}`);
  }
})(); 