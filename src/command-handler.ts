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

// Keep track of loaded command names to prevent duplicates
const loadedCommandNames = new Set<string>();

// Create a function to load commands
export async function loadCommands(): Promise<Collection<string, Command>> {
  // Clear the set of loaded command names on each load
  loadedCommandNames.clear();
  
  const commands = new Collection<string, Command>();
  
  // Always use the dist directory for better performance (compiled JavaScript)
  const foldersPath = path.join(process.cwd(), 'dist', 'commands');
  
  try {
    console.log(`[Command Loader] Loading commands from: ${foldersPath}`);
    
    // Check if the commands directory exists
    if (!fs.existsSync(foldersPath)) {
      console.error(`[Command Loader] Commands directory not found: ${foldersPath}`);
      return commands;
    }
    
    const commandFolders = fs.readdirSync(foldersPath);
    console.log(`Found command folders: ${commandFolders.join(', ')}`);

    // Use Promise.all for parallel loading to speed up startup
    const loadPromises: Promise<void>[] = [];

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
          .filter(file => file.endsWith('.js') && !file.endsWith('.d.ts')); // Only .js files from dist
        
        console.log(`Found ${commandFiles.length} command files in ${folder}`);
        
        // Create promises for parallel loading
        for (const file of commandFiles) {
          const filePath = path.join(commandsPath, file);
          
          loadPromises.push(
            (async () => {
              try {
                // Use dynamic import for ES modules
                const commandModule = await import(filePath);
                const command = commandModule.default || commandModule;
                
                // Set a new item in the Collection with the key as the command name and the value as the exported module
                if (command?.data && typeof command.execute === 'function') {
                  const commandName = command.data.name;
                  
                  // Check if this command name has already been loaded
                  if (loadedCommandNames.has(commandName)) {
                    console.log(`Skipping duplicate command: ${commandName} from ${filePath}`);
                  } else {
                    // Add the command name to our set of loaded commands
                    loadedCommandNames.add(commandName);
                    
                    // Add the command to our collection
                    commands.set(commandName, command);
                    console.log(`Successfully loaded command: ${commandName}`);
                  }
                } else {
                  console.error(`[WARNING] The command at ${filePath} is missing required properties.`);
                  console.error('Command object:', command);
                }
              } catch (error) {
                console.error(`Error loading command from ${filePath}:`, error);
              }
            })()
          );
        }
      } catch (error) {
        console.error(`Error reading command folder ${folder}:`, error);
      }
    }
    
    // Wait for all commands to load in parallel
    await Promise.all(loadPromises);
    
  } catch (error) {
    console.error('Error in loadCommands:', error);
  }

  console.log(`Loaded ${commands.size} commands in total`);
  return commands;
}

// Create a function to register commands with Discord
// Global flag to track if commands have been registered
let commandsRegistered = false;

export async function registerCommands(commands: Collection<string, Command>): Promise<void> {
  // Avoid double registration - this is critical to prevent duplicate commands
  if (commandsRegistered) {
    console.log('[Command Register] Commands already registered. Skipping to prevent duplicates.');
    return;
  }
  
  console.log(`[Command Register] Starting registration of ${commands.size} commands...`);
  
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');
  
  // Clear existing commands first
  try {
    if (!process.env.CLIENT_ID) {
      throw new Error('CLIENT_ID is not defined in environment variables');
    }
    
    console.log('[Command Register] Clearing existing commands...');
    
    // Clear global commands
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }
    );
    
    // Clear guild commands if TEST_GUILD_ID is set
    if (process.env.TEST_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.TEST_GUILD_ID),
        { body: [] }
      );
    }
    
    console.log('[Command Register] Successfully cleared existing commands');
  } catch (error) {
    console.error('[Command Register] Error clearing commands:', error);
    // Don't return here, we still want to try registering new commands
  }
  
  try {
    if (!process.env.CLIENT_ID) {
      throw new Error('CLIENT_ID is not defined in environment variables');
    }
    
    console.log('[Command Register] Started refreshing application (/) commands.');

    // The CLIENT_ID is your bot's application ID
    if (!process.env.CLIENT_ID) {
      throw new Error('CLIENT_ID is not defined in .env file');
    }
    
    // Use a Map to ensure each command name is only registered once
    const uniqueCommands = new Map();
    const duplicates = [];
    
    // Loop through commands and deduplicate by name
    for (const command of commands.values()) {
      if (command?.data?.name) {
        const commandName = command.data.name;
        
        // Check for duplicates
        if (uniqueCommands.has(commandName)) {
          duplicates.push(commandName);
        } else {
          uniqueCommands.set(commandName, command);
        }
      }
    }
    
    // Log duplicates if any were found
    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate command names: ${duplicates.join(', ')}`);
    }
    
    console.log(`Deduplication: ${commands.size} commands reduced to ${uniqueCommands.size} unique commands`);
    
    // Convert unique commands to JSON format
    const commandsJson = Array.from(uniqueCommands.values())
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
    
    // Register commands globally for all servers WITH TIMEOUT
    if (commandsJson.length > 0) {
      console.log(`Registering ${commandsJson.length} commands globally for all servers...`);
      
      // Add timeout to prevent hanging
      const registrationPromise = rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commandsJson },
      );
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Command registration timed out after 30 seconds'));
        }, 30000); // 30 second timeout
      });
      
      try {
        await Promise.race([registrationPromise, timeoutPromise]);
        
        // First, check if the commands were registered correctly
        const registeredCommands = await rest.get(
          Routes.applicationCommands(process.env.CLIENT_ID)
        ) as any[];
        
        console.log(`Successfully registered ${registeredCommands.length} global commands.`);
        console.log('Note: This can take up to an hour to propagate to all servers.');
        
        // Set the flag to indicate commands have been registered
        commandsRegistered = true;
      } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
          console.warn('[Command Register] Command registration timed out, but continuing with bot startup...');
          console.warn('[Command Register] Commands may still be registering in the background.');
          commandsRegistered = true; // Prevent retries
        } else {
          throw error;
        }
      }
    } else {
      console.warn('No valid commands found to register.');
    }

    console.log('Command registration complete.');
  } catch (error) {
    console.error('Error registering commands:', error);
    console.log('Bot will continue to run even with command registration errors...');
    commandsRegistered = true; // Prevent retries that could block the bot
  }
}
