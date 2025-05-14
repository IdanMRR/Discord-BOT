import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ColorResolvable, TextChannel } from 'discord.js';
import { settingsManager } from '../../utils/settings';
import { logInfo, logError } from '../../utils/logger';
import { Colors } from '../../utils/embeds';
import { getVerificationSettings } from '../../handlers/verification/verification-config';

export const data = new SlashCommandBuilder()
  .setName('test-logs')
  .setDescription('Test logging channels to diagnose issues')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  
  try {
    logInfo('Test Logs', `Running log channel test for guild ${interaction.guild!.name} (${interaction.guildId})`);
    
    // Get server settings
    const serverSettings = await settingsManager.getSettings(interaction.guildId!);
    
    // Get verification settings
    const verificationSettings = await getVerificationSettings(interaction.guildId!);
    
    // Get all log channels
    const logChannels = new Map<string, { id: string, sent: boolean, error?: string }>();
    
    // Add server log channels
    if (serverSettings.log_channel_id) {
      logChannels.set('General Logs', { id: serverSettings.log_channel_id, sent: false });
    }
    if (serverSettings.mod_log_channel_id) {
      logChannels.set('Mod Logs', { id: serverSettings.mod_log_channel_id, sent: false });
    }
    if (serverSettings.member_log_channel_id) {
      logChannels.set('Member Logs', { id: serverSettings.member_log_channel_id, sent: false });
    }
    if (serverSettings.message_log_channel_id) {
      logChannels.set('Message Logs', { id: serverSettings.message_log_channel_id, sent: false });
    }
    if (serverSettings.server_log_channel_id) {
      logChannels.set('Server Logs', { id: serverSettings.server_log_channel_id, sent: false });
    }
    
    // Add verification log channel
    if (verificationSettings?.log_channel_id) {
      logChannels.set('Verification Logs', { id: verificationSettings.log_channel_id, sent: false });
    }
    
    if (logChannels.size === 0) {
      await interaction.editReply('No log channels are configured for this server.');
      return;
    }
    
    // Send test messages to each channel
    for (const [channelName, channelData] of logChannels.entries()) {
      try {
        const channel = await interaction.guild!.channels.fetch(channelData.id);
        
        if (!channel || !channel.isTextBased()) {
          logChannels.set(channelName, { 
            ...channelData, 
            sent: false, 
            error: 'Channel not found or not a text channel' 
          });
          continue;
        }
        
        const textChannel = channel as TextChannel;
        
        // Create test embed
        const embed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle('🧪 Log Channel Test')
          .setDescription(`This is a test message to verify the ${channelName} channel is working properly.`)
          .addFields([
            { name: 'Channel ID', value: channelData.id },
            { name: 'Triggered By', value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: 'Timestamp', value: new Date().toISOString() }
          ])
          .setFooter({ text: 'If you can see this message, logging to this channel works correctly.' })
          .setTimestamp();
        
        // Send test message
        await textChannel.send({ embeds: [embed] });
        logChannels.set(channelName, { ...channelData, sent: true });
        logInfo('Test Logs', `Successfully sent test message to ${channelName} channel (${channelData.id})`);
      } catch (error) {
        logError('Test Logs', `Error sending test message to ${channelName} channel: ${error}`);
        logChannels.set(channelName, { 
          ...channelData, 
          sent: false, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Create response embed
    const responseEmbed = new EmbedBuilder()
      .setColor(Colors.INFO)
      .setTitle('Log Channel Test Results')
      .setDescription('Results of testing all configured log channels:')
      .setTimestamp();
    
    // Add results for each channel
    for (const [channelName, channelData] of logChannels.entries()) {
      const statusEmoji = channelData.sent ? '✅' : '❌';
      const statusColor = channelData.sent ? 'Green' : 'Red';
      const statusText = channelData.sent 
        ? 'Test message sent successfully!' 
        : `Failed: ${channelData.error || 'Unknown error'}`;
      
      responseEmbed.addFields([{
        name: `${statusEmoji} ${channelName}`,
        value: `Channel ID: ${channelData.id}\nStatus: ${statusText}`,
        inline: true
      }]);
    }
    
    // Send response
    await interaction.editReply({ embeds: [responseEmbed] });
    
    // Send specific instructions if verification logs failed
    if (verificationSettings?.log_channel_id && !logChannels.get('Verification Logs')?.sent) {
      const troubleshootEmbed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('Verification Logs Troubleshooting')
        .setDescription('The verification log channel is not working. To fix this:')
        .addFields([
          { 
            name: 'Fix Verification Logs', 
            value: 'Run the command `/verification-setup diagnose` to automatically fix issues with verification logging.'
          },
          { 
            name: 'Manual Fix', 
            value: `Set the verification log channel to your member logs channel with:\n\`/verification-setup enable type:${verificationSettings.type} role:@VerifiedRole channel:#verification-channel log_channel:#member-logs\``
          }
        ]);
      
      await interaction.followUp({ embeds: [troubleshootEmbed], ephemeral: true });
    }
    
  } catch (error) {
    logError('Test Logs', `Error executing test-logs command: ${error}`);
    await interaction.editReply('An error occurred while testing log channels. Check console for details.');
  }
} 