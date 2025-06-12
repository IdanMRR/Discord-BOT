import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  Colors
} from 'discord.js';
import { logInfo, logError } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('test-events')
  .setDescription('Test if member join/leave events are properly configured and working')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: CommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    if (!interaction.guild) {
      await interaction.editReply('❌ This command can only be used in a server.');
      return;
    }
    
    const guild = interaction.guild;
    logInfo('TestEvents', `Testing event configuration for guild: ${guild.name} (${guild.id})`);
    
    // Check bot permissions
    const botMember = guild.members.me;
    if (!botMember) {
      await interaction.editReply('❌ Could not find bot member in this server.');
      return;
    }
    
    const hasManageGuild = botMember.permissions.has('ManageGuild');
    const hasViewAuditLog = botMember.permissions.has('ViewAuditLog');
    const hasViewChannel = botMember.permissions.has('ViewChannel');
    const hasSendMessages = botMember.permissions.has('SendMessages');
    
    // Check server settings
    const { settingsManager } = await import('../../utils/settings');
    const settings = await settingsManager.getSettings(guild.id);
    
    // Check if member logs channel exists
    let memberLogsChannel = null;
    let memberLogsChannelStatus = '❌ Not configured';
    
    if (settings?.member_log_channel_id) {
      try {
        memberLogsChannel = await guild.channels.fetch(settings.member_log_channel_id);
        if (memberLogsChannel && memberLogsChannel.isTextBased()) {
          memberLogsChannelStatus = `✅ <#${settings.member_log_channel_id}>`;
        } else {
          memberLogsChannelStatus = '❌ Channel exists but is not text-based';
        }
      } catch (error) {
        memberLogsChannelStatus = '❌ Channel not found (may have been deleted)';
      }
    }
    
    // Create comprehensive status embed
    const statusEmbed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle('🔍 Member Event System Diagnostic')
      .setDescription('Testing if member join/leave events are properly configured')
      .addFields([
        {
          name: '🤖 Bot Permissions',
          value: `• Manage Guild: ${hasManageGuild ? '✅' : '❌'}\n• View Audit Log: ${hasViewAuditLog ? '✅' : '❌'}\n• View Channel: ${hasViewChannel ? '✅' : '❌'}\n• Send Messages: ${hasSendMessages ? '✅' : '❌'}`,
          inline: false
        },
        {
          name: '📝 Member Logs Channel',
          value: memberLogsChannelStatus,
          inline: false
        },
        {
          name: '⚙️ Configuration Status',
          value: settings ? '✅ Server settings found' : '❌ No server settings found',
          inline: false
        },
        {
          name: '🎯 Event Registration',
          value: 'Events are registered automatically when the bot starts',
          inline: false
        }
      ])
      .setFooter({ text: 'If everything shows ✅ but events still don\'t work, restart the bot' })
      .setTimestamp();
    
    // Send test message to member logs channel if it exists
    if (memberLogsChannel && memberLogsChannel.isTextBased()) {
      try {
        const testEmbed = new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('🧪 Event System Test')
          .setDescription('This is a test message to verify the member logs channel is working.')
          .addFields([
            { name: 'Triggered by', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Command', value: '/test-events', inline: true },
            { name: 'Status', value: '✅ Channel accessible', inline: true }
          ])
          .setFooter({ text: 'If you see this message, the channel configuration is working!' })
          .setTimestamp();
        
        await memberLogsChannel.send({ embeds: [testEmbed] });
        
        statusEmbed.addFields([
          {
            name: '✅ Test Message Sent',
            value: `A test message was sent to <#${settings.member_log_channel_id}>`,
            inline: false
          }
        ]);
      } catch (error) {
        statusEmbed.addFields([
          {
            name: '❌ Test Message Failed',
            value: `Could not send test message: ${error}`,
            inline: false
          }
        ]);
      }
    }
    
    // Add recommendations
    let recommendations = [];
    
    if (!hasManageGuild) {
      recommendations.push('• Give the bot "Manage Server" permission to fetch invites');
    }
    if (!hasViewAuditLog) {
      recommendations.push('• Give the bot "View Audit Log" permission for invite tracking');
    }
    if (!settings?.member_log_channel_id) {
      recommendations.push('• Configure a member logs channel in your server settings');
    }
    if (recommendations.length === 0) {
      recommendations.push('• Everything looks good! Try having someone join/leave to test');
      recommendations.push('• If still not working, restart the bot');
    }
    
    if (recommendations.length > 0) {
      statusEmbed.addFields([
        {
          name: '💡 Recommendations',
          value: recommendations.join('\n'),
          inline: false
        }
      ]);
    }
    
    await interaction.editReply({ embeds: [statusEmbed] });
    logInfo('TestEvents', 'Event system diagnostic completed');
    
  } catch (error) {
    logError('TestEvents', `Error in test-events command: ${error}`);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await interaction.editReply(`❌ Error running diagnostic: ${errorMessage}`);
  }
} 