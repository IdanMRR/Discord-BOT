import dotenv from 'dotenv';
dotenv.config();

export const config = {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.CLIENT_ID || '',
    guildId: process.env.GUILD_ID || '',
    weatherApiKey: process.env.WEATHER_API_KEY || '',
    // Add other configuration variables as needed
}; 