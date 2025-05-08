import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, AutocompleteInteraction } from 'discord.js';
import axios from 'axios';
import { SlashCommandBuilder } from '@discordjs/builders';

// In case config module isn't created yet, we'll import environment variables directly
import dotenv from 'dotenv';
dotenv.config();

const weatherApiKey = process.env.WEATHER_API_KEY || '';

// Cache for city suggestions to limit API calls
const cityCache = new Map<string, any[]>();

// List of popular cities for suggestions (removed Hebrew names)
const popularCities = [
    'Tel Aviv',
    'Jerusalem',
    'Haifa',
    'Beer Sheva',
    'Eilat',
    'Netanya',
    'Ashdod',
    'Ashkelon',
    'Herzliya',
    'Rishon LeZion',
    'Petah Tikva',
    'Holon',
    'Bat Yam',
    'Kiryat Yam',
    'Kiryat Gat',
    'Kiryat Shmona',
    'Kiryat Bialik',
    'Kiryat Motzkin',
    'Nahariya',
    'Acre',
    'Tiberias',
    'Rehovot',
    'Kfar Saba',
    'Ramat Gan',
    'Givataim'
];

export const data = new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get the current weather for a location')
    .addStringOption(option =>
        option.setName('location')
            .setDescription('The city name')
            .setRequired(true)
            .setAutocomplete(true));

// Handle autocomplete requests for city names
export async function autocomplete(interaction: AutocompleteInteraction) {
    try {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        let choices: { name: string, value: string }[] = [];

        // If user typed less than 2 characters, return popular cities
        if (!focusedValue || focusedValue.length < 2) {
            choices = popularCities.slice(0, 25).map(city => ({
                name: city,
                value: city
            }));
        } else {
            // Filter cities based on input
            choices = popularCities
                .filter(city => city.toLowerCase().includes(focusedValue))
                .map(city => ({
                    name: city,
                    value: city
                }));
        }

        // Respond with matched choices, limited to 25 as per Discord's requirements
        await interaction.respond(choices.slice(0, 25));
    } catch (error) {
        console.error('Error handling autocomplete:', error);
        // Respond with empty array in case of error to not break the autocomplete flow
        await interaction.respond([]);
    }
}

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        // Acknowledge the interaction immediately to prevent timeout
        await interaction.deferReply();
        
        const location = interaction.options.getString('location');
        
        if (!location) {
            await interaction.editReply('Please provide a valid location.');
            return;
        }

        // Check if API key is available
        if (!weatherApiKey) {
            await interaction.editReply('Weather API key is not configured. Please add a WEATHER_API_KEY to your .env file.');
            return;
        }
        
        try {
            const response = await axios.get(
                `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${weatherApiKey}&units=metric`
            );

            const weather = response.data;
            const temperature = Math.round(weather.main.temp);
            const feelsLike = Math.round(weather.main.feels_like);
            const description = weather.weather[0].description;
            const humidity = weather.main.humidity;
            const windSpeed = weather.wind.speed;

            // Choose appropriate emoji based on weather condition
            let weatherEmoji = '☀️'; // Default sunny
            const weatherCode = weather.weather[0].id;
            if (weatherCode >= 200 && weatherCode < 300) weatherEmoji = '⛈️'; // Thunderstorm
            else if (weatherCode >= 300 && weatherCode < 400) weatherEmoji = '🌧️'; // Drizzle
            else if (weatherCode >= 500 && weatherCode < 600) weatherEmoji = '🌧️'; // Rain
            else if (weatherCode >= 600 && weatherCode < 700) weatherEmoji = '❄️'; // Snow
            else if (weatherCode >= 700 && weatherCode < 800) weatherEmoji = '🌫️'; // Atmosphere (fog, mist)
            else if (weatherCode === 800) weatherEmoji = '☀️'; // Clear
            else if (weatherCode > 800) weatherEmoji = '☁️'; // Clouds

            const weatherEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${weatherEmoji} Weather in ${weather.name}, ${weather.sys.country}`)
                .setDescription(`**${description.charAt(0).toUpperCase() + description.slice(1)}**`)
                .addFields(
                    { name: '🌡️ Temperature', value: `${temperature}°C (Feels like: ${feelsLike}°C)`, inline: true },
                    { name: '💧 Humidity', value: `${humidity}%`, inline: true },
                    { name: '💨 Wind Speed', value: `${windSpeed} m/s`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Weather data provided by OpenWeatherMap' });

            await interaction.editReply({ embeds: [weatherEmbed] });
        } catch (error: any) {
            console.error('Weather command error:', error);
            
            // Check if it's an API key error
            if (error.response?.status === 401) {
                await interaction.editReply('Invalid or missing API key. Please check your WEATHER_API_KEY in the .env file.');
            } else if (error.response?.status === 404) {
                await interaction.editReply(`City not found: "${location}". Please check the spelling or try another city.`);
            } else {
                await interaction.editReply('Sorry, I couldn\'t fetch the weather data. Please try again later.');
            }
        }
    } catch (interactionError) {
        console.error('Error with interaction:', interactionError);
        // Try to respond with a fallback if the interaction is still valid
        try {
            if (!interaction.replied) {
                await interaction.reply({ content: 'An error occurred while processing the command.', flags: MessageFlags.Ephemeral });
            }
        } catch (fallbackError) {
            console.error('Could not send fallback response:', fallbackError);
        }
    }
} 