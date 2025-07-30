import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  MessageFlags, 
  EmbedBuilder,
  TextChannel,
  ChannelType
} from 'discord.js';
import { Colors, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { db } from '../../database/sqlite';
import { logTicketEvent } from '../../utils/databaseLogger';
import { updateTicketEmbed } from '../../handlers/tickets/ticket-handler';
import { logError, logInfo } from '../../utils/logger';

const statusOptions = [
  {
    name: 'open',
    value: 'open',
    description: 'The ticket is open and waiting for staff attention',
    emoji: '🟢',
    color: Colors.SUCCESS
  },
  {
    name: 'in_progress',
    value: 'in_progress',
    description: 'The ticket is being actively worked on by staff',
    emoji: '🔵',
    color: Colors.PRIMARY
  },
  {
    name: 'on_hold',
    value: 'on_hold',
    description: 'The ticket is temporarily on hold',
    emoji: '🟠',
    color: Colors.WARNING
  },
  {
    name: 'closed',
    value: 'closed',
    description: 'The ticket has been resolved and closed',
    emoji: '🔴',
    color: Colors.ERROR
  }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-status')
    .setDescription('Change the status of the current ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option => 
      option
        .setName('status')
        .setDescription('The new status for the ticket')
        .setRequired(true)
        .addChoices(
          { name: '🟢 Open', value: 'open' },
          { name: '🔵 In Progress', value: 'in_progress' },
          { name: '🟠 On Hold', value: 'on_hold' },
          { name: '🔴 Closed', value: 'closed' }
        )
    )
    .addStringOption(option => 
      option
        .setName('reason')
        .setDescription('Reason for changing the ticket status')
        .setRequired(false)
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
            // Check if user has permission
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        const errorEmbed = createErrorEmbed(
          'Missing Permissions', 
          'You do not have permission to change ticket status in this server.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Verify the command is being used in a ticket channel
      if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText || 
          !interaction.channel.name.toLowerCase().includes('ticket-')) {
        const errorEmbed = createErrorEmbed(
          'Invalid Channel', 
          'This command can only be used in ticket channels.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Get the new status and reason
      const newStatus = interaction.options.getString('status', true);
      const reason = interaction.options.getString('reason') || 'No reason provided';
      
      // Get the ticket from the database
      const ticketChannel = interaction.channel as TextChannel;
      const ticketNumber = parseInt(ticketChannel.name.split('-')[1]);
      
      if (isNaN(ticketNumber)) {
        await interaction.reply({ 
          content: 'Error: Could not determine ticket number from channel name.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Get the ticket from the database
      const ticket = db.prepare(`
        SELECT * FROM tickets 
        WHERE guild_id = ? AND ticket_number = ?
      `).get(interaction.guildId, ticketNumber) as { id: number, status: string } | undefined;
      
      if (!ticket) {
        await interaction.reply({ 
          content: 'Error: Could not find ticket in the database.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Get the current status
      const currentStatus = ticket.status;
      
      // Don't update if status is the same
      if (currentStatus === newStatus) {
        await interaction.reply({ 
          content: `Ticket is already in ${getStatusDetails(newStatus).emoji} **${getStatusName(newStatus)}** status.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Handle special case - closing a ticket
      if (newStatus === 'closed' && currentStatus !== 'closed') {
        // Close the ticket using the existing handler
        const { handleCloseTicket } = await import('../../handlers/tickets/close-ticket');
        
        // We need to create a custom button interaction
        const customInteraction = {
          ...interaction,
          customId: 'close_ticket',
          user: interaction.user,
          guild: interaction.guild,
          channel: interaction.channel,
          deferReply: interaction.deferReply.bind(interaction),
          reply: interaction.reply.bind(interaction),
          commandName: interaction.commandName
        };
        
        // Call the close ticket handler directly with the custom reason
        await handleCloseTicket(customInteraction as any);
        return;
      }
      
      // Update ticket status in the database
      db.prepare(`
        UPDATE tickets 
        SET status = ?, last_activity_at = CURRENT_TIMESTAMP
        WHERE guild_id = ? AND ticket_number = ?
      `).run(newStatus, interaction.guildId, ticketNumber);
      
      // Log the ticket status change
      await logTicketEvent({
        guildId: interaction.guildId!,
        actionType: 'ticketSetPriority',
        userId: interaction.user.id,
        channelId: interaction.channelId,
        ticketNumber: ticketNumber,
        priority: newStatus,
        note: reason
      });
      
      // Update the ticket channel name with status indicator
      try {
        // Don't include emoji in channel name as Discord doesn't support it in channel names
        await ticketChannel.setName(`ticket-${ticketNumber}-${newStatus.replace('_', '-')}`);
      } catch (error) {
        logError('Ticket Status', `Failed to update channel name: ${error}`);
        // Continue anyway - this is not critical
      }
      
      // Update pinned ticket message if it exists
      try {
        await updateTicketEmbed(ticketChannel, newStatus);
      } catch (error) {
        logError('Ticket Status', `Failed to update pinned message: ${error}`);
        // Continue anyway - this is not critical
      }
      
      // Get status details
      const statusDetails = getStatusDetails(newStatus);
      
      // Create an embed to show the status change
      const statusEmbed = new EmbedBuilder()
        .setTitle(`${statusDetails.emoji} Ticket Status Updated`)
        .setDescription(`This ticket's status has been updated to **${getStatusName(newStatus)}**`)
        .addFields([
          { name: 'Updated By', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Previous Status', value: `${getStatusDetails(currentStatus).emoji} ${getStatusName(currentStatus)}`, inline: true },
          { name: 'New Status', value: `${statusDetails.emoji} ${getStatusName(newStatus)}`, inline: true },
          { name: 'Reason', value: reason }
        ])
        .setColor(statusDetails.color)
        .setTimestamp();
      
      // Send the status change message to the channel
      await interaction.reply({ embeds: [statusEmbed] });
      
      // Also update the last activity timestamp
      db.prepare(`
        UPDATE tickets 
        SET last_activity_at = CURRENT_TIMESTAMP
        WHERE guild_id = ? AND ticket_number = ?
      `).run(interaction.guildId, ticketNumber);
      
      // Log the action in the staff activity table
      db.prepare(`
        INSERT INTO ticket_staff_activity
        (guild_id, ticket_id, staff_id, action_type, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        interaction.guildId,
        ticket.id,
        interaction.user.id,
        `status_change_${newStatus}`
      );
      
      logInfo('Ticket Status', `Updated ticket #${ticketNumber} status to ${newStatus}`);
    } catch (error) {
      logError('Ticket Status', `Error updating ticket status: ${error}`);
      const errorEmbed = createErrorEmbed(
        'Error', 
        'An error occurred while updating the ticket status.'
      );
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

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
 * Get details for a specific status
 */
function getStatusDetails(status: string) {
  return statusOptions.find(s => s.value === status) || statusOptions[0];
} 