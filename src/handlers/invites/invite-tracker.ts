import { 
  Client, 
  Guild, 
  GuildMember, 
  Collection, 
  Invite,
  EmbedBuilder,
  TextChannel,
  Events,
  ColorResolvable
} from 'discord.js';
import { logInfo, logError } from '../../utils/logger';
import { db } from '../../database/sqlite';

// Store guild invites and member join timestamps
const guildInvites = new Map<string, Collection<string, Invite>>();
const memberJoinTimestamps = new Map<string, Map<string, number>>();

// Track recently processed members to prevent duplicate messages
const recentlyProcessedMembers = new Map<string, Set<string>>();
const DUPLICATE_PREVENTION_TIMEOUT = 10000; // 10 seconds

// Constants for fake invite detection
const FAKE_INVITE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const FAKE_INVITE_LEAVE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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
      
      logInfo('InviteTracker', 'Created invite_tracking table with all required columns');
      return;
    }
    
    // If table exists, check if it has inviter_id column
    const hasInviterIdColumn = db.prepare("PRAGMA table_info(invite_tracking)").all()
      .some((col: any) => col.name === 'inviter_id');
    
    if (!hasInviterIdColumn) {
      // Add inviter_id column
      db.prepare(`ALTER TABLE invite_tracking ADD COLUMN inviter_id TEXT`).run();
      logInfo('InviteTracker', 'Added inviter_id column to invite_tracking table');
    }
  } catch (error) {
    logError('InviteTracker', `Error ensuring invite tracking schema: ${error}`);
  }
}

/**
 * Initialize the invite tracking system
 * @param client The Discord client
 */
export async function initializeInviteTracker(client: Client): Promise<void> {
  try {
    // Ensure database schema is correct
    await ensureInviteTrackingSchema();
    
    // When the bot is ready, cache all guild invites
    client.on(Events.ClientReady, async () => {
      await cacheAllGuildInvites(client);
      logInfo('InviteTracker', 'Invite tracking system initialized');
      
      // Set up a periodic refresh of the invite cache to keep it accurate
      setInterval(() => {
        cacheAllGuildInvites(client);
        logInfo('InviteTracker', 'Refreshed invite cache for all guilds');
      }, 10 * 60 * 1000); // Refresh every 10 minutes
    });

    // When the bot joins a new guild, cache its invites
    client.on(Events.GuildCreate, async (guild) => {
      if (guild.available) {
        await cacheGuildInvites(guild);
        logInfo('InviteTracker', `Cached invites for new guild: ${guild.name}`);
      }
    });

    // When a new invite is created, update the cache
    client.on(Events.InviteCreate, async (invite) => {
      if (!invite.guild) return;
      
      const guild = invite.guild;
      if ('invites' in guild) {
        try {
          const invites = await guild.invites.fetch();
          guildInvites.set(guild.id, invites);
          
          logInfo('InviteTracker', `Updated invite cache for guild ${guild.name} after new invite created`);
        } catch (error) {
          logError('InviteTracker', `Error updating invite cache: ${error}`);
        }
      }
    });

    // When an invite is deleted, update the cache
    client.on(Events.InviteDelete, async (invite) => {
      if (!invite.guild) return;
      
      const guild = invite.guild;
      if ('invites' in guild) {
        try {
          const invites = await guild.invites.fetch();
          guildInvites.set(guild.id, invites);
          
          logInfo('InviteTracker', `Updated invite cache for guild ${guild.name} after invite deleted`);
        } catch (error) {
          logError('InviteTracker', `Error updating invite cache: ${error}`);
        }
      }
    });

    // When a new member joins, track which invite they used
    client.on(Events.GuildMemberAdd, async (member) => {
      await trackMemberJoin(member);
    });

    // When a member leaves, log it
    client.on(Events.GuildMemberRemove, async (member) => {
      if (!member.partial) {
        await trackMemberLeave(member);
      } else {
        logInfo('InviteTracker', `Member leave event received but member is partial: ${member.id}`);
      }
    });

  } catch (error) {
    logError('InviteTracker', `Error initializing invite tracker: ${error}`);
  }
}

/**
 * Cache invites for all guilds
 * @param client The Discord client
 */
async function cacheAllGuildInvites(client: Client): Promise<void> {
  try {
    for (const guild of client.guilds.cache.values()) {
      await cacheGuildInvites(guild);
    }
    logInfo('InviteTracker', `Cached invites for ${client.guilds.cache.size} guilds`);
  } catch (error) {
    logError('InviteTracker', `Error caching all guild invites: ${error}`);
  }
}

/**
 * Cache invites for a specific guild
 * @param guild The guild to cache invites for
 */
async function cacheGuildInvites(guild: Guild): Promise<void> {
  try {
    if ('invites' in guild) {
      const invites = await guild.invites.fetch();
      guildInvites.set(guild.id, invites);
      logInfo('InviteTracker', `Cached ${invites.size} invites for guild ${guild.name}`);
    } else {
      logError('InviteTracker', `Guild does not have invites property`);
    }
  } catch (error) {
    logError('InviteTracker', `Error caching invites for guild ${guild.name}: ${error}`);
  }
}

/**
 * Track which invite was used when a member joins
 * @param member The member that joined
 */
async function trackMemberJoin(member: GuildMember): Promise<void> {
  try {
    const { guild } = member;
    
    // Create a unique key with timestamp for join events to prevent duplicates
    const timestamp = Date.now();
    const memberKey = `join-${guild.id}-${member.id}-${timestamp}`;
    
    // Initialize tracking set if needed
    if (!recentlyProcessedMembers.has(guild.id)) {
      recentlyProcessedMembers.set(guild.id, new Set());
    }
    
    // Check if we've processed this join event recently
    const recentEvents = Array.from(recentlyProcessedMembers.get(guild.id) || [])
      .filter(key => key.startsWith(`join-${guild.id}-${member.id}`));
    
    if (recentEvents.length > 0) {
      // If we've seen this member join in the last few seconds, skip to prevent duplicate processing
      const mostRecentEvent = recentEvents[recentEvents.length - 1];
      const mostRecentTimestamp = parseInt(mostRecentEvent.split('-')[3] || '0');
      
      if (timestamp - mostRecentTimestamp < DUPLICATE_PREVENTION_TIMEOUT) {
        logInfo('InviteTracker', `Skipping duplicate join processing for ${member.user.tag} (processed ${timestamp - mostRecentTimestamp}ms ago)`);
        return;
      }
    }
    
    // Mark this join as processed with the timestamp
    recentlyProcessedMembers.get(guild.id)!.add(memberKey);
    
    // Set a timeout to remove the member from the recently processed set
    setTimeout(() => {
      if (recentlyProcessedMembers.get(guild.id)) {
        recentlyProcessedMembers.get(guild.id)?.delete(memberKey);
      }
    }, DUPLICATE_PREVENTION_TIMEOUT);
    
    // Get the cached invites before the user joined
    const cachedInvites = guildInvites.get(guild.id);
    
    // If we don't have cached invites, fetch them now, but we may not be able to determine which invite was used
    if (!cachedInvites || cachedInvites.size === 0) {
      logInfo('InviteTracker', `No cached invites found for guild ${guild.name}, attempting to fetch them now`);
      await cacheGuildInvites(guild);
    }
    
    // Fetch the current invites after the user joined
    let currentInvites;
    try {
      currentInvites = await guild.invites.fetch();
    } catch (error) {
      logError('InviteTracker', `Error fetching current invites: ${error}`);
      currentInvites = new Collection<string, Invite>();
    }
    
    // Find the invite that was used by comparing the current invites with the cached ones
    let usedInvite: Invite | undefined;
    let inviter = 'Unknown';
    let inviterTag = 'Unknown';
    let inviterId = '';
    let inviteCode = 'unknown';
    
    // Try to detect the used invite
    if (cachedInvites && cachedInvites.size > 0 && currentInvites.size > 0) {
      logInfo('InviteTracker', `Comparing ${currentInvites.size} current invites with ${cachedInvites.size} cached invites`);
      
      // Compare each invite
      for (const [code, invite] of currentInvites) {
        const cachedInvite = cachedInvites.get(code);
        
        // If the invite uses increased or is new, it was likely used
        if (cachedInvite && invite.uses !== null && cachedInvite.uses !== null && invite.uses > cachedInvite.uses) {
          usedInvite = invite;
          inviteCode = invite.code;
          
          if (invite.inviter) {
            inviterTag = invite.inviter.tag;
            inviterId = invite.inviter.id;
            inviter = invite.inviter.tag;
            logInfo('InviteTracker', `Found used invite: ${invite.code} from ${inviter}, uses: ${cachedInvite.uses} -> ${invite.uses}`);
          } else {
            logInfo('InviteTracker', `Found used invite: ${invite.code} but inviter is null, uses: ${cachedInvite.uses} -> ${invite.uses}`);
          }
          break;
        }
      }
      
      // If we couldn't find a used invite by comparing uses, check for vanity URL
      if (!usedInvite) {
        // Check if this guild has a vanity URL
        if (guild.vanityURLCode) {
          inviter = 'Vanity URL';
          inviteCode = guild.vanityURLCode;
          logInfo('InviteTracker', `Member likely joined via vanity URL: ${guild.vanityURLCode}`);
        } else {
          // Check for new invites that weren't in the cache
          for (const [code, invite] of currentInvites) {
            if (!cachedInvites.has(code) && invite.uses && invite.uses > 0) {
              usedInvite = invite;
              inviteCode = invite.code;
              
              if (invite.inviter) {
                inviterTag = invite.inviter.tag;
                inviterId = invite.inviter.id;
                inviter = invite.inviter.tag;
                logInfo('InviteTracker', `Found new invite not in cache: ${invite.code} from ${inviter}, uses: ${invite.uses}`);
              }
              break;
            }
          }
          
          // If still not found, might be a direct join or OAuth
          if (!usedInvite) {
            logInfo('InviteTracker', `Couldn't determine invite used. Member may have joined via widget, OAuth, or direct link`);
          }
        }
      }
    } else {
      // If we have no cached invites to compare against
      logInfo('InviteTracker', `No cached invites to compare against. Using best effort detection.`);
      
      // Try to find a recently created invite with uses > 0 as a best guess
      usedInvite = Array.from(currentInvites.values())
        .sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0))
        .find(invite => invite.uses && invite.uses > 0);
        
      if (usedInvite) {
        inviteCode = usedInvite.code;
        if (usedInvite.inviter) {
          inviterTag = usedInvite.inviter.tag;
          inviterId = usedInvite.inviter.id;
          inviter = usedInvite.inviter.tag;
          logInfo('InviteTracker', `Best guess invite: ${usedInvite.code} from ${inviter}`);
        }
      }
    }
    
    // Update the cache with current invites
    guildInvites.set(guild.id, currentInvites);
    
    // Check for member logs channel - our primary target for logs
    const memberLogsChannel = await getMemberLogsChannel(guild.id);
    
    // Check if we have member logs channel to send to
    if (!memberLogsChannel) {
      logInfo('InviteTracker', `No member logs channel configured for guild ${guild.name} - skipping join message`);
      
      // Still store the data even if we can't send a message
      storeInviteData(guild.id, member.id, inviteCode, inviter, inviterId);
      return;
    }
    
    // Get guild stats
    const totalMembers = guild.memberCount;
    const regularMembers = guild.members.cache.filter(m => !m.user.bot).size;
    const botMembers = guild.members.cache.filter(m => m.user.bot).size;
    
    // Get invite statistics
    const inviteStats = await getInviteStats(guild.id);
    
    // Store join timestamp for fake invite detection
    if (!memberJoinTimestamps.has(guild.id)) {
      memberJoinTimestamps.set(guild.id, new Map());
    }
    memberJoinTimestamps.get(guild.id)!.set(member.id, Date.now());
    
    // Create join embed with proper inviter information
    const joinEmbed = new EmbedBuilder()
      .setColor('#43b581' as ColorResolvable) // Green color for joins
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
        {
          name: 'Invite Code',
          value: inviteCode !== 'unknown' ? inviteCode : 'Could not determine invite',
          inline: true
        },
        { 
          name: 'Server Stats', 
          value: `• **${totalMembers}** total members\n• **${regularMembers}** regular members\n• **${botMembers}** bots\n• **${inviteStats.totalInvites}** total invites`,
          inline: false 
        }
      ])
      .setFooter({ text: `Made By Soggra • Member ID: ${member.id}` })
      .setTimestamp();
    
    // Send join message to member logs channel
    try {
      await memberLogsChannel.send({ embeds: [joinEmbed] });
      logInfo('InviteTracker', `Sent join message to member logs channel for ${member.user.tag}`);
    } catch (error) {
      logError('InviteTracker', `Error sending join message to member logs: ${error}`);
    }
    
    // Log the join and store the invite data
    logInfo('InviteTracker', `Member ${member.user.tag} joined using invite from ${inviter}`);
    storeInviteData(guild.id, member.id, inviteCode, inviter, inviterId);
    
  } catch (error) {
    logError('InviteTracker', `Error tracking member join: ${error}`);
  }
}

/**
 * Get invite data for a user
 * @param guildId The guild ID
 * @param userId The user ID
 * @returns The invite data or undefined
 */
async function getInviteData(guildId: string, userId: string): Promise<{ 
  invite_code: string, 
  inviter: string, 
  inviter_id?: string,
  joined_at?: Date
} | undefined> {
  try {
    // Get the invite data from the database
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
    logError('InviteTracker', `Error getting invite data: ${error}`);
    return undefined;
  }
}

/**
 * Track when a member leaves
 * @param member The member that left
 */
async function trackMemberLeave(member: GuildMember): Promise<void> {
  try {
    const { guild } = member;
    
    // Create a unique key for this member leave event with timestamp to prevent true duplicates
    // while still allowing the same member to be processed if they leave multiple times
    const timestamp = Date.now();
    const memberKey = `leave-${guild.id}-${member.id}-${timestamp}`;
    
    // Initialize the tracking set if it doesn't exist
    if (!recentlyProcessedMembers.has(guild.id)) {
      recentlyProcessedMembers.set(guild.id, new Set());
    }
    
    // Check if we've processed this exact event recently
    const recentEvents = Array.from(recentlyProcessedMembers.get(guild.id) || [])
      .filter(key => key.startsWith(`leave-${guild.id}-${member.id}`));
    
    if (recentEvents.length > 0) {
      // If we've seen this member leave in the last few seconds, skip to prevent duplicate processing
      const mostRecentEvent = recentEvents[recentEvents.length - 1];
      const mostRecentTimestamp = parseInt(mostRecentEvent.split('-')[3] || '0');
      
      if (timestamp - mostRecentTimestamp < DUPLICATE_PREVENTION_TIMEOUT) {
        logInfo('InviteTracker', `Skipping duplicate leave processing for ${member.user.tag} (processed ${timestamp - mostRecentTimestamp}ms ago)`);
        return;
      }
    }
    
    // Mark this member leave as recently processed with the unique key
    recentlyProcessedMembers.get(guild.id)!.add(memberKey);
    
    // Set a timeout to remove the member from the recently processed set
    setTimeout(() => {
      if (recentlyProcessedMembers.get(guild.id)) {
        recentlyProcessedMembers.get(guild.id)?.delete(memberKey);
      }
    }, DUPLICATE_PREVENTION_TIMEOUT);
    
    // Get the member logs channel - this should be the primary channel for leave messages
    const memberLogsChannel = await getMemberLogsChannel(guild.id);
    
    // If member logs channel doesn't exist, log it but don't fall back to welcome channel
    if (!memberLogsChannel) {
      logInfo('InviteTracker', `No member logs channel configured for guild ${guild.name} - skipping leave message`);
      return;
    }
    
    // Get the full invite data from the database with all available information
    const inviteData = await getInviteData(guild.id, member.id);
    const inviter = inviteData?.inviter || 'Unknown';
    const inviterId = inviteData?.inviter_id || undefined;
    const inviteCode = inviteData?.invite_code || 'Unknown';
    
    // Get guild stats
    const totalMembers = guild.memberCount;
    const regularMembers = guild.members.cache.filter(m => !m.user.bot).size;
    const botMembers = guild.members.cache.filter(m => m.user.bot).size;
    
    // Check if this might be a fake invite (user joined and left quickly)
    let isFakeInvite = false;
    let timeInServer = 'Unknown';
    let joinDate = 'Unknown';
    
    // IMPORTANT: Prioritize join date detection to fix the "Unknown" issue
    
    // First check stored join timestamp from our tracking
    const joinTimestamp = memberJoinTimestamps.get(guild.id)?.get(member.id);
    
    if (joinTimestamp) {
      const timeSpentMs = Date.now() - joinTimestamp;
      timeInServer = formatTimeSpent(timeSpentMs);
      joinDate = `<t:${Math.floor(joinTimestamp / 1000)}:F>`;
      
      if (timeSpentMs < FAKE_INVITE_THRESHOLD_MS) {
        isFakeInvite = true;
        logInfo('InviteTracker', `Possible fake invite detected: ${member.user.tag} was in the server for only ${timeInServer}`);
        
        // Update the fake invite count in the database if we have an inviter
        if (inviter !== 'Unknown') {
          await updateFakeInviteCount(guild.id, inviter);
        }
      }
    } 
    // Fall back to join date from GuildMember object
    else if (member.joinedAt) {
      const timeSpentMs = Date.now() - member.joinedAt.getTime();
      timeInServer = formatTimeSpent(timeSpentMs);
      joinDate = `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>`;
      
      if (timeSpentMs < FAKE_INVITE_THRESHOLD_MS) {
        isFakeInvite = true;
        logInfo('InviteTracker', `Possible fake invite detected: ${member.user.tag} was in the server for only ${timeInServer}`);
        
        // Update the fake invite count in the database if we have an inviter
        if (inviter !== 'Unknown') {
          await updateFakeInviteCount(guild.id, inviter);
        }
      }
    }
    // As a last resort, try the joined_at from the invite tracking data
    else if (inviteData?.joined_at) {
      const timeSpentMs = Date.now() - inviteData.joined_at.getTime();
      timeInServer = formatTimeSpent(timeSpentMs);
      joinDate = `<t:${Math.floor(inviteData.joined_at.getTime() / 1000)}:F>`;
      
      if (timeSpentMs < FAKE_INVITE_THRESHOLD_MS) {
        isFakeInvite = true;
        logInfo('InviteTracker', `Possible fake invite detected: ${member.user.tag} was in the server for only ${timeInServer}`);
        
        // Update the fake invite count in the database if we have an inviter
        if (inviter !== 'Unknown') {
          await updateFakeInviteCount(guild.id, inviter);
        }
      }
    } else {
      // If we have absolutely no join date information, use a clear message
      joinDate = "Could not determine join date";
      timeInServer = "Unknown - join date not available";
    }
    
    // Get invite statistics including fake invites count
    const inviteStats = await getInviteStats(guild.id);
    
    // Create leave embed with detailed information
    const leaveEmbed = new EmbedBuilder()
      .setColor(isFakeInvite ? '#FF0000' : '#FF6347') // Red for fake invites, lighter red for normal leaves
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
        { 
          name: 'Server Stats', 
          value: `• **${totalMembers}** total members\n• **${regularMembers}** regular members\n• **${botMembers}** bots\n• **${inviteStats.totalInvites}** total invites\n• **${inviteStats.fakeInvites || 0}** fake invites`,
          inline: false 
        }
      ])
      .setFooter({ text: `Made By Soggra • Member ID: ${member.id}` })
      .setTimestamp();
    
    // Add warning about potential fake invite
    if (isFakeInvite) {
      leaveEmbed.addFields([
        { 
          name: '⚠️ Fake Invite Warning', 
          value: `This user left shortly after joining (${timeInServer}), which may indicate a fake invite.`,
          inline: false 
        }
      ]);
    }
    
    // Send the embed to the member logs channel
    try {
      await memberLogsChannel.send({ embeds: [leaveEmbed] });
      logInfo('InviteTracker', `Sent leave message for ${member.user.tag} in guild ${guild.name} (Member Logs)`);
    } catch (error) {
      logError('InviteTracker', `Error sending leave message to member logs: ${error}`);
    }
    
    // Remove member from the join timestamps map
    memberJoinTimestamps.get(guild.id)?.delete(member.id);
    
  } catch (error) {
    logError('InviteTracker', `Error tracking member leave: ${error}`);
  }
}

/**
 * Format milliseconds to a human-readable time spent string
 * @param ms Time in milliseconds
 * @returns Formatted time string (e.g., "2 days, 3 hours, 45 minutes")
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
 * Get the welcome channel for a guild
 * @param guildId The guild ID
 * @returns The welcome channel, or undefined if not found
 */
async function getWelcomeChannel(guildId: string): Promise<TextChannel | undefined> {
  try {
    // Check if server_settings has member_events_config column
    const hasColumn = db.prepare("PRAGMA table_info(server_settings)").all()
      .some((col: any) => col.name === 'member_events_config');
    
    if (!hasColumn) {
      return undefined;
    }
    
    // Get from database
    const stmt = db.prepare(`SELECT member_events_config FROM server_settings WHERE guild_id = ?`);
    const result = stmt.get(guildId) as { member_events_config: string } | undefined;
    
    // Get welcome channel from member_events_config
    if (result && result.member_events_config) {
      try {
        const config = JSON.parse(result.member_events_config);
        if (config.welcome_channel_id) {
          // Import client utils dynamically
          const { getClient } = await import('../../utils/client-utils');
          const client = getClient();
          
          if (!client) {
            logError('InviteTracker', 'Discord client is not initialized');
            return undefined;
          }
          
          const guild = await client.guilds.fetch(guildId);
          const channel = await guild.channels.fetch(config.welcome_channel_id);
          
          if (channel && channel.isTextBased()) {
            logInfo('InviteTracker', `Using welcome channel ${channel.name} for member joins`);
            return channel as TextChannel;
          }
        }
      } catch (parseError) {
        logError('InviteTracker', `Error parsing member event configuration: ${parseError}`);
      }
    }
    
    return undefined;
  } catch (error) {
    logError('InviteTracker', `Error getting welcome channel: ${error}`);
    return undefined;
  }
}

/**
 * Get the member logs channel for a guild
 * @param guildId The guild ID
 * @returns The member logs channel, or undefined if not found
 */
async function getMemberLogsChannel(guildId: string): Promise<TextChannel | undefined> {
  try {
    // Import settings manager dynamically
    const { settingsManager } = await import('../../utils/settings');
    const serverSettings = await settingsManager.getSettings(guildId);
    
    if (serverSettings && serverSettings.member_log_channel_id) {
      // Import client utils dynamically
      const { getClient } = await import('../../utils/client-utils');
      const client = getClient();
      
      if (!client) {
        logError('InviteTracker', 'Discord client is not initialized');
        return undefined;
      }
      
      try {
        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(serverSettings.member_log_channel_id).catch(error => {
          if (error.code === 10003) { // Unknown Channel error code
            logError('InviteTracker', `Member logs channel ${serverSettings.member_log_channel_id} not found in guild ${guild.id} - fixing settings`);
            
            // Update settings to remove invalid channel
            serverSettings.member_log_channel_id = undefined;
            settingsManager.updateSettings(guildId, serverSettings).catch(err => {
              logError('InviteTracker', `Error updating server settings: ${err}`);
            });
          } else {
            logError('InviteTracker', `Error fetching member logs channel: ${error}`);
          }
          return null;
        });
        
        if (channel && channel.isTextBased()) {
          return channel as TextChannel;
        } else if (channel) {
          logError('InviteTracker', `Member logs channel ${serverSettings.member_log_channel_id} is not a text channel in guild ${guild.id}`);
          
          // Update settings to remove invalid channel
          serverSettings.member_log_channel_id = undefined;
          await settingsManager.updateSettings(guildId, serverSettings);
        }
      } catch (error: any) {
        if (error.code === 10003) { // Unknown Channel error code
          logError('InviteTracker', `Error fetching member logs channel: DiscordAPIError[10003]: Unknown Channel`);
          
          // Update settings to remove invalid channel
          serverSettings.member_log_channel_id = undefined;
          await settingsManager.updateSettings(guildId, serverSettings);
        } else {
          logError('InviteTracker', `Error fetching member logs channel: ${error}`);
        }
      }
    }
    
    return undefined;
  } catch (error) {
    logError('InviteTracker', `Error getting member logs channel: ${error}`);
    return undefined;
  }
}

/**
 * Store invite data in the database with enhanced user statistics
 * @param guildId The guild ID
 * @param userId The user ID
 * @param inviteCode The invite code
 * @param inviter The inviter
 * @param inviterId The inviter ID
 */
function storeInviteData(guildId: string, userId: string, inviteCode: string, inviter: string, inviterId: string): void {
  try {
    // Insert the invite data with current timestamp
    db.prepare(`
      INSERT INTO invite_tracking (guild_id, user_id, invite_code, inviter, inviter_id, joined_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(guildId, userId, inviteCode, inviter, inviterId);
    
    logInfo('InviteTracker', `Stored invite data for user ${userId} in guild ${guildId}`);
  } catch (error) {
    logError('InviteTracker', `Error storing invite data: ${error}`);
  }
}

/**
 * Get the inviter for a user
 * @param guildId The guild ID
 * @param userId The user ID
 * @returns The inviter, or undefined if not found
 */
async function getInviter(guildId: string, userId: string): Promise<string | undefined> {
  try {
    // Check if invite_tracking table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invite_tracking'").get();
    
    if (!tableExists) {
      return undefined;
    }
    
    // Get the inviter
    const stmt = db.prepare(`
      SELECT inviter FROM invite_tracking
      WHERE guild_id = ? AND user_id = ?
      ORDER BY joined_at DESC
      LIMIT 1
    `);
    
    const result = stmt.get(guildId, userId) as { inviter: string } | undefined;
    
    return result?.inviter;
  } catch (error) {
    logError('InviteTracker', `Error getting inviter: ${error}`);
    return undefined;
  }
}

/**
 * Update the fake invite count for an inviter
 * @param guildId The guild ID
 * @param inviter The inviter tag
 */
async function updateFakeInviteCount(guildId: string, inviter: string): Promise<void> {
  try {
    // Check if fake_invites table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fake_invites'").get();
    
    if (!tableExists) {
      // Create the table if it doesn't exist
      db.prepare(`
        CREATE TABLE fake_invites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          inviter TEXT NOT NULL,
          count INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      
      logInfo('InviteTracker', 'Created fake_invites table');
    }
    
    // Check if the inviter already has fake invites
    const stmt = db.prepare(`
      SELECT id, count FROM fake_invites
      WHERE guild_id = ? AND inviter = ?
    `);
    
    const result = stmt.get(guildId, inviter) as { id: number, count: number } | undefined;
    
    if (result) {
      // Update the count
      db.prepare(`
        UPDATE fake_invites
        SET count = count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(result.id);
    } else {
      // Insert a new record
      db.prepare(`
        INSERT INTO fake_invites (guild_id, inviter, count)
        VALUES (?, ?, 1)
      `).run(guildId, inviter);
    }
    
    logInfo('InviteTracker', `Updated fake invite count for ${inviter} in guild ${guildId}`);
  } catch (error) {
    logError('InviteTracker', `Error updating fake invite count: ${error}`);
  }
}

/**
 * Get invite statistics for a guild
 * @param guildId The guild ID
 * @returns The invite statistics
 */
export async function getInviteStats(guildId: string): Promise<{ 
  totalInvites: number, 
  topInviters: { inviter: string, count: number }[],
  fakeInvites: number
}> {
  try {
    // Check if invite_tracking table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invite_tracking'").get();
    
    if (!tableExists) {
      return { totalInvites: 0, topInviters: [], fakeInvites: 0 };
    }
    
    // Get the total invites
    const totalStmt = db.prepare(`
      SELECT COUNT(*) as count FROM invite_tracking
      WHERE guild_id = ?
    `);
    
    const totalResult = totalStmt.get(guildId) as { count: number } | undefined;
    const totalInvites = totalResult?.count || 0;
    
    // Get the top inviters
    const topStmt = db.prepare(`
      SELECT inviter, COUNT(*) as count FROM invite_tracking
      WHERE guild_id = ?
      GROUP BY inviter
      ORDER BY count DESC
      LIMIT 5
    `);
    
    const topResults = topStmt.all(guildId) as { inviter: string, count: number }[];
    
    // Get the total fake invites
    let fakeInvites = 0;
    try {
      // Check if fake_invites table exists
      const fakeTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fake_invites'").get();
      
      if (fakeTableExists) {
        const fakeTotalStmt = db.prepare(`
          SELECT SUM(count) as count FROM fake_invites
          WHERE guild_id = ?
        `);
        
        const fakeTotalResult = fakeTotalStmt.get(guildId) as { count: number } | undefined;
        fakeInvites = fakeTotalResult?.count || 0;
      }
    } catch (fakeError) {
      logError('InviteTracker', `Error getting fake invite count: ${fakeError}`);
    }
    
    return { 
      totalInvites, 
      topInviters: topResults,
      fakeInvites
    };
  } catch (error) {
    logError('InviteTracker', `Error getting invite stats: ${error}`);
    return { totalInvites: 0, topInviters: [], fakeInvites: 0 };
  }
}

/**
 * Send example invite tracking logs to member logs channel for server setup
 * @param guildId The guild ID
 */
export async function sendInviteTrackingExamples(guildId: string): Promise<void> {
  try {
    const memberLogsChannel = await getMemberLogsChannel(guildId);
    
    if (!memberLogsChannel) {
      logInfo('InviteTracker', `No member logs channel found for guild ${guildId} - skipping examples`);
      return;
    }
    
    // Configuration info embed
    const configEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('👋 Invite Tracking Configuration')
      .setDescription(`This channel will receive all member join and leave logs with invite information.`)
      .addFields([
        { 
          name: 'Invite Tracking', 
          value: 'The bot will track which invites are used when members join the server.' 
        },
        { 
          name: 'Join Logs', 
          value: 'You will see who invited each new member, along with server stats.'
        },
        { 
          name: 'Leave Logs', 
          value: 'When members leave, you will see who invited them and if they might be fake invites.'
        }
      ])
      .setFooter({ text: '• Made By Soggra' })
      .setTimestamp();
    
    // Example join log
    const joinExampleEmbed = new EmbedBuilder()
      .setColor('#43b581')
      .setTitle('🎉 New Member Joined')
      .setDescription(`**User:** Example User#1234 (<@123456789012345678>)`)
      .addFields([
        { name: 'User ID', value: '123456789012345678', inline: true },
        { name: 'Account Age', value: '365 days', inline: true },
        { name: 'Created On', value: 'January 1, 2023', inline: false },
        { name: 'Invited By', value: 'Server Admin (<@987654321098765432>)', inline: false },
        { name: 'Server Stats', value: '• **100** total members\n• **95** regular members\n• **5** bots\n• **25** total invites', inline: false }
      ])
      .setFooter({ text: '• Made By Soggra' })
      .setTimestamp();
    
    // Example leave log
    const leaveExampleEmbed = new EmbedBuilder()
      .setColor('#FF6347')
      .setTitle('👋 Member Left')
      .setDescription(`**User:** Example User#1234 (<@123456789012345678>)`)
      .addFields([
        { name: 'User ID', value: '123456789012345678', inline: true },
        { name: 'Invite Code', value: 'abc123', inline: true },
        { name: 'Invited By', value: 'Server Admin (<@987654321098765432>)', inline: true },
        { name: 'Joined Server', value: '3 days ago', inline: true },
        { name: 'Time in Server', value: '3 days, 6 hours', inline: true },
        { name: 'Server Stats', value: '• **99** total members\n• **94** regular members\n• **5** bots\n• **25** total invites\n• **0** fake invites', inline: false }
      ])
      .setFooter({ text: '• Made By Soggra' })
      .setTimestamp();
    
    // Send all examples
    await memberLogsChannel.send({ embeds: [configEmbed] });
    await memberLogsChannel.send({ embeds: [joinExampleEmbed] });
    await memberLogsChannel.send({ embeds: [leaveExampleEmbed] });
    
    logInfo('InviteTracker', `Sent invite tracking examples to member logs channel in ${memberLogsChannel.guild.name}`);
  } catch (error) {
    logError('InviteTracker', `Error sending invite tracking examples: ${error}`);
  }
}
