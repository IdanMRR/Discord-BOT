import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  User
} from 'discord.js';
import { db } from '../../database/sqlite';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { Colors } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
  .setName('invites')
  .setDescription('See how many users you or someone else has invited')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to check invites for (defaults to you)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();
    
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const { guild } = interaction;
    
    if (!guild) {
      await interaction.editReply({
        content: '❌ This command can only be used in a server.'
      });
      return;
    }

    // Log command usage
    await logCommandUsage({
      guild,
      user: interaction.user,
      command: 'invites',
      options: targetUser !== interaction.user ? { user: targetUser.tag } : {},
      channel: interaction.channel,
      success: true
    });

    // Get invites for the user
    const inviteStats = await getUserInvites(guild.id, targetUser.id);
    const guildMember = await guild.members.fetch(targetUser.id).catch(() => null);
    
    // Create embed
    const invitesEmbed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle(`Invite Stats for ${targetUser.tag}`)
      .setDescription(`Here are the invite stats for ${targetUser}:`)
      .addFields([
        { 
          name: '📊 Statistics', 
          value: [
            `**${inviteStats.total}** total invites`,
            `**${inviteStats.valid}** valid invites`,
            `**${inviteStats.fake}** fake invites (left server too quickly)`,
            `**${inviteStats.left}** left (invited users who left)`
          ].join('\n'),
          inline: false
        }
      ])
      .setFooter({ text: `• Made By Soggra` })
      .setTimestamp();
    
    // If we have the member object, add their avatar
    if (guildMember && guildMember.displayAvatarURL()) {
      invitesEmbed.setThumbnail(guildMember.displayAvatarURL());
    }
    
    // List recent invites if available
    if (inviteStats.recentInvites.length > 0) {
      const recentInvitesText = inviteStats.recentInvites
        .map(invite => `• <@${invite.userId}> - <t:${Math.floor(new Date(invite.joinedAt).getTime() / 1000)}:R>`)
        .join('\n');
      
      invitesEmbed.addFields([
        { 
          name: '🔍 Recent Invites', 
          value: recentInvitesText.length > 0 ? recentInvitesText : 'No recent invites found.',
          inline: false
        }
      ]);
    }
    
    await interaction.editReply({ embeds: [invitesEmbed] });
  } catch (error) {
    logError('InvitesCommand', `Error executing invites command: ${error}`);
    await interaction.editReply({ 
      content: '❌ An error occurred while fetching invite information. Please try again later.' 
    }).catch(() => {});
  }
}

/**
 * Get invite statistics for a specific user
 * @param guildId The guild ID
 * @param userId The user ID to get invites for
 */
async function getUserInvites(
  guildId: string, 
  userId: string
): Promise<{
  total: number;
  valid: number;
  fake: number;
  left: number;
  recentInvites: Array<{
    userId: string;
    joinedAt: string;
  }>;
}> {
  try {
    // Ensure database table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='invite_tracking'
    `).get();
    
    if (!tableExists) {
      return {
        total: 0,
        valid: 0,
        fake: 0,
        left: 0,
        recentInvites: []
      };
    }
    
    // Try to check if inviter_id column exists
    let hasInviterIdColumn = false;
    try {
      const columns = db.prepare("PRAGMA table_info(invite_tracking)").all() as any[];
      hasInviterIdColumn = columns.some(col => col.name === 'inviter_id');
      
      // If inviter_id column doesn't exist, try to add it
      if (!hasInviterIdColumn) {
        try {
          db.prepare(`ALTER TABLE invite_tracking ADD COLUMN inviter_id TEXT`).run();
          logInfo('InvitesCommand', 'Added inviter_id column to invite_tracking table');
          hasInviterIdColumn = true;
        } catch (alterError) {
          logError('InvitesCommand', `Error adding inviter_id column: ${alterError}`);
        }
      }
    } catch (pragmaError) {
      logError('InvitesCommand', `Error checking table schema: ${pragmaError}`);
    }
    
    // Count total invites
    const totalCountQuery = hasInviterIdColumn
      ? `SELECT COUNT(*) as count FROM invite_tracking WHERE guild_id = ? AND inviter_id = ?`
      : `SELECT COUNT(*) as count FROM invite_tracking WHERE guild_id = ? AND inviter LIKE ?`;
    
    const totalParams = hasInviterIdColumn
      ? [guildId, userId]
      : [guildId, `%${userId}%`];
    
    const totalResult = db.prepare(totalCountQuery).get(totalParams[0], totalParams[1]) as { count: number };
    const total = totalResult?.count || 0;
    
    // Get recent invites for this inviter
    const recentInvitesQuery = hasInviterIdColumn
      ? `
        SELECT user_id as userId, joined_at as joinedAt 
        FROM invite_tracking 
        WHERE guild_id = ? AND inviter_id = ? 
        ORDER BY joined_at DESC LIMIT 5
      `
      : `
        SELECT user_id as userId, joined_at as joinedAt 
        FROM invite_tracking 
        WHERE guild_id = ? AND inviter LIKE ? 
        ORDER BY joined_at DESC LIMIT 5
      `;
    
    const recentInvites = db.prepare(recentInvitesQuery).all(totalParams[0], totalParams[1]) as Array<{
      userId: string;
      joinedAt: string;
    }>;
    
    // For now, we don't track fake or left invites directly, so returning placeholders
    // In a future update, this could be properly implemented
    
    return {
      total,
      valid: total, // For now, all invites are considered valid
      fake: 0,      // Placeholder - would need to track users leaving quickly
      left: 0,      // Placeholder - would need to track users who left
      recentInvites
    };
  } catch (error) {
    logError('InvitesCommand', `Error getting user invites: ${error}`);
    return {
      total: 0,
      valid: 0,
      fake: 0,
      left: 0,
      recentInvites: []
    };
  }
} 