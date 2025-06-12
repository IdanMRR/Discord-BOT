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
// Minimum time between alerts in milliseconds (30 seconds)
const MIN_ALERT_INTERVAL = 30000;

/**
 * Get a readable location name in Hebrew
 */
function getReadableLocationName(locationData: string): string {
    if (!locationData || locationData.trim() === '') {
        return 'אזורים מרובים - היכנסו למרחב המוגן מיד';
    }
    
    if (locationData === 'Unknown location') {
        return 'כל האזורים - התראה כלל ארצית';
    }
    
    // Return the original Hebrew location name
    return locationData;
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
                        // Create unique ID for the alert
                        // Make sure all properties exist before using them
                        const alertId = `${alert.alertDate || new Date().toISOString()}-${alert.title || 'alert'}-${alert.data || 'unknown'}`;
                        
                        // Check if we've already processed this alert
                        if (!processedAlerts.has(alertId)) {
                            processedAlerts.add(alertId);
                            
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
                        }
                    }
                } else {
                    // Standard format with data property
                    const alerts = Array.isArray(alertData.data) ? alertData.data : [alertData.data];
                    
                    for (const alert of alerts) {
                        // Create unique ID for the alert
                        const alertId = `${alert.alertDate || new Date().toISOString()}-${alert.title || 'alert'}-${alert.data || 'unknown'}`;
                        
                        // Check if we've already processed this alert
                        if (!processedAlerts.has(alertId)) {
                            processedAlerts.add(alertId);
                            
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
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 צבע אדום - בדיקה 🚨')
                .setDescription('**זוהי התראת בדיקה בלבד**')
                .addFields(
                    { name: 'זמן', value: new Date().toLocaleTimeString(), inline: true },
                    { name: 'מיקום', value: 'בדיקה', inline: true },
                    { name: 'סטטוס', value: 'זוהי בדיקת מערכת בלבד. אין סכנה אמיתית.', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'בדיקת מערכת • Made by Soggra.' });
            
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
        
        // Get a user-friendly location name in Hebrew
        const alertData = getReadableLocationName(rawAlertData);
        
        const alertDate = alert.alertDate ? new Date(alert.alertDate) : new Date();
        
        // Create the embed
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 צבע אדום 🚨')
            .setDescription(`**התראה פעילה ב: ${alertData}**`)
            .addFields(
                { name: 'זמן התראה', value: alertDate.toLocaleTimeString(), inline: true },
                { name: 'הנחיות', value: 'להיכנס למרחב המוגן מיד ולהישאר למשך 10 דקות', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'מערכת התראות • היום בשעה ' + alertDate.toLocaleTimeString().substring(0, 5) + ' • Made by Soggra.' });
        
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