require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.TEST_GUILD_ID; // Use environment variable - optional

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ Error: DISCORD_TOKEN and CLIENT_ID must be set in environment variables');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommandsInstantly() {
  try {
    console.log('🚀 INSTANT COMMAND REGISTRATION');
    if (GUILD_ID) {
      console.log(`📡 Registering commands to guild: ${GUILD_ID}`);
      console.log('⚡ This will make commands available immediately!');
    } else {
      console.log('📡 Registering commands globally (no guild ID provided)');
      console.log('⚡ Global commands may take up to 1 hour to appear');
    }
    console.log('');
    
    // Load all commands from dist folder
    const commands = [];
    const commandsPath = path.join(__dirname, 'dist', 'commands');
    
    if (!fs.existsSync(commandsPath)) {
      console.error('❌ Commands directory not found. Please run "npm run build" first.');
      process.exit(1);
    }
    
    // Function to recursively load commands
    const loadCommandsFromDir = (dirPath) => {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          loadCommandsFromDir(itemPath);
        } else if (item.endsWith('.js') && !item.includes('index.js')) {
          try {
            const command = require(itemPath);
            if (command.data && command.data.toJSON) {
              commands.push(command.data.toJSON());
              console.log(`✅ Loaded: ${command.data.name}`);
            }
          } catch (error) {
            console.error(`❌ Error loading ${item}:`, error.message);
          }
        }
      }
    };
    
    // Load all commands
    console.log('📂 Loading commands...');
    loadCommandsFromDir(commandsPath);
    
    console.log('');
    console.log(`📝 Found ${commands.length} commands to register`);
    console.log('');
    
    if (GUILD_ID) {
      // Clear existing guild commands first
      console.log('🧹 Clearing existing guild commands...');
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: [] }
      );
      console.log('✅ Cleared existing guild commands');
      
      // Register commands to the guild
      console.log('📡 Registering commands to your guild...');
      var data = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
    } else {
      // Clear existing global commands first
      console.log('🧹 Clearing existing global commands...');
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: [] }
      );
      console.log('✅ Cleared existing global commands');
      
      // Register commands globally
      console.log('📡 Registering commands globally...');
      var data = await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
    }
    
    console.log('');
    console.log('🎉 SUCCESS! Commands registered!');
    console.log(`✅ Registered ${data.length} commands`);
    if (GUILD_ID) {
      console.log('⚡ Commands are available immediately (no waiting time)');
    } else {
      console.log('⚡ Global commands may take up to 1 hour to appear');
    }
    console.log('');
    console.log('🔄 Try typing "/" in Discord to see your bot commands!');
    console.log('');
    console.log('📋 Some commands to try:');
    console.log('   • /help - Show help menu');
    console.log('   • /server-setup - Set up your server');
    console.log('   • /serverinfo - Show server information');
    console.log('   • /setup-ticket - Set up ticket system');
    
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    process.exit(1);
  }
}

registerCommandsInstantly(); 