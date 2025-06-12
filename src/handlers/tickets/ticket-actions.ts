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
    
    // Wait a moment before deleting the channel to ensure logs are sent
    setTimeout(async () => {
      try {
        await channel.delete('Ticket deleted by staff');
        logInfo('Ticket Delete', `Deleted ticket channel #${ticket.ticket_number}`);
      } catch (deleteError) {
        logError('Ticket Delete', `Error deleting channel: ${deleteError}`);
      }
    }, 2000);
    
    // Send success message
    await interaction.editReply({
      content: '✅ Ticket deleted successfully. The channel will be removed shortly.'
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
 * Handle the ticket reopening process
 */
export async function handleReopenTicket(interaction: ButtonInteraction) {
  try {
    // Check if interaction has already been replied to
    if (interaction.replied) {
      logInfo('Ticket Reopen', `Interaction already replied for ticket reopen by ${interaction.user.tag}`);
      return;
    }

    // The main handler already deferred this interaction
    const channel = interaction.channel as TextChannel;
    
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply({
        content: 'This action can only be performed in a ticket channel.'
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
      await interaction.editReply({
        content: 'No closed ticket found in this channel.'
      });
      return;
    }
    
    // Check if the user is the ticket creator or has staff permissions
    if (ticket.user_id !== interaction.user.id && !isStaff) {
      await interaction.editReply({
        content: 'Only the ticket creator or server staff can reopen this ticket.'
      });
      return;
    }
    
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
      content: `✅ Ticket #${ticket.ticket_number.toString().padStart(4, '0')} has been successfully reopened.`
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
      await interaction.editReply({
        content: 'An error occurred while reopening the ticket. Please try again later or contact a staff member.'
      });
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
    
    return false;
  }
}
