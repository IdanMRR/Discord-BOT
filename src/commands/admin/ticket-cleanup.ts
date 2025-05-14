import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  Colors
} from 'discord.js';
import { db } from '../../database/sqlite';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';

// Define interface for ticket type
interface TicketData {
  id: number;
  ticket_number: number;
  channel_id: string;
  status: string;
}

export const data = new SlashCommandBuilder()
  .setName('ticket-cleanup')
  .setDescription('Clean up deleted tickets in the database')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  let isReplySent = false;
  
  try {
    // Try to defer the reply
    try {
      await interaction.deferReply({ ephemeral: true });
      isReplySent = true;
    } catch (deferError) {
      logError('Ticket Cleanup', `Failed to defer reply: ${deferError}`);
      // Don't return, try to continue with the operation even if we can't respond
    }
    
    // Log command usage
    try {
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'ticket-cleanup',
        options: interaction.options.data,
        channel: interaction.channel,
        success: true
      });
    } catch (logError) {
      // Just continue if logging fails
    }
    
    // Get all tickets for this guild
    const tickets = db.prepare(`
      SELECT id, ticket_number, channel_id, status 
      FROM tickets 
      WHERE guild_id = ? AND status != 'deleted'
    `).all(interaction.guildId) as TicketData[];
    
    if (!tickets || tickets.length === 0) {
      if (isReplySent) {
        try {
          await interaction.editReply('No open tickets found to clean up.');
        } catch (replyError) {
          logError('Ticket Cleanup', `Failed to send "no tickets" reply: ${replyError}`);
        }
      }
      return;
    }
    
    logInfo('Ticket Cleanup', `Found ${tickets.length} tickets to check in guild ${interaction.guildId}`);
    
    // Keep track of removed tickets
    const removedTickets: number[] = [];
    
    // Check each ticket
    for (const ticket of tickets) {
      try {
        // Try to fetch the channel
        const channel = await interaction.guild!.channels.fetch(ticket.channel_id).catch(() => null);
        
        // If channel doesn't exist, mark ticket as deleted
        if (!channel) {
          // Update the ticket status to deleted
          db.prepare(`
            UPDATE tickets 
            SET status = 'deleted' 
            WHERE id = ?
          `).run(ticket.id);
          
          removedTickets.push(ticket.ticket_number);
          logInfo('Ticket Cleanup', `Marked ticket #${ticket.ticket_number} as deleted (channel not found)`);
        }
      } catch (error) {
        logError('Ticket Cleanup', `Error checking ticket #${ticket.ticket_number}: ${error}`);
      }
    }
    
    // Create a response embed
    const embed = new EmbedBuilder()
      .setTitle('🧹 Ticket Cleanup Complete')
      .setColor(Colors.Green)
      .setTimestamp();
    
    if (removedTickets.length > 0) {
      embed.setDescription(`Cleaned up ${removedTickets.length} tickets with missing channels.`);
      embed.addFields({ 
        name: 'Marked as Deleted', 
        value: removedTickets.map(num => `#${num}`).join(', ') 
      });
    } else {
      embed.setDescription('No tickets needed cleanup. All ticket channels exist.');
      embed.setColor(Colors.Blue);
    }
    
    // Try to send the reply if possible
    if (isReplySent) {
      try {
        await interaction.editReply({ embeds: [embed] });
      } catch (replyError) {
        logError('Ticket Cleanup', `Failed to send success reply: ${replyError}`);
        // Still a success even if we can't notify the user
      }
    }
    
    return;
  } catch (error) {
    logError('Ticket Cleanup', `Error during cleanup: ${error}`);
    
    if (isReplySent) {
      try {
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Error')
          .setDescription(`An error occurred during ticket cleanup: ${error}`)
          .setColor(Colors.Red)
          .setTimestamp();
        
        await interaction.editReply({ embeds: [errorEmbed] });
      } catch (replyError) {
        logError('Ticket Cleanup', `Failed to send error reply: ${replyError}`);
      }
    }
  }
} 