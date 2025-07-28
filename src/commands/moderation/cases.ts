import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, EmbedBuilder, Colors } from 'discord.js';
import { createErrorEmbed, createInfoEmbed } from '../../utils/embeds';
import { logError, logInfo } from '../../utils/logger';
import { ModerationCaseService } from '../../database/services/sqliteService';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription('View moderation cases')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List recent moderation cases')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of cases to show (default: 10, max: 25)')
            .setMinValue(1)
            .setMaxValue(25)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View a specific case by case number')
        .addIntegerOption(option =>
          option
            .setName('case_number')
            .setDescription('The case number to view')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Search cases by user')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to search cases for')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of cases to show (default: 10, max: 25)')
            .setMinValue(1)
            .setMaxValue(25)
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Check if user has permission to view cases
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        const errorEmbed = createErrorEmbed(
          'Missing Permissions', 
          'You do not have permission to view moderation cases in this server.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      const guild = interaction.guild;
      if (!guild) {
        const errorEmbed = createErrorEmbed('Server Not Found', 'Could not find this server.');
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      
      // Defer reply for database operations
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      switch (subcommand) {
        case 'list':
          await handleListCases(interaction, guild.id);
          break;
        case 'view':
          await handleViewCase(interaction, guild.id);
          break;
        case 'search':
          await handleSearchCases(interaction, guild.id);
          break;
        default:
          await interaction.editReply({ content: 'Unknown subcommand.' });
      }
    } catch (error) {
      logError('Cases Command', error);
      const errorEmbed = createErrorEmbed('Command Error', 'There was an error processing your request.');
      
      try {
        if (interaction.deferred) {
          await interaction.editReply({ embeds: [errorEmbed] });
        } else {
          await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
      } catch (replyError) {
        logError('Cases Command Reply', replyError);
      }
    }
  }
};

async function handleListCases(interaction: ChatInputCommandInteraction, guildId: string) {
  const limit = interaction.options.getInteger('limit') || 10;
  
  try {
    const cases = await ModerationCaseService.getByGuild(guildId, limit);
    
    if (cases.length === 0) {
      const noResultsEmbed = createInfoEmbed(
        'No Cases Found',
        'No moderation cases found for this server.'
      );
      await interaction.editReply({ embeds: [noResultsEmbed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Recent Moderation Cases')
      .setColor(Colors.Blue)
      .setDescription(`Showing ${cases.length} most recent cases`)
      .setFooter({ text: `Use /cases view <case_number> to see details` });

    // Group cases into fields
    const caseFields = cases.map(moderationCase => {
      const date = new Date(moderationCase.created_at || '').toLocaleDateString();
      const actionEmoji = getActionEmoji(moderationCase.action_type);
      
      return {
        name: `${actionEmoji} Case #${moderationCase.case_number} - ${moderationCase.action_type}`,
        value: `**User:** <@${moderationCase.user_id}>\n**Moderator:** <@${moderationCase.moderator_id}>\n**Date:** ${date}\n**Reason:** ${moderationCase.reason.substring(0, 100)}${moderationCase.reason.length > 100 ? '...' : ''}`,
        inline: false
      };
    });

    embed.addFields(caseFields.slice(0, 10)); // Discord embed field limit

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logError('List Cases', error);
    const errorEmbed = createErrorEmbed('Database Error', 'Failed to retrieve moderation cases.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleViewCase(interaction: ChatInputCommandInteraction, guildId: string) {
  const caseNumber = interaction.options.getInteger('case_number', true);
  
  try {
    const moderationCase = await ModerationCaseService.getByCaseNumber(guildId, caseNumber);
    
    if (!moderationCase) {
      const notFoundEmbed = createErrorEmbed(
        'Case Not Found',
        `No case found with number #${caseNumber} in this server.`
      );
      await interaction.editReply({ embeds: [notFoundEmbed] });
      return;
    }

    const actionEmoji = getActionEmoji(moderationCase.action_type);
    const date = new Date(moderationCase.created_at || '').toLocaleString();
    
    const embed = new EmbedBuilder()
      .setTitle(`${actionEmoji} Case #${moderationCase.case_number} - ${moderationCase.action_type}`)
      .setColor(getActionColor(moderationCase.action_type))
      .addFields([
        { name: '👤 Target User', value: `<@${moderationCase.user_id}>\n\`${moderationCase.user_id}\``, inline: true },
        { name: '👮 Moderator', value: `<@${moderationCase.moderator_id}>\n\`${moderationCase.moderator_id}\``, inline: true },
        { name: '📅 Date', value: date, inline: true },
        { name: '📝 Reason', value: moderationCase.reason || 'No reason provided', inline: false },
        { name: '🔄 Status', value: moderationCase.active ? '✅ Active' : '❌ Inactive', inline: true },
        { name: '🆔 Case ID', value: `${moderationCase.id}`, inline: true }
      ]);

    if (moderationCase.additional_info) {
      embed.addFields({ name: 'ℹ️ Additional Info', value: moderationCase.additional_info, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logError('View Case', error);
    const errorEmbed = createErrorEmbed('Database Error', 'Failed to retrieve case information.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleSearchCases(interaction: ChatInputCommandInteraction, guildId: string) {
  const targetUser = interaction.options.getUser('user', true);
  const limit = interaction.options.getInteger('limit') || 10;
  
  try {
    const allCases = await ModerationCaseService.getByGuild(guildId, 100); // Get more to filter
    const userCases = allCases.filter(c => c.user_id === targetUser.id).slice(0, limit);
    
    if (userCases.length === 0) {
      const noResultsEmbed = createInfoEmbed(
        'No Cases Found',
        `No moderation cases found for ${targetUser.tag} in this server.`
      );
      await interaction.editReply({ embeds: [noResultsEmbed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Moderation Cases for ${targetUser.tag}`)
      .setColor(Colors.Orange)
      .setDescription(`Found ${userCases.length} case(s)`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 64 }))
      .setFooter({ text: `Use /cases view <case_number> to see details` });

    const caseFields = userCases.map(moderationCase => {
      const date = new Date(moderationCase.created_at || '').toLocaleDateString();
      const actionEmoji = getActionEmoji(moderationCase.action_type);
      
      return {
        name: `${actionEmoji} Case #${moderationCase.case_number} - ${moderationCase.action_type}`,
        value: `**Moderator:** <@${moderationCase.moderator_id}>\n**Date:** ${date}\n**Reason:** ${moderationCase.reason.substring(0, 100)}${moderationCase.reason.length > 100 ? '...' : ''}`,
        inline: false
      };
    });

    embed.addFields(caseFields.slice(0, 10)); // Discord embed field limit

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logError('Search Cases', error);
    const errorEmbed = createErrorEmbed('Database Error', 'Failed to search moderation cases.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

function getActionEmoji(actionType: string): string {
  const emojiMap: Record<string, string> = {
    'Warning': '⚠️',
    'Kick': '👢',
    'Ban': '🔨',
    'Timeout': '⏰',
    'Staff DM': '💬',
    'Mute': '🔇',
    'Unmute': '🔊'
  };
  
  return emojiMap[actionType] || '📝';
}

function getActionColor(actionType: string): number {
  const colorMap: Record<string, number> = {
    'Warning': Colors.Yellow,
    'Kick': Colors.Orange,
    'Ban': Colors.Red,
    'Timeout': Colors.Purple,
    'Staff DM': Colors.Blue,
    'Mute': Colors.DarkGrey,
    'Unmute': Colors.Green
  };
  
  return colorMap[actionType] || Colors.Blue;
} 