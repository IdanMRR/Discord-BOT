import { ButtonInteraction, TextChannel, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChannelType, AttachmentBuilder } from 'discord.js';
import { db } from '../../database/sqlite';
import { logTicketEvent } from '../../utils/databaseLogger';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { saveAndSendTranscript } from './ticket-transcript';

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

/**
 * Handle the ticket deletion process
 */
export async function handleDeleteTicket(interaction: ButtonInteraction) {
  try {
    // Check if the channel is a ticket channel
    const channel = interaction.channel as TextChannel;
    
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: 'This action can only be performed in a ticket channel.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Check if the user has permission to delete tickets (only staff can delete)
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const isStaff = member?.permissions.has(PermissionFlagsBits.ManageChannels);
    
    if (!isStaff) {
      await interaction.reply({
        content: 'Only server staff can delete tickets.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Get the ticket from the database
    const ticketStmt = db.prepare(`
      SELECT * FROM tickets WHERE channel_id = ?
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
        content: 'No ticket found in this channel.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Check if this ticket was recently acted upon to prevent duplicate actions
    const actionKey = `${ticket.guild_id}_${ticket.ticket_number}`;
    if (wasActionRecentlyPerformed(actionKey, 'delete')) {
      logInfo('Ticket Delete', `Ticket #${ticket.ticket_number} delete action was recently triggered. Preventing duplicate action.`);
      await interaction.reply({
        content: 'This ticket is already being deleted. Please wait...',
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    
    // Defer the reply to give us time to process
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    // Update the ticket status in the database
    const updateStmt = db.prepare(`
      UPDATE tickets SET status = 'deleted', closed_at = CURRENT_TIMESTAMP, closed_by = ? WHERE channel_id = ?
    `);
    updateStmt.run(interaction.user.id, channel.id);
    
    // Generate a transcript of the ticket before deletion
    logInfo('Ticket Delete', `Generating transcript for ticket #${ticket.ticket_number} before deletion`);
    
    // Generate and send the transcript using our function - specify that we're deleting
    await saveAndSendTranscript(channel, interaction.user, 'Ticket deleted by staff', true);
    
    // We no longer send a notification to the staff member who deleted the ticket
    // as per user requirements
    
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
    
    // Create a styled confirmation embed
    const deleteEmbed = new EmbedBuilder()
      .setColor(Colors.ERROR)
      .setTitle('🗑️ Ticket Deleted')
      .setDescription(`Ticket #${ticket.ticket_number.toString().padStart(4, '0')} has been successfully deleted.`)
      .addFields([
        { name: '📋 Information', value: 'A transcript has been saved to the logs channel.' },
        { name: '⏱️ Status', value: 'This channel will be deleted in a few seconds.' }
      ])
      .setFooter({ text: `Made by Soggra. • Deleted by ${interaction.user.username}` })
      .setTimestamp();
    
    // Reply to the user with the styled embed before deleting the channel
    await interaction.editReply({
      embeds: [deleteEmbed]
    });
    
    // Wait a short time to let the user see the message before deletion
    setTimeout(async () => {
      try {
        await channel.delete(`Ticket #${ticket.ticket_number} deleted by ${interaction.user.tag}`);
      } catch (deleteError) {
        logError('Ticket Delete', `Error deleting channel: ${deleteError}`);
        // Clear the action from the recent actions in case we need to retry
        recentActions.delete(`${actionKey}_delete`);
        recentActions.delete(`${actionKey}_log_delete`);
      }
    }, 5000);
  } catch (error) {
    logError('Ticket Delete', `Error handling delete ticket: ${error}`);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred while deleting the ticket. Please try again or contact a server administrator.'
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while deleting the ticket. Please try again or contact a server administrator.',
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (replyError) {
      logError('Ticket Delete', `Error replying to interaction: ${replyError}`);
    }
  }
}

/**
 * Handle the ticket reopening process
 */
export async function handleReopenTicket(interaction: ButtonInteraction) {
  try {
    // Check if the channel is a ticket channel
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
    
    // Defer the reply to give us time to process
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
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
    
    // Create a reopened ticket embed
    const reopenedEmbed = new EmbedBuilder()
      .setColor('#57F287') // Green color like in the screenshot
      .setTitle('🔓 Ticket Reopened')
      .setDescription(`This ticket has been reopened by ${interaction.user.tag}.`)
      .addFields([
        { name: '📝 Reason', value: 'User Request', inline: false },
        { name: '⚙️ Actions', value: 'You can now continue the conversation in this ticket.', inline: false }
      ])
      .setFooter({ text: `Made by Soggra • Ticket #${ticket.ticket_number.toString().padStart(4, '0')} • Today at ${formattedTime}` })
      .setTimestamp();
    
    // Send the reopened embed to the channel
    await channel.send({ embeds: [reopenedEmbed] });
    
    // Log ticket reopen event to database and channel
    await logTicketEvent({
      guildId: interaction.guildId!,
      actionType: 'ticketReopen',
      userId: interaction.user.id,
      channelId: channel.id,
      ticketNumber: ticket.ticket_number
    });
    
    // Reply to the user
    await interaction.editReply({
      content: `Ticket #${ticket.ticket_number.toString().padStart(4, '0')} has been successfully reopened.`
    });
    
    // Try to send a DM to the ticket creator
    try {
      const ticketCreator = await interaction.client.users.fetch(ticket.user_id);
      
      if (ticketCreator && ticketCreator.id !== interaction.user.id) {
        const dmEmbed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle(`🔓 Your Ticket Has Been Reopened | #${ticket.ticket_number.toString().padStart(4, '0')}`)
          .setDescription(`Your ticket in ${interaction.guild!.name} has been reopened by ${interaction.user.username}.`)
          .addFields([
            { name: '📋 Ticket Number', value: `#${ticket.ticket_number.toString().padStart(4, '0')}`, inline: true },
            { name: '🕒 Reopened On', value: formattedDate, inline: true }
          ])
          .setFooter({ text: `Made by Soggra. • ${formattedTime}` });
        
        await ticketCreator.send({ embeds: [dmEmbed] });
      }
    } catch (error) {
      console.error('Could not send DM to ticket creator:', error);
    }
    
    return true;
  } catch (error) {
    console.error('Error reopening ticket:', error);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred while reopening the ticket. Please try again later or contact a staff member.'
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while reopening the ticket. Please try again later or contact a staff member.',
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
    
    return false;
  }
}
