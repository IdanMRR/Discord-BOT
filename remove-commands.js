require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const commandsToRemove = ['test', 'ping', 'ticket'];

// Create a REST instance
const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

async function removeCommands() {
  try {
    console.log('Started removing specified commands...');
    
    // Get client ID from env
    const clientId = process.env.CLIENT_ID;
    if (!clientId) {
      throw new Error('CLIENT_ID is not defined in .env file');
    }
    
    // First, fetch all existing commands
    const commands = await rest.get(
      Routes.applicationCommands(clientId)
    );
    
    console.log(`Found ${commands.length} registered commands.`);
    
    // Find the commands to remove
    for (const cmd of commands) {
      if (commandsToRemove.includes(cmd.name)) {
        console.log(`Removing command: ${cmd.name} (ID: ${cmd.id})`);
        
        // Delete the command
        await rest.delete(
          Routes.applicationCommand(clientId, cmd.id)
        );
        
        console.log(`Successfully removed ${cmd.name} command`);
      }
    }
    
    console.log('Command removal process completed.');
  } catch (error) {
    console.error('Error removing commands:', error);
  }
}

removeCommands();
