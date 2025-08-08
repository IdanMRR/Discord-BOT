import { ButtonInteraction, TextChannel, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChannelType, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction, ButtonBuilder, ButtonStyle } from 'discord.js';
import { db } from '../../database/sqlite';
import { logTicketEvent } from '../../utils/databaseLogger';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { saveAndSendTranscript } from './ticket-transcript';
import { createRatingButton } from './ticket-rating';

// Create a map to track recent actions to prevent duplicates
const recentActions = new Map<string, number>();

// Helper function to check if an action was recently performed
function wasActionRecentlyPerformed(key: string, action: string, timeWindowMs: number = 30000): boolean {
  const actionKey = `${key}_${action}`;
  const lastActionTime = recentActions.get(actionKey);
  
  if (lastActionTime && (Date.now() - lastActionTime) < timeWindowMs) {
    return true;
  }
  
  // Mark this action as performed
  recentActions.set(actionKey, Date.now());
  return false;
}

// Helper function to validate reason input
function validateReason(reason: string): { isValid: boolean; message?: string } {
  if (!reason || reason.trim().length === 0) {
    return { isValid: false, message: 'Reason cannot be empty. Please provide a valid reason.' };
  }
  
  if (reason.trim().length < 3) {
    return { isValid: false, message: 'Reason must be at least 3 characters long.' };
  }
  
  if (reason.length > 1000) {
    return { isValid: false, message: 'Reason cannot exceed 1000 characters.' };
  }
  
  return { isValid: true };
}

/**
 * Handle the ticket deletion process
 */
export async function handleDeleteTicket(interaction: ButtonInteraction) {
  try {
    // Check if interaction has already been replied to (not just deferred)
    if (interaction.replied) {
      logInfo('Ticket Delete', `Interaction already replied for ticket delete by ${interaction.user.tag}`);
      return;
    }

    const channel = interaction.channel as TextChannel;
    
    // Get ticket info from database
    const ticketStmt = db.prepare(`SELECT * FROM tickets WHERE channel_id = ?`);
    const ticket = ticketStmt.get(channel.id) as any;
    
    if (!ticket) {
      await interaction.editReply({
        content: 'This channel is not a valid ticket.'
      });
      return;
    }
    
    // Check for duplicate action early
    const actionKey = `${ticket.guild_id}_${ticket.ticket_number}`;
    if (wasActionRecentlyPerformed(actionKey, 'delete')) {
      logInfo('Ticket Delete', `Ticket #${ticket.ticket_number} delete action was recently triggered. Preventing duplicate action.`);
      await interaction.editReply({
        content: 'This ticket is already being deleted. Please wait...'
      });
      return;
    }
    
    // The main handler already deferred this interaction
    
    // Update the ticket status in the database
    const updateStmt = db.prepare(`
      UPDATE tickets SET status = 'deleted', closed_at = CURRENT_TIMESTAMP, closed_by = ? WHERE channel_id = ?
    `);
    updateStmt.run(interaction.user.id, channel.id);
    
    // Generate a transcript of the ticket before deletion
    logInfo('Ticket Delete', `Generating transcript for ticket #${ticket.ticket_number} before deletion`);
    
    // Generate and send the transcript using our function - specify that we're deleting
    await saveAndSendTranscript(channel, interaction.user, 'Ticket deleted by staff', true);
    
    // Send rating DM to ticket creator when ticket is deleted
    try {
      const client = channel.client;
      const ticketCreator = await client.users.fetch(ticket.user_id);
      
      if (ticketCreator) {
        const ratingEmbed = new EmbedBuilder()
          .setColor(Colors.PRIMARY)
          .setTitle('⭐ Rate Your Support Experience')
          .setDescription('Your ticket has been deleted. We value your feedback! Please rate your support experience to help us improve our service.')
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
          logError('Ticket Delete', `Could not send rating DM to ticket creator ${ticketCreator.tag}`);
        });
      }
    } catch (error) {
      logError('Ticket Delete', `Could not send rating notification to ticket creator: ${error}`);
    }
    
    // Send a deletion embed to the channel before it's deleted
    try {
      const deleteEmbed = new EmbedBuilder()
        .setColor(0x5865F2) // Discord blue/purple color for delete
        .setTitle('🗑️ Ticket Scheduled for Deletion')
        .setDescription(`This ticket is being permanently deleted by <@${interaction.user.id}>.`)
        .addFields([
          { name: '📝 Reason', value: 'Staff Decision', inline: false },
          { name: '🎫 Ticket ID', value: `#${ticket.ticket_number.toString().padStart(4, '0')}`, inline: true },
          { name: '👤 Deleted By', value: `<@${interaction.user.id}>`, inline: true },
          { name: '⚠️ Warning', value: 'This channel will be deleted in a few seconds. This action cannot be undone.', inline: false }
        ])
        .setFooter({ text: `Deleted via Discord • Made by Soggra` })
        .setTimestamp();
      
      await channel.send({ embeds: [deleteEmbed] });
    } catch (embedError) {
      logError('Ticket Delete', `Error sending deletion embed: ${embedError}`);
    }
    
    // Log the ticket deletion
    if (!wasActionRecentlyPerformed(actionKey, 'log_delete')) {
      await logTicketEvent({
        guildId: interaction.guildId!,
        actionType: 'ticketDelete',
        userId: interaction.user.id,
        channelId: channel.id,
        ticketNumber: ticket.ticket_number,
        closedBy: interaction.user.id
      });
    }
    
    // Wait a moment before deleting the channel to ensure logs are sent
    setTimeout(async () => {
      try {
        await channel.delete('Ticket deleted by staff');
        logInfo('Ticket Delete', `Deleted ticket channel #${ticket.ticket_number}`);
      } catch (deleteError) {
        logError('Ticket Delete', `Error deleting channel: ${deleteError}`);
      }
    }, 3000); // Increased to 3 seconds to ensure embed is visible
    
    // Send success message
    await interaction.editReply({
      content: '✅ Ticket will be permanently deleted. Transcript has been sent to the user and logs.'
    });
    
  } catch (error) {
    logError('Ticket Delete', `Error handling delete ticket: ${error}`);
    
    try {
      await interaction.editReply({
        content: 'An error occurred while deleting the ticket. Please try again later.'
      });
    } catch (replyError) {
      // If we can't reply, just log it
      logError('Ticket Delete', `Error replying to interaction: ${replyError}`);
    }
  }
}

/**
 * Handle the ticket reopening process with reason modal
 */
export async function handleReopenTicket(interaction: ButtonInteraction) {
  const channelKey = `${interaction.channel?.id}_reopen`;
  
  try {
    // Check if interaction has already been replied to
    if (interaction.replied) {
      logInfo('Ticket Reopen', `Interaction already replied for ticket reopen by ${interaction.user.tag}`);
      return;
    }

    // Check for recent action to prevent spam (per-channel, not per-user)
    if (wasActionRecentlyPerformed(channelKey, 'reopen', 60000)) { // 1 minute cooldown
      await interaction.reply({
        content: '⏳ A reopen request is already being processed for this ticket. Please wait...',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const channel = interaction.channel as TextChannel;
    
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'This action can only be performed in a ticket channel.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Check if the user has permission to reopen tickets
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const isStaff = member?.permissions.has(PermissionFlagsBits.ManageChannels);
    
    // Get the ticket from the database
    const ticketStmt = db.prepare(`
      SELECT * FROM tickets WHERE channel_id = ? AND status = 'closed'
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
      await interaction.reply({
        content: 'No closed ticket found in this channel.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Check if the user is the ticket creator or has staff permissions
    if (ticket.user_id !== interaction.user.id && !isStaff) {
      await interaction.reply({
        content: 'Only the ticket creator or server staff can reopen this ticket.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Create modal for reopen reason
    const modal = new ModalBuilder()
      .setCustomId(`reopen-modal-${ticket.ticket_number}-${Date.now()}`)
      .setTitle(`Reopen Ticket #${ticket.ticket_number.toString().padStart(4, '0')}`);
    
    // Create the reason input field
    const reasonInput = new TextInputBuilder()
      .setCustomId('reopen-reason')
      .setLabel('Reason for Reopening')
      .setPlaceholder('Please provide a reason for reopening this ticket...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000)
      .setMinLength(3);
    
    // Create action row to hold the input
    const reasonRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(reasonRow);
    
    // Show the modal directly
    await interaction.showModal(modal);
    
    // Wait for modal submission
    const modalFilter = (i: ModalSubmitInteraction) => 
      i.customId.startsWith(`reopen-modal-${ticket.ticket_number}`) && i.user.id === interaction.user.id;
    
    try {
      const modalSubmission = await interaction.awaitModalSubmit({ filter: modalFilter, time: 300000 });
      
      // Get and validate the reason
      const reason = modalSubmission.fields.getTextInputValue('reopen-reason');
      const validation = validateReason(reason);
      
      if (!validation.isValid) {
        try {
          await modalSubmission.reply({
            content: validation.message!,
            flags: MessageFlags.Ephemeral
          });
        } catch (replyError: any) {
          logError('Ticket Reopen', `Could not send validation error: ${replyError}`);
        }
        return;
      }

      // Defer the modal submission
      try {
        await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
      } catch (deferError: any) {
        logError('Ticket Reopen', `Could not defer modal submission: ${deferError}`);
        // Try to reply instead
        try {
          await modalSubmission.reply({
            content: '🔄 Processing ticket reopen...',
            flags: MessageFlags.Ephemeral
          });
        } catch (replyError: any) {
          logError('Ticket Reopen', `Could not reply to modal submission: ${replyError}`);
          return;
        }
      }
      
      // Process the reopen with the provided reason
      await processTicketReopen(ticket, channel, interaction.user.id, reason.trim(), modalSubmission);
      
    } catch (error: any) {
      logError('Ticket Reopen', `Modal timeout or error: ${error}`);
      
      // Clean up tracking set
      recentActions.delete(channelKey);
      
      // Check if it's a timeout error
      if (error.code === 'InteractionCollectorError' || error.message?.includes('time')) {
        logInfo('Ticket Reopen', `Modal timed out for ${interaction.user.tag} - no action taken`);
      } else if (error.code === 10062) {
        logError('Ticket Reopen', `Unknown interaction error - modal may have expired`);
      } else {
        logError('Ticket Reopen', `Unexpected modal error: ${error.message}`);
      }
    }
    
  } catch (error) {
    logError('Ticket Reopen', `Error handling reopen ticket: ${error}`);
    
    try {
      await interaction.editReply({
        content: 'An error occurred while reopening the ticket. Please try again later or contact a staff member.',
        components: []
      });
    } catch (replyError) {
      logError('Ticket Reopen', `Failed to send error message: ${replyError}`);
    }
  }
}

/**
 * Process the actual ticket reopening with validated reason
 */
async function processTicketReopen(ticket: any, channel: TextChannel, userId: string, reason: string, interaction: ModalSubmitInteraction) {
  try {
    // Update the ticket status in the database
    const updateStmt = db.prepare(`
      UPDATE tickets SET status = 'open', closed_at = NULL, closed_by = NULL WHERE channel_id = ?
    `);
    updateStmt.run(channel.id);
    
    // Update permissions to allow the user to send messages again
    await channel.permissionOverwrites.edit(ticket.user_id, {
      SendMessages: true
    });
    
    // Format the current date and time
    const now = new Date();
    const formattedTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    
    // Create a reopened ticket embed (matching website style)
    const reopenedEmbed = new EmbedBuilder()
      .setColor(0x00ff00) // Green color like website
      .setTitle('🔓 Ticket Reopened')
      .setDescription(`This ticket has been reopened by <@${userId}>.`)
      .addFields([
        { name: '📝 Reason', value: reason, inline: false },
        { name: '🎫 Ticket ID', value: `#${ticket.ticket_number.toString().padStart(4, '0')}`, inline: true },
        { name: '👤 Reopened By', value: `<@${userId}>`, inline: true },
        { name: '📅 Reopened At', value: formattedDate, inline: true },
        { name: '📊 Status', value: 'This ticket is now **OPEN** and accepting messages.', inline: false },
        { name: '⚙️ Actions', value: 'You can continue the conversation. The ticket can be closed again when the issue is resolved.', inline: false }
      ])
      .setFooter({ text: `Reopened via Discord • Made by Soggra` })
      .setTimestamp();
    
    // Send the reopened embed to the channel
    await channel.send({ embeds: [reopenedEmbed] });
    
    // Log ticket reopen event to database and channel
    await logTicketEvent({
      guildId: channel.guildId,
      actionType: 'ticketReopen',
      userId: userId,
      channelId: channel.id,
      ticketNumber: ticket.ticket_number
    });
    
    // Reply to the user with notification
    await interaction.editReply({
      content: `✅ **Ticket Reopened Successfully!**\n\n🎫 **Ticket ID:** #${ticket.ticket_number.toString().padStart(4, '0')}\n📝 **Reason:** ${reason}\n👤 **Reopened by:** ${interaction.user.username}\n\n🔓 The ticket is now **OPEN** and accepting messages.`
    });
    
    // Also send a channel notification
    try {
      const notificationEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Ticket Action Completed')
        .setDescription(`Ticket has been reopened by ${interaction.user.username}`)
        .addFields([
          { name: '📝 Reason', value: reason, inline: false },
          { name: '⏰ Reopened At', value: new Date().toLocaleString(), inline: true }
        ])
        .setFooter({ text: 'Ticket System' })
        .setTimestamp();
        
      await channel.send({ 
        content: `🔔 **Notification:** <@${ticket.user_id}>`,
        embeds: [notificationEmbed] 
      });
    } catch (notifError) {
      logError('Ticket Reopen', `Could not send channel notification: ${notifError}`);
    }
    
    // Try to send a DM to the ticket creator
    try {
      const ticketCreator = await channel.client.users.fetch(ticket.user_id);
      
      if (ticketCreator && ticketCreator.id !== userId) {
        const dmEmbed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle(`🔓 Your Ticket Has Been Reopened | #${ticket.ticket_number.toString().padStart(4, '0')}`)
          .setDescription(`Your ticket in ${channel.guild.name} has been reopened.`)
          .addFields([
            { name: '📝 Reason', value: reason, inline: false },
            { name: '👤 Reopened By', value: interaction.user.username, inline: true },
            { name: '🕒 Reopened On', value: formattedDate, inline: true }
          ])
          .setFooter({ text: `Made by Soggra. • ${formattedTime}` });
        
        await ticketCreator.send({ embeds: [dmEmbed] });
      }
    } catch (error) {
      logError('Ticket Reopen', `Could not send DM to ticket creator: ${error}`);
    }
    
    logInfo('Ticket Reopen', `Ticket #${ticket.ticket_number} reopened by ${interaction.user.tag} with reason: ${reason}`);
    
  } catch (error) {
    logError('Ticket Reopen', `Error processing reopen: ${error}`);
    await interaction.editReply({
      content: '❌ An error occurred while processing the reopen. Please try again later.'
    });
  }
}
