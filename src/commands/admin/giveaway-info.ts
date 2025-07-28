import { SlashCommandBuilder } from '@discordjs/builders';
import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logError } from '../../utils/logger';
import { GiveawayService } from '../../database/services/giveawayService';

export const data = new SlashCommandBuilder()
  .setName('giveaway-info')
  .setDescription('Get detailed information about a giveaway')
  .addIntegerOption(option =>
    option.setName('id')
      .setDescription('Giveaway ID to get info for')
      .setRequired(true)
      .setMinValue(1))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function formatTimeRemaining(endTime: string): string {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return 'Ended';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'active': return '🟢';
    case 'ended': return '🔴';
    case 'cancelled': return '⚫';
    default: return '⚪';
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guildId) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    const giveawayId = interaction.options.getInteger('id', true);

    // Get giveaway
    const giveawayResult = GiveawayService.getGiveawayById(giveawayId);
    if (!giveawayResult.success || !giveawayResult.giveaway) {
      await interaction.editReply('Giveaway not found.');
      return;
    }

    const giveaway = giveawayResult.giveaway;

    // Check if giveaway belongs to this guild
    if (giveaway.guild_id !== interaction.guildId) {
      await interaction.editReply('This giveaway does not belong to this server.');
      return;
    }

    // Get additional data
    const entriesResult = GiveawayService.getGiveawayEntries(giveawayId);
    const winnersResult = GiveawayService.getGiveawayWinners(giveawayId);
    const requirementsResult = GiveawayService.getGiveawayRequirements(giveawayId);

    const entries = entriesResult.success ? entriesResult.entries || [] : [];
    const winners = winnersResult.success ? winnersResult.winners || [] : [];
    const requirements = requirementsResult.success ? requirementsResult.requirements || [] : [];

    // Create detailed embed
    const embed = new EmbedBuilder()
      .setColor(giveaway.status === 'active' ? Colors.PRIMARY : 
                giveaway.status === 'ended' ? Colors.SUCCESS : Colors.ERROR)
      .setTitle(`${getStatusEmoji(giveaway.status)} Giveaway Information`)
      .setDescription(`**${giveaway.title}**\n${giveaway.description || 'No description provided'}`)
      .addFields(
        { name: '🆔 Giveaway ID', value: `${giveaway.id}`, inline: true },
        { name: '🏆 Prize', value: giveaway.prize, inline: true },
        { name: '📊 Status', value: `${getStatusEmoji(giveaway.status)} ${giveaway.status.toUpperCase()}`, inline: true },
        { name: '👥 Winner Count', value: `${giveaway.winner_count}`, inline: true },
        { name: '📝 Total Entries', value: `${entries.length}`, inline: true },
        { name: '👑 Winners Selected', value: `${winners.length}`, inline: true },
        { name: '🎭 Host', value: `<@${giveaway.host_user_id}>`, inline: true },
        { name: '📍 Channel', value: `<#${giveaway.channel_id}>`, inline: true },
        { name: '⏰ Time Remaining', value: formatTimeRemaining(giveaway.end_time), inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(new Date(giveaway.created_at).getTime() / 1000)}:R>`, inline: true },
        { name: '🕐 Ends', value: `<t:${Math.floor(new Date(giveaway.end_time).getTime() / 1000)}:F>`, inline: true }
      )
      .setTimestamp();

    // Add message link if available
    if (giveaway.message_id) {
      embed.addFields({
        name: '🔗 Message Link',
        value: `[View Giveaway](https://discord.com/channels/${giveaway.guild_id}/${giveaway.channel_id}/${giveaway.message_id})`,
        inline: true
      });
    }

    // Add requirements if any
    if (requirements.length > 0) {
      const reqText = requirements.map(req => {
        if (req.requirement_type === 'role') {
          return `• Must have <@&${req.requirement_value}> role`;
        } else if (req.requirement_type === 'server_boost') {
          return '• Must be boosting this server';
        }
        return `• ${req.requirement_type}: ${req.requirement_value}`;
      }).join('\n');
      
      embed.addFields({ name: '📋 Requirements', value: reqText, inline: false });
    }

    // Add recent entries (last 10)
    if (entries.length > 0) {
      const recentEntries = entries.slice(-10).reverse();
      const entryText = recentEntries.map(entry => 
        `<@${entry.user_id}> - <t:${Math.floor(new Date(entry.entry_time).getTime() / 1000)}:R>`
      ).join('\n');
      
      embed.addFields({
        name: `📥 Recent Entries (${entries.length > 10 ? 'Last 10' : 'All'})`,
        value: entryText.substring(0, 1024) || 'No entries yet',
        inline: false
      });
    }

    // Add winners if any
    if (winners.length > 0) {
      const winnerText = winners.map(winner => 
        `👑 <@${winner.user_id}> - Selected <t:${Math.floor(new Date(winner.selected_at).getTime() / 1000)}:R>`
      ).join('\n');
      
      embed.addFields({
        name: '🏆 Winners',
        value: winnerText.substring(0, 1024),
        inline: false
      });
    }

    // Create action buttons (if giveaway is active)
    const components = [];
    if (giveaway.status === 'active') {
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_end_${giveawayId}`)
            .setLabel('🏁 End Now')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`giveaway_cancel_${giveawayId}`)
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`giveaway_refresh_${giveawayId}`)
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Primary)
        );
      components.push(row);
    } else {
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_refresh_${giveawayId}`)
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Primary)
        );
      components.push(row);
    }

    await interaction.editReply({ 
      embeds: [embed],
      components 
    });
  } catch (error) {
    logError('Giveaway Info', error);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while getting giveaway information.');
      } else {
        await interaction.reply({ 
          content: 'An error occurred while getting giveaway information.', 
          flags: MessageFlags.Ephemeral 
        });
      }
    } catch (replyError) {
      logError('Giveaway Info', replyError);
    }
  }
} 