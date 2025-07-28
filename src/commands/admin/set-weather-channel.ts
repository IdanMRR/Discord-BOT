import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, PermissionFlagsBits, TextChannel, ChannelType, EmbedBuilder, MessageFlags } from 'discord.js';
import { setWeatherChannel, setCustomCities } from '../../handlers/utility/weather-scheduler';
import { getCoordinates, defaultCoordinates, commonCountries, CityData } from '../../handlers/utility/geocoding';

export const data = new SlashCommandBuilder()
    .setName('set-weather-channel')
    .setDescription('Set the channel for daily weather reports and configure cities')
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The channel to send weather reports to')
            .setRequired(true))
    // City 1 - Groups
    .addStringOption(option =>
        option.setName('city1')
            .setDescription('First city to report weather for')
            .setAutocomplete(true))
    .addStringOption(option =>
        option.setName('country1')
            .setDescription('Country of the first city')
            .setAutocomplete(true))
    // City 2 - Groups
    .addStringOption(option =>
        option.setName('city2')
            .setDescription('Second city to report weather for (optional)')
            .setAutocomplete(true))
    .addStringOption(option =>
        option.setName('country2')
            .setDescription('Country of the second city')
            .setAutocomplete(true))
    // City 3 - Groups
    .addStringOption(option =>
        option.setName('city3')
            .setDescription('Third city to report weather for (optional)')
            .setAutocomplete(true))
    .addStringOption(option =>
        option.setName('country3')
            .setDescription('Country of the third city')
            .setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Autocomplete function to suggest common cities and countries
export async function autocomplete(interaction: any) {
    const focusedOption = interaction.options.getFocused(true);
    const focusedValue = focusedOption.value.toLowerCase();
    
    // If the user is typing in a city field
    if (focusedOption.name.startsWith('city')) {
        const suggestions = Object.keys(defaultCoordinates)
            .filter(city => city.toLowerCase().startsWith(focusedValue))
            .slice(0, 25); // Discord limits to 25 choices
        
        // Return matching suggestions
        await interaction.respond(
            suggestions.map(city => ({
                name: defaultCoordinates[city].name,
                value: defaultCoordinates[city].name
            }))
        );
    }
    // If the user is typing in a country field
    else if (focusedOption.name.startsWith('country')) {
        const suggestions = commonCountries
            .filter(country => country.toLowerCase().startsWith(focusedValue))
            .slice(0, 25); // Discord limits to 25 choices
        
        // Return matching suggestions
        await interaction.respond(
            suggestions.map(country => ({
                name: country,
                value: country
            }))
        );
    }
}

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
        
        // Defer the reply since database operations and geocoding might take time
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
        const city1 = interaction.options.getString('city1');
        let customCitiesSet = false;
        let cityList = '';
        
        if (city1) {
            // Build the cities array
            const cities: CityData[] = [];
            
            // Process city 1
            const country1 = interaction.options.getString('country1') || 'Israel';
            
            // Check for preset coordinates first
            const city1Lower = city1.toLowerCase();
            let cityData: CityData | null = null;
            
            if (Object.keys(defaultCoordinates).includes(city1Lower)) {
                cityData = defaultCoordinates[city1Lower];
                console.log(`[WEATHER DEBUG] Using preset coordinates for ${city1}`);
            } else {
                // Fetch coordinates using geocoding
                cityData = await getCoordinates(city1, country1);
                
                if (!cityData) {
                    await interaction.followUp({
                        content: `Could not find coordinates for ${city1}, ${country1}. Please try a different city or provide the coordinates manually.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
            }
            
            cities.push(cityData);
            
            // Process city 2 if provided
            const city2 = interaction.options.getString('city2');
            if (city2) {
                const country2 = interaction.options.getString('country2') || 'Israel';
                
                // Check for preset coordinates
                const city2Lower = city2.toLowerCase();
                let city2Data: CityData | null = null;
                
                if (Object.keys(defaultCoordinates).includes(city2Lower)) {
                    city2Data = defaultCoordinates[city2Lower];
                } else {
                    city2Data = await getCoordinates(city2, country2);
                    
                    if (!city2Data) {
                        await interaction.followUp({
                            content: `Could not find coordinates for ${city2}, ${country2}. City 1 was saved, but city 2 was skipped.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }
                
                if (city2Data) {
                    cities.push(city2Data);
                }
            }
            
            // Process city 3 if provided
            const city3 = interaction.options.getString('city3');
            if (city3) {
                const country3 = interaction.options.getString('country3') || 'Israel';
                
                // Check for preset coordinates
                const city3Lower = city3.toLowerCase();
                let city3Data: CityData | null = null;
                
                if (Object.keys(defaultCoordinates).includes(city3Lower)) {
                    city3Data = defaultCoordinates[city3Lower];
                } else {
                    city3Data = await getCoordinates(city3, country3);
                    
                    if (!city3Data) {
                        await interaction.followUp({
                            content: `Could not find coordinates for ${city3}, ${country3}. Previous cities were saved, but city 3 was skipped.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }
                
                if (city3Data) {
                    cities.push(city3Data);
                }
            }
            
            // Set the custom cities in the database
            console.log(`[WEATHER DEBUG] Setting ${cities.length} custom cities for guild ${interaction.guildId}`);
            const citiesSuccess = await setCustomCities(interaction.guildId!, cities);
            
            if (citiesSuccess) {
                customCitiesSet = true;
                
                // Create a list of cities for the embed
                cities.forEach((city, index) => {
                    cityList += `${index + 1}. **${city.name}, ${city.country}** (${city.lat.toFixed(4)}, ${city.lon.toFixed(4)})\n`;
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
                { name: '⏰ Report Schedule', value: 'Daily at 8:00 AM Israel time (UTC+3)\nReports are sent once per day.', inline: true },
                { name: '⚙️ Automated Updates', value: 'Weather updates are fully automated and require no further configuration.', inline: true }
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
                { name: '⏰ Schedule', value: 'Daily at 8:00 AM Israel time (UTC+3)\nReports are sent once per day at this time.' },
                { name: '✅ First Report', value: 'You will receive your first report tomorrow at the scheduled time.' },
                { name: '🌍 Custom Cities', value: cityList },
                { name: '⚙️ Configuration', value: 'No further setup is needed. Weather reports will be sent automatically based on this schedule.' }
            ]);
        } else {
            testEmbed.addFields([
                { name: '⏰ Schedule', value: 'Daily at 8:00 AM Israel time (UTC+3)\nReports are sent once per day at this time.' },
                { name: '✅ First Report', value: 'You will receive your first report tomorrow at the scheduled time.' },
                { name: '🌍 Default Cities', value: 'By default, weather is reported for Tel Aviv, Jerusalem, and Haifa.' },
                { name: '⚙️ Configuration', value: 'No further setup is needed. Weather reports will be sent automatically based on this schedule.' }
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