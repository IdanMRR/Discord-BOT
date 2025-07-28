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

// Command loading state management
class CommandLoadingState {
  private static instance: CommandLoadingState;
  private isLoading = false;
  private isRegistering = false;
  private loadedCommands = new Collection<string, Command>();
  private registrationComplete = false;
  private loadingPromise: Promise<Collection<string, Command>> | null = null;
  private registrationPromise: Promise<void> | null = null;

  static getInstance(): CommandLoadingState {
    if (!CommandLoadingState.instance) {
      CommandLoadingState.instance = new CommandLoadingState();
    }
    return CommandLoadingState.instance;
  }

  async getCommands(): Promise<Collection<string, Command>> {
    if (this.loadedCommands.size > 0) {
      return this.loadedCommands;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.loadCommandsInternal();
    return this.loadingPromise;
  }

  async registerCommands(): Promise<void> {
    if (this.registrationComplete) {
      console.log('[Command Register] Commands already registered successfully');
      return;
    }

    if (this.registrationPromise) {
      return this.registrationPromise;
    }

    const commands = await this.getCommands();
    this.registrationPromise = this.registerCommandsInternal(commands);
    return this.registrationPromise;
  }

  private async loadCommandsInternal(): Promise<Collection<string, Command>> {
    if (this.isLoading) {
      throw new Error('Commands are already being loaded');
    }

    this.isLoading = true;
    const commands = new Collection<string, Command>();
    const loadedCommandNames = new Set<string>();

    try {
      console.log('[Command Loader] Starting command loading process...');
      
      // Always use the dist directory for better performance (compiled JavaScript)
      const foldersPath = path.join(process.cwd(), 'dist', 'commands');
      
      console.log(`[Command Loader] Loading commands from: ${foldersPath}`);
      
      // Check if the commands directory exists
      if (!fs.existsSync(foldersPath)) {
        throw new Error(`Commands directory not found: ${foldersPath}`);
      }
      
      const commandFolders = fs.readdirSync(foldersPath);
      console.log(`[Command Loader] Found command folders: ${commandFolders.join(', ')}`);

      // Load commands sequentially to avoid race conditions and better error tracking
      for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        
        // Skip if not a directory
        if (!fs.statSync(commandsPath).isDirectory()) {
          console.log(`[Command Loader] Skipping non-directory: ${commandsPath}`);
          continue;
        }
        
        console.log(`[Command Loader] Processing command folder: ${folder}`);
        
        try {
          const commandFiles = fs.readdirSync(commandsPath)
            .filter(file => file.endsWith('.js') && !file.endsWith('.d.ts'));
          
          console.log(`[Command Loader] Found ${commandFiles.length} command files in ${folder}`);
          
          for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            
            try {
              // Only clear module cache in development mode to prevent memory leaks
              if (process.env.NODE_ENV === 'development') {
                try {
                  const resolvedPath = require.resolve(filePath);
                  delete require.cache[resolvedPath];
                } catch (resolveError) {
                  // Ignore resolve errors - file might not be cached yet
                }
              }
              
              // Use require instead of dynamic import for better reliability
              const commandModule = require(filePath);
              const command = commandModule.default || commandModule;
              
              if (command?.data && typeof command.execute === 'function') {
                const commandName = command.data.name;
                
                // Check for duplicates
                if (loadedCommandNames.has(commandName)) {
                  console.warn(`[Command Loader] Duplicate command found: ${commandName} in ${filePath} (skipping)`);
                  continue;
                }
                
                // Validate command data
                if (!commandName || typeof commandName !== 'string') {
                  console.error(`[Command Loader] Invalid command name in ${filePath}`);
                  continue;
                }
                
                // Add the command
                loadedCommandNames.add(commandName);
                commands.set(commandName, command);
                console.log(`[Command Loader] ✅ Successfully loaded command: ${commandName}`);
                
              } else {
                console.error(`[Command Loader] ❌ Invalid command structure in ${filePath}`);
                console.error(`[Command Loader] Expected: { data: SlashCommandBuilder, execute: Function }`);
                console.error(`[Command Loader] Got:`, {
                  hasData: !!command?.data,
                  hasExecute: typeof command?.execute === 'function',
                  dataType: typeof command?.data,
                  executeType: typeof command?.execute
                });
              }
            } catch (error) {
              console.error(`[Command Loader] ❌ Error loading command from ${filePath}:`, error);
            }
          }
        } catch (error) {
          console.error(`[Command Loader] ❌ Error reading command folder ${folder}:`, error);
        }
      }
      
      this.loadedCommands = commands;
      console.log(`[Command Loader] ✅ Successfully loaded ${commands.size} commands total`);
      
      return commands;
      
    } catch (error) {
      console.error('[Command Loader] ❌ Critical error in command loading:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  private async registerCommandsInternal(commands: Collection<string, Command>): Promise<void> {
    if (this.isRegistering) {
      throw new Error('Commands are already being registered');
    }

    this.isRegistering = true;

    try {
      console.log(`[Command Register] Starting registration of ${commands.size} commands...`);
      
      if (!process.env.DISCORD_TOKEN) {
        throw new Error('DISCORD_TOKEN is not defined in environment variables');
      }

      if (!process.env.CLIENT_ID) {
        throw new Error('CLIENT_ID is not defined in environment variables');
      }

      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
      
      // Prepare commands for registration
      const commandsJson = Array.from(commands.values())
        .map(command => {
          try {
            return command?.data?.toJSON?.();
          } catch (error) {
            console.error(`[Command Register] Error serializing command:`, error);
            return null;
          }
        })
        .filter(Boolean);

      if (commandsJson.length === 0) {
        throw new Error('No valid commands found to register');
      }

      console.log(`[Command Register] Prepared ${commandsJson.length} commands for registration`);

      // Clear existing commands first (with timeout)
      console.log('[Command Register] Clearing existing commands...');
      
      try {
        await Promise.race([
          rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Clear commands timeout')), 60000)
          )
        ]);
        console.log('[Command Register] ✅ Successfully cleared existing commands');
      } catch (error) {
        console.warn('[Command Register] ⚠️ Warning: Could not clear existing commands:', error);
        // Continue anyway - this is not critical
      }

      // Register new commands to GUILD for instant availability
      const guildId = process.env.TEST_GUILD_ID;
      let registrationSuccess = false;
      
      if (guildId) {
        console.log(`[Command Register] Registering ${commandsJson.length} commands to guild ${guildId} (INSTANT)...`);
        
        try {
          await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: commandsJson });
          console.log(`[Command Register] ✅ Successfully registered ${commandsJson.length} commands to guild!`);
          console.log('[Command Register] 🚀 Commands are available IMMEDIATELY in your Discord server!');
          registrationSuccess = true;
          this.registrationComplete = true;
        } catch (guildError) {
          console.warn('[Command Register] ⚠️ Guild registration failed, falling back to global...', guildError);
        }
      }
      
      // Fallback to global registration if guild registration failed
      if (!registrationSuccess) {
        console.log(`[Command Register] Registering ${commandsJson.length} commands globally...`);
        
        let attempts = 0;
        const maxAttempts = 2;

        while (!registrationSuccess && attempts < maxAttempts) {
          attempts++;
          
          try {
            console.log(`[Command Register] Registration attempt ${attempts}/${maxAttempts}...`);
            
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commandsJson });
            console.log(`[Command Register] ✅ Commands sent to Discord API successfully`);
            console.log('[Command Register] ℹ️ Commands may take up to 1 hour to appear in all servers');
            registrationSuccess = true;
            this.registrationComplete = true;

          } catch (registrationError) {
            console.error(`[Command Register] ❌ Registration attempt ${attempts} failed:`, registrationError);
            
            if (attempts === maxAttempts) {
              console.error('[Command Register] ❌ All registration attempts failed');
              console.warn('[Command Register] ⚠️ Bot will continue running with local commands only');
              this.registrationComplete = true;
              break;
            } else {
              console.log(`[Command Register] Retrying in 5 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }
        }
      }

      console.log('[Command Register] Command registration process completed');

    } catch (error) {
      console.error('[Command Register] ❌ Critical error in command registration:', error);
      this.registrationComplete = true; // Prevent infinite retries
      // Don't throw - let the bot continue running
    } finally {
      this.isRegistering = false;
    }
  }

  // Reset state for testing/development
  reset(): void {
    this.isLoading = false;
    this.isRegistering = false;
    this.loadedCommands.clear();
    this.registrationComplete = false;
    this.loadingPromise = null;
    this.registrationPromise = null;
  }
}

// Export the improved functions
export async function loadCommands(): Promise<Collection<string, Command>> {
  const state = CommandLoadingState.getInstance();
  return state.getCommands();
}

export async function registerCommands(commands: Collection<string, Command>): Promise<void> {
  const state = CommandLoadingState.getInstance();
  return state.registerCommands();
}

// Export reset function for development
export function resetCommandState(): void {
  const state = CommandLoadingState.getInstance();
  state.reset();
}
