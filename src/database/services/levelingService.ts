import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

export interface LevelingSettings {
  guild_id: string;
  enabled?: boolean;
  xp_per_message?: number;
  xp_cooldown?: number;
  xp_multiplier?: number;
  level_formula?: string;
  base_xp?: number;
  xp_multiplier_per_level?: number;
  level_up_message_enabled?: boolean;
  level_up_channel_id?: string;
  level_up_message?: string;
  level_rewards?: string;
  voice_xp_enabled?: boolean;
  voice_xp_rate?: number;
  boost_channels?: string;
  boost_roles?: string;
  ignored_channels?: string;
  ignored_roles?: string;
  leaderboard_enabled?: boolean;
  leaderboard_channel_id?: string;
  leaderboard_update_interval?: number;
}

export interface UserLevel {
  guild_id: string;
  user_id: string;
  xp: number;
  level: number;
  message_count: number;
  last_xp_gain: string;
}

export interface LevelReward {
  id: string;
  level: number;
  type: 'role' | 'currency' | 'custom';
  value: string;
  amount?: number;
  description: string;
}

export class LevelingService {
  // XP cooldown cache to prevent spam
  private static xpCooldowns = new Map<string, number>();

  /**
   * Get leveling settings for a guild
   */
  static getLevelingSettings(guildId: string): LevelingSettings | null {
    try {
      const stmt = db.prepare('SELECT * FROM leveling_settings WHERE guild_id = ?');
      return stmt.get(guildId) as LevelingSettings | undefined || null;
    } catch (error) {
      logError('Leveling Service', `Error getting leveling settings: ${error}`);
      return null;
    }
  }

  /**
   * Update leveling settings for a guild
   */
  static updateLevelingSettings(guildId: string, settings: Partial<LevelingSettings>): boolean {
    try {
      // Get current settings first
      const currentSettings = this.getLevelingSettings(guildId);
      
      // If no current settings exist, insert default settings first
      if (!currentSettings) {
        const insertStmt = db.prepare(`
          INSERT INTO leveling_settings (
            guild_id, enabled, xp_per_message, xp_cooldown, xp_multiplier,
            level_formula, base_xp, xp_multiplier_per_level,
            level_up_message_enabled, level_up_channel_id, level_up_message,
            level_rewards, voice_xp_enabled, voice_xp_rate,
            boost_channels, boost_roles, ignored_channels, ignored_roles,
            leaderboard_enabled, leaderboard_channel_id, leaderboard_update_interval,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);

        insertStmt.run(
          guildId,
          settings.enabled !== undefined ? (settings.enabled ? 1 : 0) : 1,
          settings.xp_per_message || 15,
          settings.xp_cooldown || 60,
          settings.xp_multiplier || 1.0,
          settings.level_formula || 'quadratic',
          settings.base_xp || 100,
          settings.xp_multiplier_per_level || 1.1,
          settings.level_up_message_enabled !== undefined ? (settings.level_up_message_enabled ? 1 : 0) : 1,
          settings.level_up_channel_id || '',
          settings.level_up_message || 'Congratulations {user}, you reached level {level}! 🎉',
          settings.level_rewards || '[]',
          settings.voice_xp_enabled !== undefined ? (settings.voice_xp_enabled ? 1 : 0) : 0,
          settings.voice_xp_rate || 10,
          settings.boost_channels || '[]',
          settings.boost_roles || '[]',
          settings.ignored_channels || '[]',
          settings.ignored_roles || '[]',
          settings.leaderboard_enabled !== undefined ? (settings.leaderboard_enabled ? 1 : 0) : 1,
          settings.leaderboard_channel_id || '',
          settings.leaderboard_update_interval || 3600
        );
      } else {
        // Update only the provided fields
        const updates = [];
        const values = [];

        if (settings.enabled !== undefined) {
          updates.push('enabled = ?');
          values.push(settings.enabled ? 1 : 0);
        }
        if (settings.xp_per_message !== undefined) {
          updates.push('xp_per_message = ?');
          values.push(settings.xp_per_message);
        }
        if (settings.xp_cooldown !== undefined) {
          updates.push('xp_cooldown = ?');
          values.push(settings.xp_cooldown);
        }
        if (settings.xp_multiplier !== undefined) {
          updates.push('xp_multiplier = ?');
          values.push(settings.xp_multiplier);
        }
        if (settings.level_formula !== undefined) {
          updates.push('level_formula = ?');
          values.push(settings.level_formula);
        }
        if (settings.base_xp !== undefined) {
          updates.push('base_xp = ?');
          values.push(settings.base_xp);
        }
        if (settings.xp_multiplier_per_level !== undefined) {
          updates.push('xp_multiplier_per_level = ?');
          values.push(settings.xp_multiplier_per_level);
        }
        if (settings.level_up_message_enabled !== undefined) {
          updates.push('level_up_message_enabled = ?');
          values.push(settings.level_up_message_enabled ? 1 : 0);
        }
        if (settings.level_up_channel_id !== undefined) {
          updates.push('level_up_channel_id = ?');
          values.push(settings.level_up_channel_id);
        }
        if (settings.level_up_message !== undefined) {
          updates.push('level_up_message = ?');
          values.push(settings.level_up_message);
        }
        if (settings.level_rewards !== undefined) {
          updates.push('level_rewards = ?');
          values.push(settings.level_rewards);
        }
        if (settings.voice_xp_enabled !== undefined) {
          updates.push('voice_xp_enabled = ?');
          values.push(settings.voice_xp_enabled ? 1 : 0);
        }
        if (settings.voice_xp_rate !== undefined) {
          updates.push('voice_xp_rate = ?');
          values.push(settings.voice_xp_rate);
        }
        if (settings.boost_channels !== undefined) {
          updates.push('boost_channels = ?');
          values.push(settings.boost_channels);
        }
        if (settings.boost_roles !== undefined) {
          updates.push('boost_roles = ?');
          values.push(settings.boost_roles);
        }
        if (settings.ignored_channels !== undefined) {
          updates.push('ignored_channels = ?');
          values.push(settings.ignored_channels);
        }
        if (settings.ignored_roles !== undefined) {
          updates.push('ignored_roles = ?');
          values.push(settings.ignored_roles);
        }
        if (settings.leaderboard_enabled !== undefined) {
          updates.push('leaderboard_enabled = ?');
          values.push(settings.leaderboard_enabled ? 1 : 0);
        }
        if (settings.leaderboard_channel_id !== undefined) {
          updates.push('leaderboard_channel_id = ?');
          values.push(settings.leaderboard_channel_id);
        }
        if (settings.leaderboard_update_interval !== undefined) {
          updates.push('leaderboard_update_interval = ?');
          values.push(settings.leaderboard_update_interval);
        }

        if (updates.length > 0) {
          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(guildId);

          const updateStmt = db.prepare(`
            UPDATE leveling_settings 
            SET ${updates.join(', ')} 
            WHERE guild_id = ?
          `);

          updateStmt.run(...values);
        }
      }

      return true;
    } catch (error) {
      logError('Leveling Service', `Error updating leveling settings: ${error}`);
      return false;
    }
  }

  /**
   * Get user level data
   */
  static getUserLevel(guildId: string, userId: string): UserLevel | null {
    try {
      const stmt = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?');
      return stmt.get(guildId, userId) as UserLevel | undefined || null;
    } catch (error) {
      logError('Leveling Service', `Error getting user level: ${error}`);
      return null;
    }
  }

  /**
   * Calculate XP required for a specific level
   */
  static calculateXPForLevel(level: number, settings: LevelingSettings): number {
    const formula = settings.level_formula || 'quadratic';
    const baseXP = settings.base_xp || 100;
    const multiplier = settings.xp_multiplier_per_level || 1.1;

    switch (formula) {
      case 'linear':
        return baseXP * level;
      case 'quadratic':
        return baseXP * Math.pow(level, 2);
      case 'exponential':
        return Math.floor(baseXP * Math.pow(multiplier, level));
      case 'logarithmic':
        return Math.floor(baseXP * Math.log(level + 1) * 10);
      default:
        return baseXP * Math.pow(level, 2);
    }
  }

  /**
   * Calculate total XP needed to reach a level
   */
  static calculateTotalXPForLevel(level: number, settings: LevelingSettings): number {
    let totalXP = 0;
    for (let i = 1; i <= level; i++) {
      totalXP += this.calculateXPForLevel(i, settings);
    }
    return totalXP;
  }

  /**
   * Calculate level from total XP
   */
  static calculateLevelFromXP(totalXP: number, settings: LevelingSettings): number {
    let level = 0;
    let currentXP = 0;

    while (currentXP <= totalXP) {
      level++;
      currentXP += this.calculateXPForLevel(level, settings);
    }

    return Math.max(0, level - 1);
  }

  /**
   * Check if user is on XP cooldown
   */
  static isOnCooldown(guildId: string, userId: string, cooldownSeconds: number): boolean {
    const key = `${guildId}:${userId}`;
    const lastGain = this.xpCooldowns.get(key);
    
    if (!lastGain) return false;
    
    const now = Date.now();
    const timeSince = (now - lastGain) / 1000;
    
    return timeSince < cooldownSeconds;
  }

  /**
   * Set XP cooldown for user
   */
  static setCooldown(guildId: string, userId: string): void {
    const key = `${guildId}:${userId}`;
    this.xpCooldowns.set(key, Date.now());
  }

  /**
   * Process XP gain for user
   */
  static processXPGain(
    guildId: string, 
    userId: string, 
    settings: LevelingSettings, 
    channelId: string,
    userRoles: string[] = []
  ): { xpGained: number; leveledUp: boolean; newLevel: number; oldLevel: number } | null {
    try {
      // Check if leveling is enabled
      if (!settings.enabled) return null;

      // Check cooldown
      if (this.isOnCooldown(guildId, userId, settings.xp_cooldown || 60)) {
        return null;
      }

      // Check ignored channels
      const ignoredChannels = JSON.parse(settings.ignored_channels || '[]');
      if (ignoredChannels.includes(channelId)) {
        return null;
      }

      // Check ignored roles
      const ignoredRoles = JSON.parse(settings.ignored_roles || '[]');
      if (userRoles.some(role => ignoredRoles.includes(role))) {
        return null;
      }

      // Calculate XP gain
      let xpGain = settings.xp_per_message || 15;

      // Apply global multiplier
      xpGain *= settings.xp_multiplier || 1.0;

      // Apply channel boost
      const boostChannels = JSON.parse(settings.boost_channels || '[]');
      if (boostChannels.includes(channelId)) {
        xpGain *= 1.5; // 50% boost for boost channels
      }

      // Apply role boost
      const boostRoles = JSON.parse(settings.boost_roles || '[]');
      if (userRoles.some(role => boostRoles.includes(role))) {
        xpGain *= 1.25; // 25% boost for boost roles
      }

      // Add small random variation (±20%)
      const variation = 0.8 + (Math.random() * 0.4);
      xpGain = Math.floor(xpGain * variation);

      // Get current user level data
      let userLevel = this.getUserLevel(guildId, userId);
      const oldLevel = userLevel?.level || 0;

      if (!userLevel) {
        // Create new user level record
        const stmt = db.prepare(`
          INSERT INTO user_levels (guild_id, user_id, xp, level, message_count, last_xp_gain)
          VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        `);
        stmt.run(guildId, userId, xpGain, 0);
        userLevel = { guild_id: guildId, user_id: userId, xp: xpGain, level: 0, message_count: 1, last_xp_gain: new Date().toISOString() };
      } else {
        // Update existing user
        const newTotalXP = userLevel.xp + xpGain;
        const stmt = db.prepare(`
          UPDATE user_levels 
          SET xp = ?, message_count = message_count + 1, last_xp_gain = CURRENT_TIMESTAMP
          WHERE guild_id = ? AND user_id = ?
        `);
        stmt.run(newTotalXP, guildId, userId);
        userLevel.xp = newTotalXP;
        userLevel.message_count++;
      }

      // Calculate new level
      const newLevel = this.calculateLevelFromXP(userLevel.xp, settings);
      const leveledUp = newLevel > oldLevel;

      // Update level if changed
      if (leveledUp) {
        const stmt = db.prepare('UPDATE user_levels SET level = ? WHERE guild_id = ? AND user_id = ?');
        stmt.run(newLevel, guildId, userId);
        
        logInfo('Leveling Service', `User ${userId} leveled up from ${oldLevel} to ${newLevel} in guild ${guildId}`);
      }

      // Set cooldown
      this.setCooldown(guildId, userId);

      return {
        xpGained: xpGain,
        leveledUp,
        newLevel,
        oldLevel
      };

    } catch (error) {
      logError('Leveling Service', `Error processing XP gain: ${error}`);
      return null;
    }
  }

  /**
   * Get leaderboard for guild
   */
  static getLeaderboard(guildId: string, limit: number = 10): UserLevel[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM user_levels 
        WHERE guild_id = ? 
        ORDER BY level DESC, xp DESC 
        LIMIT ?
      `);
      return stmt.all(guildId, limit) as UserLevel[];
    } catch (error) {
      logError('Leveling Service', `Error getting leaderboard: ${error}`);
      return [];
    }
  }

  /**
   * Get user rank in guild
   */
  static getUserRank(guildId: string, userId: string): number {
    try {
      const stmt = db.prepare(`
        SELECT COUNT(*) + 1 as rank
        FROM user_levels ul1
        WHERE ul1.guild_id = ?
        AND (ul1.level > (SELECT level FROM user_levels WHERE guild_id = ? AND user_id = ?)
        OR (ul1.level = (SELECT level FROM user_levels WHERE guild_id = ? AND user_id = ?) 
            AND ul1.xp > (SELECT xp FROM user_levels WHERE guild_id = ? AND user_id = ?)))
      `);
      const result = stmt.get(guildId, guildId, userId, guildId, userId, guildId, userId) as { rank: number };
      return result.rank;
    } catch (error) {
      logError('Leveling Service', `Error getting user rank: ${error}`);
      return 0;
    }
  }

  /**
   * Get level rewards for a specific level
   */
  static getLevelRewards(guildId: string, level: number): LevelReward[] {
    try {
      const settings = this.getLevelingSettings(guildId);
      if (!settings || !settings.level_rewards) return [];

      const rewards = JSON.parse(settings.level_rewards) as LevelReward[];
      return rewards.filter(reward => reward.level === level);
    } catch (error) {
      logError('Leveling Service', `Error getting level rewards: ${error}`);
      return [];
    }
  }

  /**
   * Reset user level data
   */
  static resetUserLevel(guildId: string, userId: string): boolean {
    try {
      const stmt = db.prepare('DELETE FROM user_levels WHERE guild_id = ? AND user_id = ?');
      stmt.run(guildId, userId);
      return true;
    } catch (error) {
      logError('Leveling Service', `Error resetting user level: ${error}`);
      return false;
    }
  }

  /**
   * Set user XP/level manually
   */
  static setUserLevel(guildId: string, userId: string, xp: number, level?: number): boolean {
    try {
      const settings = this.getLevelingSettings(guildId);
      if (!settings) return false;

      const calculatedLevel = level ?? this.calculateLevelFromXP(xp, settings);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO user_levels (guild_id, user_id, xp, level, total_messages, last_xp_gain)
        VALUES (?, ?, ?, ?, COALESCE((SELECT total_messages FROM user_levels WHERE guild_id = ? AND user_id = ?), 0), CURRENT_TIMESTAMP)
      `);
      
      stmt.run(guildId, userId, xp, calculatedLevel, guildId, userId);
      return true;
    } catch (error) {
      logError('Leveling Service', `Error setting user level: ${error}`);
      return false;
    }
  }

  /**
   * Get total members with levels in guild
   */
  static getTotalRankedMembers(guildId: string): number {
    try {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM user_levels WHERE guild_id = ?');
      const result = stmt.get(guildId) as { count: number };
      return result.count;
    } catch (error) {
      logError('Leveling Service', `Error getting total ranked members: ${error}`);
      return 0;
    }
  }
}