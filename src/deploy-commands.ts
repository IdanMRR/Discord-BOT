import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with pong and latency information'),
  new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Replies with a friendly greeting'),
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('A test command to verify the bot is working'),
  
  // Kick command
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to kick')
        .setRequired(true))
    .addStringOption(option => 
      option
        .setName('reason')
        .setDescription('The reason for kicking')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  
  // Ban command
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to ban')
        .setRequired(true))
    .addStringOption(option => 
      option
        .setName('reason')
        .setDescription('The reason for banning')
        .setRequired(false))
    .addIntegerOption(option => 
      option
        .setName('days')
        .setDescription('Number of days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
].map(command => command.toJSON());

// Prepare to deploy commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || '');

// Deploy commands function
async function deployCommands() {
  try {
    console.log('Started refreshing application (/) commands.');

    // The CLIENT_ID is your bot's application ID, which you can find in the Discord Developer Portal
    // You need to add this to your .env file
    if (!process.env.CLIENT_ID) {
      throw new Error('CLIENT_ID is not defined in .env file');
    }

    // For global commands
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

// Execute the deploy
deployCommands();
