const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function testCommandLogs() {
  console.log('🧪 Testing command logs in database...');
  
  try {
    // Connect to the database
    const dbPath = path.join(__dirname, 'data', 'discord-bot.db');
    const db = new sqlite3.Database(dbPath);
    
    // Check what commands are in the command_logs table
    db.all("SELECT DISTINCT command FROM command_logs ORDER BY command", (err, commands) => {
      if (err) {
        console.error('❌ Error checking command logs:', err);
        return;
      }
      
      console.log('📋 All commands found in command_logs:');
      commands.forEach(cmd => {
        console.log(`- /${cmd.command}`);
      });
      
      // Count total command logs
      db.get("SELECT COUNT(*) as count FROM command_logs", (err, result) => {
        if (err) {
          console.error('❌ Error counting command logs:', err);
          return;
        }
        
        console.log(`\n📊 Total command logs: ${result.count}`);
        
        // Get recent command logs
        db.all("SELECT command, user_id, created_at FROM command_logs ORDER BY created_at DESC LIMIT 10", (err, logs) => {
          if (err) {
            console.error('❌ Error getting recent command logs:', err);
            return;
          }
          
          console.log('\n📋 Recent command logs:');
          logs.forEach((log, index) => {
            console.log(`${index + 1}. /${log.command} by ${log.user_id} at ${log.created_at}`);
          });
        });
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCommandLogs();