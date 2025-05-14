import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import { getInviteStats } from '../../handlers/invites/invite-tracker';
import { logCommandUsage } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('invite-leaderboard')
  .setDescription('View the invite leaderboard for the server')
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
  .addIntegerOption(option => 
    option.setName('page')
      .setDescription('Page number to view')
      .setRequired(false)
      .setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();
    
    const { guild } = interaction;
    const page = interaction.options.getInteger('page') || 1;
    
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
      command: 'invite-leaderboard',
      options: { page },
      channel: interaction.channel,
      success: true
    });
    
    // Get server-wide stats
    const serverStats = await getInviteStats(guild.id);
    
    // Calculate pagination
    const itemsPerPage = 10;
    const maxPage = Math.ceil(serverStats.topInviters.length / itemsPerPage) || 1;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, serverStats.topInviters.length);
    const pageInviters = serverStats.topInviters.slice(startIndex, endIndex);
    
    // Create the leaderboard embed
    const leaderboardEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🏆 Invite Leaderboard for ${guild.name}`)
      .setDescription(`
**Server Stats:**
• **${serverStats.totalInvites}** total invites
• **${serverStats.fakeInvites}** fake invites
• **${guild.memberCount}** total members

**Top Inviters:**
${pageInviters.length > 0 
  ? pageInviters.map((inviter, index) => 
      `**${startIndex + index + 1}.** ${inviter.inviter}: **${inviter.count}** invites`
    ).join('\n')
  : 'No invites tracked yet'}
      `)
      .setFooter({ text: `Page ${page}/${maxPage} • Made By Soggra` })
      .setTimestamp();
    
    // Only set thumbnail if guild has an icon
    const guildIcon = guild.iconURL();
    if (guildIcon) {
      leaderboardEmbed.setThumbnail(guildIcon);
    }
    
    // Create pagination buttons if needed
    const components = [];
    
    if (maxPage > 1) {
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`invite_leaderboard_prev_${page}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 1),
          new ButtonBuilder()
            .setCustomId(`invite_leaderboard_next_${page}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= maxPage)
        );
      
      components.push(row);
    }
    
    await interaction.editReply({ 
      embeds: [leaderboardEmbed],
      components
    });
  } catch (error) {
    console.error('Error executing invite-leaderboard command:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching the invite leaderboard.'
    });
  }
}
