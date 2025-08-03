import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command, ExecuteProps } from '../../types/Command';
import { DiscordDataCollector } from '../../handlers/analytics/discord-data-collector';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('collect-data')
    .setDescription('🔧 Admin: Manually collect server analytics data')
    .setDefaultMemberPermissions('0'), // Admin only

  async execute(interaction: ExecuteProps) {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in servers.',
        ephemeral: true
      });
      return;
    }

    // Check if user has admin permissions
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({
        content: '❌ You need Administrator permissions to use this command.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    try {
      const collector = new DiscordDataCollector(interaction.client);
      const result = await collector.collectServerData(interaction.guild.id);

      const embed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('📊 Data Collection Complete')
        .setDescription('Successfully collected and stored server analytics data!')
        .addFields(
          { name: '🏠 Server', value: result.guild, inline: true },
          { name: '👥 Members', value: `${result.memberCount} total`, inline: true },
          { name: '🟢 Online', value: `${result.onlineCount} members`, inline: true },
          { name: '📱 Channels', value: `${result.channelCount} tracked`, inline: true },
          { name: '⏰ Collected At', value: `<t:${Math.floor(new Date(result.collectedAt).getTime() / 1000)}:F>`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Analytics Data Collection' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in collect-data command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while collecting server data. Check console for details.'
      });
    }
  }
};

export default command;