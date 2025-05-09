import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
  TextChannel,
  User,
  Colors,
  MessageFlags
} from 'discord.js';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { db } from '../../database/sqlite';
import { logTicketEvent } from '../../utils/databaseLogger';
import { replyEphemeral } from '../../utils/interaction-utils';

export const data = new SlashCommandBuilder()
  .setName('add-user')
  .setDescription('Add a user to the current ticket')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to add to the ticket')
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
    
    // Get the user to add
    const user = interaction.options.getUser('user');
    
    if (!user) {
      await replyEphemeral(interaction, {
        content: 'Please specify a valid user to add to the ticket.'
      });
      return;
    }
    
    // Check if the user is already in the ticket
    const permissions = channel.permissionOverwrites.cache.get(user.id);
    
    if (permissions && permissions.allow.has(PermissionFlagsBits.ViewChannel)) {
      await replyEphemeral(interaction, {
        content: `${user.username} already has access to this ticket.`
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
    
    // Add the user to the ticket channel
    await channel.permissionOverwrites.create(user, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });
    
    // Create a notification embed
    const addEmbed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle('👤 User Added to Ticket')
      .setDescription(`${user} has been added to this ticket by ${interaction.user}.`)
      .setTimestamp()
      .setFooter({ text: `Ticket #${ticket.ticket_number.toString().padStart(4, '0')}` });
    
    // Send the notification to the channel
    await channel.send({ embeds: [addEmbed] });
    
    // Log the action
    await logTicketEvent({
      guildId: interaction.guildId!,
      actionType: 'ticketAddUser',
      userId: interaction.user.id,
      channelId: channel.id,
      ticketNumber: ticket.ticket_number,
      targetUser: user.id
    });
    
    // Reply to the command user
    await interaction.reply({ 
      content: `Successfully added ${user.username} to the ticket.`,
      flags: MessageFlags.Ephemeral
    });
    
    logInfo('Ticket', `User ${interaction.user.tag} added ${user.tag} to ticket #${ticket.ticket_number}`);
    
    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'add-user',
      options: { user: user.username },
      channel: interaction.channel,
      success: true
    });
  } catch (error) {
    logError('Add User', `Error adding user to ticket: ${error}`);
    
    try {
      await replyEphemeral(interaction, {
        content: 'An error occurred while adding the user to the ticket. Please try again later.'
      });
      
      // Log command usage with error
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'add-user',
        options: { user: interaction.options.getUser('user')?.username },
        channel: interaction.channel,
        success: false,
        error: `${error}`
      });
    } catch (replyError) {
      // If we can't reply, just log it
      logError('Add User', `Could not send error message: ${replyError}`);
    }
  }
} 