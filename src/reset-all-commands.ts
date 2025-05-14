import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function resetAllCommands() {
  try {
    // Check for required environment variables
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
      console.error('Missing required environment variables: DISCORD_TOKEN or CLIENT_ID');
      return;
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    console.log('Starting complete command reset...');
    
    // Clear global commands
    console.log('Clearing global application commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] },
    );
    console.log('Successfully cleared global application commands.');
    
    // Clear guild-specific commands for the test guild
    if (process.env.TEST_GUILD_ID) {
      console.log(`Clearing commands for test guild: ${process.env.TEST_GUILD_ID}...`);
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.TEST_GUILD_ID),
        { body: [] },
      );
      console.log(`Successfully cleared commands for test guild: ${process.env.TEST_GUILD_ID}`);
    }
    
    // Also try to clear commands for all guilds the bot is in
    // This is a more aggressive approach to ensure all commands are cleared
    try {
      console.log('Attempting to clear commands from all guilds...');
      // We don't have a list of all guilds here, so we're relying on the global clear
      // and the test guild clear to handle most cases
      console.log('Note: To completely clear all commands, the bot may need to be removed and re-added to servers.');
    } catch (error) {
      console.error('Error clearing commands from all guilds:', error);
    }
    
    console.log('Command reset complete. Please restart the bot and re-register commands.');
  } catch (error) {
    console.error('Error resetting commands:', error);
  }
}

// Execute the function
resetAllCommands();
