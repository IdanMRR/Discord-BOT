// Initialize console logging to file
import './utils/console-logger';

import { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Events, 
  ButtonInteraction, 
  Collection, 
  Message, 
  MessageFlags, 
  ChannelType, 
  ModalSubmitInteraction, 
  StringSelectMenuInteraction, 
  AutocompleteInteraction 
} from 'discord.js';
import { replyEphemeral } from './utils/interaction-utils';
import { startApiServer } from './api/server';
import { connectToDatabase } from './database/connection';
import { createSuccessEmbed, createErrorEmbed } from './utils/embeds';
import { logInfo, logError } from './utils/logger';
import * as dotenv from 'dotenv';
import { loadCommands, registerCommands } from './command-handler';
import { setClient } from './utils/client-utils';
import { Command } from './types/command';

// Load environment variables
dotenv.config();

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
});

// Add commands collection to the client
const commandsCollection = new Collection<string, Command>();
Object.defineProperty(client, 'commands', {
  value: commandsCollection,
  writable: true,
  enumerable: true,
  configurable: true
});

// Export client for use in other modules
export { client };

// Set client for utilities
setClient(client);

// Flag to ensure commands are loaded only once
let commandsAlreadyLoaded = false;

// Load commands
const initializeCommands = async () => {
  if (commandsAlreadyLoaded) {
    console.log('[Command Initializer] Commands already loaded. Skipping to prevent duplicates.');
    return;
  }

  try {
    console.log('[Command Initializer] Starting command initialization...');
    
    client.commands.clear();
    console.log('[Command Initializer] Cleared existing command collection');
    
    const commands = await loadCommands();
    console.log(`[Command Initializer] Successfully loaded ${commands.size} commands from files`);
    
    if (commands.size === 0) {
      console.warn('[Command Initializer] No commands were loaded. Check if the commands directory exists and contains valid command files.');
    }
    
    for (const [name, command] of commands) {
      client.commands.set(name, command);
    }
    
    console.log(`[Command Initializer] Registered ${commands.size} commands to client`);
    
    console.log('[Command Initializer] Registering commands with Discord...');
    await registerCommands(commands);
    
    commandsAlreadyLoaded = true;
    
    console.log('[Command Initializer] Commands initialized and registered successfully');
  } catch (error) {
    console.error('[Command Initializer] Error initializing commands:', error);
  }
};

// Track whether commands have been initialized
let commandsInitialized = false;

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, async (readyClient) => {
  logInfo('Bot', `🚀 Ready! Logged in as ${readyClient.user.tag}`);
  
  // Debug: Check guilds and permissions
  for (const guild of client.guilds.cache.values()) {
    const botMember = guild.members.me;
    if (botMember) {
      const hasManageGuild = botMember.permissions.has('ManageGuild');
      const hasViewAuditLog = botMember.permissions.has('ViewAuditLog');
      const hasReadMessages = botMember.permissions.has('ViewChannel');
      const hasSendMessages = botMember.permissions.has('SendMessages');
      
      logInfo('Bot', `📊 Guild: ${guild.name} (${guild.id})`);
      logInfo('Bot', `   └─ Manage Guild: ${hasManageGuild ? '✅' : '❌'}`);
      logInfo('Bot', `   └─ View Audit Log: ${hasViewAuditLog ? '✅' : '❌'}`);
      logInfo('Bot', `   └─ View Channel: ${hasReadMessages ? '✅' : '❌'}`);
      logInfo('Bot', `   └─ Send Messages: ${hasSendMessages ? '✅' : '❌'}`);
      logInfo('Bot', `   └─ Member Count: ${guild.memberCount}`);
    }
  }
  
  try {
    // Initialize the unified member handler FIRST - this is critical for member join events
    logInfo('Bot', '🔧 Initializing unified member handler (replaces invite tracker + member events)...');
    const { initializeUnifiedMemberHandler } = await import('./handlers/members/unified-member-handler');
    await initializeUnifiedMemberHandler(client);
    logInfo('Bot', '✅ Unified member handler initialized successfully');
    
    // Load commands in the background (don't block member events)
    if (!commandsInitialized) {
      try {
        logInfo('Bot', '📋 Starting command initialization in background...');
        await initializeCommands();
        commandsInitialized = true;
        logInfo('Bot', 'Commands loaded into memory successfully');
      } catch (error) {
        logError('Bot', `Error initializing commands: ${error}`);
      }
    }
    
    logInfo('Bot', 'Bot initialization completed successfully');

  } catch (error) {
    logError('Bot', `Error in client ready handler: ${error}`);
  }
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async (interaction) => {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    
    if (!command) {
      logError('Bot', `No command matching ${interaction.commandName} was found.`);
      return;
    }
    
    try {
      logInfo('Bot', `Executing command: ${interaction.commandName} by user: ${interaction.user.tag} in guild: ${interaction.guild?.name || 'DM'}`);
      await command.execute(interaction);
    } catch (error) {
      logError('Bot', `Error executing command ${interaction.commandName}: ${error}`);
      
      const errorEmbed = createErrorEmbed('Error executing command', 'There was an error while executing this command!');
      
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
      } catch (replyError) {
        logError('Bot', `Error sending error message: ${replyError}`);
      }
    }
  }
  
  // Handle autocomplete interactions
  else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    
    if (!command) {
      logError('Bot', `No command matching ${interaction.commandName} was found for autocomplete.`);
      return;
    }
    
    try {
      if (command.autocomplete) {
        await command.autocomplete(interaction);
      }
    } catch (error) {
      logError('Bot', `Error handling autocomplete for command ${interaction.commandName}: ${error}`);
    }
  }
  
  // Handle string select menu interactions
  else if (interaction.isStringSelectMenu()) {
    try {
      const customId = interaction.customId;
      logInfo('Bot', `Select menu interaction: ${customId} by user: ${interaction.user.tag}`);
      
      // Ticket category selection - don't defer, let the handler manage it
      if (customId === 'ticket_category_select') {
        const { handleCategorySelection } = await import('./handlers/tickets/ticket-handler');
        await handleCategorySelection(interaction);
        return;
      }
      // Close reason selection - don't defer, let the handler manage it
      else if (customId.startsWith('close_reason_')) {
        const { handleCloseReasonSelection } = await import('./handlers/tickets/close-ticket');
        await handleCloseReasonSelection(interaction);
        return;
      }
      // Help category selection
      else if (customId === 'help_category_select') {
        const { handleHelpSelectMenu } = await import('./handlers/utility/help-handler');
        await handleHelpSelectMenu(interaction);
        return;
      }
      // Setup wizard select menus
      else if (customId === 'setup_option') {
        await interaction.update({
          content: '⚙️ Setup option selected. Please use the specific setup commands for detailed configuration.'
        });
        return;
      }
      // Role type selection
      else if (customId === 'role_type_select') {
        await interaction.update({
          content: '🎭 Role type selected. Please continue with the role setup process.'
        });
        return;
      }
      // Verification question removal
      else if (customId === 'remove_question_select') {
        await interaction.update({
          content: '❓ Question removal selected. Please use the verification setup command to manage questions.'
        });
        return;
      }
      
      // For all other select menus, defer the interaction first
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }
      
      logInfo('Bot', `Unhandled select menu interaction: ${customId}`);
      await interaction.editReply({
        content: 'This select menu interaction is not implemented yet.'
      });
      
    } catch (error: any) {
      logError('Bot', `Error handling select menu interaction: ${error}`);
      
      // Only try to respond if the error isn't about an expired/unknown interaction
      if (error.code !== 10062 && error.code !== 10008 && error.code !== 40060) {
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'There was an error processing your request.', 
              flags: MessageFlags.Ephemeral 
            });
          } else {
            await interaction.editReply({ 
              content: 'There was an error processing your request.' 
            });
          }
        } catch (replyError: any) {
          // Don't log errors for expired interactions
          if (replyError.code !== 10062 && replyError.code !== 10008 && replyError.code !== 40060) {
            logError('Bot', `Error sending select menu interaction error message: ${replyError}`);
          }
        }
      }
    }
  }
  
  // Handle modal submit interactions
  else if (interaction.isModalSubmit()) {
    try {
      const customId = interaction.customId;
      logInfo('Bot', `Modal submit interaction: ${customId} by user: ${interaction.user.tag}`);
      
      // Check if this modal is handled by a specific command (like nuke)
      // These commands use awaitModalSubmit() and handle their own responses
      if (customId.startsWith('nuke-confirm-')) {
        // This is handled by the nuke command's awaitModalSubmit()
        // Don't interfere with it
        logInfo('Bot', `Nuke modal handled by command's awaitModalSubmit`);
        return;
      }
      
      // Verification modals
      if (customId.startsWith('captcha_submit_')) {
        const { handleCaptchaModalSubmit } = await import('./handlers/verification/verification-handler');
        await handleCaptchaModalSubmit(interaction);
        return;
      }
      else if (customId.startsWith('question_submit_')) {
        const { handleQuestionModalSubmit } = await import('./handlers/verification/verification-handler');
        await handleQuestionModalSubmit(interaction);
        return;
      }
      else if (customId.startsWith('age_submit_')) {
        // Age verification modal submit - need to implement this
        logInfo('Bot', `Age verification modal submitted by ${interaction.user.tag}`);
        await interaction.reply({
          content: 'Age verification functionality is not yet implemented.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Moderation command modals - these should be handled by their respective commands
      else if (customId.startsWith('warn-modal-') || 
               customId.startsWith('ban-modal-') || 
               customId.startsWith('kick-modal-') || 
               customId.startsWith('timeout-modal-') || 
               customId.startsWith('dm-modal-') || 
               customId.startsWith('removewarn-modal-') || 
               customId.startsWith('staff-message-modal-')) {
        // These modals are handled by their respective commands using awaitModalSubmit()
        // DO NOT respond here - let the command handle it to avoid race conditions
        logInfo('Bot', `Moderation modal ${customId} not handled by command`);
        return;
      }
      
      // Ticket rating modals
      else if (customId.startsWith('rate_ticket_modal_')) {
        // Check if interaction is still valid
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '⭐ Ticket rating submitted. Thank you for your feedback!',
            flags: MessageFlags.Ephemeral
          });
        }
        return;
      }
      
      // For any other unhandled modals
      logInfo('Bot', `Unhandled modal submit interaction: ${customId}`);
      
      // Check if interaction is still valid before responding
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'This modal interaction is not implemented yet.',
          flags: MessageFlags.Ephemeral
        });
      }
      
    } catch (error: any) {
      logError('Bot', `Error handling modal submit interaction: ${error}`);
      
      // Only try to respond if the error isn't about an expired/unknown interaction
      if (error.code !== 10062 && error.code !== 10008 && error.code !== 40060) {
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'There was an error processing your request.', 
              flags: MessageFlags.Ephemeral 
            });
          }
        } catch (replyError: any) {
          // Don't log errors for expired interactions
          if (replyError.code !== 10062 && replyError.code !== 10008 && replyError.code !== 40060) {
            logError('Bot', `Error sending modal submit interaction error message: ${replyError}`);
          }
        }
      }
    }
  }

  // Handle button interactions
  else if (interaction.isButton()) {
    try {
      const customId = interaction.customId;
      logInfo('Bot', `Button interaction: ${customId} by user: ${interaction.user.tag}`);
      
      // Handle different button types
      if (customId === 'member_count') {
        // Disabled button, no action needed
        return;
      }
      
      // Ticket system buttons - defer them first since handlers expect it
      else if (customId === 'close_ticket') {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        const { handleCloseTicket } = await import('./handlers/tickets/close-ticket');
        await handleCloseTicket(interaction);
        return;
      }
      else if (customId === 'reopen_ticket') {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        const { handleReopenTicket } = await import('./handlers/tickets/ticket-actions');
        await handleReopenTicket(interaction);
        return;
      }
      else if (customId === 'delete_ticket') {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        const { handleDeleteTicket } = await import('./handlers/tickets/ticket-actions');
        await handleDeleteTicket(interaction);
        return;
      }
      else if (customId === 'create_ticket') {
        // This handler defers itself, so don't defer here
        const { handleTicketButtonClick } = await import('./handlers/tickets/ticket-handler');
        await handleTicketButtonClick(interaction);
        return;
      }
      else if (customId === 'force_create_ticket') {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        const { showCategorySelection } = await import('./handlers/tickets/ticket-categories');
        await showCategorySelection(interaction);
        return;
      }
      else if (customId === 'view_faq') {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        // TODO: Implement FAQ handler
        await interaction.editReply({
          content: '❓ FAQ functionality is not yet implemented. Please contact staff for assistance.'
        });
        return;
      }
      else if (customId.startsWith('confirm_close_') || customId.startsWith('cancel_close_')) {
        // These are handled by the close ticket handler's confirmation system
        return;
      }
      
      // For all other buttons, defer the interaction first
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }
      
      // Verification system buttons
      if (customId === 'verify_account') {
        const { handleVerificationButtonClick } = await import('./handlers/verification/verification-handler');
        await handleVerificationButtonClick(interaction);
        return;
      }
      else if (customId === 'verify_button') {
        const { handleVerificationButtonClick } = await import('./handlers/verification/verification-handler');
        await handleVerificationButtonClick(interaction);
        return;
      }
      else if (customId === 'request_verification') {
        const { handleVerificationButtonClick } = await import('./handlers/verification/verification-handler');
        await handleVerificationButtonClick(interaction);
        return;
      }
      else if (customId.startsWith('captcha_solve_')) {
        const { handleCaptchaSolveClick } = await import('./handlers/verification/verification-handler');
        await handleCaptchaSolveClick(interaction);
        return;
      }
      
      // FAQ system buttons
      else if (customId === 'dismiss_faq') {
        await interaction.editReply({
          content: '✅ FAQ dismissed. If you still need help, please contact staff.',
          components: []
        });
        return;
      }
      
      // Rules system buttons
      else if (customId === 'rules_acknowledge') {
        await interaction.editReply({
          content: '✅ Thank you for acknowledging the server rules!'
        });
        return;
      }
      
      // Help system buttons
      else if (customId.startsWith('help_')) {
        const { handleHelpButtonClick } = await import('./handlers/utility/help-handler');
        await handleHelpButtonClick(interaction);
        return;
      }
      
      // Setup wizard buttons
      else if (customId.startsWith('setup_') || customId.startsWith('template_') || customId.startsWith('apply_') || customId === 'back_to_main' || customId === 'back_to_templates') {
        await interaction.editReply({
          content: '⚙️ Setup wizard functionality. Please use the setup commands directly.'
        });
        return;
      }
      
      // Log pagination buttons
      else if (customId.includes('_logs_prev_') || customId.includes('_logs_next_')) {
        const { handleLogPagination } = await import('./events/log-pagination-handler');
        await handleLogPagination(interaction);
        return;
      }
      
      // Invite leaderboard pagination
      else if (customId.startsWith('invite_leaderboard_')) {
        await interaction.editReply({
          content: '📊 Invite leaderboard pagination. Please use the invite-leaderboard command again.'
        });
        return;
      }
      
      // Rating system buttons
      else if (customId.startsWith('rate_ticket_')) {
        const { showRatingModal } = await import('./handlers/tickets/ticket-rating');
        await showRatingModal(interaction);
        return;
      }
      else if (customId.startsWith('rate_stars_')) {
        // Star rating buttons are handled by the collector in showRatingModal
        return;
      }
      
      // If no handler found, log as unhandled
      logInfo('Bot', `Unhandled button interaction: ${customId}`);
      await interaction.editReply({
        content: 'This button interaction is not implemented yet.'
      });
      
    } catch (error: any) {
      logError('Bot', `Error handling button interaction: ${error}`);
      
      // Only try to respond if the error isn't about an expired/unknown interaction
      if (error.code !== 10062 && error.code !== 10008 && error.code !== 40060) {
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'There was an error processing your request.', 
              flags: MessageFlags.Ephemeral 
            });
          } else {
            await interaction.editReply({ 
              content: 'There was an error processing your request.' 
            });
          }
        } catch (replyError: any) {
          // Don't log errors for expired interactions
          if (replyError.code !== 10062 && replyError.code !== 10008 && replyError.code !== 40060) {
            logError('Bot', `Error sending button interaction error message: ${replyError}`);
          }
        }
      }
    }
  }
});

// Handle basic message events
client.on(Events.MessageCreate, async (message) => {
  // Skip bot messages
  if (message.author.bot) return;
  
  try {
    // Basic message logging
    if (message.guild) {
      logInfo('Bot', `Message in ${message.guild.name}: ${message.content.substring(0, 50)}...`);
    }
  } catch (error) {
    logError('Bot', `Error processing message: ${error}`);
  }
});

// Connect to database
connectToDatabase()
  .then(() => {
    console.log('Connected to database');
    
    // Only start API server if not running as a module
    if (!module.parent) {
      startApiServer();
    }
    
    // Load migrations if they exist
    const migrations = [
      'add-ticket-categories',
      'add-custom-cities',
      'add-weather-schedule',
      'add-ticket-last-activity',
      'add-ticket-case-number',
      'add-soft-delete-column',
      'fix-dm-logs-table',
      'add-log-channels',
      'ensure-log-channels'
    ];
    
    migrations.forEach(migration => {
      import(`./database/migrations/${migration}`)
        .then(() => console.log(`${migration} migration loaded`))
        .catch(error => console.log(`${migration} migration not found - skipping`));
    });
  })
  .catch(error => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  });

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('Received SIGINT. Graceful shutdown ...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Graceful shutdown ...');
  client.destroy();
  process.exit(0);
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);

// Add TypeScript declaration for the client commands collection
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}
