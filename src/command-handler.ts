import { Client, Collection, REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { 
  SlashCommandBuilder, 
  ContextMenuCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
  AutocompleteInteraction
} from 'discord.js';

// Define a type for our commands
export type Command = {
  data: 
    | Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand"> 
    | SlashCommandSubcommandsOnlyBuilder
    | ContextMenuCommandBuilder;
  execute: (
    interaction: 
      | ChatInputCommandInteraction
      | MessageContextMenuCommandInteraction
      | UserContextMenuCommandInteraction
  ) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
};

// Create a function to load commands
export async function loadCommands(): Promise<Collection<string, Command>> {
  const commands = new Collection<string, Command>();
  const foldersPath = path.join(__dirname, 'commands');
  
  try {
    console.log(`Loading commands from: ${foldersPath}`);
    
    // Check if the commands directory exists
    if (!fs.existsSync(foldersPath)) {
      console.error(`Commands directory not found: ${foldersPath}`);
      return commands;
    }
    
    const commandFolders = fs.readdirSync(foldersPath);
    console.log(`Found command folders: ${commandFolders.join(', ')}`);

    for (const folder of commandFolders) {
      const commandsPath = path.join(foldersPath, folder);
      
      // Skip if not a directory
      if (!fs.statSync(commandsPath).isDirectory()) {
        console.log(`Skipping non-directory: ${commandsPath}`);
        continue;
      }
      
      console.log(`Processing command folder: ${folder}`);
      
      try {
        const commandFiles = fs.readdirSync(commandsPath)
          .filter(file => (file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts'));
        
        console.log(`Found ${commandFiles.length} command files in ${folder}`);
        
        for (const file of commandFiles) {
          const filePath = path.join(commandsPath, file);
          console.log(`Loading command from: ${filePath}`);
          
          try {
            // Use dynamic import for ES modules
            const commandModule = await import(filePath);
            const command = commandModule.default || commandModule;
            
            // Set a new item in the Collection with the key as the command name and the value as the exported module
            if (command?.data && typeof command.execute === 'function') {
              commands.set(command.data.name, command);
              console.log(`Successfully loaded command: ${command.data.name}`);
            } else {
              console.error(`[WARNING] The command at ${filePath} is missing required properties.`);
              console.error('Command object:', command);
            }
          } catch (error) {
            console.error(`Error loading command from ${filePath}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error reading command folder ${folder}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in loadCommands:', error);
  }

  console.log(`Loaded ${commands.size} commands in total`);
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
    
    // Convert commands to JSON format, filtering out any undefined or null data
    const commandsJson = Array.from(commands.values())
      .map(command => command?.data?.toJSON?.())
      .filter(Boolean); // Remove any undefined or null values
    
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
    if (commandsJson.length > 0) {
      console.log(`Registering ${commandsJson.length} commands globally for all servers...`);
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commandsJson },
      );
      console.log('Successfully registered global commands. Note: This can take up to an hour to propagate to all servers.');
    } else {
      console.warn('No valid commands found to register.');
    }

    console.log('Command registration complete.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}
