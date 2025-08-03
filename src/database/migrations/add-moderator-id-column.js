const { db } = require('../sqlite');
const { logInfo, logError } = require('../../utils/logger');

try {
  logInfo('Migration', 'Adding moderator_id column to server_logs table...');
  
  // Check if moderator_id column already exists
  const tableInfo = db.prepare("PRAGMA table_info(server_logs)").all();
  const columnNames = tableInfo.map(col => col.name);
  
  const hasModeratorId = columnNames.includes('moderator_id');
  
  if (!hasModeratorId) {
    db.exec('ALTER TABLE server_logs ADD COLUMN moderator_id TEXT');
    logInfo('Migration', 'Added moderator_id column to server_logs table');
  } else {
    logInfo('Migration', 'moderator_id column already exists in server_logs table');
  }
  
  logInfo('Migration', 'Moderator ID column migration completed successfully');
} catch (error) {
  logError('Migration', `Error adding moderator_id column: ${error}`);
}