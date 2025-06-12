import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChatInputCommandInteraction, 
  TextChannel,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
  MessageFlags,
  ChannelType
} from 'discord.js';
import { Command } from '../../types/command';
import { LogChannelService } from '../../database/services/logChannelService';
import { sendLog } from '../../utils/logUtils';

const logText: Command = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Manage server logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set the log channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel to send logs to')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable logging for this server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('test')
        .setDescription('Send a test log message')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction) {
    if (!interaction.isChatInputCommand()) return; // Make sure it's a chat input command
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'set': {
          const channel = interaction.options.getChannel('channel');
          
          if (!channel || channel.type !== ChannelType.GuildText) {
            await interaction.reply({ content: 'Please provide a valid text channel.', flags: MessageFlags.Ephemeral });
            return;
          }

          await LogChannelService.setLogChannel(interaction.guild.id, channel.id);
          
          await interaction.reply({ 
            content: `✅ Log channel set to ${channel}. All server logs will be sent here.`,
            flags: MessageFlags.Ephemeral 
          });

          // Send a test log
          await sendLog(interaction.client, interaction.guild, {
            title: '✅ Logging Enabled',
            description: `This channel has been set as the log channel for this server.`,
            color: '#2ecc71',
            fields: [
              { name: 'Enabled By', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
              { name: 'Channel', value: `${channel}`, inline: true },
            ],
          });
          break;
        }

        case 'disable': {
          await LogChannelService.removeLogChannel(interaction.guild.id);
          await interaction.reply({ 
            content: '✅ Logging has been disabled for this server.',
            flags: MessageFlags.Ephemeral 
          });
          break;
        }

        case 'test': {
          const channelId = await LogChannelService.getLogChannel(interaction.guild.id);
          
          if (!channelId) {
            await interaction.reply({ 
              content: 'No log channel is set up for this server. Use `/logs set` to set one up.',
              flags: MessageFlags.Ephemeral 
            });
            return;
          }

          await sendLog(interaction.client, interaction.guild, {
            title: '📝 Test Log Message',
            description: 'This is a test log message to confirm that logging is working correctly.',
            color: '#3498db',
            fields: [
              { name: 'Status', value: '✅ Logging is working!', inline: true },
              { name: 'Server', value: interaction.guild.name, inline: true },
            ],
            footer: {
              text: 'Made By Soggra • Test Message',
            },
          });

          await interaction.reply({ 
            content: `✅ A test log message has been sent to <#${channelId}>.`,
            flags: MessageFlags.Ephemeral 
          });
          break;
        }
      }
    } catch (error) {
      console.error('Error in logs command:', error);
      await interaction.reply({ 
        content: 'An error occurred while processing your request. Please try again later.',
        flags: MessageFlags.Ephemeral 
      });
    }
  },
};

// Export as default for ES modules
export default logText;

// Also export as named for CommonJS
export { logText as logs };

// Export a function to check if this module is loaded
export function isLoaded() {
  return true;
}
