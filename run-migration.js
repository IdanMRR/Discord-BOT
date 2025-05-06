// This script manually runs the migration to add the language column
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Path to the database
const dbPath = path.join(process.cwd(), 'data', 'discord-bot.db');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found at ${dbPath}`);
  process.exit(1);
}

// Open the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`Error opening database: ${err.message}`);
    process.exit(1);
  }
  console.log('Connected to the database.');
});

// Run the migration
db.serialize(() => {
  // Check if the language column already exists
  db.all("PRAGMA table_info(server_settings)", (err, rows) => {
    if (err) {
      console.error(`Error checking table info: ${err.message}`);
      db.close();
      process.exit(1);
    }

    // Check if language column exists
    const languageColumnExists = rows.some(row => row.name === 'language');
    
    if (!languageColumnExists) {
      console.log('Adding language column to server_settings table...');
      
      // Add the language column
      db.run("ALTER TABLE server_settings ADD COLUMN language TEXT DEFAULT 'en'", (err) => {
        if (err) {
          console.error(`Error adding language column: ${err.message}`);
        } else {
          console.log('Language column added successfully.');
          
          // Update existing records to have the default language
          db.run("UPDATE server_settings SET language = 'en' WHERE language IS NULL", (err) => {
            if (err) {
              console.error(`Error updating language values: ${err.message}`);
            } else {
              console.log('Updated existing records with default language.');
            }
            
            // Check if ticket_logs_channel_id column exists
            const ticketLogsColumnExists = rows.some(row => row.name === 'ticket_logs_channel_id');
            
            if (!ticketLogsColumnExists) {
              console.log('Adding ticket_logs_channel_id column to server_settings table...');
              
              // Add the ticket_logs_channel_id column
              db.run("ALTER TABLE server_settings ADD COLUMN ticket_logs_channel_id TEXT", (err) => {
                if (err) {
                  console.error(`Error adding ticket_logs_channel_id column: ${err.message}`);
                } else {
                  console.log('Ticket logs channel column added successfully.');
                }
                db.close();
              });
            } else {
              console.log('Ticket logs channel column already exists.');
              db.close();
            }
          });
        }
      });
    } else {
      console.log('Language column already exists in server_settings table.');
      
      // Check if ticket_logs_channel_id column exists
      const ticketLogsColumnExists = rows.some(row => row.name === 'ticket_logs_channel_id');
      
      if (!ticketLogsColumnExists) {
        console.log('Adding ticket_logs_channel_id column to server_settings table...');
        
        // Add the ticket_logs_channel_id column
        db.run("ALTER TABLE server_settings ADD COLUMN ticket_logs_channel_id TEXT", (err) => {
          if (err) {
            console.error(`Error adding ticket_logs_channel_id column: ${err.message}`);
          } else {
            console.log('Ticket logs channel column added successfully.');
          }
          db.close();
        });
      } else {
        console.log('Ticket logs channel column already exists.');
        db.close();
      }
    }
  });
});
