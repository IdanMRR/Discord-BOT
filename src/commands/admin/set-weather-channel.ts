import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, PermissionFlagsBits, TextChannel, ChannelType, EmbedBuilder, MessageFlags } from 'discord.js';
import { setWeatherChannel, setCustomCities } from '../../handlers/utility/weather-scheduler';

export const data = new SlashCommandBuilder()
    .setName('set-weather-channel')
    .setDescription('Set the channel for daily weather reports and configure cities')
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to send weather reports to')
            .setRequired(true))
    // City 1
    .addStringOption(option =>
        option.setName('city-name-1')
            .setDescription('Name of the first city (optional)'))
    .addStringOption(option =>
        option.setName('country-1')
            .setDescription('Country of the first city'))
    .addNumberOption(option =>
        option.setName('latitude-1')
            .setDescription('Latitude of the first city'))
    .addNumberOption(option =>
        option.setName('longitude-1')
            .setDescription('Longitude of the first city'))
    // City 2
    .addStringOption(option =>
        option.setName('city-name-2')
            .setDescription('Name of the second city (optional)'))
    .addStringOption(option =>
        option.setName('country-2')
            .setDescription('Country of the second city'))
    .addNumberOption(option =>
        option.setName('latitude-2')
            .setDescription('Latitude of the second city'))
    .addNumberOption(option =>
        option.setName('longitude-2')
            .setDescription('Longitude of the second city'))
    // City 3
    .addStringOption(option =>
        option.setName('city-name-3')
            .setDescription('Name of the third city (optional)'))
    .addStringOption(option =>
        option.setName('country-3')
            .setDescription('Country of the third city'))
    .addNumberOption(option =>
        option.setName('latitude-3')
            .setDescription('Latitude of the third city'))
    .addNumberOption(option =>
        option.setName('longitude-3')
            .setDescription('Longitude of the third city'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        // Get the selected channel
        const channel = interaction.options.getChannel('channel');
        
        if (!channel) {
            await interaction.reply({ 
                content: 'Please provide a valid channel.', 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }
        
        // Make sure it's a text channel
        if (channel.type !== ChannelType.GuildText) {
            await interaction.reply({ 
                content: 'The selected channel must be a text channel.', 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }
        
        // Defer the reply since database operations might take time
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        // Set the weather channel with guild ID
        console.log(`[WEATHER DEBUG] Setting weather channel ${channel.id} (${channel.name}) for guild ${interaction.guildId}`);
        const success = await setWeatherChannel(interaction.guildId!, channel.id);
        
        if (!success) {
            console.error(`[WEATHER DEBUG] Failed to save weather channel settings for guild ${interaction.guildId}`);
            await interaction.followUp({ 
                content: 'Failed to save the weather channel settings. Please try again.', 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }
        
        console.log(`[WEATHER DEBUG] Successfully set weather channel ${channel.id} (${channel.name}) for guild ${interaction.guildId}`);
        
        // Check if custom cities were provided
        const cityName1 = interaction.options.getString('city-name-1');
        let customCitiesSet = false;
        let cityList = '';
        
        if (cityName1) {
            // Build the cities array
            const cities = [];
            
            // Validate city 1 fields
            const country1 = interaction.options.getString('country-1');
            const lat1 = interaction.options.getNumber('latitude-1');
            const lon1 = interaction.options.getNumber('longitude-1');
            
            if (!country1 || lat1 === null || lon1 === null) {
                await interaction.followUp({ 
                    content: 'If you provide a city name, you must also provide its country, latitude, and longitude.', 
                    flags: MessageFlags.Ephemeral 
                });
                return;
            }
            
            cities.push({
                name: cityName1,
                country: country1,
                lat: lat1,
                lon: lon1
            });
            
            // Add second city if provided
            const cityName2 = interaction.options.getString('city-name-2');
            if (cityName2) {
                const country2 = interaction.options.getString('country-2');
                const lat2 = interaction.options.getNumber('latitude-2');
                const lon2 = interaction.options.getNumber('longitude-2');
                
                // Make sure all required fields for city 2 are provided
                if (!country2 || lat2 === null || lon2 === null) {
                    await interaction.followUp({
                        content: 'If you provide a second city name, you must also provide its country, latitude, and longitude.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                
                cities.push({
                    name: cityName2,
                    country: country2,
                    lat: lat2,
                    lon: lon2
                });
            }
            
            // Add third city if provided
            const cityName3 = interaction.options.getString('city-name-3');
            if (cityName3) {
                const country3 = interaction.options.getString('country-3');
                const lat3 = interaction.options.getNumber('latitude-3');
                const lon3 = interaction.options.getNumber('longitude-3');
                
                // Make sure all required fields for city 3 are provided
                if (!country3 || lat3 === null || lon3 === null) {
                    await interaction.followUp({
                        content: 'If you provide a third city name, you must also provide its country, latitude, and longitude.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                
                cities.push({
                    name: cityName3,
                    country: country3,
                    lat: lat3,
                    lon: lon3
                });
            }
            
            // Set the custom cities in the database
            console.log(`[WEATHER DEBUG] Setting ${cities.length} custom cities for guild ${interaction.guildId}`);
            const citiesSuccess = await setCustomCities(interaction.guildId!, cities);
            
            if (citiesSuccess) {
                customCitiesSet = true;
                
                // Create a list of cities for the embed
                cities.forEach((city, index) => {
                    cityList += `${index + 1}. **${city.name}, ${city.country}** (${city.lat}, ${city.lon})\n`;
                });
                
                console.log(`[WEATHER DEBUG] Successfully set ${cities.length} custom cities for guild ${interaction.guildId}`);
            } else {
                console.error(`[WEATHER DEBUG] Failed to save custom cities for guild ${interaction.guildId}`);
            }
        }
        
        // Create success embed
        const successEmbed = new EmbedBuilder()
            .setColor(0x00BFFF)
            .setTitle('☀️ Weather Channel Set')
            .setDescription(`Daily weather reports will now be sent to <#${channel.id}>.`)
            .addFields([
                { name: 'Report Schedule', value: 'Daily at 8:00 AM Israel time', inline: true }
            ]);
            
        // Add city information
        if (customCitiesSet) {
            successEmbed.addFields([
                { name: 'Custom Cities', value: cityList, inline: false }
            ]);
        } else {
            successEmbed.addFields([
                { name: 'Default Cities', value: 'Tel Aviv, Jerusalem, Haifa', inline: true }
            ]);
            
            // Add a note about setting custom cities later if they weren't provided
            successEmbed.addFields([
                { 
                    name: 'Change Cities', 
                    value: 'You can use this command again with city parameters to set custom cities for weather reports.', 
                    inline: false 
                }
            ]);
        }
        
        successEmbed.setFooter({ text: '• Made By Soggra' });
        
        // Send a test message to the channel
        const testEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('☀️ Weather Channel Configured')
            .setDescription('This channel has been set up to receive daily weather reports.');
            
        // Add fields based on whether custom cities were set
        if (customCitiesSet) {
            testEmbed.addFields([
                { name: '⏰ Schedule', value: 'Daily at 8:00 AM Israel time' },
                { name: '✅ First Report', value: 'You will receive a test report within 5 minutes, and then daily at the scheduled time.' },
                { name: '🌍 Custom Cities', value: cityList }
            ]);
        } else {
            testEmbed.addFields([
                { name: '⏰ Schedule', value: 'Daily at 8:00 AM Israel time' },
                { name: '✅ First Report', value: 'You will receive a test report within 5 minutes, and then daily at the scheduled time.' },
                { name: '🌍 Default Cities', value: 'By default, weather is reported for Tel Aviv, Jerusalem, and Haifa.' }
            ]);
        }
            
        testEmbed.setFooter({ text: '• Made By Soggra' });
        
        await (channel as TextChannel).send({ embeds: [testEmbed] });
        
        // Reply to the interaction
        await interaction.followUp({ 
            embeds: [successEmbed],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in set-weather-channel command:', error);
        
        // Make sure we respond even if there's an error
        if (interaction.deferred) {
            await interaction.followUp({ 
                content: 'An error occurred while setting up the weather channel.', 
                flags: MessageFlags.Ephemeral
            });
        } else {
            await interaction.reply({ 
                content: 'An error occurred while setting up the weather channel.', 
                flags: MessageFlags.Ephemeral
            });
        }
    }
} 