const Database = require('better-sqlite3');
const path = require('path');

// Connect to the database
const db = new Database(path.join(__dirname, 'data', 'discord-bot.db'));

const GUILD_ID = '1365777891333374022';

console.log('🔍 Debugging warnings query...\n');

// Test the exact query that should be running
function getWarnings(guildId, userId, active) {
  try {
    let query = 'SELECT * FROM warnings';
    const params = [];
    
    // Add WHERE clause conditions
    const conditions = [];
    
    // Add guild filter if guildId is provided
    if (guildId) {
      conditions.push('guild_id = ?');
      params.push(guildId);
    }
    
    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    
    if (active !== undefined) {
      conditions.push('active = ?');
      params.push(active ? 1 : 0);
    }
    
    // Add WHERE clause if we have conditions
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    console.log(`📋 Query: ${query}`);
    console.log(`📋 Params: ${JSON.stringify(params)}`);
    
    const stmt = db.prepare(query);
    const warnings = stmt.all(...params);
    
    // Convert SQLite integers to booleans
    warnings.forEach(warning => {
      warning.active = !!warning.active;
    });
    
    return { data: warnings, error: null };
  } catch (error) {
    console.error('Error:', error);
    return { data: [], error };
  }
}

// Test 1: Get all warnings for the guild
console.log('🔍 Test 1: All warnings for guild');
const result1 = getWarnings(GUILD_ID, null, undefined);
console.log(`Result: ${result1.data.length} warnings found`);
if (result1.data.length > 0) {
  console.log('Sample:', result1.data[0]);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 2: Get only active warnings for the guild
console.log('🔍 Test 2: Active warnings for guild');
const result2 = getWarnings(GUILD_ID, null, true);
console.log(`Result: ${result2.data.length} active warnings found`);
if (result2.data.length > 0) {
  console.log('Sample:', result2.data[0]);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 3: Get all warnings without guild filter (what might be happening)
console.log('🔍 Test 3: All warnings (no guild filter)');
const result3 = getWarnings(null, null, undefined);
console.log(`Result: ${result3.data.length} warnings found`);

db.close();