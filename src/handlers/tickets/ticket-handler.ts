import { ButtonInteraction, StringSelectMenuInteraction, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, MessageFlags, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction, TextChannel } from 'discord.js';
import { ticketCategories, getCategoryById, getPriorityInfo } from './ticket-categories';
import { db } from '../../database/sqlite';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { logTicketEvent } from '../../utils/databaseLogger';
import { settingsManager } from '../../utils/settings';
import { createRatingButton } from './ticket-rating';

/**
 * Handles the initial ticket creation button click
 * This will show the category selection menu to the user
 * 
 * @param interaction The button interaction that triggered this function
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function handleTicketButtonClick(interaction: ButtonInteraction) {
  try {
    logInfo('Tickets', `User ${interaction.user.tag} (${interaction.user.id}) clicked the ticket creation button in ${interaction.guild?.name || 'Unknown Guild'}`);
    
    // Import the category selection function dynamically to avoid circular dependencies
    const { showCategorySelection } = await import('./ticket-categories');
    
    // Show the category selection menu
    return await showCategorySelection(interaction);
  } catch (error) {
    logError('Ticket Button', error);
    
    // Handle error gracefully
    try {
      await interaction.reply({ 
        content: 'An error occurred while processing your request. Please try again later or contact a staff member.',
        flags: MessageFlags.Ephemeral
       });
    } catch (replyError) {
      // If we can't reply, just log it
      console.error('Failed to send error message:', replyError);
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
    // Get the selected category
    const categoryId = interaction.values[0];
    const category = getCategoryById(categoryId);
    
    // Validate the category
    if (!category) {
      await interaction.reply({
        content: 'Invalid category selection. Please try again with a valid category.',
        flags: MessageFlags.Ephemeral
      });
      logError('Ticket Creation', `User ${interaction.user.tag} selected invalid category ID: ${categoryId}`);
      return false;
    }
    
    // Log the category selection
    logInfo('Tickets', `User ${interaction.user.tag} (${interaction.user.id}) selected category: ${category.label}`);
    
    // Defer the reply to give us time to create the ticket (shows "Bot is thinking...")
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    // Get the next ticket number for this guild
    const ticketNumberStmt = db.prepare(`
      SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?
    `);
    const { count } = ticketNumberStmt.get(interaction.guildId) as { count: number };
    const ticketNumber = count + 1;
    
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
    
    // Create the ticket channel
    const ticketChannel = await interaction.guild?.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      topic: `${category.emoji} ${category.label} | Ticket #${formattedTicketNumber} | ${priorityInfo.emoji} ${priorityInfo.label} Priority | Created by ${interaction.user.tag}`,
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
    
    // Get the rules channel ID from settings if available
    const settings = await settingsManager.getSettings(interaction.guildId!);
    const rulesChannelId = settings?.rules_channel_id;
    
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
      ])
      .setFooter({ text: `Support Ticket System • ${formattedTime}` });
      
    // Add rules channel reference if available
    if (rulesChannelId) {
      ticketEmbed.addFields([
        {
          name: '📜 Server Rules',
          value: `Please make sure to read our server rules in <#${rulesChannelId}> before proceeding.`
        }
      ]);
    }
    
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
      const stmt = db.prepare(`
        INSERT INTO tickets 
        (guild_id, channel_id, user_id, ticket_number, category, subject, status, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      stmt.run(
        interaction.guildId,
        ticketChannel.id,
        interaction.user.id,
        ticketNumber,
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
    
    // Mention appropriate staff roles based on category
    if (category.staffRoles && category.staffRoles.length > 0) {
      const staffMentions = category.staffRoles.map(roleId => `<@&${roleId}>`).join(' ');
      await ticketChannel.send({
        content: `${staffMentions} - A new ${category.label} ticket has been created that requires your attention.`
      });
    }
    
    // Send a confirmation message to the user to complete the interaction
    await interaction.editReply({
      content: `✅ Your ticket has been created successfully! Please go to <#${ticketChannel.id}> to continue.`,
    });
  } catch (error) {
    logError('Ticket Creation', error);
    
    // Handle error gracefully
    try {
      await interaction.reply({ 
        content: 'An error occurred while processing your request. Please try again later or contact a staff member.',
        flags: MessageFlags.Ephemeral
       });
    } catch (replyError) {
      // If we can't reply, just log it
      console.error('Failed to send error message:', replyError);
    }
    
    return false;
  }
}