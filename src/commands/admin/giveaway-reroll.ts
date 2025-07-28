import { SlashCommandBuilder } from '@discordjs/builders';
import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  MessageFlags,
  TextChannel
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { GiveawayService } from '../../database/services/giveawayService';

export const data = new SlashCommandBuilder()
  .setName('giveaway-reroll')
  .setDescription('Reroll winners for an ended giveaway')
  .addIntegerOption(option =>
    option.setName('id')
      .setDescription('Giveaway ID to reroll')
      .setRequired(true)
      .setMinValue(1))
  .addIntegerOption(option =>
    option.setName('winners')
      .setDescription('Number of new winners to select (defaults to original amount)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(20))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guildId) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    const giveawayId = interaction.options.getInteger('id', true);
    const newWinnerCount = interaction.options.getInteger('winners');

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

    // Check if giveaway has ended
    if (giveaway.status !== 'ended') {
      await interaction.editReply('You can only reroll winners for ended giveaways.');
      return;
    }

    // Check permissions
    const isHost = giveaway.host_user_id === interaction.user.id;
    const hasPermission = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    
    if (!isHost && !hasPermission) {
      await interaction.editReply('You can only reroll giveaways you created or if you have Manage Server permission.');
      return;
    }

    // Get entries
    const entriesResult = GiveawayService.getGiveawayEntries(giveawayId);
    if (!entriesResult.success || !entriesResult.entries) {
      await interaction.editReply('Failed to get giveaway entries.');
      return;
    }

    const entries = entriesResult.entries;
    if (entries.length === 0) {
      await interaction.editReply('Cannot reroll - this giveaway had no participants.');
      return;
    }

    // Clear existing winners
    const db = require('../../database/sqlite').db;
    db.prepare('DELETE FROM giveaway_winners WHERE giveaway_id = ?').run(giveawayId);

    // Select new winners
    const winnersToSelect = newWinnerCount || giveaway.winner_count;
    const winnersResult = GiveawayService.selectWinners(giveawayId, winnersToSelect);
    
    if (!winnersResult.success || !winnersResult.winners) {
      await interaction.editReply('Failed to select new winners.');
      return;
    }

    const newWinners = winnersResult.winners;

    // Send success response
    const embed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle('🔄 Giveaway Rerolled!')
      .setDescription(`**${giveaway.title}** has been rerolled with new winners!`)
      .addFields(
        { name: '🎉 Giveaway', value: giveaway.title, inline: true },
        { name: '🏆 Prize', value: giveaway.prize, inline: true },
        { name: '👑 New Winners', value: `${newWinners.length}`, inline: true },
        { name: '🔄 Rerolled by', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📊 Total Entries', value: `${entries.length}`, inline: true },
        { name: '🎯 Winner List', value: newWinners.map(id => `<@${id}>`).join('\n'), inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Send announcement in the giveaway channel
    try {
      const channel = await interaction.client.channels.fetch(giveaway.channel_id) as TextChannel;
      if (channel) {
        const announcementEmbed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle('🔄 Giveaway Rerolled!')
          .setDescription(`**${giveaway.title}** has been rerolled!`)
          .addFields(
            { name: '🏆 Prize', value: giveaway.prize, inline: true },
            { name: '👑 New Winners', value: newWinners.map(id => `<@${id}>`).join('\n'), inline: false }
          )
          .setTimestamp();

        const content = `🎉 Congratulations to the new winners: ${newWinners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`;

        await channel.send({ 
          content, 
          embeds: [announcementEmbed],
          allowedMentions: { users: newWinners }
        });
      }
    } catch (error) {
      logError('Giveaway Reroll', `Error sending reroll announcement: ${error}`);
    }

    logInfo('Giveaway', `Giveaway "${giveaway.title}" (ID: ${giveawayId}) rerolled by ${interaction.user.tag} (${interaction.user.id}). New winners: ${newWinners.length}`);
  } catch (error) {
    logError('Giveaway Reroll', error);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while rerolling the giveaway.');
      } else {
        await interaction.reply({ 
          content: 'An error occurred while rerolling the giveaway.', 
          flags: MessageFlags.Ephemeral 
        });
      }
    } catch (replyError) {
      logError('Giveaway Reroll', replyError);
    }
  }
} 