import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel, MessageFlags } from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';

export const data = new SlashCommandBuilder()
    .setName('test-redalert')
    .setDescription('Test different types of Red Alert notifications')
    .addStringOption(option =>
        option.setName('type')
            .setDescription('Type of alert to test')
            .setRequired(true)
            .addChoices(
                { name: '🚨 צבע אדום (Red Alert)', value: 'red-alert' },
                { name: '🚀 התראה לפני טילים (Missile Warning)', value: 'missile' },
                { name: '✅ סיום מטח (All Clear)', value: 'all-clear' },
                { name: '🔧 בדיקת מערכת (System Test)', value: 'test' }
            ))
    .addStringOption(option =>
        option.setName('location')
            .setDescription('Location to test')
            .setRequired(false)
            .addChoices(
                { name: 'תל אביב (Tel Aviv)', value: 'תל אביב יפו' },
                { name: 'ירושלים (Jerusalem)', value: 'ירושלים' },
                { name: 'חיפה (Haifa)', value: 'חיפה' },
                { name: 'באר שבע (Beersheba)', value: 'באר שבע' },
                { name: 'אשדוד (Ashdod)', value: 'אשדוד' },
                { name: 'אשקלון (Ashkelon)', value: 'אשקלון' },
                { name: 'עוטף גזה (Gaza Envelope)', value: 'עוטף גזה' },
                { name: 'גליל (Galilee)', value: 'גליל עליון' },
                { name: 'גולן (Golan Heights)', value: 'רמת הגולן' }
            ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Import the alert functions
async function getAlertType(title: string): Promise<{ type: string; emoji: string; description: string }> {
    if (!title) {
        return { type: 'צבע אדום', emoji: '🚨', description: 'התראה פעילה' };
    }
    
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('צבע אדום') || titleLower.includes('red alert')) {
        return { type: 'צבע אדום', emoji: '🚨', description: 'התראה פעילה' };
    } else if (titleLower.includes('התראה לפני טילים') || titleLower.includes('missile')) {
        return { type: 'התראה לפני טילים', emoji: '🚀', description: 'זוהו טילים באוויר' };
    } else if (titleLower.includes('סיום מטח') || titleLower.includes('all clear')) {
        return { type: 'סיום מטח', emoji: '✅', description: 'המטח הסתיים - ניתן לצאת מהמרחב המוגן' };
    } else if (titleLower.includes('בדיקה') || titleLower.includes('test')) {
        return { type: 'בדיקת מערכת', emoji: '🔧', description: 'בדיקת מערכת התראות' };
    }
    
    return { type: 'התראה כללית', emoji: '⚠️', description: 'התראה כללית' };
}

async function getReadableLocationName(locationData: string): Promise<{ name: string; area: string; mapLink: string }> {
    if (!locationData || locationData.trim() === '') {
        return { 
            name: 'אזורים מרובים', 
            area: 'כל הארץ', 
            mapLink: 'https://www.tzevaadom.co.il/' 
        };
    }
    
    // Area mapping for major regions - all now point to Tzeva Adom real-time map
    const areaMap: { [key: string]: { area: string; mapLink: string } } = {
        'תל אביב': { area: 'מחוז המרכז', mapLink: 'https://www.tzevaadom.co.il/' },
        'ירושלים': { area: 'מחוז ירושלים', mapLink: 'https://www.tzevaadom.co.il/' },
        'חיפה': { area: 'מחוז הצפון', mapLink: 'https://www.tzevaadom.co.il/' },
        'באר שבע': { area: 'מחוז הדרום', mapLink: 'https://www.tzevaadom.co.il/' },
        'אשדוד': { area: 'מחוז הדרום', mapLink: 'https://www.tzevaadom.co.il/' },
        'אשקלון': { area: 'מחוז הדרום', mapLink: 'https://www.tzevaadom.co.il/' },
        'גזה': { area: 'עוטף גזה', mapLink: 'https://www.tzevaadom.co.il/' },
        'עוטף גזה': { area: 'עוטף גזה', mapLink: 'https://www.tzevaadom.co.il/' },
        'גליל': { area: 'מחוז הצפון', mapLink: 'https://www.tzevaadom.co.il/' },
        'גולן': { area: 'רמת הגולן', mapLink: 'https://www.tzevaadom.co.il/' },
        'שפלה': { area: 'מחוז המרכז', mapLink: 'https://www.tzevaadom.co.il/' },
        'רמת הגולן': { area: 'רמת הגולן', mapLink: 'https://www.tzevaadom.co.il/' }
    };
    
    // Try to find area match
    for (const [location, info] of Object.entries(areaMap)) {
        if (locationData.includes(location)) {
            return { 
                name: locationData, 
                area: info.area, 
                mapLink: info.mapLink 
            };
        }
    }
    
    // Default fallback with Tzeva Adom real-time map
    return { 
        name: locationData, 
        area: 'אזור לא מזוהה', 
        mapLink: 'https://www.tzevaadom.co.il/' 
    };
}

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply();

        const alertType = interaction.options.getString('type', true);
        const location = interaction.options.getString('location') || 'תל אביב יפו';
        
        // Get the channel where the command was executed
        const channel = interaction.channel;
        
        if (!channel || !(channel instanceof TextChannel)) {
            await interaction.editReply('This command can only be used in a text channel.');
            return;
        }

        // Create test alert data based on type
        let testTitle = '';
        switch (alertType) {
            case 'red-alert':
                testTitle = 'צבע אדום';
                break;
            case 'missile':
                testTitle = 'התראה לפני טילים';
                break;
            case 'all-clear':
                testTitle = 'סיום מטח';
                break;
            case 'test':
                testTitle = 'בדיקת מערכת';
                break;
        }

        // Create map link for the test alert
        const mapData = {
            mapLink: 'https://www.tzevaadom.co.il/',
            mapImageUrl: 'https://via.placeholder.com/400x300/FF0000/FFFFFF?text=Test+Alert+Map'
        };

        // Get alert type and location information
        const alertTypeInfo = await getAlertType(testTitle);
        const locationInfo = await getReadableLocationName(location);
        
        // Format time in 24-hour format for Israeli timezone (fixed - no double conversion)
        const timeString = new Date().toLocaleTimeString('he-IL', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Jerusalem'
        });
        
        // Determine embed color based on alert type
        let embedColor = 0xFF0000; // Red for default
        if (alertTypeInfo.type === 'סיום מטח') {
            embedColor = 0x00FF00; // Green for all clear
        } else if (alertTypeInfo.type === 'בדיקת מערכת') {
            embedColor = 0xFFFF00; // Yellow for test
        }
        
        // Create the enhanced alert embed with map image
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${alertTypeInfo.emoji} ${alertTypeInfo.type} ${alertTypeInfo.emoji}`)
            .setDescription(`**${alertTypeInfo.description}**\n\n*זוהי הדמיה של מערכת התראות*`)
            .addFields(
                { name: '🕒 זמן התראה', value: timeString, inline: true },
                { name: '📍 מיקום', value: `${locationInfo.name}\n*${locationInfo.area}*`, inline: true },
                { name: '🗺️ מפת התראות בזמן אמת', value: `[🔴 צופר - צבע אדום](${mapData.mapLink})\n*לחץ לצפייה באתר*`, inline: true },
                { name: '⚠️ הנחיות', value: alertTypeInfo.type === 'סיום מטח' ? 'ניתן לצאת מהמרחב המוגן בזהירות' : 'להיכנס למרחב המוגן מיד ולהישאר למשך 10 דקות', inline: false },
                { name: '🔧 מצב הבדיקה', value: 'זוהי בדיקת מערכת - לא התראה אמיתית!', inline: false }
            )
            .setImage(mapData.mapImageUrl) // Add the live map screenshot
            .setTimestamp()
            .setFooter({ text: `מערכת התראות (בדיקה) • ${timeString} • Made by Soggra.` });

        // Send the test alert
        await channel.send({ 
            embeds: [embed], 
            content: alertType !== 'test' ? '@everyone התראת בדיקה!' : undefined 
        });

        // Confirm to the user
        const confirmEmbed = new EmbedBuilder()
            .setColor(Colors.SUCCESS)
            .setTitle('✅ Test Alert Sent!')
            .setDescription(`Sent a test **${alertTypeInfo.type}** alert for **${locationInfo.name}** (${locationInfo.area})`)
            .addFields(
                { name: 'Features Tested', value: '✅ Correct Israeli time format (24-hour)\n✅ Alert type detection\n✅ Location area mapping\n✅ Interactive map links\n✅ Context-aware instructions', inline: false }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [confirmEmbed] });
        
        logInfo('Red Alert Test', `Test alert sent: ${alertType} for ${location} in channel ${channel.id}`);
    } catch (error) {
        logError('Red Alert Test', error);
        
        try {
            if (interaction.deferred) {
                await interaction.editReply('An error occurred while sending the test alert.');
            } else {
                await interaction.reply({ 
                    content: 'An error occurred while sending the test alert.', 
                    flags: MessageFlags.Ephemeral 
                });
            }
        } catch (replyError) {
            logError('Red Alert Test', replyError);
        }
    }
} 