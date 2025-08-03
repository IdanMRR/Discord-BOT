import { Client, GuildMember, PartialGuildMember, Message, MessageReaction, PartialMessageReaction, User, VoiceState, PartialMessage } from 'discord.js';
import { scheduledTaskService, AutomationRule } from '../../services/scheduledTaskService';
import { logInfo, logError } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface AutomationContext {
  guild_id: string;
  user_id?: string;
  channel_id?: string;
  message_id?: string;
  member?: GuildMember | PartialGuildMember;
  message?: Message | PartialMessage;
  reaction?: MessageReaction | PartialMessageReaction;
  voiceState?: VoiceState;
  oldVoiceState?: VoiceState;
  customData?: any;
}

export interface AutomationAction {
  type: string;
  config: any;
  conditions?: any[];
}

export interface ActionProcessor {
  type: string;
  execute(action: AutomationAction, context: AutomationContext, client: Client, handler: AutomationHandler): Promise<any>;
}

export class AutomationHandler extends EventEmitter {
  private client: Client;
  private actionProcessors = new Map<string, ActionProcessor>();
  private cooldowns = new Map<string, Map<string, number>>(); // ruleId -> userId -> timestamp

  constructor(client: Client) {
    super();
    this.client = client;
    this.registerDefaultActions();
    this.setupEventListeners();
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================

  private setupEventListeners(): void {
    // Member join event
    this.client.on('guildMemberAdd', async (member) => {
      await this.processEvent('member_join', {
        guild_id: member.guild.id,
        user_id: member.id,
        member
      });
    });

    // Member leave event
    this.client.on('guildMemberRemove', async (member) => {
      await this.processEvent('member_leave', {
        guild_id: member.guild.id,
        user_id: member.id,
        member
      });
    });

    // Message sent event
    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      await this.processEvent('message_sent', {
        guild_id: message.guild?.id || '',
        user_id: message.author.id,
        channel_id: message.channel.id,
        message_id: message.id,
        message
      });
    });

    // Reaction added event
    this.client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;
      
      await this.processEvent('reaction_added', {
        guild_id: reaction.message.guild?.id || '',
        user_id: user.id,
        channel_id: reaction.message.channel.id,
        message_id: reaction.message.id,
        reaction,
        message: reaction.message as Message
      });
    });

    // Role assigned event (via guildMemberUpdate)
    this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
      const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
      
      if (addedRoles.size > 0) {
        for (const role of addedRoles.values()) {
          await this.processEvent('role_assigned', {
            guild_id: newMember.guild.id,
            user_id: newMember.id,
            member: newMember,
            customData: { role_id: role.id, role_name: role.name }
          });
        }
      }
    });

    // Voice join event
    this.client.on('voiceStateUpdate', async (oldState, newState) => {
      // User joined a voice channel
      if (!oldState.channel && newState.channel) {
        await this.processEvent('voice_join', {
          guild_id: newState.guild.id,
          user_id: newState.member?.id || '',
          member: newState.member || undefined,
          voiceState: newState,
          oldVoiceState: oldState,
          customData: { channel_id: newState.channel.id, channel_name: newState.channel.name }
        });
      }
      
      // User left a voice channel
      if (oldState.channel && !newState.channel) {
        await this.processEvent('voice_leave', {
          guild_id: oldState.guild.id,
          user_id: oldState.member?.id || '',
          member: oldState.member || undefined,
          voiceState: newState,
          oldVoiceState: oldState,
          customData: { channel_id: oldState.channel.id, channel_name: oldState.channel.name }
        });
      }
    });
  }

  // ==========================================
  // EVENT PROCESSING
  // ==========================================

  private async processEvent(eventType: string, context: AutomationContext): Promise<void> {
    try {
      if (!context.guild_id) return;

      // Get all active automation rules for this guild and event type
      const rules = await scheduledTaskService.getGuildAutomationRules(context.guild_id);
      const matchingRules = rules.filter(rule => 
        rule.is_active && 
        (rule.trigger_event === eventType || rule.trigger_event === 'custom')
      );

      if (matchingRules.length === 0) return;

      // Sort by priority (higher priority first)
      matchingRules.sort((a, b) => b.priority - a.priority);

      logInfo('AutomationHandler', `Processing ${matchingRules.length} rules for event ${eventType} in guild ${context.guild_id}`);

      for (const rule of matchingRules) {
        try {
          await this.processRule(rule, context);
        } catch (error) {
          logError('AutomationHandler', `Error processing rule ${rule.id}: ${error}`);
        }
      }

    } catch (error) {
      logError('AutomationHandler', `Error processing event ${eventType}: ${error}`);
    }
  }

  private async processRule(rule: AutomationRule, context: AutomationContext): Promise<void> {
    const startTime = new Date();
    let status: 'running' | 'completed' | 'failed' | 'cancelled' = 'running';
    let errorMessage: string | undefined;
    let actionsPerformed: any[] = [];

    try {
      // Check cooldown
      if (rule.cooldown_seconds > 0 && context.user_id) {
        if (this.isOnCooldown(rule.id!, context.user_id, rule.cooldown_seconds)) {
          status = 'cancelled';
          return;
        }
      }

      // Check max triggers per user
      if (rule.max_triggers_per_user && context.user_id) {
        // This would require tracking per-user execution counts
        // Implementation depends on requirements
      }

      // Check trigger conditions
      if (rule.trigger_conditions && rule.trigger_conditions.length > 0) {
        const conditionsMet = await this.checkConditions(rule.trigger_conditions, context);
        if (!conditionsMet) {
          status = 'cancelled';
          return;
        }
      }

      logInfo('AutomationHandler', `Executing rule ${rule.id} (${rule.name}) for event ${rule.trigger_event}`);

      // Execute actions
      for (const action of rule.actions) {
        try {
          const result = await this.executeAction(action, context);
          actionsPerformed.push({
            action: action.type,
            config: action.config,
            result,
            timestamp: new Date().toISOString()
          });
        } catch (actionError) {
          logError('AutomationHandler', `Error executing action ${action.type}: ${actionError}`);
          actionsPerformed.push({
            action: action.type,
            config: action.config,
            error: actionError instanceof Error ? actionError.message : String(actionError),
            timestamp: new Date().toISOString()
          });
        }
      }

      status = 'completed';

      // Update cooldown
      if (rule.cooldown_seconds > 0 && context.user_id) {
        this.setCooldown(rule.id!, context.user_id);
      }

      // Update rule stats
      await this.updateRuleStats(rule.id!, true);

    } catch (error) {
      status = 'failed';
      errorMessage = error instanceof Error ? error.message : String(error);
      logError('AutomationHandler', `Error executing rule ${rule.id}: ${error}`);

      await this.updateRuleStats(rule.id!, false, errorMessage);
    } finally {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Log execution
      await scheduledTaskService.logExecution({
        rule_id: rule.id,
        guild_id: context.guild_id,
        execution_type: 'automation_rule',
        trigger_source: rule.trigger_event,
        trigger_user_id: context.user_id,
        start_time: startTime,
        end_time: endTime,
        status,
        error_message: errorMessage,
        execution_duration: duration,
        actions_performed: actionsPerformed,
        metadata: {
          rule_name: rule.name,
          trigger_conditions: rule.trigger_conditions,
          context: {
            channel_id: context.channel_id,
            message_id: context.message_id,
            custom_data: context.customData
          }
        }
      });

      this.emit('ruleExecuted', { ruleId: rule.id, status, duration, actionsPerformed });
    }
  }

  // ==========================================
  // CONDITION CHECKING
  // ==========================================

  private async checkConditions(conditions: any[], context: AutomationContext): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.checkCondition(condition, context);
      if (!result) return false;
    }
    return true;
  }

  private async checkCondition(condition: any, context: AutomationContext): Promise<boolean> {
    switch (condition.type) {
      case 'user_has_role':
        return await this.checkUserHasRole(condition.role_id, context);
        
      case 'channel_is':
        return context.channel_id === condition.channel_id;
        
      case 'message_contains':
        return context.message?.content?.toLowerCase().includes(condition.text.toLowerCase()) || false;
        
      case 'user_joined_recently':
        return await this.checkUserJoinedRecently(condition.days, context);
        
      case 'time_between':
        return this.checkTimeBetween(condition.start_time, condition.end_time);
        
      case 'custom':
        return await this.checkCustomCondition(condition, context);
        
      default:
        logError('AutomationHandler', `Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  private async checkUserHasRole(roleId: string, context: AutomationContext): Promise<boolean> {
    if (!context.member) return false;
    return context.member.roles.cache.has(roleId);
  }

  private async checkUserJoinedRecently(days: number, context: AutomationContext): Promise<boolean> {
    if (!context.member) return false;
    const joinedAt = context.member.joinedAt;
    if (!joinedAt) return false;
    
    const daysSinceJoin = (Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceJoin <= days;
  }

  private checkTimeBetween(startTime: string, endTime: string): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const start = parseInt(startTime.replace(':', ''));
    const end = parseInt(endTime.replace(':', ''));
    
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // Crosses midnight
      return currentTime >= start || currentTime <= end;
    }
  }

  private async checkCustomCondition(condition: any, context: AutomationContext): Promise<boolean> {
    // Implement custom condition logic based on your needs
    // This could involve calling external APIs, checking database values, etc.
    return true;
  }

  // ==========================================
  // ACTION EXECUTION
  // ==========================================

  private async executeAction(action: AutomationAction, context: AutomationContext): Promise<any> {
    const processor = this.actionProcessors.get(action.type);
    if (processor) {
              return await processor.execute(action, context, this.client, this);
    } else {
      throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private registerDefaultActions(): void {
    // Send message action
    this.registerAction({
      type: 'send_message',
      async execute(action: AutomationAction, context: AutomationContext, client: Client, handler: AutomationHandler) {
        const { channel_id, message, embed } = action.config;
        const targetChannelId = channel_id || context.channel_id;
        
        if (!targetChannelId) throw new Error('No target channel specified');
        
        const channel = await client.channels.fetch(targetChannelId);
        if (!channel || !channel.isTextBased()) {
          throw new Error('Invalid target channel');
        }

        const messageOptions: any = {};
        
        if (message) {
          messageOptions.content = handler.replacePlaceholders(message, context);
        }
        
        if (embed) {
          messageOptions.embeds = [handler.processEmbed(embed, context)];
        }

        const sentMessage = await (channel as any).send(messageOptions);
        return { message_id: sentMessage.id, channel_id: targetChannelId };
      }
    });

    // Add role action
    this.registerAction({
      type: 'add_role',
      async execute(action: AutomationAction, context: AutomationContext, client: Client, handler: AutomationHandler) {
        const { role_id } = action.config;
        
        if (!context.member) throw new Error('No member in context');
        if (!role_id) throw new Error('No role ID specified');
        
        await context.member.roles.add(role_id);
        return { role_id, user_id: context.member.id };
      }
    });

    // Remove role action
    this.registerAction({
      type: 'remove_role',
      async execute(action: AutomationAction, context: AutomationContext, client: Client, handler: AutomationHandler) {
        const { role_id } = action.config;
        
        if (!context.member) throw new Error('No member in context');
        if (!role_id) throw new Error('No role ID specified');
        
        await context.member.roles.remove(role_id);
        return { role_id, user_id: context.member.id };
      }
    });

    // Send DM action
    this.registerAction({
      type: 'send_dm',
      async execute(action: AutomationAction, context: AutomationContext, client: Client, handler: AutomationHandler) {
        const { message, embed } = action.config;
        
        if (!context.user_id) throw new Error('No user ID in context');
        
        const user = await client.users.fetch(context.user_id);
        if (!user) throw new Error('User not found');

        const messageOptions: any = {};
        
        if (message) {
          messageOptions.content = handler.replacePlaceholders(message, context);
        }
        
        if (embed) {
          messageOptions.embeds = [handler.processEmbed(embed, context)];
        }

        const dmChannel = await user.createDM();
        const sentMessage = await dmChannel.send(messageOptions);
        return { message_id: sentMessage.id, user_id: context.user_id };
      }
    });

    // Timeout user action
    this.registerAction({
      type: 'timeout_user',
      async execute(action: AutomationAction, context: AutomationContext, client: Client, handler: AutomationHandler) {
        const { duration_minutes, reason } = action.config;
        
        if (!context.member) throw new Error('No member in context');
        if (context.member.partial) await context.member.fetch();
        
        const timeoutUntil = new Date(Date.now() + (duration_minutes * 60 * 1000));
        await (context.member as GuildMember).timeout(timeoutUntil.getTime(), reason || 'Automated timeout');
        
        return { 
          user_id: context.member.id, 
          timeout_until: timeoutUntil.toISOString(),
          reason 
        };
      }
    });

    // Kick user action
    this.registerAction({
      type: 'kick_user',
      async execute(action: AutomationAction, context: AutomationContext, client: Client, handler: AutomationHandler) {
        const { reason } = action.config;
        
        if (!context.member) throw new Error('No member in context');
        
        await context.member.kick(reason || 'Automated kick');
        return { user_id: context.member.id, reason };
      }
    });

    // Delete message action
    this.registerAction({
      type: 'delete_message',
      async execute(action: AutomationAction, context: AutomationContext, client: Client, handler: AutomationHandler) {
        if (!context.message) throw new Error('No message in context');
        
        await context.message.delete();
        return { message_id: context.message.id, channel_id: context.channel_id };
      }
    });

    // Create thread action
    this.registerAction({
      type: 'create_thread',
      async execute(action: AutomationAction, context: AutomationContext, client: Client, handler: AutomationHandler) {
        const { name, auto_archive_duration } = action.config;
        
        if (!context.message) throw new Error('No message in context');
        if (context.message.partial) await context.message.fetch();
        
        const thread = await (context.message as Message).startThread({
          name: handler.replacePlaceholders(name, context),
          autoArchiveDuration: auto_archive_duration || 60
        });
        
        return { thread_id: thread.id, name: thread.name };
      }
    });
  }

  private registerAction(processor: ActionProcessor): void {
    this.actionProcessors.set(processor.type, processor);
    logInfo('AutomationHandler', `Registered action processor: ${processor.type}`);
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  public replacePlaceholders(text: string, context: AutomationContext): string {
    return text
      .replace(/\{user\}/g, context.member?.displayName || 'Unknown User')
      .replace(/\{user\.mention\}/g, context.member ? `<@${context.member.id}>` : 'Unknown User')
      .replace(/\{user\.id\}/g, context.user_id || 'Unknown')
      .replace(/\{guild\}/g, context.member?.guild?.name || 'Unknown Guild')
      .replace(/\{channel\}/g, context.channel_id ? `<#${context.channel_id}>` : 'Unknown Channel')
      .replace(/\{timestamp\}/g, new Date().toISOString());
  }

  public processEmbed(embedConfig: any, context: AutomationContext): any {
    const embed = { ...embedConfig };
    
    if (embed.title) {
      embed.title = this.replacePlaceholders(embed.title, context);
    }
    
    if (embed.description) {
      embed.description = this.replacePlaceholders(embed.description, context);
    }
    
    if (embed.footer?.text) {
      embed.footer.text = this.replacePlaceholders(embed.footer.text, context);
    }
    
    return embed;
  }

  private isOnCooldown(ruleId: number, userId: string, cooldownSeconds: number): boolean {
    const ruleCooldowns = this.cooldowns.get(ruleId.toString());
    if (!ruleCooldowns) return false;
    
    const lastExecution = ruleCooldowns.get(userId);
    if (!lastExecution) return false;
    
    return (Date.now() - lastExecution) < (cooldownSeconds * 1000);
  }

  private setCooldown(ruleId: number, userId: string): void {
    if (!this.cooldowns.has(ruleId.toString())) {
      this.cooldowns.set(ruleId.toString(), new Map());
    }
    
    this.cooldowns.get(ruleId.toString())!.set(userId, Date.now());
  }

  private async updateRuleStats(ruleId: number, success: boolean, error?: string): Promise<void> {
    try {
      // This would update the automation rule stats in the database
      // Implementation depends on your database service
      logInfo('AutomationHandler', `Updated stats for rule ${ruleId}: ${success ? 'success' : 'failed'}`);
    } catch (err) {
      logError('AutomationHandler', `Error updating rule stats: ${err}`);
    }
  }
}

export default AutomationHandler;