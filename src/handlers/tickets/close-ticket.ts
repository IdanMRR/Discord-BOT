import { ButtonInteraction, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageComponentInteraction, PermissionFlagsBits, MessageFlags, ChannelType, AttachmentBuilder } from 'discord.js';
import { replyEphemeral, convertEphemeralToFlags } from '../../utils/interaction-utils';
import { db } from '../../database/sqlite';
import { logTicketEvent } from '../../utils/databaseLogger';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { createRatingButton } from './ticket-rating';
import { saveAndSendTranscript } from './ticket-transcript';

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
    
    // Update the ticket status in the database
    const updateStmt = db.prepare(`
      UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ? WHERE channel_id = ?
    `);
    updateStmt.run(interaction.user.id, channel.id);
    
    // Generate and send a transcript of the ticket
    logInfo('Ticket Close', `Generating transcript for ticket #${ticket.ticket_number}`);
    
    // Generate and send the transcript using our new function
    await saveAndSendTranscript(channel, interaction.user, reasonText);
    
    // Send a message to the ticket channel that it's being closed
    await channel.send({
      content: `📄 Ticket is being closed. A transcript has been generated.`
    });
    
    // Format the current time
    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    const formattedTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
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
    
    // Create rating button
    const ratingButton = createRatingButton(ticket.ticket_number);
    
    const deleteRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(reopenButton, deleteButton);
    
    const ratingRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(ratingButton);
    
    await channel.send({ 
      content: 'The ticket has been closed. You can delete the ticket or reopen it using the buttons below.',
      components: [deleteRow]
    });
    
    // Send a message to the ticket creator asking for feedback
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
        
        await ticketCreator.send({ 
          embeds: [ratingEmbed],
          components: [ratingRow]
        }).catch(() => {
          // If we can't DM the user, send the rating message in the channel
          channel.send({
            content: `${ticketCreator}, please rate your support experience:`,
            embeds: [ratingEmbed],
            components: [ratingRow]
          }).catch(err => console.error('Could not send rating message:', err));
        });
      }
    } catch (error) {
      console.error('Could not send rating request to ticket creator:', error);
    }
    
    // Update permissions to prevent the user from sending messages
    await channel.permissionOverwrites.edit(ticket.user_id, {
      SendMessages: false
    });
    
    // Log the ticket closure
    await logTicketEvent({
      guildId: interaction.guildId!,
      actionType: 'ticketClose',
      userId: interaction.user.id,
      channelId: channel.id,
      ticketNumber: ticket.ticket_number,
      closedBy: interaction.user.id
    });
    
    // Try to send a DM to the ticket creator
    try {
      const ticketCreator = await interaction.client.users.fetch(ticket.user_id);
      
      if (ticketCreator) {
        const dmEmbed = new EmbedBuilder()
          .setColor(Colors.WARNING)
          .setTitle(`🔒 Your Ticket Has Been Closed | #${ticket.ticket_number.toString().padStart(4, '0')}`)
          .setDescription(`Your ticket in ${interaction.guild!.name} has been closed by ${interaction.user.username}.`)
          .addFields([
            { name: '📋 Ticket Number', value: `#${ticket.ticket_number.toString().padStart(4, '0')}`, inline: true },
            { name: '🕒 Closed On', value: formattedDate, inline: true }
          ])
          .setFooter({ text: `Coded by IdanMR • Today at ${formattedTime}` });
        
        await ticketCreator.send({ embeds: [dmEmbed] });
      }
    } catch (error) {
      console.error('Could not send DM to ticket creator:', error);
    }
  } catch (error) {
    logError('Ticket Close', `Error processing ticket close: ${error}`);
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
    
    // Create confirmation buttons
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_close_ticket')
      .setLabel('Confirm Close')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('✅');
    
    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_close_ticket')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌');
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(confirmButton, cancelButton);
    
    // Ask for confirmation
    await interaction.editReply({
      content: 'Are you sure you want to close this ticket?',
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
      
      // Create a reason modal
      const reasonModal = new ModalBuilder()
        .setCustomId('close_ticket_reason_modal')
        .setTitle('Ticket Closure Reason');
      
      const reasonInput = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Why are you closing this ticket?')
        .setPlaceholder('Enter a reason for closing this ticket...')
        .setRequired(false)
        .setStyle(TextInputStyle.Paragraph);
      
      const reasonRow = new ActionRowBuilder<TextInputBuilder>()
        .addComponents(reasonInput);
      
      reasonModal.addComponents(reasonRow);
      
      // We'll use this flag to track if we showed the modal successfully
      let modalShown = false;
      let reasonText = 'No reason provided';
      
      try {
        // Try to show the modal - we need to use a new collector instead of reusing the confirmation
        const message = await interaction.channel?.messages.fetch(confirmation.message.id);
        if (message) {
          // Create a new collector for button interactions on this message
          const collector = message.createMessageComponentCollector({ 
            filter: i => i.user.id === interaction.user.id,
            time: 1000, // Very short timeout since we just want to hijack the next interaction
            max: 1 // Only collect one interaction
          });
          
          collector.on('collect', async (i) => {
            try {
              // Show the modal on this fresh interaction
              await i.showModal(reasonModal);
              modalShown = true;
              
              // Wait for the modal submission
              try {
                const modalSubmission = await i.awaitModalSubmit({
                  filter: sub => sub.customId === 'close_ticket_reason_modal' && sub.user.id === interaction.user.id,
                  time: 60000
                }).catch(() => null);
                
                if (modalSubmission) {
                  reasonText = modalSubmission.fields.getTextInputValue('close_reason') || 'No reason provided';
                  await modalSubmission.deferUpdate().catch(() => {});
                }
              } catch (modalTimeoutError) {
                logError('Ticket Close', `Modal submission timed out: ${modalTimeoutError}`);
              }
              
              // Process the ticket close with the provided reason
              await processTicketClose(interaction, ticket, i, reasonText);
            } catch (modalError) {
              logError('Ticket Close', `Error showing modal: ${modalError}`);
              await processTicketClose(interaction, ticket, i, 'No reason provided');
            }
          });
          
          // Send a temporary message to trigger a new interaction
          // Cast channel to TextChannel to ensure it has the send method
          const tempMsg = await (interaction.channel as TextChannel)?.send({ 
            content: 'Please provide a reason for closing this ticket...',
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('provide_reason')
                .setLabel('Provide Reason')
                .setStyle(ButtonStyle.Primary)
            )]
          });
          
          // Set a timeout to delete the temporary message and proceed without a reason if no interaction
          setTimeout(async () => {
            if (!modalShown) {
              if (tempMsg) await tempMsg.delete().catch(() => {});
              await processTicketClose(interaction, ticket, confirmation, reasonText);
            }
          }, 5000);
        } else {
          // If we can't find the message, proceed without a reason
          await processTicketClose(interaction, ticket, confirmation, reasonText);
        }
      } catch (modalError) {
        // If we can't show the modal, continue without a reason
        logError('Ticket Close', `Could not set up reason collection: ${modalError}`);
        await processTicketClose(interaction, ticket, confirmation, reasonText);
      }
    } catch (error) {
      // Confirmation timed out or errored
      logError('Ticket Close', `Error in ticket close confirmation: ${error}`);
      
      try {
        await interaction.editReply({
          content: 'פעולת סגירת הטיקט בוטלה או נכשלה.',
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
