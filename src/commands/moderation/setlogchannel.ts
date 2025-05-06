import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, TextChannel, MessageFlags } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { settingsManager } from '../../utils/settings';
import { logInfo, logError } from '../../utils/logger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('Set the channel for moderation logs')
    .addChannelOption(option => 
      option
        .setName('channel')
        .setDescription('The channel to send moderation logs to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const { guild } = interaction;
      
      if (!guild) {
        const errorEmbed = createErrorEmbed(
          'Server Only', 
          'This command can only be used in a server.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Defer the reply to give us time to process
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      // Get the channel from the options
      const channel = interaction.options.getChannel('channel');
      
      if (!channel) {
        const errorEmbed = createErrorEmbed(
          'Invalid Channel', 
          'Please provide a valid channel.'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }
      
      // Check if the channel is a text channel
      if (channel.type !== ChannelType.GuildText) {
        const errorEmbed = createErrorEmbed(
          'Invalid Channel Type', 
          'The log channel must be a text channel.'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }
      
      const textChannel = channel as TextChannel;
      
      // Save the channel ID in settings - use our new property names
      const result1 = await settingsManager.setSetting(guild.id, 'mod_log_channel_id', channel.id);
      const result2 = await settingsManager.setSetting(guild.id, 'log_channel_id', channel.id);
      
      // Check if there were any errors with the database operations
      if (result1 === false || result2 === false) {
        const errorEmbed = createErrorEmbed(
          'Database Error', 
          'Failed to save the log channel settings. Please try again later.'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }
      
      // Add a test log message to the specified channel
      try {
        await textChannel.send({
          embeds: [
            createSuccessEmbed(
              'Logging System Activated',
              `This channel has been set as the moderation log channel for this server.\n\nAll moderation actions will be logged here.`
            )
          ]
        });
      } catch (error) {
        // If we can't send a message to the channel, it means the bot doesn't have permission
        logError('Set Log Channel', `Failed to send test message to channel ${channel.id}: ${error}`);
        
        const errorEmbed = createErrorEmbed(
          'Permission Error',
          `I don't have permission to send messages in ${textChannel}. Please make sure I have the proper permissions.`
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }
      
      // Log the action
      logInfo('Settings', `Log channel for guild ${guild.name} (${guild.id}) set to ${channel.name} (${channel.id})`);
      
      // Create a success embed
      const successEmbed = createSuccessEmbed(
        'Log Channel Set',
        `Moderation logs will now be sent to ${channel}.\n\nAll moderation actions such as kicks and bans will be logged in this channel.`
      );
      
      // Reply with success
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      logError('Set Log Channel Command', error);
      
      // Check if the interaction has been deferred
      if (interaction.deferred) {
        const errorEmbed = createErrorEmbed(
          'Command Error',
          'There was an error trying to set the log channel. Please try again later.'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        const errorEmbed = createErrorEmbed(
          'Command Error',
          'There was an error trying to set the log channel. Please try again later.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }
    }
  },
};
