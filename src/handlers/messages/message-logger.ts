import { Client, Events, Message, PartialMessage, TextChannel, EmbedBuilder } from 'discord.js';
import { logInfo, logError } from '../../utils/logger';
import { db } from '../../database/sqlite';
import { Colors } from '../../utils/embeds';
import { AnalyticsService } from '../../database/services/analyticsService';

interface LoggingSettings {
  id: number;
  guild_id: string;
  message_delete_logging: number;
  message_edit_logging: number;
  command_logging: number;
  dm_logging: number;
  log_channel_id?: string;
  message_log_channel_id?: string;
  command_log_channel_id?: string;
  dm_log_channel_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageLogData {
  guild_id: string;
  channel_id: string;
  message_id: string;
  user_id: string;
  action: 'create' | 'edit' | 'delete';
  content_before?: string;
  content_after?: string;
  attachment_urls?: string[];
  embed_data?: any;
}

export class MessageLogger {
  // Get logging settings for a guild
  private static getLoggingSettings(guildId: string): LoggingSettings | null {
    try {
      const stmt = db.prepare('SELECT * FROM logging_settings WHERE guild_id = ?');
      return stmt.get(guildId) as LoggingSettings | undefined || null;
    } catch (error) {
      logError('Message Logger', `Error getting logging settings: ${error}`);
      return null;
    }
  }

  // Check if a specific logging feature is enabled
  private static isLoggingEnabled(guildId: string, feature: string): boolean {
    const settings = this.getLoggingSettings(guildId);
    if (!settings) return true; // Default to enabled if no settings found
    
    switch (feature) {
      case 'message_delete':
        return settings.message_delete_logging === 1;
      case 'message_edit':
        return settings.message_edit_logging === 1;
      case 'command':
        return settings.command_logging === 1;
      case 'dm':
        return settings.dm_logging === 1;
      default:
        return true;
    }
  }

  private static logToDatabase(data: MessageLogData): void {
    try {
      // Check if logging is enabled for this action
      const feature = data.action === 'delete' ? 'message_delete' : 
                     data.action === 'edit' ? 'message_edit' : null;
      
      if (feature && !this.isLoggingEnabled(data.guild_id, feature)) {
        return; // Logging disabled for this feature
      }

      const stmt = db.prepare(`
        INSERT INTO message_logs (
          guild_id, channel_id, message_id, user_id, action, 
          content_before, content_after, attachment_urls, embed_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        data.guild_id,
        data.channel_id,
        data.message_id,
        data.user_id,
        data.action,
        data.content_before || null,
        data.content_after || null,
        JSON.stringify(data.attachment_urls || []),
        JSON.stringify(data.embed_data || null)
      );
    } catch (error) {
      logError('Message Logger', `Failed to log message to database: ${error}`);
    }
  }

  private static async logToChannel(message: Message | PartialMessage, action: string, oldContent?: string): Promise<void> {
    try {
      if (!message.guild) return;
      
      // Check if logging is enabled for this action
      const feature = action === 'delete' ? 'message_delete' : 'message_edit';
      if (!this.isLoggingEnabled(message.guild.id, feature)) {
        return; // Logging disabled for this feature
      }
      
      // Get log channel from logging settings
      const settings = this.getLoggingSettings(message.guild.id);
      let logChannelId = settings?.message_log_channel_id;
      
      // Fallback to general log channel if specific one not set
      if (!logChannelId) {
        try {
          const fallbackStmt = db.prepare('SELECT log_channel_id FROM server_settings WHERE guild_id = ?');
          const fallbackSettings = fallbackStmt.get(message.guild.id) as { log_channel_id?: string } | undefined;
          logChannelId = fallbackSettings?.log_channel_id;
        } catch (error) {
          // Ignore error, will just skip logging
        }
      }
      
      if (!logChannelId) return;
      
      const logChannel = message.guild.channels.cache.get(logChannelId) as TextChannel;
      if (!logChannel) return;
      
      const embed = new EmbedBuilder()
        .setTimestamp()
        .setFooter({ text: `User ID: ${message.author?.id || 'Unknown'}` });
      
      switch (action) {
        case 'delete':
          embed
            .setColor(Colors.ERROR)
            .setTitle('🗑️ Message Deleted')
            .setDescription(`**Author:** ${message.author?.tag || 'Unknown'}\n**Channel:** <#${message.channel.id}>`)
            .addFields(
              { name: 'Content', value: message.content || '*No text content*', inline: false },
              { name: 'Message ID', value: message.id, inline: true },
              { name: 'Deleted At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            );
          
          if (message.attachments && message.attachments.size > 0) {
            const attachments = Array.from(message.attachments.values())
              .map(att => `[${att.name}](${att.url})`)
              .join('\n');
            embed.addFields({ name: 'Attachments', value: attachments, inline: false });
          }
          break;
          
        case 'edit':
          embed
            .setColor(Colors.WARNING)
            .setTitle('✏️ Message Edited')
            .setDescription(`**Author:** ${message.author?.tag || 'Unknown'}\n**Channel:** <#${message.channel.id}>\n**[Jump to Message](${message.url})**`)
            .addFields(
              { name: 'Before', value: oldContent || '*No previous content*', inline: false },
              { name: 'After', value: message.content || '*No new content*', inline: false },
              { name: 'Message ID', value: message.id, inline: true },
              { name: 'Edited At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            );
          break;
      }
      
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      logError('Message Logger', `Failed to log to channel: ${error}`);
    }
  }

  static async handleMessageDelete(message: Message | PartialMessage): Promise<void> {
    try {
      // Skip if message is from a bot or in DMs
      if (!message.guild || message.author?.bot) return;
      
      // Log to database
      this.logToDatabase({
        guild_id: message.guild.id,
        channel_id: message.channel.id,
        message_id: message.id,
        user_id: message.author?.id || 'unknown',
        action: 'delete',
        content_before: message.content || undefined,
        attachment_urls: message.attachments ? Array.from(message.attachments.values()).map(att => att.url) : [],
        embed_data: message.embeds && message.embeds.length > 0 ? message.embeds : undefined
      });
      
      // Log to channel
      await this.logToChannel(message, 'delete');
      
      logInfo('Message Logger', `Logged deleted message from ${message.author?.tag} in ${message.guild.name}`);
    } catch (error) {
      logError('Message Logger', `Error handling message delete: ${error}`);
    }
  }

  static async handleMessageUpdate(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
    try {
      // Skip if message is from a bot, in DMs, or content didn't change
      if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
      
      // Log to database
      this.logToDatabase({
        guild_id: newMessage.guild.id,
        channel_id: newMessage.channel.id,
        message_id: newMessage.id,
        user_id: newMessage.author?.id || 'unknown',
        action: 'edit',
        content_before: oldMessage.content || undefined,
        content_after: newMessage.content || undefined
      });
      
      // Log to channel
      await this.logToChannel(newMessage, 'edit', oldMessage.content || undefined);
      
      logInfo('Message Logger', `Logged edited message from ${newMessage.author?.tag} in ${newMessage.guild.name}`);
    } catch (error) {
      logError('Message Logger', `Error handling message update: ${error}`);
    }
  }

  static async handleMessageCreate(message: Message): Promise<void> {
    try {
      // Skip if message is from a bot
      if (message.author.bot) return;
      
      // Handle DM messages separately
      if (!message.guild) {
        await this.handleDMMessage(message);
        return;
      }
      
      // Log basic message info for debugging (reduced verbosity)
      if (message.content.length > 0) {
        logInfo('Message Logger', `Message in ${message.guild.name}: ${message.content.substring(0, 30)}...`);
      }
      
      // Track analytics for guild messages
      await AnalyticsService.trackActivity({
        guild_id: message.guild.id,
        metric_type: 'message_count',
        channel_id: message.channel.id,
        user_id: message.author.id,
        value: 1
      }).catch(error => logError('Analytics', `Failed to track message: ${error}`));
      
      // Update channel analytics for text channels
      if (message.channel.type === 0) { // GuildText channel type
        await AnalyticsService.updateChannelAnalytics(
          message.guild.id,
          message.channel.id,
          (message.channel as any).name || 'unknown',
          'text'
        ).catch(error => logError('Analytics', `Failed to update channel analytics: ${error}`));
      }
      
      // Log to database (optional - can be disabled if too much data)
      // Uncomment the line below if you want to log all messages
      // this.logToDatabase({
      //   guild_id: message.guild.id,
      //   channel_id: message.channel.id,
      //   message_id: message.id,
      //   user_id: message.author.id,
      //   action: 'create',
      //   content_after: message.content,
      //   attachment_urls: message.attachments.size > 0 ? Array.from(message.attachments.values()).map(att => att.url) : []
      // });
      
    } catch (error) {
      logError('Message Logger', `Error handling message create: ${error}`);
    }
  }

  private static async handleDMMessage(message: Message): Promise<void> {
    try {
      // Get all guilds that have DM logging enabled and contain this user
      const guilds = message.client.guilds.cache.filter(guild => {
        const member = guild.members.cache.get(message.author.id);
        return member && this.isLoggingEnabled(guild.id, 'dm');
      });

      for (const guild of guilds.values()) {
        const settings = this.getLoggingSettings(guild.id);
        const logChannelId = settings?.dm_log_channel_id;
        
        if (!logChannelId) continue;
        
        const logChannel = guild.channels.cache.get(logChannelId) as TextChannel;
        if (!logChannel) continue;

        const embed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle('💬 Direct Message Received')
          .setDescription(`**From:** ${message.author.tag}\n**Content:** ${message.content || '*No text content*'}`)
          .addFields(
            { name: 'User ID', value: message.author.id, inline: true },
            { name: 'Received At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          )
          .setThumbnail(message.author.displayAvatarURL())
          .setTimestamp();

        if (message.attachments.size > 0) {
          const attachments = Array.from(message.attachments.values())
            .map(att => `[${att.name}](${att.url})`)
            .join('\n');
          embed.addFields({ name: 'Attachments', value: attachments, inline: false });
        }

        await logChannel.send({ embeds: [embed] });
        logInfo('Message Logger', `Logged DM from ${message.author.tag} to guild ${guild.name}`);
      }
    } catch (error) {
      logError('Message Logger', `Error handling DM message: ${error}`);
    }
  }
}

export function initializeMessageLogger(client: Client): void {
  logInfo('Message Logger', 'Initializing message logging system...');
  
  // Listen for message delete events
  client.on(Events.MessageDelete, (message) => {
    MessageLogger.handleMessageDelete(message);
  });
  
  // Listen for message update events
  client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    MessageLogger.handleMessageUpdate(oldMessage, newMessage);
  });
  
  // Listen for message create events (for analytics)
  client.on(Events.MessageCreate, (message) => {
    MessageLogger.handleMessageCreate(message);
  });
  
  logInfo('Message Logger', 'Message logging system initialized successfully');
}