import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, Colors, MessageFlags } from 'discord.js';
import { setWeatherSchedule, getWeatherSchedule } from '../../handlers/utility/weather-scheduler';
import { getClient } from '../../utils/client-utils';
import { logInfo, logError } from '../../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('set-weather-schedule')
    .setDescription('Set custom schedule for weather updates')
    .addStringOption(option =>
        option.setName('frequency')
            .setDescription('How often to send weather updates')
            .setRequired(true)
            .addChoices(
                { name: 'Once daily', value: 'daily' },
                { name: 'Twice daily (morning and evening)', value: 'twice_daily' },
                { name: 'Hourly', value: 'hourly' },
                { name: 'Custom times', value: 'custom' }
            ))
    .addStringOption(option =>
        option.setName('time1')
            .setDescription('Time for first update (24h format in UTC, e.g. 08:00)')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('time2')
            .setDescription('Time for second update (24h format in UTC, e.g. 20:00)'))
    .addStringOption(option =>
        option.setName('time3')
            .setDescription('Time for third update (24h format in UTC, e.g. 12:00)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({
            content: '❌ This command can only be used in a server',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Get the frequency option
        const frequency = interaction.options.get('frequency')?.value as 'daily' | 'twice_daily' | 'hourly' | 'custom';
        
        // Get the time options
        const time1 = interaction.options.get('time1')?.value as string;
        const time2 = interaction.options.get('time2')?.value as string | undefined;
        const time3 = interaction.options.get('time3')?.value as string | undefined;

        // Validate time formats
        const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
        
        if (!timeRegex.test(time1)) {
            await interaction.editReply({
                content: '❌ Invalid time format for first time. Please use 24-hour format (HH:MM), e.g. 08:00'
            });
            return;
        }

        if (time2 && !timeRegex.test(time2)) {
            await interaction.editReply({
                content: '❌ Invalid time format for second time. Please use 24-hour format (HH:MM), e.g. 20:00'
            });
            return;
        }

        if (time3 && !timeRegex.test(time3)) {
            await interaction.editReply({
                content: '❌ Invalid time format for third time. Please use 24-hour format (HH:MM), e.g. 12:00'
            });
            return;
        }

        // Build times array based on frequency
        const times: string[] = [time1];
        
        if (frequency === 'twice_daily' && time2) {
            times.push(time2);
        } else if (frequency === 'custom') {
            if (time2) times.push(time2);
            if (time3) times.push(time3);
        }

        // Create schedule object
        const schedule = {
            frequency,
            times
        };
        
        // Set the schedule
        const success = await setWeatherSchedule(interaction.guildId, schedule);

        if (success) {
            // Get the client to setup the schedule
            const client = getClient();
            
            // Require weather-scheduler module again to get updated setupGuildSchedule
            const { setupGuildSchedule } = require('../../handlers/utility/weather-scheduler');
            
            // Set up the new schedule
            if (setupGuildSchedule && typeof setupGuildSchedule === 'function') {
                await setupGuildSchedule(client, interaction.guildId);
            }
            
            // Create embed with schedule info
            const embed = new EmbedBuilder()
                .setTitle('⏰ Weather Schedule Updated')
                .setColor(Colors.Green)
                .setDescription(`Weather updates will now be sent according to the following schedule:`)
                .addFields(
                    { name: 'Frequency', value: getFrequencyName(frequency), inline: true },
                    { name: 'Times (UTC)', value: times.join(', '), inline: true }
                )
                .setFooter({ text: `Server ID: ${interaction.guildId}` });

            await interaction.editReply({
                content: '✅ Weather schedule updated successfully!',
                embeds: [embed]
            });
            
            logInfo('WeatherSchedule', `Updated weather schedule for guild ${interaction.guildId}: ${frequency} (${times.join(', ')})`);
        } else {
            await interaction.editReply({
                content: '❌ Failed to update weather schedule. Please try again later.'
            });
            
            logError('WeatherSchedule', `Failed to update weather schedule for guild ${interaction.guildId}`);
        }
    } catch (error) {
        console.error('Error setting weather schedule:', error);
        await interaction.editReply({
            content: '❌ An error occurred while setting the weather schedule.'
        });
        
        logError('WeatherSchedule', `Error setting weather schedule: ${error}`);
    }
}

// Helper function to get user-friendly frequency name
function getFrequencyName(frequency: string): string {
    switch (frequency) {
        case 'daily': return 'Once daily';
        case 'twice_daily': return 'Twice daily (morning and evening)';
        case 'hourly': return 'Hourly';
        case 'custom': return 'Custom times';
        default: return frequency;
    }
} 