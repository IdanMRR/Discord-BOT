// Script to update existing welcome configuration
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Path to the database
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'discord-bot.db');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error('Database file not found:', dbPath);
  process.exit(1);
}

// Connect to the database
const db = new Database(dbPath);

try {
  // Get the guild ID from command line arguments or use a default
  const guildId = process.argv[2] || '1365777891333374022'; // Default to your guild ID

  // Check if the guild exists in the database
  const guild = db.prepare('SELECT * FROM server_settings WHERE guild_id = ?').get(guildId);
  
  if (!guild) {
    console.error(`Guild ${guildId} not found in database`);
    process.exit(1);
  }

  // Get the current member_events_config
  let config = {};
  if (guild.member_events_config) {
    try {
      config = JSON.parse(guild.member_events_config);
    } catch (e) {
      console.error('Error parsing existing config:', e);
      config = {};
    }
  }

  // Update the config with a welcome message if it doesn't have one
  if (!config.welcome_message) {
    config.welcome_message = 'Welcome to the server, {user}! We hope you enjoy your stay.';
    console.log('Adding welcome message to config');
  } else {
    console.log('Config already has a welcome message:', config.welcome_message);
  }

  // Make sure enabled is true
  config.enabled = true;

  // Update the database
  const stmt = db.prepare(`
    UPDATE server_settings 
    SET member_events_config = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE guild_id = ?
  `);
  
  const result = stmt.run(JSON.stringify(config), guildId);
  
  console.log(`Updated config for guild ${guildId}`);
  console.log('New config:', JSON.stringify(config, null, 2));
  console.log('Changes applied:', result.changes);

} catch (error) {
  console.error('Error updating configuration:', error);
} finally {
  // Close the database connection
  db.close();
}
