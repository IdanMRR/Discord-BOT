const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');

// Your guild ID (replace with your actual guild ID)
const guildId = '1308477738095497286';
const clientId = process.env.CLIENT_ID;
const token = process.env.DISCORD_TOKEN;

if (!token || !clientId) {
  console.error('Missing environment variables');
  process.exit(1);
}

// Load just the test-redalert command
const commandPath = path.join(__dirname, 'dist/commands/admin/test-redalert.js');
console.log('Loading command from:', commandPath);

try {
  const command = require(commandPath);
  const commands = [command.data.toJSON()];
  
  const rest = new REST({ version: '9' }).setToken(token);
  
  console.log('🚀 Registering test-redalert command for guild:', guildId);
  
  rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
    .then(() => {
      console.log('✅ test-redalert command registered successfully!');
      console.log('🎯 You should see it immediately in Discord.');
      console.log('💡 Try typing: /test-redalert');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error registering command:', error);
      process.exit(1);
    });
} catch (error) {
  console.error('❌ Error loading command:', error);
  process.exit(1);
} 