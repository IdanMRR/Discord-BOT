import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ComponentType,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logCommandUsage } from '../../utils/logger';

import { 
  AVAILABLE_LANGUAGES, 
  Language, 
  setUserLanguage, 
  setGuildLanguage,
  getUserLanguage,
  getGuildLanguage,
  t
} from '../../utils/language';

export const data = new SlashCommandBuilder()
  .setName('language')
  .setDescription('Change your language preference or the server language')
  .addSubcommand(subcommand =>
    subcommand
      .setName('user')
      .setDescription('Change your personal language preference')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('server')
      .setDescription('Change the server language (Admin only)')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  // Log the command usage
  try {
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'language',
      options: interaction.options.data,
      channel: interaction.channel,
      success: true
    });
  } catch (error) {
    console.error('Error logging command usage:', error);
  }
  
  // Get the subcommand
  const subcommand = interaction.options.getSubcommand();
  
  // Get the current language based on subcommand
  const currentLanguage = await (subcommand === 'server' 
    ? getGuildLanguage(interaction.guildId!) 
    : getUserLanguage(interaction.user.id));
  
  // Create the language select menu
  const languageSelect = new StringSelectMenuBuilder()
    .setCustomId('language_select')
    .setPlaceholder(t('settings.select_language', currentLanguage));
  
  // Add options for each available language
  languageSelect.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel('English')
      .setValue('en')
      .setDescription('Use English language')
      .setDefault(currentLanguage === 'en'),
    new StringSelectMenuOptionBuilder()
      .setLabel('עברית')
      .setValue('he')
      .setDescription('השתמש בשפה העברית')
      .setDefault(currentLanguage === 'he')
  );
  
  // Create the action row with the select menu
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(languageSelect);
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setColor(Colors.INFO)
    .setTitle(t('settings.language', currentLanguage))
    .setDescription(t('settings.select_language', currentLanguage));
  
  // Send the message with the select menu
  const response = await interaction.reply({
    embeds: [embed],
    components: [row],
    flags: MessageFlags.Ephemeral
  });
  
  // Create a collector for the select menu
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: i => i.user.id === interaction.user.id && i.customId === 'language_select',
    time: 60000 // 1 minute
  });
  
  // Handle select menu interactions
  collector.on('collect', async i => {
    // Get the selected language
    const selectedLanguage = i.values[0] as Language;
    
    if (subcommand === 'user') {
      // Set the user's language preference
      await setUserLanguage(interaction.user.id, selectedLanguage);
      
      // Update the embed
      const updatedEmbed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle(t('settings.language', selectedLanguage))
        .setDescription(t('settings.language_changed', selectedLanguage));
      
      // Update the message
      await i.update({
        embeds: [updatedEmbed],
        components: []
      });
    } else if (subcommand === 'server') {
      // Double check admin permissions (redundant but safe)
      if (!interaction.memberPermissions?.has('Administrator')) {
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.ERROR)
              .setTitle(t('general.error', selectedLanguage))
              .setDescription(t('settings.server_language_error', selectedLanguage) || 'You need Administrator permissions to change the server language.')
          ],
          components: []
        });
        return;
      }
      
      // Set the server's language preference
      await setGuildLanguage(interaction.guildId!, selectedLanguage);
      
      // Update the embed
      const updatedEmbed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle(t('settings.language', selectedLanguage))
        .setDescription(t('settings.server_language_changed', selectedLanguage) || `Server language has been changed to ${selectedLanguage === 'en' ? 'English' : 'Hebrew'}`);
      
      // Update the message
      await i.update({
        embeds: [updatedEmbed],
        components: []
      });
    }
  });
  
  // Handle collector end
  collector.on('end', async collected => {
    if (collected.size === 0) {
      // If no interactions were collected, update the message
      const timeoutEmbed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle(t('settings.language', currentLanguage))
        .setDescription(t('settings.language_timeout', currentLanguage) || 'Language selection timed out.');
      
      await response.edit({
        embeds: [timeoutEmbed],
        components: []
      }).catch(() => {});
    }
  });
}
