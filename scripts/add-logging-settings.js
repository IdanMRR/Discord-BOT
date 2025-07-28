const Database = require('better-sqlite3');
const path = require('path');

// Connect to main database
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

console.log('Adding message logging settings columns...');

// Add logging configuration columns to server_settings table
try {
  db.exec(`
    ALTER TABLE server_settings 
    ADD COLUMN message_delete_logging INTEGER DEFAULT 1
  `);
  console.log('✅ Added message_delete_logging column');
} catch (error) {
  if (error.message.includes('duplicate column name')) {
    console.log('ℹ️  message_delete_logging column already exists');
  } else {
    console.log('❌ Error adding message_delete_logging:', error.message);
  }
}

try {
  db.exec(`
    ALTER TABLE server_settings 
    ADD COLUMN message_edit_logging INTEGER DEFAULT 1
  `);
  console.log('✅ Added message_edit_logging column');
} catch (error) {
  if (error.message.includes('duplicate column name')) {
    console.log('ℹ️  message_edit_logging column already exists');
  } else {
    console.log('❌ Error adding message_edit_logging:', error.message);
  }
}

try {
  db.exec(`
    ALTER TABLE server_settings 
    ADD COLUMN command_logging INTEGER DEFAULT 1
  `);
  console.log('✅ Added command_logging column');
} catch (error) {
  if (error.message.includes('duplicate column name')) {
    console.log('ℹ️  command_logging column already exists');
  } else {
    console.log('❌ Error adding command_logging:', error.message);
  }
}

try {
  db.exec(`
    ALTER TABLE server_settings 
    ADD COLUMN dm_logging INTEGER DEFAULT 1
  `);
  console.log('✅ Added dm_logging column');
} catch (error) {
  if (error.message.includes('duplicate column name')) {
    console.log('ℹ️  dm_logging column already exists');
  } else {
    console.log('❌ Error adding dm_logging:', error.message);
  }
}

// Check current columns
const columns = db.pragma('table_info(server_settings)').map(col => col.name);
console.log('\nCurrent server_settings columns:', columns.filter(col => col.includes('log')));

console.log('\nLogging settings columns added successfully!');
db.close();