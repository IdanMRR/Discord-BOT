import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from 'discord.js';
import { createInfoEmbed, Colors } from '../../utils/embeds';
import { logCommandUsage } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('avatar')
  .setDescription('Display a user\'s avatar in high quality')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user whose avatar to display (defaults to yourself)')
      .setRequired(false))
  .addStringOption(option =>
    option
      .setName('format')
      .setDescription('Image format preference')
      .setRequired(false)
      .addChoices(
        { name: '🖼️ PNG (Best Quality)', value: 'png' },
        { name: '📸 JPEG (Smaller Size)', value: 'jpg' },
        { name: '✨ WebP (Modern)', value: 'webp' },
        { name: '🎭 GIF (Animated)', value: 'gif' }
      ))
  .addIntegerOption(option =>
    option
      .setName('size')
      .setDescription('Avatar size in pixels')
      .setRequired(false)
      .addChoices(
        { name: '64x64 (Tiny)', value: 64 },
        { name: '128x128 (Small)', value: 128 },
        { name: '256x256 (Medium)', value: 256 },
        { name: '512x512 (Large)', value: 512 },
        { name: '1024x1024 (Extra Large)', value: 1024 },
        { name: '2048x2048 (Maximum)', value: 2048 },
        { name: '4096x4096 (Ultra HD)', value: 4096 }
      ));

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();
    
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const format = interaction.options.getString('format') || 'png';
    const size = interaction.options.getInteger('size') || 1024;
    const guild = interaction.guild;
    
    // Get member if in guild for server avatar
    let member = null;
    if (guild) {
      try {
        member = await guild.members.fetch(targetUser.id);
      } catch (error) {
        // User not in guild
      }
    }
    
    // Get different avatar URLs
    const globalAvatar = targetUser.displayAvatarURL({ 
      size: size as any, 
      extension: format as any,
      forceStatic: format !== 'gif'
    });
    
    const serverAvatar = member?.avatarURL({ 
      size: size as any, 
      extension: format as any,
      forceStatic: format !== 'gif'
    });
    
    // Create main embed
    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor || Colors.INFO)
      .setTitle(`🖼️ ${targetUser.username}'s Avatar`)
      .setDescription(`High quality avatar in **${format.toUpperCase()}** format at **${size}x${size}** pixels`)
      .setImage(serverAvatar || globalAvatar)
      .setTimestamp();
    
    // Add user info
    embed.addFields([
      { 
        name: '👤 User Information', 
        value: [
          `**Username:** ${targetUser.username}`,
          `**Display Name:** ${targetUser.displayName}`,
          `**User ID:** ${targetUser.id}`
        ].join('\n'), 
        inline: true 
      },
      { 
        name: '🎨 Avatar Details', 
        value: [
          `**Format:** ${format.toUpperCase()}`,
          `**Size:** ${size}x${size}px`,
          `**Type:** ${serverAvatar ? 'Server Avatar' : 'Global Avatar'}`,
          `**Animated:** ${globalAvatar.includes('.gif') ? 'Yes' : 'No'}`
        ].join('\n'), 
        inline: true 
      }
    ]);
    
    // Add different format links
    const formatLinks = [];
    const formats = ['png', 'jpg', 'webp', 'gif'];
    
    for (const fmt of formats) {
      const url = targetUser.displayAvatarURL({ 
        size: size as any, 
        extension: fmt as any,
        forceStatic: fmt !== 'gif'
      });
      formatLinks.push(`[${fmt.toUpperCase()}](${url})`);
    }
    
    embed.addFields([
      { 
        name: '🔗 Download Links', 
        value: formatLinks.join(' • '), 
        inline: false 
      }
    ]);
    
    // Create action buttons
    const row = new ActionRowBuilder<ButtonBuilder>();
    
    // Add download button
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Open Original')
        .setStyle(ButtonStyle.Link)
        .setURL(globalAvatar)
        .setEmoji('🔗')
    );
    
    // Add server avatar button if different
    if (serverAvatar && serverAvatar !== globalAvatar) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Server Avatar')
          .setStyle(ButtonStyle.Link)
          .setURL(serverAvatar)
          .setEmoji('🏠')
      );
    }
    
    // Add different size buttons
    const sizeButtons = new ActionRowBuilder<ButtonBuilder>();
    
    if (size !== 512) {
      sizeButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`avatar-resize-${targetUser.id}-512`)
          .setLabel('512px')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📐')
      );
    }
    
    if (size !== 1024) {
      sizeButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`avatar-resize-${targetUser.id}-1024`)
          .setLabel('1024px')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📏')
      );
    }
    
    if (size !== 2048) {
      sizeButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`avatar-resize-${targetUser.id}-2048`)
          .setLabel('2048px')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊')
      );
    }
    
    // Add avatar history button for server members
    if (member) {
      sizeButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`avatar-history-${targetUser.id}`)
          .setLabel('History')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📚')
      );
    }
    
    const components = [row];
    if (sizeButtons.components.length > 0) {
      components.push(sizeButtons);
    }
    
    // Set footer
    const footerText = member ? `Server Member • ${format.toUpperCase()} ${size}px` : `External User • ${format.toUpperCase()} ${size}px`;
    embed.setFooter({ 
      text: footerText,
      iconURL: guild?.iconURL() || undefined
    });
    
    // Set author
    embed.setAuthor({
      name: `${targetUser.username}${member?.nickname ? ` (${member.nickname})` : ''}`,
      iconURL: targetUser.displayAvatarURL({ size: 64 })
    });
    
    await interaction.editReply({ 
      embeds: [embed], 
      components: components
    });
    
    // Log command usage
    if (guild) {
      await logCommandUsage({
        guild: guild,
        user: interaction.user,
        command: 'avatar',
        options: { target: targetUser.tag, format, size },
        channel: interaction.channel,
        success: true
      });
    }
    
  } catch (error) {
    console.error('Error in avatar command:', error);
    
    const errorEmbed = createInfoEmbed(
      'Error',
      'There was an error retrieving the avatar. Please try again.'
    );
    errorEmbed.setColor(Colors.ERROR);
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
} 