require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = '1365777891333374022'; // Your specific guild ID

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ Error: DISCORD_TOKEN and CLIENT_ID must be set in environment variables');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommandsToGuild() {
  try {
    console.log('🚀 GUILD COMMAND REGISTRATION');
    console.log(`📡 Registering commands to guild: ${GUILD_ID}`);
    console.log('⚡ This will make commands available immediately!');
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
    
    // Clear existing guild commands first
    console.log('🧹 Clearing existing guild commands...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: [] }
    );
    console.log('✅ Cleared existing guild commands');
    
    // Register commands to the guild
    console.log('📡 Registering commands to your guild...');
    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    
    console.log('');
    console.log('🎉 SUCCESS! Commands registered!');
    console.log(`✅ Registered ${data.length} commands`);
    console.log('⚡ Commands are available immediately (no waiting time)');
    console.log('');
    console.log('📋 Available commands:');
    data.forEach((cmd, index) => {
      console.log(`  ${index + 1}. /${cmd.name} - ${cmd.description}`);
    });
    console.log('');
    console.log('🎮 Try typing / in your Discord server to see the commands!');
    
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    process.exit(1);
  }
}

registerCommandsToGuild(); 