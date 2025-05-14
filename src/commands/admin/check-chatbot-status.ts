import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder 
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { settingsManager } from '../../utils/settings';

export const data = new SlashCommandBuilder()
  .setName('check-chatbot-status')
  .setDescription('Check the current status of the ticket AI chatbot')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();
    
    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'check-chatbot-status',
      options: interaction.options.data,
      channel: interaction.channel,
      success: true
    });
    
    // Get current settings
    const settings = await settingsManager.getSettings(interaction.guildId!);
    
    // Create status embed
    const statusEmbed = new EmbedBuilder()
      .setTitle('🤖 Ticket AI Chatbot Status')
      .setColor(Colors.INFO)
      .addFields([
        { 
          name: 'Chatbot Enabled', 
          value: settings.ticket_chatbot_enabled ? '✅ Enabled' : '❌ Disabled', 
          inline: true 
        },
        { 
          name: 'AI Capabilities', 
          value: settings.ticket_chatbot_ai_enabled ? '✅ Enabled' : '❌ Disabled', 
          inline: true 
        }
      ])
      .setDescription('The ticket chatbot responds to user messages in ticket channels when staff are not active.')
      .setFooter({ text: 'Made by Soggra.' })
      .setTimestamp();
    
    // Add info about how to change settings
    statusEmbed.addFields({
      name: 'Change Settings',
      value: 'Use the following commands to modify these settings:\n' +
        '`/ticket-config chatbot` - Enable/disable the chatbot\n' +
        '`/toggle-ai-chatbot` - Enable/disable AI capabilities'
    });
    
    await interaction.editReply({ embeds: [statusEmbed] });
    
    logInfo('Check Chatbot Status', `${interaction.user.tag} checked the chatbot status`);
  } catch (error) {
    logError('Check Chatbot Status', `Error checking chatbot status: ${error}`);
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription(`An error occurred while checking the chatbot status: ${error}`)
      .setColor(Colors.ERROR)
      .setFooter({ text: 'Made by Soggra.' });
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
} 