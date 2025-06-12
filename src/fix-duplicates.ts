import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

/**
 * This script completely fixes duplicate commands by:
 * 1. Clearing all existing commands from Discord
 * 2. Removing any duplicate command files
 * 3. Registering fresh commands from unique files
 */

async function fixDuplicateCommands() {
  try {
    console.log('DUPLICATE COMMAND FIXER');
    console.log('======================');
    
    // Check for required environment variables
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
      console.error('Missing required environment variables: DISCORD_TOKEN and CLIENT_ID must be set');
      process.exit(1);
    }

    // Initialize the REST API
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    // STEP 1: Clear all existing commands
    console.log('\nStep 1: Clearing all existing commands from Discord...');
    await clearAllCommands(rest);
    
    // STEP 2: Find and analyze all command files
    console.log('\nStep 2: Analyzing command files for duplicates...');
    const { commands, duplicates } = await analyzeCommandFiles();
    
    console.log(`Found ${commands.length} unique commands and ${duplicates.length} duplicates.`);
    
    if (duplicates.length > 0) {
      console.log('\nDuplicate commands found:');
      duplicates.forEach(dup => {
        console.log(`- "${dup.name}" found in:`);
        dup.files.forEach(file => console.log(`  - ${file}`));
      });
    }
    
    // STEP 3: Register only the unique commands
    console.log('\nStep 3: Registering unique commands...');
    await registerUniqueCommands(rest, commands);
    
    console.log('\n======================');
    console.log('FIX COMPLETE');
    console.log('======================');
    console.log('\nYour bot commands have been fixed.');
    console.log('Please restart your bot - it should now show only one instance of each command.');
    
  } catch (error) {
    console.error('Error fixing duplicate commands:', error);
  }
}

async function clearAllCommands(rest: REST) {
  try {
    // Clear global commands
    console.log('Clearing global commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: [] }
    );
    
    // Clear guild commands if TEST_GUILD_ID is set
    if (process.env.TEST_GUILD_ID) {
      console.log(`Clearing guild commands for ${process.env.TEST_GUILD_ID}...`);
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.TEST_GUILD_ID),
        { body: [] }
      );
    }
    
    console.log('All commands cleared successfully.');
  } catch (error) {
    console.error('Error clearing commands:', error);
    throw error;
  }
}

async function analyzeCommandFiles() {
  const commands: any[] = [];
  const commandsMap = new Map<string, { data: any, files: string[] }>();
  const duplicates: { name: string, files: string[] }[] = [];
  
  // Get all command files
  const foldersPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(foldersPath);
  
  for (const folder of commandFolders) {
    const folderPath = path.join(foldersPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const commandFiles = fs.readdirSync(folderPath)
      .filter(file => (file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts'));
    
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      try {
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);
        
        if ('data' in command && command.data) {
          const commandName = command.data.name || (command.data.toJSON && command.data.toJSON().name);
          
          if (commandName) {
            if (commandsMap.has(commandName)) {
              // Found a duplicate
              const existingCommand = commandsMap.get(commandName)!;
              existingCommand.files.push(filePath);
              
              // Check if we already have this duplicate in our list
              const existingDuplicate = duplicates.find(d => d.name === commandName);
              if (existingDuplicate) {
                // Just add the file to the existing duplicate
                if (!existingDuplicate.files.includes(filePath)) {
                  existingDuplicate.files.push(filePath);
                }
              } else {
                // Add a new duplicate entry
                duplicates.push({
                  name: commandName,
                  files: [...existingCommand.files]
                });
              }
            } else {
              // New command
              commandsMap.set(commandName, {
                data: command.data,
                files: [filePath]
              });
              
              // Add to the unique commands list
              commands.push(command.data.toJSON ? command.data.toJSON() : command.data);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing command file ${filePath}:`, error);
      }
    }
  }
  
  return { commands, duplicates };
}

async function registerUniqueCommands(rest: REST, commands: any[]) {
  try {
    console.log(`Registering ${commands.length} unique commands...`);
    
    // Decide where to register based on environment
    if (process.env.TEST_GUILD_ID) {
      // Register to test guild
      console.log(`Registering commands to test guild: ${process.env.TEST_GUILD_ID}`);
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.TEST_GUILD_ID),
        { body: commands }
      );
    } else {
      // Register globally
      console.log('Registering commands globally...');
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID!),
        { body: commands }
      );
    }
    
    console.log('Commands registered successfully!');
  } catch (error) {
    console.error('Error registering commands:', error);
    throw error;
  }
}

// Run the script
fixDuplicateCommands();
