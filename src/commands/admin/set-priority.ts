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
import { getPriorityInfo } from '../../handlers/tickets/ticket-categories';

export const data = new SlashCommandBuilder()
  .setName('set-priority')
  .setDescription('Set the priority level of a ticket')
  .addStringOption(option => 
    option.setName('priority')
      .setDescription('The priority level to set')
      .setRequired(true)
      .addChoices(
        { name: '🔴 High', value: 'high' },
        { name: '🟡 Medium', value: 'medium' },
        { name: '🟢 Low', value: 'low' }
      )
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
    
    // Get the priority to set
    const priority = interaction.options.getString('priority');
    
    if (!priority) {
      await replyEphemeral(interaction, {
        content: 'Please specify a valid priority level.'
      });
      return;
    }
    
    // Get priority info for display
    const priorityInfo = getPriorityInfo(priority);
    
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
      priority?: string;
    } | undefined;
    
    if (!ticket) {
      await replyEphemeral(interaction, {
        content: 'Could not find ticket information for this channel.'
      });
      return;
    }
    
    // Check if we need to add the priority column
    try {
      // Check if the priority column exists
      const columnCheckStmt = db.prepare(`PRAGMA table_info(tickets)`);
      const columns = columnCheckStmt.all() as Array<{name: string}>;
      
      if (!columns.some(col => col.name === 'priority')) {
        // Add priority column
        db.prepare(`ALTER TABLE tickets ADD COLUMN priority TEXT`).run();
      }
    } catch (columnError) {
      logError('Set Priority', `Error checking/adding priority column: ${columnError}`);
    }
    
    // Update the ticket priority in the database
    const updateStmt = db.prepare(`
      UPDATE tickets 
      SET priority = ?
      WHERE channel_id = ?
    `);
    updateStmt.run(priority, channel.id);
    
    // Update the channel topic to include the priority
    try {
      // Get the current topic
      const currentTopic = channel.topic || '';
      
      // Update the priority in the topic
      let newTopic = currentTopic;
      
      if (currentTopic.includes('Priority')) {
        // Replace the existing priority
        newTopic = currentTopic.replace(/(\|\s*)([🔴🟡🟢⚪])\s*\w+\s*Priority/, `$1${priorityInfo.emoji} ${priorityInfo.label} Priority`);
      } else {
        // Add priority to the topic
        newTopic = `${currentTopic} | ${priorityInfo.emoji} ${priorityInfo.label} Priority`;
      }
      
      // Update the channel topic
      await channel.setTopic(newTopic);
    } catch (topicError) {
      logError('Set Priority', `Error updating channel topic: ${topicError}`);
      // Continue even if topic update fails
    }
    
    // Create a notification embed
    const priorityEmbed = new EmbedBuilder()
      .setColor(priorityInfo.color)
      .setTitle(`${priorityInfo.emoji} Ticket Priority Updated`)
      .setDescription(`The priority of this ticket has been set to **${priorityInfo.label}** by ${interaction.user}.`)
      .setTimestamp()
      .setFooter({ text: `Ticket #${ticket.ticket_number.toString().padStart(4, '0')}` });
    
    // Send the notification to the channel
    await channel.send({ embeds: [priorityEmbed] });
    
    // Log the action
    await logTicketEvent({
      guildId: interaction.guildId!,
      actionType: 'ticketSetPriority',
      userId: interaction.user.id,
      channelId: channel.id,
      ticketNumber: ticket.ticket_number,
      priority: priority
    });
    
    // Reply to the command user
    await interaction.reply({ 
      content: `Successfully set ticket priority to ${priorityInfo.emoji} **${priorityInfo.label}**.`,
      flags: MessageFlags.Ephemeral
    });
    
    logInfo('Ticket', `User ${interaction.user.tag} set priority to ${priorityInfo.label} for ticket #${ticket.ticket_number}`);
    
    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'set-priority',
      options: { priority: priorityInfo.label },
      channel: interaction.channel,
      success: true
    });
  } catch (error) {
    logError('Set Priority', `Error setting ticket priority: ${error}`);
    
    try {
      await replyEphemeral(interaction, {
        content: 'An error occurred while setting the ticket priority. Please try again later.'
      });
      
      // Log command usage with error
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'set-priority',
        options: { priority: interaction.options.getString('priority') },
        channel: interaction.channel,
        success: false,
        error: `${error}`
      });
    } catch (replyError) {
      // If we can't reply, just log it
      logError('Set Priority', `Could not send error message: ${replyError}`);
    }
  }
} 