import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { Command, ExecuteProps } from '../../types/Command';
import { LevelingService } from '../../database/services/levelingService';
import { XPHandler } from '../../handlers/leveling/xp-handler';
import { Colors } from '../../utils/embeds';
import { createCanvas, loadImage } from 'canvas';

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

      // Create modern level card
      const levelCard = await createModernLevelCard(targetUser, member, progress, userLevel, interaction.guild.name);

      // Create minimal embed focused on the image
      const embed = new EmbedBuilder()
        .setColor('#6366f1') // Modern indigo color
        .setDescription(`🌟 **${targetUser.displayName}**'s Level Progress`)
        .setTimestamp()
        .setFooter({ 
          text: `${interaction.guild.name} • Leveling System`, 
          iconURL: interaction.guild.iconURL() || undefined 
        });

      if (levelCard) {
        const attachment = new AttachmentBuilder(levelCard, { name: 'level-card.png' });
        embed.setImage('attachment://level-card.png');
        await interaction.editReply({ embeds: [embed], files: [attachment] });
      } else {
        // Fallback to text-based display if image generation fails
        const xpNeeded = progress.nextLevelXP - progress.currentXP;
        const nextLevelProgress = Math.min(100, (progress.currentXP / progress.nextLevelXP) * 100);
        
        embed.addFields(
          { name: '🏆 Level', value: `**${progress.currentLevel}**`, inline: true },
          { name: '✨ Total XP', value: `**${progress.totalXP.toLocaleString()}**`, inline: true },
          { name: '🎯 Rank', value: `**#${progress.rank}**`, inline: true },
          { name: '📈 Progress', value: `**${progress.currentXP.toLocaleString()}** / **${progress.nextLevelXP.toLocaleString()}** XP (${nextLevelProgress.toFixed(1)}%)`, inline: false }
        );
        
        await interaction.editReply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Error in level command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching level information.'
      });
    }
  }
};

/**
 * Create a modern, sexy level card with gradient backgrounds and sleek design
 */
async function createModernLevelCard(user: any, member: any, progress: any, userLevel: any, guildName: string): Promise<Buffer | null> {
  try {
    // Create a wider, more modern canvas
    const canvas = createCanvas(1200, 400);
    const ctx = canvas.getContext('2d');

    // Modern gradient background - Dark theme with purple/blue tones
    const bgGradient = ctx.createLinearGradient(0, 0, 1200, 400);
    bgGradient.addColorStop(0, '#0f0f23');
    bgGradient.addColorStop(0.3, '#1a1a2e');
    bgGradient.addColorStop(0.7, '#16213e');
    bgGradient.addColorStop(1, '#0f0f23');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1200, 400);

    // Add subtle pattern overlay
    ctx.fillStyle = 'rgba(99, 102, 241, 0.05)';
    for (let x = 0; x < 1200; x += 60) {
      for (let y = 0; y < 400; y += 60) {
        ctx.fillRect(x, y, 30, 30);
      }
    }

    // Glowing accent line at the top
    const accentGradient = ctx.createLinearGradient(0, 0, 1200, 0);
    accentGradient.addColorStop(0, 'rgba(99, 102, 241, 0)');
    accentGradient.addColorStop(0.2, 'rgba(99, 102, 241, 0.8)');
    accentGradient.addColorStop(0.5, 'rgba(139, 92, 246, 1)');
    accentGradient.addColorStop(0.8, 'rgba(99, 102, 241, 0.8)');
    accentGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = accentGradient;
    ctx.fillRect(0, 0, 1200, 6);

    // User avatar with glow effect
    try {
      const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
      
      // Avatar glow
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Avatar background circle with gradient
      const avatarBgGradient = ctx.createRadialGradient(140, 200, 0, 140, 200, 90);
      avatarBgGradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
      avatarBgGradient.addColorStop(1, 'rgba(99, 102, 241, 0.1)');
      ctx.fillStyle = avatarBgGradient;
      ctx.beginPath();
      ctx.arc(140, 200, 90, 0, Math.PI * 2);
      ctx.fill();

      // Draw avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(140, 200, 75, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 65, 125, 150, 150);
      ctx.restore();

      // Avatar border with gradient
      const borderGradient = ctx.createLinearGradient(65, 125, 215, 275);
      borderGradient.addColorStop(0, '#6366f1');
      borderGradient.addColorStop(0.5, '#8b5cf6');
      borderGradient.addColorStop(1, '#6366f1');
      ctx.strokeStyle = borderGradient;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(140, 200, 75, 0, Math.PI * 2, true);
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;
    } catch (error) {
      // Fallback avatar
      const avatarGradient = ctx.createRadialGradient(140, 200, 0, 140, 200, 75);
      avatarGradient.addColorStop(0, '#6366f1');
      avatarGradient.addColorStop(1, '#3730a3');
      ctx.fillStyle = avatarGradient;
      ctx.beginPath();
      ctx.arc(140, 200, 75, 0, Math.PI * 2, true);
      ctx.fill();
    }

    // Username with glow effect
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "Segoe UI", Arial, sans-serif';
    ctx.fillText(user.displayName, 280, 120);

    // Level badge with modern styling
    const levelBadgeX = 280;
    const levelBadgeY = 140;
    const levelBadgeWidth = 120;
    const levelBadgeHeight = 40;

    // Level badge background with gradient
    const levelGradient = ctx.createLinearGradient(levelBadgeX, levelBadgeY, levelBadgeX + levelBadgeWidth, levelBadgeY + levelBadgeHeight);
    levelGradient.addColorStop(0, '#8b5cf6');
    levelGradient.addColorStop(1, '#6366f1');
    ctx.fillStyle = levelGradient;
    ctx.fillRect(levelBadgeX, levelBadgeY, levelBadgeWidth, levelBadgeHeight);

    // Level badge border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(levelBadgeX, levelBadgeY, levelBadgeWidth, levelBadgeHeight);

    // Level text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${progress.currentLevel}`, levelBadgeX + levelBadgeWidth / 2, levelBadgeY + 25);

    // Reset text alignment
    ctx.textAlign = 'left';

    // Rank and XP info
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Rank #${progress.rank}`, 450, 160);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`out of ${progress.totalMembers} members`, 580, 160);

    // XP Statistics
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${progress.totalXP.toLocaleString()} Total XP`, 280, 210);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${userLevel.message_count.toLocaleString()} messages sent`, 280, 235);

    // Progress bar with modern design
    const progressBarX = 280;
    const progressBarY = 270;
    const progressBarWidth = 850;
    const progressBarHeight = 16;
    const progressPercentage = Math.min(100, (progress.currentXP / progress.nextLevelXP) * 100);

    // Progress bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);

    // Progress bar fill with animated gradient
    const progressFillWidth = (progressPercentage / 100) * progressBarWidth;
    const progressGradient = ctx.createLinearGradient(progressBarX, progressBarY, progressBarX + progressFillWidth, progressBarY);
    progressGradient.addColorStop(0, '#06ffa5');
    progressGradient.addColorStop(0.3, '#10b981');
    progressGradient.addColorStop(0.6, '#0891b2');
    progressGradient.addColorStop(1, '#6366f1');
    ctx.fillStyle = progressGradient;
    ctx.fillRect(progressBarX, progressBarY, progressFillWidth, progressBarHeight);

    // Progress bar glow effect
    ctx.shadowColor = '#06ffa5';
    ctx.shadowBlur = 15;
    ctx.fillRect(progressBarX, progressBarY, progressFillWidth, progressBarHeight);
    ctx.shadowBlur = 0;

    // Progress bar border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);

    // Progress text with modern styling
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${progress.currentXP.toLocaleString()} / ${progress.nextLevelXP.toLocaleString()} XP`, progressBarX, progressBarY + 35);

    // Progress percentage
    ctx.fillStyle = '#06ffa5';
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${progressPercentage.toFixed(1)}%`, progressBarX + progressBarWidth, progressBarY + 35);

    // XP needed for next level
    const xpNeeded = progress.nextLevelXP - progress.currentXP;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${xpNeeded.toLocaleString()} XP to next level`, progressBarX + progressBarWidth, progressBarY + 55);

    // Decorative elements
    // Add some sparkle effects
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const sparkles = [
      { x: 950, y: 80, size: 3 },
      { x: 1000, y: 120, size: 2 },
      { x: 1050, y: 90, size: 4 },
      { x: 1100, y: 110, size: 2 },
      { x: 1150, y: 85, size: 3 }
    ];

    sparkles.forEach(sparkle => {
      ctx.beginPath();
      ctx.arc(sparkle.x, sparkle.y, sparkle.size, 0, Math.PI * 2);
      ctx.fill();
    });

    return canvas.toBuffer();

  } catch (error) {
    console.error('Error creating modern level card:', error);
    return null;
  }
}

export default command;