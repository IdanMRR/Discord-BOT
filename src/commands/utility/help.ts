import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder,
  ChatInputCommandInteraction,
  MessageFlags
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logCommandUsage } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Get help with ticket system commands')
  .addStringOption(option =>
    option.setName('category')
      .setDescription('The category of commands to get help with')
      .setRequired(false)
      .addChoices(
        { name: 'Admin', value: 'admin' },
        { name: 'Moderation', value: 'moderation' },
        { name: 'Tickets', value: 'tickets' },
        { name: 'Utility', value: 'utility' },
        { name: 'All Commands', value: 'all' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Defer the reply immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const category = interaction.options.getString('category') || 'all';
    
    if (category === 'all') {
      // Create the main help embed
      const helpEmbed = new EmbedBuilder()
        .setTitle('📚 Help')
        .setDescription('Get help with ticket system commands')
        .setColor(Colors.INFO)
        .addFields(
          { name: '⚙️ Admin Commands', value: 'Administrative commands for server management', inline: true },
          { name: '🛡️ Moderation Commands', value: 'Commands for moderating server members', inline: true },
          { name: '🎫 Ticket Commands', value: 'Commands for the ticket support system', inline: true },
          { name: '🔧 Utility Commands', value: 'General utility commands', inline: true }
        )
        .setFooter({ text: 'Use /help [category] to view specific command categories' });

      // Create a select menu for categories
      const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('Select a category')
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel('Admin Commands')
                .setDescription('Administrative commands for server management')
                .setValue('admin')
                .setEmoji('⚙️'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Moderation Commands')
                .setDescription('Commands for moderating server members')
                .setValue('moderation')
                .setEmoji('🛡️'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Ticket Commands')
                .setDescription('Commands for the ticket support system')
                .setValue('tickets')
                .setEmoji('🎫'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Utility Commands')
                .setDescription('General utility commands')
                .setValue('utility')
                .setEmoji('🔧')
            )
        );

      await interaction.editReply({ 
        embeds: [helpEmbed], 
        components: [row]
      });
      
      // Log the command usage after successful execution
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'help',
        options: { category },
        channel: interaction.channel,
        success: true
      });
      
      return;
    }

    // Show help for a specific category
    let helpEmbed = new EmbedBuilder();
    switch (category) {
      case 'admin':
        helpEmbed = new EmbedBuilder()
          .setTitle('⚙️ Admin Commands')
          .setDescription('Administrative commands for server management')
          .setColor(Colors.INFO)
          .addFields(
            { name: '/server-setup', value: 'Set up the server with tickets, logs, and other essential configurations. Perfect for new servers.', inline: false },
            { name: '/roles-setup', value: 'Configure roles for different bot permissions and features (admin, moderator, ticket staff, etc.).', inline: false },
            { name: '/command-logs', value: 'View logs of command usage. Filter by command, user, or limit the number of logs shown.', inline: false },
            { name: '/dm-logs', value: 'View logs of direct messages sent by the bot. Filter by recipient, sender, or command.', inline: false },
            { name: '/ticket-logs', value: 'View logs of ticket actions. Filter by action type, ticket number, or user.', inline: false },
            { name: '/toggle-command-logging', value: 'Toggle whether all command usage is logged for the server.', inline: false },
            { name: '/rules-manager', value: 'Manage server rules. Add, edit, delete, and list rules. Set up a rules channel for members to view.', inline: false },
            { name: '/faq-manager', value: 'Manage frequently asked questions. Add, edit, delete, and list FAQs. Set up an FAQ channel for members to view.', inline: false },
            { name: '/server-cleanup', value: 'Clean up server channels, roles, and other elements to keep your server organized.', inline: false }
          );
        break;
      case 'moderation':
        helpEmbed = new EmbedBuilder()
          .setTitle('🛡️ Moderation Commands')
          .setDescription('Commands for moderating server members')
          .setColor(Colors.INFO)
          .addFields(
            { name: '/ban', value: 'Ban a user from the server with an optional reason.', inline: false },
            { name: '/dm', value: 'Send a direct message to a user through the bot.', inline: false },
            { name: '/kick', value: 'Kick a user from the server with an optional reason.', inline: false },
            { name: '/removewarn', value: 'Remove a warning from a user.', inline: false },
            { name: '/setlogchannel', value: 'Set the channel where moderation logs will be sent.', inline: false },
            { name: '/timeout', value: 'Timeout a user for a specified duration with an optional reason.', inline: false },
            { name: '/warn', value: 'Warn a user with a specified reason.', inline: false },
            { name: '/warnings', value: 'View warnings for a specific user.', inline: false }
          );
        break;
      case 'tickets':
        helpEmbed = new EmbedBuilder()
          .setTitle('🎫 Ticket Commands')
          .setDescription('Commands for the ticket support system')
          .setColor(Colors.INFO)
          .addFields(
            { name: '/setup-ticket', value: 'Set up the ticket system in your server. Creates a ticket panel with selection menu for users to create tickets.', inline: false },
            { name: '/close', value: 'Close an open ticket. Can only be used in ticket channels.', inline: false },
            { name: '/ticket-add-user', value: 'Add a user to the current ticket channel. Staff only.', inline: false },
            { name: '/ticket-remove-user', value: 'Remove a user from the current ticket channel. Staff only.', inline: false },
            { name: '/ticket-priority', value: 'Set the priority level of a ticket (High, Medium, Low). Staff only.', inline: false },
            { name: '/ticket-setup-logs', value: 'Set the channel where ticket logs will be sent. Staff only.', inline: false },
            { name: '/ticket-status', value: 'Change the status of the current ticket (Open, In Progress, On Hold, Closed).', inline: false },
            { name: '/ticket-staff-message', value: 'Send a message that only staff can see in the ticket channel.', inline: false },
            { name: '/ticket-rate', value: 'Rate a closed ticket and provide feedback about your support experience.', inline: false },
            { name: '/list-tickets', value: 'List all open tickets in the server. Staff only.', inline: false },
            { name: '/ticket-logs', value: 'View logs of ticket actions. Filter by action type, ticket number, or user.', inline: false },
            { name: '/staff-stats', value: 'View statistics about staff ticket handling performance.', inline: false },
            { name: '/test-logs', value: 'Test the ticket logging system by sending a sample log message.', inline: false },
            { name: '/list-redalert', value: 'List Red Alert notification channels configured in the system.', inline: false },
            { name: '/setup-redalert', value: 'Configure a channel to receive Red Alert notifications.', inline: false },
            { name: '/remove-redalert', value: 'Remove a channel from Red Alert notifications.', inline: false }
          );
        break;
      case 'utility':
        helpEmbed = new EmbedBuilder()
          .setTitle('🔧 Utility Commands')
          .setDescription('General utility commands')
          .setColor(Colors.INFO)
          .addFields(
            { name: '/help', value: 'Show this help menu with information about all available commands.', inline: false },
            { name: '/invite', value: 'Get an invite link for the bot.', inline: false },
            { name: '/serverinfo', value: 'Display information about the current server.', inline: false }
          );
        break;
    }

    // Create navigation buttons
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_back')
          .setLabel('Back to Main Menu')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️'),
        new ButtonBuilder()
          .setCustomId('help_admin')
          .setLabel('Admin')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚙️')
          .setDisabled(category === 'admin'),
        new ButtonBuilder()
          .setCustomId('help_moderation')
          .setLabel('Moderation')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛡️')
          .setDisabled(category === 'moderation'),
        new ButtonBuilder()
          .setCustomId('help_tickets')
          .setLabel('Tickets')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
          .setDisabled(category === 'tickets'),
        new ButtonBuilder()
          .setCustomId('help_utility')
          .setLabel('Utility')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔧')
          .setDisabled(category === 'utility')
      );

    await interaction.editReply({ 
      embeds: [helpEmbed], 
      components: [row]
    });
    
    // Log the command usage after successful execution
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'help',
      options: { category },
      channel: interaction.channel,
      success: true
    });
    
  } catch (error: any) {
    console.error('Error executing help command:', error);
    
    try {
      await interaction.editReply({ 
        content: 'There was an error executing the help command.'
      });
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }
}
