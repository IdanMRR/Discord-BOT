import { 
  Client, 
  Guild, 
  GuildMember, 
  PartialGuildMember,
  Collection, 
  Invite,
  EmbedBuilder,
  TextChannel,
  Events,
  ColorResolvable,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GatewayIntentBits
} from 'discord.js';
import { logInfo, logError } from '../../utils/logger';
import { db } from '../../database/sqlite';
import { Colors } from '../../utils/embeds';

// Store guild invites and member join timestamps
const guildInvites = new Map<string, Collection<string, Invite>>();
const memberJoinTimestamps = new Map<string, Map<string, number>>();

// Track recently processed members to prevent duplicate messages
const recentlyProcessedMembers = new Map<string, Set<string>>();
const DUPLICATE_PREVENTION_TIMEOUT = 10000; // 10 seconds

// Constants for fake invite detection
const FAKE_INVITE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

export interface MemberEventConfig {
  enabled: boolean;
  welcome_channel_id?: string;
  goodbye_channel_id?: string;
  welcome_message?: string;
  goodbye_message?: string;
  show_member_count?: boolean;
  welcome_embed_color?: string;
  goodbye_embed_color?: string;
  // Custom embeds from dashboard
  custom_welcome_embed?: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  };
  custom_goodbye_embed?: {
    title: string;
    description: string;
    color: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  };
}

/**
 * Ensure the invite_tracking table exists and has all required columns
 */
async function ensureInviteTrackingSchema(): Promise<void> {
  try {
    // Check if invite_tracking table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invite_tracking'").get();
    
    if (!tableExists) {
      // Create the table with all required columns
      db.prepare(`
        CREATE TABLE invite_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          invite_code TEXT,
          inviter TEXT,
          inviter_id TEXT,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      
      logInfo('UnifiedMemberHandler', 'Created invite_tracking table with all required columns');
      return;
    }
    
    // If table exists, check if it has inviter_id column
    const hasInviterIdColumn = db.prepare("PRAGMA table_info(invite_tracking)").all()
      .some((col: any) => col.name === 'inviter_id');
    
    if (!hasInviterIdColumn) {
      // Add inviter_id column
      db.prepare(`ALTER TABLE invite_tracking ADD COLUMN inviter_id TEXT`).run();
      logInfo('UnifiedMemberHandler', 'Added inviter_id column to invite_tracking table');
    }
  } catch (error) {
    logError('UnifiedMemberHandler', `Error ensuring invite tracking schema: ${error}`);
  }
}

/**
 * Get server settings including member events configuration
 */
async function getServerSettings(guildId: string) {
  try {
    const { settingsManager } = await import('../../utils/settings');
    return await settingsManager.getSettings(guildId);
  } catch (error) {
    logError('UnifiedMemberHandler', `Error getting server settings: ${error}`);
    return null;
  }
}

/**
 * Get member events configuration from server settings
 */
function getMemberEventConfig(serverSettings: any): MemberEventConfig {
  // Default configuration
  const defaultConfig: MemberEventConfig = {
    enabled: true,
    welcome_message: 'Welcome to {guild}, {user}! We hope you enjoy your stay.',
    goodbye_message: '{user} has left the server. We hope to see you again soon!',
    show_member_count: true,
    welcome_embed_color: '#43b581',
    goodbye_embed_color: '#f04747'
  };

  // If no server settings, return default
  if (!serverSettings) {
    return defaultConfig;
  }

  // Start with direct channel IDs from server settings (priority)
  const config: MemberEventConfig = {
    ...defaultConfig,
    welcome_channel_id: serverSettings.welcome_channel_id,
    goodbye_channel_id: serverSettings.goodbye_channel_id,
    welcome_message: serverSettings.welcome_message || defaultConfig.welcome_message
  };

  // If member_events_config exists, parse and merge it
  if (serverSettings.member_events_config) {
    try {
      // Handle both string and object types
      let memberEventsConfig: any;
      if (typeof serverSettings.member_events_config === 'string') {
        // Only parse if it's a valid JSON string (not "[object Object]")
        if (serverSettings.member_events_config.startsWith('{') || serverSettings.member_events_config.startsWith('[')) {
          memberEventsConfig = JSON.parse(serverSettings.member_events_config);
        } else {
          logError('UnifiedMemberHandler', `Invalid JSON in member_events_config: ${serverSettings.member_events_config}`);
          memberEventsConfig = {};
        }
      } else if (typeof serverSettings.member_events_config === 'object') {
        memberEventsConfig = serverSettings.member_events_config;
      } else {
        memberEventsConfig = {};
      }
      
      // Merge config but prioritize direct server settings for channel IDs
      Object.assign(config, {
        enabled: memberEventsConfig.enabled ?? config.enabled,
        // Keep welcome_channel_id from server settings if it exists, otherwise use config
        welcome_channel_id: config.welcome_channel_id || memberEventsConfig.welcome_channel_id,
        // Keep goodbye_channel_id from server settings if it exists, otherwise use config
        goodbye_channel_id: config.goodbye_channel_id || memberEventsConfig.goodbye_channel_id,
        welcome_message: memberEventsConfig.welcome_message || config.welcome_message,
        goodbye_message: memberEventsConfig.goodbye_message || config.goodbye_message,
        show_member_count: memberEventsConfig.show_member_count ?? config.show_member_count,
        welcome_embed_color: memberEventsConfig.welcome_embed_color || config.welcome_embed_color,
        goodbye_embed_color: memberEventsConfig.goodbye_embed_color || config.goodbye_embed_color,
        custom_welcome_embed: memberEventsConfig.custom_welcome_embed,
        custom_goodbye_embed: memberEventsConfig.custom_goodbye_embed
      });
    } catch (parseError) {
      logError('UnifiedMemberHandler', `Error parsing member_events_config: ${parseError}`);
    }
  }

  return config;
}

/**
 * Get a text channel by ID safely
 */
async function getTextChannel(guildId: string, channelId: string): Promise<TextChannel | null> {
  try {
    const { getClient } = await import('../../utils/client-utils');
    const client = getClient();
    
    if (!client) {
      logError('UnifiedMemberHandler', 'Discord client is not initialized');
      return null;
    }
    
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    
    if (channel && channel.isTextBased()) {
      return channel as TextChannel;
    }
    
    return null;
  } catch (error) {
    logError('UnifiedMemberHandler', `Error fetching channel ${channelId}: ${error}`);
    return null;
  }
}

/**
 * Cache invites for all guilds
 */
async function cacheAllGuildInvites(client: Client): Promise<void> {
  try {
    for (const guild of client.guilds.cache.values()) {
      await cacheGuildInvites(guild);
    }
    logInfo('UnifiedMemberHandler', `Cached invites for ${client.guilds.cache.size} guilds`);
  } catch (error) {
    logError('UnifiedMemberHandler', `Error caching all guild invites: ${error}`);
  }
}

/**
 * Cache invites for a specific guild
 */
async function cacheGuildInvites(guild: Guild): Promise<void> {
  try {
    if ('invites' in guild) {
      const invites = await guild.invites.fetch();
      guildInvites.set(guild.id, invites);
      logInfo('UnifiedMemberHandler', `Cached ${invites.size} invites for guild ${guild.name}`);
    }
  } catch (error) {
    logError('UnifiedMemberHandler', `Error caching invites for guild ${guild.name}: ${error}`);
  }
}

/**
 * Detect which invite was used
 */
async function detectUsedInvite(guild: Guild): Promise<{
  inviteCode: string;
  inviter: string;
  inviterId: string;
}> {
  const defaultResult = {
    inviteCode: 'unknown',
    inviter: 'Unknown',
    inviterId: ''
  };

  try {
    // Get the cached invites before the user joined
    const cachedInvites = guildInvites.get(guild.id);
    
    // Fetch the current invites after the user joined
    const currentInvites = await guild.invites.fetch();
    
    // Find the invite that was used by comparing uses
    if (cachedInvites && currentInvites.size > 0) {
      for (const [code, invite] of currentInvites) {
        const cachedInvite = cachedInvites.get(code);
        
        if (cachedInvite && invite.uses !== null && cachedInvite.uses !== null && invite.uses > cachedInvite.uses) {
          return {
            inviteCode: invite.code,
            inviter: invite.inviter?.tag || 'Unknown',
            inviterId: invite.inviter?.id || ''
          };
        }
      }
      
      // Check for vanity URL
      if (guild.vanityURLCode) {
        return {
          inviteCode: guild.vanityURLCode,
          inviter: 'Vanity URL',
          inviterId: ''
        };
      }
    }
    
    // Update the cache with current invites
    guildInvites.set(guild.id, currentInvites);
    
    return defaultResult;
  } catch (error) {
    logError('UnifiedMemberHandler', `Error detecting used invite: ${error}`);
    return defaultResult;
  }
}

/**
 * Store invite data in the database
 */
function storeInviteData(guildId: string, userId: string, inviteCode: string, inviter: string, inviterId: string): void {
  try {
    db.prepare(`
      INSERT INTO invite_tracking (guild_id, user_id, invite_code, inviter, inviter_id, joined_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(guildId, userId, inviteCode, inviter, inviterId);
    
    logInfo('UnifiedMemberHandler', `Stored invite data for user ${userId} in guild ${guildId}`);
  } catch (error) {
    logError('UnifiedMemberHandler', `Error storing invite data: ${error}`);
  }
}

/**
 * Get invite data for a user
 */
function getInviteData(guildId: string, userId: string): { 
  invite_code: string, 
  inviter: string, 
  inviter_id?: string,
  joined_at?: Date
} | undefined {
  try {
    const stmt = db.prepare(`
      SELECT * FROM invite_tracking
      WHERE guild_id = ? AND user_id = ?
      ORDER BY joined_at DESC
      LIMIT 1
    `);
    
    const result = stmt.get(guildId, userId) as any;
    
    if (result) {
      return {
        invite_code: result.invite_code,
        inviter: result.inviter,
        inviter_id: result.inviter_id,
        joined_at: result.joined_at ? new Date(result.joined_at) : undefined
      };
    }
    
    return undefined;
  } catch (error) {
    logError('UnifiedMemberHandler', `Error getting invite data: ${error}`);
    return undefined;
  }
}

/**
 * Format time spent in server
 */
function formatTimeSpent(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}, ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes % 60} minute${minutes % 60 !== 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}, ${seconds % 60} second${seconds % 60 !== 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
}

/**
 * Replace placeholders in text with actual values
 */
function replacePlaceholders(text: string, member: GuildMember | PartialGuildMember, guild: Guild, extraData?: {
  memberCount?: number;
  inviter?: string;
  inviteCode?: string;
  timeInServer?: string;
}): string {
  if (!text) return text;
  
  console.log(`[DEBUG] Original text: "${text}"`);
  console.log(`[DEBUG] Member ID: ${member.id}, Username: ${member.user?.username}`);
  
  const result = text
    .replace(/{user}/g, member.user?.username || 'Unknown')
    .replace(/{username}/g, member.user?.username || 'Unknown')
    .replace(/{mention}/g, `<@${member.id}>`)
    .replace(/{guild}/g, guild.name)
    .replace(/{server}/g, guild.name)
    .replace(/{serverName}/g, guild.name)
    .replace(/{memberCount}/g, (extraData?.memberCount || guild.memberCount).toString())
    .replace(/{totalMembers}/g, (extraData?.memberCount || guild.memberCount).toString())
    .replace(/{inviter}/g, extraData?.inviter || 'Unknown')
    .replace(/{inviteCode}/g, extraData?.inviteCode || 'Unknown')
    .replace(/{timeInServer}/g, extraData?.timeInServer || 'Unknown');
  
  console.log(`[DEBUG] Processed text: "${result}"`);
  return result;
}

/**
 * Handle member join events
 */
async function handleMemberJoin(member: GuildMember): Promise<void> {
  try {
    const { guild } = member;
    const timestamp = Date.now();
    const memberKey = `join-${guild.id}-${member.id}-${timestamp}`;
    
    // Prevent duplicate processing
    if (!recentlyProcessedMembers.has(guild.id)) {
      recentlyProcessedMembers.set(guild.id, new Set());
    }
    
    const recentEvents = Array.from(recentlyProcessedMembers.get(guild.id) || [])
      .filter(key => key.startsWith(`join-${guild.id}-${member.id}`));
    
    if (recentEvents.length > 0) {
      const mostRecentEvent = recentEvents[recentEvents.length - 1];
      const mostRecentTimestamp = parseInt(mostRecentEvent.split('-')[3] || '0');
      
      if (timestamp - mostRecentTimestamp < DUPLICATE_PREVENTION_TIMEOUT) {
        logInfo('UnifiedMemberHandler', `Skipping duplicate join processing for ${member.user.tag}`);
        return;
      }
    }
    
    recentlyProcessedMembers.get(guild.id)!.add(memberKey);
    setTimeout(() => {
      recentlyProcessedMembers.get(guild.id)?.delete(memberKey);
    }, DUPLICATE_PREVENTION_TIMEOUT);
    
    // Get server settings and configuration
    const serverSettings = await getServerSettings(guild.id);
    const config = getMemberEventConfig(serverSettings);
    
    if (!config.enabled) {
      logInfo('UnifiedMemberHandler', `Member events disabled for guild ${guild.id}`);
      return;
    }
    
    // Detect used invite
    const { inviteCode, inviter, inviterId } = await detectUsedInvite(guild);
    
    // Store join timestamp and invite data
    if (!memberJoinTimestamps.has(guild.id)) {
      memberJoinTimestamps.set(guild.id, new Map());
    }
    memberJoinTimestamps.get(guild.id)!.set(member.id, timestamp);
    storeInviteData(guild.id, member.id, inviteCode, inviter, inviterId);
    
    // Send to member logs channel (detailed logging)
    if (serverSettings?.member_log_channel_id) {
      const memberLogsChannel = await getTextChannel(guild.id, serverSettings.member_log_channel_id);
      
      if (memberLogsChannel) {
        const joinEmbed = new EmbedBuilder()
          .setColor('#43b581' as ColorResolvable)
          .setTitle('🎉 New Member Joined')
          .setThumbnail(member.user.displayAvatarURL())
          .setDescription(`**User:** <@${member.id}> (${member.user.tag})`)
          .addFields([
            { name: 'User ID', value: member.id, inline: true },
            { name: 'Account Age', value: `${Math.floor((Date.now() - member.user.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days`, inline: true },
            { name: 'Created On', value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:F>`, inline: false },
            { 
              name: 'Invited By', 
              value: inviter !== 'Unknown' 
                ? (inviterId ? `${inviter} (<@${inviterId}>)` : inviter)
                : 'Unknown (Could not determine inviter)',
              inline: false 
            },
            { name: 'Invite Code', value: inviteCode, inline: true },
            { name: 'Server Stats', value: `• **${guild.memberCount}** total members`, inline: false }
          ])
          .setFooter({ text: `Made By Soggra • Member ID: ${member.id}` })
          .setTimestamp();
        
        await memberLogsChannel.send({ embeds: [joinEmbed] });
        logInfo('UnifiedMemberHandler', `Sent detailed join log for ${member.user.tag}`);
      }
    }
    
    // Send to welcome channel (public welcome)
    if (config.welcome_channel_id) {
      const welcomeChannel = await getTextChannel(guild.id, config.welcome_channel_id);
      
      if (welcomeChannel) {
        // Check if there's a custom welcome embed
        if (config.custom_welcome_embed) {
          // Use custom embed design with placeholder replacement
          const customEmbed = config.custom_welcome_embed;
          
          // Parse color if it's a hex string
          let color: number;
          if (customEmbed.color.startsWith('#')) {
            color = parseInt(customEmbed.color.substring(1), 16);
          } else {
            color = parseInt(customEmbed.color, 16);
          }
          
          const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(replacePlaceholders(customEmbed.title, member, guild, {
              memberCount: guild.memberCount,
              inviter: inviter,
              inviteCode: inviteCode
            }))
            .setDescription(replacePlaceholders(customEmbed.description, member, guild, {
              memberCount: guild.memberCount,
              inviter: inviter,
              inviteCode: inviteCode
            }))
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: 'Made By Soggra • Welcome System' })
            .setTimestamp();
          
          // Add custom fields with placeholder replacement
          if (customEmbed.fields && customEmbed.fields.length > 0) {
            const processedFields = customEmbed.fields.map(field => ({
              name: replacePlaceholders(field.name, member, guild, {
                memberCount: guild.memberCount,
                inviter: inviter,
                inviteCode: inviteCode
              }),
              value: replacePlaceholders(field.value, member, guild, {
                memberCount: guild.memberCount,
                inviter: inviter,
                inviteCode: inviteCode
              }),
              inline: field.inline || false
            }));
            
            embed.addFields(processedFields);
          }
          
          await welcomeChannel.send({ embeds: [embed] });
          logInfo('UnifiedMemberHandler', `✅ Sent custom welcome message for ${member.user.tag} to ${welcomeChannel.name}`);
        } else {
          // Use default welcome embed
          const welcomeEmbed = new EmbedBuilder()
            .setColor(config.welcome_embed_color as ColorResolvable)
            .setTitle('👋 Welcome!')
            .setThumbnail(member.user.displayAvatarURL())
            .setDescription(replacePlaceholders(config.welcome_message!, member, guild, {
              memberCount: guild.memberCount,
              inviter: inviter,
              inviteCode: inviteCode
            }))
            .setFooter({ text: `Made By Soggra • Welcome System` })
            .setTimestamp();
          
          if (config.show_member_count) {
            welcomeEmbed.addFields([
              { name: 'Member Count', value: `You are member #${guild.memberCount}`, inline: true }
            ]);
          }
          
          await welcomeChannel.send({ embeds: [welcomeEmbed] });
          logInfo('UnifiedMemberHandler', `✅ Sent welcome message for ${member.user.tag} to ${welcomeChannel.name}`);
        }
        
        // Add member count button if enabled and not using custom embed
        if (config.show_member_count && !config.custom_welcome_embed) {
          const memberCountButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('member_count')
              .setLabel(`👑 YOU ARE OUR ${guild.memberCount}TH MEMBER!`)
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true)
          );
          await welcomeChannel.send({ components: [memberCountButton] });
        }
      }
    }
    
  } catch (error) {
    logError('UnifiedMemberHandler', `Error handling member join: ${error}`);
  }
}

/**
 * Handle member leave events
 */
async function handleMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  try {
    const { guild } = member;
    const timestamp = Date.now();
    const memberKey = `leave-${guild.id}-${member.id}-${timestamp}`;
    
    // Prevent duplicate processing
    if (!recentlyProcessedMembers.has(guild.id)) {
      recentlyProcessedMembers.set(guild.id, new Set());
    }
    
    const recentEvents = Array.from(recentlyProcessedMembers.get(guild.id) || [])
      .filter(key => key.startsWith(`leave-${guild.id}-${member.id}`));
    
    if (recentEvents.length > 0) {
      const mostRecentEvent = recentEvents[recentEvents.length - 1];
      const mostRecentTimestamp = parseInt(mostRecentEvent.split('-')[3] || '0');
      
      if (timestamp - mostRecentTimestamp < DUPLICATE_PREVENTION_TIMEOUT) {
        logInfo('UnifiedMemberHandler', `Skipping duplicate leave processing for ${member.user?.tag || member.id}`);
        return;
      }
    }
    
    recentlyProcessedMembers.get(guild.id)!.add(memberKey);
    setTimeout(() => {
      recentlyProcessedMembers.get(guild.id)?.delete(memberKey);
    }, DUPLICATE_PREVENTION_TIMEOUT);
    
    // Get server settings and configuration
    const serverSettings = await getServerSettings(guild.id);
    const config = getMemberEventConfig(serverSettings);
    
    if (!config.enabled) {
      logInfo('UnifiedMemberHandler', `Member events disabled for guild ${guild.id}`);
      return;
    }
    
    // Get invite data
    const inviteData = getInviteData(guild.id, member.id);
    const inviter = inviteData?.inviter || 'Unknown';
    const inviterId = inviteData?.inviter_id || '';
    const inviteCode = inviteData?.invite_code || 'Unknown';
    
    // Calculate time in server
    let timeInServer = 'Unknown';
    let joinDate = 'Unknown';
    let isFakeInvite = false;
    
    const joinTimestamp = memberJoinTimestamps.get(guild.id)?.get(member.id);
    if (joinTimestamp) {
      const timeSpentMs = timestamp - joinTimestamp;
      timeInServer = formatTimeSpent(timeSpentMs);
      joinDate = `<t:${Math.floor(joinTimestamp / 1000)}:F>`;
      
      if (timeSpentMs < FAKE_INVITE_THRESHOLD_MS) {
        isFakeInvite = true;
      }
    } else if (member.joinedAt) {
      const timeSpentMs = timestamp - member.joinedAt.getTime();
      timeInServer = formatTimeSpent(timeSpentMs);
      joinDate = `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`;
      
      if (timeSpentMs < FAKE_INVITE_THRESHOLD_MS) {
        isFakeInvite = true;
      }
    }
    
    // Send to member logs channel (detailed logging) - Only if member is not partial
    if (!member.partial && serverSettings?.member_log_channel_id) {
      const memberLogsChannel = await getTextChannel(guild.id, serverSettings.member_log_channel_id);
      
      if (memberLogsChannel && member.user) {
        const leaveEmbed = new EmbedBuilder()
          .setColor(isFakeInvite ? '#FF0000' : '#FF6347')
          .setTitle(isFakeInvite ? '⚠️ Member Left (Possible Fake Invite)' : '👋 Member Left')
          .setDescription(`**User:** ${member.user.tag} (<@${member.id}>)`)
          .setThumbnail(member.user.displayAvatarURL())
          .addFields([
            { name: 'User ID', value: member.id, inline: true },
            { name: 'Invite Code', value: inviteCode, inline: true },
            { 
              name: 'Invited By', 
              value: inviter !== 'Unknown' 
                ? (inviterId ? `${inviter} (<@${inviterId}>)` : inviter)
                : 'Unknown',
              inline: true 
            },
            { name: 'Joined Server', value: joinDate, inline: true },
            { name: 'Time in Server', value: timeInServer, inline: true },
            { name: 'Server Stats', value: `• **${guild.memberCount}** total members`, inline: false }
          ])
          .setFooter({ text: `Made By Soggra • Member ID: ${member.id}` })
          .setTimestamp();
        
        if (isFakeInvite) {
          leaveEmbed.addFields([
            { 
              name: '⚠️ Fake Invite Warning', 
              value: `This user left shortly after joining (${timeInServer}), which may indicate a fake invite.`,
              inline: false 
            }
          ]);
        }
        
        await memberLogsChannel.send({ embeds: [leaveEmbed] });
        logInfo('UnifiedMemberHandler', `Sent detailed leave log for ${member.user?.tag || member.id}`);
      }
    }
    
    // Send to goodbye channel (public goodbye) - Process even if member is partial
    const goodbyeChannelId = config.goodbye_channel_id || config.welcome_channel_id;
    
    // If no channel configured in database, try to use a default channel name
    let goodbyeChannel: TextChannel | null = null;
    
    if (goodbyeChannelId) {
      goodbyeChannel = await getTextChannel(guild.id, goodbyeChannelId);
      logInfo('UnifiedMemberHandler', `Found configured goodbye channel: ${goodbyeChannelId}`);
    } else {
      // Try to find a channel named 'goodbye' or 'welcome' or 'general'
      const channelNames = ['goodbye', 'welcome', 'general', 'chat'];
      for (const channelName of channelNames) {
        const foundChannel = guild.channels.cache.find(ch => 
          ch.name.toLowerCase() === channelName && ch.isTextBased()
        ) as TextChannel | undefined;
        
        if (foundChannel) {
          goodbyeChannel = foundChannel;
          logInfo('UnifiedMemberHandler', `Using fallback channel: ${foundChannel.name} (${foundChannel.id})`);
          break;
        }
      }
    }
    
    if (goodbyeChannel) {
      try {
        // Check if there's a custom goodbye embed
        if (config.custom_goodbye_embed) {
          // Use custom embed design with placeholder replacement
          const customEmbed = config.custom_goodbye_embed;
          
          // Parse color if it's a hex string
          let color: number;
          if (customEmbed.color.startsWith('#')) {
            color = parseInt(customEmbed.color.substring(1), 16);
          } else {
            color = parseInt(customEmbed.color, 16);
          }
          
          const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(replacePlaceholders(customEmbed.title, member, guild, {
              memberCount: guild.memberCount,
              inviter: inviter,
              inviteCode: inviteCode,
              timeInServer: timeInServer
            }))
            .setDescription(replacePlaceholders(customEmbed.description, member, guild, {
              memberCount: guild.memberCount,
              inviter: inviter,
              inviteCode: inviteCode,
              timeInServer: timeInServer
            }))
            .setThumbnail(member.user?.displayAvatarURL() || guild.iconURL())
            .setFooter({ text: 'Made By Soggra • Goodbye System' })
            .setTimestamp();
          
          // Add custom fields with placeholder replacement
          if (customEmbed.fields && customEmbed.fields.length > 0) {
            const processedFields = customEmbed.fields.map(field => ({
              name: replacePlaceholders(field.name, member, guild, {
                memberCount: guild.memberCount,
                inviter: inviter,
                inviteCode: inviteCode,
                timeInServer: timeInServer
              }),
              value: replacePlaceholders(field.value, member, guild, {
                memberCount: guild.memberCount,
                inviter: inviter,
                inviteCode: inviteCode,
                timeInServer: timeInServer
              }),
              inline: field.inline || false
            }));
            
            embed.addFields(processedFields);
          }
          
          await goodbyeChannel.send({ embeds: [embed] });
          logInfo('UnifiedMemberHandler', `✅ Sent custom goodbye message for ${member.user?.tag || member.id} to ${goodbyeChannel.name}`);
        } else {
          // Use default goodbye embed
          const goodbyeEmbed = new EmbedBuilder()
            .setColor(config.goodbye_embed_color as ColorResolvable)
            .setTitle('👋 Goodbye!')
            .setThumbnail(member.user?.displayAvatarURL() || guild.iconURL())
            .setDescription(replacePlaceholders(config.goodbye_message!, member, guild, {
              memberCount: guild.memberCount,
              inviter: inviter,
              inviteCode: inviteCode,
              timeInServer: timeInServer
            }))
            .addFields([
              { name: 'Server', value: guild.name, inline: true },
              { name: 'Member Count', value: `${guild.memberCount} members`, inline: true }
            ])
            .setFooter({ text: `Made By Soggra • Goodbye System` })
            .setTimestamp();
        
          await goodbyeChannel.send({ embeds: [goodbyeEmbed] });
          logInfo('UnifiedMemberHandler', `✅ Sent goodbye message for ${member.user?.tag || member.id} to ${goodbyeChannel.name}`);
        }
      } catch (sendError) {
        logError('UnifiedMemberHandler', `❌ Error sending goodbye message: ${sendError}`);
      }
    } else {
      logInfo('UnifiedMemberHandler', `⚠️ No goodbye channel found for guild ${guild.id} - checked database config and fallback channels`);
    }
    
    // Clean up join timestamp
    memberJoinTimestamps.get(guild.id)?.delete(member.id);
    
  } catch (error) {
    logError('UnifiedMemberHandler', `Error handling member leave: ${error}`);
  }
}

/**
 * Initialize the unified member handler
 */
export async function initializeUnifiedMemberHandler(client: Client): Promise<void> {
  try {
    logInfo('UnifiedMemberHandler', '🔧 Starting unified member handler initialization...');
    
    // Ensure database schema is correct
    await ensureInviteTrackingSchema();
    
    // Add comprehensive debugging for bot permissions and intents
    logInfo('UnifiedMemberHandler', `Bot has GuildMembers intent: ${client.options.intents.has(GatewayIntentBits.GuildMembers)}`);
    logInfo('UnifiedMemberHandler', `Bot has Guilds intent: ${client.options.intents.has(GatewayIntentBits.Guilds)}`);
    
    // When the bot is ready, cache all guild invites
    client.on(Events.ClientReady, async () => {
      logInfo('UnifiedMemberHandler', '🚀 Bot is ready, caching guild invites...');
      await cacheAllGuildInvites(client);
      logInfo('UnifiedMemberHandler', 'Unified member handler initialized');
      
      // Set up periodic refresh of invite cache
      setInterval(() => {
        cacheAllGuildInvites(client);
      }, 10 * 60 * 1000); // Refresh every 10 minutes
    });

    // When the bot joins a new guild, cache its invites
    client.on(Events.GuildCreate, async (guild) => {
      if (guild.available) {
        logInfo('UnifiedMemberHandler', `🏰 Bot joined new guild: ${guild.name} (${guild.id})`);
        await cacheGuildInvites(guild);
        logInfo('UnifiedMemberHandler', `Cached invites for new guild: ${guild.name}`);
      }
    });

    // When a new invite is created, update the cache
    client.on(Events.InviteCreate, async (invite) => {
      if (!invite.guild) return;
      
      const guild = invite.guild;
      logInfo('UnifiedMemberHandler', `📋 New invite created in ${guild.name}: ${invite.code}`);
      if ('invites' in guild) {
        try {
          const invites = await guild.invites.fetch();
          guildInvites.set(guild.id, invites);
          logInfo('UnifiedMemberHandler', `Updated invite cache for guild ${guild.name} after new invite created`);
        } catch (error) {
          logError('UnifiedMemberHandler', `Error updating invite cache: ${error}`);
        }
      }
    });

    // When an invite is deleted, update the cache
    client.on(Events.InviteDelete, async (invite) => {
      if (!invite.guild) return;
      
      const guild = invite.guild;
      logInfo('UnifiedMemberHandler', `🗑️ Invite deleted in ${guild.name}: ${invite.code}`);
      if ('invites' in guild) {
        try {
          const invites = await guild.invites.fetch();
          guildInvites.set(guild.id, invites);
          logInfo('UnifiedMemberHandler', `Updated invite cache for guild ${guild.name} after invite deleted`);
        } catch (error) {
          logError('UnifiedMemberHandler', `Error updating invite cache: ${error}`);
        }
      }
    });

    // Handle member join - THIS IS THE CRITICAL PART
    client.on(Events.GuildMemberAdd, async (member) => {
      logInfo('UnifiedMemberHandler', `🎯 ===== MEMBER JOIN EVENT TRIGGERED =====`);
      logInfo('UnifiedMemberHandler', `🎯 Member: ${member.user.tag} (${member.id})`);
      logInfo('UnifiedMemberHandler', `🎯 Guild: ${member.guild.name} (${member.guild.id})`);
      logInfo('UnifiedMemberHandler', `🎯 Member Count: ${member.guild.memberCount}`);
      logInfo('UnifiedMemberHandler', `🎯 Account Created: ${member.user.createdAt}`);
      logInfo('UnifiedMemberHandler', `🎯 Join Timestamp: ${new Date()}`);
      
      try {
        await handleMemberJoin(member);
        logInfo('UnifiedMemberHandler', `✅ Successfully processed member join for ${member.user.tag}`);
      } catch (error) {
        logError('UnifiedMemberHandler', `❌ Error in handleMemberJoin: ${error}`);
        // Log the full error details
        console.error('Full error details:', error);
      }
    });

    // Handle member leave - PROCESS EVEN IF PARTIAL
    client.on(Events.GuildMemberRemove, async (member) => {
      logInfo('UnifiedMemberHandler', `🎯 ===== MEMBER LEAVE EVENT TRIGGERED =====`);
      logInfo('UnifiedMemberHandler', `🎯 Member: ${member.user?.tag || member.id} (${member.id})`);
      logInfo('UnifiedMemberHandler', `🎯 Guild: ${member.guild?.name || 'Unknown'} (${member.guild?.id || 'Unknown'})`);
      logInfo('UnifiedMemberHandler', `🎯 Member is partial: ${member.partial}`);
      
      try {
        // Process both partial and non-partial members for goodbye messages
        await handleMemberLeave(member);
        logInfo('UnifiedMemberHandler', `✅ Successfully processed member leave for ${member.user?.tag || member.id}`);
      } catch (error) {
        logError('UnifiedMemberHandler', `❌ Error in handleMemberLeave: ${error}`);
        console.error('Full error details:', error);
      }
    });
    
    // Add a test to verify event registration
    logInfo('UnifiedMemberHandler', `🔍 Total event listeners registered for GuildMemberAdd: ${client.listenerCount(Events.GuildMemberAdd)}`);
    logInfo('UnifiedMemberHandler', `🔍 Total event listeners registered for GuildMemberRemove: ${client.listenerCount(Events.GuildMemberRemove)}`);
    
    logInfo('UnifiedMemberHandler', '✅ Unified member handler initialized successfully');

  } catch (error) {
    logError('UnifiedMemberHandler', `❌ Error initializing unified member handler: ${error}`);
    throw error;
  }
}

/**
 * Update member events configuration for a guild
 */
export async function updateMemberEventsConfig(
  guildId: string, 
  config: Partial<MemberEventConfig>
): Promise<boolean> {
  try {
    const serverSettings = await getServerSettings(guildId);
    if (!serverSettings) {
      logError('UnifiedMemberHandler', `No server settings found for guild ${guildId}`);
      return false;
    }

    // Get existing config
    const existingConfig = getMemberEventConfig(serverSettings);
    const newConfig = { ...existingConfig, ...config };

    // Update server settings with direct channel IDs for compatibility
    const updates: any = {};
    if (newConfig.welcome_channel_id !== undefined) {
      updates.welcome_channel_id = newConfig.welcome_channel_id;
    }
    if (newConfig.goodbye_channel_id !== undefined) {
      updates.goodbye_channel_id = newConfig.goodbye_channel_id;
    }
    if (newConfig.welcome_message !== undefined) {
      updates.welcome_message = newConfig.welcome_message;
    }
    
    // Store full config in member_events_config
    updates.member_events_config = JSON.stringify(newConfig);

    const { settingsManager } = await import('../../utils/settings');
    const success = await settingsManager.updateSettings(guildId, updates);
    
    if (success) {
      logInfo('UnifiedMemberHandler', `Updated member events configuration for guild ${guildId}`);
    }
    
    return success;
  } catch (error) {
    logError('UnifiedMemberHandler', `Error updating member events config: ${error}`);
    return false;
  }
}

// Export functions for backwards compatibility
export { handleMemberJoin, handleMemberLeave, getMemberEventConfig }; 