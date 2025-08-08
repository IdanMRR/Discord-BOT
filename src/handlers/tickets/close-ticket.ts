import { ButtonInteraction, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageComponentInteraction, PermissionFlagsBits, MessageFlags, ChannelType, AttachmentBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, SelectMenuComponentOptionData, Collection, Message, User, ModalSubmitInteraction } from 'discord.js';
import { replyEphemeral, convertEphemeralToFlags } from '../../utils/interaction-utils';
import { db } from '../../database/sqlite';
import { logTicketEvent } from '../../utils/databaseLogger';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { createRatingButton } from './ticket-rating';
import { saveAndSendTranscript } from './ticket-transcript';
import { formatIsraeliTime } from '../../utils/time-formatter';
import { validateReason } from '../../utils/validation';

// Create a simple map to track recent ticket actions (simplified)
const recentCloseActions = new Set<string>();

// Clean up old entries every 2 minutes
setInterval(() => {
  recentCloseActions.clear();
}, 2 * 60 * 1000);

/**
 * Process the closing of a ticket - simplified version
 */
async function processTicketClose(
  channel: TextChannel,
  ticket: any,
  closedBy: string,
  reasonText: string
): Promise<void> {
  try {
    // Validate channel still exists before proceeding
    try {
      await channel.fetch();
    } catch (channelError: any) {
      if (channelError.code === 10003) {
        // Channel was deleted - just update database and skip other operations
        logInfo('Ticket Close', `Channel for ticket #${ticket.ticket_number} was already deleted. Updating database only.`);
        
        const updateStmt = db.prepare(`
          UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ? WHERE channel_id = ?
        `);
        updateStmt.run(closedBy, channel.id);
        
        // Log the ticket closure
        await logTicketEvent({
          guildId: ticket.guild_id,
          actionType: 'ticketClose',
          userId: closedBy,
          channelId: channel.id,
          ticketNumber: ticket.ticket_number,
          closedBy: closedBy,
          note: 'Channel was already deleted'
        });
        
        return;
      }
      throw channelError;
    }

    // Update the ticket status in the database
    const updateStmt = db.prepare(`
      UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ? WHERE channel_id = ?
    `);
    updateStmt.run(closedBy, channel.id);
    
    // Generate and send a transcript of the ticket
    logInfo('Ticket Close', `Generating transcript for ticket #${ticket.ticket_number}`);
    
    // Generate and save transcript before closing with error handling
    try {
      // Properly fetch the user who closed the ticket
      let closedByUser: User | null = null;
      try {
        closedByUser = await channel.client.users.fetch(closedBy);
      } catch (userError) {
        logError('Ticket Close', `Error fetching user ${closedBy}: ${userError}`);
      }
      
      // Pass the proper user object (or fallback to ID string)
      await saveAndSendTranscript(channel, closedByUser || closedBy, reasonText, false, true);
    } catch (transcriptError: any) {
      if (transcriptError.code === 10003) {
        logError('Ticket Close', `Channel was deleted while generating transcript for ticket #${ticket.ticket_number}`);
      } else {
        logError('Ticket Close', `Error generating transcript: ${transcriptError}`);
      }
      // Continue with close process even if transcript fails
    }
    
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
    
    // Create a styled embed for the closure message (matching website style)
    const closedEmbed = new EmbedBuilder()
      .setColor(0xff0000) // Red color like website
      .setTitle('🔒 Ticket Closed')
      .setDescription(`This ticket has been closed by <@${closedBy}>.`)
      .addFields([
        { name: '📝 Reason', value: reasonText || 'User Request', inline: false },
        { name: '🎫 Ticket ID', value: `#${ticket.ticket_number.toString().padStart(4, '0')}`, inline: true },
        { name: '👤 Closed By', value: `<@${closedBy}>`, inline: true },
        { name: '📅 Closed At', value: formatIsraeliTime(new Date()), inline: true },
        { name: '⚙️ Actions', value: 'Staff can reopen or permanently delete this ticket using the buttons below.', inline: false }
      ])
      .setFooter({ text: `Closed via Discord • Made by Soggra` })
      .setTimestamp();
    
    // Send the closed message
    await channel.send({ 
      embeds: [closedEmbed],
      components: [actionRow]
    });
    
    // Update permissions to prevent the user from sending messages
    try {
      await channel.permissionOverwrites.edit(ticket.user_id, {
        SendMessages: false
      });
    } catch (permError) {
      logError('Ticket Close', `Could not update permissions: ${permError}`);
    }
    
    // Send rating DM to ticket creator (notification will be sent with transcript)
    try {
      const client = channel.client;
      const ticketCreator = await client.users.fetch(ticket.user_id);
      
      if (ticketCreator) {
        // Only send the rating request - the closure notification is sent with the transcript
        const ratingEmbed = new EmbedBuilder()
          .setColor(Colors.PRIMARY)
          .setTitle('⭐ Rate Your Support Experience')
          .setDescription('We value your feedback! Please rate your support experience to help us improve our service.')
          .addFields([
            { name: '📋 Ticket', value: `#${ticket.ticket_number.toString().padStart(4, '0')}`, inline: true },
            { name: '🏷️ Category', value: ticket.subject || 'General Support', inline: true }
          ])
          .setTimestamp();
        
        // Create rating button
        const ratingButton = createRatingButton(ticket.ticket_number);
        const ratingRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(ratingButton);
        
        // Send the rating request via DM
        await ticketCreator.send({ 
          embeds: [ratingEmbed],
          components: [ratingRow]
        }).catch(() => {
          logError('Ticket Close', `Could not send rating DM to ticket creator ${ticketCreator.tag}`);
        });
      }
    } catch (error) {
      logError('Ticket Close', `Could not send rating notification to ticket creator: ${error}`);
    }
    
    // Log the ticket closure
    await logTicketEvent({
      guildId: ticket.guild_id,
      actionType: 'ticketClose',
      userId: closedBy,
      channelId: channel.id,
      ticketNumber: ticket.ticket_number,
      closedBy: closedBy
    });
    
    logInfo('Ticket Close', `Ticket #${ticket.ticket_number} closed successfully`);
  } catch (error) {
    logError('Ticket Close', `Error processing ticket close: ${error}`);
    throw error;
  }
}

/**
 * Handle the ticket closure process - completely simplified
 */
export async function handleCloseTicket(interaction: ButtonInteraction) {
  const channelKey = `${interaction.channel?.id}_close`;
  
  try {
    // Check if interaction has already been replied to
    if (interaction.replied) {
      logInfo('Ticket Close', `Interaction already replied for ticket close by ${interaction.user.tag}`);
      return;
    }

    // The main handler already deferred this interaction
    const channel = interaction.channel as TextChannel;
    
    // Validate channel exists and is accessible
    if (!channel) {
      await interaction.editReply({
        content: '❌ Could not access this channel.'
      });
      return;
    }
    
    // Check if channel still exists by trying to fetch it
    try {
      await channel.fetch();
    } catch (channelError: any) {
      if (channelError.code === 10003) {
        // Channel was deleted
        await interaction.editReply({
          content: '❌ This ticket channel no longer exists.'
        });
        return;
      }
      throw channelError;
    }
    
    // Check if this close action was recently performed (per-channel, not per-user)
    if (recentCloseActions.has(channelKey)) {
      await interaction.editReply({
        content: '⏳ A close request is already being processed for this ticket. Please wait...'
      });
      return;
    }
    
    // Mark this action as being performed
    recentCloseActions.add(channelKey);
    
    // Get ticket info from database
    const ticketStmt = db.prepare(`
      SELECT t.*, u.username 
      FROM tickets t 
      LEFT JOIN users u ON t.user_id = u.user_id 
      WHERE t.channel_id = ?
    `);
    const ticket = ticketStmt.get(channel.id) as any;
    
    if (!ticket) {
      await interaction.editReply({
        content: '❌ This channel is not a valid ticket.'
      });
      recentCloseActions.delete(channelKey);
      return;
    }
    
    // Check if the ticket is already closed
    if (ticket.status === 'closed') {
      await interaction.editReply({
        content: '❌ This ticket is already closed.'
      });
      recentCloseActions.delete(channelKey);
      return;
    }

    // Check if user has staff permissions
    const hasStaffRole = interaction.guild?.members.cache.get(interaction.user.id)?.roles.cache.some(role => 
      role.name.toLowerCase().includes('staff') || 
      role.name.toLowerCase().includes('admin') || 
      role.name.toLowerCase().includes('mod')
    ) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);

    let reasonText = 'User Request';
    
    if (hasStaffRole) {
      // Staff can select a reason using a select menu
      const reasonEmbed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('🔒 Close Ticket')
        .setDescription('Please select a reason for closing this ticket:');

      const reasonSelect = new StringSelectMenuBuilder()
        .setCustomId(`close_reason_${interaction.id}`)
        .setPlaceholder('Select a reason...')
        .addOptions([
          {
            label: 'Issue Resolved',
            description: 'The user\'s issue has been resolved',
            value: 'Issue Resolved',
            emoji: '✅'
          },
          {
            label: 'No Response',
            description: 'User has not responded for an extended period',
            value: 'No Response from User',
            emoji: '⏰'
          },
          {
            label: 'Duplicate Ticket',
            description: 'This is a duplicate of another ticket',
            value: 'Duplicate Ticket',
            emoji: '📋'
          },
          {
            label: 'User Request',
            description: 'User requested to close the ticket',
            value: 'User Request',
            emoji: '👤'
          },
          {
            label: 'Information Provided',
            description: 'Required information has been provided',
            value: 'Information Provided',
            emoji: '📝'
          },
          {
            label: 'Other Reason',
            description: 'Other reason not listed above',
            value: 'Other Reason',
            emoji: '📌'
          },
          {
            label: 'Custom Reason',
            description: 'Provide your own custom reason',
            value: 'Custom Reason',
            emoji: '✏️'
          }
        ]);

      const reasonRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(reasonSelect);

      await interaction.editReply({
        embeds: [reasonEmbed],
        components: [reasonRow]
      });

      // The select menu interaction will be handled by the main interaction handler
      // which will call handleCloseReasonSelection function
      
    } else {
      // Regular users - close immediately with simple confirmation
      const confirmEmbed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('🔒 Close Ticket')
        .setDescription('Are you sure you want to close this ticket?')
        .setFooter({ text: 'This action will close the ticket.' });

      const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_close_${interaction.id}`)
        .setLabel('Yes, Close Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒');

      const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_close_${interaction.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

      const confirmRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(confirmButton, cancelButton);

      await interaction.editReply({
        embeds: [confirmEmbed],
        components: [confirmRow]
      });

      // Wait for confirmation
      try {
        const confirmFilter = (i: any): i is ButtonInteraction => 
          i.isButton() && (i.customId === `confirm_close_${interaction.id}` || i.customId === `cancel_close_${interaction.id}`) && 
          i.user.id === interaction.user.id;

        const confirmResponse = await interaction.followUp({
          content: 'Waiting for confirmation...',
          flags: MessageFlags.Ephemeral,
          fetchReply: true
        });

        const confirmCollector = confirmResponse.createMessageComponentCollector({
          filter: confirmFilter,
          time: 30000, // 30 seconds
          max: 1
        });

        confirmCollector.on('collect', async (confirmInteraction: ButtonInteraction) => {
          try {
            if (confirmInteraction.customId === `confirm_close_${interaction.id}`) {
              await confirmInteraction.update({
                content: '🔒 Closing ticket...',
                embeds: [],
                components: []
              });

              // Process the ticket close
              await processTicketClose(channel, ticket, interaction.user.id, reasonText);
              
              await interaction.editReply({
                content: '✅ Ticket closed successfully!',
                embeds: [],
                components: []
              });

              // Clean up the tracking set after successful close
              recentCloseActions.delete(channelKey);

            } else {
              // Cancel
              await confirmInteraction.update({
                content: '❌ Ticket closure canceled.',
                embeds: [],
                components: []
              });
              
              // Clean up the tracking set after cancellation
              recentCloseActions.delete(channelKey);
            }
          } catch (error) {
            logError('Ticket Close', `Error processing confirmation: ${error}`);
            await confirmInteraction.update({
              content: '❌ An error occurred while closing the ticket.',
              embeds: [],
              components: []
            }).catch(() => {});
            
            // Clean up the tracking set after error
            recentCloseActions.delete(channelKey);
          }
        });

        confirmCollector.on('end', async (collected) => {
          if (collected.size === 0) {
            await interaction.editReply({
              content: '⏰ Confirmation timed out. Ticket closure canceled.',
              embeds: [],
              components: []
            }).catch(() => {});
          }
          // Always clean up the tracking set when collector ends
          recentCloseActions.delete(channelKey);
        });

      } catch (error) {
        logError('Ticket Close', `Error in confirmation: ${error}`);
        await interaction.editReply({
          content: '❌ An error occurred during confirmation.',
          embeds: [],
          components: []
        }).catch(() => {});
        recentCloseActions.delete(channelKey);
      }
    }

  } catch (error) {
    logError('Ticket Close', `Error closing ticket: ${error}`);
    
    // Clean up the recent actions tracker
    recentCloseActions.delete(channelKey);
    
    try {
      await interaction.editReply({
        content: '❌ An error occurred while closing the ticket. Please try again later.'
      });
    } catch (replyError: any) {
      // Don't log "Interaction already acknowledged" errors as they're expected in some cases
      if (replyError.code !== 40060) {
        logError('Ticket Close', `Could not send error message: ${replyError}`);
      }
    }
  }
}

/**
 * Handle close reason selection from select menu
 */
export async function handleCloseReasonSelection(interaction: StringSelectMenuInteraction) {
  const channelKey = `${interaction.channel?.id}_close`;
  
  try {
    // Extract the original interaction ID from the custom ID
    const originalInteractionId = interaction.customId.replace('close_reason_', '');
    const reasonText = interaction.values[0];
    
    // Check if custom reason was selected
    if (reasonText === 'Custom Reason') {
      // Show modal for custom reason
      const modal = new ModalBuilder()
        .setCustomId(`custom-close-modal-${Date.now()}`)
        .setTitle('🔒 Close Ticket - Custom Reason');
      
      // Create the reason input field
      const reasonInput = new TextInputBuilder()
        .setCustomId('custom-close-reason')
        .setLabel('Custom Reason for Closing')
        .setPlaceholder('Please provide a detailed reason for closing this ticket...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
        .setMinLength(3);
      
      // Create action row to hold the input
      const reasonRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
      modal.addComponents(reasonRow);
      
      // Show the modal
      await interaction.showModal(modal);
      
      // Wait for modal submission
      const modalFilter = (i: ModalSubmitInteraction) => 
        i.customId.startsWith('custom-close-modal-') && i.user.id === interaction.user.id;
      
      try {
        const modalSubmission = await interaction.awaitModalSubmit({ filter: modalFilter, time: 300000 });
        
        // Get and validate the custom reason
        const customReason = modalSubmission.fields.getTextInputValue('custom-close-reason');
        
        // Use the validation utility
        const validation = validateReason(customReason);
        if (!validation.isValid) {
          try {
            await modalSubmission.reply({
              content: validation.message!,
              flags: MessageFlags.Ephemeral
            });
          } catch (replyError: any) {
            logError('Ticket Close', `Could not send validation error: ${replyError}`);
          }
          recentCloseActions.delete(channelKey);
          return;
        }
        
        // Defer the modal submission
        try {
          await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (deferError: any) {
          logError('Ticket Close', `Could not defer modal submission: ${deferError}`);
          // Try to reply instead
          try {
            await modalSubmission.reply({
              content: '🔄 Processing ticket closure...',
              flags: MessageFlags.Ephemeral
            });
          } catch (replyError: any) {
            logError('Ticket Close', `Could not reply to modal submission: ${replyError}`);
            recentCloseActions.delete(channelKey);
            return;
          }
        }
        
        const channel = modalSubmission.channel as TextChannel;
        
        // Get ticket info from database
        const ticketStmt = db.prepare(`
          SELECT t.*, u.username 
          FROM tickets t 
          LEFT JOIN users u ON t.user_id = u.user_id 
          WHERE t.channel_id = ?
        `);
        const ticket = ticketStmt.get(channel.id) as any;
        
        if (!ticket) {
          await modalSubmission.editReply({
            content: '❌ This channel is not a valid ticket.'
          });
          recentCloseActions.delete(channelKey);
          return;
        }
        
        // Process the ticket close with custom reason
        await processTicketClose(channel, ticket, modalSubmission.user.id, customReason.trim());
        
        // Send enhanced success message
        await modalSubmission.editReply({
          content: `✅ **Ticket Closed Successfully!**\n\n🎫 **Ticket ID:** #${ticket.ticket_number.toString().padStart(4, '0')}\n📝 **Custom Reason:** ${customReason.trim()}\n👤 **Closed by:** ${modalSubmission.user.username}\n\n🔒 The ticket has been closed and a transcript has been sent.`
        });
        
        // Clean up tracking set after successful close
        recentCloseActions.delete(channelKey);
        
        logInfo('Ticket Close', `Ticket #${ticket.ticket_number} closed by ${modalSubmission.user.tag} with custom reason: ${customReason.trim()}`);
        
      } catch (modalError: any) {
        // Modal timed out or error occurred
        logError('Ticket Close', `Custom reason modal error: ${modalError}`);
        
        // Clean up tracking set
        recentCloseActions.delete(channelKey);
        
        // Check error type and log appropriately
        if (modalError.code === 'InteractionCollectorError' || modalError.message?.includes('time')) {
          logInfo('Ticket Close', `Custom reason modal timed out for ${interaction.user.tag} - no action taken`);
        } else if (modalError.code === 10062) {
          logError('Ticket Close', `Unknown interaction error - custom reason modal may have expired`);
        } else {
          logError('Ticket Close', `Unexpected custom reason modal error: ${modalError.message}`);
        }
      }
      
    } else {
      // Handle predefined reasons
      // Update the select menu interaction
      await interaction.update({
        content: `🔒 Closing ticket with reason: **${reasonText}**`,
        embeds: [],
        components: []
      });
      
      const channel = interaction.channel as TextChannel;
      
      // Get ticket info from database
      const ticketStmt = db.prepare(`
        SELECT t.*, u.username 
        FROM tickets t 
        LEFT JOIN users u ON t.user_id = u.user_id 
        WHERE t.channel_id = ?
      `);
      const ticket = ticketStmt.get(channel.id) as any;
      
      if (!ticket) {
        await interaction.followUp({
          content: '❌ This channel is not a valid ticket.',
          flags: MessageFlags.Ephemeral
        });
        // Clean up tracking set
        recentCloseActions.delete(channelKey);
        return;
      }
      
      // Process the ticket close
      await processTicketClose(channel, ticket, interaction.user.id, reasonText);
      
      // Send enhanced success message
      await interaction.followUp({
        content: `✅ **Ticket Closed Successfully!**\n\n🎫 **Ticket ID:** #${ticket.ticket_number.toString().padStart(4, '0')}\n📝 **Reason:** ${reasonText}\n👤 **Closed by:** ${interaction.user.username}\n\n🔒 The ticket has been closed and a transcript has been sent.`,
        flags: MessageFlags.Ephemeral
      });
      
      // Clean up tracking set after successful close
      recentCloseActions.delete(channelKey);
      
      logInfo('Ticket Close', `Ticket #${ticket.ticket_number} closed by ${interaction.user.tag} with reason: ${reasonText}`);
    }
    
  } catch (error) {
    logError('Ticket Close', `Error handling close reason selection: ${error}`);
    
    // Clean up tracking set after error
    recentCloseActions.delete(channelKey);
    
    try {
      await interaction.followUp({
        content: '❌ An error occurred while closing the ticket.',
        flags: MessageFlags.Ephemeral
      });
    } catch (followUpError) {
      logError('Ticket Close', `Could not send error follow-up: ${followUpError}`);
    }
  }
}
