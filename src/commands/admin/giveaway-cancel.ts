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
  .setName('giveaway-cancel')
  .setDescription('Cancel an active giveaway')
  .addIntegerOption(option =>
    option.setName('id')
      .setDescription('Giveaway ID to cancel')
      .setRequired(true)
      .setMinValue(1))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for cancellation')
      .setRequired(false)
      .setMaxLength(500))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guildId) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    const giveawayId = interaction.options.getInteger('id', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

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

    // Check if giveaway can be cancelled
    if (giveaway.status !== 'active') {
      await interaction.editReply(`This giveaway is already ${giveaway.status}.`);
      return;
    }

    // Check if user is the host or has manage guild permission
    const isHost = giveaway.host_user_id === interaction.user.id;
    const hasPermission = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    
    if (!isHost && !hasPermission) {
      await interaction.editReply('You can only cancel giveaways you created or if you have Manage Server permission.');
      return;
    }

    // Get entry count before cancellation
    const entryCountResult = GiveawayService.getEntryCount(giveawayId);
    const entryCount = entryCountResult.success ? entryCountResult.count || 0 : 0;

    // Cancel the giveaway
    const updateResult = GiveawayService.updateStatus(giveawayId, 'cancelled');
    if (!updateResult.success) {
      await interaction.editReply('Failed to cancel the giveaway.');
      return;
    }

    // Update the original giveaway message if it exists
    try {
      if (giveaway.message_id) {
        const channel = await interaction.client.channels.fetch(giveaway.channel_id) as TextChannel;
        if (channel) {
          const message = await channel.messages.fetch(giveaway.message_id);
          if (message) {
            const cancelledEmbed = new EmbedBuilder()
              .setColor(Colors.ERROR)
              .setTitle(`❌ ${giveaway.title} [CANCELLED]`)
              .setDescription(giveaway.description || 'This giveaway has been cancelled.')
              .addFields(
                { name: '🏆 Prize', value: giveaway.prize, inline: true },
                { name: '📊 Final Entries', value: `${entryCount}`, inline: true },
                { name: '❌ Cancelled by', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📝 Reason', value: reason, inline: false }
              )
              .setTimestamp()
              .setFooter({ text: `Giveaway ID: ${giveaway.id} • Cancelled` });

            await message.edit({
              embeds: [cancelledEmbed],
              components: [] // Remove all buttons
            });
          }
        }
      }
    } catch (error) {
      logError('Giveaway Cancel', `Error updating giveaway message: ${error}`);
    }

    // Send confirmation
    const embed = new EmbedBuilder()
      .setColor(Colors.ERROR)
      .setTitle('❌ Giveaway Cancelled')
      .setDescription(`**${giveaway.title}** has been cancelled.`)
      .addFields(
        { name: '🎉 Giveaway', value: giveaway.title, inline: true },
        { name: '🏆 Prize', value: giveaway.prize, inline: true },
        { name: '📊 Final Entries', value: `${entryCount}`, inline: true },
        { name: '❌ Cancelled by', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📝 Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Send cancellation announcement in the giveaway channel
    try {
      const channel = await interaction.client.channels.fetch(giveaway.channel_id) as TextChannel;
      if (channel) {
        const announcementEmbed = new EmbedBuilder()
          .setColor(Colors.ERROR)
          .setTitle('🚫 Giveaway Cancelled')
          .setDescription(`The **${giveaway.title}** giveaway has been cancelled.`)
          .addFields(
            { name: '📝 Reason', value: reason, inline: false },
            { name: '👥 Participants', value: `${entryCount} users were entered`, inline: true }
          )
          .setTimestamp();

        await channel.send({ embeds: [announcementEmbed] });
      }
    } catch (error) {
      logError('Giveaway Cancel', `Error sending cancellation announcement: ${error}`);
    }

    logInfo('Giveaway', `Giveaway "${giveaway.title}" (ID: ${giveawayId}) cancelled by ${interaction.user.tag} (${interaction.user.id}). Reason: ${reason}`);
  } catch (error) {
    logError('Giveaway Cancel', error);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while cancelling the giveaway.');
      } else {
        await interaction.reply({ 
          content: 'An error occurred while cancelling the giveaway.', 
          flags: MessageFlags.Ephemeral 
        });
      }
    } catch (replyError) {
      logError('Giveaway Cancel', replyError);
    }
  }
} 