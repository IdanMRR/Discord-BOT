import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as schedule from 'node-schedule';
import { settingsManager } from '../../utils/settings';
import { db } from '../../database/sqlite';

dotenv.config();

// Using the Tomorrow.io API key
const weatherApiKey = 'fol7rHZCIz9NqkejmallpAACKL2YmMCZ';

// Default cities to report on (Israeli cities)
const defaultCities = [
  { name: 'Tel Aviv', country: 'Israel', lat: 32.0853, lon: 34.7818 },
  { name: 'Jerusalem', country: 'Israel', lat: 31.7683, lon: 35.2137 },
  { name: 'Haifa', country: 'Israel', lat: 32.7940, lon: 34.9896 }
];

// Keeping track of the server-channel mappings
interface WeatherChannelMapping {
  [guildId: string]: string; // guildId -> channelId
}

// Interface for city data
interface CityData {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

// Keeping track of custom city configurations
interface ServerCitiesMapping {
  [guildId: string]: CityData[];
}

// In-memory cache of configured weather channels
export const weatherChannels: WeatherChannelMapping = {};

// In-memory cache of custom cities per server
const serverCities: ServerCitiesMapping = {};

// Flag to track if weather update is currently running
let isWeatherUpdateRunning = false;

// Last update time to prevent rate limiting
let lastUpdateTime = 0;
const MIN_UPDATE_INTERVAL = 60000; // At least 1 minute between updates

/**
 * Load all configured weather channels from database into memory
 */
async function loadWeatherChannels(): Promise<void> {
  try {
    console.log('Loading configured weather channels from database...');
    
    // Get weather channels with valid non-empty values
    const settings = db.prepare("SELECT guild_id, weather_channel_id, custom_cities FROM server_settings WHERE weather_channel_id IS NOT NULL AND weather_channel_id != ''").all() as any[];
    
    if (settings.length === 0) {
      console.log('No weather channels configured in the database');
      return;
    }
    
    console.log(`Found ${settings.length} configured weather channels in database`);
    
    for (const setting of settings) {
      if (setting.weather_channel_id) {
        weatherChannels[setting.guild_id] = setting.weather_channel_id;
      }
      
      // Load custom cities if available
      if (setting.custom_cities) {
        try {
          const cities = JSON.parse(setting.custom_cities);
          if (Array.isArray(cities) && cities.length > 0) {
            serverCities[setting.guild_id] = cities;
          }
        } catch (parseError) {
          console.error(`Error parsing custom cities for guild ${setting.guild_id}:`, parseError);
        }
      }
    }
    
    console.log(`Loaded ${Object.keys(weatherChannels).length} weather channels and ${Object.keys(serverCities).length} custom city configurations`);
  } catch (error) {
    console.error('Error loading weather channels from database:', error);
  }
}

/**
 * Initialize the weather scheduler
 * @param client Discord client
 */
export async function initWeatherScheduler(client: Client): Promise<void> {
  try {
    console.log('Initializing weather scheduler...');
    
    // First load all configured weather channels from database
    await loadWeatherChannels();
    
    // Schedule daily weather report at 8:00 AM Israel time (UTC+3)
    // '0 5 * * *' is 5:00 AM UTC which is 8:00 AM Israel time (UTC+3)
    schedule.scheduleJob('0 5 * * *', async () => {
      await sendDailyWeatherUpdates(client);
    });
    
    console.log('Weather scheduler initialized: daily report at 8:00 AM Israel time (UTC+3)');
  } catch (error) {
    console.error('Error initializing weather scheduler:', error);
  }
}

/**
 * Set the weather channel for automated updates
 * @param guildId The Discord server ID
 * @param channelId The Discord channel ID
 */
export async function setWeatherChannel(guildId: string, channelId: string): Promise<boolean> {
  try {
    console.log(`Setting weather channel for guild ${guildId} to ${channelId}`);
    
    // Method 1: Use the settings manager (standard way)
    const success = await settingsManager.setSetting(guildId, 'weather_channel_id', channelId);
    
    // Method 2: As a backup, also try direct database operations
    try {
      // Check if record exists
      const checkRecord = db.prepare("SELECT guild_id FROM server_settings WHERE guild_id = ?").get(guildId);
      
      if (checkRecord) {
        // UPDATE existing record
        db.prepare("UPDATE server_settings SET weather_channel_id = ? WHERE guild_id = ?").run(channelId, guildId);
      } else {
        // INSERT new record
        db.prepare("INSERT INTO server_settings (guild_id, weather_channel_id) VALUES (?, ?)").run(guildId, channelId);
      }
    } catch (dbError) {
      console.error(`Direct database update failed for guild ${guildId}:`, dbError);
    }
    
    // Update in-memory cache
    weatherChannels[guildId] = channelId;
    
    // Verify the update
    const verification = db.prepare("SELECT weather_channel_id FROM server_settings WHERE guild_id = ?").get(guildId) as any;
    
    if (verification && verification.weather_channel_id === channelId) {
      console.log(`Successfully set weather channel for guild ${guildId}`);
      return true;
    }
    
    // If verification failed but we still updated the cache, return success from settings manager
    if (success) {
      console.log(`Settings manager reports success for guild ${guildId}`);
      return true;
    }
    
    console.error(`Failed to save weather channel settings for guild ${guildId}`);
    return false;
  } catch (error) {
    console.error(`Error setting weather channel for guild ${guildId}:`, error);
    return false;
  }
}

/**
 * Set custom cities for a server
 * @param guildId The Discord server ID
 * @param cities Array of city data
 */
export async function setCustomCities(guildId: string, cities: CityData[]): Promise<boolean> {
  try {
    console.log(`Setting custom cities for guild ${guildId}: ${cities.length} cities`);
    
    // Convert cities array to JSON string
    const citiesJson = JSON.stringify(cities);
    
    // Update in settings manager
    const success = await settingsManager.setSetting(guildId, 'custom_cities', citiesJson);
    
    // Also try direct database update as backup
    try {
      const checkRecord = db.prepare("SELECT guild_id FROM server_settings WHERE guild_id = ?").get(guildId);
      
      if (checkRecord) {
        db.prepare("UPDATE server_settings SET custom_cities = ? WHERE guild_id = ?").run(citiesJson, guildId);
      } else {
        db.prepare("INSERT INTO server_settings (guild_id, custom_cities) VALUES (?, ?)").run(guildId, citiesJson);
      }
    } catch (dbError) {
      console.error(`Direct database update failed for custom cities in guild ${guildId}:`, dbError);
    }
    
    // Update in-memory cache
    serverCities[guildId] = cities;
    
    // Return success from settings manager
    if (success) {
      console.log(`Successfully set custom cities for guild ${guildId}`);
      return true;
    }
    
    console.error(`Failed to save custom cities to database for guild ${guildId}`);
    return false;
  } catch (error) {
    console.error(`Error setting custom cities for guild ${guildId}:`, error);
    return false;
  }
}

/**
 * Get custom cities for a specific guild
 * @param guildId The Discord server ID
 */
export async function getCustomCities(guildId: string): Promise<CityData[]> {
  try {
    // First check the in-memory cache
    if (serverCities[guildId] && serverCities[guildId].length > 0) {
      return serverCities[guildId];
    }
    
    // If not in cache, check the database
    const settings = await settingsManager.getSettings(guildId);
    
    if (settings && settings.custom_cities) {
      try {
        const cities = JSON.parse(settings.custom_cities);
        if (Array.isArray(cities) && cities.length > 0) {
          // Update the cache
          serverCities[guildId] = cities;
          return cities;
        }
      } catch (parseError) {
        console.error(`Error parsing custom cities for guild ${guildId}:`, parseError);
      }
    }
    
    // Return default cities if no custom cities are configured
    return defaultCities;
  } catch (error) {
    console.error(`Error getting custom cities for guild ${guildId}:`, error);
    return defaultCities;
  }
}

/**
 * Get weather channel ID for a specific guild
 * @param guildId The Discord server ID
 */
export async function getWeatherChannel(guildId: string): Promise<string | null> {
  try {
    // First check the in-memory cache
    if (weatherChannels[guildId]) {
      return weatherChannels[guildId];
    }
    
    // If not in cache, check the database
    const settings = await settingsManager.getSettings(guildId);
    
    const channelId = settings.weather_channel_id;
    
    if (channelId) {
      // Update the cache
      weatherChannels[guildId] = channelId;
      return channelId;
    }
    
    console.log(`No weather channel configured for guild ${guildId}`);
    return null;
  } catch (error) {
    console.error(`Error getting weather channel for guild ${guildId}:`, error);
    return null;
  }
}

/**
 * Send daily weather updates to all configured channels
 * @param client Discord client
 */
async function sendDailyWeatherUpdates(client: Client): Promise<void> {
  try {
    // Check if another update is already running
    if (isWeatherUpdateRunning) {
      console.log('Weather update already in progress. Skipping this run.');
      return;
    }
    
    // Check if we're within the rate limit window
    const now = Date.now();
    if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) {
      console.log('Rate limit prevention: Weather update called too soon after previous update. Skipping.');
      return;
    }
    
    // Set flag to prevent concurrent updates
    isWeatherUpdateRunning = true;
    lastUpdateTime = now;
    
    // Get all guilds the bot is in
    const guilds = client.guilds.cache.values();
    console.log(`Found ${client.guilds.cache.size} guilds to check for weather channels`);
    
    for (const guild of guilds) {
      try {
        const channelId = await getWeatherChannel(guild.id);
        
        if (channelId) {
          console.log(`Sending weather update to guild ${guild.id}`);
          await sendDailyWeatherUpdate(client, guild.id, channelId);
          
          // Add delay between server updates to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (guildError) {
        console.error(`Error sending weather update to guild ${guild.id}:`, guildError);
      }
    }
    
    // Reset flag when done
    isWeatherUpdateRunning = false;
  } catch (error) {
    console.error('Error sending daily weather updates:', error);
    // Make sure to reset the flag even if there's an error
    isWeatherUpdateRunning = false;
  }
}

/**
 * Send a daily weather update to the configured channel
 * @param client Discord client
 * @param guildId Discord server ID
 * @param channelId Discord channel ID
 */
async function sendDailyWeatherUpdate(client: Client, guildId: string, channelId: string): Promise<void> {
  try {
    // Try to get the channel
    const channel = await client.channels.fetch(channelId);
    
    if (!channel) {
      console.error(`Channel ${channelId} not found for guild ${guildId}`);
      return;
    }
    
    if (!(channel instanceof TextChannel)) {
      console.error(`Channel ${channelId} is not a text channel for guild ${guildId}`);
      return;
    }
    
    // Current date in Israel time format
    const nowInIsrael = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const dateString = nowInIsrael.toLocaleDateString('en-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Create the daily header embed
    const headerEmbed = new EmbedBuilder()
      .setColor(0x00BFFF)
      .setTitle(`☀️ Daily Weather Report - ${dateString}`)
      .setDescription('Good morning! Here\'s your daily weather forecast for major cities:')
      .setTimestamp()
      .setFooter({ text: 'Automated Weather Report • Made By Soggra' });
    
    // Send the header
    await channel.send({ embeds: [headerEmbed] });
    
    // Get cities for this guild (custom or default)
    const citiesToReport = await getCustomCities(guildId);
    
    // Send individual city forecasts with delay between them to avoid API rate limiting
    for (const city of citiesToReport) {
      try {
        console.log(`Getting weather for ${city.name}, ${city.country}`);
        const weatherEmbed = await getWeatherEmbed(city.name, city.country, city.lat, city.lon);
        await channel.send({ embeds: [weatherEmbed] });
        
        // Add longer delay between API calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (cityError: any) {
        console.error(`Error getting weather for ${city.name}:`, cityError);
        
        // If we hit a rate limit, send a placeholder message
        if (cityError.response && cityError.response.status === 429) {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(`⚠️ Weather API Rate Limited - ${city.name}, ${city.country}`)
            .setDescription('We\'ve reached the API rate limit. Weather data will be available in the next update.')
            .setFooter({ text: 'Weather data provided by Tomorrow.io • Made By Soggra' });
          
          await channel.send({ embeds: [errorEmbed] });
        }
      }
    }
    
    console.log(`Daily weather update sent to channel ${channelId} in guild ${guildId}`);
  } catch (error) {
    console.error(`Error sending daily weather update to guild ${guildId}:`, error);
  }
}

/**
 * Get weather conditions emoji based on weather code
 * @param weatherCode Weather code from Tomorrow.io API
 */
function getWeatherEmoji(weatherCode: string): string {
  // Tomorrow.io weather codes - https://docs.tomorrow.io/reference/data-layers-weather-codes
  switch (weatherCode) {
    case '1000': // Clear, Sunny
      return '☀️';
    case '1100': // Mostly Clear
    case '1101': // Partly Cloudy
      return '🌤️';
    case '1102': // Mostly Cloudy
    case '1001': // Cloudy
      return '☁️';
    case '2000': // Fog
      return '🌫️';
    case '4000': // Drizzle
      return '🌧️';
    case '4001': // Rain
      return '🌧️';
    case '4200': // Light Rain
    case '4201': // Heavy Rain
      return '🌧️';
    case '5000': // Snow
    case '5001': // Flurries
    case '5100': // Light Snow
    case '5101': // Heavy Snow
      return '❄️';
    case '6000': // Freezing Drizzle
    case '6001': // Freezing Rain
    case '6200': // Light Freezing Rain
    case '6201': // Heavy Freezing Rain
      return '🌨️';
    case '7000': // Ice Pellets
    case '7101': // Heavy Ice Pellets
    case '7102': // Light Ice Pellets
      return '🧊';
    case '8000': // Thunderstorm
      return '⛈️';
    default:
      return '🌡️'; // Default thermometer
  }
}

/**
 * Create a weather description based on weather code
 * @param weatherCode Weather code from Tomorrow.io API
 */
function getWeatherDescription(weatherCode: string): string {
  switch (weatherCode) {
    case '1000': return 'Clear, Sunny'; 
    case '1100': return 'Mostly Clear'; 
    case '1101': return 'Partly Cloudy'; 
    case '1102': return 'Mostly Cloudy'; 
    case '1001': return 'Cloudy'; 
    case '2000': return 'Fog'; 
    case '4000': return 'Drizzle'; 
    case '4001': return 'Rain'; 
    case '4200': return 'Light Rain'; 
    case '4201': return 'Heavy Rain'; 
    case '5000': return 'Snow'; 
    case '5001': return 'Flurries'; 
    case '5100': return 'Light Snow'; 
    case '5101': return 'Heavy Snow'; 
    case '6000': return 'Freezing Drizzle'; 
    case '6001': return 'Freezing Rain'; 
    case '6200': return 'Light Freezing Rain'; 
    case '6201': return 'Heavy Freezing Rain'; 
    case '7000': return 'Ice Pellets'; 
    case '7101': return 'Heavy Ice Pellets'; 
    case '7102': return 'Light Ice Pellets'; 
    case '8000': return 'Thunderstorm'; 
    default: return 'Unknown Weather Condition'; 
  }
}

/**
 * Get a weather embed for a specific city
 * @param location City name
 * @param country Country name
 * @param lat Latitude
 * @param lon Longitude
 */
async function getWeatherEmbed(location: string, country: string, lat: number, lon: number): Promise<EmbedBuilder> {
  try {
    // Call the Tomorrow.io API
    const response = await axios.get(
      `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lon}&apikey=${weatherApiKey}`
    );
    
    const data = response.data;
    
    // Extract current weather data
    const currentWeather = data.timelines.minutely[0].values;
    
    // Get daily forecast for next 3 days
    const dailyForecast = data.timelines.daily.slice(0, 3);
    
    // Get weather code and emoji
    const weatherCode = currentWeather.weatherCode.toString();
    const weatherEmoji = getWeatherEmoji(weatherCode);
    const weatherDescription = getWeatherDescription(weatherCode);
    
    // Create the embed
    const weatherEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`${weatherEmoji} Weather in ${location}, ${country}`)
      .setDescription(`**Current Conditions: ${weatherDescription}**`)
      .addFields(
        { name: '🌡️ Temperature', value: `${Math.round(currentWeather.temperature)}°C`, inline: true },
        { name: '🌡️ Feels Like', value: `${Math.round(currentWeather.temperatureApparent)}°C`, inline: true },
        { name: '💧 Humidity', value: `${Math.round(currentWeather.humidity)}%`, inline: true },
        { name: '💨 Wind Speed', value: `${Math.round(currentWeather.windSpeed)} km/h`, inline: true },
        { name: '☔ Precipitation', value: `${Math.round(currentWeather.precipitationProbability)}%`, inline: true },
        { name: '☁️ Cloud Cover', value: `${Math.round(currentWeather.cloudCover)}%`, inline: true }
      );
    
    // Add daily forecast
    let dailyForecastText = '';
    for (const day of dailyForecast) {
      const date = new Date(day.time).toLocaleDateString('en-IL', { weekday: 'short', month: 'short', day: 'numeric' });
      const tempMax = Math.round(day.values.temperatureMax);
      const tempMin = Math.round(day.values.temperatureMin);
      const emoji = getWeatherEmoji(day.values.weatherCodeMax.toString());
      dailyForecastText += `${emoji} **${date}**: ${tempMin}°C - ${tempMax}°C\n`;
    }
    
    if (dailyForecastText) {
      weatherEmbed.addFields({ name: '📅 3-Day Forecast', value: dailyForecastText, inline: false });
    }
    
    weatherEmbed.setFooter({ text: 'Weather data provided by Tomorrow.io • Made By Soggra' });
    
    return weatherEmbed;
  } catch (error) {
    console.error(`Error getting weather for ${location}:`, error);
    
    // Return a basic error embed
    return new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle(`❌ Weather Error - ${location}, ${country}`)
      .setDescription('Sorry, I couldn\'t fetch the weather data for this location.')
      .setFooter({ text: 'Weather data provided by Tomorrow.io • Made By Soggra' });
  }
}

/**
 * Ensures the database column exists
 */
export async function checkWeatherDatabaseSetup(): Promise<void> {
  try {
    // Check if the column exists in the table structure
    const tableInfo = db.prepare("PRAGMA table_info(server_settings)").all() as any[];
    
    // Check for weather_channel_id column
    const weatherColumn = tableInfo.find(col => col.name === 'weather_channel_id');
    if (!weatherColumn) {
      db.prepare("ALTER TABLE server_settings ADD COLUMN weather_channel_id TEXT").run();
      console.log('Added weather_channel_id column to server_settings table');
    }
    
    // Check for custom_cities column
    const citiesColumn = tableInfo.find(col => col.name === 'custom_cities');
    if (!citiesColumn) {
      db.prepare("ALTER TABLE server_settings ADD COLUMN custom_cities TEXT").run();
      console.log('Added custom_cities column to server_settings table');
    }
  } catch (error) {
    console.error('Error ensuring weather columns exist:', error);
  }
} 