import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// The test guild ID
const TEST_GUILD_ID = '1365777891333374022';

async function loadAllCommands() {
  const commands = [];
  const commandNames = new Set();
  const duplicateCommands = [];
  const foldersPath = path.join(__dirname, 'commands');
  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      // Set a new item in the Collection with the key as the command name and the value as the exported module
      if ('data' in command) {
        const commandName = command.data.name || command.data.toJSON().name;
        
        // Check for duplicate command names
        if (commandNames.has(commandName)) {
          duplicateCommands.push({
            name: commandName,
            file: filePath
          });
          console.log(`[WARNING] Duplicate command name "${commandName}" found in ${filePath}. This will cause deployment to fail.`);
        } else {
          commandNames.add(commandName);
          commands.push(command.data.toJSON());
        }
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" property.`);
      }
    }
  }

  // Print out summary of duplicates if any were found
  if (duplicateCommands.length > 0) {
    console.log(`\n[WARNING] Found ${duplicateCommands.length} duplicate command name(s):`);
    duplicateCommands.forEach(duplicate => {
      console.log(`- "${duplicate.name}" in file: ${duplicate.file}`);
    });
    console.log('\nSkipping duplicate commands to prevent deployment failure.\n');
  }

  return commands;
}

// Prepare to deploy commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');

// Deploy commands function
async function deployCommands() {
  try {
    console.log(`Started refreshing application commands for test server (${TEST_GUILD_ID})...`);

    // The CLIENT_ID is your bot's application ID, which you can find in the Discord Developer Portal
    // You need to add this to your .env file
    if (!process.env.CLIENT_ID) {
      throw new Error('CLIENT_ID is not defined in .env file');
    }

    // Load all commands dynamically
    console.log('Loading commands...');
    const commands = await loadAllCommands();
    
    console.log(`Found ${commands.length} commands to deploy.`);

    // Register commands to the specific guild/server
    console.log(`Registering commands to server ${TEST_GUILD_ID}...`);
    
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, TEST_GUILD_ID),
      { body: commands },
    );

    console.log(`Successfully registered application commands to server ${TEST_GUILD_ID}!`);
    console.log('Guild commands update immediately (no waiting period).');
  } catch (error: any) {
    console.error('Error deploying commands:');
    console.error(error);
  }
}

// Execute the deploy
deployCommands();
