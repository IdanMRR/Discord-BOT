import { Guild, GuildMember } from 'discord.js';
import { AutomodEscalationService } from '../../database/services/automodEscalationService';
import { WarningService } from '../../database/services/sqliteService';
import { AutomodPunishmentHandler, PunishmentResult } from './automodPunishmentHandler';
import { logInfo, logError } from '../../utils/logger';

export interface EscalationTriggerResult {
  triggered: boolean;
  punishmentResult?: PunishmentResult;
  warningCount: number;
  ruleTriggered?: any;
}

export class AutomodEscalationHandler {
  
  /**
   * Main entry point for checking and executing automod escalation
   * Should be called whenever a warning is issued
   */
  static async checkAndExecuteEscalation(
    guild: Guild,
    member: GuildMember,
    triggerReason?: string
  ): Promise<EscalationTriggerResult> {
    try {
      logInfo('AutomodEscalationHandler', 
        `Checking escalation for user ${member.id} in guild ${guild.id}`
      );

      // Get current warning count for the user
      const warningCount = await WarningService.countActiveWarnings(guild.id, member.id);
      
      logInfo('AutomodEscalationHandler', 
        `User ${member.id} has ${warningCount} active warnings`
      );

      // Check if any escalation rule applies
      const applicableRule = await AutomodEscalationService.checkEscalation(
        guild.id, 
        member.id, 
        warningCount
      );

      if (!applicableRule) {
        logInfo('AutomodEscalationHandler', 
          `No escalation rule triggered for ${warningCount} warnings`
        );
        return {
          triggered: false,
          warningCount
        };
      }

      logInfo('AutomodEscalationHandler', 
        `Escalation rule triggered: ${applicableRule.punishment_type} at ${applicableRule.warning_threshold} warnings`
      );

      // Check if we've already executed this exact rule for this warning count
      // to prevent duplicate punishments
      const hasRecentPunishment = await this.checkRecentPunishment(
        guild.id, 
        member.id, 
        applicableRule.id!,
        warningCount
      );

      if (hasRecentPunishment) {
        logInfo('AutomodEscalationHandler', 
          `Recent punishment already exists for this rule and warning count, skipping`
        );
        return {
          triggered: false,
          warningCount,
          ruleTriggered: applicableRule
        };
      }

      // Execute the punishment
      const punishmentResult = await AutomodPunishmentHandler.executePunishment(
        guild,
        member,
        applicableRule,
        warningCount
      );

      logInfo('AutomodEscalationHandler', 
        `Punishment executed: ${punishmentResult.success ? 'SUCCESS' : 'FAILED'} - ${punishmentResult.action}`
      );

      // Send notification to moderation log channel if configured
      await this.notifyModerators(guild, member, applicableRule, warningCount, punishmentResult);

      return {
        triggered: true,
        punishmentResult,
        warningCount,
        ruleTriggered: applicableRule
      };

    } catch (error) {
      logError('AutomodEscalationHandler', 
        `Error during escalation check for user ${member.id} in guild ${guild.id}: ${error}`
      );
      
      return {
        triggered: false,
        warningCount: 0
      };
    }
  }

  /**
   * Check if a similar punishment was recently executed to prevent spam
   */
  private static async checkRecentPunishment(
    guildId: string,
    userId: string,
    ruleId: number,
    warningCount: number
  ): Promise<boolean> {
    try {
      const recentLogs = await AutomodEscalationService.getUserEscalationHistory(guildId, userId);
      
      // Check if there's a log entry for this exact rule and warning count in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      return recentLogs.some(log => 
        log.rule_id === ruleId &&
        log.warning_count === warningCount &&
        new Date(log.created_at!) > oneHourAgo
      );
    } catch (error) {
      logError('AutomodEscalationHandler', 
        `Error checking recent punishment: ${error}`
      );
      return false; // If we can't check, allow the punishment
    }
  }

  /**
   * Send notification to moderation team about automod action
   */
  private static async notifyModerators(
    guild: Guild,
    member: GuildMember,
    rule: any,
    warningCount: number,
    result: PunishmentResult
  ): Promise<void> {
    try {
      // This would integrate with your existing logging system
      // For now, we'll just log it - you can extend this to send to mod channels
      
      const logMessage = `🤖 **Automod Escalation Executed**\n` +
        `**User:** ${member.user.tag} (${member.id})\n` +
        `**Warning Count:** ${warningCount}\n` +
        `**Action:** ${result.action}\n` +
        `**Rule:** ${rule.punishment_type} at ${rule.warning_threshold} warnings\n` +
        `**Reason:** ${rule.punishment_reason}\n` +
        `**Status:** ${result.success ? '✅ Success' : '❌ Failed'}\n` +
        `${result.error ? `**Error:** ${result.error}\n` : ''}` +
        `${result.caseNumber ? `**Case #:** ${result.caseNumber}\n` : ''}` +
        `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`;

      logInfo('AutomodEscalationHandler', 
        `Moderation notification: ${logMessage.replace(/\*\*/g, '').replace(/\n/g, ' | ')}`
      );

      // TODO: Integrate with your server's log channel system
      // Example:
      // const logChannelId = await getServerLogChannel(guild.id);
      // if (logChannelId) {
      //   const logChannel = await guild.channels.fetch(logChannelId);
      //   if (logChannel?.isTextBased()) {
      //     await logChannel.send(logMessage);
      //   }
      // }

    } catch (error) {
      logError('AutomodEscalationHandler', 
        `Failed to notify moderators: ${error}`
      );
      // Don't throw - notification failure shouldn't affect the punishment
    }
  }

  /**
   * Manual trigger for testing or admin override
   */
  static async manualTrigger(
    guild: Guild,
    member: GuildMember,
    ruleId: number,
    reason: string = 'Manual automod trigger'
  ): Promise<EscalationTriggerResult> {
    try {
      const rules = await AutomodEscalationService.getRules(guild.id);
      const rule = rules.find(r => r.id === ruleId);
      
      if (!rule) {
        throw new Error(`Rule ${ruleId} not found`);
      }

      const warningCount = await WarningService.countActiveWarnings(guild.id, member.id);
      
      const punishmentResult = await AutomodPunishmentHandler.executePunishment(
        guild,
        member,
        { ...rule, punishment_reason: reason },
        warningCount
      );

      await this.notifyModerators(guild, member, rule, warningCount, punishmentResult);

      return {
        triggered: true,
        punishmentResult,
        warningCount,
        ruleTriggered: rule
      };

    } catch (error) {
      logError('AutomodEscalationHandler', 
        `Error during manual trigger: ${error}`
      );
      throw error;
    }
  }

  /**
   * Get escalation preview - shows what would happen without executing
   */
  static async getEscalationPreview(
    guildId: string,
    userId: string,
    warningCount?: number
  ): Promise<{
    currentWarnings: number;
    nextRule?: any;
    wouldTrigger: boolean;
  }> {
    try {
      const currentWarnings = warningCount ?? await WarningService.countActiveWarnings(guildId, userId);
      const nextRule = await AutomodEscalationService.checkEscalation(guildId, userId, currentWarnings + 1);
      
      return {
        currentWarnings,
        nextRule,
        wouldTrigger: nextRule !== null
      };
    } catch (error) {
      logError('AutomodEscalationHandler', 
        `Error getting escalation preview: ${error}`
      );
      return {
        currentWarnings: 0,
        wouldTrigger: false
      };
    }
  }

  /**
   * Reset warnings for a user (if configured)
   */
  static async resetUserWarnings(
    guildId: string,
    userId: string,
    moderatorId: string,
    reason: string = 'Warning reset'
  ): Promise<number> {
    try {
      const warnings = await WarningService.getActiveWarnings(guildId, userId);
      let resetCount = 0;

      for (const warning of warnings) {
        await WarningService.removeWarning(warning.id!, moderatorId, reason);
        resetCount++;
      }

      logInfo('AutomodEscalationHandler', 
        `Reset ${resetCount} warnings for user ${userId} in guild ${guildId}`
      );

      return resetCount;
    } catch (error) {
      logError('AutomodEscalationHandler', 
        `Error resetting warnings for user ${userId}: ${error}`
      );
      throw error;
    }
  }
}

export default AutomodEscalationHandler;