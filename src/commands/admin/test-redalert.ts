import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel, MessageFlags } from 'discord.js';
import { sendTestAlert } from '../../handlers/alerts/red-alert-handler';

export const data = new SlashCommandBuilder()
    .setName('test-redalert')
    .setDescription('Send a test Red Alert notification to this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        // Acknowledge the interaction immediately to prevent timeout
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        
        if (!channel || !(channel instanceof TextChannel)) {
            await interaction.editReply('This command can only be used in a text channel.');
            return;
        }

        // Get the configured alert channels
        const alertChannelIds = (process.env.RED_ALERT_CHANNEL_IDS || '').split(',').filter(id => id);
        const otherChannels = alertChannelIds.filter(id => id !== channel.id);

        // Send a test alert to the current channel and configured channels
        const success = await sendTestAlert(interaction.client, channel.id);
        
        if (success) {
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Test Alert Sent!')
                .setDescription('A test Red Alert notification has been sent.')
                .addFields(
                    { name: 'Current Channel', value: `<#${channel.id}>`, inline: true }
                );

            // Add information about other alert channels if they exist
            if (otherChannels.length > 0) {
                embed.addFields({
                    name: 'Also Sent To',
                    value: otherChannels.map(id => `<#${id}>`).join('\n'),
                    inline: false
                });
            } else if (alertChannelIds.length === 0) {
                embed.addFields({
                    name: 'Note',
                    value: 'No alert channels are configured. Use `/setup-redalert` to configure channels.',
                    inline: false
                });
            }

            embed.addFields({
                name: 'Status',
                value: 'This was just a test. The bot is functioning correctly.',
                inline: false
            })
            .setTimestamp();
            
            try {
                await interaction.editReply({ embeds: [embed] });
            } catch (replyError) {
                console.error('Failed to edit reply with success message:', replyError);
            }
        } else {
            try {
                await interaction.editReply('Failed to send the test alert. Please check the console for errors.');
            } catch (replyError) {
                console.error('Failed to edit reply with failure message:', replyError);
            }
        }
    } catch (error) {
        console.error('Error in test-redalert command:', error);
        // Try to respond if the interaction is still valid
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'An error occurred while sending the test alert.', 
                    flags: MessageFlags.Ephemeral 
                });
            } else if (interaction.deferred) {
                await interaction.editReply('An error occurred while sending the test alert.');
            }
        } catch (replyError) {
            console.error('Failed to send error response:', replyError);
        }
    }
} 