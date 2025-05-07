import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, TextChannel, User } from 'discord.js';
import { settingsManager } from '../../utils/settings';
import { logInfo, logError } from '../../utils/logger';
import { Colors } from '../../utils/embeds';
import { getVerificationSettings, VerificationType } from '../../handlers/verification/verification-config';

export const data = new SlashCommandBuilder()
  .setName('force-log')
  .setDescription('Force send a verification log to test the system')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option => 
    option
      .setName('user')
      .setDescription('The user to log verification for (defaults to you)')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option
      .setName('success')
      .setDescription('Whether the verification was successful (default: true)')
      .setRequired(false)
  )
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Override channel to send log to')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  
  try {
    // Get options
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const success = interaction.options.getBoolean('success') ?? true;
    const overrideChannel = interaction.options.getChannel('channel');
    
    logInfo('Force Log', `Sending forced verification log for user ${targetUser.tag} (${targetUser.id}), success: ${success}`);
    
    // Get server settings for member logs channel
    const serverSettings = await settingsManager.getSettings(interaction.guildId!);
    
    // Get verification settings
    const verificationSettings = await getVerificationSettings(interaction.guildId!);
    
    // Find all possible log channels
    const channels = new Map<string, string>();
    
    if (overrideChannel && ('isTextBased' in overrideChannel) && overrideChannel.isTextBased()) {
      channels.set('Override', overrideChannel.id);
    }
    
    if (verificationSettings?.log_channel_id) {
      channels.set('Verification Logs', verificationSettings.log_channel_id);
    }
    
    if (serverSettings.member_log_channel_id) {
      channels.set('Member Logs', serverSettings.member_log_channel_id);
    }
    
    if (serverSettings.mod_log_channel_id) {
      channels.set('Mod Logs', serverSettings.mod_log_channel_id);
    }
    
    if (channels.size === 0) {
      await interaction.editReply('No log channels found to send to.');
      return;
    }
    
    const results = new Map<string, boolean>();
    
    // Try to send to each channel
    for (const [channelName, channelId] of channels.entries()) {
      try {
        const channel = await interaction.guild!.channels.fetch(channelId) as TextChannel;
        
        if (!channel || !channel.isTextBased()) {
          results.set(channelName, false);
          continue;
        }
        
        // Create account age string
        const accountCreated = targetUser.createdAt;
        const accountAge = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
        
        // Create verification log embed
        const embed = new EmbedBuilder()
          .setColor(success ? Colors.SUCCESS : Colors.ERROR)
          .setTitle(`${success ? '✅' : '❌'} Verification ${success ? 'Successful' : 'Failed'} [TEST LOG]`)
          .setDescription(`User: <@${targetUser.id}> (${targetUser.tag})`)
          .addFields([
            { name: 'User ID', value: targetUser.id, inline: true },
            { name: 'Verification Type', value: verificationSettings?.type || VerificationType.BUTTON, inline: true },
            { name: 'Account Age', value: `${accountAge} days`, inline: true },
            { name: 'Test Log', value: 'This is a test verification log generated with the force-log command.', inline: false }
          ])
          .setFooter({ text: `Forced by ${interaction.user.tag}` })
          .setTimestamp();
        
        // If failure, add reason
        if (!success) {
          embed.addFields([{ name: 'Failure Reason', value: 'Test verification failure' }]);
        }
        
        // Send the log
        await channel.send({ embeds: [embed] });
        results.set(channelName, true);
        logInfo('Force Log', `Successfully sent test verification log to ${channelName} channel (${channelId})`);
      } catch (error) {
        logError('Force Log', `Error sending to ${channelName} channel: ${error}`);
        results.set(channelName, false);
      }
    }
    
    // Create response embed
    const responseEmbed = new EmbedBuilder()
      .setColor(Colors.INFO)
      .setTitle('Verification Log Test Results')
      .setDescription(`Results of sending test verification log for ${targetUser.tag}:`)
      .setTimestamp();
    
    // Add results for each channel
    for (const [channelName, success] of results.entries()) {
      const statusEmoji = success ? '✅' : '❌';
      responseEmbed.addFields([{
        name: `${statusEmoji} ${channelName}`,
        value: success 
          ? 'Verification log sent successfully!' 
          : 'Failed to send verification log',
        inline: true
      }]);
    }
    
    // Add diagnostics info
    responseEmbed.addFields([
      { 
        name: 'Verification Settings', 
        value: verificationSettings 
          ? `Enabled: ${verificationSettings.enabled}, Type: ${verificationSettings.type}, Log Channel: ${verificationSettings.log_channel_id || 'Not set'}`
          : 'No verification settings found'
      },
      {
        name: 'Configured Log Channels',
        value: `Member Logs: ${serverSettings.member_log_channel_id || 'Not set'}\nMod Logs: ${serverSettings.mod_log_channel_id || 'Not set'}`
      }
    ]);
    
    // Send response
    await interaction.editReply({ embeds: [responseEmbed] });
    
    // Provide next steps if any channels failed
    if ([...results.values()].some(success => !success)) {
      const troubleshootEmbed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('Verification Logs Troubleshooting')
        .setDescription('Some log channels failed. To fix verification logging:')
        .addFields([
          { 
            name: 'Fix Verification Logs', 
            value: 'Run the command `/verification-setup diagnose` to automatically fix issues with verification logging.'
          },
          { 
            name: 'Manual Fix', 
            value: `If you have a working member logs channel, use:\n\`/verification-setup enable type:${verificationSettings?.type || VerificationType.BUTTON} role:@VerifiedRole channel:#verification-channel log_channel:#member-logs\``
          }
        ]);
      
      await interaction.followUp({ embeds: [troubleshootEmbed], ephemeral: true });
    }
    
  } catch (error) {
    logError('Force Log', `Error executing force-log command: ${error}`);
    await interaction.editReply('An error occurred while sending test verification logs. Check console for details.');
  }
} 