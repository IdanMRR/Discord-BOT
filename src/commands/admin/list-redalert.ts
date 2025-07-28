import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel, MessageFlags } from 'discord.js';
import { Colors } from '../../utils/embeds';
import { validateAlertChannels } from '../../handlers/alerts/red-alert-handler';

export const data = new SlashCommandBuilder()
    .setName('list-redalert')
    .setDescription('List all channels configured for Red Alert notifications')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        // Acknowledge the interaction immediately to prevent timeout
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Make sure we have a client
        if (!interaction.client) {
            await interaction.editReply('Could not access client instance.');
            return;
        }
        
        // Validate channels to clean up any that might be invalid
        const validChannels = await validateAlertChannels(interaction.client);
        
        // Get the raw channel IDs from the environment variable too for comparison
        const configuredChannelIds = (process.env.RED_ALERT_CHANNEL_IDS || '').split(',').filter(id => id);
        
        // Create channel status reports
        const channelReports: { id: string, status: string, name?: string }[] = [];
        
        // Check status of each configured channel
        for (const channelId of configuredChannelIds) {
            try {
                const channel = await interaction.client.channels.fetch(channelId);
                if (channel && channel instanceof TextChannel) {
                    channelReports.push({
                        id: channelId,
                        status: '✅ Active',
                        name: channel.name
                    });
                } else {
                    channelReports.push({
                        id: channelId,
                        status: '⚠️ Not a text channel'
                    });
                }
            } catch (error) {
                channelReports.push({
                    id: channelId,
                    status: '❌ Invalid/Deleted'
                });
            }
        }
        // Find any issues
        // Calculate total number of valid channels across all servers
        let totalValidChannels = 0;
        for (const channels of validChannels.values()) {
            totalValidChannels += channels.length;
        }
        const removedChannels = configuredChannelIds.length - totalValidChannels;
        
        // Create the embed
        const embed = new EmbedBuilder()
            .setColor(channelReports.length > 0 ? Colors.SUCCESS : Colors.WARNING)
            .setTitle('📋 Red Alert System Channel Overview')
            .setDescription(channelReports.length > 0 
                ? '**Active Red Alert notification channels and their status:**'
                : '⚠️ **No channels are currently configured for Red Alert notifications.**\n\nUse `/setup-redalert` to get started!')
            .setTimestamp();
        
        // Add channel status fields
        if (channelReports.length > 0) {
            const validChannelsText = channelReports
                .filter(report => report.status.startsWith('✅'))
                .map(report => `<#${report.id}> (${report.name})`)
                .join('\n');
                
            const invalidChannelsText = channelReports
                .filter(report => !report.status.startsWith('✅'))
                .map(report => `${report.id} - ${report.status}`)
                .join('\n');
            
            if (validChannelsText) {
                embed.addFields({ name: '✅ Active Channels', value: validChannelsText, inline: false });
            }
            
            if (invalidChannelsText) {
                embed.addFields({ name: '❌ Problem Channels', value: invalidChannelsText, inline: false });
            }
            
            // Add summary fields with better formatting
            embed.addFields(
                { name: '📊 Total Channels', value: `**${configuredChannelIds.length}** configured`, inline: true },
                { name: '✅ Valid Channels', value: `**${totalValidChannels}** active`, inline: true },
                { name: '❌ Invalid Channels', value: `**${removedChannels}** removed`, inline: true }
            );
            
            // Add enhanced management section
            embed.addFields({
                name: '🛠️ Management Commands',
                value: [
                    '• `/setup-redalert` - Add alert channel',
                    '• `/remove-redalert` - Remove alert channel', 
                    '• `/redalert-status` - System dashboard',
                    '• `/test-redalert` - Send test alerts',
                    '• `/redalert-settings` - Configure preferences'
                ].join('\n'),
                inline: false
            });
        } else {
            // No channels are configured
            embed.addFields({
                name: 'Get Started',
                value: 'Use `/setup-redalert` in any channel to start receiving Red Alert notifications.',
                inline: false
            });
        }
        
        // Send the response
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in list-redalert command:', error);
        
        // Try to respond if the interaction is still valid
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'An error occurred while listing Red Alert channels.', 
                    flags: MessageFlags.Ephemeral 
                });
            } else if (interaction.deferred) {
                await interaction.editReply('An error occurred while listing Red Alert channels.');
            }
        } catch (replyError) {
            console.error('Failed to send error response:', replyError);
        }
    }
} 