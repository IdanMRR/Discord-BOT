import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { settingsManager } from '../../utils/settings';

/**
 * Command to toggle command logging
 * This allows server administrators to decide whether they want to log all command usage
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('toggle-command-logging')
    .setDescription('Toggle logging of all command usage')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      if (!interaction.guildId) {
        await interaction.reply({
          embeds: [createErrorEmbed(
            'Command Error',
            'This command can only be used in a server.'
          )],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Get current settings
      const settings = await settingsManager.getSettings(interaction.guildId);
      const currentSetting = settings?.log_all_commands || false;
      
      // Toggle the setting
      await settingsManager.updateSettings(interaction.guildId, {
        log_all_commands: !currentSetting
      });
      
      // Reply with the new setting
      await interaction.reply({
        embeds: [createSuccessEmbed(
          'Command Logging ' + (!currentSetting ? 'Enabled' : 'Disabled'),
          `Command logging has been ${!currentSetting ? 'enabled' : 'disabled'} for this server. ${!currentSetting ? 'All command usage will now be logged.' : 'Only specific actions will be logged.'}`
        )],
        flags: MessageFlags.Ephemeral
      });
      
      logInfo('Toggle Command Logging', `Command logging ${!currentSetting ? 'enabled' : 'disabled'} by ${interaction.user.tag} in ${interaction.guild?.name}`);
    } catch (error) {
      logError('Toggle Command Logging', error);
      
      await interaction.reply({
        embeds: [createErrorEmbed(
          'Command Error',
          'There was an error toggling command logging. Please try again later.'
        )],
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
