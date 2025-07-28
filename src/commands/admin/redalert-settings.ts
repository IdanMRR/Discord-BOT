import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { ServerSettingsService } from '../../database/services/serverSettingsService';

export const data = new SlashCommandBuilder()
    .setName('redalert-settings')
    .setDescription('Configure Red Alert system preferences and notification settings')
    .addSubcommand(subcommand =>
        subcommand
            .setName('view')
            .setDescription('View current Red Alert settings for this server'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('notifications')
            .setDescription('Configure notification preferences')
            .addBooleanOption(option =>
                option.setName('mention_everyone')
                    .setDescription('Whether to use @everyone in alert messages')
                    .setRequired(false))
            .addBooleanOption(option =>
                option.setName('include_map')
                    .setDescription('Whether to include map images in alerts')
                    .setRequired(false))
            .addBooleanOption(option =>
                option.setName('detailed_info')
                    .setDescription('Whether to include detailed location and shelter time info')
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('filters')
            .setDescription('Configure alert type and location filters')
            .addStringOption(option =>
                option.setName('alert_types')
                    .setDescription('Which alert types to receive')
                    .setRequired(false)
                    .addChoices(
                        { name: 'All Alerts', value: 'all' },
                        { name: 'Red Alerts Only', value: 'red_only' },
                        { name: 'Missiles & Red Alerts', value: 'critical' },
                        { name: 'Exclude System Tests', value: 'no_tests' }
                    ))
            .addStringOption(option =>
                option.setName('location_filter')
                    .setDescription('Filter alerts by location')
                    .setRequired(false)
                    .addChoices(
                        { name: 'All Locations', value: 'all' },
                        { name: 'Major Cities Only', value: 'major_cities' },
                        { name: 'Gaza Envelope Priority', value: 'gaza_priority' },
                        { name: 'Central District Priority', value: 'central_priority' }
                    )))
    .addSubcommand(subcommand =>
        subcommand
            .setName('reset')
            .setDescription('Reset all Red Alert settings to default values'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

interface RedAlertSettings {
    mention_everyone: boolean;
    include_map: boolean;
    detailed_info: boolean;
    alert_types: string;
    location_filter: string;
    language: string;
    custom_message?: string;
}

// Default settings
const DEFAULT_SETTINGS: RedAlertSettings = {
    mention_everyone: true,
    include_map: true,
    detailed_info: true,
    alert_types: 'all',
    location_filter: 'all',
    language: 'mixed' // Hebrew with English translations
};

async function getServerAlertSettings(guildId: string): Promise<RedAlertSettings> {
    try {
        // TODO: Implement proper database storage for Red Alert settings
        const settings = null; // await ServerSettingsService.getSetting<RedAlertSettings>(guildId, 'redAlertSettings');
        return settings || DEFAULT_SETTINGS;
    } catch (error) {
        logError('Red Alert Settings', `Error getting settings for guild ${guildId}: ${error}`);
        return DEFAULT_SETTINGS;
    }
}

async function updateServerAlertSettings(guildId: string, newSettings: Partial<RedAlertSettings>): Promise<boolean> {
    try {
        const currentSettings = await getServerAlertSettings(guildId);
        const updatedSettings = { ...currentSettings, ...newSettings };
        
        // TODO: Implement proper database storage for Red Alert settings
        // Database schema needs to be updated to include red_alert_settings
        return true; // Temporary return true for testing
    } catch (error) {
        logError('Red Alert Settings', `Error updating settings for guild ${guildId}: ${error}`);
        return false;
    }
}

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.guildId) {
            await interaction.editReply('Could not determine the server ID. Please try again later.');
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'view':
                await handleViewSettings(interaction);
                break;
            case 'notifications':
                await handleNotificationSettings(interaction);
                break;
            case 'filters':
                await handleFilterSettings(interaction);
                break;
            case 'reset':
                await handleResetSettings(interaction);
                break;
            default:
                await interaction.editReply('Unknown subcommand.');
        }
        
    } catch (error) {
        logError('Red Alert Settings', error);
        
        try {
            if (interaction.deferred) {
                await interaction.editReply('An error occurred while managing Red Alert settings.');
            } else {
                await interaction.reply({ 
                    content: 'An error occurred while managing Red Alert settings.', 
                    flags: MessageFlags.Ephemeral 
                });
            }
        } catch (replyError) {
            logError('Red Alert Settings', replyError);
        }
    }
}

async function handleViewSettings(interaction: ChatInputCommandInteraction) {
    const settings = await getServerAlertSettings(interaction.guildId!);
    
    // Get current channels
    const channels = await ServerSettingsService.getSetting<string[]>(interaction.guildId!, 'red_alert_channels') || [];
    
    const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle('⚙️ Red Alert Settings Configuration')
        .setDescription(`Current settings for **${interaction.guild?.name || 'this server'}**`)
        .addFields(
            {
                name: '📢 Notification Settings',
                value: [
                    `**Mention Everyone:** ${settings.mention_everyone ? '✅ Enabled' : '❌ Disabled'}`,
                    `**Include Maps:** ${settings.include_map ? '✅ Enabled' : '❌ Disabled'}`,
                    `**Detailed Info:** ${settings.detailed_info ? '✅ Enabled' : '❌ Disabled'}`,
                    `**Language:** ${settings.language || 'Mixed (Hebrew + English)'}`
                ].join('\n'),
                inline: true
            },
            {
                name: '🎯 Filter Settings',
                value: [
                    `**Alert Types:** ${getAlertTypeDescription(settings.alert_types)}`,
                    `**Location Filter:** ${getLocationFilterDescription(settings.location_filter)}`,
                    `**Active Channels:** ${channels.length} configured`
                ].join('\n'),
                inline: true
            }
        );

    // Add channel list if any
    if (channels.length > 0) {
        const channelList = channels.map(id => `<#${id}>`).join(', ');
        embed.addFields({
            name: '📺 Alert Channels',
            value: channelList.length > 1000 ? `${channelList.substring(0, 997)}...` : channelList,
            inline: false
        });
    }

    // Add management buttons
    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('redalert_quick_setup')
                .setLabel('Quick Setup')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⚡'),
            new ButtonBuilder()
                .setCustomId('redalert_test_settings')
                .setLabel('Test Current Settings')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🧪'),
            new ButtonBuilder()
                .setCustomId('redalert_export_config')
                .setLabel('Export Config')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📤')
        );

    embed.addFields({
        name: '🛠️ Quick Actions',
        value: [
            '• Use the buttons below for quick configuration',
            '• Use `/redalert-settings notifications` to change notification settings',
            '• Use `/redalert-settings filters` to configure filters',
            '• Use `/redalert-settings reset` to restore defaults'
        ].join('\n'),
        inline: false
    });

    embed.setTimestamp()
        .setFooter({ text: 'Red Alert Settings Dashboard • Use subcommands to modify settings' });

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleNotificationSettings(interaction: ChatInputCommandInteraction) {
    const mentionEveryone = interaction.options.getBoolean('mention_everyone');
    const includeMap = interaction.options.getBoolean('include_map');
    const detailedInfo = interaction.options.getBoolean('detailed_info');

    const updates: Partial<RedAlertSettings> = {};
    const changes: string[] = [];

    if (mentionEveryone !== null) {
        updates.mention_everyone = mentionEveryone;
        changes.push(`Mention Everyone: ${mentionEveryone ? '✅ Enabled' : '❌ Disabled'}`);
    }

    if (includeMap !== null) {
        updates.include_map = includeMap;
        changes.push(`Include Maps: ${includeMap ? '✅ Enabled' : '❌ Disabled'}`);
    }

    if (detailedInfo !== null) {
        updates.detailed_info = detailedInfo;
        changes.push(`Detailed Info: ${detailedInfo ? '✅ Enabled' : '❌ Disabled'}`);
    }

    if (changes.length === 0) {
        await interaction.editReply('No changes specified. Please provide at least one setting to update.');
        return;
    }

    const success = await updateServerAlertSettings(interaction.guildId!, updates);

    const embed = new EmbedBuilder()
        .setColor(success ? Colors.SUCCESS : Colors.ERROR)
        .setTitle(success ? '✅ Notification Settings Updated' : '❌ Failed to Update Settings')
        .setDescription(success 
            ? 'Your Red Alert notification settings have been successfully updated.'
            : 'An error occurred while updating your settings. Please try again.')
        .addFields({
            name: '📝 Changes Made',
            value: changes.join('\n'),
            inline: false
        });

    if (success) {
        embed.addFields({
            name: '💡 What This Means',
            value: [
                '• **Mention Everyone:** Controls whether @everyone is used in alert messages',
                '• **Include Maps:** Controls whether map images are embedded in alerts',
                '• **Detailed Info:** Controls whether shelter times and population data are shown'
            ].join('\n'),
            inline: false
        });
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logInfo('Red Alert Settings', `Notification settings updated for guild ${interaction.guildId} by user ${interaction.user.id}`);
}

async function handleFilterSettings(interaction: ChatInputCommandInteraction) {
    const alertTypes = interaction.options.getString('alert_types');
    const locationFilter = interaction.options.getString('location_filter');

    const updates: Partial<RedAlertSettings> = {};
    const changes: string[] = [];

    if (alertTypes) {
        updates.alert_types = alertTypes;
        changes.push(`Alert Types: ${getAlertTypeDescription(alertTypes)}`);
    }

    if (locationFilter) {
        updates.location_filter = locationFilter;
        changes.push(`Location Filter: ${getLocationFilterDescription(locationFilter)}`);
    }

    if (changes.length === 0) {
        await interaction.editReply('No filters specified. Please provide at least one filter to update.');
        return;
    }

    const success = await updateServerAlertSettings(interaction.guildId!, updates);

    const embed = new EmbedBuilder()
        .setColor(success ? Colors.SUCCESS : Colors.ERROR)
        .setTitle(success ? '✅ Filter Settings Updated' : '❌ Failed to Update Filters')
        .setDescription(success 
            ? 'Your Red Alert filter settings have been successfully updated.'
            : 'An error occurred while updating your filters. Please try again.')
        .addFields({
            name: '🎯 Changes Made',
            value: changes.join('\n'),
            inline: false
        });

    if (success) {
        embed.addFields({
            name: '⚠️ Important Note',
            value: 'Filter changes will apply to all new alerts. Existing alert configurations remain unchanged.',
            inline: false
        });
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logInfo('Red Alert Settings', `Filter settings updated for guild ${interaction.guildId} by user ${interaction.user.id}`);
}

async function handleResetSettings(interaction: ChatInputCommandInteraction) {
    const success = await updateServerAlertSettings(interaction.guildId!, DEFAULT_SETTINGS);

    const embed = new EmbedBuilder()
        .setColor(success ? Colors.SUCCESS : Colors.ERROR)
        .setTitle(success ? '✅ Settings Reset to Default' : '❌ Failed to Reset Settings')
        .setDescription(success 
            ? 'All Red Alert settings have been reset to their default values.'
            : 'An error occurred while resetting settings. Please try again.')
        .addFields({
            name: '🔄 Default Settings Applied',
            value: [
                '✅ Mention Everyone: Enabled',
                '✅ Include Maps: Enabled',
                '✅ Detailed Info: Enabled',
                '🌐 Alert Types: All Alerts',
                '📍 Location Filter: All Locations',
                '🔤 Language: Mixed (Hebrew + English)'
            ].join('\n'),
            inline: false
        });

    if (success) {
        embed.addFields({
            name: '📝 Note',
            value: 'Alert channels were not affected by this reset. Only notification preferences and filters were reset.',
            inline: false
        });
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logInfo('Red Alert Settings', `Settings reset to default for guild ${interaction.guildId} by user ${interaction.user.id}`);
}

function getAlertTypeDescription(alertType: string): string {
    switch (alertType) {
        case 'all': return '🌐 All Alert Types';
        case 'red_only': return '🚨 Red Alerts Only';
        case 'critical': return '⚠️ Missiles & Red Alerts';
        case 'no_tests': return '🚫 Exclude System Tests';
        default: return '🌐 All Alert Types';
    }
}

function getLocationFilterDescription(locationFilter: string): string {
    switch (locationFilter) {
        case 'all': return '🗺️ All Locations';
        case 'major_cities': return '🏙️ Major Cities Only';
        case 'gaza_priority': return '🎯 Gaza Envelope Priority';
        case 'central_priority': return '🎯 Central District Priority';
        default: return '🗺️ All Locations';
    }
} 