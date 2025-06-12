// A simple script to deploy just the logs-text command
const { REST, Routes } = require('discord.js');
require('dotenv').config();

// The command data
const command = {
  name: 'logs',
  description: 'Manage server logs',
  default_member_permissions: "8", // Administrator permission
  options: [
    {
      name: 'set',
      description: 'Set the log channel',
      type: 1, // SUB_COMMAND
      options: [
        {
          name: 'channel',
          description: 'The channel to send logs to',
          type: 7, // CHANNEL
          required: true
        }
      ]
    },
    {
      name: 'disable',
      description: 'Disable logging for this server',
      type: 1 // SUB_COMMAND
    },
    {
      name: 'test',
      description: 'Send a test log message',
      type: 1 // SUB_COMMAND
    }
  ]
};

// Your Discord bot token and application ID from .env
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

// The test guild ID
  const guildId = process.env.TEST_GUILD_ID || '';

if (!token) {
  console.error('DISCORD_TOKEN not found in .env file');
  process.exit(1);
}

if (!clientId) {
  console.error('CLIENT_ID not found in .env file');
  process.exit(1);
}

// Create a new REST instance
const rest = new REST({ version: '10' }).setToken(token);

// Deploy the command
(async () => {
  try {
    console.log(`Started deploying logs command to guild ${guildId}...`);

    // Deploy the command to the guild
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: [command] },
    );

    console.log(`Successfully deployed logs command to guild ${guildId}`);
  } catch (error) {
    console.error('Error deploying command:', error);
  }
})();
