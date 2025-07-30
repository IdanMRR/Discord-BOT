import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command, ExecuteProps } from '../../types/Command';
import { LevelingService } from '../../database/services/levelingService';
import { XPHandler } from '../../handlers/leveling/xp-handler';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your current level and XP progress')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check level for (optional)')
        .setRequired(false)
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

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild.members.cache.get(targetUser.id);

    if (!member) {
      await interaction.reply({
        content: 'User not found in this server.',
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

      // Get user level data
      const userLevel = LevelingService.getUserLevel(interaction.guild.id, targetUser.id);
      if (!userLevel) {
        await interaction.editReply({
          content: `${targetUser.displayName} hasn't earned any XP yet! Start chatting to gain levels.`
        });
        return;
      }

      // Get detailed progress info
      const progress = XPHandler.getLevelProgress(interaction.guild.id, targetUser.id);
      if (!progress) {
        await interaction.editReply({
          content: `Unable to calculate level progress for ${targetUser.displayName}.`
        });
        return;
      }

      // Calculate XP needed for next level
      const xpNeeded = progress.nextLevelXP - progress.currentXP;
      
      // Calculate percentage to next level
      const nextLevelProgress = Math.min(100, (progress.currentXP / progress.nextLevelXP) * 100);

      // Create progress bar
      const barLength = 20;
      const filledBars = Math.floor((nextLevelProgress / 100) * barLength);
      const emptyBars = barLength - filledBars;
      const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(Colors.PRIMARY)
        .setTitle(`📊 Level Information - ${targetUser.displayName}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { 
            name: '🏆 Current Level', 
            value: `**${progress.currentLevel}**`, 
            inline: true 
          },
          { 
            name: '✨ Total XP', 
            value: `**${progress.totalXP.toLocaleString()}**`, 
            inline: true 
          },
          { 
            name: '🎯 Server Rank', 
            value: `**#${progress.rank}** / ${progress.totalMembers}`, 
            inline: true 
          },
          {
            name: '📈 Progress to Next Level',
            value: `\`\`\`${progressBar}\`\`\`**${progress.currentXP.toLocaleString()}** / **${progress.nextLevelXP.toLocaleString()}** XP (${nextLevelProgress.toFixed(1)}%)\n**${xpNeeded.toLocaleString()}** XP needed for level **${progress.currentLevel + 1}**`,
            inline: false
          },
          {
            name: '💬 Message Count',
            value: `**${userLevel.message_count.toLocaleString()}** messages`,
            inline: true
          },
          {
            name: '⏰ Last XP Gain',
            value: `<t:${Math.floor(new Date(userLevel.last_xp_gain).getTime() / 1000)}:R>`,
            inline: true
          }
        )
        .setTimestamp()
        .setFooter({ text: `${interaction.guild.name} • Use /rank for a visual card` });

      // Add level rewards info if available
      const nextRewards = LevelingService.getLevelRewards(interaction.guild.id, progress.currentLevel + 1);
      if (nextRewards.length > 0) {
        const rewardText = nextRewards.map(reward => {
          switch (reward.type) {
            case 'role':
              const role = interaction.guild?.roles.cache.get(reward.value);
              return `🎭 **${role?.name || 'Unknown Role'}**`;
            case 'currency':
              return `💰 **${reward.amount} ${reward.value}**`;
            case 'custom':
              return `🎁 **${reward.description}**`;
            default:
              return `❓ **${reward.description}**`;
          }
        }).join('\n');

        embed.addFields({
          name: '🎁 Next Level Rewards',
          value: rewardText,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in level command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching level information.'
      });
    }
  }
};

export default command;