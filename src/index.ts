import { Client, GatewayIntentBits, Partials, Events, ButtonInteraction, Collection, MessageFlags } from 'discord.js';
import { replyEphemeral, convertEphemeralToFlags } from './utils/interaction-utils';
import { startApiServer } from './api/server';
import { connectToDatabase } from './database/connection';
import { createSuccessEmbed, createErrorEmbed } from './utils/embeds';
import * as dotenv from 'dotenv';
import { Command, loadCommands, registerCommands } from './command-handler';
import { setClient } from './utils/client-utils';

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
  })
  .catch(error => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  });

// Create a collection for commands
client.commands = new Collection<string, Command>();

// Load commands
async function initializeCommands() {
  const commands = await loadCommands();
  client.commands = commands;
  await registerCommands(commands);
}

// Import the member events functions
import { initializeMemberEvents } from './handlers/members/member-events';

// Import the invite tracker
import { initializeInviteTracker } from './handlers/invites/invite-tracker';

// When the client is ready, run this code (only once)
client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  
  // Load all commands
  try {
    await initializeCommands();
    console.log('Commands loaded and registered successfully');
    
    // Initialize member events (welcome, leave, member count)
    initializeMemberEvents();
    console.log('Member events initialized successfully');
    
    // Initialize invite tracker
    await initializeInviteTracker(client);
    console.log('Invite tracker initialized successfully');
    
    // Start the API server
    startApiServer();
    console.log('API server started successfully');
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
