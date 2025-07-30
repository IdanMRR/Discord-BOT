const Database = require('better-sqlite3');
const path = require('path');

// Connect to the database
const db = new Database(path.join(__dirname, 'data', 'discord-bot.db'));

console.log('Checking warnings table...');
try {
  // Check if warnings table exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='warnings'
  `).get();
  
  if (tableExists) {
    console.log('✅ Warnings table exists');
    
    // Get warnings count
    const count = db.prepare('SELECT COUNT(*) as count FROM warnings').get();
    console.log(`📊 Total warnings: ${count.count}`);
    
    // Get some sample warnings
    const warnings = db.prepare('SELECT * FROM warnings LIMIT 5').all();
    console.log('📋 Sample warnings:');
    console.log(warnings);
    
    // Check for recent warnings
    const recentWarnings = db.prepare('SELECT * FROM warnings ORDER BY created_at DESC LIMIT 3').all();
    console.log('🕒 Recent warnings:');
    console.log(recentWarnings);
  } else {
    console.log('❌ Warnings table does not exist');
  }
} catch (error) {
  console.error('Error checking warnings:', error);
}

console.log('\nChecking server_logs table...');
try {
  // Check if server_logs table exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='server_logs'
  `).get();
  
  if (tableExists) {
    console.log('✅ Server_logs table exists');
    
    // Get logs count
    const count = db.prepare('SELECT COUNT(*) as count FROM server_logs').get();
    console.log(`📊 Total logs: ${count.count}`);
    
    // Get some sample logs
    const logs = db.prepare('SELECT * FROM server_logs LIMIT 5').all();
    console.log('📋 Sample logs:');
    console.log(logs);
  } else {
    console.log('❌ Server_logs table does not exist');
  }
} catch (error) {
  console.error('Error checking logs:', error);
}

// Check all tables
console.log('\n📊 All tables in database:');
const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table'
`).all();
console.log(tables);

db.close();