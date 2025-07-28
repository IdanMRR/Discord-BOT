import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { ServerSettingsService } from '../../database/services/serverSettingsService';
import { db } from '../../database/sqlite';
import { logInfo, logError, logWarning } from '../../utils/logger';

// Add type declaration for the global variable
declare global {
    var lastNonJsonLogTime: number | undefined;
}

dotenv.config();

// API endpoint for alerts
const ALERT_API_URL = 'https://www.oref.org.il/WarningMessages/alert/alerts.json';
const CHECK_INTERVAL = 10000; // Check every 10 seconds

// Set of already processed alerts to avoid duplicates
const processedAlerts = new Set<string>();
// Track last processed alert timestamp to prevent spamming multiple alerts in a short timeframe
let lastAlertTimestamp = 0;
// Minimum time between alerts in milliseconds (60 seconds to prevent spam)
const MIN_ALERT_INTERVAL = 60000;

/**
 * Get alert type based on title
 */
function getAlertType(title: string): { type: string; emoji: string; description: string } {
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

/**
 * Enhanced location database with migun times and additional data
 */
const ENHANCED_LOCATION_DATA: { [key: string]: { 
  name: string; 
  area: string; 
  migunTime: number; 
  population?: number; 
  zone: string;
  mapLink: string;
}} = {
  // Gaza Envelope (עוטף גזה) - 15 seconds
  'שדרות': { name: 'שדרות', area: 'עוטף גזה', migunTime: 15, population: 25000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Sderot,+Israel/' },
  'אשקלון': { name: 'אשקלון', area: 'מחוז הדרום', migunTime: 30, population: 145000, zone: 'עיר גדולה', mapLink: 'https://www.google.com/maps/place/Ashkelon,+Israel/' },
  'אשדוד': { name: 'אשדוד', area: 'מחוז הדרום', migunTime: 45, population: 225000, zone: 'עיר גדולה', mapLink: 'https://www.google.com/maps/place/Ashdod,+Israel/' },
  'נתיבות': { name: 'נתיבות', area: 'מחוז הדרום', migunTime: 60, population: 35000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Netivot,+Israel/' },
  'ניר עם': { name: 'ניר עם', area: 'עוטף גזה', migunTime: 15, population: 1200, zone: 'קיבוץ', mapLink: 'https://www.google.com/maps/place/Nir+Am,+Israel/' },
  'גבים': { name: 'גבים', area: 'עוטף גזה', migunTime: 15, population: 600, zone: 'קיבוץ', mapLink: 'https://www.google.com/maps/place/Gavim,+Israel/' },
  'איבים': { name: 'איבים', area: 'עוטף גזה', migunTime: 15, population: 800, zone: 'מושב', mapLink: 'https://www.google.com/maps/place/Ibim,+Israel/' },
  
  // Central Israel (מחוז המרכז) - 90 seconds
  'תל אביב': { name: 'תל אביב', area: 'מחוז המרכז', migunTime: 90, population: 460000, zone: 'מטרופולין', mapLink: 'https://www.google.com/maps/place/Tel+Aviv,+Israel/' },
  'פתח תקווה': { name: 'פתח תקווה', area: 'מחוז המרכז', migunTime: 90, population: 250000, zone: 'עיר גדולה', mapLink: 'https://www.google.com/maps/place/Petah+Tikva,+Israel/' },
  'ראשון לציון': { name: 'ראשון לציון', area: 'מחוז המרכז', migunTime: 90, population: 260000, zone: 'עיר גדולה', mapLink: 'https://www.google.com/maps/place/Rishon+LeZion,+Israel/' },
  'חולון': { name: 'חולון', area: 'מחוז המרכז', migunTime: 90, population: 195000, zone: 'עיר גדולה', mapLink: 'https://www.google.com/maps/place/Holon,+Israel/' },
  'בת ים': { name: 'בת ים', area: 'מחוז המרכז', migunTime: 90, population: 130000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Bat+Yam,+Israel/' },
  'רמת גן': { name: 'רמת גן', area: 'מחוז המרכז', migunTime: 90, population: 165000, zone: 'עיר גדולה', mapLink: 'https://www.google.com/maps/place/Ramat+Gan,+Israel/' },
  'גבעתיים': { name: 'גבעתיים', area: 'מחוז המרכז', migunTime: 90, population: 60000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Givatayim,+Israel/' },
  'רחובות': { name: 'רחובות', area: 'מחוז המרכז', migunTime: 90, population: 140000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Rehovot,+Israel/' },
  
  // Jerusalem District (מחוז ירושלים) - 90 seconds  
  'ירושלים': { name: 'ירושלים', area: 'מחוז ירושלים', migunTime: 90, population: 950000, zone: 'בירה', mapLink: 'https://www.google.com/maps/place/Jerusalem,+Israel/' },
  'בית שמש': { name: 'בית שמש', area: 'מחוז ירושלים', migunTime: 90, population: 130000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Beit+Shemesh,+Israel/' },
  
  // Northern District (מחוז הצפון) - 30-60 seconds
  'חיפה': { name: 'חיפה', area: 'מחוז הצפון', migunTime: 60, population: 285000, zone: 'עיר גדולה', mapLink: 'https://www.google.com/maps/place/Haifa,+Israel/' },
  'נצרת': { name: 'נצרת', area: 'מחוז הצפון', migunTime: 60, population: 77000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Nazareth,+Israel/' },
  'עכו': { name: 'עכו', area: 'מחוז הצפון', migunTime: 30, population: 49000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Acre,+Israel/' },
  'נהריה': { name: 'נהריה', area: 'מחוז הצפון', migunTime: 30, population: 60000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Nahariya,+Israel/' },
  'קריות': { name: 'קריות', area: 'מחוז הצפון', migunTime: 60, population: 220000, zone: 'אזור מטרופוליטני', mapLink: 'https://www.google.com/maps/place/Kiryat+Bialik,+Israel/' },
  'טבריה': { name: 'טבריה', area: 'מחוז הצפון', migunTime: 60, population: 48000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Tiberias,+Israel/' },
  
  // South District (מחוז הדרום) - 30-60 seconds
  'באר שבע': { name: 'באר שבע', area: 'מחוז הדרום', migunTime: 60, population: 210000, zone: 'עיר גדולה', mapLink: 'https://www.google.com/maps/place/Beersheba,+Israel/' },
  'אילת': { name: 'אילת', area: 'מחוז הדרום', migunTime: 180, population: 52000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Eilat,+Israel/' },
  'דימונה': { name: 'דימונה', area: 'מחוז הדרום', migunTime: 90, population: 35000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Dimona,+Israel/' },
  
  // Golan Heights (רמת הגולן) - 60 seconds
  'קצרין': { name: 'קצרין', area: 'רמת הגולן', migunTime: 60, population: 7000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Katzrin,+Israel/' },
  
  // West Bank Settlements (יהודה ושומרון) - 90 seconds
  'אריאל': { name: 'אריאל', area: 'יהודה ושומרון', migunTime: 90, population: 20000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Ariel,+Israel/' },
  'מעלה אדומים': { name: 'מעלה אדומים', area: 'יהודה ושומרון', migunTime: 90, population: 38000, zone: 'עיר', mapLink: 'https://www.google.com/maps/place/Maale+Adumim,+Israel/' }
};

/**
 * Get enhanced location data using local database with migun times
 */
async function getEnhancedLocationData(location: string): Promise<{ 
  name: string; 
  area: string; 
  mapLink: string; 
  migunTime?: number;
  population?: number;
  zone?: string;
}> {
  // Clean the location string
  const cleanLocation = location.replace(/[,;]/g, '').trim();
  
  // Try exact match first
  if (ENHANCED_LOCATION_DATA[cleanLocation]) {
    const data = ENHANCED_LOCATION_DATA[cleanLocation];
    return {
      name: data.name,
      area: data.area,
      mapLink: data.mapLink,
      migunTime: data.migunTime,
      population: data.population,
      zone: data.zone
    };
  }
  
  // Try partial matches for compound location names
  for (const [key, data] of Object.entries(ENHANCED_LOCATION_DATA)) {
    if (cleanLocation.includes(key) || key.includes(cleanLocation)) {
      return {
        name: cleanLocation, // Use the original location name
        area: data.area,
        mapLink: `https://www.google.com/maps/search/${encodeURIComponent(cleanLocation)}+Israel/`,
        migunTime: data.migunTime,
        population: data.population,
        zone: data.zone
      };
    }
  }
  
  // Try to match by area for compound locations
  const areaMatches = [
    { pattern: ['עוטף גזה', 'גזה'], area: 'עוטף גזה', migunTime: 15, zone: 'אזור מוגן מיוחד' },
    { pattern: ['שדרות', 'איבים', 'ניר עם'], area: 'עוטף גזה', migunTime: 15, zone: 'אזור מוגן מיוחד' },
    { pattern: ['תל אביב', 'גוש דן'], area: 'מחוז המרכז', migunTime: 90, zone: 'מטרופולין' },
    { pattern: ['ירושלים'], area: 'מחוז ירושלים', migunTime: 90, zone: 'בירה' },
    { pattern: ['חיפה', 'קריות'], area: 'מחוז הצפון', migunTime: 60, zone: 'צפון' },
    { pattern: ['גליל', 'צפון'], area: 'מחוז הצפון', migunTime: 60, zone: 'צפון' },
    { pattern: ['גולן', 'רמת הגולן'], area: 'רמת הגולן', migunTime: 60, zone: 'רמת הגולן' },
    { pattern: ['נגב', 'דרום'], area: 'מחוז הדרום', migunTime: 60, zone: 'דרום' }
  ];
  
  for (const match of areaMatches) {
    if (match.pattern.some(pattern => cleanLocation.includes(pattern))) {
      return {
        name: cleanLocation,
        area: match.area,
        mapLink: `https://www.google.com/maps/search/${encodeURIComponent(cleanLocation)}+Israel/`,
        migunTime: match.migunTime,
        zone: match.zone
      };
    }
  }
  
  // Fallback to basic mapping
  const basicData = getReadableLocationName(location);
  return {
    ...basicData,
    migunTime: 90, // Default shelter time
    zone: 'אזור לא מזוהה'
  };
}

/**
 * Get a readable location name in Hebrew with area mapping (fallback function)
 */
function getReadableLocationName(locationData: string): { name: string; area: string; mapLink: string } {
    if (!locationData || locationData.trim() === '') {
        return { 
            name: 'אזורים מרובים', 
            area: 'כל הארץ', 
            mapLink: 'https://www.google.com/maps/place/Israel/' 
        };
    }
    
    if (locationData === 'Unknown location') {
        return { 
            name: 'כל האזורים', 
            area: 'התראה כלל ארצית', 
            mapLink: 'https://www.google.com/maps/place/Israel/' 
        };
    }
    
    // Area mapping for major regions
    const areaMap: { [key: string]: { area: string; mapLink: string } } = {
        'תל אביב': { area: 'מחוז המרכז', mapLink: 'https://www.google.com/maps/place/Tel+Aviv,+Israel/' },
        'ירושלים': { area: 'מחוז ירושלים', mapLink: 'https://www.google.com/maps/place/Jerusalem,+Israel/' },
        'חיפה': { area: 'מחוז הצפון', mapLink: 'https://www.google.com/maps/place/Haifa,+Israel/' },
        'באר שבע': { area: 'מחוז הדרום', mapLink: 'https://www.google.com/maps/place/Beersheba,+Israel/' },
        'אשדוד': { area: 'מחוז הדרום', mapLink: 'https://www.google.com/maps/place/Ashdod,+Israel/' },
        'אשקלון': { area: 'מחוז הדרום', mapLink: 'https://www.google.com/maps/place/Ashkelon,+Israel/' },
        'גזה': { area: 'עוטף גזה', mapLink: 'https://www.google.com/maps/place/Gaza+Strip/' },
        'עוטף גזה': { area: 'עוטף גזה', mapLink: 'https://www.google.com/maps/place/Gaza+Strip/' },
        'גליל': { area: 'מחוז הצפון', mapLink: 'https://www.google.com/maps/place/Galilee,+Israel/' },
        'גולן': { area: 'רמת הגולן', mapLink: 'https://www.google.com/maps/place/Golan+Heights/' },
        'שפלה': { area: 'מחוז המרכז', mapLink: 'https://www.google.com/maps/place/Shephelah,+Israel/' },
        'יהודה': { area: 'יהודה ושומרון', mapLink: 'https://www.google.com/maps/place/West+Bank/' },
        'שומרון': { area: 'יהודה ושומרון', mapLink: 'https://www.google.com/maps/place/West+Bank/' }
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
    
    // Default fallback with search link
    return { 
        name: locationData, 
        area: 'אזור לא מזוהה', 
        mapLink: `https://www.google.com/maps/search/${encodeURIComponent(locationData)}+Israel/` 
    };
}

export async function startRedAlertTracker(client: Client) {
    console.log('Starting Red Alert tracking system...');
    
    // Validate channels on startup
    await validateAlertChannels(client);
    
    // Set an interval to check for alerts
    setInterval(async () => {
        try {
            // Check if we're within the minimum interval since the last alert
            const now = Date.now();
            if (now - lastAlertTimestamp < MIN_ALERT_INTERVAL) {
                return; // Skip this check to prevent spamming
            }
            
            // Fetch latest alerts with increased timeout and retries
            let attempts = 0;
            let success = false;
            let responseData;
            
            while (!success && attempts < 3) {
                try {
                    attempts++;
            const response = await axios.get(ALERT_API_URL, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://www.oref.org.il/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                        timeout: 15000 // Increased timeout to 15 seconds
            });
                    
                    responseData = response.data;
                    success = true;
                } catch (error: any) {
                    console.log(`Red Alert API fetch attempt ${attempts} failed: ${error.message || 'Unknown error'}`);
                    if (attempts < 3) {
                        // Wait for a bit before retrying
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                    }
                }
            }
            
            if (!success) {
                console.log('Red Alert API unavailable after multiple attempts. Will try again later.');
                return;
            }
            
            // Handle empty responses - the API returns empty responses when there are no alerts
            // If response is empty, null, undefined, or just whitespace - this is normal when no alerts
            if (!responseData || 
                (typeof responseData === 'string' && responseData.trim() === '') ||
                (typeof responseData === 'string' && responseData === '[]') ||
                (Array.isArray(responseData) && responseData.length === 0) ||
                Object.keys(responseData).length === 0) {
                return;
            }
            
            // Process the alerts
            try {
                let alertData;
                
                // If response is a string and not empty, try to parse it
                if (typeof responseData === 'string' && responseData.trim() !== '') {
                    try {
                        alertData = JSON.parse(responseData);
                    } catch (jsonError) {
                        // Instead of logging the raw response every time, just log that we received non-JSON data
                        // This is often normal when there are no alerts or when the API returns empty data
                        // Only log this once every 10 minutes to reduce spam
                        const now = Date.now();
                        const TEN_MINUTES = 10 * 60 * 1000;
                        
                        if (!global.lastNonJsonLogTime || now - global.lastNonJsonLogTime > TEN_MINUTES) {
                            console.log('Received non-JSON data from Red Alert API - this is usually normal when there are no active alerts');
                            // Keep track of the last time we logged this
                            global.lastNonJsonLogTime = now;
                        }
                        return;
                    }
                } else {
                    alertData = responseData;
                }
                
                // Check if we have data in the expected format
                if (!alertData || !alertData.data) {
                    // The API might return data in different formats
                    // If it's just an array, use it directly
                    const alerts = Array.isArray(alertData) ? alertData : 
                                  (alertData.data ? (Array.isArray(alertData.data) ? alertData.data : [alertData.data]) : 
                                  (Object.keys(alertData).length > 0 ? [alertData] : []));
                    
                    if (alerts.length === 0) {
                        return;
                    }
                    
                    for (const alert of alerts) {
                        // Create unique ID for the alert - use static fallback to prevent spam
                        // Make sure all properties exist before using them
                        const alertId = `${alert.alertDate || 'no-date'}-${alert.title || 'alert'}-${alert.data || 'unknown'}`;
                        
                        // Check if we've already processed this alert
                        if (!processedAlerts.has(alertId)) {
                            processedAlerts.add(alertId);
                            
                            // Log the alert for debugging
                            console.log(`Processing new red alert: ${alertId}`);
                            console.log(`Alert data:`, JSON.stringify(alert, null, 2));
                            
                            // Send the alert to all configured channels
                            await sendAlertToChannels(client, alert);
                            
                            // Prune old processed alerts (keep only the last 100)
                            if (processedAlerts.size > 100) {
                                const iterator = processedAlerts.values();
                                const firstValue = iterator.next().value;
                                if (firstValue !== undefined) {
                                    processedAlerts.delete(firstValue);
                                }
                            }
                        } else {
                            console.log(`Skipping duplicate alert: ${alertId}`);
                        }
                    }
                } else {
                    // Standard format with data property
                    const alerts = Array.isArray(alertData.data) ? alertData.data : [alertData.data];
                    
                    for (const alert of alerts) {
                        // Create unique ID for the alert - use static fallback to prevent spam
                        const alertId = `${alert.alertDate || 'no-date'}-${alert.title || 'alert'}-${alert.data || 'unknown'}`;
                        
                        // Check if we've already processed this alert
                        if (!processedAlerts.has(alertId)) {
                            processedAlerts.add(alertId);
                            
                            // Log the alert for debugging
                            console.log(`Processing new red alert: ${alertId}`);
                            console.log(`Alert data:`, JSON.stringify(alert, null, 2));
                            
                            // Send the alert to all configured channels
                            await sendAlertToChannels(client, alert);
                            
                            // Prune old processed alerts (keep only the last 100)
                            if (processedAlerts.size > 100) {
                                const iterator = processedAlerts.values();
                                const firstValue = iterator.next().value;
                                if (firstValue !== undefined) {
                                    processedAlerts.delete(firstValue);
                                }
                            }
                        } else {
                            console.log(`Skipping duplicate alert: ${alertId}`);
                        }
                    }
                }
            } catch (parseError) {
                console.error('Error processing alert data:', parseError);
                console.log('Raw response:', typeof responseData === 'string' ? responseData : JSON.stringify(responseData));
            }
        } catch (error) {
            console.error('Error fetching red alerts:', error);
            // Don't let a single error crash the entire system
        }
    }, CHECK_INTERVAL);
    
    console.log('Red Alert tracking system started successfully');
}

// Add a function to manually trigger a test alert
export async function sendTestAlert(client: Client, channelId: string) {
    try {
        const testAlert = {
            alertDate: new Date().toISOString(),
            title: 'TEST ALERT',
            data: 'Test Location',
            isTestAlert: true
        };
        
        let success = false;
        
        // First, try to send to the specified channel
        const channel = await client.channels.fetch(channelId);
        if (channel && channel instanceof TextChannel) {
            // Format time in 24-hour format for Israeli timezone (don't add 3 hours manually since timeZone handles it)
            const now = new Date();
            const timeString = now.toLocaleTimeString('he-IL', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false,
                timeZone: 'Asia/Jerusalem'
            });
            
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 צבע אדום - בדיקה 🚨')
                .setDescription('**זוהי התראת בדיקה בלבד**')
                .addFields(
                    { name: '🕒 זמן', value: timeString, inline: true },
                    { name: '📍 מיקום', value: 'בדיקה', inline: true },
                    { name: '⚠️ סטטוס', value: 'זוהי בדיקת מערכת בלבד. אין סכנה אמיתית.', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `בדיקת מערכת • ${timeString} • Made by Soggra.` });
            
            await channel.send({ embeds: [embed] });
            success = true;
            
            // Try to find which server this channel belongs to
            const guild = channel.guild;
            if (guild) {
                // Check if this channel is already registered for this server
                const alertChannels = await getAlertChannelsForGuild(guild.id);
                
                if (!alertChannels.includes(channelId)) {
                    logInfo('Red Alert Test', `Adding test channel ${channelId} to server ${guild.id}'s red alert channels`);
                    
                    // Add this channel to the server's red alert channels
                    await addChannelToRedAlerts(guild.id, channelId);
                }
            }
        }
        
        return success;
    } catch (error) {
        console.error('Error sending test alert:', error);
        return false;
    }
}

/**
 * Get all alert channels for a guild from the database
 */
async function getAlertChannelsForGuild(guildId: string): Promise<string[]> {
    try {
        // Get the channels from the database with proper type safety
        const channels = await ServerSettingsService.getSetting<string[]>(guildId, 'red_alert_channels');
        
        // If we got a valid array, return it
        if (Array.isArray(channels)) {
            return channels;
        }
        
        // If the setting is null or undefined, return an empty array
        return [];
    } catch (error) {
        logError('Red Alert', `Error getting alert channels for guild ${guildId}: ${error}`);
        return [];
    }
}

/**
 * Add a channel to a guild's red alert channels
 */
export async function addChannelToRedAlerts(guildId: string, channelId: string): Promise<boolean> {
    try {
        // Get existing channels
        const channels = await getAlertChannelsForGuild(guildId);
        
        // If the channel is already registered, no need to do anything
        if (channels.includes(channelId)) {
            return true;
        }
        
        // Add the channel
        channels.push(channelId);
        
        // Update the database
        const success = await ServerSettingsService.updateSettings(guildId, {
            guild_id: guildId,
            red_alert_channels: channels
        });
        
        if (success) {
            logInfo('Red Alert', `Added channel ${channelId} to guild ${guildId}'s red alert channels`);
        }
        
        return success;
    } catch (error) {
        logError('Red Alert', `Error adding channel ${channelId} to guild ${guildId}'s red alert channels: ${error}`);
        return false;
    }
}

/**
 * Remove a channel from a guild's red alert channels
 */
export async function removeChannelFromRedAlerts(guildId: string, channelId: string): Promise<boolean> {
    try {
        // Get existing channels
        const channels = await getAlertChannelsForGuild(guildId);
        
        // If the channel isn't registered, no need to do anything
        if (!channels.includes(channelId)) {
            return true;
        }
        
        // Remove the channel
        const updatedChannels = channels.filter(id => id !== channelId);
        
        // Update the database
        const success = await ServerSettingsService.updateSettings(guildId, {
            guild_id: guildId,
            red_alert_channels: updatedChannels
        });
        
        if (success) {
            logInfo('Red Alert', `Removed channel ${channelId} from guild ${guildId}'s red alert channels`);
        }
        
        return success;
    } catch (error) {
        logError('Red Alert', `Error removing channel ${channelId} from guild ${guildId}'s red alert channels: ${error}`);
        return false;
    }
}

// Add a function to validate channels and remove invalid ones
export async function validateAlertChannels(client: Client): Promise<Map<string, string[]>> {
    try {
        // Get all servers from the database
        const serverResult = await ServerSettingsService.listServers();
        
        // Map to store guild ID -> valid channel IDs
        const validChannelsMap = new Map<string, string[]>();
        
        // Check each server
        for (const server of serverResult.data) {
            // Get the channel IDs for this server
            let alertChannels = await getAlertChannelsForGuild(server.guild_id);
            const validChannels: string[] = [];
            const invalidChannels: string[] = [];
            
            // Skip if no channels
            if (!alertChannels || alertChannels.length === 0) {
                validChannelsMap.set(server.guild_id, []);
                continue;
            }
            
            // Check each channel
            for (const channelId of alertChannels) {
                try {
                    const channel = await client.channels.fetch(channelId);
                    if (channel && channel instanceof TextChannel) {
                        validChannels.push(channelId);
                    } else {
                        invalidChannels.push(channelId);
                        logWarning('Red Alert', `Channel ${channelId} in guild ${server.guild_id} is not a valid text channel and will be removed`);
                    }
                } catch (error) {
                    invalidChannels.push(channelId);
                    logWarning('Red Alert', `Channel ${channelId} in guild ${server.guild_id} is not accessible and will be removed`);
                }
            }
            
            // If we found invalid channels, update the database
            if (invalidChannels.length > 0) {
                logInfo('Red Alert', `Removing ${invalidChannels.length} invalid channels from guild ${server.guild_id}`);
                
                // Update the database
                await ServerSettingsService.updateSettings(server.guild_id, {
                    guild_id: server.guild_id,
                    red_alert_channels: validChannels
                });
            }
            
            // Store the valid channels for this guild
            validChannelsMap.set(server.guild_id, validChannels);
        }
        
        return validChannelsMap;
    } catch (error) {
        logError('Red Alert', `Error validating alert channels: ${error}`);
        return new Map<string, string[]>();
    }
}

/**
 * Send an alert to all configured channels across all servers
 */
async function sendAlertToChannels(client: Client, alert: any) {
    try {
        // Update last alert timestamp to prevent spamming
        lastAlertTimestamp = Date.now();
        
        // Extract location data
        const rawAlertData = alert.data;
        
        // Get alert type and enhanced location information
        const alertTypeInfo = getAlertType(alert.title);
        const locationInfo = await getEnhancedLocationData(rawAlertData);
        
        const alertDate = alert.alertDate ? new Date(alert.alertDate) : new Date();
        
        // Format time in 24-hour format for Israeli timezone (don't add 3 hours manually since timeZone handles it)
        const timeString = alertDate.toLocaleTimeString('he-IL', { 
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
        
        // Create enhanced embed with additional location data
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`${alertTypeInfo.emoji} ${alertTypeInfo.type} ${alertTypeInfo.emoji}`)
            .setDescription(`**${alertTypeInfo.description}**`)
            .addFields(
                { name: '🕒 זמן התראה', value: timeString, inline: true },
                { name: '📍 מיקום', value: `**${locationInfo.name}**\n*${locationInfo.area}*`, inline: true },
                { name: '🗺️ מפה', value: `[🔗 צפה במפה](${locationInfo.mapLink})`, inline: true }
            );

        // Add additional fields if we have enhanced data
        if (locationInfo.migunTime) {
            embed.addFields({
                name: '⏱️ זמן הגעה למרחב מוגן',
                value: `**${locationInfo.migunTime} שניות**`,
                inline: true
            });
        }

        if (locationInfo.population) {
            embed.addFields({
                name: '👥 אוכלוסייה',
                value: `**${locationInfo.population.toLocaleString('he-IL')} תושבים**`,
                inline: true
            });
        }

        if (locationInfo.zone) {
            embed.addFields({
                name: '🏢 אזור מגורים',
                value: `**${locationInfo.zone}**`,
                inline: true
            });
        }

        // Add guidance based on shelter time or default
        const shelterTime = locationInfo.migunTime || 90; // Default 90 seconds if not available
        embed.addFields({
            name: '⚠️ הנחיות בטיחות',
            value: alertTypeInfo.type === 'סיום מטח' 
                ? '✅ **ניתן לצאת מהמרחב המוגן בזהירות**\nהתראה בוטלה - המצב חזר לרגיל'
                : `🏃‍♂️ **להיכנס למרחב המוגן תוך ${shelterTime} שניות**\n🔒 להישאר במרחב למשך 10 דקות לפחות\n📱 לעקוב אחר הודעות נוספות`,
            inline: false
        });

        embed.setTimestamp()
            .setFooter({ text: `מערכת התראות מתקדמת • ${timeString} • נתונים: פיקוד העורף + TzofHaAretz` });
        
        // Get channels from the database for all servers
        const validChannelsMap = await validateAlertChannels(client);
        
        // If we didn't find any channels, log a warning
        if (validChannelsMap.size === 0) {
            logWarning('Red Alert', 'No valid channels configured for red alerts in any server');
            return;
        }
        
        // Track total channels for logging
        let totalChannelCount = 0;
        let successfulChannelCount = 0;
        
        // Send alerts to each server's channels
        for (const [guildId, channelIds] of validChannelsMap.entries()) {
            // Skip if no channels for this server
            if (channelIds.length === 0) {
                continue;
            }
            
            totalChannelCount += channelIds.length;
            
            // Send to each channel
            for (const channelId of channelIds) {
                try {
                    const channel = await client.channels.fetch(channelId);
                    if (channel && channel instanceof TextChannel) {
                        await channel.send({ embeds: [embed], content: '@everyone התראה!' });
                        successfulChannelCount++;
                    }
                } catch (channelError) {
                    logError('Red Alert', `Error sending to channel ${channelId} in guild ${guildId}: ${channelError}`);
                }
            }
        }
        
        // Log summary
        if (totalChannelCount > 0) {
            logInfo('Red Alert', `Sent alerts to ${successfulChannelCount}/${totalChannelCount} channels across ${validChannelsMap.size} servers`);
        }
    } catch (error) {
        logError('Red Alert', `Error sending alert to channels: ${error}`);
    }
} 