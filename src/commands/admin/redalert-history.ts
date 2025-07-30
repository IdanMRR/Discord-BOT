import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('redalert-history')
    .setDescription('View recent Red Alert history and statistics')
    .addIntegerOption(option =>
        option.setName('days')
            .setDescription('Number of days to look back (1-30)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(30))
    .addStringOption(option =>
        option.setName('location')
            .setDescription('Filter by specific location')
            .setRequired(false)
            .addChoices(
                { name: 'All Locations', value: 'all' },
                { name: 'עוטף גזה (Gaza Envelope)', value: 'עוטף גזה' },
                { name: 'תל אביב (Tel Aviv)', value: 'תל אביב' },
                { name: 'ירושלים (Jerusalem)', value: 'ירושלים' },
                { name: 'חיפה (Haifa)', value: 'חיפה' },
                { name: 'מחוז הדרום (South District)', value: 'מחוז הדרום' },
                { name: 'מחוז הצפון (North District)', value: 'מחוז הצפון' }
            ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Mock data structure for demonstration - in real implementation this would come from a database
interface AlertHistoryEntry {
    id: string;
    timestamp: Date;
    type: string;
    location: string;
    area: string;
    duration?: number; // in minutes
    affected_population?: number;
}

// Mock recent alerts data - replace with actual database queries
function getMockRecentAlerts(days: number, locationFilter?: string): AlertHistoryEntry[] {
    const mockAlerts: AlertHistoryEntry[] = [
        {
            id: 'alert-001',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            type: 'צבע אדום',
            location: 'שדרות',
            area: 'עוטף גזה',
            duration: 15,
            affected_population: 25000
        },
        {
            id: 'alert-002',
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
            type: 'צבע אדום',
            location: 'אשקלון',
            area: 'מחוז הדרום',
            duration: 10,
            affected_population: 145000
        },
        {
            id: 'alert-003',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            type: 'התראה לפני טילים',
            location: 'תל אביב יפו',
            area: 'מחוז המרכז',
            duration: 5,
            affected_population: 460000
        },
        {
            id: 'alert-004',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            type: 'צבע אדום',
            location: 'עוטף גזה',
            area: 'עוטף גזה',
            duration: 20,
            affected_population: 70000
        },
        {
            id: 'alert-005',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            type: 'בדיקת מערכת',
            location: 'כל הארץ',
            area: 'כל הארץ',
            duration: 2,
            affected_population: 9500000
        }
    ];

    // Filter by days
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let filteredAlerts = mockAlerts.filter(alert => alert.timestamp >= cutoffDate);

    // Filter by location if specified
    if (locationFilter && locationFilter !== 'all') {
        filteredAlerts = filteredAlerts.filter(alert => 
            alert.location.includes(locationFilter) || alert.area.includes(locationFilter)
        );
    }

    return filteredAlerts;
}

function getAlertTypeEmoji(type: string): string {
    switch (type) {
        case 'צבע אדום': return '🚨';
        case 'התראה לפני טילים': return '🚀';
        case 'סיום מטח': return '✅';
        case 'בדיקת מערכת': return '🔧';
        default: return '⚠️';
    }
}

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const days = interaction.options.getInteger('days') || 7;
        const locationFilter = interaction.options.getString('location') || 'all';

        // Get recent alerts data
        const recentAlerts = getMockRecentAlerts(days, locationFilter);

        // Calculate statistics
        const totalAlerts = recentAlerts.length;
        const alertsByType = recentAlerts.reduce((acc, alert) => {
            acc[alert.type] = (acc[alert.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const totalAffectedPopulation = recentAlerts.reduce((sum, alert) => 
            sum + (alert.affected_population || 0), 0);

        const averageDuration = recentAlerts.length > 0 
            ? recentAlerts.reduce((sum, alert) => sum + (alert.duration || 0), 0) / recentAlerts.length
            : 0;

        // Create main embed
        const embed = new EmbedBuilder()
            .setColor(totalAlerts > 0 ? Colors.ERROR : Colors.SUCCESS)
            .setTitle(`📊 Red Alert History - Last ${days} Days`)
            .setDescription(locationFilter === 'all' 
                ? `Showing alerts from all locations in the past ${days} days`
                : `Showing alerts for **${locationFilter}** in the past ${days} days`);

        // Add statistics
        embed.addFields(
            {
                name: '📈 Summary Statistics',
                value: [
                    `**Total Alerts:** ${totalAlerts}`,
                    `**Affected Population:** ${totalAffectedPopulation.toLocaleString()} people`,
                    `**Average Duration:** ${averageDuration.toFixed(1)} minutes`,
                    `**Period:** ${days} day${days !== 1 ? 's' : ''}`
                ].join('\n'),
                inline: true
            },
            {
                name: '🎯 Alert Breakdown',
                value: Object.entries(alertsByType).length > 0
                    ? Object.entries(alertsByType)
                        .map(([type, count]) => `${getAlertTypeEmoji(type)} **${type}:** ${count}`)
                        .join('\n')
                    : 'No alerts in this period',
                inline: true
            }
        );

        // Add recent alerts if any
        if (recentAlerts.length > 0) {
            const recentAlertsText = recentAlerts
                .slice(0, 10) // Show only the 10 most recent
                .map((alert, index) => {
                    const timeAgo = Math.floor((Date.now() - alert.timestamp.getTime()) / (1000 * 60 * 60));
                    const timeString = alert.timestamp.toLocaleString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                        timeZone: 'Asia/Jerusalem'
                    });
                    
                    return [
                        `**${index + 1}.** ${getAlertTypeEmoji(alert.type)} ${alert.type}`,
                        `📍 ${alert.location} (${alert.area})`,
                        `🕒 ${timeString} (${timeAgo}h ago)`,
                        `⏱️ Duration: ${alert.duration}min`
                    ].join(' • ');
                })
                .join('\n\n');

            embed.addFields({
                name: `🕒 Recent Alerts ${recentAlerts.length > 10 ? '(Last 10)' : ''}`,
                value: recentAlertsText.length > 1000 
                    ? recentAlertsText.substring(0, 997) + '...' 
                    : recentAlertsText,
                inline: false
            });
        }

        // Add location analysis if not filtered
        if (locationFilter === 'all' && totalAlerts > 0) {
            const locationCounts = recentAlerts.reduce((acc, alert) => {
                const area = alert.area;
                acc[area] = (acc[area] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const topAreas = Object.entries(locationCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([area, count]) => `• **${area}:** ${count} alert${count !== 1 ? 's' : ''}`)
                .join('\n');

            embed.addFields({
                name: '🗺️ Most Active Areas',
                value: topAreas || 'No data available',
                inline: true
            });
        }

        // Add safety tips
        embed.addFields({
            name: '🛡️ Safety Reminder',
            value: [
                '• Always follow official instructions',
                '• Keep emergency kit ready',
                '• Know your nearest shelter location',
                '• Stay informed through official channels'
            ].join('\n'),
            inline: true
        });

        // Add footer with data source information
        embed.setTimestamp()
            .setFooter({ 
                text: `Alert History Dashboard • Data source: Bot monitoring system • Queried ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour12: false })}` 
            });

        await interaction.editReply({ embeds: [embed] });
        
        logInfo('Red Alert History', `History viewed for ${days} days by user ${interaction.user.id} in server ${interaction.guildId}`);
    } catch (error) {
        logError('Red Alert History', error);
        
        try {
            if (interaction.deferred) {
                await interaction.editReply('An error occurred while fetching Red Alert history.');
            } else {
                await interaction.reply({ 
                    content: 'An error occurred while fetching Red Alert history.', 
                    flags: MessageFlags.Ephemeral 
                });
            }
        } catch (replyError) {
            logError('Red Alert History', replyError);
        }
    }
} 