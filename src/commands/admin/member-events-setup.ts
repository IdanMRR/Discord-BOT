import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  ChannelType,
  TextChannel,
  MessageFlags
} from 'discord.js';
import { replyEphemeral, convertEphemeralToFlags } from '../../utils/interaction-utils';
import { setupMemberEvents } from '../../handlers/members/member-events';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
// Import Command interface for type checking only
import { Command } from '../../command-handler';

// Export the command with correct format
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-member-events')
    .setDescription('Configure welcome and leave messages')
    .setDefaultMemberPermissions(0) // Restrict to administrators
    .addChannelOption(option =>
      option.setName('welcome_channel')
        .setDescription('Channel for welcome messages')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .addChannelOption(option =>
      option.setName('leave_channel')
        .setDescription('Channel for leave messages')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .addStringOption(option =>
      option.setName('welcome_message')
        .setDescription('Custom welcome message (use {user} to mention)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('leave_message')
        .setDescription('Custom leave message (use {user} to mention)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('show_stats')
        .setDescription('Show member count in chat occasionally')
        .setRequired(false)),
  
  async execute(interaction: CommandInteraction) {
    try {
      // Check if this is a guild command
      if (!interaction.guildId) {
        await replyEphemeral(interaction, {
          content: 'This command can only be used in a server.'
        });
        return;
      }
      
      // Get the options
      const welcomeChannel = interaction.options.get('welcome_channel')?.channel as TextChannel;
      const leaveChannel = interaction.options.get('leave_channel')?.channel as TextChannel;
      const welcomeMessage = interaction.options.get('welcome_message')?.value as string;
      const leaveMessage = interaction.options.get('leave_message')?.value as string;
      const showStats = interaction.options.get('show_stats')?.value as boolean;
      
      // Validate at least one channel is provided
      if (!welcomeChannel && !leaveChannel) {
        await replyEphemeral(interaction, {
          content: 'Please provide at least one channel (welcome or leave).'
        });
        return;
      }
      
      // Set up the member events
      const success = await setupMemberEvents(
        interaction.guildId,
        welcomeChannel?.id,
        leaveChannel?.id,
        welcomeMessage,
        leaveMessage,
        showStats !== undefined ? showStats : true
      );
      
      if (success) {
        // Create and show success message
        const successEmbed = createSuccessEmbed(
          'Member Events Configured',
          'Welcome and leave messages have been set up successfully!'
        );
        
        successEmbed.addFields([
          { 
            name: 'Welcome Channel', 
            value: welcomeChannel ? `<#${welcomeChannel.id}>` : 'Not configured',
            inline: true
          },
          { 
            name: 'Leave Channel', 
            value: leaveChannel ? `<#${leaveChannel.id}>` : 'Not configured',
            inline: true
          },
          {
            name: 'Member Stats in Chat',
            value: showStats !== undefined ? (showStats ? 'Enabled' : 'Disabled') : 'Enabled',
            inline: true
          }
        ]);
        
        if (welcomeMessage) {
          successEmbed.addFields([{ 
            name: 'Custom Welcome Message', 
            value: welcomeMessage.replace('{user}', '@user')
          }]);
        }
        
        if (leaveMessage) {
          successEmbed.addFields([{ 
            name: 'Custom Leave Message', 
            value: leaveMessage.replace('{user}', '@user')
          }]);
        }
        
        await interaction.reply({
          embeds: [successEmbed],
          flags: MessageFlags.Ephemeral
        });
      } else {
        // Create and show error message
        const errorEmbed = createErrorEmbed(
          'Configuration Failed',
          'Failed to configure member events. Please try again.'
        );
        
        await interaction.reply({
          embeds: [errorEmbed],
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (error) {
      console.error('Error setting up member events:', error);
      
      // Create and show error message
      const errorEmbed = createErrorEmbed(
        'Error',
        'An error occurred while setting up member events.'
      );
      
      await interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
