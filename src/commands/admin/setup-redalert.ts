import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel, MessageFlags } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const data = new SlashCommandBuilder()
    .setName('setup-redalert')
    .setDescription('Set up Red Alert notifications in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        // Acknowledge the interaction immediately to prevent timeout
        await interaction.deferReply({ ephemeral: true });

        // Get the channel where the command was executed
        const channel = interaction.channel;
        
        if (!channel || !(channel instanceof TextChannel)) {
            await interaction.editReply('This command can only be used in a text channel.');
            return;
        }

        // Get current channel IDs from env
        const currentChannelIds = (process.env.RED_ALERT_CHANNEL_IDS || '').split(',').filter(id => id);
        
        // Check if this channel is already registered
        if (currentChannelIds.includes(channel.id)) {
            await interaction.editReply('This channel is already set up for Red Alert notifications!');
            return;
        }

        // Add this channel to the list
        currentChannelIds.push(channel.id);
        
        // Update .env file
        const envPath = path.resolve(process.cwd(), '.env');
        let envContent = '';
        
        try {
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
            }
            
            // Check if RED_ALERT_CHANNEL_IDS already exists in the file
            if (envContent.includes('RED_ALERT_CHANNEL_IDS=')) {
                // Replace the existing line
                envContent = envContent.replace(
                    /RED_ALERT_CHANNEL_IDS=.*/,
                    `RED_ALERT_CHANNEL_IDS=${currentChannelIds.join(',')}`
                );
            } else {
                // Add a new line
                envContent += `\nRED_ALERT_CHANNEL_IDS=${currentChannelIds.join(',')}\n`;
            }
            
            // Write back to the file
            fs.writeFileSync(envPath, envContent);
            
            // Update process.env
            process.env.RED_ALERT_CHANNEL_IDS = currentChannelIds.join(',');
            
            // Send confirmation
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Red Alert Notifications Set Up!')
                .setDescription('This channel will now receive Red Alert notifications.')
                .addFields(
                    { name: 'Channel', value: `<#${channel.id}>`, inline: true },
                    { name: 'Important', value: 'You need to restart the bot for this change to take effect.', inline: false }
                )
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
            // Send a test message to the channel
            const testEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 RED ALERT - Test Message 🚨')
                .setDescription('**This is a test message**')
                .addFields(
                    { name: 'Status', value: 'This channel is now set up to receive Red Alert notifications', inline: false },
                    { name: 'Note', value: 'The bot must be restarted for this change to take effect', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Info from Alert System' });
            
            await channel.send({ embeds: [testEmbed] });
        } catch (error) {
            console.error('Error updating .env file:', error);
            // Only try to edit reply if the interaction is still valid
            try {
                await interaction.editReply('Failed to update the .env file. Please check server logs and permissions.');
            } catch (replyError) {
                console.error('Failed to send error response:', replyError);
            }
        }
    } catch (error) {
        console.error('Error in setup-redalert command:', error);
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
            console.error('Failed to send error response:', replyError);
        }
    }
} 