import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command, ExecuteProps } from '../../types/Command';
import { LevelingService } from '../../database/services/levelingService';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server leveling leaderboard')
    .addIntegerOption(option =>
      option
        .setName('page')
        .setDescription('Page number to display (10 users per page)')
        .setRequired(false)
        .setMinValue(1)
    ) as any,

  async execute(interaction: ExecuteProps) {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in servers.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Check if leveling is enabled
      const settings = LevelingService.getLevelingSettings(interaction.guild.id);
      if (!settings || !settings.enabled) {
        await interaction.editReply({
          content: '❌ Leveling system is not enabled in this server.'
        });
        return;
      }

      const page = interaction.options.getInteger('page') || 1;
      const usersPerPage = 10;
      const offset = (page - 1) * usersPerPage;

      // Get leaderboard data
      const leaderboard = LevelingService.getLeaderboard(interaction.guild.id, usersPerPage + offset);
      const totalMembers = LevelingService.getTotalRankedMembers(interaction.guild.id);
      const totalPages = Math.ceil(totalMembers / usersPerPage);

      if (leaderboard.length === 0) {
        await interaction.editReply({
          content: '📊 No one has earned XP yet! Start chatting to get on the leaderboard!'
        });
        return;
      }

      // Get users for this page
      const pageUsers = leaderboard.slice(offset, offset + usersPerPage);

      // Create leaderboard embed
      const embed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle(`🏆 ${interaction.guild.name} Leaderboard`)
        .setDescription(`Showing page ${page} of ${totalPages} • ${totalMembers} ranked members`)
        .setTimestamp()
        .setFooter({ text: `Use /rank to see your detailed progress` });

      // Add leaderboard fields
      let leaderboardText = '';
      
      for (let i = 0; i < pageUsers.length; i++) {
        const user = pageUsers[i];
        const rank = offset + i + 1;
        
        // Try to get user from guild
        let userTag = `<@${user.user_id}>`;
        try {
          const member = await interaction.guild.members.fetch(user.user_id);
          if (member) {
            userTag = member.displayName;
          }
        } catch (error) {
          // User might have left the server
          userTag = `User ${user.user_id.slice(-4)}`;
        }

        // Medal emojis for top 3
        let medal = '';
        if (rank === 1) medal = '🥇';
        else if (rank === 2) medal = '🥈';
        else if (rank === 3) medal = '🥉';
        else medal = `**${rank}.**`;

        leaderboardText += `${medal} ${userTag}\n`;
        leaderboardText += `   Level ${user.level} • ${user.xp.toLocaleString()} XP • ${user.message_count.toLocaleString()} messages\n\n`;
      }

      embed.addFields({ name: '📊 Rankings', value: leaderboardText || 'No data available', inline: false });

      // Add pagination buttons if needed
      const components = [];
      if (totalPages > 1) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        
        if (page > 1) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`leaderboard_${page - 1}`)
              .setLabel('◀️ Previous')
              .setStyle(ButtonStyle.Secondary)
          );
        }

        if (page < totalPages) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`leaderboard_${page + 1}`)
              .setLabel('Next ▶️')
              .setStyle(ButtonStyle.Secondary)
          );
        }

        // Add jump to first/last buttons
        if (page > 2) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`leaderboard_1`)
              .setLabel('⏮️ First')
              .setStyle(ButtonStyle.Primary)
          );
        }

        if (page < totalPages - 1) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`leaderboard_${totalPages}`)
              .setLabel('Last ⏭️')
              .setStyle(ButtonStyle.Primary)
          );
        }

        if (row.components.length > 0) {
          components.push(row);
        }
      }

      // Add stats embed field
      if (settings) {
        const statsText = [
          `💬 **XP per message:** ${settings.xp_per_message || 15}`,
          `⏱️ **Cooldown:** ${settings.xp_cooldown || 60}s`,
          `✨ **Multiplier:** ${settings.xp_multiplier || 1.0}x`,
          `📈 **Formula:** ${(settings.level_formula || 'quadratic').charAt(0).toUpperCase() + (settings.level_formula || 'quadratic').slice(1)}`
        ].join('\n');

        embed.addFields({ name: '⚙️ Settings', value: statsText, inline: true });
      }

      await interaction.editReply({ 
        embeds: [embed], 
        components: components.length > 0 ? components : [] 
      });

    } catch (error) {
      console.error('Error in leaderboard command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching the leaderboard.'
      });
    }
  }
};

export default command;