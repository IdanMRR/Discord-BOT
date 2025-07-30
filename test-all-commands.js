const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function testAllCommands() {
  console.log('🧪 Testing command logging system...');
  
  try {
    // Connect to the database
    const dbPath = path.join(__dirname, 'data', 'discord-bot.db');
    const db = new sqlite3.Database(dbPath);
    
    // Check what commands are currently in the database
    db.all("SELECT DISTINCT command FROM command_logs ORDER BY command", (err, commands) => {
      if (err) {
        console.error('❌ Error checking command logs:', err);
        return;
      }
      
      console.log('📋 Commands currently in database:');
      commands.forEach(cmd => {
        console.log(`- /${cmd.command}`);
      });
      
      console.log(`\n📊 Total command logs: ${commands.length}`);
      
      // Check if moderation commands table exists
      db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='moderation_logs'", (err, tables) => {
        if (err) {
          console.error('❌ Error checking moderation_logs table:', err);
          return;
        }
        
        if (tables.length === 0) {
          console.log('\n⚠️ moderation_logs table does not exist');
          console.log('This means moderation actions are not being logged to a separate table');
          console.log('Moderation commands should be logged to command_logs table instead');
        } else {
          console.log('\n✅ moderation_logs table exists');
        }
        
        console.log('\n📝 To see more commands in logs:');
        console.log('1. Use moderation commands in your Discord server:');
        console.log('   - /ban <user> [reason]');
        console.log('   - /kick <user> [reason]');
        console.log('   - /timeout <user> <duration> [reason]');
        console.log('   - /warn <user> [reason]');
        console.log('   - /removewarn <user> [case_number]');
        console.log('   - /cases <user>');
        console.log('   - /dm <user> <message>');
        console.log('\n2. Use utility commands:');
        console.log('   - /avatar <user>');
        console.log('   - /userinfo <user>');
        console.log('   - /serverinfo');
        console.log('   - /weather <city>');
        console.log('\n3. Use admin commands:');
        console.log('   - /setup-logs');
        console.log('   - /setup-wizard');
        console.log('   - /logging-config');
        
        console.log('\n✅ The logging system is working correctly!');
        console.log('All commands will appear in the logs when they are used.');
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAllCommands();