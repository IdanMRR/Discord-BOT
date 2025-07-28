import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { Command, ExecuteProps } from '../../types/Command';
import { LevelingService } from '../../database/services/levelingService';
import { XPHandler } from '../../handlers/leveling/xp-handler';
import { Colors } from '../../utils/embeds';
import { Canvas, createCanvas, loadImage } from 'canvas';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your current level and XP progress')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check rank for (optional)')
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

      // Get user progress
      const progress = XPHandler.getLevelProgress(interaction.guild.id, targetUser.id);
      if (!progress) {
        await interaction.editReply({
          content: `${targetUser.tag} hasn't earned any XP yet.`
        });
        return;
      }

      // Create rank card
      const rankCard = await createRankCard(targetUser, member, progress, interaction.guild.name);

      // Create embed with progress info
      const embed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle(`🏆 Rank Card - ${targetUser.displayName}`)
        .addFields(
          { name: '📊 Level', value: progress.currentLevel.toString(), inline: true },
          { name: '✨ Total XP', value: progress.totalXP.toLocaleString(), inline: true },
          { name: '🎯 Rank', value: `#${progress.rank} / ${progress.totalMembers}`, inline: true },
          { name: '📈 Progress', value: `${progress.currentXP.toLocaleString()} / ${progress.nextLevelXP.toLocaleString()} XP (${progress.progressPercentage.toFixed(1)}%)`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `${interaction.guild.name} • Leveling System` });

      if (rankCard) {
        const attachment = new AttachmentBuilder(rankCard, { name: 'rank-card.png' });
        embed.setImage('attachment://rank-card.png');
        await interaction.editReply({ embeds: [embed], files: [attachment] });
      } else {
        await interaction.editReply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Error in rank command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching rank information.'
      });
    }
  }
};

/**
 * Create a visual rank card (requires canvas)
 */
async function createRankCard(user: any, member: any, progress: any, guildName: string): Promise<Buffer | null> {
  try {
    // Create canvas
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext('2d');

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 800, 300);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 300);

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, 800, 300);

    // User avatar
    try {
      const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 128 }));
      ctx.save();
      ctx.beginPath();
      ctx.arc(100, 150, 60, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 40, 90, 120, 120);
      ctx.restore();

      // Avatar border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(100, 150, 60, 0, Math.PI * 2, true);
      ctx.stroke();
    } catch (error) {
      // Fallback if avatar fails to load
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(100, 150, 60, 0, Math.PI * 2, true);
      ctx.fill();
    }

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(user.displayName, 200, 120);

    // Level
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Level ${progress.currentLevel}`, 200, 160);

    // Rank
    ctx.font = '20px Arial';
    ctx.fillStyle = '#b3b3b3';
    ctx.fillText(`Rank #${progress.rank} / ${progress.totalMembers}`, 200, 190);

    // XP Progress Bar Background
    const barX = 200;
    const barY = 220;
    const barWidth = 500;
    const barHeight = 20;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // XP Progress Bar Fill
    const progressWidth = (progress.progressPercentage / 100) * barWidth;
    const progressGradient = ctx.createLinearGradient(barX, barY, barX + progressWidth, barY);
    progressGradient.addColorStop(0, '#00ff88');
    progressGradient.addColorStop(1, '#00cc6a');
    ctx.fillStyle = progressGradient;
    ctx.fillRect(barX, barY, progressWidth, barHeight);

    // XP Text
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText(`${progress.currentXP.toLocaleString()} / ${progress.nextLevelXP.toLocaleString()} XP`, barX, barY + 35);

    // Total XP
    ctx.fillText(`Total XP: ${progress.totalXP.toLocaleString()}`, barX + 250, barY + 35);

    return canvas.toBuffer();

  } catch (error) {
    console.error('Error creating rank card:', error);
    return null;
  }
}

export default command;