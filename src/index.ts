import { Client, GatewayIntentBits, Partials, Events, ButtonInteraction, Collection, MessageFlags, ChannelType, type Message } from 'discord.js';
import { replyEphemeral, convertEphemeralToFlags } from './utils/interaction-utils';
import { startApiServer } from './api/server';
import { connectToDatabase } from './database/connection';
import { createSuccessEmbed, createErrorEmbed } from './utils/embeds';
import * as dotenv from 'dotenv';
import { loadCommands, registerCommands } from './command-handler';
import { commands as appCommands } from './commands';
import { setClient } from './utils/client-utils';
import { updateTicketActivity } from './utils/ticket-activity';
import { Command } from './types/command'; // Use the correct casing for the import
// Define chatbot handler function
let handleDirectMessage: ((message: Message) => Promise<void>) | undefined = undefined;

// Import functions needed for ticket processing
// These will be imported later to avoid duplicate declarations

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

// Set the client instance for use across the application
setClient(client);

// Connect to database
connectToDatabase()
  .then(() => {
    console.log('Connected to database');
    
    // Import and run the ticket categories migration
    import('./database/migrations/add-ticket-categories')
      .then(() => console.log('Ticket categories migration loaded'))
      .catch(error => console.error('Error loading ticket categories migration:', error));
      
    // Import and run the custom cities migration
    import('./database/migrations/add-custom-cities')
      .then(() => console.log('Custom cities migration loaded'))
      .catch(error => console.error('Error loading custom cities migration:', error));
      
    // Import and run the weather schedule migration
    import('./database/migrations/add-weather-schedule')
      .then(() => console.log('Weather schedule migration loaded'))
      .catch(error => console.error('Error loading weather schedule migration:', error));
      
    // Import and run the ticket last activity migration
    import('./database/migrations/add-ticket-last-activity')
      .then(() => console.log('Ticket last activity migration loaded'))
      .catch(error => console.error('Error loading ticket last activity migration:', error));
      
    // Import and run the log channels migration
    import('./database/migrations/add-log-channels')
      .then(() => console.log('Log channels migration loaded'))
      .catch(error => console.error('Error loading log channels migration:', error));
      
    // Import and run the ensure log channels migration
    import('./database/migrations/ensure-log-channels')
      .then(() => console.log('Ensure log channels migration loaded'))
      .catch(error => console.error('Error loading ensure log channels migration:', error));
  })
  .catch(error => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  });

// Load commands
const initializeCommands = async () => {
  try {
    console.log('Loading commands...');
    
    // Clear existing commands
    client.commands.clear();
    
    // Load commands from the commands directory
    const commands = await loadCommands();
    
    // Also add commands from the appCommands import
    for (const command of appCommands) {
      try {
        if (!command) {
          console.warn('Skipping null or undefined command');
          continue;
        }
        
        const commandData = command.data as any;
        if (!commandData || typeof commandData.name !== 'string') {
          console.warn('Skipping command with invalid data:', command);
          continue;
        }
        
        commands.set(commandData.name, command);
      } catch (error) {
        console.error('Error processing command:', error);
      }
    }
    
    console.log(`Loaded ${commands.size} commands`);
    
    // Add all commands to the client
    for (const [name, command] of commands) {
      client.commands.set(name, command);
    }
    
    // Register commands with Discord
    await registerCommands(commands);
    
    console.log('Commands loaded and registered with Discord');
    console.log('Commands loaded into memory successfully');
  } catch (error) {
    console.error('Error initializing commands:', error);
  }
}

// Import the member events functions
import { initializeMemberEvents } from './handlers/members/member-events';

// Import the chatbot handler
declare module './handlers/utility/chatbot-handler' {
  export function handleDM(message: Message): Promise<void>;
}

// Import the invite tracker
import { initializeInviteTracker } from './handlers/invites/invite-tracker';

// Import the red alert tracker
import { startRedAlertTracker } from './handlers/alerts/red-alert-handler';

// Import the weather scheduler
import { initWeatherScheduler, checkWeatherDatabaseSetup } from './handlers/utility/weather-scheduler';

// Import the ticket chatbot
import { initializeTicketChatbot, processTicketMessage, trackStaffActivity } from './handlers/tickets/ticket-chatbot';

// Import message and channel event tracking
import { initializeMessageAndChannelTracking } from './events/messageAndChannelEvents';

// Define chatbot handler function
// This will be initialized in importChatbotHandler

// Import the chatbot handler dynamically to avoid issues with circular dependencies
const importChatbotHandler = async (): Promise<void> => {
  try {
    // Using dynamic import with a type assertion to handle the module
    const chatbotModule = await import('./handlers/utility/chatbot-handler');
    if (typeof chatbotModule.handleDM === 'function') {
      handleDirectMessage = chatbotModule.handleDM;
    } else {
      // If handleDM is not a function, create a fallback handler
      handleDirectMessage = async (message: Message) => {
        await message.reply('The chatbot is currently unavailable. Please try again later.');
      };
    }
  } catch (error) {
    console.error('Failed to import chatbot handler:', error);
    // If the import fails, create a fallback handler
    handleDirectMessage = async (message: Message) => {
      await message.reply('The chatbot is currently unavailable. Please try again later.');
    };
  }
};

// When the client is ready, run this code (only once)
client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  
  // Diagnostic: Check weather database setup
  console.log('Running weather database diagnostic check...');
  await checkWeatherDatabaseSetup();
  
  // Load all commands
  try {
    await initializeCommands();
    console.log('Commands loaded into memory successfully');
    
    // Initialize member events (welcome, leave, member count)
    initializeMemberEvents();
    console.log('Member events initialized successfully');
    
    // Initialize invite tracker
    await initializeInviteTracker(client);
    console.log('Invite tracker initialized successfully');
    
    // Start the API server
    startApiServer();
    console.log('API server started successfully');

    // Start the red alert tracker
    startRedAlertTracker(client);
    
    // Initialize ticket chatbot
    initializeTicketChatbot();
    console.log('Ticket chatbot initialized');
    
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.warn('\x1b[33m%s\x1b[0m', 'WARNING: OPENAI_API_KEY is not set in your .env file. AI chatbot features will be disabled.');
      console.warn('\x1b[33m%s\x1b[0m', 'To enable AI capabilities, add your OpenAI API key to your .env file:');
      console.warn('\x1b[33m%s\x1b[0m', '   OPENAI_API_KEY=your_openai_api_key_here');
    }
    
    // Weather scheduler is now initialized in checkWeatherDatabaseSetup()
    // This prevents duplicate initialization
    
    // Initialize message and channel tracking (client is ready at this point)
    try {
      initializeMessageAndChannelTracking(client);
      console.log('Message and channel tracking initialized');
    } catch (error) {
      console.error('Failed to initialize message and channel tracking:', error);
    }
  } catch (error) {
    console.error('Error during startup:', error);
  }
});

// Handle interactions (slash commands, buttons, and select menus)
client.on(Events.InteractionCreate, async (interaction) => {
  // Handle slash commands
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}`);
      console.error(error);
      
      try {
        const replyOptions = {
          content: 'There was an error while executing this command!'
        };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(convertEphemeralToFlags(replyOptions));
        } else {
          await replyEphemeral(interaction, replyOptions);
        }
      } catch (replyError: any) {
        // Handle Discord API errors, particularly Unknown Message (10008)
        if (replyError.code === 10008) {
          console.log(`Interaction expired before error message could be sent for command ${interaction.commandName}`);
        } else {
          console.error('Error sending command error response:', replyError);
        }
      }
    }
  }
  
  // Handle button interactions
  if (interaction.isButton()) {
    try {
      // Check which button was clicked
      if (interaction.customId === 'create_ticket') {
        // Import the ticket handler dynamically to avoid circular dependencies
        const { handleTicketButtonClick } = await import('./handlers/tickets/ticket-handler');
        await handleTicketButtonClick(interaction);
      } else if (interaction.customId === 'force_create_ticket') {
        // Import the category selection function
        const { showCategorySelection } = await import('./handlers/tickets/ticket-categories');
        await showCategorySelection(interaction);
      } else if (interaction.customId === 'close_ticket') {
        // Import the close ticket handler
        const { handleCloseTicket } = await import('./handlers/tickets/close-ticket');
        await handleCloseTicket(interaction);
      } else if (interaction.customId === 'confirm_close_ticket' || interaction.customId === 'cancel_close_ticket') {
        // These are handled by the close ticket handler
        // Do nothing here as they're handled via awaitMessageComponent
      } else if (interaction.customId === 'delete_ticket') {
        // Import the delete ticket handler
        const { handleDeleteTicket } = await import('./handlers/tickets/ticket-actions');
        await handleDeleteTicket(interaction);
      } else if (interaction.customId === 'reopen_ticket') {
        // Import the reopen ticket handler
        const { handleReopenTicket } = await import('./handlers/tickets/ticket-actions');
        await handleReopenTicket(interaction);
      } else if (interaction.customId === 'view_faq') {
        // Import the FAQ handler
        const { handleFaqButtonClick } = await import('./handlers/tickets/faq-handler');
        await handleFaqButtonClick(interaction);
      } else if (interaction.customId === 'dismiss_faq') {
        // Import the dismiss FAQ handler
        const { handleDismissFaqButtonClick } = await import('./handlers/tickets/faq-handler');
        await handleDismissFaqButtonClick(interaction);
      } else if (interaction.customId.startsWith('help_')) {
        // Import the help handler
        const { handleHelpButtonClick } = await import('./handlers/utility/help-handler');
        await handleHelpButtonClick(interaction);
      } else if (interaction.customId === 'view_faq') {
        // Import the FAQ handler
        const { handleFaqButtonClick } = await import('./handlers/tickets/faq-handler');
        await handleFaqButtonClick(interaction);
      } else if (interaction.customId.startsWith('rate_ticket_')) {
        // Import the ticket rating handler
        const { showRatingModal } = await import('./handlers/tickets/ticket-rating');
        await showRatingModal(interaction);
      } else if (interaction.customId.startsWith('captcha_answer_')) {
        // Import the CAPTCHA answer handler
        const { handleCaptchaAnswerClick } = await import('./handlers/verification/verification-handler');
        await handleCaptchaAnswerClick(interaction);
      } else if (interaction.customId === 'verify_button') {
        // Import the verification handler
        const { handleVerificationButtonClick } = await import('./handlers/verification/verification-handler');
        await handleVerificationButtonClick(interaction);
      } else if (interaction.customId.startsWith('view_staff_msg_')) {
        // Handle staff-only message view button
        const { handleViewStaffMessage } = await import('./utils/ticket-utils');
        await handleViewStaffMessage(interaction);
      }
    } catch (error) {
      console.error('Error handling button interaction:', error);
      try {
        // Only reply if the interaction hasn't been replied to yet
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: 'There was an error processing this button!',
            flags: MessageFlags.Ephemeral
           });
        } else { // Try to follow up if already replied or deferred
          await interaction.followUp({
            content: 'There was an error processing this button!',
            flags: MessageFlags.Ephemeral
           });
        }
      } catch (replyError: any) {
        // Handle Discord API errors, particularly Unknown Message (10008)
        if (replyError.code === 10008) {
          console.log(`Interaction expired before error message could be sent for button ${interaction.customId}`);
        } else {
          console.error('Error sending button error response:', replyError);
        }
      }
    }
  }
  
  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    try {
      // Check which modal was submitted
      if (interaction.customId.startsWith('captcha_verification_')) {
        // Import the CAPTCHA handler
        const { handleCaptchaModalSubmit } = await import('./handlers/verification/verification-handler');
        await handleCaptchaModalSubmit(interaction);
      } else if (interaction.customId.startsWith('ticket_rating_')) {
        // Import the ticket rating handler
        const { handleRatingSubmission } = await import('./handlers/tickets/ticket-rating');
        await handleRatingSubmission(interaction);
      } else if (interaction.customId.startsWith('staff-message-modal-')) {
        // Import the staff message modal handler
        const staffMessageCommand = require('./commands/moderation/staff-message');
        await staffMessageCommand.handleModalSubmit(interaction);
      }
    } catch (error) {
      console.error('Error handling modal submission:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(convertEphemeralToFlags({
            content: 'There was an error processing your submission!',
            flags: MessageFlags.Ephemeral
          }));
        } else {
          await interaction.reply(convertEphemeralToFlags({
            content: 'There was an error processing your submission!',
            flags: MessageFlags.Ephemeral
          }));
        }
      } catch (replyError: any) {
        // Handle Discord API errors, particularly Unknown Message (10008)
        if (replyError.code === 10008) {
          console.log(`Interaction expired before error message could be sent for modal ${interaction.customId}`);
        } else {
          console.error('Error sending modal error response:', replyError);
        }
      }
    }
  }

  // Handle select menu interactions
  if (interaction.isStringSelectMenu()) {
    try {
      // Check which select menu was used
      if (interaction.customId === 'ticket_category_select') {
        // Import the ticket handler dynamically to avoid circular dependencies
        const { handleCategorySelection } = await import('./handlers/tickets/ticket-handler');
        await handleCategorySelection(interaction);
      } else if (interaction.customId === 'help_category_select') {
        // Import the help handler
        const { handleHelpSelectMenu } = await import('./handlers/utility/help-handler');
        await handleHelpSelectMenu(interaction);
      }
    } catch (error) { console.error('Error handling select menu interaction:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: 'There was an error processing your selection!',
            flags: MessageFlags.Ephemeral
           });
        } else {
          await interaction.reply({ 
            content: 'There was an error processing your selection!',
            flags: MessageFlags.Ephemeral
           });
        }
      } catch (replyError: any) {
        // Handle Discord API errors, particularly Unknown Message (10008)
        if (replyError.code === 10008) {
          console.log(`Interaction expired before error message could be sent for select menu ${interaction.customId}`);
        } else {
          console.error('Error sending select menu error response:', replyError);
        }
      }
    }
  }

  // Handle autocomplete interactions (separate from other interactions)
  if (!interaction.isAutocomplete()) return;
    
  const commandName = interaction.commandName;
  const command = client.commands.get(commandName);
    
  if (!command) {
    console.error(`No command matching ${commandName} was found for autocomplete.`);
    return;
  }
    
  try {
    // Type assertion to access the autocomplete function
    const autocompleteCommand = command as unknown as { autocomplete?: Function };
    if (autocompleteCommand.autocomplete) {
      await autocompleteCommand.autocomplete(interaction);
    }
  } catch (error) {
    console.error('Failed to process autocomplete:', error);
  }
});


// Track message activity in ticket channels and handle DMs
client.on(Events.MessageCreate, async (message) => {
  // Skip bot messages
  if (message.author.bot) return;
  
  try {
    // Handle direct messages to the bot with the chatbot
    if (message.channel.type === ChannelType.DM) {
      // Ensure the handler is available
      if (!handleDirectMessage) {
        // Try to load the handler if it's not available
        await importChatbotHandler();
      }
      
      // Check again after attempting to load
      if (typeof handleDirectMessage === 'function') {
        // Now it's safe to call the function
        await handleDirectMessage(message);
      } else {
        // Fallback if it's still not available
        await message.reply('Sorry, the chatbot is currently unavailable. Please try again later.');
      }
      return;
    }
    
    // Update ticket activity if this is in a ticket channel
    await updateTicketActivity(message);
    
    // Process ticket chatbot messages
    if (message.channel.type === ChannelType.GuildText && 
        message.channel.name.toLowerCase().includes('ticket-')) {
      try {
        // Import the ticket chatbot functions dynamically
        const { processTicketMessage, trackStaffActivity } = await import('./handlers/tickets/ticket-chatbot');
        
        // Process the ticket message
        await processTicketMessage(message);
      
        // If the message is from a staff member, track their activity
        if (message.member?.permissions.has('ManageMessages')) {
          await trackStaffActivity(message);
        }
      } catch (error) {
        console.error('Error processing ticket message:', error);
      }
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

// Connect to API server
startApiServer();

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);

// Export the client for use in other files
export { client };

// Add TypeScript declaration for the client commands collection
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}
