import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  Colors
} from 'discord.js';
import { settingsManager } from '../../utils/settings';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('ticket-config')
  .setDescription('Configure the ticket system')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand => 
    subcommand
      .setName('show')
      .setDescription('Show current ticket system configuration')
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('chatbot')
      .setDescription('Configure the ticket mini chatbot')
      .addBooleanOption(option => 
        option
          .setName('enabled')
          .setDescription('Enable or disable the mini chatbot in tickets')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'ticket-config',
      options: interaction.options.data,
      channel: interaction.channel,
      success: true
    });

    const subcommand = interaction.options.getSubcommand();
    
    // Get current settings
    const settings = await settingsManager.getSettings(interaction.guildId!);
    
    if (subcommand === 'show') {
      // Create an embed to display current settings
      const embed = new EmbedBuilder()
        .setTitle('🎫 Ticket System Configuration')
        .setColor(Colors.Blue)
        .addFields([
          { 
            name: '🤖 Mini Chatbot', 
            value: `${settings.ticket_chatbot_enabled ? '✅ Enabled' : '❌ Disabled'}`, 
            inline: true 
          }
        ])
        .setFooter({ text: 'Use /ticket-config chatbot to change settings' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      return;
    }
    
    if (subcommand === 'chatbot') {
      const enabled = interaction.options.getBoolean('enabled')!;
      
      // Update settings
      await settingsManager.setSetting(interaction.guildId!, 'ticket_chatbot_enabled', enabled);
      
      // Create embed for confirmation
      const embed = new EmbedBuilder()
        .setTitle('✅ Mini Chatbot Configuration Updated')
        .setColor(Colors.Green)
        .setDescription(`The ticket mini chatbot is now ${enabled ? '**enabled**' : '**disabled**'}.`)
        .setFooter({ text: 'Changes take effect immediately' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      
      logInfo('Ticket Config', `Updated chatbot settings for guild ${interaction.guildId}: enabled=${enabled}`);
      return;
    }
  } catch (error) {
    logError('Ticket Config', `Error configuring tickets: ${error}`);
    await interaction.reply({
      content: 'An error occurred while updating the ticket configuration.',
      ephemeral: true
    });
  }
} 