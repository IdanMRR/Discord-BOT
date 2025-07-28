import { User, Guild, TextChannel, EmbedBuilder, MessagePayload, MessageCreateOptions } from 'discord.js';
import { logInfo, logError, logWarning } from './logger';
import { Colors } from './embeds';
import { db } from '../database/sqlite';

export interface DMAttemptResult {
  success: boolean;
  method: 'dm' | 'fallback_channel' | 'failed';
  channelId?: string;
  error?: string;
}

export interface DMOptions {
  content?: string;
  embeds?: EmbedBuilder[];
  retryAttempts?: number;
  fallbackChannelId?: string;
  includeFallbackMessage?: boolean;
}

/**
 * Enhanced DM handler with automatic fallbacks to guild channels
 * Addresses PDR requirement for reliable DM delivery with fallback mechanisms
 */
export class DMHandler {
  
  /**
   * Attempt to send a DM with automatic fallback to guild channel if blocked
   */
  static async sendDMWithFallback(
    user: User, 
    guild: Guild, 
    options: DMOptions
  ): Promise<DMAttemptResult> {
    const { content, embeds, retryAttempts = 3, fallbackChannelId, includeFallbackMessage = true } = options;
    
    // First attempt: Direct DM
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const payload: MessageCreateOptions = {};
        if (content) payload.content = content;
        if (embeds) payload.embeds = embeds;
        
        await user.send(payload);
        
        logInfo('DM Handler', `✅ Successfully sent DM to ${user.tag} (attempt ${attempt})`);
        return { success: true, method: 'dm' };
        
      } catch (error: any) {
        logWarning('DM Handler', `❌ DM attempt ${attempt} failed for ${user.tag}: ${error.message}`);
        
        // If it's a permissions error or user has DMs blocked, don't retry
        if (error.code === 50007 || error.code === 10003) { // Cannot send messages to user
          logInfo('DM Handler', `🚫 User ${user.tag} has DMs blocked, attempting fallback...`);
          break;
        }
        
        // For other errors, wait before retry
        if (attempt < retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    // Fallback: Send to guild channel
    const fallbackResult = await this.sendFallbackMessage(user, guild, options, fallbackChannelId);
    return fallbackResult;
  }
  
  /**
   * Send fallback message to a guild channel when DM fails
   */
  private static async sendFallbackMessage(
    user: User, 
    guild: Guild, 
    options: DMOptions,
    customFallbackChannelId?: string
  ): Promise<DMAttemptResult> {
    try {
      // Determine fallback channel priority
      const fallbackChannelId = await this.getFallbackChannel(guild, customFallbackChannelId);
      
      if (!fallbackChannelId) {
        logError('DM Handler', `❌ No fallback channel found for guild ${guild.name}`);
        return { success: false, method: 'failed', error: 'No fallback channel available' };
      }
      
      const fallbackChannel = guild.channels.cache.get(fallbackChannelId) as TextChannel;
      if (!fallbackChannel) {
        logError('DM Handler', `❌ Fallback channel ${fallbackChannelId} not found`);
        return { success: false, method: 'failed', error: 'Fallback channel not accessible' };
      }
      
      // Create fallback message
      const fallbackEmbed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('📨 Direct Message Delivery Failed')
        .setDescription(`Unable to send direct message to ${user.tag}. Message delivered here instead.`)
        .addFields({ name: '👤 Intended Recipient', value: `<@${user.id}>`, inline: true })
        .setTimestamp()
        .setFooter({ text: 'User may have DMs disabled or blocked the bot' });
      
      // Add original content
      if (options.content) {
        fallbackEmbed.addFields({ name: '📝 Original Message', value: options.content });
      }
      
      const fallbackPayload: MessageCreateOptions = {
        content: `<@${user.id}>`, // Mention the user
        embeds: [fallbackEmbed, ...(options.embeds || [])]
      };
      
      await fallbackChannel.send(fallbackPayload);
      
      logInfo('DM Handler', `✅ Fallback message sent to #${fallbackChannel.name} for ${user.tag}`);
      return { success: true, method: 'fallback_channel', channelId: fallbackChannelId };
      
    } catch (error: any) {
      logError('DM Handler', `❌ Fallback message failed: ${error.message}`);
      return { success: false, method: 'failed', error: error.message };
    }
  }
  
  /**
   * Get the appropriate fallback channel based on priority:
   * 1. Custom provided channel
   * 2. DM logs channel from settings
   * 3. General logs channel
   * 4. System messages channel
   * 5. First available text channel
   */
  private static async getFallbackChannel(guild: Guild, customChannelId?: string): Promise<string | null> {
    try {
      // Priority 1: Custom provided channel
      if (customChannelId) {
        const customChannel = guild.channels.cache.get(customChannelId);
        if (customChannel?.isTextBased()) {
          return customChannelId;
        }
      }
      
      // Priority 2: DM logs channel from logging settings
      try {
        const stmt = db.prepare('SELECT dm_log_channel_id FROM logging_settings WHERE guild_id = ?');
        const settings = stmt.get(guild.id) as { dm_log_channel_id?: string } | undefined;
        if (settings?.dm_log_channel_id) {
          const dmLogChannel = guild.channels.cache.get(settings.dm_log_channel_id);
          if (dmLogChannel?.isTextBased()) {
            return settings.dm_log_channel_id;
          }
        }
      } catch (error) {
        // Continue to next fallback
      }
      
      // Priority 3: General logs channel from server settings
      try {
        const stmt = db.prepare('SELECT log_channel_id FROM server_settings WHERE guild_id = ?');
        const settings = stmt.get(guild.id) as { log_channel_id?: string } | undefined;
        if (settings?.log_channel_id) {
          const logChannel = guild.channels.cache.get(settings.log_channel_id);
          if (logChannel?.isTextBased()) {
            return settings.log_channel_id;
          }
        }
      } catch (error) {
        // Continue to next fallback
      }
      
      // Priority 4: System messages channel
      if (guild.systemChannelId) {
        const systemChannel = guild.channels.cache.get(guild.systemChannelId);
        if (systemChannel?.isTextBased()) {
          return guild.systemChannelId;
        }
      }
      
      // Priority 5: First available text channel
      const firstTextChannel = guild.channels.cache.find(channel => 
        channel.isTextBased() && 
        channel.type === 0 && // GuildText
        channel.permissionsFor(guild.members.me!)?.has(['SendMessages', 'ViewChannel'])
      );
      
      return firstTextChannel?.id || null;
      
    } catch (error) {
      logError('DM Handler', `Error finding fallback channel: ${error}`);
      return null;
    }
  }
  
  /**
   * Send a simple DM with basic retry logic (no fallback)
   */
  static async sendSimpleDM(
    user: User, 
    content: string, 
    embeds?: EmbedBuilder[]
  ): Promise<boolean> {
    try {
      const payload: MessageCreateOptions = { content };
      if (embeds) payload.embeds = embeds;
      
      await user.send(payload);
      logInfo('DM Handler', `✅ Simple DM sent to ${user.tag}`);
      return true;
      
    } catch (error: any) {
      logError('DM Handler', `❌ Simple DM failed for ${user.tag}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Bulk send DMs to multiple users with fallback support
   */
  static async sendBulkDMs(
    users: User[], 
    guild: Guild, 
    options: DMOptions,
    onProgress?: (completed: number, total: number, results: DMAttemptResult[]) => void
  ): Promise<DMAttemptResult[]> {
    const results: DMAttemptResult[] = [];
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const result = await this.sendDMWithFallback(user, guild, options);
      results.push(result);
      
      if (onProgress) {
        onProgress(i + 1, users.length, results);
      }
      
      // Rate limiting: wait 100ms between sends
      if (i < users.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    logInfo('DM Handler', `📊 Bulk DM complete: ${results.filter(r => r.success).length}/${users.length} successful`);
    return results;
  }
}