import { ButtonInteraction, TextChannel, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChannelType, AttachmentBuilder } from 'discord.js';
import { db } from '../../database/sqlite';
import { logTicketEvent } from '../../utils/databaseLogger';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { saveAndSendTranscript } from './ticket-transcript';
import { formatIsraeliDate, formatIsraeliTime } from '../../utils/time-formatter';

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
    
    // Defer the reply to give us time to process
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    // Update the ticket status in the database
    const updateStmt = db.prepare(`
      UPDATE tickets SET status = 'deleted', closed_at = CURRENT_TIMESTAMP, closed_by = ? WHERE channel_id = ?
    `);
    updateStmt.run(interaction.user.id, channel.id);
    
    // Generate a transcript of the ticket before deletion
    logInfo('Ticket Delete', `Generating transcript for ticket #${ticket.ticket_number} before deletion`);
    
    // Generate and send the transcript using our new function
    await saveAndSendTranscript(channel, interaction.user, 'Ticket deleted by staff');
    
    // Also send a message to the staff member who deleted the ticket
    try {
      await interaction.user.send({
        content: `📄 Ticket #${ticket.ticket_number.toString().padStart(4, '0')} has been deleted and a transcript has been saved.`
      });
    } catch (error) {
      logError('Ticket Delete', `Could not send notification to staff member: ${error}`);
    }
    
    // Log the ticket deletion
    await logTicketEvent({
      guildId: interaction.guildId!,
      actionType: 'ticketDelete',
      userId: interaction.user.id,
      channelId: channel.id,
      ticketNumber: ticket.ticket_number,
      closedBy: interaction.user.id
    });
    
    // Reply to the user before deleting the channel
    await interaction.editReply({
      content: `Ticket #${ticket.ticket_number.toString().padStart(4, '0')} has been successfully deleted. A transcript has been saved.`
    });
    
    // We no longer send a DM to the ticket creator when a ticket is deleted
    // This is intentional as per user requirements
    
    // Wait a moment before deleting the channel to ensure the reply is sent
    setTimeout(async () => {
      try {
        await channel.delete(`Ticket #${ticket.ticket_number} deleted by ${interaction.user.tag}`);
      } catch (error) {
        console.error('Error deleting ticket channel:', error);
      }
    }, 2000);
    
    return true;
  } catch (error) {
    console.error('Error deleting ticket:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'אירעה שגיאה במחיקת הטיקט. אנא נסה שוב מאוחר יותר.'
      });
    } else {
      await interaction.reply({
        content: 'אירעה שגיאה במחיקת הטיקט. אנא נסה שוב מאוחר יותר.',
        flags: MessageFlags.Ephemeral
      });
    }
    
    return false;
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
    
    // Format the current time in Israeli format using the utility
    const now = new Date();
    const formattedTime = formatIsraeliTime(now);
    const formattedDate = formatIsraeliDate(now);
    
    // Create a reopened ticket embed
    const reopenedEmbed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle('🔓 Ticket Reopened')
      .setDescription(`This ticket has been reopened by ${interaction.user}`)
      .addFields([
        { name: '📋 Ticket Number', value: `#${ticket.ticket_number.toString().padStart(4, '0')}`, inline: true },
        { name: '🕒 Reopened On', value: formattedDate, inline: true },
        { name: '👤 Reopened By', value: `${interaction.user.username} (${interaction.user.id})`, inline: true }
      ])
      .setFooter({ text: `Coded by IdanMR • Today at ${formattedTime}` });
    
    // Send the reopened embed to the channel
    await channel.send({ embeds: [reopenedEmbed] });
    
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
          .setFooter({ text: `Coded by IdanMR • Today at ${formattedTime}` });
        
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
