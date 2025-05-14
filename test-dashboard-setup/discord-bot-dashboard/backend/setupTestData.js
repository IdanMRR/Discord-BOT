// setupTestData.js
// This script populates the database with test data for development purposes

const path = require('path');
const BetterSqlite3 = require('better-sqlite3');
const fs = require('fs');

// Set up database connection to the bot's SQLite database
const dbPath = path.resolve('/Users/idanmr/Downloads/Discord-BOT/data/discord-bot.db');

try {
  // Create the directory if it doesn't exist
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  const db = new BetterSqlite3(dbPath, { readonly: false });
  console.log('Connected to bot database at:', dbPath);
  
  // Insert test data
  insertTestData(db);
  
  console.log('Test data setup complete!');
  db.close();
} catch (error) {
  console.error('Error setting up test data:', error);
}

function insertTestData(db) {
  // Insert test server settings if not exist
  try {
    // First check if we already have data
    const existingServers = db.prepare('SELECT COUNT(*) as count FROM server_settings').get();
    
    if (existingServers.count === 0) {
      const insertServerSettings = db.prepare(`
        INSERT INTO server_settings 
        (guild_id, name, log_channel_id, mod_log_channel_id, message_log_channel_id, 
        welcome_channel_id, welcome_message, ticket_logs_channel_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Test Server 1
      insertServerSettings.run(
        '123456789012345678',
        'Test Server',
        '111222333444555666',
        '444444444444444444',
        '555555555555555555',
        '333333333333333333',
        'Welcome {user} to {server}!',
        '222222222222222222'
      );
      
      // Test Server 2
      insertServerSettings.run(
        '876543210987654321',
        'Another Server',
        '444555666777888999',
        '888888888888888888',
        '999999999999999999',
        null,
        'Welcome to our server, {user}!',
        '777777777777777777'
      );
      
      console.log('Server settings inserted successfully.');
    } else {
      console.log('Server settings already exist, skipping insertion.');
    }
  } catch (error) {
    console.error('Error inserting server settings:', error);
  }
  
  // Insert test tickets if not exist
  try {
    const existingTickets = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
    
    if (existingTickets.count === 0) {
      const insertTicket = db.prepare(`
        INSERT INTO tickets 
        (guild_id, channel_id, user_id, ticket_number, subject, status, created_at, closed_at, closed_by, last_message_at, category, rating, feedback) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Ticket 1 - closed with rating
      insertTicket.run(
        '123456789012345678',
        '123123123123123123',
        '111222333444555666',
        1,
        'Help with bot setup',
        'closed',
        '2023-07-15T14:30:00.000Z',
        '2023-07-15T16:45:00.000Z',
        '555666777888999000',
        '2023-07-15T16:30:00.000Z',
        'support',
        5,
        'Great support!'
      );
      
      // Ticket 2 - open
      insertTicket.run(
        '123456789012345678',
        '456456456456456456',
        '222333444555666777',
        2,
        'Bot not responding',
        'open',
        '2023-07-20T09:15:00.000Z',
        null,
        null,
        '2023-07-20T10:30:00.000Z',
        'bug',
        null,
        null
      );
      
      // Ticket 3 - in progress
      insertTicket.run(
        '123456789012345678',
        '789789789789789789',
        '333444555666777888',
        3,
        'Feature request',
        'in_progress',
        '2023-07-25T11:00:00.000Z',
        null,
        null,
        '2023-07-26T14:20:00.000Z',
        'suggestion',
        null,
        null
      );
      
      console.log('Tickets inserted successfully.');
    } else {
      console.log('Tickets already exist, skipping insertion.');
    }
  } catch (error) {
    console.error('Error inserting tickets:', error);
  }
  
  // Insert verification settings if not exist
  try {
    const existingSettings = db.prepare('SELECT COUNT(*) as count FROM verification_settings').get();
    
    if (!existingSettings || existingSettings.count === 0) {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS verification_settings (
          guild_id TEXT PRIMARY KEY,
          enabled INTEGER DEFAULT 0,
          type TEXT DEFAULT 'button',
          role_id TEXT,
          channel_id TEXT,
          message_id TEXT,
          custom_questions TEXT,
          min_age INTEGER DEFAULT 13,
          require_account_age INTEGER DEFAULT 0,
          min_account_age_days INTEGER DEFAULT 7,
          log_channel_id TEXT,
          timeout_minutes INTEGER DEFAULT 10,
          welcome_message TEXT,
          welcome_channel_id TEXT
        )
      `).run();
      
      const insertVerificationSettings = db.prepare(`
        INSERT INTO verification_settings 
        (guild_id, enabled, type, role_id, channel_id, message_id, custom_questions, 
        min_age, require_account_age, min_account_age_days, log_channel_id, timeout_minutes) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertVerificationSettings.run(
        '123456789012345678',
        1,
        'form',
        '123000123000123000',
        '456000456000456000',
        '789000789000789000',
        JSON.stringify([
          { question: 'How old are you?', type: 'text', required: true },
          { question: 'Have you read the rules?', type: 'boolean', required: true }
        ]),
        13,
        1,
        7,
        '321000321000321000',
        10
      );
      
      console.log('Verification settings inserted successfully.');
    } else {
      console.log('Verification settings already exist, skipping insertion.');
    }
  } catch (error) {
    console.error('Error inserting verification settings:', error);
  }
} 