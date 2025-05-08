import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, AutocompleteInteraction } from 'discord.js';
import axios from 'axios';
import { SlashCommandBuilder } from '@discordjs/builders';

// In case config module isn't created yet, we'll import environment variables directly
import dotenv from 'dotenv';
dotenv.config();

// Using the Tomorrow.io API key provided
const weatherApiKey = 'fol7rHZCIz9NqkejmallpAACKL2YmMCZ';

// Cache for city suggestions to limit API calls
const cityCache = new Map<string, any[]>();

// Define countries and their cities
interface CountryCities {
    [country: string]: string[];
}

const countriesAndCities: CountryCities = {
    'Israel': [
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
        'Acre', // Akko
        'Tiberias',
        'Rehovot',
        'Kfar Saba',
        'Ramat Gan',
        'Givataim',
        'Nazareth',
        'Lod',
        'Ramla',
        'Afula',
        'Karmiel',
        'Modi\'in',
        'Dimona',
        'Beit Shemesh',
        'Maalot-Tarshiha',
        'Or Akiva',
        'Safed',
        'Rosh HaAyin',
        'Yokneam',
        'Caesarea',
        'Zichron Yaakov',
        'Binyamina',
        'Pardes Hanna-Karkur'
    ],
    'United States': [
        'New York',
        'Los Angeles',
        'Chicago',
        'Houston',
        'Phoenix',
        'Philadelphia',
        'San Antonio',
        'San Diego',
        'Dallas',
        'San Jose',
        'Austin',
        'Jacksonville',
        'San Francisco',
        'Columbus',
        'Indianapolis',
        'Fort Worth',
        'Charlotte',
        'Seattle',
        'Denver',
        'Washington DC'
    ],
    'United Kingdom': [
        'London',
        'Birmingham',
        'Manchester',
        'Glasgow',
        'Liverpool',
        'Leeds',
        'Sheffield',
        'Edinburgh',
        'Bristol',
        'Cardiff',
        'Belfast',
        'Leicester',
        'Aberdeen',
        'Cambridge',
        'Oxford'
    ]
};

// Get list of all cities for autocomplete
const allCities: string[] = Object.values(countriesAndCities).flat();

// Map of coordinates for cities to use with Tomorrow.io API
const cityCoordinates: Record<string, { lat: number, lon: number }> = {
    // Israel
    'Tel Aviv': { lat: 32.0853, lon: 34.7818 },
    'Jerusalem': { lat: 31.7683, lon: 35.2137 },
    'Haifa': { lat: 32.7940, lon: 34.9896 },
    'Beer Sheva': { lat: 31.2530, lon: 34.7915 },
    'Eilat': { lat: 29.5577, lon: 34.9519 },
    'Netanya': { lat: 32.3215, lon: 34.8532 },
    'Ashdod': { lat: 31.8162, lon: 34.6551 },
    'Ashkelon': { lat: 31.6691, lon: 34.5715 },
    'Herzliya': { lat: 32.1660, lon: 34.8447 },
    'Rishon LeZion': { lat: 31.9714, lon: 34.7892 },
    'Petah Tikva': { lat: 32.0877, lon: 34.8867 },
    'Holon': { lat: 32.0159, lon: 34.7795 },
    'Bat Yam': { lat: 32.0200, lon: 34.7510 },
    'Kiryat Yam': { lat: 32.8493, lon: 35.0689 },
    'Kiryat Gat': { lat: 31.6100, lon: 34.7642 },
    'Kiryat Shmona': { lat: 33.2075, lon: 35.5708 },
    'Kiryat Bialik': { lat: 32.8275, lon: 35.0869 },
    'Kiryat Motzkin': { lat: 32.8358, lon: 35.0836 },
    'Nahariya': { lat: 33.0127, lon: 35.0950 },
    'Acre': { lat: 32.9281, lon: 35.0821 }, // Akko
    'Tiberias': { lat: 32.7959, lon: 35.5300 },
    'Rehovot': { lat: 31.8928, lon: 34.8113 },
    'Kfar Saba': { lat: 32.1844, lon: 34.9007 },
    'Ramat Gan': { lat: 32.0825, lon: 34.8118 },
    'Givataim': { lat: 32.0709, lon: 34.8139 },
    'Nazareth': { lat: 32.7021, lon: 35.2978 },
    'Lod': { lat: 31.9566, lon: 34.8989 },
    'Ramla': { lat: 31.9279, lon: 34.8741 },
    'Afula': { lat: 32.6078, lon: 35.2897 },
    'Karmiel': { lat: 32.9199, lon: 35.2956 },
    'Modi\'in': { lat: 31.8969, lon: 35.0064 },
    'Dimona': { lat: 31.0589, lon: 35.0320 },
    'Beit Shemesh': { lat: 31.7304, lon: 34.9886 },
    'Maalot-Tarshiha': { lat: 33.0167, lon: 35.2667 },
    'Or Akiva': { lat: 32.5000, lon: 34.9167 },
    'Safed': { lat: 32.9646, lon: 35.4960 },
    'Rosh HaAyin': { lat: 32.0956, lon: 34.9560 },
    'Yokneam': { lat: 32.6598, lon: 35.1148 },
    'Caesarea': { lat: 32.5185, lon: 34.9043 },
    'Zichron Yaakov': { lat: 32.5730, lon: 34.9518 },
    'Binyamina': { lat: 32.5242, lon: 34.9480 },
    'Pardes Hanna-Karkur': { lat: 32.4768, lon: 34.9768 },
    
    // United States
    'New York': { lat: 40.7128, lon: -74.0060 },
    'Los Angeles': { lat: 34.0522, lon: -118.2437 },
    'Chicago': { lat: 41.8781, lon: -87.6298 },
    'Houston': { lat: 29.7604, lon: -95.3698 },
    'Phoenix': { lat: 33.4484, lon: -112.0740 },
    'Philadelphia': { lat: 39.9526, lon: -75.1652 },
    'San Antonio': { lat: 29.4241, lon: -98.4936 },
    'San Diego': { lat: 32.7157, lon: -117.1611 },
    'Dallas': { lat: 32.7767, lon: -96.7970 },
    'San Jose': { lat: 37.3382, lon: -121.8863 },
    'Austin': { lat: 30.2672, lon: -97.7431 },
    'Jacksonville': { lat: 30.3322, lon: -81.6557 },
    'San Francisco': { lat: 37.7749, lon: -122.4194 },
    'Columbus': { lat: 39.9612, lon: -82.9988 },
    'Indianapolis': { lat: 39.7684, lon: -86.1581 },
    'Fort Worth': { lat: 32.7555, lon: -97.3308 },
    'Charlotte': { lat: 35.2271, lon: -80.8431 },
    'Seattle': { lat: 47.6062, lon: -122.3321 },
    'Denver': { lat: 39.7392, lon: -104.9903 },
    'Washington DC': { lat: 38.9072, lon: -77.0369 },
    
    // United Kingdom
    'London': { lat: 51.5074, lon: -0.1278 },
    'Birmingham': { lat: 52.4862, lon: -1.8904 },
    'Manchester': { lat: 53.4808, lon: -2.2426 },
    'Glasgow': { lat: 55.8642, lon: -4.2518 },
    'Liverpool': { lat: 53.4084, lon: -2.9916 },
    'Leeds': { lat: 53.8008, lon: -1.5491 },
    'Sheffield': { lat: 53.3811, lon: -1.4701 },
    'Edinburgh': { lat: 55.9533, lon: -3.1883 },
    'Bristol': { lat: 51.4545, lon: -2.5879 },
    'Cardiff': { lat: 51.4816, lon: -3.1791 },
    'Belfast': { lat: 54.5973, lon: -5.9301 },
    'Leicester': { lat: 52.6369, lon: -1.1398 },
    'Aberdeen': { lat: 57.1497, lon: -2.0943 },
    'Cambridge': { lat: 52.2053, lon: 0.1218 },
    'Oxford': { lat: 51.7520, lon: -1.2577 }
};

// Function to get country from city
function getCountryFromCity(city: string): string {
    for (const [country, cities] of Object.entries(countriesAndCities)) {
        if (cities.includes(city)) {
            return country;
        }
    }
    return 'Unknown';
}

export const data = new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get the current weather and forecast for a location')
    .addStringOption(option =>
        option.setName('country')
            .setDescription('Select the country')
            .setRequired(true)
            .addChoices(
                { name: 'Israel', value: 'Israel' },
                { name: 'United States', value: 'United States' },
                { name: 'United Kingdom', value: 'United Kingdom' }
            ))
    .addStringOption(option =>
        option.setName('location')
            .setDescription('The city name')
            .setRequired(true)
            .setAutocomplete(true));

// Handle autocomplete requests for city names
export async function autocomplete(interaction: AutocompleteInteraction) {
    try {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const selectedCountry = interaction.options.getString('country');
        let choices: { name: string, value: string }[] = [];

        // Get the list of cities to search through, filtered by country if specified
        const citiesToSearch = selectedCountry 
            ? countriesAndCities[selectedCountry] || [] 
            : allCities;

        // If user typed less than 2 characters, return a selection of popular cities
        if (!focusedValue || focusedValue.length < 2) {
            choices = citiesToSearch.slice(0, 25).map(city => ({
                name: selectedCountry ? city : `${city} (${getCountryFromCity(city)})`,
                value: city
            }));
        } else {
            // Filter cities based on input
            choices = citiesToSearch
                .filter(city => city.toLowerCase().includes(focusedValue))
                .map(city => ({
                    name: selectedCountry ? city : `${city} (${getCountryFromCity(city)})`,
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

// Get weather conditions emoji based on weather code
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

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        // Acknowledge the interaction immediately to prevent timeout
        await interaction.deferReply();
        
        const location = interaction.options.getString('location');
        const country = interaction.options.getString('country');
        
        if (!location) {
            await interaction.editReply('Please provide a valid location.');
            return;
        }

        // Check if API key is available
        if (!weatherApiKey) {
            await interaction.editReply('Weather API key is not configured.');
            return;
        }
        
        try {
            // Get coordinates for the selected city
            const coordinates = cityCoordinates[location];
            
            if (!coordinates) {
                await interaction.editReply(`Location "${location}" not found in our database. Please choose from the autocomplete suggestions.`);
                return;
            }
            
            // Call the Tomorrow.io API with the coordinates
            const response = await axios.get(
                `https://api.tomorrow.io/v4/weather/forecast?location=${coordinates.lat},${coordinates.lon}&apikey=${weatherApiKey}`
            );

            const data = response.data;
            
            // Extract current weather data
            const currentWeather = data.timelines.minutely[0].values;
            
            // Get hourly forecast for the next 3 hours
            const hourlyForecast = data.timelines.hourly.slice(0, 5); // Get next 5 hours
            
            // Get daily forecast for the next 3 days
            const dailyForecast = data.timelines.daily.slice(0, 3); // Get next 3 days
            
            // Get weather code and emoji
            const weatherCode = currentWeather.weatherCode.toString();
            const weatherEmoji = getWeatherEmoji(weatherCode);
            
            // Create weather description
            let weatherDescription = '';
            
            switch (weatherCode) {
                case '1000': weatherDescription = 'Clear, Sunny'; break;
                case '1100': weatherDescription = 'Mostly Clear'; break;
                case '1101': weatherDescription = 'Partly Cloudy'; break;
                case '1102': weatherDescription = 'Mostly Cloudy'; break;
                case '1001': weatherDescription = 'Cloudy'; break;
                case '2000': weatherDescription = 'Fog'; break;
                case '4000': weatherDescription = 'Drizzle'; break;
                case '4001': weatherDescription = 'Rain'; break;
                case '4200': weatherDescription = 'Light Rain'; break;
                case '4201': weatherDescription = 'Heavy Rain'; break;
                case '5000': weatherDescription = 'Snow'; break;
                case '5001': weatherDescription = 'Flurries'; break;
                case '5100': weatherDescription = 'Light Snow'; break;
                case '5101': weatherDescription = 'Heavy Snow'; break;
                case '6000': weatherDescription = 'Freezing Drizzle'; break;
                case '6001': weatherDescription = 'Freezing Rain'; break;
                case '6200': weatherDescription = 'Light Freezing Rain'; break;
                case '6201': weatherDescription = 'Heavy Freezing Rain'; break;
                case '7000': weatherDescription = 'Ice Pellets'; break;
                case '7101': weatherDescription = 'Heavy Ice Pellets'; break;
                case '7102': weatherDescription = 'Light Ice Pellets'; break;
                case '8000': weatherDescription = 'Thunderstorm'; break;
                default: weatherDescription = 'Unknown Weather Condition'; break;
            }
            
            // Get the country for this city if not provided
            const locationCountry = country || getCountryFromCity(location);
            
            // Create the embed for current weather
            const weatherEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${weatherEmoji} Weather in ${location}, ${locationCountry}`)
                .setDescription(`**Current Conditions: ${weatherDescription}**`)
                .addFields(
                    { name: '🌡️ Temperature', value: `${Math.round(currentWeather.temperature)}°C`, inline: true },
                    { name: '🌡️ Feels Like', value: `${Math.round(currentWeather.temperatureApparent)}°C`, inline: true },
                    { name: '💧 Humidity', value: `${Math.round(currentWeather.humidity)}%`, inline: true },
                    { name: '💨 Wind Speed', value: `${Math.round(currentWeather.windSpeed)} km/h`, inline: true },
                    { name: '☔ Precipitation', value: `${Math.round(currentWeather.precipitationProbability)}%`, inline: true },
                    { name: '☁️ Cloud Cover', value: `${Math.round(currentWeather.cloudCover)}%`, inline: true }
                );
            
            // Add hourly forecast
            let hourlyForecastText = '';
            for (let i = 1; i < hourlyForecast.length; i++) { // Skip current hour (index 0)
                const hour = hourlyForecast[i];
                const time = new Date(hour.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const temp = Math.round(hour.values.temperature);
                const emoji = getWeatherEmoji(hour.values.weatherCode.toString());
                hourlyForecastText += `${emoji} **${time}**: ${temp}°C\n`;
            }
            
            if (hourlyForecastText) {
                weatherEmbed.addFields({ name: '⏱️ Hourly Forecast', value: hourlyForecastText, inline: false });
            }
            
            // Add daily forecast
            let dailyForecastText = '';
            for (const day of dailyForecast) {
                const date = new Date(day.time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                const tempMax = Math.round(day.values.temperatureMax);
                const tempMin = Math.round(day.values.temperatureMin);
                const emoji = getWeatherEmoji(day.values.weatherCodeMax.toString());
                dailyForecastText += `${emoji} **${date}**: ${tempMin}°C - ${tempMax}°C\n`;
            }
            
            if (dailyForecastText) {
                weatherEmbed.addFields({ name: '📅 3-Day Forecast', value: dailyForecastText, inline: false });
            }
            
            weatherEmbed.setFooter({ text: 'Weather data provided by Tomorrow.io • Made By Soggra' })
                .setTimestamp();

            await interaction.editReply({ embeds: [weatherEmbed] });
        } catch (error: any) {
            console.error('Weather command error:', error);
            
            // Check if it's an API key error
            if (error.response?.status === 401 || error.response?.status === 403) {
                await interaction.editReply('Invalid or missing API key. Please check the weather API key.');
            } else if (error.response?.status === 404) {
                await interaction.editReply(`Location not found: "${location}". Please check the spelling or try another city.`);
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