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
  .setName('giveaway-entries')
  .setDescription('View and manage giveaway entries')
  .addIntegerOption(option =>
    option.setName('id')
      .setDescription('Giveaway ID to view entries for')
      .setRequired(true)
      .setMinValue(1))
  .addIntegerOption(option =>
    option.setName('page')
      .setDescription('Page number (20 entries per page)')
      .setRequired(false)
      .setMinValue(1))
  .addUserOption(option =>
    option.setName('user')
      .setDescription('Search for a specific user')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guildId) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    const giveawayId = interaction.options.getInteger('id', true);
    const page = interaction.options.getInteger('page') || 1;
    const targetUser = interaction.options.getUser('user');

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

    // Get entries
    const entriesResult = GiveawayService.getGiveawayEntries(giveawayId);
    if (!entriesResult.success || !entriesResult.entries) {
      await interaction.editReply('Failed to get giveaway entries.');
      return;
    }

    let entries = entriesResult.entries;
    
    // Filter by user if specified
    if (targetUser) {
      entries = entries.filter(entry => entry.user_id === targetUser.id);
    }

    if (entries.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('📋 No Entries Found')
        .setDescription(targetUser ? 
          `No entries found for ${targetUser} in **${giveaway.title}**.` :
          `No entries found for **${giveaway.title}**.`)
        .addFields(
          { name: '🎉 Giveaway', value: giveaway.title, inline: true },
          { name: '🏆 Prize', value: giveaway.prize, inline: true },
          { name: '📊 Status', value: giveaway.status.toUpperCase(), inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Pagination
    const entriesPerPage = 20;
    const totalPages = Math.ceil(entries.length / entriesPerPage);
    const startIndex = (page - 1) * entriesPerPage;
    const endIndex = startIndex + entriesPerPage;
    const pageEntries = entries.slice(startIndex, endIndex);

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle(`📋 Giveaway Entries${targetUser ? ` for ${targetUser.displayName}` : ''}`)
      .setDescription(`**${giveaway.title}**\n🏆 ${giveaway.prize}`)
      .addFields(
        { name: '📊 Total Entries', value: `${entries.length}`, inline: true },
        { name: '📄 Page', value: `${page}/${totalPages}`, inline: true },
        { name: '📊 Status', value: giveaway.status.toUpperCase(), inline: true }
      )
      .setTimestamp();

    // Add entries list
    if (pageEntries.length > 0) {
      const entryText = pageEntries.map((entry, index) => {
        const entryNumber = startIndex + index + 1;
        const timestamp = `<t:${Math.floor(new Date(entry.entry_time).getTime() / 1000)}:R>`;
        return `${entryNumber}. <@${entry.user_id}> - ${timestamp}`;
      }).join('\n');

      embed.addFields({
        name: `📝 Entries (${startIndex + 1}-${Math.min(endIndex, entries.length)})`,
        value: entryText.substring(0, 1024),
        inline: false
      });
    }

    // Add navigation buttons
    const components = [];
    if (totalPages > 1) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      
      if (page > 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_entries_${giveawayId}_${page - 1}${targetUser ? `_${targetUser.id}` : ''}`)
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Secondary)
        );
      }
      
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_entries_refresh_${giveawayId}_${page}${targetUser ? `_${targetUser.id}` : ''}`)
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Primary)
      );
      
      if (page < totalPages) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_entries_${giveawayId}_${page + 1}${targetUser ? `_${targetUser.id}` : ''}`)
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
        );
      }
      
      components.push(row);
    }

    // Add management buttons for active giveaways
    if (giveaway.status === 'active') {
      const managementRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_export_entries_${giveawayId}`)
            .setLabel('📤 Export')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`giveaway_clear_entries_${giveawayId}`)
            .setLabel('🗑️ Clear All')
            .setStyle(ButtonStyle.Danger)
        );
      
      if (targetUser) {
        managementRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_remove_entry_${giveawayId}_${targetUser.id}`)
            .setLabel('❌ Remove User')
            .setStyle(ButtonStyle.Danger)
        );
      }
      
      components.push(managementRow);
    }

    await interaction.editReply({ 
      embeds: [embed],
      components 
    });
  } catch (error) {
    logError('Giveaway Entries', error);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while getting giveaway entries.');
      } else {
        await interaction.reply({ 
          content: 'An error occurred while getting giveaway entries.', 
          flags: MessageFlags.Ephemeral 
        });
      }
    } catch (replyError) {
      logError('Giveaway Entries', replyError);
    }
  }
} 