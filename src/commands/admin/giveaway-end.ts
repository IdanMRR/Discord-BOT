import { SlashCommandBuilder } from '@discordjs/builders';
import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  MessageFlags
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { GiveawayService } from '../../database/services/giveawayService';
import { endGiveaway } from '../../handlers/giveaway/giveaway-handler';
import { logError } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('giveaway-end')
  .setDescription('Manually end a giveaway')
  .addIntegerOption(option =>
    option.setName('id')
      .setDescription('Giveaway ID to end')
      .setRequired(true)
      .setMinValue(1))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

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

    // Check if already ended
    if (giveaway.status !== 'active') {
      await interaction.editReply(`This giveaway is already ${giveaway.status}.`);
      return;
    }

    // Check if user is the host or has manage guild permission
    const isHost = giveaway.host_user_id === interaction.user.id;
    const hasPermission = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    
    if (!isHost && !hasPermission) {
      await interaction.editReply('You can only end giveaways you created or if you have Manage Server permission.');
      return;
    }

    // End the giveaway
    await endGiveaway(interaction.client, giveawayId);

    // Send confirmation
    const embed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle('✅ Giveaway Ended')
      .setDescription(`**${giveaway.title}** has been manually ended.`)
      .addFields(
        { name: '🎉 Giveaway', value: giveaway.title, inline: true },
        { name: '🏆 Prize', value: giveaway.prize, inline: true },
        { name: '🎭 Ended by', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logError('Giveaway End', error);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while ending the giveaway.');
      } else {
        await interaction.reply({ 
          content: 'An error occurred while ending the giveaway.', 
          flags: MessageFlags.Ephemeral 
        });
      }
    } catch (replyError) {
      logError('Giveaway End', replyError);
    }
  }
} 