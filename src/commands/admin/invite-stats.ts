import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { getInviteStats } from '../../handlers/invites/invite-tracker';
import { logCommandUsage } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('invite-stats')
  .setDescription('View invite statistics for the server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addUserOption(option => 
    option.setName('user')
      .setDescription('Get invite stats for a specific user')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();
    
    const targetUser = interaction.options.getUser('user');
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
      command: 'invite-stats',
      options: targetUser ? { user: targetUser.tag } : {},
      channel: interaction.channel,
      success: true
    });
    
    if (targetUser) {
      // Get stats for specific user
      const userStats = await getUserInviteStats(guild.id, targetUser.id);
      
      const userEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`Invite Stats for ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(`
**Invite Statistics:**
• **${userStats.invites}** total invites
• **${userStats.regular}** regular invites
• **${userStats.leaves}** leaves
• **${userStats.fake}** fake invites
• **${userStats.bonus}** bonus invites
        `)
        .setFooter({ text: `• Made By Soggra` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [userEmbed] });
    } else {
      // Get server-wide stats
      const serverStats = await getInviteStats(guild.id);
      const topInviters = serverStats.topInviters.slice(0, 10);
      
      const serverEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`Invite Statistics for ${guild.name}`)
        .setThumbnail(guild.iconURL() || '')
        .addFields([
          { 
            name: 'Server Stats', 
            value: `
• **${serverStats.totalInvites}** total invites
• **${serverStats.fakeInvites}** fake invites
• **${guild.memberCount}** total members
            `,
            inline: false
          },
          { 
            name: 'Top Inviters', 
            value: topInviters.length > 0 
              ? topInviters.map((inviter, index) => 
                  `**${index + 1}.** ${inviter.inviter}: **${inviter.count}** invites`
                ).join('\n')
              : 'No invites tracked yet',
            inline: false
          }
        ])
        .setFooter({ text: `• Made By Soggra` })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [serverEmbed] });
    }
  } catch (error) {
    console.error('Error executing invite-stats command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching invite statistics.'
    });
  }
}

/**
 * Get invite statistics for a specific user
 * @param guildId The guild ID
 * @param userId The user ID
 * @returns The user's invite statistics
 */
async function getUserInviteStats(guildId: string, userId: string): Promise<{
  invites: number;
  regular: number;
  leaves: number;
  fake: number;
  bonus: number;
}> {
  try {
    // This is a placeholder - in a real implementation, you would query the database
    // to get the user's invite statistics
    const inviteStats = await getInviteStats(guildId);
    
    // Find the user in the top inviters
    const userStats = inviteStats.topInviters.find(inviter => 
      inviter.inviter.includes(userId) || inviter.inviter.includes(`<@${userId}>`)
    );
    
    return {
      invites: userStats?.count || 0,
      regular: userStats?.count || 0,
      leaves: 0, // This would be calculated from the database
      fake: 0,   // This would be calculated from the database
      bonus: 0   // This would be calculated from the database
    };
  } catch (error) {
    console.error('Error getting user invite stats:', error);
    return {
      invites: 0,
      regular: 0,
      leaves: 0,
      fake: 0,
      bonus: 0
    };
  }
}
