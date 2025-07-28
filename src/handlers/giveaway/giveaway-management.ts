import { 
  ButtonInteraction, 
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { GiveawayService } from '../../database/services/giveawayService';
import { endGiveaway } from './giveaway-handler';

export async function handleGiveawayManagementButton(interaction: ButtonInteraction): Promise<void> {
  try {
    const customId = interaction.customId;
    
    // Parse the custom ID to get action and giveaway ID
    const parts = customId.split('_');
    const action = parts[1]; // end, cancel, refresh, etc.
    const giveawayId = parseInt(parts[2]);
    
    if (isNaN(giveawayId)) {
      await interaction.reply({ content: 'Invalid giveaway ID.', ephemeral: true });
      return;
    }

    // Get giveaway
    const giveawayResult = GiveawayService.getGiveawayById(giveawayId);
    if (!giveawayResult.success || !giveawayResult.giveaway) {
      await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
      return;
    }

    const giveaway = giveawayResult.giveaway;

    // Check permissions
    const hasPermission = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    const isHost = giveaway.host_user_id === interaction.user.id;
    
    if (!hasPermission && !isHost) {
      await interaction.reply({ 
        content: 'You need Manage Server permission or be the giveaway host to use this action.', 
        ephemeral: true 
      });
      return;
    }

    switch (action) {
      case 'end':
        await handleEndGiveaway(interaction, giveawayId);
        break;
        
      case 'cancel':
        await handleCancelGiveaway(interaction, giveawayId);
        break;
        
      case 'refresh':
        await handleRefreshGiveaway(interaction, giveawayId);
        break;
        
      case 'export':
        await handleExportEntries(interaction, giveawayId);
        break;
        
      case 'clear':
        await handleClearEntries(interaction, giveawayId);
        break;
        
      case 'remove':
        if (parts.length >= 4) {
          const userId = parts[3];
          await handleRemoveUserEntry(interaction, giveawayId, userId);
        }
        break;
        
      default:
        await interaction.reply({ content: 'Unknown action.', ephemeral: true });
    }
  } catch (error) {
    logError('Giveaway Management', error);
    try {
      await interaction.reply({ 
        content: 'An error occurred while processing your request.', 
        ephemeral: true 
      });
    } catch (replyError) {
      logError('Giveaway Management', replyError);
    }
  }
}

async function handleEndGiveaway(interaction: ButtonInteraction, giveawayId: number): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  
  const giveawayResult = GiveawayService.getGiveawayById(giveawayId);
  if (!giveawayResult.success || !giveawayResult.giveaway) {
    await interaction.editReply('Giveaway not found.');
    return;
  }

  const giveaway = giveawayResult.giveaway;
  
  if (giveaway.status !== 'active') {
    await interaction.editReply(`This giveaway is already ${giveaway.status}.`);
    return;
  }

  // End the giveaway
  await endGiveaway(interaction.client, giveawayId);

  const embed = new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setTitle('✅ Giveaway Ended')
    .setDescription(`**${giveaway.title}** has been ended manually.`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logInfo('Giveaway Management', `Giveaway ${giveawayId} ended by ${interaction.user.tag}`);
}

async function handleCancelGiveaway(interaction: ButtonInteraction, giveawayId: number): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  
  const giveawayResult = GiveawayService.getGiveawayById(giveawayId);
  if (!giveawayResult.success || !giveawayResult.giveaway) {
    await interaction.editReply('Giveaway not found.');
    return;
  }

  const giveaway = giveawayResult.giveaway;
  
  if (giveaway.status !== 'active') {
    await interaction.editReply(`This giveaway is already ${giveaway.status}.`);
    return;
  }

  // Cancel the giveaway
  const updateResult = GiveawayService.updateStatus(giveawayId, 'cancelled');
  if (!updateResult.success) {
    await interaction.editReply('Failed to cancel the giveaway.');
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.ERROR)
    .setTitle('❌ Giveaway Cancelled')
    .setDescription(`**${giveaway.title}** has been cancelled.`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logInfo('Giveaway Management', `Giveaway ${giveawayId} cancelled by ${interaction.user.tag}`);
}

async function handleRefreshGiveaway(interaction: ButtonInteraction, giveawayId: number): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  
  // Re-run the original command (giveaway-info)
  const giveawayResult = GiveawayService.getGiveawayById(giveawayId);
  if (!giveawayResult.success || !giveawayResult.giveaway) {
    await interaction.editReply('Giveaway not found.');
    return;
  }

  await interaction.editReply('🔄 Information refreshed! Use `/giveaway-info` to see updated details.');
}

async function handleExportEntries(interaction: ButtonInteraction, giveawayId: number): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  
  const entriesResult = GiveawayService.getGiveawayEntries(giveawayId);
  if (!entriesResult.success || !entriesResult.entries) {
    await interaction.editReply('Failed to get giveaway entries.');
    return;
  }

  const entries = entriesResult.entries;
  if (entries.length === 0) {
    await interaction.editReply('No entries to export.');
    return;
  }

  // Create a simple text export
  const exportText = entries.map((entry, index) => 
    `${index + 1}. ${entry.user_id} - ${new Date(entry.entry_time).toISOString()}`
  ).join('\n');

  const embed = new EmbedBuilder()
    .setColor(Colors.PRIMARY)
    .setTitle('📤 Giveaway Entries Export')
    .setDescription(`**Total Entries:** ${entries.length}`)
    .addFields({
      name: '📋 Entry List',
      value: `\`\`\`\n${exportText.substring(0, 1000)}\n\`\`\``,
      inline: false
    })
    .setTimestamp();

  if (exportText.length > 1000) {
    embed.setFooter({ text: 'List truncated. Use /giveaway-entries for full list.' });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleClearEntries(interaction: ButtonInteraction, giveawayId: number): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  
  const giveawayResult = GiveawayService.getGiveawayById(giveawayId);
  if (!giveawayResult.success || !giveawayResult.giveaway) {
    await interaction.editReply('Giveaway not found.');
    return;
  }

  const giveaway = giveawayResult.giveaway;
  
  if (giveaway.status !== 'active') {
    await interaction.editReply('You can only clear entries for active giveaways.');
    return;
  }

  // Clear all entries
  const db = require('../../database/sqlite').db;
  const result = db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ?').run(giveawayId);

  const embed = new EmbedBuilder()
    .setColor(Colors.WARNING)
    .setTitle('🗑️ Entries Cleared')
    .setDescription(`Cleared **${result.changes}** entries from **${giveaway.title}**.`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logInfo('Giveaway Management', `Cleared ${result.changes} entries from giveaway ${giveawayId} by ${interaction.user.tag}`);
}

async function handleRemoveUserEntry(interaction: ButtonInteraction, giveawayId: number, userId: string): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  
  const removeResult = GiveawayService.removeEntry(giveawayId, userId);
  if (!removeResult.success) {
    await interaction.editReply('Failed to remove user entry or user was not entered.');
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.WARNING)
    .setTitle('❌ User Entry Removed')
    .setDescription(`Removed <@${userId}> from the giveaway.`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logInfo('Giveaway Management', `Removed user ${userId} from giveaway ${giveawayId} by ${interaction.user.tag}`);
} 