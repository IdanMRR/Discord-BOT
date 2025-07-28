#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Determine database path
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'bot.db');

console.log(`🔍 Checking database at: ${dbPath}`);

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`📁 Created data directory: ${dataDir}`);
}

// Connect to database
const db = new Database(dbPath);

console.log('🔧 Fixing Dashboard Activity Logs...');

try {
  // Check if dashboard_logs table exists
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dashboard_logs'");
  const tableExists = tableCheck.get();
  
  if (!tableExists) {
    console.log('❌ dashboard_logs table does not exist. Creating it now...');
    
    // Create dashboard_logs table
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
    
    console.log('✅ dashboard_logs table created successfully');
  } else {
    console.log('✅ dashboard_logs table already exists');
  }
  
  // Get table info to verify structure
  const columns = db.prepare("PRAGMA table_info(dashboard_logs)").all();
  console.log('📋 Table structure:');
  columns.forEach(col => {
    console.log(`   - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
  });
  
  // Check current row count
  const countResult = db.prepare('SELECT COUNT(*) as count FROM dashboard_logs').get();
  console.log(`📊 Current logs count: ${countResult.count}`);
  
  // Create some test data if table is empty
  if (countResult.count === 0) {
    console.log('🧪 Creating test data...');
    
    const insertStmt = db.prepare(`
      INSERT INTO dashboard_logs (
        guild_id, user_id, username, action_type, page, details, success, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const testLogs = [
      ['dashboard', 'user_123', 'TestUser1', 'login', 'dashboard', 'User logged into dashboard', 1, '127.0.0.1', 'Mozilla/5.0'],
      ['dashboard', 'user_456', 'TestUser2', 'view_logs', 'logs', 'User viewed activity logs', 1, '127.0.0.1', 'Mozilla/5.0'],
      ['dashboard', 'user_789', 'TestUser3', 'manage_settings', 'settings', 'User updated server settings', 1, '127.0.0.1', 'Mozilla/5.0'],
      ['guild_123', 'user_123', 'TestUser1', 'view_page', 'servers', 'User viewed servers page', 1, '127.0.0.1', 'Mozilla/5.0'],
      ['guild_456', 'user_456', 'TestUser2', 'export_data', 'logs', 'User exported logs data', 1, '127.0.0.1', 'Mozilla/5.0']
    ];
    
    testLogs.forEach(log => {
      insertStmt.run(...log);
    });
    
    console.log(`✅ Created ${testLogs.length} test log entries`);
  }
  
  // Final verification
  const finalCount = db.prepare('SELECT COUNT(*) as count FROM dashboard_logs').get();
  console.log(`🎉 Dashboard logs table ready with ${finalCount.count} entries`);
  
  // Test a sample query
  const recentLogs = db.prepare(`
    SELECT id, username, action_type, page, created_at 
    FROM dashboard_logs 
    ORDER BY created_at DESC 
    LIMIT 3
  `).all();
  
  console.log('📋 Recent logs sample:');
  recentLogs.forEach(log => {
    console.log(`   - ${log.username}: ${log.action_type} on ${log.page} (${new Date(log.created_at).toLocaleString()})`);
  });

} catch (error) {
  console.error('❌ Error fixing dashboard logs:', error);
  process.exit(1);
} finally {
  db.close();
}

console.log('✅ Dashboard logs fix completed successfully!');
console.log('');
console.log('🚀 You can now:');
console.log('   1. Visit /api/dashboard-logs in your browser to test the API');
console.log('   2. Visit /api/dashboard-logs/viewer to see a simple HTML viewer');
console.log('   3. Check the Dashboard Activity Logs page in your frontend');