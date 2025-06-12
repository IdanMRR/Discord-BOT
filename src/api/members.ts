import express, { Request, Response } from 'express';
import { getClient } from '../utils/client-utils';
import { logInfo, logError } from '../utils/logger';
import { createModerationEmbed } from '../utils/embeds';
import { ServerSettingsService } from '../database/services/serverSettingsService';
import { WarningService } from '../database/services/sqliteService';
import { logModerationToDatabase } from '../utils/databaseLogger';
import { TextChannel, GuildMember, User } from 'discord.js';

const router = express.Router();

interface Member {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  displayName: string;
  nickname: string | null;
  joinedAt: string | null;
  roles: Array<{
    id: string;
    name: string;
    color: number;
    position: number;
  }>;
  permissions: string[];
  isBot: boolean;
  status: 'online' | 'offline' | 'idle' | 'dnd' | 'invisible';
  warningCount: number;
  lastActivity: string | null;
  dashboardPermissions: string[];
  dashboardAccess: boolean;
  dashboardRole: 'admin' | 'moderator' | 'user';
}

// Get all members for a server
router.get('/:serverId/members', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;
    const { page = '1', limit = '100', search = '', role = '', status = '', sort = 'joinedAt' } = req.query;
    
    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'Server ID is required'
      });
    }

    const client = getClient();
    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot is not ready'
      });
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Server not found'
      });
    }

    // Fetch all members if not cached
    await guild.members.fetch();

    let members = Array.from(guild.members.cache.values());

    // Apply filters
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      members = members.filter(member => 
        member.user.username.toLowerCase().includes(searchTerm) ||
        member.displayName.toLowerCase().includes(searchTerm) ||
        (member.nickname && member.nickname.toLowerCase().includes(searchTerm))
      );
    }

    if (role) {
      members = members.filter(member => 
        member.roles.cache.has(role as string)
      );
    }

    if (status) {
      members = members.filter(member => 
        member.presence?.status === status
      );
    }

    // Get warning counts for all members
    const memberWarningCounts = new Map<string, number>();
    for (const member of members) {
      try {
        const warnings = await WarningService.getWarnings(serverId, member.id, true);
        memberWarningCounts.set(member.id, warnings.data.length);
      } catch (error) {
        memberWarningCounts.set(member.id, 0);
      }
    }

    // Get dashboard permissions for all members
    const { getDashboardPermissions } = await import('../database/migrations/add-dashboard-permissions');
    
    // Transform members to our interface
    const transformedMembers: Member[] = members.map(member => {
      // Get dashboard permissions for this user
      const dashboardPermissions = getDashboardPermissions(member.id, serverId);
      
      return {
        id: member.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar: member.user.avatar,
        displayName: member.displayName,
        nickname: member.nickname,
        joinedAt: member.joinedAt?.toISOString() || null,
        roles: Array.from(member.roles.cache.values())
          .filter(role => role.name !== '@everyone')
          .map(role => ({
            id: role.id,
            name: role.name,
            color: role.color,
            position: role.position
          }))
          .sort((a, b) => b.position - a.position),
        permissions: member.permissions.toArray(),
        isBot: member.user.bot,
        status: member.presence?.status || 'offline',
        warningCount: memberWarningCounts.get(member.id) || 0,
        lastActivity: member.presence?.activities?.[0]?.createdAt?.toISOString() || null,
        dashboardPermissions: dashboardPermissions,
        dashboardAccess: dashboardPermissions.length > 0,
        dashboardRole: dashboardPermissions.includes('system_admin') ? 'admin' : 
                      dashboardPermissions.includes('manage_tickets') ? 'moderator' : 'user'
      };
    });

    // Sort based on the sort parameter
    const sortField = sort as string;
    transformedMembers.sort((a, b) => {
      switch (sortField) {
        case 'username':
          return a.username.localeCompare(b.username);
        case 'displayName':
          return a.displayName.localeCompare(b.displayName);
        case 'warningCount':
          return b.warningCount - a.warningCount;
        case 'status':
          return a.status.localeCompare(b.status);
        case 'joinedAt':
        default:
          if (!a.joinedAt) return 1;
          if (!b.joinedAt) return -1;
          return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
      }
    });

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedMembers = transformedMembers.slice(startIndex, endIndex);

    logInfo('Members API', `Retrieved ${paginatedMembers.length} members for server ${serverId}`);

    res.json({
      success: true,
      data: {
        members: paginatedMembers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: transformedMembers.length,
          pages: Math.ceil(transformedMembers.length / limitNum)
        },
        serverInfo: {
          name: guild.name,
          memberCount: guild.memberCount,
          icon: guild.icon
        }
      }
    });

  } catch (error) {
    logError('Members API', `Error getting members for server ${req.params.serverId}: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve server members'
    });
  }
});

// Get single member details
router.get('/:serverId/members/:memberId', async (req: Request, res: Response) => {
  try {
    const { serverId, memberId } = req.params;

    const client = getClient();
    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot is not ready'
      });
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Server not found'
      });
    }

    const member = await guild.members.fetch(memberId).catch(() => null);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    // Get member's warnings
    const warnings = await WarningService.getWarnings(serverId, memberId, undefined);
    
    // Get dashboard permissions for this user
    const { getDashboardPermissions } = await import('../database/migrations/add-dashboard-permissions');
    const dashboardPermissions = getDashboardPermissions(member.id, serverId);

    const memberData: Member & { warnings: any[] } = {
      id: member.id,
      username: member.user.username,
      discriminator: member.user.discriminator,
      avatar: member.user.avatar,
      displayName: member.displayName,
      nickname: member.nickname,
      joinedAt: member.joinedAt?.toISOString() || null,
      roles: Array.from(member.roles.cache.values())
        .filter(role => role.name !== '@everyone')
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position
        }))
        .sort((a, b) => b.position - a.position),
      permissions: member.permissions.toArray(),
      isBot: member.user.bot,
      status: member.presence?.status || 'offline',
      warningCount: warnings.data.length,
      lastActivity: member.presence?.activities?.[0]?.createdAt?.toISOString() || null,
      dashboardPermissions: dashboardPermissions,
      dashboardAccess: dashboardPermissions.length > 0,
      dashboardRole: dashboardPermissions.includes('system_admin') ? 'admin' : 
                    dashboardPermissions.includes('manage_tickets') ? 'moderator' : 'user',
      warnings: warnings.data
    };

    res.json({
      success: true,
      data: memberData
    });

  } catch (error) {
    logError('Members API', `Error getting member ${req.params.memberId}: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve member details'
    });
  }
});

// Kick member
router.post('/:serverId/members/:memberId/kick', async (req: Request, res: Response) => {
  try {
    const { serverId, memberId } = req.params;
    const { reason = 'No reason provided' } = req.body;

    const client = getClient();
    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot is not ready'
      });
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Server not found'
      });
    }

    const member = await guild.members.fetch(memberId).catch(() => null);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    // Check if member is kickable
    if (!member.kickable) {
      return res.status(403).json({
        success: false,
        error: 'Cannot kick this member (insufficient permissions or higher role)'
      });
    }

    // Perform the kick
    await member.kick(reason);

    // Log to database
    const moderator = { id: 'dashboard', tag: 'Dashboard User', username: 'Dashboard' } as User;
    await logModerationToDatabase({
      guild,
      action: 'kick',
      target: member.user,
      moderator,
      reason
    });

    // Log to mod log channel
    try {
      const settings = await ServerSettingsService.getServerSettings(serverId);
      if (settings?.mod_log_channel_id) {
        const modLogChannel = guild.channels.cache.get(settings.mod_log_channel_id) as TextChannel;
        if (modLogChannel?.isTextBased()) {
          const embed = createModerationEmbed({
            action: 'Kick',
            target: member.user,
            moderator,
            reason,
            additionalFields: [
              { name: 'Kicked Via', value: 'Dashboard', inline: true }
            ]
          });
          await modLogChannel.send({ embeds: [embed] });
        }
      }
         } catch (logErrorToChannel) {
       logError('Members API', `Failed to log kick to mod channel: ${logErrorToChannel}`);
     }

    logInfo('Members API', `Member ${member.user.tag} kicked from ${guild.name} via dashboard`);

    res.json({
      success: true,
      message: `Successfully kicked ${member.user.tag}`
    });

  } catch (error) {
    logError('Members API', `Error kicking member ${req.params.memberId}: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to kick member'
    });
  }
});

// Ban member
router.post('/:serverId/members/:memberId/ban', async (req: Request, res: Response) => {
  try {
    const { serverId, memberId } = req.params;
    const { reason = 'No reason provided', deleteMessageDays = 0 } = req.body;

    const client = getClient();
    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot is not ready'
      });
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Server not found'
      });
    }

    // Try to get member first, but proceed even if not found (for ban by ID)
    const member = await guild.members.fetch(memberId).catch(() => null);
    
    // Get user info for logging
    const user = member?.user || await client.users.fetch(memberId).catch(() => null);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if member is bannable (if they're still in the server)
    if (member && !member.bannable) {
      return res.status(403).json({
        success: false,
        error: 'Cannot ban this member (insufficient permissions or higher role)'
      });
    }

    // Perform the ban
    await guild.members.ban(user, {
      reason,
      deleteMessageDays: Math.min(Math.max(deleteMessageDays, 0), 7)
    });

    // Log to database
    const moderator = { id: 'dashboard', tag: 'Dashboard User', username: 'Dashboard' } as User;
    await logModerationToDatabase({
      guild,
      action: 'ban',
      target: user,
      moderator,
      reason
    });

    // Log to mod log channel
    try {
      const settings = await ServerSettingsService.getServerSettings(serverId);
      if (settings?.mod_log_channel_id) {
        const modLogChannel = guild.channels.cache.get(settings.mod_log_channel_id) as TextChannel;
        if (modLogChannel?.isTextBased()) {
          const embed = createModerationEmbed({
            action: 'Ban',
            target: user,
            moderator,
            reason,
            additionalFields: [
              { name: 'Banned Via', value: 'Dashboard', inline: true },
              { name: 'Message Days Deleted', value: deleteMessageDays.toString(), inline: true }
            ]
          });
          await modLogChannel.send({ embeds: [embed] });
        }
      }
         } catch (logErrorToChannel) {
       logError('Members API', `Failed to log ban to mod channel: ${logErrorToChannel}`);
     }

    logInfo('Members API', `User ${user.tag} banned from ${guild.name} via dashboard`);

    res.json({
      success: true,
      message: `Successfully banned ${user.tag}`
    });

  } catch (error) {
    logError('Members API', `Error banning member ${req.params.memberId}: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to ban member'
    });
  }
});

// Timeout member
router.post('/:serverId/members/:memberId/timeout', async (req: Request, res: Response) => {
  try {
    const { serverId, memberId } = req.params;
    const { reason = 'No reason provided', duration = 600000 } = req.body; // Default 10 minutes

    const client = getClient();
    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot is not ready'
      });
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Server not found'
      });
    }

    const member = await guild.members.fetch(memberId).catch(() => null);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    // Check if member is moderatable
    if (!member.moderatable) {
      return res.status(403).json({
        success: false,
        error: 'Cannot timeout this member (insufficient permissions or higher role)'
      });
    }

    // Perform the timeout
    const timeoutDuration = Math.min(Math.max(duration, 60000), 2419200000); // Min 1 minute, max 28 days
    await member.timeout(timeoutDuration, reason);

    // Log to database
    const moderator = { id: 'dashboard', tag: 'Dashboard User', username: 'Dashboard' } as User;
    await logModerationToDatabase({
      guild,
      action: 'timeout',
      target: member.user,
      moderator,
      reason,
      duration: `${Math.floor(timeoutDuration / 1000 / 60)} minutes`
    });

    // Log to mod log channel
    try {
      const settings = await ServerSettingsService.getServerSettings(serverId);
      if (settings?.mod_log_channel_id) {
        const modLogChannel = guild.channels.cache.get(settings.mod_log_channel_id) as TextChannel;
        if (modLogChannel?.isTextBased()) {
          const embed = createModerationEmbed({
            action: 'Timeout',
            target: member.user,
            moderator,
            reason,
            additionalFields: [
              { name: 'Duration', value: `${Math.floor(timeoutDuration / 1000 / 60)} minutes`, inline: true },
              { name: 'Timeout Via', value: 'Dashboard', inline: true }
            ]
          });
          await modLogChannel.send({ embeds: [embed] });
        }
      }
         } catch (logErrorToChannel) {
       logError('Members API', `Failed to log timeout to mod channel: ${logErrorToChannel}`);
     }

    logInfo('Members API', `Member ${member.user.tag} timed out in ${guild.name} via dashboard`);

    res.json({
      success: true,
      message: `Successfully timed out ${member.user.tag} for ${Math.floor(timeoutDuration / 1000 / 60)} minutes`
    });

  } catch (error) {
    logError('Members API', `Error timing out member ${req.params.memberId}: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to timeout member'
    });
  }
});

// Warn member
router.post('/:serverId/members/:memberId/warn', async (req: Request, res: Response) => {
  try {
    const { serverId, memberId } = req.params;
    const { reason = 'No reason provided' } = req.body;

    const client = getClient();
    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot is not ready'
      });
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Server not found'
      });
    }

    const member = await guild.members.fetch(memberId).catch(() => null);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

              // Create warning in database
     const warning = await WarningService.create({
       user_id: memberId,
       guild_id: serverId,
       moderator_id: 'dashboard',
       reason,
       active: true
     });

     if (!warning) {
       return res.status(500).json({
         success: false,
         error: 'Failed to create warning in database'
       });
     }

    // Log to database
    const moderator = { id: 'dashboard', tag: 'Dashboard User', username: 'Dashboard' } as User;
    await logModerationToDatabase({
      guild,
      action: 'warning',
      target: member.user,
      moderator,
      reason
    });

    // Log to mod log channel
    try {
      const settings = await ServerSettingsService.getServerSettings(serverId);
      if (settings?.mod_log_channel_id) {
        const modLogChannel = guild.channels.cache.get(settings.mod_log_channel_id) as TextChannel;
        if (modLogChannel?.isTextBased()) {
          const embed = createModerationEmbed({
            action: 'Warning',
            target: member.user,
            moderator,
            reason,
                         caseNumber: warning.id,
             additionalFields: [
               { name: 'Warning Via', value: 'Dashboard', inline: true },
               { name: 'Warning ID', value: warning.id?.toString() || 'Unknown', inline: true }
             ]
          });
          await modLogChannel.send({ embeds: [embed] });
        }
      }
         } catch (logErrorToChannel) {
       logError('Members API', `Failed to log warning to mod channel: ${logErrorToChannel}`);
    }

    logInfo('Members API', `Member ${member.user.tag} warned in ${guild.name} via dashboard`);

    res.json({
      success: true,
      message: `Successfully warned ${member.user.tag}`,
             data: {
         warningId: warning.id
       }
    });

  } catch (error) {
    logError('Members API', `Error warning member ${req.params.memberId}: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to warn member'
    });
  }
});

// Send DM to member
router.post('/:serverId/members/:memberId/dm', async (req: Request, res: Response) => {
  try {
    const { serverId, memberId } = req.params;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    const client = getClient();
    if (!client || !client.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Discord bot is not ready'
      });
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Server not found'
      });
    }

    const member = await guild.members.fetch(memberId).catch(() => null);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    if (member.user.bot) {
      return res.status(400).json({
        success: false,
        error: 'Cannot send DM to bot accounts'
      });
    }

    try {
      // Create DM embed
      const embed = createModerationEmbed({
        action: 'Direct Message',
        target: member.user,
        moderator: { id: 'dashboard', tag: 'Dashboard Staff', username: 'Dashboard' } as User,
        reason: message,
        additionalFields: [
          { name: 'Server', value: guild.name, inline: true },
          { name: 'Sent Via', value: 'Dashboard', inline: true }
        ]
      });

      // Send DM to user
      await member.send({ embeds: [embed] });

      logInfo('Members API', `DM sent to ${member.user.tag} from ${guild.name} via dashboard`);

      res.json({
        success: true,
        message: `Successfully sent DM to ${member.user.tag}`
      });

    } catch (dmError) {
      logError('Members API', `Failed to send DM to ${member.user.tag}: ${dmError}`);
      res.status(400).json({
        success: false,
        error: 'Failed to send DM. User may have DMs disabled or blocked the bot.'
      });
    }

  } catch (error) {
    logError('Members API', `Error sending DM to member ${req.params.memberId}: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to send DM'
    });
  }
});

export default router; 