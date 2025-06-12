import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * This is a standalone script to completely reset all commands.
 * It will clear all global commands and guild commands,
 * fixing any duplicate command issues.
 */

async function fixCommands() {
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
    console.log('This utility will clear ALL commands from your bot to fix duplication issues.');
    
    // First, clear all global commands
    console.log('\n1. Clearing all global application commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }
    );
    console.log('✅ All global commands cleared successfully.');
    
    // Then clear any guild-specific commands
    if (process.env.TEST_GUILD_ID) {
      console.log(`\n2. Clearing commands from test guild: ${process.env.TEST_GUILD_ID}...`);
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.TEST_GUILD_ID),
        { body: [] }
      );
      console.log('✅ All guild commands cleared successfully.');
    } else {
      console.log('\n2. No TEST_GUILD_ID specified, skipping guild command cleanup.');
    }
    
    console.log('\n=====================');
    console.log('COMMAND RESET COMPLETE');
    console.log('=====================');
    console.log('\nYour bot commands have been completely reset.');
    console.log('Please restart your bot to register fresh commands.');
    
  } catch (error) {
    console.error('Error fixing commands:', error);
  }
}

// Run the function
fixCommands();
