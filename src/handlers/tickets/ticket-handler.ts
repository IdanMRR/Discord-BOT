import { ButtonInteraction, StringSelectMenuInteraction, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, MessageFlags, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction, TextChannel } from 'discord.js';
import { ticketCategories, getCategoryById } from './ticket-categories';
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
      topic: `${category.emoji} ${category.label} | Ticket #${formattedTicketNumber} | Created by ${interaction.user.tag}`,
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
    
    // Get the rules channel ID from settings if available
    const settings = await settingsManager.getSettings(interaction.guildId!);
    const rulesChannelId = settings?.rules_channel_id;
    
    // Create the welcome embed for the ticket
    const ticketEmbed = new EmbedBuilder()
      .setColor(category.color)
      .setTitle(`${category.emoji} ${category.label} Ticket | #${formattedTicketNumber}`)
      .setDescription(`Thank you for creating a ticket. Please describe your issue in detail, and a staff member will assist you as soon as possible.`)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .addFields([
        { 
          name: '📋 Ticket Information', 
          value: `**Category:** ${category.label}\n**Status:** Open\n**Created:** ${formattedDate}` 
        },
        { 
          name: '👤 User Information', 
          value: `**Username:** ${interaction.user.username}\n**ID:** ${interaction.user.id}\n**Account Created:** ${userCreatedText}`, 
          inline: false 
        }
      ])
      .setFooter({ text: `Coded by IdanMR • Today at ${formattedTime}` });
      
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
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(closeButton);
    
    // Send the welcome message in the new ticket channel
    const welcomeMessage = await ticketChannel.send({
      content: `${interaction.user} Welcome to your ticket! A staff member will be with you shortly.`,
      embeds: [ticketEmbed],
      components: [row]
    });
    
    // Pin the welcome message for easy reference
    try {
      await welcomeMessage.pin();
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
    
    // Create a receipt for the user
    const receiptEmbed = new EmbedBuilder()
      .setColor(category.color)
      .setTitle(`${category.emoji} Ticket Created | #${formattedTicketNumber}`)
      .setDescription(`Your ticket has been successfully created: ${ticketChannel}`)
      .addFields([
        { name: '📋 Ticket Number', value: `#${formattedTicketNumber}`, inline: true },
        { name: '🏷️ Category', value: category.label, inline: true },
        { name: '📝 Status', value: 'Open', inline: true },
        { name: '🕒 Created On', value: formattedDate, inline: false }
      ])
      .setFooter({ text: `Coded by IdanMR • Today at ${formattedTime}` });
    
    // Reply to the user with the receipt
    await interaction.editReply({
      embeds: [receiptEmbed]
    });
    
    logInfo('Tickets', `Ticket #${formattedTicketNumber} created by ${interaction.user.tag} in category ${category.label}`);
    
    return true;
  } catch (error) {
    logError('Ticket Creation', `Error creating ticket: ${error}`);
    
    // Handle errors gracefully
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred while creating your ticket. Please try again later or contact a staff member.'
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while creating your ticket. Please try again later or contact a staff member.',
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
    
    return false;
  }
}
