import { Client, Collection, REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define a type for our commands
export interface Command {
  data: any;
  execute: Function;
}

// Create a function to load commands
export async function loadCommands(): Promise<Collection<string, Command>> {
  const commands = new Collection<string, Command>();
  const foldersPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      // Set a new item in the Collection with the key as the command name and the value as the exported module
      if ('data' in command && 'execute' in command) {
        commands.set(command.data.name, command);
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    }
  }

  return commands;
}

// Create a function to register commands with Discord
export async function registerCommands(commands: Collection<string, Command>): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');
  
  try {
    console.log('Started refreshing application (/) commands.');

    // The CLIENT_ID is your bot's application ID
    if (!process.env.CLIENT_ID) {
      throw new Error('CLIENT_ID is not defined in .env file');
    }
    
    // Convert commands to JSON format
    const commandsJson = Array.from(commands.values()).map(command => command.data.toJSON());
    
    // IMPORTANT: We're going to be explicit about where commands are registered
    // to prevent duplicate commands
    
    // First, clear any existing guild commands if we have a test guild ID
    const testGuildId = process.env.TEST_GUILD_ID;
    if (testGuildId) {
      console.log(`Clearing guild commands from test guild: ${testGuildId}...`);
      try {
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, testGuildId),
          { body: [] },
        );
        console.log(`Successfully cleared guild commands from test guild: ${testGuildId}`);
      } catch (error) {
        console.error('Error clearing guild commands:', error);
      }
    }
    
    // Register commands globally for all servers
    console.log('Registering commands globally for all servers...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commandsJson },
    );
    console.log('Successfully registered global commands. Note: This can take up to an hour to propagate to all servers.');

    console.log('Command registration complete.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}
