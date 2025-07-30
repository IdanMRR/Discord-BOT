const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function testModerationLogs() {
  console.log('🧪 Testing moderation logs in database...');
  
  try {
    // Connect to the database
    const dbPath = path.join(__dirname, 'data', 'discord-bot.db');
    const db = new sqlite3.Database(dbPath);
    
    // Check if moderation_logs table exists and has data
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='moderation_logs'", (err, tables) => {
      if (err) {
        console.error('❌ Error checking tables:', err);
        return;
      }
      
      if (tables.length === 0) {
        console.log('❌ moderation_logs table does not exist');
        return;
      }
      
      console.log('✅ moderation_logs table exists');
      
      // Check for moderation logs
      db.all("SELECT COUNT(*) as count FROM moderation_logs", (err, result) => {
        if (err) {
          console.error('❌ Error counting moderation logs:', err);
          return;
        }
        
        console.log(`📊 Total moderation logs: ${result[0].count}`);
        
        if (result[0].count > 0) {
          // Get some sample moderation logs
          db.all("SELECT * FROM moderation_logs ORDER BY created_at DESC LIMIT 5", (err, logs) => {
            if (err) {
              console.error('❌ Error getting moderation logs:', err);
              return;
            }
            
            console.log('📋 Sample moderation logs:');
            logs.forEach((log, index) => {
              console.log(`${index + 1}. Action: ${log.action}, User: ${log.user_id}, Moderator: ${log.moderator_id}, Date: ${log.created_at}`);
            });
          });
        } else {
          console.log('ℹ️ No moderation logs found in database');
        }
      });
    });
    
    // Also check command_logs for moderation commands
    db.all("SELECT DISTINCT command FROM command_logs WHERE command IN ('ban', 'kick', 'timeout', 'warn', 'removewarn', 'cases', 'dm')", (err, commands) => {
      if (err) {
        console.error('❌ Error checking command logs:', err);
        return;
      }
      
      console.log('📋 Moderation commands found in command_logs:');
      commands.forEach(cmd => {
        console.log(`- /${cmd.command}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testModerationLogs();