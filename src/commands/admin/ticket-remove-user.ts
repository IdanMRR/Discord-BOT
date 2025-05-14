import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  TextChannel, 
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
  EmbedBuilder,
  Colors
} from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { db } from '../../database/sqlite';
import { logTicketEvent } from '../../utils/databaseLogger';
import { settingsManager } from '../../utils/settings';

export const data = new SlashCommandBuilder()
  .setName('ticket-remove-user')
  .setDescription('Remove a user from the current ticket')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to remove from the ticket')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for removing the user from the ticket')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Check if this is a ticket channel
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText || 
        !interaction.channel.name.toLowerCase().includes('ticket-')) {
      const errorEmbed = createErrorEmbed(
        'Invalid Channel', 
        'This command can only be used in ticket channels.'
      );
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }
    
    // Get the user to remove
    const user = interaction.options.getUser('user');
    if (!user) {
      const errorEmbed = createErrorEmbed(
        'Error', 
        'User not found.'
      );
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }
    
    // Get the optional reason
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    // Remove the user from the channel
    const channel = interaction.channel as TextChannel;
    await channel.permissionOverwrites.delete(user.id);
    
    // Extract ticket number from channel name
    const match = channel.name.match(/ticket-(\d+)/);
    const ticketNumber = match ? parseInt(match[1]) : null;
    
    // Create an enhanced embed for the notification
    const removeEmbed = new EmbedBuilder()
      .setTitle('👤 User Removed from Ticket')
      .setDescription(`${user.toString()} has been removed from this ticket.`)
      .setColor(Colors.Red)
      .addFields([
        { name: 'Removed By', value: interaction.user.toString(), inline: true },
        { name: 'Reason', value: reason, inline: true }
      ])
      .setTimestamp()
      .setFooter({ 
        text: `Ticket #${ticketNumber || 'Unknown'}`, 
        iconURL: interaction.user.displayAvatarURL() 
      });
    
    // Send the enhanced embed to the channel
    await channel.send({ embeds: [removeEmbed] });
    
    // Also send to ticket logs channel if configured
    try {
      const settings = await settingsManager.getSettings(interaction.guildId!);
      const ticketLogsChannelId = settings.ticket_logs_channel_id;
      
      if (ticketLogsChannelId) {
        const logsChannel = await interaction.guild!.channels.fetch(ticketLogsChannelId) as TextChannel;
        if (logsChannel && logsChannel.isTextBased()) {
          // Create a log embed with additional information
          const logEmbed = new EmbedBuilder()
            .setTitle('👤 User Removed from Ticket')
            .setDescription(`${user.toString()} has been removed from ticket #${ticketNumber}`)
            .setColor(Colors.Red)
            .addFields([
              { name: 'Removed By', value: interaction.user.toString(), inline: true },
              { name: 'Reason', value: reason, inline: true },
              { name: 'Ticket', value: `#${ticketNumber}`, inline: true }
            ])
            .setTimestamp()
            .setFooter({ 
              text: `User ID: ${user.id}`, 
              iconURL: user.displayAvatarURL() 
            });
          
          await logsChannel.send({ embeds: [logEmbed] });
          logInfo('Remove User', `Sent notification to ticket logs channel ${ticketLogsChannelId}`);
        }
      }
    } catch (error) {
      logError('Remove User', `Error sending to logs channel: ${error}`);
      // Non-critical error, continue with the command
    }
    
    // Send success message to the user (ephemeral)
    const successEmbed = createSuccessEmbed(
      'User Removed', 
      `${user.toString()} has been removed from this ticket.`
    );
    await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    
    // Log staff activity for performance tracking
    if (interaction.guildId && interaction.channelId) {
      await logStaffActivity(interaction.guildId, interaction.channelId, interaction.user.id, 'remove_user');
    }
    
    // Log ticket event
    if (ticketNumber) {
      await logTicketEvent({
        guildId: interaction.guildId!,
        actionType: 'ticketRemoveUser',
        userId: interaction.user.id,
        channelId: interaction.channelId,
        ticketNumber: ticketNumber,
        targetUser: user.id,
        note: reason
      });
    }
    
    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'ticket-remove-user',
      options: { user: user.username, reason },
      channel: interaction.channel,
      success: true
    });
  } catch (error) {
    logError('Remove User', `Error removing user from ticket: ${error}`);
    
    const errorEmbed = createErrorEmbed(
      'Error', 
      'An error occurred while removing the user from the ticket.'
    );
    await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    
    // Log command usage with error
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'ticket-remove-user',
      options: { user: interaction.options.getUser('user')?.username || 'unknown' },
      channel: interaction.channel,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Log staff activity to the ticket_staff_activity table
 */
async function logStaffActivity(guildId: string, channelId: string, staffId: string, actionType: string) {
  try {
    // First, get the ticket ID from the channel ID
    const ticket = db.prepare(`
      SELECT id FROM tickets 
      WHERE guild_id = ? AND channel_id = ?
    `).get(guildId, channelId) as { id: number } | undefined;
    
    if (!ticket) {
      logError('Staff Activity', `Could not find ticket for channel ${channelId}`);
      return false;
    }
    
    // Create the ticket_staff_activity table if it doesn't exist
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ticket_staff_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          ticket_id INTEGER NOT NULL,
          staff_id TEXT NOT NULL,
          action_type TEXT NOT NULL, 
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      logError('Staff Activity', `Error creating ticket_staff_activity table: ${error}`);
    }
    
    // Insert the activity
    db.prepare(`
      INSERT INTO ticket_staff_activity
      (guild_id, ticket_id, staff_id, action_type, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      guildId,
      ticket.id,
      staffId,
      actionType
    );
    
    logInfo('Staff Activity', `Logged ${actionType} activity for staff ${staffId} in ticket ${ticket.id}`);
    return true;
  } catch (error) {
    logError('Staff Activity', `Error logging staff activity: ${error}`);
    return false;
  }
} 