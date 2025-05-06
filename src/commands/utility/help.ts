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

import { getContextLanguage, getTranslation as t } from '../../utils/language';

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
    const category = interaction.options.getString('category') || 'all';
    
    // Get the guild's language preference
    const language = await getContextLanguage(interaction.guildId!);
    
    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'help',
      options: { category },
      channel: interaction.channel,
      success: true
    });

    if (category === 'all') {
      // Create the main help embed
      const helpEmbed = new EmbedBuilder()
        .setTitle(`📚 ${t('commands.help', language)}`)
        .setDescription(t('commands.help_description', language))
        .setColor(Colors.INFO)
        .addFields(
          { name: `⚙️ ${t('commands.admin_commands', language)}`, value: t('commands.admin_commands_description', language), inline: true },
          { name: `🛡️ ${t('commands.moderation_commands', language)}`, value: t('commands.moderation_commands_description', language), inline: true },
          { name: `🎫 ${t('commands.ticket_commands', language)}`, value: t('commands.ticket_commands_description', language), inline: true },
          { name: `🔧 ${t('commands.utility_commands', language)}`, value: t('commands.utility_commands_description', language), inline: true }
        )
        .setFooter({ text: t('commands.help_footer', language) });

      // Create a select menu for categories
      const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder(t('commands.select_category', language))
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(t('commands.admin_commands', language))
                .setDescription(t('commands.admin_commands_description', language))
                .setValue('admin')
                .setEmoji('⚙️'),
              new StringSelectMenuOptionBuilder()
                .setLabel(t('commands.moderation_commands', language))
                .setDescription(t('commands.moderation_commands_description', language))
                .setValue('moderation')
                .setEmoji('🛡️'),
              new StringSelectMenuOptionBuilder()
                .setLabel(t('commands.ticket_commands', language))
                .setDescription(t('commands.ticket_commands_description', language))
                .setValue('tickets')
                .setEmoji('🎫'),
              new StringSelectMenuOptionBuilder()
                .setLabel(t('commands.utility_commands', language))
                .setDescription(t('commands.utility_commands_description', language))
                .setValue('utility')
                .setEmoji('🔧')
            )
        );

      await interaction.reply({ 
        embeds: [helpEmbed], 
        components: [row], 
        flags: MessageFlags.Ephemeral 
      });
    } else {
      // Show help for a specific category
      let helpEmbed = new EmbedBuilder();
      
      switch (category) {
        case 'admin':
          helpEmbed = new EmbedBuilder()
            .setTitle('⚙️ Admin Commands')
            .setDescription('Administrative commands for server management')
            .setColor(Colors.INFO)
            .addFields(
              { 
                name: '/server-setup', 
                value: 'Set up the server with tickets, logs, and other essential configurations. Perfect for new servers.', 
                inline: false 
              },
              { 
                name: '/roles-setup', 
                value: 'Configure roles for different bot permissions and features (admin, moderator, ticket staff, etc.).', 
                inline: false 
              },
              { 
                name: '/command-logs', 
                value: 'View logs of command usage. Filter by command, user, or limit the number of logs shown.', 
                inline: false 
              },
              { 
                name: '/dm-logs', 
                value: 'View logs of direct messages sent by the bot. Filter by recipient, sender, or command.', 
                inline: false 
              },
              { 
                name: '/ticket-logs', 
                value: 'View logs of ticket actions. Filter by action type, ticket number, or user.', 
                inline: false 
              },
              { 
                name: '/toggle-command-logging', 
                value: 'Toggle whether all command usage is logged for the server.', 
                inline: false 
              },
              { 
                name: '/rules-manager', 
                value: 'Manage server rules. Add, edit, delete, and list rules. Set up a rules channel for members to view.', 
                inline: false 
              },
              { 
                name: '/faq-manager', 
                value: 'Manage frequently asked questions. Add, edit, delete, and list FAQs. Set up an FAQ channel for members to view.', 
                inline: false 
              },
              { 
                name: '/server-cleanup', 
                value: 'Clean up server channels, roles, and other elements to keep your server organized.', 
                inline: false 
              }
            );
          break;
          
        case 'moderation':
          helpEmbed = new EmbedBuilder()
            .setTitle('🛡️ Moderation Commands')
            .setDescription('Commands for moderating server members')
            .setColor(Colors.INFO)
            .addFields(
              { 
                name: '/ban', 
                value: 'Ban a user from the server with an optional reason.', 
                inline: false 
              },
              { 
                name: '/dm', 
                value: 'Send a direct message to a user through the bot.', 
                inline: false 
              },
              { 
                name: '/kick', 
                value: 'Kick a user from the server with an optional reason.', 
                inline: false 
              },
              { 
                name: '/removewarn', 
                value: 'Remove a warning from a user.', 
                inline: false 
              },
              { 
                name: '/setlogchannel', 
                value: 'Set the channel where moderation logs will be sent.', 
                inline: false 
              },
              { 
                name: '/timeout', 
                value: 'Timeout a user for a specified duration with an optional reason.', 
                inline: false 
              },
              { 
                name: '/warn', 
                value: 'Warn a user with a specified reason.', 
                inline: false 
              },
              { 
                name: '/warnings', 
                value: 'View warnings for a specific user.', 
                inline: false 
              }
            );
          break;
          
        case 'tickets':
          helpEmbed = new EmbedBuilder()
            .setTitle('🎫 Ticket Commands')
            .setDescription('Commands for the ticket support system')
            .setColor(Colors.INFO)
            .addFields(
              { 
                name: '/setup', 
                value: 'Set up the ticket system in your server. Creates a ticket panel with buttons for users to create tickets.', 
                inline: false 
              },
              { 
                name: '/create', 
                value: 'Create a new ticket manually. Opens a modal for entering ticket details.', 
                inline: false 
              },
              { 
                name: '/close', 
                value: 'Close an open ticket. Can only be used in ticket channels.', 
                inline: false 
              },
              { 
                name: '/adduser', 
                value: 'Add a user to the current ticket. Can only be used in ticket channels.', 
                inline: false 
              },
              { 
                name: '/note', 
                value: 'Add a private note to a ticket that only staff can see.', 
                inline: false 
              },
              { 
                name: '/view-notes', 
                value: 'View all notes for the current ticket. Staff only.', 
                inline: false 
              },
              { 
                name: '/priority', 
                value: 'Set the priority level of a ticket (Low, Medium, High, Urgent).', 
                inline: false 
              },
              { 
                name: '/transfer', 
                value: 'Transfer a ticket to a different category.', 
                inline: false 
              },
              { 
                name: '/list', 
                value: 'List all open tickets in the server. Staff only.', 
                inline: false 
              },
              { 
                name: '/stats', 
                value: 'View ticket statistics for the server. Shows total tickets, open tickets, and closed tickets.', 
                inline: false 
              },
              { 
                name: '/set-logs', 
                value: 'Set the channel where ticket logs will be sent. Staff only.', 
                inline: false 
              }
            );
          break;
          
        case 'utility':
          helpEmbed = new EmbedBuilder()
            .setTitle('🔧 Utility Commands')
            .setDescription('General utility commands')
            .setColor(Colors.INFO)
            .addFields(
              { 
                name: '/help', 
                value: 'Show this help menu with information about all available commands.', 
                inline: false 
              },
              { 
                name: '/invite', 
                value: 'Get an invite link for the bot.', 
                inline: false 
              },
              { 
                name: '/serverinfo', 
                value: 'Display information about the current server.', 
                inline: false 
              }
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
      
      await interaction.reply({ 
        embeds: [helpEmbed], 
        components: [row], 
        flags: MessageFlags.Ephemeral 
      });
    }
  } catch (error: any) {
    console.error('Error executing help command:', error);
    await interaction.reply({ 
      content: 'There was an error executing the help command.', 
      flags: MessageFlags.Ephemeral 
    });
    
    // Log command usage with error
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'help',
      options: interaction.options.getString('category') ? { category: interaction.options.getString('category') } : {},
      channel: interaction.channel,
      success: false,
      error: error.message
    });
  }
}
