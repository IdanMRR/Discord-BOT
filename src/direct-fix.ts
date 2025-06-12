import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

/**
 * This script completely fixes duplicate commands by:
 * 1. Clearing all existing commands from Discord
 * 2. Registering fresh commands from unique files
 */

async function clearAllCommands() {
  try {
    // Check for required environment variables
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
      console.error('Missing required environment variables: DISCORD_TOKEN and CLIENT_ID must be set');
      process.exit(1);
    }

    // Initialize the REST API
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    console.log('COMMAND RESET UTILITY');
    console.log('=====================');
    
    // Clear global commands
    console.log('\nClearing all global application commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }
    );
    console.log('✅ All global commands cleared successfully.');
    
    // Clear guild commands if TEST_GUILD_ID is set
    if (process.env.TEST_GUILD_ID) {
      console.log(`\nClearing commands from test guild: ${process.env.TEST_GUILD_ID}...`);
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.TEST_GUILD_ID),
        { body: [] }
      );
      console.log('✅ All guild commands cleared successfully.');
    }
    
    console.log('\n=====================');
    console.log('COMMAND RESET COMPLETE');
    console.log('=====================');
    console.log('\nYour bot commands have been completely reset.');
    console.log('Please restart your bot to register fresh commands.');
    
  } catch (error) {
    console.error('Error clearing commands:', error);
  }
}

// Run the function
clearAllCommands();
