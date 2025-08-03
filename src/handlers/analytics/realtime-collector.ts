import { Client, Guild, GuildMember, PartialGuildMember, VoiceState, Message } from 'discord.js';
import { AnalyticsService } from '../../database/services/analyticsService';
import { logInfo, logError } from '../../utils/logger';

export class RealTimeAnalyticsCollector {
  private client: Client;
  private collectionInterval: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Start collecting real-time analytics data
   */
  public start(): void {
    logInfo('Analytics Collector', 'Starting real-time analytics collection...');
    
    // Set up event listeners for real-time data collection
    this.setupEventListeners();
    
    // Set up periodic data collection (every 5 minutes)
    this.collectionInterval = setInterval(() => {
      this.collectPeriodicData();
    }, 5 * 60 * 1000); // 5 minutes
    
    // Initial collection
    this.collectPeriodicData();
  }

  /**
   * Stop collecting analytics data
   */
  public stop(): void {
    logInfo('Analytics Collector', 'Stopping analytics collection...');
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }

  /**
   * Set up Discord event listeners for real-time tracking
   */
  private setupEventListeners(): void {
    // Track messages
    this.client.on('messageCreate', (message: Message) => {
      if (message.author.bot || !message.guild) return;
      
      this.trackActivity(message.guild.id, 'message_count', {
        channel_id: message.channel.id,
        user_id: message.author.id,
        value: 1
      });
    });

    // Track member joins
    this.client.on('guildMemberAdd', (member: GuildMember) => {
      this.trackActivity(member.guild.id, 'member_join', {
        user_id: member.id,
        value: 1
      });
    });

    // Track member leaves
    this.client.on('guildMemberRemove', (member: GuildMember | PartialGuildMember) => {
      this.trackActivity(member.guild.id, 'member_leave', {
        user_id: member.id,
        value: 1
      });
    });

    // Track voice activity
    this.client.on('voiceStateUpdate', (oldState: VoiceState, newState: VoiceState) => {
      if (!newState.guild) return;
      
      // User joined a voice channel
      if (!oldState.channel && newState.channel) {
        this.trackActivity(newState.guild.id, 'voice_activity', {
          channel_id: newState.channel.id,
          user_id: newState.member?.id,
          value: 1
        });
      }
    });
  }

  /**
   * Track an activity in the analytics system
   */
  private async trackActivity(guildId: string, metricType: any, data: {
    channel_id?: string;
    user_id?: string;
    command_name?: string;
    value?: number;
    metadata?: any;
  }): Promise<void> {
    try {
      await AnalyticsService.trackActivity({
        guild_id: guildId,
        metric_type: metricType,
        channel_id: data.channel_id,
        user_id: data.user_id,
        command_name: data.command_name,
        value: data.value || 1,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined
      });
    } catch (error) {
      logError('Analytics Collector', `Error tracking activity: ${error}`);
    }
  }

  /**
   * Collect periodic data (server health, member counts, etc.)
   */
  private async collectPeriodicData(): Promise<void> {
    try {
      logInfo('Analytics Collector', 'Collecting periodic analytics data...');
      
      for (const guild of this.client.guilds.cache.values()) {
        await this.collectGuildData(guild);
      }
      
      logInfo('Analytics Collector', 'Periodic data collection completed');
    } catch (error) {
      logError('Analytics Collector', `Error in periodic data collection: ${error}`);
    }
  }

  /**
   * Collect comprehensive data for a specific guild
   */
  private async collectGuildData(guild: Guild): Promise<void> {
    try {
      // Get real member counts
      const memberCount = guild.memberCount;
      const onlineMembers = guild.members.cache.filter(member => 
        member.presence?.status === 'online' || 
        member.presence?.status === 'idle' || 
        member.presence?.status === 'dnd'
      ).size;

      // Record server health
      await AnalyticsService.recordServerHealth({
        guild_id: guild.id,
        member_count: memberCount,
        online_count: onlineMembers,
        bot_latency: this.client.ws.ping,
        api_response_time: undefined, // Will be measured elsewhere
        memory_usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        cpu_usage: undefined, // Will be measured elsewhere
        uptime: Math.round(this.client.uptime ? this.client.uptime / 1000 : 0), // seconds
        error_count: 0 // Will be tracked elsewhere
      });

      // Update daily stats with current member count
      await AnalyticsService.updateDailyMemberCount(guild.id, memberCount, onlineMembers);
      
      logInfo('Analytics Collector', `Collected data for guild ${guild.name} (${guild.id}): ${memberCount} members, ${onlineMembers} online`);
      
    } catch (error) {
      logError('Analytics Collector', `Error collecting guild data for ${guild.id}: ${error}`);
    }
  }

  /**
   * Get current analytics overview for a guild
   */
  public async getCurrentStats(guildId: string): Promise<any> {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return null;
      }

      return {
        member_count: guild.memberCount,
        online_count: guild.members.cache.filter(member => 
          member.presence?.status === 'online' || 
          member.presence?.status === 'idle' || 
          member.presence?.status === 'dnd'
        ).size,
        bot_latency: this.client.ws.ping,
        uptime: this.client.uptime ? Math.round(this.client.uptime / 1000) : 0
      };
    } catch (error) {
      logError('Analytics Collector', `Error getting current stats: ${error}`);
      return null;
    }
  }
}