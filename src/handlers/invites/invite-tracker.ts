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

// Constants for fake invite detection
const FAKE_INVITE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const FAKE_INVITE_LEAVE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Initialize the invite tracking system
 * @param client The Discord client
 */
export async function initializeInviteTracker(client: Client): Promise<void> {
  try {
    // When the bot is ready, cache all guild invites
    client.on(Events.ClientReady, async () => {
      await cacheAllGuildInvites(client);
      logInfo('InviteTracker', 'Invite tracking system initialized');
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
        const invites = await guild.invites.fetch();
        guildInvites.set(guild.id, invites);
        
        logInfo('InviteTracker', `Updated invite cache for guild ${guild.name} after new invite created`);
      }
    });

    // When an invite is deleted, update the cache
    client.on(Events.InviteDelete, async (invite) => {
      if (!invite.guild) return;
      
      const guild = invite.guild;
      if ('invites' in guild) {
        const invites = await guild.invites.fetch();
        guildInvites.set(guild.id, invites);
        
        logInfo('InviteTracker', `Updated invite cache for guild ${guild.name} after invite deleted`);
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
    
    // Get the cached invites
    const cachedInvites = guildInvites.get(guild.id);
    if (!cachedInvites) {
      logError('InviteTracker', `No cached invites found for guild ${guild.name}`);
      return;
    }
    
    // Fetch the current invites
    const currentInvites = await guild.invites.fetch();
    
    // Find the invite that was used
    let usedInvite: Invite | undefined;
    let inviter: string = 'Unknown';
    
    // Compare the current invites with the cached ones to find which one was used
    cachedInvites.forEach(invite => {
      const currentInvite = currentInvites.get(invite.code);
      // If the current invite has more uses than the cached one, it was used
      if (currentInvite && currentInvite.uses && invite.uses && (currentInvite.uses > invite.uses)) {
        usedInvite = currentInvite;
        inviter = currentInvite.inviter?.tag || 'Unknown';
      }
    });
    
    // Update the cache
    guildInvites.set(guild.id, currentInvites);
    
    // Get the welcome channel
    const welcomeChannel = await getWelcomeChannel(guild.id);
    if (!welcomeChannel) {
      logInfo('InviteTracker', `No welcome channel configured for guild ${guild.name}`);
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
    
    // Create the join message with improved styling
    const joinEmbed = new EmbedBuilder()
      .setColor('#43b581' as ColorResolvable) // Green color for joins
      .setAuthor({ 
        name: `${member.user.tag} joined`, 
        iconURL: member.user.displayAvatarURL() 
      })
      .setDescription(`
**→ Invited by:** ${inviter}

**Server Stats:**
• **${totalMembers}** total members
• **${regularMembers}** regular members
• **${botMembers}** bots
• **${inviteStats.totalInvites}** total invites
• **${inviteStats.fakeInvites || 0}** fake invites
      `)
      .setFooter({ text: `Member ID: ${member.id} • Made By Soggra` })
      .setTimestamp();
    
    // Send the join message
    await welcomeChannel.send({ embeds: [joinEmbed] });
    
    // Log the join
    logInfo('InviteTracker', `Member ${member.user.tag} joined using invite from ${inviter}`);
    
    // Store the invite data in the database
    storeInviteData(guild.id, member.id, usedInvite?.code || 'unknown', inviter);
    
  } catch (error) {
    logError('InviteTracker', `Error tracking member join: ${error}`);
  }
}

/**
 * Track when a member leaves
 * @param member The member that left
 */
async function trackMemberLeave(member: GuildMember): Promise<void> {
  try {
    const { guild } = member;
    
    // Get the welcome channel
    const welcomeChannel = await getWelcomeChannel(guild.id);
    if (!welcomeChannel) {
      logInfo('InviteTracker', `No welcome channel configured for guild ${guild.name}`);
      return;
    }
    
    // Get the inviter from the database
    const inviter = await getInviter(guild.id, member.id) || 'Unknown';
    
    // Get guild stats
    const totalMembers = guild.memberCount;
    const regularMembers = guild.members.cache.filter(m => !m.user.bot).size;
    const botMembers = guild.members.cache.filter(m => m.user.bot).size;
    
    // Check if this might be a fake invite (user joined and left quickly)
    let isFakeInvite = false;
    const joinTimestamp = memberJoinTimestamps.get(guild.id)?.get(member.id);
    
    if (joinTimestamp) {
      const timeOnServer = Date.now() - joinTimestamp;
      if (timeOnServer < FAKE_INVITE_LEAVE_THRESHOLD_MS) {
        isFakeInvite = true;
        // Update the fake invite count in the database
        await updateFakeInviteCount(guild.id, inviter);
      }
      
      // Clean up the timestamp
      memberJoinTimestamps.get(guild.id)?.delete(member.id);
    }
    
    // Get invite statistics
    const inviteStats = await getInviteStats(guild.id);
    
    // Create the leave message with improved styling
    const leaveEmbed = new EmbedBuilder()
      .setColor('#f04747' as ColorResolvable) // Red color for leaves
      .setAuthor({ 
        name: `${member.user.tag} left`, 
        iconURL: member.user.displayAvatarURL() 
      })
      .setDescription(`
**← Invited by:** ${inviter}
${isFakeInvite ? '**⚠️ Possible fake invite detected!**\n' : ''}
**Server Stats:**
• **${totalMembers}** total members
• **${regularMembers}** regular members
• **${botMembers}** bots
• **${inviteStats.totalInvites}** total invites
• **${inviteStats.fakeInvites || 0}** fake invites
      `)
      .setFooter({ text: `Member ID: ${member.id} • Made By Soggra` })
      .setTimestamp();
    
    // Send the leave message
    await welcomeChannel.send({ embeds: [leaveEmbed] });
    
    // Log the leave
    logInfo('InviteTracker', `Member ${member.user.tag} left`);
    
  } catch (error) {
    logError('InviteTracker', `Error tracking member leave: ${error}`);
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
    const stmt = db.prepare(`
      SELECT member_events_config FROM server_settings WHERE guild_id = ?
    `);
    
    const result = stmt.get(guildId) as { member_events_config: string } | undefined;
    
    if (result && result.member_events_config) {
      try {
        const config = JSON.parse(result.member_events_config);
        if (config.welcome_channel_id) {
          const client = require('../../index').client;
          const guild = await client.guilds.fetch(guildId);
          const channel = await guild.channels.fetch(config.welcome_channel_id);
          
          if (channel && channel.isTextBased()) {
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
 * Store invite data in the database with enhanced user statistics
 * @param guildId The guild ID
 * @param userId The user ID
 * @param inviteCode The invite code
 * @param inviter The inviter
 */
function storeInviteData(guildId: string, userId: string, inviteCode: string, inviter: string): void {
  try {
    // Check if invite_tracking table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invite_tracking'").get();
    
    if (!tableExists) {
      // Create the table if it doesn't exist
      db.prepare(`
        CREATE TABLE invite_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          invite_code TEXT,
          inviter TEXT,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      
      logInfo('InviteTracker', 'Created invite_tracking table');
    }
    
    // Insert the invite data
    db.prepare(`
      INSERT INTO invite_tracking (guild_id, user_id, invite_code, inviter)
      VALUES (?, ?, ?, ?)
    `).run(guildId, userId, inviteCode, inviter);
    
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
 * Get invite statistics for a guild
 * @param guildId The guild ID
 * @returns The invite statistics
 */
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
