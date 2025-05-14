import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  GuildMember, 
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
  .setName('ticket-add-user')
  .setDescription('Add a user to the current ticket')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to add to the ticket')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for adding the user to the ticket')
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
    
    // Get the user to add
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
    
    // Get the member object
    const member = interaction.guild?.members.cache.get(user.id) || 
                  await interaction.guild?.members.fetch(user.id).catch(() => null);
    
    if (!member) {
      const errorEmbed = createErrorEmbed(
        'Error', 
        'Could not find that user in the server.'
      );
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }
    
    // Add the user to the channel
    const channel = interaction.channel as TextChannel;
    await channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });
    
    // Extract ticket number from channel name
    const match = channel.name.match(/ticket-(\d+)/);
    const ticketNumber = match ? parseInt(match[1]) : null;
    
    // Create an enhanced embed for the notification
    const addEmbed = new EmbedBuilder()
      .setTitle('👤 User Added to Ticket')
      .setDescription(`${user.toString()} has been added to this ticket.`)
      .setColor(Colors.Green)
      .addFields([
        { name: 'Added By', value: interaction.user.toString(), inline: true },
        { name: 'Reason', value: reason, inline: true }
      ])
      .setTimestamp()
      .setFooter({ 
        text: `Ticket #${ticketNumber || 'Unknown'}`, 
        iconURL: interaction.user.displayAvatarURL() 
      });
    
    // Send the enhanced embed to the channel
    await channel.send({ embeds: [addEmbed] });
    
    // Also send to ticket logs channel if configured
    try {
      const settings = await settingsManager.getSettings(interaction.guildId!);
      const ticketLogsChannelId = settings.ticket_logs_channel_id;
      
      if (ticketLogsChannelId) {
        const logsChannel = await interaction.guild!.channels.fetch(ticketLogsChannelId) as TextChannel;
        if (logsChannel && logsChannel.isTextBased()) {
          // Create a log embed with additional information
          const logEmbed = new EmbedBuilder()
            .setTitle('👤 User Added to Ticket')
            .setDescription(`${user.toString()} has been added to ticket #${ticketNumber}`)
            .setColor(Colors.Green)
            .addFields([
              { name: 'Added By', value: interaction.user.toString(), inline: true },
              { name: 'Reason', value: reason, inline: true },
              { name: 'Ticket', value: `#${ticketNumber}`, inline: true }
            ])
            .setTimestamp()
            .setFooter({ 
              text: `User ID: ${user.id}`, 
              iconURL: user.displayAvatarURL() 
            });
          
          await logsChannel.send({ embeds: [logEmbed] });
          logInfo('Add User', `Sent notification to ticket logs channel ${ticketLogsChannelId}`);
        }
      }
    } catch (error) {
      logError('Add User', `Error sending to logs channel: ${error}`);
      // Non-critical error, continue with the command
    }
    
    // Send success message to the user
    const successEmbed = createSuccessEmbed(
      'User Added', 
      `${user.toString()} has been added to this ticket.`
    );
    await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    
    // Log staff activity for performance tracking
    if (interaction.guildId && interaction.channelId) {
      await logStaffActivity(interaction.guildId, interaction.channelId, interaction.user.id, 'add_user');
    }
    
    // Log ticket event
    if (ticketNumber) {
      await logTicketEvent({
        guildId: interaction.guildId!,
        actionType: 'ticketAddUser',
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
      command: 'ticket-add-user',
      options: { user: user.username, reason },
      channel: interaction.channel,
      success: true
    });
  } catch (error) {
    logError('Add User', `Error adding user to ticket: ${error}`);
    
    const errorEmbed = createErrorEmbed(
      'Error', 
      'An error occurred while adding the user to the ticket.'
    );
    await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    
    // Log command usage with error
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'ticket-add-user',
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