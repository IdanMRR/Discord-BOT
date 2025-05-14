import { ButtonInteraction, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageComponentInteraction, PermissionFlagsBits, MessageFlags, ChannelType, AttachmentBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, SelectMenuComponentOptionData, Collection, Message } from 'discord.js';
import { replyEphemeral, convertEphemeralToFlags } from '../../utils/interaction-utils';
import { db } from '../../database/sqlite';
import { logTicketEvent } from '../../utils/databaseLogger';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { createRatingButton } from './ticket-rating';
import { saveAndSendTranscript } from './ticket-transcript';

// Create a map to track recent ticket actions to prevent duplicate logs
const recentTicketActions = new Map<string, number>();

// Function to check if an action was recently performed
function wasActionRecentlyPerformed(ticketId: string, action: string, timeWindowMs: number = 30000): boolean {
  const key = `${ticketId}_${action}`;
  const lastActionTime = recentTicketActions.get(key);
  
  if (lastActionTime && (Date.now() - lastActionTime) < timeWindowMs) {
    return true;
  }
  
  // Mark this action as performed
  recentTicketActions.set(key, Date.now());
  return false;
}

// Replace the simple select menu options with more descriptive ones
const closeReasons: SelectMenuComponentOptionData[] = [
  {
    label: 'Issue Resolved',
    description: 'The issue or request has been successfully resolved',
    value: 'resolved',
    emoji: '✅'
  },
  {
    label: 'No Response',
    description: 'User did not respond to follow-up questions',
    value: 'no_response',
    emoji: '⏱️'
  },
  {
    label: 'Duplicate Ticket',
    description: 'This is a duplicate of another ticket',
    value: 'duplicate',
    emoji: '🔄'
  },
  {
    label: 'User Request',
    description: 'Closed at the request of the user',
    value: 'user_request',
    emoji: '👤'
  },
  {
    label: 'Information Provided',
    description: 'Required information was provided',
    value: 'information_provided',
    emoji: 'ℹ️'
  },
  {
    label: 'Other',
    description: 'Other reason (please specify)',
    value: 'other',
    emoji: '📝'
  }
];

/**
 * Process the closing of a ticket
 */
async function processTicketClose(
  interaction: ButtonInteraction,
  ticket: any,
  confirmInteraction: MessageComponentInteraction,
  reasonText: string
): Promise<void> {
  try {
    const channel = interaction.channel as TextChannel;
    
    // Check if the ticket is already closed to prevent duplicate processing
    const statusCheck = db.prepare(`SELECT status FROM tickets WHERE channel_id = ?`);
    const currentStatus = statusCheck.get(channel.id) as { status: string } | undefined;
    
    if (currentStatus && currentStatus.status === 'closed') {
      logInfo('Ticket Close', `Ticket #${ticket.ticket_number} is already closed. Skipping duplicate close action.`);
      return;
    }
    
    // Check if this ticket was recently closed to prevent duplicate actions
    const actionKey = `${ticket.guild_id}_${ticket.ticket_number}`;
    if (wasActionRecentlyPerformed(actionKey, 'close')) {
      logInfo('Ticket Close', `Ticket #${ticket.ticket_number} was closed recently. Preventing duplicate close action.`);
      return;
    }
    
    // Update the ticket status in the database
    const updateStmt = db.prepare(`
      UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ? WHERE channel_id = ?
    `);
    updateStmt.run(interaction.user.id, channel.id);
    
    // Generate and send a transcript of the ticket
    logInfo('Ticket Close', `Generating transcript for ticket #${ticket.ticket_number}`);
    
    // Generate and send the transcript using our new function
    await saveAndSendTranscript(channel, interaction.user, reasonText);
    
    // Create buttons for reopening and deleting the ticket
    const reopenButton = new ButtonBuilder()
      .setCustomId('reopen_ticket')
      .setLabel('Reopen Ticket')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔓');
    
    const deleteButton = new ButtonBuilder()
      .setCustomId('delete_ticket')
      .setLabel('Delete Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️');
    
    // Create button row
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(reopenButton, deleteButton);
    
    // Create a styled embed for the closure message
    const closedEmbed = new EmbedBuilder()
      .setColor(Colors.ERROR)
      .setTitle('🔒 Ticket Closed')
      .setDescription(`This ticket has been closed by ${interaction.user.tag}.`)
      .addFields([
        { name: '📝 Reason', value: reasonText || 'No reason provided', inline: false },
        { name: '⚙️ Actions', value: 'You can delete this ticket or reopen it using the buttons below.', inline: false }
      ])
      .setFooter({ text: `Made by Soggra. • Ticket #${ticket.ticket_number.toString().padStart(4, '0')}` })
      .setTimestamp();
    
    // Send the closed message
    await channel.send({ 
      embeds: [closedEmbed],
      components: [actionRow]
    });
    
    // Only send rating DM if we haven't done it recently
    if (!wasActionRecentlyPerformed(`${ticket.ticket_number}`, 'rating_request')) {
      try {
        const ticketCreator = await interaction.client.users.fetch(ticket.user_id);
        
        if (ticketCreator) {
          const ratingEmbed = new EmbedBuilder()
            .setColor(Colors.PRIMARY)
            .setTitle('⭐ Rate Your Support Experience')
            .setDescription('We value your feedback! Please rate your support experience to help us improve our service.')
            .addFields([
              { name: '📋 Ticket', value: `#${ticket.ticket_number.toString().padStart(4, '0')}`, inline: true },
              { name: '🏷️ Category', value: ticket.category, inline: true }
            ])
            .setTimestamp();
          
          // Create rating button
          const ratingButton = createRatingButton(ticket.ticket_number);
          const ratingRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(ratingButton);
          
          // Only send the rating request via DM
          await ticketCreator.send({ 
            embeds: [ratingEmbed],
            components: [ratingRow]
          }).catch(() => {
            logError('Ticket Close', `Could not send rating DM to ticket creator ${ticketCreator.tag}`);
          });
        }
      } catch (error) {
        logError('Ticket Close', `Could not send rating request to ticket creator: ${error}`);
      }
    }
    
    // Update permissions to prevent the user from sending messages
    await channel.permissionOverwrites.edit(ticket.user_id, {
      SendMessages: false
    });
    
    // Log the ticket closure but prevent duplicate logs
    if (!wasActionRecentlyPerformed(actionKey, 'log_close')) {
      await logTicketEvent({
        guildId: interaction.guildId!,
        actionType: 'ticketClose',
        userId: interaction.user.id,
        channelId: channel.id,
        ticketNumber: ticket.ticket_number,
        closedBy: interaction.user.id
      });
    }
  } catch (error) {
    logError('Ticket Close', `Error processing ticket close: ${error}`);
    
    // Remove the action from recent actions in case of error to allow retry
    const actionKey = `${ticket.guild_id}_${ticket.ticket_number}`;
    recentTicketActions.delete(`${actionKey}_close`);
  }
}

/**
 * Handle the ticket closure process
 */
export async function handleCloseTicket(interaction: ButtonInteraction) {
  try {
    // Check if the channel is a ticket channel
    const channel = interaction.channel as TextChannel;
    
    if (!channel || channel.type !== ChannelType.GuildText) {
      await replyEphemeral(interaction, {
        content: 'This action can only be performed in a ticket channel.'
      });
      return;
    }
    
    // Check if the channel name starts with "ticket-"
    if (!channel.name.startsWith('ticket-')) {
      await replyEphemeral(interaction, {
        content: 'This channel is not a ticket channel.'
      });
      return;
    }
    
    // Check if the user has permission to close tickets
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const isStaff = member?.permissions.has(PermissionFlagsBits.ManageChannels);
    
    // Get the ticket from the database
    const ticketStmt = db.prepare(`
      SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'
    `);
    const ticket = ticketStmt.get(channel.id) as {
      id: number;
      guild_id: string;
      channel_id: string;
      user_id: string;
      ticket_number: number;
      category: string;
      subject: string;
      status: string;
      created_at: string;
      closed_at: string | null;
      closed_by: string | null;
    } | undefined;
    
    if (!ticket) {
      await replyEphemeral(interaction, {
        content: 'No open ticket found in this channel or the ticket is already closed.'
      });
      return;
    }
    
    // Check if the user is the ticket creator or has staff permissions
    if (ticket.user_id !== interaction.user.id && !isStaff) {
      await replyEphemeral(interaction, {
        content: 'Only the ticket creator or server staff can close this ticket.'
      });
      return;
    }
    
    // Defer the reply to give us time to process
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    // Create a stylish embed for ticket closure confirmation
    const confirmEmbed = new EmbedBuilder()
      .setColor(Colors.ERROR)
      .setTitle('🔒 Close Ticket Confirmation')
      .setDescription('Are you sure you want to close this ticket?')
      .addFields([
        { 
          name: 'Ticket Information', 
          value: `**Number:** #${ticket.ticket_number.toString().padStart(4, '0')}\n**Category:** ${ticket.category}`, 
          inline: false 
        }
      ])
      .setFooter({ text: 'This will archive the ticket and create a transcript' });
    
    // Create confirmation buttons
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('✅');
    
    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_close_ticket')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(confirmButton, cancelButton);
    
    // Ask for confirmation with the stylish embed
    await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row]
    });
    
    // Create a filter for the confirmation button
    const filter = (i: any) => 
      (i.customId === 'confirm_close_ticket' || i.customId === 'cancel_close_ticket') && 
      i.user.id === interaction.user.id;
    
    try {
      // Wait for confirmation (30 second timeout)
      const confirmation = await interaction.channel?.awaitMessageComponent({
        filter,
        time: 30000
      });
      
      if (!confirmation) {
        await interaction.editReply({
          content: 'Ticket closure canceled due to no response.',
          components: []
        });
        return;
      }
      
      if (confirmation.customId === 'cancel_close_ticket') {
        await confirmation.update({
          content: 'Ticket closure canceled.',
          components: []
        });
        return;
      }
      
      // User confirmed, proceed with closing the ticket
      // First update the message to indicate we're processing
      await confirmation.update({
        content: 'Closing the ticket...',
        components: []
      });
      
      // Only staff can specify closing reasons
      let reasonText = 'User Request';
      let reasonHandled = false;  // Flag to check if the reason selection already processed the ticket
      
      if (isStaff) {
        // Create a select menu for ticket closure reason instead of a modal
        const reasonSelectMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('close_ticket_reason_select')
              .setPlaceholder('Select a reason for closing this ticket')
              .addOptions(closeReasons)
          );
          
        // Show the reason select menu
        let reasonSelected = false;
        
        try {
          // Create a visually appealing embed for the reason selection
          const reasonEmbed = new EmbedBuilder()
            .setColor(Colors.WARNING)
            .setTitle('📝 Select Closure Reason')
            .setDescription(`Please select a reason for closing this ticket.`)
            .setFooter({ text: 'This information will be included in the ticket transcript' });
            
          const reasonMessage = await channel.send({
            embeds: [reasonEmbed],
            components: [reasonSelectMenu]
          });
          
          // Create a collector for the response
          const collector = channel.createMessageComponentCollector({
            filter: i => i.customId === 'close_ticket_reason_select' && i.user.id === interaction.user.id && i.isStringSelectMenu(),
            time: 60000,
            max: 1
          });
          
          // Handle collection
          collector.on('collect', async (reasonResponse: StringSelectMenuInteraction) => {
            try {
              // Get the selected value
              const reasonValue = reasonResponse.values[0];
              
              // Map the value to a readable text
              let reasonText: string;
              
              switch (reasonValue) {
                case 'resolved':
                  reasonText = 'Issue Resolved';
                  break;
                case 'no_response':
                  reasonText = 'No Response';
                  break;
                case 'duplicate':
                  reasonText = 'Duplicate Ticket';
                  break;
                case 'user_request':
                  reasonText = 'User Request';
                  break;
                case 'information_provided':
                  reasonText = 'Information Provided';
                  break;
                case 'other':
                  reasonText = 'Other';
                  break;
                default:
                  reasonText = 'Unspecified Reason';
              }
              
              // Acknowledge the selection with a styled embed
              const selectionEmbed = new EmbedBuilder()
                .setColor(Colors.SUCCESS)
                .setTitle('✅ Reason Selected')
                .setDescription(`You selected: **${reasonText}**`)
                .setFooter({ text: 'Proceeding with ticket closure...' });
                
              await reasonResponse.update({
                embeds: [selectionEmbed],
                components: []
              });
              
              reasonHandled = true;  // Set flag to prevent duplicate processing
              
              // Process the ticket closure with the selected reason
              await processTicketClose(interaction, ticket, reasonResponse, reasonText);
              
            } catch (error) {
              logError('Close Ticket', `Error processing reason selection: ${error}`);
              await reasonResponse.update({ content: 'An error occurred while processing your selection.', components: [] });
            }
          });
          
          // Handle timeout
          collector.on('end', async collected => {
            if (collected.size === 0) {
              try {
                // Timeout embed
                const timeoutEmbed = new EmbedBuilder()
                  .setColor(Colors.SECONDARY)
                  .setTitle('⏱️ Selection Timeout')
                  .setDescription('No reason selected, proceeding with ticket closure.')
                  .setFooter({ text: 'Using default reason' });
                  
                await reasonMessage.edit({
                  embeds: [timeoutEmbed],
                  components: []
                });
                
                reasonHandled = true;  // Set flag to prevent duplicate processing
                
                // Process with default reason
                await processTicketClose(interaction, ticket, interaction, 'No reason provided');
              } catch (error) {
                logError('Close Ticket', `Error handling timeout: ${error}`);
              }
            }
          });
          
          // Wait for the collector to finish
          await new Promise(resolve => {
            collector.on('end', () => resolve(null));
          });
          
        } catch (error) {
          logError('Ticket Close', `Error showing reason select menu: ${error}`);
        }
      } else {
        // Regular users don't get to select a reason
        reasonText = "User Request";
      }
      
      // Only process the ticket close if it wasn't already handled by the reason selection
      if (!reasonHandled) {
        // Process the ticket close with the provided reason
        await processTicketClose(interaction, ticket, confirmation, reasonText);
      }
    } catch (error) {
      // Confirmation timed out or errored
      logError('Ticket Close', `Error in ticket close confirmation: ${error}`);
      
      try {
        await interaction.editReply({
          content: 'Ticket closure was canceled or failed.',
          components: []
        });
      } catch (replyError) {
        // If we can't reply, just log it
        logError('Ticket Close', `Could not send error message: ${replyError}`);
      }
    }
  } catch (error) {
    logError('Ticket Close', `Error closing ticket: ${error}`);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred while closing the ticket. Please try again later.'
        });
      } else {
        await replyEphemeral(interaction, {
          content: 'An error occurred while closing the ticket. Please try again later.'
        });
      }
    } catch (replyError) {
      // If we can't reply, just log it
      logError('Ticket Close', `Could not send error message: ${replyError}`);
    }
  }
}
