import { Events, Message, TextChannel, Channel, GuildChannel, Client, AuditLogEvent, PartialMessage, MessageType, ChannelType } from 'discord.js';
import { logInfo, logError } from '../utils/logger';
import { db } from '../database/sqlite';
import { sendMessageLog, sendChannelLog } from '../utils/logUtils';

// Client instance will be managed by this module
let _client: Client<true> | null = null;

// Store message cache for edit tracking
const messageCache = new Map<string, Message>();

// Track message edits
export function trackMessageEdits(client: Client<true>) {
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
      // Skip if partial or if content didn't change
      if (oldMessage.partial || newMessage.partial || oldMessage.content === newMessage.content) return;
      
      // Ensure we have all required properties
      if (!newMessage.guild || !newMessage.author || newMessage.author.bot || !newMessage.channel) return;

      // Get the full message if we don't have it in cache
      const oldMsg = messageCache.get(oldMessage.id) || oldMessage;
      
      // Ensure we have all required properties
      if (!newMessage.guild || !newMessage.author || !newMessage.channel) return;
      
      const channelName = newMessage.channel.isTextBased() ? (newMessage.channel as TextChannel).name : 'unknown';
      // Safely get channel type as string
      const channelType = newMessage.channel.type.toString();
      
      // Ensure we have all required properties with non-null assertions
      const guildId = newMessage.guild?.id;
      const channelId = newMessage.channel?.id;
      const messageId = newMessage.id;
      const authorId = newMessage.author?.id;
      
      if (!guildId || !channelId || !messageId || !authorId) return;
      
      // Send message edit log
      if (newMessage.guild) {
        await sendMessageLog(
          client,
          newMessage.guild,
          'edit',
          newMessage as Message,
          oldMsg.content || ''
        );
      }

      // Update cache
      if (newMessage instanceof Message) {
        messageCache.set(newMessage.id, newMessage);
      }

    } catch (error) {
      logError('MessageEdit', `Error tracking message edit: ${error}`);
    }
  });
}

// Track message deletions
export function trackMessageDeletions(client: Client<true>) {
  client.on(Events.MessageDelete, async (message) => {
    try {
      if (!message.guild || message.partial || !message.author || message.author.bot) return;

      // Ensure we have all required properties
      if (!message.guild || !message.channel || !message.author) return;
      
      // Ensure we have all required properties with non-null assertions
      const guildId = message.guild?.id;
      const channelId = message.channel?.id;
      const messageId = message.id;
      const authorId = message.author?.id;
      
      if (!guildId || !channelId || !messageId || !authorId) return;
      
      logInfo('MessageDelete', `Message ${messageId} by ${message.author.tag} deleted in #${(message.channel as any).name}`);
      
      // Log to database
      try {
        const { logMessageDelete } = await import('../utils/databaseLogger');
        await logMessageDelete({
          guildId,
          channelId,
          messageId,
          userId: authorId,
          content: message.content,
          attachments: Array.from(message.attachments.values())
        });
        logInfo('MessageDelete', `Successfully logged message deletion to database`);
      } catch (dbError) {
        logError('MessageDelete', `Failed to log message deletion to database: ${dbError}`);
      }
      
      // Send message delete log
      try {
        if (message.guild) {
          await sendMessageLog(
            client,
            message.guild,
            'delete',
            message as Message
          );
          logInfo('MessageDelete', `Successfully sent message deletion log to channel`);
        }
      } catch (logChannelError) {
        logError('MessageDelete', `Failed to send message deletion log to channel: ${logChannelError}`);
      }

      // Remove from cache
      messageCache.delete(message.id);

    } catch (error) {
      logError('MessageDelete', `Error tracking message deletion: ${error}`);
    }
  });
}

// Track channel events
export function trackChannelEvents(client: Client<true>) {
  // Channel create
  client.on(Events.ChannelCreate, async (channel) => {
    try {
      if (!(channel instanceof GuildChannel)) return;
      
      // Get the user who created the channel if available
      let creatorId = 'system';
      try {
        const auditLogs = await channel.guild.fetchAuditLogs({
          type: AuditLogEvent.ChannelCreate,
          limit: 1
        });
        const entry = auditLogs.entries.first();
        if (entry?.executor) {
          creatorId = entry.executor.id;
        }
      } catch (auditError) {
        logError('Audit Log Fetch', String(auditError));
      }
      
      // Send channel create log
      await sendChannelLog(
        client,
        channel.guild,
        'create',
        channel
      );
    } catch (error) {
      logError('ChannelCreate', `Error tracking channel creation: ${error}`);
    }
  });

  // Channel delete
  client.on(Events.ChannelDelete, async (channel) => {
    try {
      if (!(channel instanceof GuildChannel)) return;
      
      const executor = await getExecutor(channel.guild, channel.id, AuditLogEvent.ChannelDelete);
      
      // Send channel delete log
      await sendChannelLog(
        client,
        channel.guild,
        'delete',
        channel
      );
    } catch (error) {
      logError('ChannelDelete', `Error tracking channel deletion: ${error}`);
    }
  });

  // Channel update
  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    try {
      if (!(oldChannel instanceof GuildChannel) || !(newChannel instanceof GuildChannel)) return;
      
      const executor = await getExecutor(newChannel.guild, newChannel.id, AuditLogEvent.ChannelUpdate);
      
      // Check what changed
      const changes: Record<string, { old: any; new: any }> = {};
      
      if (oldChannel.name !== newChannel.name) {
        changes.name = { old: oldChannel.name, new: newChannel.name };
      }
      
      if (oldChannel.parentId !== newChannel.parentId) {
        changes.parent = { 
          old: oldChannel.parent?.name || 'None', 
          new: newChannel.parent?.name || 'None' 
        };
      }
      
      // For text channels, check topic and NSFW status
      if (oldChannel.isTextBased() && newChannel.isTextBased()) {
        const oldTextChannel = oldChannel as TextChannel;
        const newTextChannel = newChannel as TextChannel;
        
        if (oldTextChannel.topic !== newTextChannel.topic) {
          changes.topic = { 
            old: oldTextChannel.topic || 'None', 
            new: newTextChannel.topic || 'None' 
          };
        }
        
        if (oldTextChannel.nsfw !== newTextChannel.nsfw) {
          changes.nsfw = { old: oldTextChannel.nsfw, new: newTextChannel.nsfw };
        }
      }
      
      // Only log if something actually changed
      if (Object.keys(changes).length > 0) {
        // Send channel update log
        await sendChannelLog(
          client,
          newChannel.guild,
          'update',
          newChannel,
          oldChannel
        );
      }
    } catch (error) {
      logError('ChannelUpdate', `Error tracking channel update: ${error}`);
    }
  });
}

// Helper function to get the user who performed an action from audit logs
async function getExecutor(guild: any, targetId: string, action: number) {
  try {
    const logs = await guild.fetchAuditLogs({
      type: action,
      limit: 1
    });
    
    const entry = logs.entries.first();
    if (!entry || !entry.executor || entry.target?.id !== targetId) return null;
    
    return entry.executor;
  } catch (error) {
    logError('AuditLog', `Error fetching audit logs: ${error}`);
    return null;
  }
}

// Initialize all tracking with proper type checking
export function initializeMessageAndChannelTracking(discordClient: Client) {
  // Type assertion to ensure the client is ready
  if (!discordClient.isReady()) {
    throw new Error('Client is not ready. Make sure to call this function after the ready event.');
  }
  
  const readyClient = discordClient as Client<true>;
  setClient(readyClient);
  
  try {
    trackMessageEdits(readyClient);
    trackMessageDeletions(readyClient);
    trackChannelEvents(readyClient);
    logInfo('Event Handlers', 'Message and channel tracking initialized');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Event Handlers', `Failed to initialize message and channel tracking: ${errorMessage}`);
  }
}

// Client instance is already declared at the top of the file

/**
 * Sets the client instance for this module
 * @param discordClient The Discord client instance (must be ready)
 */
export function setClient(discordClient: Client<true>): void {
  _client = discordClient;
}

/**
 * Gets the client instance
 * @returns The ready Discord client instance
 * @throws Error if the client is not initialized or not ready
 */
export function getClient(): Client<true> {
  if (!_client || !_client.isReady()) {
    throw new Error('Client is not ready. Make sure to call setClient() with a ready client.');
  }
  return _client;
}
