import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel, MessageFlags } from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { addChannelToRedAlerts, validateAlertChannels } from '../../handlers/alerts/red-alert-handler';
import { ServerSettingsService } from '../../database/services/serverSettingsService';

export const data = new SlashCommandBuilder()
    .setName('setup-redalert')
    .setDescription('Set up Red Alert notifications in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        // Acknowledge the interaction immediately to prevent timeout
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Get the channel where the command was executed
        const channel = interaction.channel;
        
        if (!channel || !(channel instanceof TextChannel)) {
            await interaction.editReply('This command can only be used in a text channel.');
            return;
        }
        
        // Make sure we can get the guild id
        if (!interaction.guildId) {
            await interaction.editReply('Could not determine the server ID. Please try again later.');
            return;
        }

        // Get current alert channels for this server from the database
        const currentChannels = await ServerSettingsService.getSetting(interaction.guildId, 'red_alert_channels') || [];
        
        // Check if this channel is already registered
        if (Array.isArray(currentChannels) && currentChannels.includes(channel.id)) {
            await interaction.editReply('This channel is already set up for Red Alert notifications!');
            return;
        }

        // Add the channel to the database
        const success = await addChannelToRedAlerts(interaction.guildId, channel.id);
        
        if (!success) {
            await interaction.editReply('Failed to add the channel to Red Alert notifications. Please try again later.');
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
            .setTitle('🚨 Red Alert Notifications Successfully Set Up! 🚨')
            .setDescription('**This channel is now configured to receive real-time Red Alert notifications from Israel**')
            .addFields(
                { name: '📺 Alert Channel', value: `<#${channel.id}>`, inline: true },
                { name: '🏠 Server', value: interaction.guild?.name || 'Unknown Server', inline: true },
                { name: '📊 Total Channels', value: `${channelCount} channel${channelCount !== 1 ? 's' : ''} configured`, inline: true },
                {
                    name: '🌍 Coverage Areas',
                    value: [
                        '• **עוטף גזה** (Gaza Envelope) - 15s shelter time',
                        '• **מחוז המרכז** (Central District) - 90s shelter time',
                        '• **מחוז הצפון** (Northern District) - 30-60s',
                        '• **מחוז הדרום** (Southern District) - 30-60s',
                        '• **ירושלים** (Jerusalem District) - 90s'
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '⚡ Alert Features',
                    value: [
                        '✅ Real-time monitoring (10-second intervals)',
                        '✅ Hebrew & English dual language support',
                        '✅ Interactive map links',
                        '✅ Shelter time calculations',
                        '✅ Population impact data',
                        '✅ Multiple alert type detection'
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🛠️ Management Commands',
                    value: [
                        '• `/redalert-status` - Check system status',
                        '• `/list-redalert` - View all channels',
                        '• `/test-redalert` - Send test alerts',
                        '• `/remove-redalert` - Remove notifications',
                        '• `/redalert-settings` - Configure preferences'
                    ].join('\n'),
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Red Alert System • Made by Soggra • Data from פיקוד העורף' });
        
        await interaction.editReply({ embeds: [embed] });
        
        // Send a test message to the channel
        const testEmbed = new EmbedBuilder()
            .setColor(Colors.ERROR)
            .setTitle('🚨 RED ALERT - Test Message 🚨')
            .setDescription('**This is a test message**')
            .addFields(
                { name: 'Status', value: 'This channel is now set up to receive Red Alert notifications', inline: false },
                { name: 'How it works', value: 'When a Red Alert is issued in Israel, this channel will receive an automatic notification', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Info from Alert System' });
        
        await channel.send({ embeds: [testEmbed] });
        
        logInfo('Red Alert Setup', `Channel ${channel.id} in server ${interaction.guildId} set up for Red Alert notifications`);
    } catch (error) {
        logError('Red Alert Setup', error);
        
        // Try to respond if the interaction is still valid
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'An error occurred while setting up Red Alert notifications.', 
                    flags: MessageFlags.Ephemeral 
                });
            } else if (interaction.deferred) {
                await interaction.editReply('An error occurred while setting up Red Alert notifications.');
            }
        } catch (replyError) {
            logError('Red Alert Setup', replyError);
        }
    }
} 