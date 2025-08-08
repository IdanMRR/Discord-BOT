import { ButtonInteraction, StringSelectMenuInteraction, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, MessageFlags, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction, TextChannel } from 'discord.js';
import { ticketCategories, getCategoryById, getPriorityInfo } from './ticket-categories';
import { db } from '../../database/sqlite';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { logTicketEvent } from '../../utils/databaseLogger';
import { settingsManager } from '../../utils/settings';
import { createRatingButton } from './ticket-rating';
import { getClient } from '../../utils/client-utils';

// Add a map to track recent button clicks to prevent duplicates
const recentButtonClicks = new Map<string, number>();

// Add a cache for usernames to prevent duplicate API calls
const usernameCache = new Map<string, string>();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

// Function to check and record a button click to prevent duplicates
function preventDuplicateButtonClick(userId: string, guildId: string, buttonType: string, timeWindowMs: number = 3000): boolean {
  const key = `${userId}_${guildId}_${buttonType}`;
  const now = Date.now();
  const lastClick = recentButtonClicks.get(key);
  
  if (lastClick && (now - lastClick) < timeWindowMs) {
    // This is a duplicate click within the time window
    return true;
  }
  
  // Record this click
  recentButtonClicks.set(key, now);
  return false;
}

/**
 * Checks if a user already has an open ticket in the server
 * 
 * @param guildId The guild ID
 * @param userId The user ID
 * @returns Promise resolving to the existing ticket data or null
 */
export async function checkExistingTicket(guildId: string, userId: string): Promise<{ 
  ticketNumber: number, 
  channelId: string 
} | null> {
  try {
    // Query the database for open tickets by this user
    const ticket = db.prepare(`
      SELECT ticket_number, channel_id 
      FROM tickets 
      WHERE guild_id = ? AND user_id = ? AND status IN ('open', 'in_progress', 'on_hold')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(guildId, userId) as { ticket_number: number, channel_id: string } | undefined;
    
    if (ticket) {
      // Validate that the channel still exists
      try {
        const client = getClient();
        if (!client) {
          logError('Ticket Duplicate Check', 'Client not available');
          return null;
        }
        
        const channel = await client.channels.fetch(ticket.channel_id);
        if (!channel) {
          // Channel doesn't exist, clean up database
          logInfo('Ticket Duplicate Check', `Channel ${ticket.channel_id} for ticket #${ticket.ticket_number} no longer exists, updating database`);
          // Update the ticket status to closed in database since the channel is gone
          db.prepare(`
            UPDATE tickets 
            SET status = 'closed'
            WHERE guild_id = ? AND channel_id = ?
          `).run(guildId, ticket.channel_id);
          return null;
        }
        
        // Channel exists, return ticket info
        return {
          ticketNumber: ticket.ticket_number,
          channelId: ticket.channel_id
        };
      } catch (channelError: any) {
        // Check if this is an Unknown Channel error (10003) which is expected
        if (channelError.code === 10003) {
          // This is expected behavior for deleted channels
          logInfo('Ticket Duplicate Check', `Channel ${ticket.channel_id} for ticket #${ticket.ticket_number} no longer exists (code 10003), marking ticket as closed`);
        } else {
          // Log unexpected errors
          logError('Ticket Duplicate Check', `Error fetching channel ${ticket.channel_id}: ${channelError}`);
        }
        
        // Either way, update the ticket status to closed
        db.prepare(`
          UPDATE tickets 
          SET status = 'closed'
          WHERE guild_id = ? AND channel_id = ?
        `).run(guildId, ticket.channel_id);
        return null;
      }
    }
    
    return null;
  } catch (error) {
    logError('Ticket Duplicate Check', `Error checking for existing tickets: ${error}`);
    return null;
  }
}

/**
 * Handles the initial ticket creation button click
 * This will show the category selection menu to the user
 * 
 * @param interaction The button interaction that triggered this function
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function handleTicketButtonClick(interaction: ButtonInteraction) {
  try {
    // IMMEDIATELY defer to prevent timeout - use flags syntax to avoid deprecation warning
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;
    
    // Check for duplicate clicks after deferring
    if (preventDuplicateButtonClick(userId, guildId, 'ticket_create')) {
      logInfo('Tickets', `Prevented duplicate ticket button click from ${interaction.user.tag} (${userId})`);
      await interaction.editReply({
        content: '⏳ You already have a ticket creation in progress. Please wait...'
      });
      return false;
    }
    
    logInfo('Tickets', `User ${interaction.user.tag} (${userId}) clicked the ticket creation button in ${interaction.guild?.name || 'Unknown Guild'}`);
    
    // Check if the user already has an open ticket
    const existingTicket = await checkExistingTicket(guildId, userId);
    
    if (existingTicket) {
      // Create buttons for existing ticket
      const redirectButton = new ButtonBuilder()
        .setLabel('Go to Existing Ticket')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${guildId}/${existingTicket.channelId}`);
      
      const forceCreateButton = new ButtonBuilder()
        .setCustomId('force_create_ticket')
        .setLabel('Create New Ticket Anyway')
        .setStyle(ButtonStyle.Danger);
      
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(redirectButton, forceCreateButton);
      
      const duplicateEmbed = new EmbedBuilder()
        .setTitle('❗ You Already Have a Ticket')
        .setDescription(`You already have an open ticket (#${existingTicket.ticketNumber}). Please use your existing ticket instead of creating a new one.`)
        .setColor(Colors.WARNING)
        .addFields([
          { name: 'Options', value: 'You can either go to your existing ticket or create a new one anyway if needed.' }
        ]);
      
      await interaction.editReply({ 
        embeds: [duplicateEmbed], 
        components: [row]
      });
      
      return false;
    }
    
    // Show category selection
    const { showCategorySelection } = await import('./ticket-categories');
    return await showCategorySelection(interaction);
    
  } catch (error: any) {
    logError('Ticket Button', error);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply({ 
          content: '❌ An error occurred while creating the ticket. Please try again later.' 
        });
      } else {
        // Fallback - try to reply if not deferred yet
        await interaction.reply({
          content: '❌ An error occurred while creating the ticket. Please try again later.',
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (replyError) {
      // Silently fail if we can't send error message
      logError('Ticket Button', `Failed to send error message: ${replyError}`);
    }
    
    return false;
  }
}

/**
 * Handles the category selection for a ticket and creates a new ticket channel
 * This function is called when a user selects a category from the dropdown menu
 * 
 * @param interaction The select menu interaction that triggered this function
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function handleCategorySelection(interaction: StringSelectMenuInteraction) {
  try {
    // Immediately defer the reply to prevent timeout - use flags syntax to avoid deprecation warning
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    // Get the selected category
    const categoryId = interaction.values[0];
    const category = getCategoryById(categoryId);
    
    // Validate the category
    if (!category) {
      await interaction.editReply({
        content: 'Invalid category selection. Please try again with a valid category.'
      });
      logError('Ticket Creation', `User ${interaction.user.tag} selected invalid category ID: ${categoryId}`);
      return false;
    }
    
    // Log the category selection
    logInfo('Tickets', `User ${interaction.user.tag} (${interaction.user.id}) selected category: ${category.label}`);
    
    // Get the next ticket number for this guild using MAX to avoid duplicates
    const ticketNumberStmt = db.prepare(`
      SELECT COALESCE(MAX(ticket_number), 0) as max_number FROM tickets WHERE guild_id = ?
    `);
    const { max_number } = ticketNumberStmt.get(interaction.guildId) as { max_number: number };
    const ticketNumber = max_number + 1;
    
    // Format the ticket number with leading zeros (e.g., 0001, 0002)
    const formattedTicketNumber = ticketNumber.toString().padStart(4, '0');
    
    // Create channel name with ticket number and category
    const channelName = `ticket-${formattedTicketNumber}-${categoryId}`;
    
    // Get priority information from the category
    const priorityInfo = getPriorityInfo(category.priority || 'medium');
    
    // Find staff roles with manage channels permission to add to the ticket
    let staffRoles: { id: string, allow: bigint }[] = [];
    
    try {
      // Get all roles in the guild
      const roles = await interaction.guild?.roles.fetch();
      
      // Filter for roles with manage channels permission
      roles?.forEach(role => {
        if (role.permissions.has(PermissionFlagsBits.ManageChannels)) {
          staffRoles.push({
            id: role.id,
            allow: PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory
          });
        }
      });
      
      // Add category-specific staff roles if configured
      if (category.staffRoles && category.staffRoles.length > 0) {
        for (const roleId of category.staffRoles) {
          if (!staffRoles.some(r => r.id === roleId)) {
            staffRoles.push({
              id: roleId,
              allow: PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory
            });
          }
        }
      }
    } catch (error) {
      logError('Ticket Creation', `Failed to fetch staff roles: ${error}`);
      // Continue without staff roles if there's an error
    }
    
    // Create the permission overwrites array
    const permissionOverwrites = [
      {
        id: interaction.guild!.id, // @everyone role
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: interaction.user.id, // Ticket creator
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      },
      {
        id: interaction.client.user!.id, // Bot itself
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      },
      // Add staff roles
      ...staffRoles
    ];
    
    // Get server settings first (before creating channel)
    const settings = await settingsManager.getSettings(interaction.guildId!);
    const ticketCategoryId = settings?.ticket_category_id;
    
    logInfo('Ticket Creation', `Creating ticket channel with category ID: ${ticketCategoryId || 'none (will be created in root)'}`);
    
    // Create the ticket channel
    const ticketChannel = await interaction.guild?.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      topic: `${category.emoji} ${category.label} | Ticket #${formattedTicketNumber} | ${priorityInfo.emoji} ${priorityInfo.label} Priority | Created by ${interaction.user.tag}`,
      parent: ticketCategoryId || undefined, // Use the configured ticket category
      permissionOverwrites: permissionOverwrites
    });
    
    // Handle channel creation failure
    if (!ticketChannel) {
      await interaction.editReply({
        content: 'An error occurred while creating the ticket channel. Please try again later or contact a staff member.'
      });
      logError('Ticket Creation', `Failed to create ticket channel for ${interaction.user.tag}`);
      return false;
    }
    
    // Format the current time for embeds
    const now = new Date();
    const formattedTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    const formattedDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Get user account creation date
    const userCreatedAt = interaction.user.createdAt;
    const userCreatedDays = Math.floor((Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
    const userCreatedText = userCreatedDays > 365 ? 
      `${Math.floor(userCreatedDays / 365)} year${Math.floor(userCreatedDays / 365) !== 1 ? 's' : ''} ago` : 
      `${userCreatedDays} day${userCreatedDays !== 1 ? 's' : ''} ago`;
    
    // Get user join date if available
    let joinedDaysText = '';
    if (interaction.member instanceof GuildMember && interaction.member.joinedAt) {
      const joinedDays = Math.floor((Date.now() - interaction.member.joinedAt.getTime()) / (1000 * 60 * 60 * 24));
      joinedDaysText = joinedDays > 365 ? 
        `${Math.floor(joinedDays / 365)} year${Math.floor(joinedDays / 365) !== 1 ? 's' : ''} ago` : 
        `${joinedDays} day${joinedDays !== 1 ? 's' : ''} ago`;
    }
    
    // Rules channel is no longer configured
    
    // Send initial waiting message
    const waitingMessage = await ticketChannel.send({
      content: `${interaction.user}, your ticket is being set up. Please wait a moment...`
    });
    
    // Create the welcome embed for the ticket with enhanced information
    const ticketEmbed = new EmbedBuilder()
      .setColor(category.color)
      .setTitle(`${category.emoji} ${category.label} Support | Ticket #${formattedTicketNumber}`)
      .setDescription(`Thank you for creating a ticket. Please describe your issue in detail, and a staff member will assist you as soon as possible.\n\nExpected response time: **${category.expectedResponseTime || '24 hours'}**`)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .addFields([
        { 
          name: '📋 Ticket Information', 
          value: `**Category:** ${category.label}\n**Priority:** ${priorityInfo.emoji} ${priorityInfo.label}\n**Status:** Open\n**Created:** ${formattedDate}` 
        },
        { 
          name: '👤 User Information', 
          value: `**Username:** ${interaction.user.username}\n**ID:** ${interaction.user.id}\n**Account Created:** ${userCreatedText}${joinedDaysText ? `\n**Server Joined:** ${joinedDaysText}` : ''}`, 
          inline: false 
        }
      ]);
    
    // Add AI assistant information if it's enabled
    if (settings?.ticket_chatbot_enabled) {
      ticketEmbed.addFields([
        {
          name: '🤖 AI Assistant',
          value: `Our AI assistant is available in this ticket to help with common questions. Simply ask your question, and the AI will try to assist you while you wait for staff. If the AI cannot fully resolve your issue, a staff member will continue the conversation.`,
          inline: false
        }
      ]);
    }
      
    ticketEmbed.setFooter({ text: `Support Ticket System • ${formattedTime}` });
      
    
    // Create buttons for ticket management
    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒');
    
    // Add FAQ button
    const faqButton = new ButtonBuilder()
      .setCustomId('view_faq')
      .setLabel('View FAQ')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❓');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(closeButton, faqButton);
    
    // Delete the waiting message
    await waitingMessage.delete().catch(() => {});
    
    // Send the welcome message in the new ticket channel
    const welcomeMessage = await ticketChannel.send({
      content: ``,
      embeds: [ticketEmbed],
      components: [row]
    });
    
    // Pin the welcome message for easy reference
    try {
      await welcomeMessage.pin();
      
      // Wait briefly for the system message to appear before trying to delete it
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Delete the system message about pinning to avoid cluttering the chat
      const messages = await ticketChannel.messages.fetch({ limit: 10 });
      const pinSystemMessage = messages.find(m => 
        m.type === 6 && // MessageType.ChannelPinnedMessage
        m.author.id === interaction.client.user?.id &&
        m.content.includes('pinned a message')
      );
      
      if (pinSystemMessage) {
        await pinSystemMessage.delete().catch((error) => {
          // Log the error but continue
          logError('Ticket Creation', `Could not delete pin system message: ${error}`);
        });
      }
    } catch (pinError) {
      logError('Ticket Creation', `Failed to pin welcome message: ${pinError}`);
      // Continue even if pinning fails
    }
    
    // Save the ticket to the database
    try {
      // Get the next case number for this guild (for moderation tracking)
      const caseNumberStmt = db.prepare(`
        SELECT COALESCE(MAX(case_number), 0) as max_case FROM tickets WHERE guild_id = ?
      `);
      const { max_case } = caseNumberStmt.get(interaction.guildId) as { max_case: number };
      const caseNumber = max_case + 1;
      
      const stmt = db.prepare(`
        INSERT INTO tickets 
        (guild_id, channel_id, user_id, ticket_number, case_number, category, subject, status, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(
        interaction.guildId,
        ticketChannel.id,
        interaction.user.id,
        ticketNumber,
        caseNumber,
        categoryId,
        category.label,
        'open'
      );
      
      // Log the ticket creation event
      await logTicketEvent({
        guildId: interaction.guildId!,
        actionType: 'ticketCreate',
        userId: interaction.user.id,
        channelId: ticketChannel.id,
        ticketNumber: ticketNumber,
        subject: category.label
      });
    } catch (dbError) {
      logError('Ticket Creation', `Failed to save ticket to database: ${dbError}`);
      // Continue even if database saving fails
    }
    
    // Send an AI assistant prompt message if chatbot is enabled
    if (settings?.ticket_chatbot_enabled) {
      const aiPromptEmbed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setAuthor({
          name: 'Ticket Assistant',
          iconURL: interaction.client.user?.displayAvatarURL()
        })
        .setDescription(`Hello ${interaction.user}! I'm your AI assistant. How can I help you with your ${category.label.toLowerCase()} issue today? Feel free to ask any questions, and I'll do my best to assist you while our staff team reviews your ticket.`)
        .setFooter({ text: 'You can start typing your question now' });
      
      await ticketChannel.send({ embeds: [aiPromptEmbed] });
    }
    
    // Mention appropriate staff roles based on category
    if (category.staffRoles && category.staffRoles.length > 0) {
      const staffMentions = category.staffRoles.map(roleId => `<@&${roleId}>`).join(' ');
      await ticketChannel.send({
        content: `${staffMentions} - A new ${category.label} ticket has been created that requires your attention.`
      });
    }
    
    // Send a confirmation message to the user to complete the interaction
    const successEmbed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle('✅ Ticket Created Successfully')
      .setDescription(`Your ticket has been created successfully! Please go to <#${ticketChannel.id}> to continue.`)
      .setFooter({ text: 'Made by Soggra.' })
      .setTimestamp();
      
    try {
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (replyError) {
      logError('Ticket Creation', `Failed to send success message: ${replyError}`);

      try {
        await interaction.editReply({ 
          embeds: [successEmbed], 
        });
      } catch (followUpError) {
        logError('Ticket Creation', `Failed to send followUp success message: ${followUpError}`);
      }
    }
  } catch (error) {
    logError('Ticket Creation', error);
    
    // Handle error gracefully
    try {
      // Create an error embed
      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setTitle('❌ Error Creating Ticket')
        .setDescription('An error occurred while processing your request. Please try again later or contact a staff member.')
        .setFooter({ text: 'Made by Soggra.' })
        .setTimestamp();
        
      // Check if the interaction has been deferred
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ 
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (replyError) {
      // If we can't reply, just log it
      console.error('Failed to send error message:', replyError);
    }
  }
}

/**
 * Updates the pinned ticket embed with current status information
 * 
 * @param channel The ticket channel
 * @param newStatus The new status to display
 * @returns Promise resolving to true if successful
 */
export async function updateTicketEmbed(channel: TextChannel, newStatus: string): Promise<boolean> {
  try {
    // Get pinned messages
    const pinnedMessages = await channel.messages.fetchPinned();
    
    // Find the ticket info message (usually the first pinned message)
    const ticketMessage = pinnedMessages.find(msg => 
      msg.author.id === channel.client.user?.id &&
      msg.embeds.length > 0 &&
      msg.embeds[0].title?.includes('Ticket')
    );
    
    if (!ticketMessage) {
      logInfo('Ticket Update', `No pinned ticket message found in ${channel.name}`);
      return false;
    }
    
    // Get the original embed
    const originalEmbed = ticketMessage.embeds[0];
    
    // Get the ticket number from the channel name
    const ticketNumber = parseInt(channel.name.split('-')[1]);
    
    if (isNaN(ticketNumber)) {
      logError('Ticket Update', `Could not parse ticket number from channel name: ${channel.name}`);
      return false;
    }
    
    // Get status emoji
    let statusEmoji;
    let statusColor;
    switch (newStatus) {
      case 'open':
        statusEmoji = '🟢';
        statusColor = Colors.SUCCESS;
        break;
      case 'in_progress':
        statusEmoji = '🔵';
        statusColor = Colors.PRIMARY;
        break;
      case 'on_hold':
        statusEmoji = '🟠';
        statusColor = Colors.WARNING;
        break;
      case 'closed':
        statusEmoji = '🔴';
        statusColor = Colors.ERROR;
        break;
      default:
        statusEmoji = '⚪';
        statusColor = Colors.SECONDARY;
    }
    
    // Create a new embed based on the original
    const newEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(statusColor);
    
    // Update fields if they exist, or add them
    let updatedFields = [...originalEmbed.fields];
    const statusIndex = updatedFields.findIndex(field => field.name === 'Status');
    
    if (statusIndex >= 0) {
      // Update existing status field
      updatedFields[statusIndex] = {
        name: 'Status',
        value: `${statusEmoji} ${getStatusName(newStatus)}`,
        inline: true
      };
    } else {
      // Add status field
      updatedFields.push({
        name: 'Status',
        value: `${statusEmoji} ${getStatusName(newStatus)}`,
        inline: true
      });
    }
    
    // Update the embed with new fields
    newEmbed.setFields(updatedFields);
    
    // Edit the message
    await ticketMessage.edit({ embeds: [newEmbed] });
    logInfo('Ticket Update', `Updated pinned message in ticket #${ticketNumber} with status: ${newStatus}`);
    
    return true;
  } catch (error) {
    logError('Ticket Update', `Error updating ticket embed: ${error}`);
    return false;
  }
}

/**
 * Get the formatted name of a status code
 */
function getStatusName(status: string): string {
  switch (status) {
    case 'open': return 'Open';
    case 'in_progress': return 'In Progress';
    case 'on_hold': return 'On Hold';
    case 'closed': return 'Closed';
    case 'deleted': return 'Deleted';
    default: return 'Unknown';
  }
}

/**
 * Create ticket panel message in channel
 */
export async function createTicketPanelMessage(channelId: string, guildId: string, settings: any): Promise<string | null> {
  try {
    const client = getClient();
    
    if (!client) {
      logError('Ticket Panel', 'Discord client not available');
      return null;
    }
    
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId) as TextChannel;
    
    if (!channel?.isTextBased()) {
      logError('Ticket Panel', 'Invalid ticket panel channel');
      return null;
    }
    
    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle('🎫 Support Tickets')
      .setDescription('Need help? Have a question? Want to report something? Create a ticket and our staff team will assist you as soon as possible.')
      .addFields([
        { name: '🔹 How to Create a Ticket', value: 'Click the button below to create a new support ticket.' },
        { name: '🔹 Response Time', value: 'Our staff team typically responds within a few hours.' },
        { name: '🔹 Categories Available', value: 'Select the category that best matches your request when creating a ticket.' }
      ])
      .setFooter({ text: 'Made by Soggra • Support Ticket System' })
      .setTimestamp();
    
    const createButton = new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel('Create Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫');
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(createButton);
    
    const message = await channel.send({
      embeds: [embed],
      components: [row]
    });
    
    logInfo('Ticket Panel', `Ticket panel message created in ${channel.name}`);
    return message.id;
  } catch (error) {
    logError('Ticket Panel', `Error creating ticket panel message: ${error}`);
    return null;
  }
}

/**
 * Create custom ticket panel message in channel
 */
export async function createCustomTicketPanelMessage(
  channelId: string, 
  guildId: string, 
  settings: any, 
  customMessage: {
    title: string;
    description: string;
    color: string;
    footer: string;
    buttonText?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }
): Promise<string | null> {
  try {
    logInfo('Ticket Panel', `Creating custom ticket panel message with footer: "${customMessage.footer}"`);
    
    // Log the custom fields for debugging
    if (customMessage.fields && customMessage.fields.length > 0) {
      logInfo('Ticket Panel', `Custom fields received (${customMessage.fields.length} fields):`);
      customMessage.fields.forEach((field, index) => {
        logInfo('Ticket Panel', `Field ${index + 1}: "${field.name}" = "${field.value}"`);
      });
    } else {
      logInfo('Ticket Panel', 'No custom fields provided, using defaults');
    }
    
    const { getClient } = await import('../../utils/client-utils');
    const client = getClient();
    
    if (!client) {
      logError('Ticket Panel', 'Discord client not available');
      return null;
    }
    
    const channel = client.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      logError('Ticket Panel', `Channel ${channelId} not found`);
      return null;
    }
    
    const color = customMessage.color.startsWith('#') 
      ? parseInt(customMessage.color.slice(1), 16) 
      : parseInt(customMessage.color, 16);
    
    // Use custom fields if provided, otherwise use defaults
    const fields = customMessage.fields && customMessage.fields.length > 0 
      ? customMessage.fields 
      : [
          { name: '🔹 How to Create a Ticket', value: 'Click the button below to create a new support ticket.' },
          { name: '🔹 Response Time', value: 'Our staff team typically responds within a few hours.' },
          { name: '🔹 Categories Available', value: 'Select the category that best matches your request when creating a ticket.' }
        ];
    
    // Log which fields will be used
    logInfo('Ticket Panel', `Using ${fields.length} fields in ticket panel:`);
    fields.forEach((field, index) => {
      logInfo('Ticket Panel', `  ${index + 1}. "${field.name}": "${field.value}"`);
    });
    
    // Add spacing between fields for better readability
    const formattedFields = fields.map((field, index) => ({
      name: field.name,
      value: field.value,
      inline: field.inline || false
    }));
    
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(customMessage.title)
      .setDescription(customMessage.description)
      .addFields(formattedFields)
      .setFooter({ text: customMessage.footer })
      .setTimestamp();
    
    logInfo('Ticket Panel', `Creating embed with ${formattedFields.length} fields and footer: "${customMessage.footer}"`);
    
    // Use custom button text if provided, otherwise use default
    const buttonText = customMessage.buttonText || 'Create Ticket';
    logInfo('Ticket Panel', `Using button text: "${buttonText}"`);
    
    // Create ticket button
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel(`🎫 ${buttonText}`)
          .setStyle(ButtonStyle.Primary)
      );
    
    // Send the message
    const message = await channel.send({
      embeds: [embed],
      components: [row]
    });
    
    logInfo('Ticket Panel', `Custom ticket panel message created with ID ${message.id} in ${channel.name}`);
    return message.id;
    
  } catch (error) {
    logError('Ticket Panel', `Error creating custom ticket panel message: ${error}`);
    return null;
  }
}