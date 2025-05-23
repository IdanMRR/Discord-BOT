import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder, 
  ButtonInteraction, 
  StringSelectMenuInteraction, 
  MessageFlags 
} from 'discord.js';
import { Colors } from '../../utils/embeds';


/**
 * Handle help command button interactions
 */
export async function handleHelpButtonClick(interaction: ButtonInteraction) {
  try {
    const buttonId = interaction.customId;
    let category = '';
    
    if (buttonId === 'help_back') {
      // Show main help menu
      await showMainHelpMenu(interaction);
      return;
    } else if (buttonId === 'help_admin') {
      category = 'admin';
    } else if (buttonId === 'help_moderation') {
      category = 'moderation';
    } else if (buttonId === 'help_tickets') {
      category = 'tickets';
    } else if (buttonId === 'help_utility') {
      category = 'utility';
    }
    
    if (category) {
      await showCategoryHelp(interaction, category);
    }
  } catch (error) {
    console.error('Error handling help button click:', error);
    await interaction.reply({ 
      content: 'There was an error processing this button.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

/**
 * Handle help command select menu interactions
 */
export async function handleHelpSelectMenu(interaction: StringSelectMenuInteraction) {
  try {
    const category = interaction.values[0];
    await showCategoryHelp(interaction, category);
  } catch (error) {
    console.error('Error handling help select menu:', error);
    await interaction.reply({ 
      content: 'There was an error processing this selection.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

/**
 * Show the main help menu
 */
async function showMainHelpMenu(interaction: ButtonInteraction | StringSelectMenuInteraction) {
  // Create the main help embed
  const helpEmbed = new EmbedBuilder()
    .setTitle('📚 Bot Command Help')
    .setDescription('Welcome to the help menu! Select a category below to learn more about specific commands.')
    .setColor(Colors.INFO)
    .addFields(
      { name: '⚙️ Admin', value: 'Administrative commands for server management', inline: true },
      { name: '🛡️ Moderation', value: 'Commands for moderating server members', inline: true },
      { name: '🎫 Tickets', value: 'Commands for the ticket support system', inline: true },
      { name: '🔧 Utility', value: 'General utility commands', inline: true }
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
            .setLabel('Admin')
            .setDescription('Administrative commands for server management')
            .setValue('admin')
            .setEmoji('⚙️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Moderation')
            .setDescription('Commands for moderating server members')
            .setValue('moderation')
            .setEmoji('🛡️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Tickets')
            .setDescription('Commands for the ticket support system')
            .setValue('tickets')
            .setEmoji('🎫'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Utility')
            .setDescription('General utility commands')
            .setValue('utility')
            .setEmoji('🔧')
        )
    );

  await interaction.update({ 
    embeds: [helpEmbed], 
    components: [row] 
  });
}

/**
 * Show help for a specific category
 */
async function showCategoryHelp(interaction: ButtonInteraction | StringSelectMenuInteraction, category: string) {
  let helpEmbed: EmbedBuilder = new EmbedBuilder();
  
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
  
  await interaction.update({ 
    embeds: [helpEmbed], 
    components: [row] 
  });
}
