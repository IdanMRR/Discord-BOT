import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

// API endpoint for alerts
const ALERT_API_URL = 'https://www.oref.org.il/WarningMessages/alert/alerts.json';
const CHECK_INTERVAL = 10000; // Check every 10 seconds

// Set of already processed alerts to avoid duplicates
const processedAlerts = new Set<string>();

export async function startRedAlertTracker(client: Client) {
    console.log('Starting Red Alert tracking system...');
    
    // Set an interval to check for alerts
    setInterval(async () => {
        try {
            // Fetch latest alerts
            const response = await axios.get(ALERT_API_URL, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://www.oref.org.il/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 5000
            });
            
            // Handle empty responses - the API returns empty responses when there are no alerts
            const responseData = response.data;
            
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
                        console.log('Received non-JSON data:', responseData);
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
        
        const channel = await client.channels.fetch(channelId);
        if (channel && channel instanceof TextChannel) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 RED ALERT - TEST 🚨')
                .setDescription('**This is only a test alert**')
                .addFields(
                    { name: 'Time', value: new Date().toLocaleTimeString(), inline: true },
                    { name: 'Location', value: 'Test', inline: true },
                    { name: 'Status', value: 'This is only a system test. There is no real danger.', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'System Test' });
            
            await channel.send({ embeds: [embed] });
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error sending test alert:', error);
        return false;
    }
}

async function sendAlertToChannels(client: Client, alert: any) {
    try {
        // Get list of channel IDs from environment variable
        const alertChannelIds = (process.env.RED_ALERT_CHANNEL_IDS || '').split(',').filter(id => id);
        
        if (alertChannelIds.length === 0) {
            console.warn('No channels configured for red alerts. Set RED_ALERT_CHANNEL_IDS in .env');
            return;
        }
        
        // Ensure all required properties exist with fallbacks
        const alertData = alert.data || 'Unknown location';
        const alertDate = alert.alertDate ? new Date(alert.alertDate) : new Date();
        
        // Create the embed
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 RED ALERT 🚨')
            .setDescription(`**Active alert in: ${alertData}**`)
            .addFields(
                { name: 'Alert Time', value: alertDate.toLocaleTimeString(), inline: true },
                { name: 'Instructions', value: 'Enter shelter immediately and stay for 10 minutes', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Alert System Information' });
        
        // Send to all configured channels
        for (const channelId of alertChannelIds) {
            try {
                const channel = await client.channels.fetch(channelId);
                if (channel && channel instanceof TextChannel) {
                    await channel.send({ embeds: [embed], content: '@everyone ALERT!' });
                }
            } catch (channelError) {
                console.error(`Error sending to channel ${channelId}:`, channelError);
            }
        }
    } catch (error) {
        console.error('Error sending alert to channels:', error);
    }
} 