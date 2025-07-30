import { SlashCommandBuilder } from '@discordjs/builders';
import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  MessageFlags
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { GiveawayService } from '../../database/services/giveawayService';
import { logCommandUsage } from '../../utils/command-logger';

export const data = new SlashCommandBuilder()
  .setName('giveaway-list')
  .setDescription('List all giveaways in this server')
  .addStringOption(option =>
    option.setName('status')
      .setDescription('Filter by status')
      .setRequired(false)
      .addChoices(
        { name: 'Active', value: 'active' },
        { name: 'Ended', value: 'ended' },
        { name: 'Cancelled', value: 'cancelled' }
      ))
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

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guildId) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    const status = interaction.options.getString('status');
    const result = GiveawayService.getGuildGiveaways(interaction.guildId, status || undefined);

    if (!result.success || !result.giveaways) {
      await interaction.editReply(`Failed to get giveaways: ${result.error}`);
      return;
    }

    const giveaways = result.giveaways;

    if (giveaways.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('📋 No Giveaways Found')
        .setDescription(status ? `No ${status} giveaways found in this server.` : 'No giveaways found in this server.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Create embed with giveaway list
    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle(`🎉 Giveaways in ${interaction.guild?.name}`)
      .setDescription(status ? `Showing ${status} giveaways` : 'Showing all giveaways')
      .setTimestamp();

    // Group giveaways by status
    const activeGiveaways = giveaways.filter(g => g.status === 'active');
    const endedGiveaways = giveaways.filter(g => g.status === 'ended');
    const cancelledGiveaways = giveaways.filter(g => g.status === 'cancelled');

    // Add fields for each status group
    if (activeGiveaways.length > 0 && (!status || status === 'active')) {
      const activeText = activeGiveaways.slice(0, 10).map(giveaway => {
        const entryCount = GiveawayService.getEntryCount(giveaway.id);
        const entries = entryCount.success ? entryCount.count || 0 : 0;
        const timeLeft = formatTimeRemaining(giveaway.end_time);
        
        return `**${giveaway.title}** (ID: ${giveaway.id})\n` +
               `🏆 ${giveaway.prize}\n` +
               `📊 ${entries} entries • ⏰ ${timeLeft}\n` +
               `📍 <#${giveaway.channel_id}>`;
      }).join('\n\n');

      embed.addFields({
        name: `✅ Active Giveaways (${activeGiveaways.length})`,
        value: activeText || 'None',
        inline: false
      });
    }

    if (endedGiveaways.length > 0 && (!status || status === 'ended')) {
      const endedText = endedGiveaways.slice(0, 5).map(giveaway => {
        const winnersResult = GiveawayService.getGiveawayWinners(giveaway.id);
        const winnerCount = winnersResult.success ? winnersResult.winners?.length || 0 : 0;
        
        return `**${giveaway.title}** (ID: ${giveaway.id})\n` +
               `🏆 ${giveaway.prize} • 👑 ${winnerCount} winners\n` +
               `📍 <#${giveaway.channel_id}>`;
      }).join('\n\n');

      embed.addFields({
        name: `🏁 Ended Giveaways (${endedGiveaways.length})`,
        value: endedText || 'None',
        inline: false
      });
    }

    if (cancelledGiveaways.length > 0 && (!status || status === 'cancelled')) {
      const cancelledText = cancelledGiveaways.slice(0, 3).map(giveaway => {
        return `**${giveaway.title}** (ID: ${giveaway.id})\n` +
               `🏆 ${giveaway.prize}\n` +
               `📍 <#${giveaway.channel_id}>`;
      }).join('\n\n');

      embed.addFields({
        name: `❌ Cancelled Giveaways (${cancelledGiveaways.length})`,
        value: cancelledText || 'None',
        inline: false
      });
    }

    // Add footer with total count
    embed.setFooter({ 
      text: `Total: ${giveaways.length} giveaway${giveaways.length !== 1 ? 's' : ''} • Use /giveaway-info <id> for details`
    });

    await interaction.editReply({ embeds: [embed] });
    
    // Log command usage for dashboard activity
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'giveaway-list',
      options: { status: status || 'all', count: giveaways.length },
      channel: interaction.channel,
      success: true
    });
  } catch (error) {
    logError('Giveaway List', error);
    
        try {
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while listing giveaways.');
      } else {
        await interaction.reply({ 
          content: 'An error occurred while listing giveaways.', 
          flags: MessageFlags.Ephemeral 
        });
      }
    } catch (replyError) {
      logError('Giveaway List', replyError);
    }
  }
} 