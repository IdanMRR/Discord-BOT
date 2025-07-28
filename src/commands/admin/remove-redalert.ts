import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel, MessageFlags } from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { removeChannelFromRedAlerts, validateAlertChannels } from '../../handlers/alerts/red-alert-handler';
import { ServerSettingsService } from '../../database/services/serverSettingsService';

export const data = new SlashCommandBuilder()
    .setName('remove-redalert')
    .setDescription('Remove Red Alert notifications from this channel')
    .addChannelOption(option => 
        option.setName('channel')
            .setDescription('The channel to remove (defaults to current channel)')
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Get the target channel (use provided channel or current channel)
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        
        if (!targetChannel) {
            await interaction.editReply('Failed to identify the target channel.');
            return;
        }
        
        // Make sure we have a guild ID
        if (!interaction.guildId) {
            await interaction.editReply('Could not determine the server ID. Please try again later.');
            return;
        }

        // Get current alert channels for this server from the database
        const currentChannels = (await ServerSettingsService.getSetting<string[]>(interaction.guildId, 'red_alert_channels')) || [];
        
        // Check if this channel is not registered
        if (!Array.isArray(currentChannels) || !currentChannels.includes(targetChannel.id)) {
            await interaction.editReply(`${targetChannel.id === interaction.channel?.id ? 'This channel is' : 'The specified channel is'} not set up for Red Alert notifications.`);
            return;
        }

        // Remove the channel from the database
        const success = await removeChannelFromRedAlerts(interaction.guildId, targetChannel.id);
        
        if (!success) {
            await interaction.editReply('Failed to remove the channel from Red Alert notifications. Please try again later.');
            return;
        }
        
        // Validate channels to make sure everything is working properly
        if (interaction.client) {
            await validateAlertChannels(interaction.client);
        }
        
        // Get updated channel list for the message
        const updatedChannels = (await ServerSettingsService.getSetting<string[]>(interaction.guildId, 'red_alert_channels')) || [];
        const channelCount = Array.isArray(updatedChannels) ? updatedChannels.length : 0;
            
        // Send confirmation
        const embed = new EmbedBuilder()
            .setColor(Colors.SUCCESS)
            .setTitle('🔕 Red Alert Notifications Successfully Removed')
            .setDescription(`**<#${targetChannel.id}> will no longer receive Red Alert notifications**`)
            .addFields(
                { name: '📺 Removed Channel', value: `<#${targetChannel.id}>`, inline: true },
                { name: '✅ Status', value: '**Successfully removed**', inline: true },
                { name: '📊 Remaining Channels', value: channelCount > 0 ? 
                    `**${channelCount}** channel${channelCount !== 1 ? 's' : ''} still active:\n${(updatedChannels as string[]).map(id => `<#${id}>`).join('\n')}` : 
                    '⚠️ **No channels remaining**\nUse `/setup-redalert` to add new channels', inline: false }
            );

        if (channelCount === 0) {
            embed.addFields({
                name: '⚠️ Important Notice',
                value: 'This server no longer has any Red Alert channels configured. Your server will not receive emergency notifications until you set up new channels.',
                inline: false
            });
        }

        embed.addFields({
            name: '🛠️ Quick Actions',
            value: [
                '• `/setup-redalert` - Add new alert channel',
                '• `/list-redalert` - View all channels',
                '• `/redalert-status` - System overview'
            ].join('\n'),
            inline: false
        })
        .setTimestamp()
        .setFooter({ text: 'Red Alert Management • Made by Soggra' });
        
        await interaction.editReply({ embeds: [embed] });
        
        // Send notification to the channel if it's not the current channel
        if (targetChannel.id !== interaction.channel?.id && targetChannel instanceof TextChannel) {
            const notificationEmbed = new EmbedBuilder()
                .setColor(Colors.ERROR)
                .setTitle('🔕 Red Alert Notifications Disabled')
                .setDescription('This channel will no longer receive Red Alert notifications.')
                .addFields(
                    { name: 'Removed By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Time', value: new Date().toLocaleTimeString(), inline: true }
                )
                .setTimestamp();
            
            await targetChannel.send({ embeds: [notificationEmbed] });
        }
        
        logInfo('Red Alert Remove', `Channel ${targetChannel.id} in server ${interaction.guildId} removed from Red Alert notifications`);
    } catch (error) {
        logError('Red Alert Remove', error);
        
        // Try to respond if the interaction is still valid
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'An error occurred while removing Red Alert notifications.', 
                    flags: MessageFlags.Ephemeral 
                });
            } else if (interaction.deferred) {
                await interaction.editReply('An error occurred while removing Red Alert notifications.');
            }
        } catch (replyError) {
            logError('Red Alert Remove', replyError);
        }
    }
} 