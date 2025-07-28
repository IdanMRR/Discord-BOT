import { 
  Client, 
  ButtonInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  TextChannel,
  GuildMember
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { GiveawayService } from '../../database/services/giveawayService';

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

async function checkGiveawayRequirements(member: GuildMember, giveawayId: number): Promise<{ canEnter: boolean; reason?: string }> {
  const requirementsResult = GiveawayService.getGiveawayRequirements(giveawayId);
  if (!requirementsResult.success || !requirementsResult.requirements) {
    return { canEnter: true };
  }

  const requirements = requirementsResult.requirements;
  
  for (const requirement of requirements) {
    switch (requirement.requirement_type) {
      case 'role':
        if (!member.roles.cache.has(requirement.requirement_value)) {
          return { 
            canEnter: false, 
            reason: `You need the <@&${requirement.requirement_value}> role to enter this giveaway.` 
          };
        }
        break;
        
      case 'server_boost':
        if (requirement.requirement_value === 'true' && !member.premiumSince) {
          return { 
            canEnter: false, 
            reason: 'You need to be boosting this server to enter this giveaway.' 
          };
        }
        break;
        
      case 'level':
        // TODO: Implement level checking if you have a leveling system
        break;
        
      case 'invite_count':
        // TODO: Implement invite count checking if you have an invite system
        break;
    }
  }
  
  return { canEnter: true };
}

async function updateGiveawayMessage(client: Client, giveawayId: number): Promise<void> {
  try {
    const giveawayResult = GiveawayService.getGiveawayById(giveawayId);
    if (!giveawayResult.success || !giveawayResult.giveaway) {
      return;
    }

    const giveaway = giveawayResult.giveaway;
    if (!giveaway.message_id) {
      return;
    }

    const channel = await client.channels.fetch(giveaway.channel_id) as TextChannel;
    if (!channel) {
      return;
    }

    const message = await channel.messages.fetch(giveaway.message_id);
    if (!message) {
      return;
    }

    const entryCountResult = GiveawayService.getEntryCount(giveawayId);
    const entryCount = entryCountResult.success ? entryCountResult.count || 0 : 0;

    const endTime = new Date(giveaway.end_time);
    const isEnded = giveaway.status !== 'active' || endTime <= new Date();

    // Create enhanced embed with better design
    const timeLeft = formatTimeRemaining(giveaway.end_time);
    const isEndingSoon = !isEnded && endTime.getTime() - Date.now() < 3600000; // Less than 1 hour
    
    const embed = new EmbedBuilder()
      .setColor(isEnded ? '#f87171' : isEndingSoon ? '#fbbf24' : '#3b82f6') // Red if ended, yellow if ending soon, blue if active
      .setTitle(
        isEnded 
          ? '🏁 GIVEAWAY ENDED!' 
          : isEndingSoon 
            ? '⚡ GIVEAWAY ENDING SOON!' 
            : '🎉 GIVEAWAY ACTIVE!'
      )
      .setDescription(
        isEnded 
          ? `**${giveaway.title}**\n\n🔒 **This giveaway has ended!**\nWinners have been selected.`
          : `**${giveaway.title}**\n\n${giveaway.description ? `${giveaway.description}\n\n` : ''}${isEndingSoon ? '⚡ **Ending Soon!**' : '🎯 **Click below to enter this amazing giveaway!**'}`
      )
      .setThumbnail('https://cdn.discordapp.com/emojis/🎁.png') // Add a gift thumbnail
      .addFields(
        { 
          name: '🏆 Prize', 
          value: `**${giveaway.prize}**`, 
          inline: true 
        },
        { 
          name: '👑 Winner(s)', 
          value: `**${giveaway.winner_count}** ${giveaway.winner_count === 1 ? 'person' : 'people'}`, 
          inline: true 
        },
        { 
          name: '📊 Entries', 
          value: `**${entryCount}** ${entryCount === 1 ? 'person' : 'people'} entered`, 
          inline: true 
        },
        { 
          name: '⏰ Ends', 
          value: `<t:${Math.floor(endTime.getTime() / 1000)}:F>\n<t:${Math.floor(endTime.getTime() / 1000)}:R>`, 
          inline: true 
        },
        { 
          name: '🎭 Hosted by', 
          value: `<@${giveaway.host_user_id}>`, 
          inline: true 
        },
        { 
          name: isEnded ? '⏹️ Status' : '⏳ Time Left', 
          value: isEnded ? '**ENDED**' : `**${timeLeft}**`, 
          inline: true 
        }
      )
      .setTimestamp(endTime)
      .setFooter({ 
        text: `Giveaway ID: ${giveaway.id} • ${isEnded ? 'Ended' : 'Ends'} at`, 
        iconURL: 'https://cdn.discordapp.com/emojis/🎪.png' 
      });

    // Add a divider field for better visual separation
    if (!isEnded) {
      embed.addFields({ 
        name: '\u200B', 
        value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 
        inline: false 
      });
    }

    // Add requirements if any
    const requirementsResult = GiveawayService.getGiveawayRequirements(giveawayId);
    if (requirementsResult.success && requirementsResult.requirements && requirementsResult.requirements.length > 0) {
      const reqText = requirementsResult.requirements.map(req => {
        if (req.requirement_type === 'role') {
          return `• Must have <@&${req.requirement_value}> role`;
        } else if (req.requirement_type === 'server_boost') {
          return '• Must be boosting this server';
        }
        return `• ${req.requirement_type}: ${req.requirement_value}`;
      }).join('\n');
      
      embed.addFields({ name: '📋 Requirements', value: reqText, inline: false });
    }

    // Enhanced button design
    const components = [];
    
    if (isEnded) {
      const endedButton = new ButtonBuilder()
        .setCustomId(`giveaway_ended_${giveaway.id}`)
        .setLabel('🏁 Giveaway Ended')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
      
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(endedButton));
    } else {
      const enterButton = new ButtonBuilder()
        .setCustomId(`giveaway_enter_${giveaway.id}`)
        .setLabel(isEndingSoon ? '⚡ Enter Now!' : '🎉 Enter Giveaway')
        .setStyle(isEndingSoon ? ButtonStyle.Danger : ButtonStyle.Success)
        .setDisabled(false);
      
      const infoButton = new ButtonBuilder()
        .setCustomId(`giveaway_info_${giveaway.id}`)
        .setLabel('📋 Info')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false);
      
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(enterButton, infoButton));
    }

    await message.edit({
      embeds: [embed],
      components: components
    });
  } catch (error) {
    logError('Giveaway Handler', `Error updating giveaway message: ${error}`);
  }
}

export async function handleGiveawayButton(interaction: ButtonInteraction): Promise<void> {
  try {
    if (!interaction.customId.startsWith('giveaway_enter_')) {
      return;
    }

    // Check if interaction is already replied to or deferred
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ ephemeral: true });
    }

    const giveawayId = parseInt(interaction.customId.replace('giveaway_enter_', ''));
    if (isNaN(giveawayId)) {
      await interaction.editReply({ content: 'Invalid giveaway ID.' });
      return;
    }

    // Get giveaway
    const giveawayResult = GiveawayService.getGiveawayById(giveawayId);
    if (!giveawayResult.success || !giveawayResult.giveaway) {
      await interaction.editReply({ content: 'Giveaway not found.' });
      return;
    }

    const giveaway = giveawayResult.giveaway;

    // Check if giveaway is still active
    if (giveaway.status !== 'active') {
      await interaction.editReply({ content: 'This giveaway is no longer active.' });
      return;
    }

    // Check if giveaway has ended
    const endTime = new Date(giveaway.end_time);
    if (endTime <= new Date()) {
      await interaction.editReply({ content: 'This giveaway has already ended.' });
      return;
    }

    // Check if user is already entered
    const hasEnteredResult = GiveawayService.hasUserEntered(giveawayId, interaction.user.id);
    if (!hasEnteredResult.success) {
      await interaction.editReply({ content: 'Failed to check your entry status.' });
      return;
    }

    if (hasEnteredResult.entered) {
      // Remove entry
      const removeResult = GiveawayService.removeEntry(giveawayId, interaction.user.id);
      if (!removeResult.success) {
        await interaction.editReply({ content: 'Failed to remove your entry.' });
        return;
      }

      await interaction.editReply({ 
        content: '❌ You have been removed from the giveaway.' 
      });
    } else {
      // Check requirements
      const member = interaction.member as GuildMember;
      const requirementCheck = await checkGiveawayRequirements(member, giveawayId);
      
      if (!requirementCheck.canEnter) {
        await interaction.editReply({ 
          content: `❌ ${requirementCheck.reason}` 
        });
        return;
      }

      // Add entry
      const addResult = GiveawayService.addEntry(giveawayId, interaction.user.id);
      if (!addResult.success) {
        await interaction.editReply({ content: 'Failed to enter the giveaway.' });
        return;
      }

      await interaction.editReply({ 
        content: '✅ You have entered the giveaway! Good luck!' 
      });
    }

    // Update the giveaway message
    await updateGiveawayMessage(interaction.client, giveawayId);
  } catch (error) {
    logError('Giveaway Button Handler', error);
    try {
      if (interaction.deferred) {
        await interaction.editReply({ 
          content: 'An error occurred while processing your request.' 
        });
      } else {
        await interaction.reply({ 
          content: 'An error occurred while processing your request.', 
          ephemeral: true 
        });
      }
    } catch (replyError) {
      logError('Giveaway Button Handler', replyError);
    }
  }
}

export async function endGiveaway(client: Client, giveawayId: number): Promise<void> {
  try {
    const giveawayResult = GiveawayService.getGiveawayById(giveawayId);
    if (!giveawayResult.success || !giveawayResult.giveaway) {
      logError('Giveaway End', `Giveaway ${giveawayId} not found`);
      return;
    }

    const giveaway = giveawayResult.giveaway;

    // Check if already ended
    if (giveaway.status !== 'active') {
      return;
    }

    // Get entries
    const entriesResult = GiveawayService.getGiveawayEntries(giveawayId);
    if (!entriesResult.success || !entriesResult.entries) {
      logError('Giveaway End', `Failed to get entries for giveaway ${giveawayId}`);
      return;
    }

    const entries = entriesResult.entries;

    // Update status to ended
    GiveawayService.updateStatus(giveawayId, 'ended');

    // Get channel
    const channel = await client.channels.fetch(giveaway.channel_id) as TextChannel;
    if (!channel) {
      logError('Giveaway End', `Channel ${giveaway.channel_id} not found`);
      return;
    }

    if (entries.length === 0) {
      // No entries
      const embed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('🎉 Giveaway Ended')
        .setDescription(`**${giveaway.title}** has ended with no participants.`)
        .addFields(
          { name: '🏆 Prize', value: giveaway.prize, inline: true },
          { name: '📊 Entries', value: '0', inline: true },
          { name: '👑 Winners', value: 'None', inline: true }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } else {
      // Select winners
      const winnersResult = GiveawayService.selectWinners(giveawayId, giveaway.winner_count);
      if (!winnersResult.success || !winnersResult.winners) {
        logError('Giveaway End', `Failed to select winners for giveaway ${giveawayId}`);
        return;
      }

      const winners = winnersResult.winners;

      // Create winners embed
      const embed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('🎉 Giveaway Ended!')
        .setDescription(`**${giveaway.title}** has ended!`)
        .addFields(
          { name: '🏆 Prize', value: giveaway.prize, inline: true },
          { name: '📊 Total Entries', value: `${entries.length}`, inline: true },
          { name: '👑 Winners', value: winners.map(id => `<@${id}>`).join('\n'), inline: true }
        )
        .setTimestamp();

      const content = `🎉 Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`;

      await channel.send({ 
        content, 
        embeds: [embed],
        allowedMentions: { users: winners }
      });

      logInfo('Giveaway', `Ended giveaway "${giveaway.title}" (ID: ${giveawayId}) with ${winners.length} winners`);
    }

    // Update the original giveaway message
    await updateGiveawayMessage(client, giveawayId);
  } catch (error) {
    logError('Giveaway End', `Error ending giveaway ${giveawayId}: ${error}`);
  }
}

let lastGiveawayCheck = 0;
let giveawayCheckInterval: NodeJS.Timeout | null = null;

// Cache for the next giveaway end time to avoid unnecessary queries
let nextGiveawayEndTime: number | null = null;

export async function startGiveawayChecker(client: Client): Promise<void> {
  logInfo('Giveaway Checker', 'Starting optimized giveaway checker (10 min intervals)...');
  
  // Clear any existing interval to prevent multiple checkers
  if (giveawayCheckInterval) {
    logInfo('Giveaway Checker', 'Clearing existing giveaway interval to prevent duplicates');
    clearInterval(giveawayCheckInterval);
    giveawayCheckInterval = null;
  }
  
  // Check every 10 minutes for ended giveaways (increased to reduce spam further)
  giveawayCheckInterval = setInterval(async () => {
    try {
      // Rate limiting: Don't check more than once every 8 minutes even if interval is shorter
      const now = Date.now();
      if (now - lastGiveawayCheck < 8 * 60 * 1000) {
        return; // Skip check if we checked recently
      }
      
      // Additional optimization: Skip check if we know there are no giveaways ending soon
      if (nextGiveawayEndTime && now < nextGiveawayEndTime - (5 * 60 * 1000)) {
        return; // Skip if next giveaway doesn't end for at least 5 more minutes
      }
      
      lastGiveawayCheck = now;

      const endedGiveawaysResult = GiveawayService.getEndedGiveaways();
      
      if (!endedGiveawaysResult.success) {
        logError('Giveaway Checker', `Failed to get ended giveaways: ${endedGiveawaysResult.error}`);
        return;
      }

      // Only process if there are actually ended giveaways - NO LOGGING for empty checks
      if (!endedGiveawaysResult.giveaways || endedGiveawaysResult.giveaways.length === 0) {
        // Update cache for next giveaway time to optimize future checks
        const nextGiveawayResult = GiveawayService.getNextGiveawayEndTime();
        if (nextGiveawayResult.success && nextGiveawayResult.endTime) {
          nextGiveawayEndTime = new Date(nextGiveawayResult.endTime).getTime();
        } else {
          nextGiveawayEndTime = null;
        }
        return; // Silent return - no logging
      }

      const endedGiveaways = endedGiveawaysResult.giveaways;
      logInfo('Giveaway Checker', `Processing ${endedGiveaways.length} ended giveaways`);
      
      // Reset cache since we found ended giveaways
      nextGiveawayEndTime = null;
      
      for (const giveaway of endedGiveaways) {
        logInfo('Giveaway Checker', `Ending giveaway "${giveaway.title}" (ID: ${giveaway.id})`);
        await endGiveaway(client, giveaway.id);
      }
    } catch (error) {
      logError('Giveaway Checker', `Error checking for ended giveaways: ${error}`);
    }
  }, 10 * 60 * 1000); // 10 minutes (increased from 5 minutes to prevent query spam further)
} 