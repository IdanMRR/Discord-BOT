import { Client, Message, TextChannel, EmbedBuilder, GuildMember } from 'discord.js';
import { LevelingService } from '../../database/services/levelingService';
import { logInfo, logError } from '../../utils/logger';
import { Colors } from '../../utils/embeds';
import { DashboardLogsService } from '../../database/services/dashboardLogsService';

export class XPHandler {
  /**
   * Process XP gain from a message
   */
  static async processMessage(message: Message): Promise<void> {
    try {
      // Skip if not in guild or from bot
      if (!message.guild || message.author.bot) return;

      // Get leveling settings
      const settings = LevelingService.getLevelingSettings(message.guild.id);
      if (!settings || !settings.enabled) return;

      // Get user roles
      const member = message.member;
      const userRoles = member?.roles.cache.map(role => role.id) || [];

      // Process XP gain
      const result = LevelingService.processXPGain(
        message.guild.id,
        message.author.id,
        settings,
        message.channel.id,
        userRoles
      );

      if (!result) return; // No XP gained (cooldown, ignored channel, etc.)

      // Handle level up
      if (result.leveledUp) {
        await this.handleLevelUp(message, result.newLevel, result.oldLevel, settings);
      }

      // Only log level ups, not every XP gain to reduce spam
      if (result.leveledUp) {
        logInfo('XP Handler', `🎉 User ${message.author.tag} leveled up to ${result.newLevel}!`);
      }

    } catch (error) {
      logError('XP Handler', `Error processing message XP: ${error}`);
    }
  }

  /**
   * Handle level up event
   */
  private static async handleLevelUp(
    message: Message, 
    newLevel: number, 
    oldLevel: number, 
    settings: any
  ): Promise<void> {
    try {
      // Send level up message if enabled
      logInfo('XP Handler', `Level up message enabled: ${settings.level_up_message_enabled}, type: ${typeof settings.level_up_message_enabled}`);
      if (settings.level_up_message_enabled) {
        logInfo('XP Handler', `Sending level up message for ${message.author.tag}`);
        await this.sendLevelUpMessage(message, newLevel, settings);
      } else {
        logInfo('XP Handler', `Level up messages are disabled for guild ${message.guild?.id}`);
      }

      // Process level rewards
      await this.processLevelRewards(message, newLevel);

      // Log to dashboard
      await this.logLevelUp(message, newLevel, oldLevel);

    } catch (error) {
      logError('XP Handler', `Error handling level up: ${error}`);
    }
  }

  /**
   * Send level up message
   */
  private static async sendLevelUpMessage(message: Message, newLevel: number, settings: any): Promise<void> {
    try {
      logInfo('XP Handler', `Attempting to send level up message for ${message.author.tag} to level ${newLevel}`);
      if (!message.guild) {
        logError('XP Handler', 'No guild found for level up message');
        return;
      }

      // Determine target channel
      let targetChannel: TextChannel | null = null;
      
      if (settings.level_up_channel_id) {
        targetChannel = message.guild.channels.cache.get(settings.level_up_channel_id) as TextChannel;
      }
      
      if (!targetChannel) {
        targetChannel = message.channel as TextChannel;
        logInfo('XP Handler', `Using message channel for level up: ${targetChannel.name}`);
      } else {
        logInfo('XP Handler', `Using configured level up channel: ${targetChannel.name}`);
      }

      if (!targetChannel || !targetChannel.isTextBased()) {
        logError('XP Handler', 'Target channel is not text-based or not found');
        return;
      }

      // Get user level data for message variables
      const userLevel = LevelingService.getUserLevel(message.guild.id, message.author.id);
      const nextLevelXP = userLevel ? LevelingService.calculateXPForLevel(newLevel + 1, settings) : 0;

      // Replace message variables
      let levelUpMessage = settings.level_up_message || 'Congratulations {user}, you reached level {level}! 🎉';
      
      levelUpMessage = levelUpMessage
        .replace(/{user}/g, `<@${message.author.id}>`)
        .replace(/{user\.name}/g, message.author.displayName)
        .replace(/{level}/g, newLevel.toString())
        .replace(/{xp}/g, userLevel?.xp.toString() || '0')
        .replace(/{next_level_xp}/g, nextLevelXP.toString())
        .replace(/{server}/g, message.guild.name);

      // Create embed for level up
      const embed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('🎉 Level Up!')
        .setDescription(levelUpMessage)
        .addFields(
          { name: '📊 Current Level', value: newLevel.toString(), inline: true },
          { name: '✨ Total XP', value: userLevel?.xp.toLocaleString() || '0', inline: true },
          { name: '🎯 Next Level XP', value: nextLevelXP.toLocaleString(), inline: true }
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `Leveling System • ${message.guild.name}` });

      logInfo('XP Handler', `Sending level up embed to channel ${targetChannel.name}`);
      await targetChannel.send({ embeds: [embed] });
      logInfo('XP Handler', `✅ Level up message sent successfully!`);

    } catch (error) {
      logError('XP Handler', `Error sending level up message: ${error}`);
    }
  }

  /**
   * Process level rewards
   */
  private static async processLevelRewards(message: Message, newLevel: number): Promise<void> {
    try {
      if (!message.guild || !message.member) return;

      const rewards = LevelingService.getLevelRewards(message.guild.id, newLevel);
      if (rewards.length === 0) return;

      for (const reward of rewards) {
        switch (reward.type) {
          case 'role':
            await this.giveRoleReward(message.member, reward);
            break;
          case 'currency':
            // TODO: Implement currency system integration
            logInfo('XP Handler', `Currency reward not implemented: ${reward.value} for user ${message.author.id}`);
            break;
          case 'custom':
            logInfo('XP Handler', `Custom reward: ${reward.value} for user ${message.author.id}`);
            break;
        }
      }

    } catch (error) {
      logError('XP Handler', `Error processing level rewards: ${error}`);
    }
  }

  /**
   * Give role reward to user
   */
  private static async giveRoleReward(member: GuildMember, reward: any): Promise<void> {
    try {
      const role = member.guild.roles.cache.get(reward.value);
      if (!role) {
        logError('XP Handler', `Role reward not found: ${reward.value}`);
        return;
      }

      if (member.roles.cache.has(role.id)) {
        logInfo('XP Handler', `User ${member.user.tag} already has role ${role.name}`);
        return;
      }

      await member.roles.add(role);
      logInfo('XP Handler', `Gave role ${role.name} to ${member.user.tag} for reaching level ${reward.level}`);

      // Send notification to user
      try {
        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle('🎁 Level Reward!')
          .setDescription(`You've been awarded the **${role.name}** role for reaching level ${reward.level}!`)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp()
          .setFooter({ text: `${member.guild.name} • Leveling System` });

        await member.send({ embeds: [embed] });
      } catch (dmError) {
        // DM failed, could send to channel instead
        logInfo('XP Handler', `Could not DM role reward notification to ${member.user.tag}`);
      }

    } catch (error) {
      logError('XP Handler', `Error giving role reward: ${error}`);
    }
  }

  /**
   * Log level up to dashboard
   */
  private static async logLevelUp(message: Message, newLevel: number, oldLevel: number): Promise<void> {
    try {
      if (!message.guild) return;

      await DashboardLogsService.logActivity({
        guild_id: message.guild.id,
        user_id: 'system',
        action_type: 'user_level_up',
        target_type: 'user',
        target_id: message.author.id,
        page: 'leveling_system',
        details: `🚀 **Level Up!** ${message.author.tag} advanced from level ${oldLevel} to level ${newLevel}`
      });

    } catch (error) {
      logError('XP Handler', `Error logging level up: ${error}`);
    }
  }

  /**
   * Get user level progress information
   */
  static getLevelProgress(guildId: string, userId: string): {
    currentLevel: number;
    currentXP: number;
    currentLevelXP: number;
    nextLevelXP: number;
    progressPercentage: number;
    totalXP: number;
    rank: number;
    totalMembers: number;
  } | null {
    try {
      const settings = LevelingService.getLevelingSettings(guildId);
      const userLevel = LevelingService.getUserLevel(guildId, userId);
      
      if (!settings || !userLevel) return null;

      const currentLevel = userLevel.level;
      const totalXP = userLevel.xp;
      
      // Calculate XP for current and next level
      const currentLevelTotalXP = LevelingService.calculateTotalXPForLevel(currentLevel, settings);
      const nextLevelTotalXP = LevelingService.calculateTotalXPForLevel(currentLevel + 1, settings);
      
      const currentLevelXP = totalXP - currentLevelTotalXP;
      const nextLevelXP = LevelingService.calculateXPForLevel(currentLevel + 1, settings);
      
      const progressPercentage = Math.min(100, (currentLevelXP / nextLevelXP) * 100);
      
      const rank = LevelingService.getUserRank(guildId, userId);
      const totalMembers = LevelingService.getTotalRankedMembers(guildId);

      return {
        currentLevel,
        currentXP: currentLevelXP,
        currentLevelXP: currentLevelTotalXP,
        nextLevelXP,
        progressPercentage,
        totalXP,
        rank,
        totalMembers
      };

    } catch (error) {
      logError('XP Handler', `Error getting level progress: ${error}`);
      return null;
    }
  }
}