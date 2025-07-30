import { SlashCommandBuilder } from '@discordjs/builders';
import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  TextChannel, 
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { GiveawayService, CreateGiveawayData } from '../../database/services/giveawayService';
import { logCommandUsage } from '../../utils/command-logger';

export const data = new SlashCommandBuilder()
  .setName('giveaway-create')
  .setDescription('Create a new giveaway')
  .addStringOption(option =>
    option.setName('title')
      .setDescription('Title of the giveaway')
      .setRequired(true)
      .setMaxLength(256))
  .addStringOption(option =>
    option.setName('prize')
      .setDescription('What the prize is')
      .setRequired(true)
      .setMaxLength(512))
  .addStringOption(option =>
    option.setName('duration')
      .setDescription('Duration (e.g., 1h, 30m, 2d, 1w)')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('winners')
      .setDescription('Number of winners')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(20))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Additional description')
      .setRequired(false)
      .setMaxLength(1024))
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Channel to post the giveaway in (defaults to current channel)')
      .setRequired(false))
  .addRoleOption(option =>
    option.setName('required-role')
      .setDescription('Required role to participate')
      .setRequired(false))
  .addBooleanOption(option =>
    option.setName('server-boost-required')
      .setDescription('Require server boost to participate')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function parseDuration(duration: string): Date | null {
  const regex = /^(\d+)([mhdw])$/i;
  const match = duration.toLowerCase().match(regex);
  
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const now = new Date();
  
  switch (unit) {
    case 'm':
      return new Date(now.getTime() + value * 60 * 1000);
    case 'h':
      return new Date(now.getTime() + value * 60 * 60 * 1000);
    case 'd':
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    case 'w':
      return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

function formatTimeRemaining(endTime: Date): string {
  const now = new Date();
  const diff = endTime.getTime() - now.getTime();
  
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

    const title = interaction.options.getString('title', true);
    const prize = interaction.options.getString('prize', true);
    const durationStr = interaction.options.getString('duration', true);
    const winners = interaction.options.getInteger('winners') || 1;
    const description = interaction.options.getString('description');
    const targetChannel = interaction.options.getChannel('channel') as TextChannel || interaction.channel as TextChannel;
    const requiredRole = interaction.options.getRole('required-role');
    const serverBoostRequired = interaction.options.getBoolean('server-boost-required') || false;

    // Validate channel
    if (!targetChannel || !(targetChannel instanceof TextChannel)) {
      await interaction.editReply('Please specify a valid text channel.');
      return;
    }

    // Validate guild
    if (!interaction.guildId) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    // Parse duration
    const endTime = parseDuration(durationStr);
    if (!endTime) {
      await interaction.editReply('Invalid duration format. Use format like: 1h, 30m, 2d, 1w');
      return;
    }

    // Check if duration is at least 1 minute
    const minEndTime = new Date(Date.now() + 60 * 1000);
    if (endTime < minEndTime) {
      await interaction.editReply('Giveaway duration must be at least 1 minute.');
      return;
    }

    // Check if duration is not more than 30 days
    const maxEndTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (endTime > maxEndTime) {
      await interaction.editReply('Giveaway duration cannot exceed 30 days.');
      return;
    }

    // Create giveaway data
    const giveawayData: CreateGiveawayData = {
      guild_id: interaction.guildId,
      channel_id: targetChannel.id,
      title,
      description: description || undefined,
      prize,
      winner_count: winners,
      host_user_id: interaction.user.id,
      end_time: endTime.toISOString()
    };

    // Add requirements if any
    const requirements: any[] = [];
    if (requiredRole) {
      requirements.push({
        requirement_type: 'role',
        requirement_value: requiredRole.id
      });
    }
    if (serverBoostRequired) {
      requirements.push({
        requirement_type: 'server_boost',
        requirement_value: 'true'
      });
    }
    if (requirements.length > 0) {
      giveawayData.requirements = requirements;
    }

    // Create giveaway in database
    const result = GiveawayService.createGiveaway(giveawayData);
    if (!result.success || !result.giveaway) {
      await interaction.editReply(`Failed to create giveaway: ${result.error}`);
      return;
    }

    const giveaway = result.giveaway;

    // Create giveaway embed
    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle(`🎉 NEW GIVEAWAY STARTED!`)
      .setDescription(`**${title}**\n\n${description || '🎯 Click the button below to enter this amazing giveaway!'}`)
      .addFields(
        { name: '🏆 Prize', value: prize, inline: true },
        { name: '👥 Winners', value: `${winners}`, inline: true },
        { name: '⏰ Ends', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
        { name: '📊 Entries', value: '0', inline: true },
        { name: '🎭 Host', value: `<@${interaction.user.id}>`, inline: true },
        { name: '⏱️ Time Left', value: formatTimeRemaining(endTime), inline: true }
      )
      .setTimestamp(endTime)
      .setFooter({ text: `Giveaway ID: ${giveaway.id} • Ends` });

    // Add requirements field if any
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

    // Create button
    const button = new ButtonBuilder()
      .setCustomId(`giveaway_enter_${giveaway.id}`)
      .setLabel('🎉 Enter Giveaway')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    // Send giveaway message
    try {
      const giveawayMessage = await targetChannel.send({
        embeds: [embed],
        components: [row]
      });

      // Update giveaway with message ID
      GiveawayService.updateMessageId(giveaway.id, giveawayMessage.id);

      // Send success response
      const successEmbed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('✅ Giveaway Created!')
        .setDescription(`Giveaway has been created in ${targetChannel}`)
        .addFields(
          { name: 'Title', value: title, inline: true },
          { name: 'Prize', value: prize, inline: true },
          { name: 'Duration', value: formatTimeRemaining(endTime), inline: true },
          { name: 'Winners', value: `${winners}`, inline: true },
          { name: 'Giveaway ID', value: `${giveaway.id}`, inline: true },
          { name: 'Message', value: `[View Giveaway](${giveawayMessage.url})`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

      logInfo('Giveaway', `Created giveaway "${title}" (ID: ${giveaway.id}) in ${targetChannel.name} (${targetChannel.id})`);
      
      // Log command usage for dashboard activity
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'giveaway-create',
        options: { title, prize, duration: durationStr, winners, channel: targetChannel.name },
        channel: interaction.channel,
        success: true
      });
    } catch (error) {
      // If message sending fails, delete the giveaway from database
      GiveawayService.deleteGiveaway(giveaway.id);
      await interaction.editReply(`Failed to send giveaway message: ${error}`);
      
      // Log failed command usage
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'giveaway-create',
        options: { title, prize, duration: durationStr, winners },
        channel: interaction.channel,
        success: false
      });
      return;
    }
  } catch (error) {
    logError('Giveaway Create', error);
    
        try {
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while creating the giveaway.');
      } else {
        await interaction.reply({ 
          content: 'An error occurred while creating the giveaway.', 
          flags: MessageFlags.Ephemeral 
        });
      }
    } catch (replyError) {
      logError('Giveaway Create', replyError);
    }
  }
} 