const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🔧 Fallback Command Registration Script');
console.log('=====================================');

async function registerCommandsFallback() {
  try {
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN is not defined in environment variables');
    }

    if (!process.env.CLIENT_ID) {
      throw new Error('CLIENT_ID is not defined in environment variables');
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    console.log('📂 Loading commands from dist directory...');
    
    const commands = [];
    const commandsPath = path.join(__dirname, 'dist', 'commands');
    
    if (!fs.existsSync(commandsPath)) {
      throw new Error(`Commands directory not found: ${commandsPath}`);
    }
    
    const loadCommandsFromDir = (dirPath) => {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          loadCommandsFromDir(itemPath);
        } else if (item.endsWith('.js') && !item.endsWith('.d.ts')) {
          try {
            // Clear require cache
            delete require.cache[require.resolve(itemPath)];
            
            const command = require(itemPath);
            const commandData = command.default || command;
            
            if (commandData?.data && typeof commandData.execute === 'function') {
              const commandJson = commandData.data.toJSON();
              commands.push(commandJson);
              console.log(`✅ Loaded: ${commandJson.name}`);
            } else {
              console.warn(`⚠️ Skipped invalid command: ${item}`);
            }
          } catch (error) {
            console.error(`❌ Error loading ${item}:`, error.message);
          }
        }
      }
    };
    
    loadCommandsFromDir(commandsPath);
    
    console.log(`\n📊 Total commands loaded: ${commands.length}`);
    
    if (commands.length === 0) {
      throw new Error('No valid commands found to register');
    }
    
    console.log('\n🧹 Clearing existing commands...');
    
    try {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
      console.log('✅ Existing commands cleared');
    } catch (error) {
      console.warn('⚠️ Could not clear existing commands:', error.message);
    }
    
    console.log('\n🚀 Registering commands with Discord...');
    console.log('⏳ This may take a while, please be patient...');
    
    // Register with a very long timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
    
    try {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { 
          body: commands,
          signal: controller.signal 
        }
      );
      
      clearTimeout(timeoutId);
      
      console.log('✅ Commands sent to Discord successfully!');
      
      // Wait a bit and verify
      console.log('🔍 Verifying registration...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        const registeredCommands = await rest.get(Routes.applicationCommands(process.env.CLIENT_ID));
        console.log(`✅ Verification complete: ${registeredCommands.length} commands registered`);
        
        if (registeredCommands.length !== commands.length) {
          console.warn(`⚠️ Count mismatch: sent ${commands.length}, registered ${registeredCommands.length}`);
          console.log('ℹ️ This is sometimes normal - Discord may take time to process all commands');
        }
      } catch (verifyError) {
        console.warn('⚠️ Could not verify registration:', verifyError.message);
        console.log('ℹ️ Commands were sent successfully and should appear within 1 hour');
      }
      
      console.log('\n🎉 Command registration completed!');
      console.log('ℹ️ Commands may take up to 1 hour to appear in all servers');
      console.log('ℹ️ You can now restart your bot');
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error('❌ Registration timed out after 2 minutes');
        console.log('ℹ️ This usually means Discord is experiencing high load');
        console.log('ℹ️ Try running this script again in a few minutes');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('\n❌ Registration failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Check your DISCORD_TOKEN and CLIENT_ID in .env file');
    console.log('2. Make sure your bot has the applications.commands scope');
    console.log('3. Try running this script again in a few minutes');
    console.log('4. Check Discord status: https://discordstatus.com/');
    process.exit(1);
  }
}

// Run the registration
registerCommandsFallback(); 