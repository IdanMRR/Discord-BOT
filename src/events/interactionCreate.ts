import { Events, Interaction, MessageFlags } from 'discord.js';
import { logError, logCommandUsage } from '../utils/logger';
import { handleLogPagination } from './log-pagination-handler';

/**
 * Event handler for all Discord interactions
 * This includes commands, buttons, select menus, and modals
 */
module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction) {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        
        if (!command) {
          console.error(`No command matching ${interaction.commandName} was found.`);
          return;
        }
        
        try {
          // Log command usage before execution
          if (interaction.guild) {
            await logCommandUsage({
              guild: interaction.guild,
              user: interaction.user,
              command: interaction.commandName,
              options: interaction.options.data.reduce((acc: Record<string, any>, option) => {
                acc[option.name] = option.value;
                return acc;
              }, {}),
              channel: interaction.channel?.isTextBased() ? interaction.channel : null,
              success: true
            });
          }
          
          // Execute the command
          await command.execute(interaction);
        } catch (error) {
          logError('Command Execution', error);
          
          // Log command failure
          if (interaction.guild) {
            await logCommandUsage({
              guild: interaction.guild,
              user: interaction.user,
              command: interaction.commandName,
              options: interaction.options.data.reduce((acc: Record<string, any>, option) => {
                acc[option.name] = option.value;
                return acc;
              }, {}),
              channel: interaction.channel?.isTextBased() ? interaction.channel : null,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          
          // Reply with error message if we can
          if (interaction.replied || interaction.deferred) { await interaction.followUp({
              content: 'There was an error while executing this command!',
              flags: MessageFlags.Ephemeral
             });
          } else {
            await interaction.reply({ 
              content: 'There was an error while executing this command!',
              flags: MessageFlags.Ephemeral
             });
          }
        }
      }
      // Handle buttons
      else if (interaction.isButton()) {
        const customId = interaction.customId;
        
        // Handle log pagination buttons
        if (customId.includes('logs_next') || customId.includes('logs_prev')) {
          await handleLogPagination(interaction);
          return;
        }
        
        // Handle other button interactions here
        // ...
      }
      // Handle select menus
      else if (interaction.isStringSelectMenu()) {
        // Handle select menu interactions here
        // ...
      }
      // Handle modals
      else if (interaction.isModalSubmit()) {
        // Handle modal submissions here
        // ...
      }
    } catch (error) {
      logError('Interaction Handler', error);
    }
  },
};
