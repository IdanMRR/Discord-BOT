const Database = require('better-sqlite3');
const path = require('path');

// Fix usernames in dashboard logs
function fixUsernames() {
  const dbPath = path.join(__dirname, '..', 'data', 'discord-bot.db');
  const db = new Database(dbPath);

  try {
    console.log('Fixing malformed usernames in dashboard logs...');
    
    // Update entries that have the slice pattern (like "User nown", "User 1234", etc.)
    const updateResult = db.prepare(`
      UPDATE dashboard_logs 
      SET username = 'Unknown User' 
      WHERE username LIKE 'User %' 
         OR username = 'User nown'
         OR username IS NULL
    `).run();
    
    console.log(`Updated ${updateResult.changes} log entries with better fallback usernames`);

    // Clear the username cache by updating entries that could be re-fetched
    const clearCacheResult = db.prepare(`
      UPDATE dashboard_logs 
      SET username = NULL 
      WHERE username = 'Unknown User' 
        AND user_id IS NOT NULL 
        AND created_at > datetime('now', '-7 days')
    `).run();
    
    console.log(`Cleared ${clearCacheResult.changes} recent entries for re-fetching`);
    
  } catch (error) {
    console.error('Error fixing usernames:', error);
  } finally {
    db.close();
  }
}

// Run the fix
fixUsernames();