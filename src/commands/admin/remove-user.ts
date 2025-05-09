import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
  TextChannel,
  Colors,
  MessageFlags
} from 'discord.js';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { db } from '../../database/sqlite';
import { logTicketEvent } from '../../utils/databaseLogger';
import { replyEphemeral } from '../../utils/interaction-utils';

export const data = new SlashCommandBuilder()
  .setName('remove-user')
  .setDescription('Remove a user from the current ticket')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to remove from the ticket')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Check if the command is used in a ticket channel
    const channel = interaction.channel as TextChannel;
    
    if (!channel || channel.type !== ChannelType.GuildText) {
      await replyEphemeral(interaction, {
        content: 'This command can only be used in a text channel.'
      });
      return;
    }
    
    // Check if the channel is a ticket channel
    if (!channel.name.startsWith('ticket-')) {
      await replyEphemeral(interaction, {
        content: 'This command can only be used in ticket channels.'
      });
      return;
    }
    
    // Get the user to remove
    const user = interaction.options.getUser('user');
    
    if (!user) {
      await replyEphemeral(interaction, {
        content: 'Please specify a valid user to remove from the ticket.'
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
    } | undefined;
    
    if (!ticket) {
      await replyEphemeral(interaction, {
        content: 'Could not find ticket information for this channel.'
      });
      return;
    }
    
    // Don't allow removing the ticket creator or bot itself
    if (user.id === ticket.user_id) {
      await replyEphemeral(interaction, {
        content: 'You cannot remove the ticket creator from the ticket.'
      });
      return;
    }
    
    if (user.id === interaction.client.user.id) {
      await replyEphemeral(interaction, {
        content: 'You cannot remove the bot from the ticket.'
      });
      return;
    }
    
    // Check if the user has access to the ticket
    const permissions = channel.permissionOverwrites.cache.get(user.id);
    
    if (!permissions || !permissions.allow.has(PermissionFlagsBits.ViewChannel)) {
      await replyEphemeral(interaction, {
        content: `${user.username} does not have access to this ticket.`
      });
      return;
    }
    
    // Remove the user from the ticket channel
    await channel.permissionOverwrites.delete(user.id);
    
    // Create a notification embed
    const removeEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle('👤 User Removed from Ticket')
      .setDescription(`${user.username} has been removed from this ticket by ${interaction.user}.`)
      .setTimestamp()
      .setFooter({ text: `Ticket #${ticket.ticket_number.toString().padStart(4, '0')}` });
    
    // Send the notification to the channel
    await channel.send({ embeds: [removeEmbed] });
    
    // Log the action
    await logTicketEvent({
      guildId: interaction.guildId!,
      actionType: 'ticketRemoveUser',
      userId: interaction.user.id,
      channelId: channel.id,
      ticketNumber: ticket.ticket_number,
      targetUser: user.id
    });
    
    // Reply to the command user
    await interaction.reply({ 
      content: `Successfully removed ${user.username} from the ticket.`,
      flags: MessageFlags.Ephemeral
    });
    
    logInfo('Ticket', `User ${interaction.user.tag} removed ${user.username} from ticket #${ticket.ticket_number}`);
    
    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'remove-user',
      options: { user: user.username },
      channel: interaction.channel,
      success: true
    });
  } catch (error) {
    logError('Remove User', `Error removing user from ticket: ${error}`);
    
    try {
      await replyEphemeral(interaction, {
        content: 'An error occurred while removing the user from the ticket. Please try again later.'
      });
      
      // Log command usage with error
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'remove-user',
        options: { user: interaction.options.getUser('user')?.username },
        channel: interaction.channel,
        success: false,
        error: `${error}`
      });
    } catch (replyError) {
      // If we can't reply, just log it
      logError('Remove User', `Could not send error message: ${replyError}`);
    }
  }
} 