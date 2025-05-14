import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits 
} from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { settingsManager } from '../../utils/settings';

export const data = new SlashCommandBuilder()
  .setName('toggle-ai-chatbot')
  .setDescription('Toggle AI capabilities for the ticket chatbot')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addBooleanOption(option => 
    option
      .setName('enabled')
      .setDescription('Whether to enable AI for the chatbot')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'toggle-ai-chatbot',
      options: interaction.options.data,
      channel: interaction.channel,
      success: true
    });
    
    // Get the enabled option
    const enabled = interaction.options.getBoolean('enabled')!;
    
    // Update the AI chatbot setting using the correct method
    const success = await settingsManager.setSetting(interaction.guildId!, 'ticket_chatbot_ai_enabled', enabled);
    
    if (!success) {
      const errorEmbed = createErrorEmbed(
        'Error', 
        'Failed to update the AI chatbot settings.'
      );
      
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }
    
    // Return success message
    const successEmbed = createSuccessEmbed(
      'AI Chatbot Settings Updated', 
      `AI capabilities for the ticket chatbot have been ${enabled ? 'enabled' : 'disabled'}.`
    );
    
    await interaction.editReply({ embeds: [successEmbed] });
    
    logInfo('Toggle AI Chatbot', `AI chatbot ${enabled ? 'enabled' : 'disabled'} by ${interaction.user.tag}`);
  } catch (error) {
    logError('Toggle AI Chatbot', `Error toggling AI chatbot: ${error}`);
    
    const errorEmbed = createErrorEmbed(
      'Error', 
      `An error occurred while updating AI chatbot settings: ${error}`
    );
    
    await interaction.editReply({ embeds: [errorEmbed] });
    
    // Log command usage with error
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'toggle-ai-chatbot',
      options: interaction.options.data,
      channel: interaction.channel,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 