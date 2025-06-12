import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// This script completely removes all slash commands from Discord
// It's useful when you need to start fresh due to duplicate commands or other issues

async function clearAllCommands() {
  try {
    // Check for required environment variables
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
      console.error('Missing required environment variables: DISCORD_TOKEN and CLIENT_ID must be set');
      process.exit(1);
    }

    // Initialize the REST API
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    console.log('Starting to clear all application commands...');
    
    // First, get all existing commands
    const commands = await rest.get(
      Routes.applicationCommands(process.env.CLIENT_ID)
    ) as any[];
    
    console.log(`Found ${commands.length} existing commands.`);
    
    // Delete all commands
    for (const command of commands) {
      console.log(`Deleting command: ${command.name} (ID: ${command.id})`);
      await rest.delete(
        Routes.applicationCommand(process.env.CLIENT_ID, command.id)
      );
    }
    
    console.log('All application commands have been deleted.');
    console.log('You can now run the bot again to register fresh commands without duplicates.');
    
  } catch (error) {
    console.error('Error clearing commands:', error);
  }
}

// Run the function
clearAllCommands();
