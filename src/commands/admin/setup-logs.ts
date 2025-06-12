import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  ChannelType
} from 'discord.js';
import { logInfo, logError } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('setup-logs')
  .setDescription('Setup log channels for member tracking')
  .addChannelOption(option =>
    option
      .setName('member-logs')
      .setDescription('Channel for member join/leave logs')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: CommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    if (!interaction.guild) {
      await interaction.editReply('❌ This command can only be used in a server.');
      return;
    }
    
    const memberLogsChannel = interaction.options.get('member-logs', true);
    
    if (!memberLogsChannel.channel) {
      await interaction.editReply('❌ Invalid channel specified.');
      return;
    }
    
    const guild = interaction.guild;
    const channel = memberLogsChannel.channel;
    const channelId = channel.id;
    
    // Verify it's a text channel
    if (!('send' in channel)) {
      await interaction.editReply('❌ Selected channel must be a text channel.');
      return;
    }
    
    logInfo('SetupLogs', `Setting up member logs channel: ${channelId} for guild: ${guild.name}`);
    
    // Update server settings
    const { settingsManager } = await import('../../utils/settings');
    const settings = await settingsManager.getSettings(guild.id) || {};
    
    settings.member_log_channel_id = channelId;
    
    await settingsManager.updateSettings(guild.id, settings);
    
    // Send test message to verify it works
    try {
      const testEmbed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Member Logs Channel Configured')
        .setDescription('This channel will now receive all member join and leave notifications with invite tracking.')
        .addFields([
          { name: 'Configured by', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Server', value: guild.name, inline: true },
          { name: 'Feature', value: 'Invite Tracking & Member Logs', inline: true }
        ])
        .setFooter({ text: 'Made by Soggra • Member Tracking System' })
        .setTimestamp();
      
      await channel.send({ embeds: [testEmbed] });
      
      const successEmbed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Setup Complete')
        .setDescription(`Member logs channel has been configured successfully!`)
        .addFields([
          {
            name: '📝 Member Logs Channel',
            value: `<#${channelId}>`,
            inline: false
          },
          {
            name: '🎯 What happens now?',
            value: `• All member joins and leaves will be logged\n• Invite tracking is now active\n• Test message sent to the channel`,
            inline: false
          },
          {
            name: '🧪 Testing',
            value: `Run \`/test-events\` to verify everything is working, or have someone join/leave to test`,
            inline: false
          }
        ])
        .setFooter({ text: 'Member tracking is now active!' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [successEmbed] });
      
      logInfo('SetupLogs', `Successfully configured member logs channel for guild: ${guild.name}`);
      
    } catch (error) {
      logError('SetupLogs', `Error sending test message: ${error}`);
      
      const partialSuccessEmbed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle('⚠️ Partial Setup')
        .setDescription(`Member logs channel was configured, but couldn't send test message.`)
        .addFields([
          {
            name: '📝 Member Logs Channel',
            value: `<#${channelId}>`,
            inline: false
          },
          {
            name: '⚠️ Issue',
            value: `Bot may not have permission to send messages in that channel. Please check bot permissions.`,
            inline: false
          }
        ])
        .setTimestamp();
      
      await interaction.editReply({ embeds: [partialSuccessEmbed] });
    }
    
  } catch (error) {
    logError('SetupLogs', `Error in setup-logs command: ${error}`);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await interaction.editReply(`❌ Error setting up logs: ${errorMessage}`);
  }
} 