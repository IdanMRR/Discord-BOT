import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function clearCommands() {
  try {
    // Check for required environment variables
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
      console.error('Missing required environment variables: DISCORD_TOKEN or CLIENT_ID');
      return;
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    console.log('Started clearing global application commands...');
    
    // Clear global commands by setting an empty array
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] },
    );
    
    console.log('Successfully cleared global application commands.');
    
    // Clear guild-specific commands too
    if (process.env.TEST_GUILD_ID) {
      console.log(`Clearing commands for test guild: ${process.env.TEST_GUILD_ID}...`);
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.TEST_GUILD_ID),
        { body: [] },
      );
      console.log(`Successfully cleared commands for test guild: ${process.env.TEST_GUILD_ID}`);
    }
    
    console.log('Command clearing complete.');
  } catch (error) {
    console.error('Error clearing commands:', error);
  }
}

// Execute the function
clearCommands();
