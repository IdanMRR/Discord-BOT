import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  MessageFlags,
  User,
  GuildMember,
  PermissionsBitField
} from 'discord.js';
import { createInfoEmbed, Colors } from '../../utils/embeds';
import { logCommandUsage } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Get detailed information about a user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to get information about (defaults to yourself)')
      .setRequired(false))
  .addBooleanOption(option =>
    option
      .setName('detailed')
      .setDescription('Show detailed information including permissions')
      .setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();
    
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const showDetailed = interaction.options.getBoolean('detailed') || false;
    const guild = interaction.guild;
    
    if (!guild) {
      const errorEmbed = createInfoEmbed(
        'Server Required',
        'This command must be used in a server to show complete user information.'
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }
    
    // Get guild member
    let member: GuildMember | null = null;
    try {
      member = await guild.members.fetch(targetUser.id);
    } catch (error) {
      // User not in guild
    }
    
    // Create main embed
    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor || Colors.INFO)
      .setTitle(`👤 User Information`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256, extension: 'png' }))
      .setTimestamp();
    
    // User basic info
    const userCreated = Math.floor(targetUser.createdTimestamp / 1000);
    const accountAge = Math.floor((Date.now() - targetUser.createdTimestamp) / (1000 * 60 * 60 * 24));
    
    embed.addFields([
      { 
        name: '🏷️ User Details', 
        value: [
          `**Username:** ${targetUser.username}`,
          `**Display Name:** ${targetUser.displayName}`,
          `**User ID:** ${targetUser.id}`,
          `**Bot:** ${targetUser.bot ? 'Yes' : 'No'}`,
          `**System:** ${targetUser.system ? 'Yes' : 'No'}`
        ].join('\n'), 
        inline: false 
      },
      { 
        name: '📅 Account Information', 
        value: [
          `**Created:** <t:${userCreated}:F>`,
          `**Account Age:** ${accountAge} days`,
          `**Created:** <t:${userCreated}:R>`
        ].join('\n'), 
        inline: false 
      }
    ]);
    
    // Server member info
    if (member) {
      const joinedTimestamp = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
      const serverAge = member.joinedTimestamp ? Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24)) : 0;
      
      embed.addFields([
        { 
          name: '🏠 Server Membership', 
          value: [
            `**Nickname:** ${member.nickname || 'None'}`,
            `**Joined Server:** ${joinedTimestamp ? `<t:${joinedTimestamp}:F>` : 'Unknown'}`,
            `**Server Age:** ${serverAge} days`,
            `**Joined:** ${joinedTimestamp ? `<t:${joinedTimestamp}:R>` : 'Unknown'}`
          ].join('\n'), 
          inline: false 
        }
      ]);
      
      // Roles information
      const roles = member.roles.cache
        .filter(role => role.id !== guild.id) // Exclude @everyone
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString());
      
      const rolesText = roles.length > 0 ? roles.slice(0, 10).join(', ') + (roles.length > 10 ? ` and ${roles.length - 10} more...` : '') : 'None';
      
      embed.addFields([
        { 
          name: `🎭 Roles (${roles.length})`, 
          value: rolesText, 
          inline: false 
        }
      ]);
      
      // Status and activity
      const presence = member.presence;
      const status = presence?.status || 'offline';
      const statusEmoji = {
        online: '🟢',
        idle: '🟡',
        dnd: '🔴',
        offline: '⚫',
        invisible: '⚫'
      }[status] || '⚫';
      
      let statusText = `**Status:** ${statusEmoji} ${status.charAt(0).toUpperCase() + status.slice(1)}`;
      
      if (presence?.activities && presence.activities.length > 0) {
        const activity = presence.activities[0];
        statusText += `\n**Activity:** ${activity.name}`;
        if (activity.details) statusText += `\n**Details:** ${activity.details}`;
        if (activity.state) statusText += `\n**State:** ${activity.state}`;
      }
      
      embed.addFields([
        { 
          name: '🎮 Status & Activity', 
          value: statusText, 
          inline: false 
        }
      ]);
      
      // Detailed permissions (if requested)
      if (showDetailed) {
        const keyPermissions = [
          'Administrator',
          'ManageGuild',
          'ManageRoles',
          'ManageChannels',
          'ManageMessages',
          'KickMembers',
          'BanMembers',
          'ModerateMembers',
          'ViewAuditLog',
          'ManageNicknames',
          'ManageWebhooks',
          'CreateInstantInvite'
        ];
        
        const hasPermissions = keyPermissions.filter(perm => 
          member.permissions.has(PermissionsBitField.Flags[perm as keyof typeof PermissionsBitField.Flags])
        );
        
        if (hasPermissions.length > 0) {
          embed.addFields([
            { 
              name: '🔑 Key Permissions', 
              value: hasPermissions.map(perm => `✅ ${perm.replace(/([A-Z])/g, ' $1').trim()}`).join('\n'), 
              inline: false 
            }
          ]);
        }
        
        // Boost information
        if (member.premiumSince) {
          const boostStart = Math.floor(member.premiumSince.getTime() / 1000);
          const boostDays = Math.floor((Date.now() - member.premiumSince.getTime()) / (1000 * 60 * 60 * 24));
          
          embed.addFields([
            { 
              name: '💎 Server Boost', 
              value: [
                `**Boosting Since:** <t:${boostStart}:F>`,
                `**Boost Duration:** ${boostDays} days`,
                `**Started:** <t:${boostStart}:R>`
              ].join('\n'), 
              inline: false 
            }
          ]);
        }
      }
      
    } else {
      embed.addFields([
        { 
          name: '❌ Server Membership', 
          value: 'This user is not a member of this server.', 
          inline: false 
        }
      ]);
    }
    
    // Avatar showcase
    const avatarUrl = targetUser.displayAvatarURL({ size: 1024, extension: 'png' });
    embed.setImage(avatarUrl);
    
    // Footer with additional info
    const isOwner = guild.ownerId === targetUser.id;
    const footerText = isOwner ? '👑 Server Owner' : member ? '📱 Server Member' : '🌐 External User';
    embed.setFooter({ 
      text: `${footerText} • ${targetUser.bot ? 'Bot Account' : 'User Account'}`,
      iconURL: guild.iconURL() || undefined
    });
    
    // Add author field
    embed.setAuthor({
      name: `${targetUser.username}${member?.nickname ? ` (${member.nickname})` : ''}`,
      iconURL: targetUser.displayAvatarURL({ size: 64 })
    });
    
    await interaction.editReply({ embeds: [embed] });
    
    // Log command usage
    await logCommandUsage({
      guild: guild,
      user: interaction.user,
      command: 'userinfo',
      options: { target: targetUser.tag, detailed: showDetailed },
      channel: interaction.channel,
      success: true
    });
    
  } catch (error) {
    console.error('Error in userinfo command:', error);
    
    const errorEmbed = createInfoEmbed(
      'Error',
      'There was an error retrieving user information. Please try again.'
    );
    errorEmbed.setColor(Colors.ERROR);
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
} 