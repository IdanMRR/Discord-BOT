import { Client, Guild } from 'discord.js';
import { logInfo, logError, logWarning } from './logger';

/**
 * Validates that a channel ID exists and is accessible by the bot
 */
export async function validateChannelId(client: Client, guildId: string, channelId: string): Promise<boolean> {
  try {
    if (!channelId || channelId === 'null' || channelId === 'undefined') {
      return false;
    }

    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    
    return channel !== null && channel.isTextBased();
  } catch (error: any) {
    if (error.code === 10003) {
      logWarning('ChannelValidator', `Channel ${channelId} not found in guild ${guildId}`);
    } else if (error.code === 50001) {
      logWarning('ChannelValidator', `Bot lacks permission to access channel ${channelId} in guild ${guildId}`);
    } else {
      logError('ChannelValidator', `Error validating channel ${channelId}: ${error.message || error}`);
    }
    return false;
  }
}

/**
 * Validates multiple channel IDs and returns the first valid one
 */
export async function validateChannelIds(client: Client, guildId: string, channelIds: (string | null | undefined)[]): Promise<string | null> {
  for (const channelId of channelIds) {
    if (channelId && await validateChannelId(client, guildId, channelId)) {
      return channelId;
    }
  }
  return null;
}

/**
 * Validates server logging configuration and reports issues
 */
export async function validateServerLoggingConfig(client: Client, guildId: string, serverSettings: any): Promise<{
  memberLogChannel: string | null;
  logChannel: string | null;
  modLogChannel: string | null;
  issues: string[];
}> {
  const issues: string[] = [];
  
  // Validate member log channel
  const memberLogChannel = await validateChannelIds(client, guildId, [
    serverSettings?.member_log_channel_id,
    serverSettings?.log_channel_id,
    serverSettings?.mod_log_channel_id
  ]);
  
  if (!memberLogChannel && serverSettings?.member_log_channel_id) {
    issues.push(`Invalid member_log_channel_id: ${serverSettings.member_log_channel_id}`);
  }
  
  // Validate general log channel
  const logChannel = await validateChannelIds(client, guildId, [
    serverSettings?.log_channel_id,
    serverSettings?.mod_log_channel_id
  ]);
  
  if (!logChannel && serverSettings?.log_channel_id) {
    issues.push(`Invalid log_channel_id: ${serverSettings.log_channel_id}`);
  }
  
  // Validate mod log channel
  const modLogChannel = serverSettings?.mod_log_channel_id && 
    await validateChannelId(client, guildId, serverSettings.mod_log_channel_id) 
      ? serverSettings.mod_log_channel_id 
      : null;
  
  if (!modLogChannel && serverSettings?.mod_log_channel_id) {
    issues.push(`Invalid mod_log_channel_id: ${serverSettings.mod_log_channel_id}`);
  }
  
  if (issues.length > 0) {
    logWarning('ChannelValidator', `Found ${issues.length} channel configuration issues for guild ${guildId}`);
    issues.forEach(issue => logWarning('ChannelValidator', issue));
  }
  
  return {
    memberLogChannel,
    logChannel,
    modLogChannel,
    issues
  };
}

/**
 * Clean up invalid channel IDs from server settings
 */
export async function cleanupInvalidChannels(guildId: string, invalidChannels: string[]): Promise<void> {
  try {
    const { db } = await import('../database/sqlite');
    
    // Build update query to set invalid channels to NULL
    const updates: string[] = [];
    const params: any[] = [];
    
    if (invalidChannels.includes('member_log_channel_id')) {
      updates.push('member_log_channel_id = NULL');
    }
    if (invalidChannels.includes('log_channel_id')) {
      updates.push('log_channel_id = NULL');
    }
    if (invalidChannels.includes('mod_log_channel_id')) {
      updates.push('mod_log_channel_id = NULL');
    }
    if (invalidChannels.includes('welcome_channel_id')) {
      updates.push('welcome_channel_id = NULL');
    }
    if (invalidChannels.includes('goodbye_channel_id')) {
      updates.push('goodbye_channel_id = NULL');
    }
    
    if (updates.length > 0) {
      const query = `UPDATE server_settings SET ${updates.join(', ')} WHERE guild_id = ?`;
      params.push(guildId);
      
      const result = db.prepare(query).run(...params);
      logInfo('ChannelValidator', `Cleaned up ${result.changes} invalid channel configurations for guild ${guildId}`);
    }
  } catch (error) {
    logError('ChannelValidator', `Error cleaning up invalid channels: ${error}`);
  }
}