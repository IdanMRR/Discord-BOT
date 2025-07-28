import { Guild, GuildMember, User } from 'discord.js';
import { AutomodEscalationRule, AutomodEscalationService } from '../../database/services/automodEscalationService';
import { ModerationCaseService } from '../../database/services';
import { logInfo, logError, logModeration } from '../../utils/logger';
import { logModerationToDatabase } from '../../utils/databaseLogger';
import { createModerationEmbed } from '../../utils/embeds';

export interface PunishmentResult {
  success: boolean;
  error?: string;
  caseNumber?: number;
  action: string;
}

export class AutomodPunishmentHandler {
  private static readonly AUTOMOD_BOT_ID = 'AUTOMOD_SYSTEM';

  static async executePunishment(
    guild: Guild,
    member: GuildMember,
    rule: AutomodEscalationRule,
    warningCount: number
  ): Promise<PunishmentResult> {
    try {
      logInfo('AutomodPunishmentHandler', 
        `Executing ${rule.punishment_type} punishment for user ${member.id} in guild ${guild.id} (${warningCount} warnings)`
      );

      let result: PunishmentResult;

      switch (rule.punishment_type) {
        case 'timeout':
          result = await this.executeTimeout(guild, member, rule);
          break;
        case 'kick':
          result = await this.executeKick(guild, member, rule);
          break;
        case 'ban':
          result = await this.executeBan(guild, member, rule);
          break;
        case 'role_remove':
          result = await this.executeRoleRemove(guild, member, rule);
          break;
        case 'role_add':
          result = await this.executeRoleAdd(guild, member, rule);
          break;
        case 'nothing':
          result = { success: true, action: 'No action taken (warning only)' };
          break;
        default:
          result = { 
            success: false, 
            error: `Unknown punishment type: ${rule.punishment_type}`,
            action: rule.punishment_type
          };
      }

      // Create moderation case if punishment was successful
      if (result.success && rule.punishment_type !== 'nothing') {
        try {
          const moderationCase = await ModerationCaseService.create({
            guild_id: guild.id,
            action_type: this.getPunishmentActionType(rule.punishment_type),
            user_id: member.id,
            moderator_id: this.AUTOMOD_BOT_ID,
            reason: rule.punishment_reason,
            additional_info: JSON.stringify({
              automod: true,
              rule_id: rule.id,
              warning_count: warningCount,
              punishment_duration: rule.punishment_duration
            })
          });

          result.caseNumber = moderationCase?.case_number;
          logInfo('AutomodPunishmentHandler', `Created moderation case #${moderationCase?.case_number} for automod action`);
        } catch (caseError) {
          logError('AutomodPunishmentHandler', `Failed to create moderation case: ${caseError}`);
          // Don't fail the punishment if case creation fails
        }
      }

      // Log the escalation action
      await AutomodEscalationService.logEscalationAction({
        guild_id: guild.id,
        user_id: member.id,
        moderator_id: this.AUTOMOD_BOT_ID,
        rule_id: rule.id!,
        warning_count: warningCount,
        punishment_type: rule.punishment_type,
        punishment_duration: rule.punishment_duration,
        punishment_reason: rule.punishment_reason,
        success: result.success,
        error_message: result.error,
        case_number: result.caseNumber
      });

      // Send notification to user and log to server channel (if punishment was successful)
      if (result.success && rule.punishment_type !== 'nothing') {
        // Send DM notification to user
        await this.notifyUser(member.user, guild, rule, warningCount, result.caseNumber);
        
        // Log to server moderation channel
        await this.logToServerChannel(guild, member, rule, warningCount, result.caseNumber);
      }

      return result;
    } catch (error) {
      const errorMessage = `Failed to execute punishment: ${error}`;
      logError('AutomodPunishmentHandler', errorMessage);

      // Log the failed action
      await AutomodEscalationService.logEscalationAction({
        guild_id: guild.id,
        user_id: member.id,
        moderator_id: this.AUTOMOD_BOT_ID,
        rule_id: rule.id!,
        warning_count: warningCount,
        punishment_type: rule.punishment_type,
        punishment_duration: rule.punishment_duration,
        punishment_reason: rule.punishment_reason,
        success: false,
        error_message: errorMessage
      });

      return {
        success: false,
        error: errorMessage,
        action: rule.punishment_type
      };
    }
  }

  private static async executeTimeout(
    guild: Guild,
    member: GuildMember,
    rule: AutomodEscalationRule
  ): Promise<PunishmentResult> {
    try {
      const duration = rule.punishment_duration || 60; // Default 60 minutes
      const timeoutUntil = new Date(Date.now() + duration * 60 * 1000);

      await member.timeout(duration * 60 * 1000, rule.punishment_reason);

      return {
        success: true,
        action: `Timed out for ${duration} minutes`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to timeout user: ${error}`,
        action: 'timeout'
      };
    }
  }

  private static async executeKick(
    guild: Guild,
    member: GuildMember,
    rule: AutomodEscalationRule
  ): Promise<PunishmentResult> {
    try {
      await member.kick(rule.punishment_reason);

      return {
        success: true,
        action: 'Kicked from server'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to kick user: ${error}`,
        action: 'kick'
      };
    }
  }

  private static async executeBan(
    guild: Guild,
    member: GuildMember,
    rule: AutomodEscalationRule
  ): Promise<PunishmentResult> {
    try {
      const deleteMessageDays = Math.min(rule.punishment_duration || 0, 7); // Max 7 days
      
      await guild.members.ban(member.id, {
        reason: rule.punishment_reason,
        deleteMessageDays: deleteMessageDays
      });

      return {
        success: true,
        action: `Banned from server${deleteMessageDays > 0 ? ` (${deleteMessageDays} days of messages deleted)` : ''}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to ban user: ${error}`,
        action: 'ban'
      };
    }
  }

  private static async executeRoleRemove(
    guild: Guild,
    member: GuildMember,
    rule: AutomodEscalationRule
  ): Promise<PunishmentResult> {
    try {
      if (!rule.role_id) {
        return {
          success: false,
          error: 'No role ID specified for role removal',
          action: 'role_remove'
        };
      }

      const role = await guild.roles.fetch(rule.role_id);
      if (!role) {
        return {
          success: false,
          error: `Role ${rule.role_id} not found`,
          action: 'role_remove'
        };
      }

      if (!member.roles.cache.has(rule.role_id)) {
        return {
          success: true,
          action: `User doesn't have role ${role.name} - no action needed`
        };
      }

      await member.roles.remove(role, rule.punishment_reason);

      return {
        success: true,
        action: `Removed role: ${role.name}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove role: ${error}`,
        action: 'role_remove'
      };
    }
  }

  private static async executeRoleAdd(
    guild: Guild,
    member: GuildMember,
    rule: AutomodEscalationRule
  ): Promise<PunishmentResult> {
    try {
      if (!rule.role_id) {
        return {
          success: false,
          error: 'No role ID specified for role addition',
          action: 'role_add'
        };
      }

      const role = await guild.roles.fetch(rule.role_id);
      if (!role) {
        return {
          success: false,
          error: `Role ${rule.role_id} not found`,
          action: 'role_add'
        };
      }

      if (member.roles.cache.has(rule.role_id)) {
        return {
          success: true,
          action: `User already has role ${role.name} - no action needed`
        };
      }

      await member.roles.add(role, rule.punishment_reason);

      return {
        success: true,
        action: `Added role: ${role.name}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add role: ${error}`,
        action: 'role_add'
      };
    }
  }

  private static async notifyUser(
    user: User,
    guild: Guild,
    rule: AutomodEscalationRule,
    warningCount: number,
    caseNumber?: number
  ): Promise<void> {
    try {
      // Create a fake automod moderator user for the embed
      const automodUser = {
        id: this.AUTOMOD_BOT_ID,
        username: 'Automod System',
        displayAvatarURL: () => 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
      } as User;

      const additionalFields = [
        { name: '⚠️ Warning Count', value: warningCount.toString(), inline: true },
        { name: '🏠 Server', value: guild.name, inline: true },
        { name: '🤖 Automated Action', value: 'This action was taken automatically by the warning escalation system.', inline: false }
      ];

      // Add duration field for timeouts
      if (rule.punishment_type === 'timeout' && rule.punishment_duration) {
        additionalFields.unshift({ 
          name: '⏱️ Duration', 
          value: `${rule.punishment_duration} minutes`, 
          inline: true 
        });
      }

      const embed = createModerationEmbed({
        action: this.getPunishmentActionType(rule.punishment_type),
        target: user,
        moderator: automodUser,
        reason: rule.punishment_reason,
        caseNumber: caseNumber,
        additionalFields: additionalFields
      });

      await user.send({ 
        content: `⚠️ **Automod Action in ${guild.name}** ⚠️`,
        embeds: [embed] 
      });
      
      logInfo('AutomodPunishmentHandler', `Sent notification to user ${user.id}`);
    } catch (error) {
      logError('AutomodPunishmentHandler', `Failed to send notification to user ${user.id}: ${error}`);
      // Don't throw error - notification failure shouldn't fail the punishment
    }
  }

  private static async logToServerChannel(
    guild: Guild,
    member: GuildMember,
    rule: AutomodEscalationRule,
    warningCount: number,
    caseNumber?: number
  ): Promise<void> {
    try {
      // Create a fake automod moderator user for logging
      const automodUser = {
        id: this.AUTOMOD_BOT_ID,
        username: 'Automod System',
        displayAvatarURL: () => 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
      } as User;

      const additionalInfo = `Automatic punishment triggered by reaching ${warningCount} warnings`;
      const duration = rule.punishment_type === 'timeout' && rule.punishment_duration 
        ? `${rule.punishment_duration} minutes` 
        : undefined;

      // Log to server moderation channel
      const logResult = await logModeration({
        guild: guild,
        action: this.getPunishmentActionType(rule.punishment_type),
        target: member.user,
        moderator: automodUser,
        reason: rule.punishment_reason,
        duration: duration,
        additionalInfo: additionalInfo,
        caseNumber: caseNumber
      });

      // Log to database as well
      await logModerationToDatabase({
        guild: guild,
        action: this.getPunishmentActionType(rule.punishment_type),
        target: member.user,
        moderator: automodUser,
        reason: rule.punishment_reason,
        duration: duration,
        additionalInfo: `Automod Case #${caseNumber} - ${additionalInfo}`
      });

      logInfo('AutomodPunishmentHandler', `Logged automod action to server channel for guild ${guild.id}`);
    } catch (error) {
      logError('AutomodPunishmentHandler', `Failed to log automod action to server channel: ${error}`);
      // Don't throw error - logging failure shouldn't fail the punishment
    }
  }

  private static getPunishmentDescription(rule: AutomodEscalationRule): string {
    switch (rule.punishment_type) {
      case 'timeout':
        return `Timeout for ${rule.punishment_duration || 60} minutes`;
      case 'kick':
        return 'Kicked from server';
      case 'ban':
        return 'Banned from server';
      case 'role_remove':
        return 'Role removed';
      case 'role_add':
        return 'Role added';
      case 'nothing':
        return 'Warning only (no punishment)';
      default:
        return rule.punishment_type;
    }
  }

  private static getPunishmentActionType(punishmentType: string): string {
    switch (punishmentType) {
      case 'timeout':
        return 'Timeout';
      case 'kick':
        return 'Kick';
      case 'ban':
        return 'Ban';
      case 'role_remove':
        return 'Role Removal';
      case 'role_add':
        return 'Role Addition';
      default:
        return 'Automod Action';
    }
  }
}

export default AutomodPunishmentHandler;