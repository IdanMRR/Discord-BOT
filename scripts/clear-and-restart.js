const { REST, Routes } = require('discord.js');
require('dotenv').config();

async function clearAndRestart() {
  try {
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
      console.error('Error: DISCORD_TOKEN and CLIENT_ID must be set in .env');
      process.exit(1);
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    console.log('=== COMMAND CLEANUP UTILITY ===');
    console.log('This will clear ALL commands from your bot.');
    
    // Clear global commands
    console.log('\nClearing global commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }
    );
    console.log('✅ Global commands cleared');
    
    // Clear guild commands if TEST_GUILD_ID is set
    if (process.env.TEST_GUILD_ID) {
      console.log(`\nClearing guild commands for server ${process.env.TEST_GUILD_ID}...`);
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.TEST_GUILD_ID),
        { body: [] }
      );
      console.log('✅ Guild commands cleared');
    }
    
    console.log('\n✅ Command cleanup complete!');
    console.log('Restart your bot to register fresh commands.');
    
  } catch (error) {
    console.error('Error during command cleanup:', error);
    process.exit(1);
  }
}

clearAndRestart();
