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
  AutocompleteInteraction,
  EmbedBuilder
} from 'discord.js';
import { replyEphemeral } from './utils/interaction-utils';
import { startApiServer } from './api/server';
import { connectToDatabase } from './database/connection';
import { createSuccessEmbed, createErrorEmbed } from './utils/embeds';
import { logInfo, logError, logCommandUsage } from './utils/logger';
import { AnalyticsService } from './database/services/analyticsService';
import { RealTimeAnalyticsCollector } from './handlers/analytics/realtime-collector';
import { DiscordDataCollector } from './handlers/analytics/discord-data-collector';
import * as dotenv from 'dotenv';
import { loadCommands, registerCommands } from './command-handler';
import { setClient } from './utils/client-utils';
import { Command } from './types/Command';
import { setupGlobalErrorHandlers } from './middleware/errorHandler';
import { initializeIntegrationSystems, shutdownIntegrationSystems } from './handlers/integrations/integration-initializer';

// Load environment variables
dotenv.config();

// Set up global error handlers
setupGlobalErrorHandlers();

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
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

// Improved command initialization with better error handling and state management
const initializeCommands = async (): Promise<void> => {
  try {
    console.log('[Command Initializer] Starting command initialization...');
    
    // Clear existing commands from client
    client.commands.clear();
    console.log('[Command Initializer] Cleared existing command collection');
    
    // Load commands using the improved handler
    const commands = await loadCommands();
    console.log(`[Command Initializer] Successfully loaded ${commands.size} commands from files`);
    
    if (commands.size === 0) {
      console.warn('[Command Initializer] ⚠️ No commands were loaded. Check if the commands directory exists and contains valid command files.');
      return;
    }
    
    // Add commands to client collection
    for (const [name, command] of commands) {
      client.commands.set(name, command);
    }
    
    console.log(`[Command Initializer] Registered ${commands.size} commands to client`);
    
    // Register commands with Discord (this handles its own state management now)
    console.log('[Command Initializer] Registering commands with Discord...');
    await registerCommands(commands);
    
    console.log('[Command Initializer] ✅ Commands initialized and registered successfully');
  } catch (error) {
    console.error('[Command Initializer] ❌ Error initializing commands:', error);
    console.warn('[Command Initializer] ⚠️ Bot will continue running without commands');
  }
};

// Simple flag to prevent multiple initialization attempts
let commandInitializationStarted = false;

// When the client is ready, run this code (only once)
// Global analytics collector instances
let analyticsCollector: RealTimeAnalyticsCollector;
let discordDataCollector: DiscordDataCollector;

client.once(Events.ClientReady, async (readyClient) => {
  logInfo('Bot', `🚀 Ready! Logged in as ${readyClient.user.tag}`);
  
  // Initialize analytics collectors
  analyticsCollector = new RealTimeAnalyticsCollector(client);
  analyticsCollector.start();
  logInfo('Bot', '📊 Real-time analytics collector started');

  // Initialize Discord data collector and collect initial data
  discordDataCollector = new DiscordDataCollector(client);
  setTimeout(async () => {
    try {
      const results = await discordDataCollector.collectAllServersData();
      logInfo('Bot', `📈 Initial data collection completed for ${results.length} servers`);
    } catch (error) {
      logError('Bot', `Error in initial data collection: ${error}`);
    }
  }, 5000); // Wait 5 seconds for bot to fully initialize

  // Initialize Integration and Automation Systems
  setTimeout(async () => {
    try {
      await initializeIntegrationSystems(client);
      logInfo('Bot', '🔗 Integration and automation systems initialized successfully');
    } catch (error) {
      logError('Bot', `Error initializing integration systems: ${error}`);
    }
  }, 3000); // Wait 3 seconds for bot to be ready
  
  // Set initial bot activity
  const updateBotActivity = () => {
    const serverCount = client.guilds.cache.size;
    const memberCount = client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0);
    
    client.user?.setActivity({
      name: `${serverCount} servers | ${memberCount.toLocaleString()} members`,
      type: 2 // LISTENING activity type
    });
    
    logInfo('Bot', `🎵 Activity updated: Listening to ${serverCount} servers | ${memberCount.toLocaleString()} members`);
  };
  
  // Set initial activity
  updateBotActivity();
  
  // Update activity every 10 minutes
  setInterval(updateBotActivity, 10 * 60 * 1000);
  
  // Server health monitoring - every 30 minutes (reduced to prevent spam)
  const updateServerHealth = async () => {
    try {
      for (const guild of client.guilds.cache.values()) {
        const onlineCount = guild.members.cache.filter(member => 
          member.presence?.status === 'online' || 
          member.presence?.status === 'idle' || 
          member.presence?.status === 'dnd'
        ).size;

        await AnalyticsService.recordServerHealth({
          guild_id: guild.id,
          member_count: guild.memberCount,
          online_count: onlineCount,
          bot_latency: client.ws.ping,
          uptime: Math.floor(process.uptime()),
          memory_usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
          error_count: 0 // Could be tracked from error logs
        }).catch(error => logError('Analytics', `Failed to record server health: ${error}`));
      }
    } catch (error) {
      logError('Analytics', `Error in server health monitoring: ${error}`);
    }
  };
  
  // Initial health check
  setTimeout(updateServerHealth, 30000); // Wait 30 seconds after bot ready
  // Schedule health checks every 30 minutes (reduced from 5 minutes to prevent spam)
  setInterval(updateServerHealth, 30 * 60 * 1000);
  
  // Store the function globally so other events can use it
  (global as any).updateBotActivity = updateBotActivity;
  
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
    
    // Initialize the Red Alert tracking system
    logInfo('Bot', '🚨 Initializing Red Alert tracking system...');
    const { startRedAlertTracker } = await import('./handlers/alerts/red-alert-handler');
    await startRedAlertTracker(client);
    logInfo('Bot', '✅ Red Alert tracking system initialized successfully');
    
    // Initialize the Giveaway system
    logInfo('Bot', '🎁 Initializing Giveaway tracking system...');
    const { startGiveawayChecker } = await import('./handlers/giveaway/giveaway-handler');
    await startGiveawayChecker(client);
    logInfo('Bot', '✅ Giveaway tracking system initialized successfully');
    
    // Initialize unified logging system (consolidates all message events)
    logInfo('Bot', '📝 Initializing unified logging system...');
    const { initializeMessageLogger } = await import('./handlers/messages/message-logger');
    initializeMessageLogger(client);
    logInfo('Bot', '✅ Unified logging system initialized successfully');
    
    // Load commands in the background (don't block member events)
    if (!commandInitializationStarted) {
      commandInitializationStarted = true;
      try {
        logInfo('Bot', '📋 Starting command initialization in background...');
        await initializeCommands();
        logInfo('Bot', '✅ Commands loaded into memory successfully');
      } catch (error) {
        logError('Bot', `❌ Error initializing commands: ${error}`);
      }
    }
    
    logInfo('Bot', 'Bot initialization completed successfully');

  } catch (error) {
    logError('Bot', `Error in client ready handler: ${error}`);
  }
});

// Update bot activity when joining or leaving guilds
client.on(Events.GuildCreate, (guild) => {
  logInfo('Bot', `📈 Joined new guild: ${guild.name} (${guild.id}) with ${guild.memberCount} members`);
  if ((global as any).updateBotActivity) {
    (global as any).updateBotActivity();
  }
});

client.on(Events.GuildDelete, (guild) => {
  logInfo('Bot', `📉 Left guild: ${guild.name} (${guild.id})`);
  if ((global as any).updateBotActivity) {
    (global as any).updateBotActivity();
  }
});

// Track member joins and leaves
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    logInfo('Bot', `👋 Member joined: ${member.user.tag} in guild: ${member.guild.name}`);
    
    await AnalyticsService.trackActivity({
      guild_id: member.guild.id,
      metric_type: 'member_join',
      user_id: member.user.id,
      value: 1
    }).catch(error => logError('Analytics', `Failed to track member join: ${error}`));
  } catch (error) {
    logError('Bot', `Error tracking member join: ${error}`);
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    logInfo('Bot', `👋 Member left: ${member.user?.tag || 'Unknown'} in guild: ${member.guild.name}`);
    
    await AnalyticsService.trackActivity({
      guild_id: member.guild.id,
      metric_type: 'member_leave',
      user_id: member.user?.id || '',
      value: 1
    }).catch(error => logError('Analytics', `Failed to track member leave: ${error}`));
  } catch (error) {
    logError('Bot', `Error tracking member leave: ${error}`);
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
      
      const startTime = Date.now();
      await command.execute(interaction);
      const executionTime = Date.now() - startTime;
      
      // Track successful command execution
      if (interaction.guild) {
        await AnalyticsService.trackCommand({
          guild_id: interaction.guild.id,
          command_name: interaction.commandName,
          user_id: interaction.user.id,
          channel_id: interaction.channel?.id || '',
          success: true,
          execution_time: executionTime
        }).catch(error => logError('Analytics', `Failed to track command: ${error}`));

        // Log command usage for dashboard activity logs (exclude moderation commands - they have their own logging)
        const moderationCommands = ['kick', 'ban', 'timeout', 'warn', 'removewarn', 'mute', 'unmute'];
        const isModCommand = moderationCommands.includes(interaction.commandName);
        
        if (!isModCommand) {
          await logCommandUsage({
            guild: interaction.guild,
            user: interaction.user,
            command: interaction.commandName,
            options: interaction.options.data.reduce((acc, option) => {
              acc[option.name] = option.value;
              return acc;
            }, {} as Record<string, any>),
            channel: interaction.channel,
            success: true
          }).catch(error => logError('Command Logging', `Failed to log command usage: ${error}`));
        }
      }
    } catch (error) {
      logError('Bot', `Error executing command ${interaction.commandName}: ${error}`);
      
      // Track failed command execution
      if (interaction.guild) {
        await AnalyticsService.trackCommand({
          guild_id: interaction.guild.id,
          command_name: interaction.commandName,
          user_id: interaction.user.id,
          channel_id: interaction.channel?.id || '',
          success: false,
          error_message: error instanceof Error ? error.message : String(error)
        }).catch(analyticsError => logError('Analytics', `Failed to track failed command: ${analyticsError}`));

        // Log failed command usage for dashboard activity logs (exclude moderation commands - they have their own logging)
        const moderationCommands = ['kick', 'ban', 'timeout', 'warn', 'removewarn', 'mute', 'unmute'];
        const isModCommand = moderationCommands.includes(interaction.commandName);
        
        if (!isModCommand) {
          await logCommandUsage({
            guild: interaction.guild,
            user: interaction.user,
            command: interaction.commandName,
            options: interaction.options.data.reduce((acc, option) => {
              acc[option.name] = option.value;
              return acc;
            }, {} as Record<string, any>),
            channel: interaction.channel,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }).catch(logErr => logError('Command Logging', `Failed to log failed command: ${logErr}`));
        }
      }
      
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
        const { handleAgeModalSubmit } = await import('./handlers/verification/verification-handler');
        await handleAgeModalSubmit(interaction);
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
      
      // Giveaway system buttons
      else if (customId.startsWith('giveaway_enter_')) {
        const { handleGiveawayButton } = await import('./handlers/giveaway/giveaway-handler');
        await handleGiveawayButton(interaction);
        return;
      }
      else if (customId.startsWith('giveaway_info_')) {
        // Handle giveaway info button
        const giveawayId = parseInt(customId.replace('giveaway_info_', ''));
        const { GiveawayService } = await import('./database/services/giveawayService');
        
        const giveawayResult = GiveawayService.getGiveawayById(giveawayId);
        if (!giveawayResult.success || !giveawayResult.giveaway) {
          await interaction.editReply({ content: 'Giveaway not found.' });
          return;
        }
        
        const giveaway = giveawayResult.giveaway;
        const entryCountResult = GiveawayService.getEntryCount(giveawayId);
        const entryCount = entryCountResult.success ? entryCountResult.count || 0 : 0;
        
        const endTime = new Date(giveaway.end_time);
        const isEnded = giveaway.status !== 'active' || endTime <= new Date();
        
        const embed = new EmbedBuilder()
          .setColor('#3b82f6')
          .setTitle(`📋 Giveaway Info: ${giveaway.title}`)
          .setDescription(giveaway.description || 'No description provided')
          .addFields(
            { name: '🏆 Prize', value: giveaway.prize, inline: true },
            { name: '👑 Winners', value: `${giveaway.winner_count}`, inline: true },
            { name: '📊 Entries', value: `${entryCount}`, inline: true },
            { name: '📅 Created', value: `<t:${Math.floor(new Date(giveaway.created_at).getTime() / 1000)}:R>`, inline: true },
            { name: '⏰ Ends', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
            { name: '🎭 Host', value: `<@${giveaway.host_user_id}>`, inline: true },
            { name: '🆔 Giveaway ID', value: `${giveaway.id}`, inline: true },
            { name: '⚡ Status', value: isEnded ? '🔴 Ended' : '🟢 Active', inline: true }
          )
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      else if (customId.startsWith('giveaway_end_') || 
               customId.startsWith('giveaway_cancel_') ||
               customId.startsWith('giveaway_refresh_') ||
               customId.startsWith('giveaway_entries_') ||
               customId.startsWith('giveaway_export_') ||
               customId.startsWith('giveaway_clear_') ||
               customId.startsWith('giveaway_remove_')) {
        try {
          const { handleGiveawayManagementButton } = require('./handlers/giveaway/giveaway-management');
          await handleGiveawayManagementButton(interaction);
        } catch (error) {
          console.error('Error loading giveaway management handler:', error);
          if (interaction.isRepliable()) {
            await interaction.reply({ content: 'An error occurred processing your request.', ephemeral: true });
          }
        }
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

// Message events are now handled by the unified message logger
// This prevents duplicate logging and improves performance

// Track reactions
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    // Skip bot reactions
    if (user.bot) return;
    
    if (reaction.message.guild) {
      await AnalyticsService.trackActivity({
        guild_id: reaction.message.guild.id,
        metric_type: 'reaction_count',
        channel_id: reaction.message.channel.id,
        user_id: user.id,
        value: 1,
        metadata: JSON.stringify({ emoji: reaction.emoji.name })
      }).catch(error => logError('Analytics', `Failed to track reaction: ${error}`));
    }
  } catch (error) {
    logError('Bot', `Error tracking reaction: ${error}`);
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
      'ensure-log-channels',
      'add-moderator-id-column'
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
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Graceful shutdown ...');
  try {
    await shutdownIntegrationSystems();
    logInfo('Bot', '🔗 Integration systems shut down gracefully');
  } catch (error) {
    logError('Bot', `Error shutting down integration systems: ${error}`);
  }
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Graceful shutdown ...');
  try {
    await shutdownIntegrationSystems();
    logInfo('Bot', '🔗 Integration systems shut down gracefully');
  } catch (error) {
    logError('Bot', `Error shutting down integration systems: ${error}`);
  }
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
