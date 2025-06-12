import { 
  TextChannel, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  User, 
  MessageCreateOptions,
  PermissionsBitField,
  ButtonInteraction,
  MessageFlags
} from 'discord.js';
import { Colors } from './embeds';
import { logInfo, logError } from './logger';
import { ServerSettingsService } from '../database/services/serverSettingsService';

// Add new colors for staff messages
const STAFF_COLOR = 0x5865F2;  // Discord Blurple for staff messages
const MUTED_COLOR = 0x4F545C;  // Gray for restricted content

/**
 * Sends a staff-only message in a ticket channel
 * @param channel The ticket channel to send the message in
 * @param sender The staff member sending the message
 * @param content The message content
 * @returns Promise with the sent message or null if failed
 */
export async function sendStaffOnlyMessage(
  channel: TextChannel,
  sender: User,
  content: string
): Promise<any> {
  try {
    // Create the restricted message embed
    const restrictedEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${sender.username} [STAFF]`,
        iconURL: sender.displayAvatarURL()
      })
      .setDescription(content)
      .setColor(STAFF_COLOR)
      .setTimestamp();

    // Create a unique ID for this staff message
    const messageId = `view_staff_msg_${Date.now()}`;
    
    // Create view request button
    const viewButton = new ButtonBuilder()
      .setCustomId(messageId)
      .setLabel('Click here to view this message')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(viewButton);

    // Create public notification embed
    const publicEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${sender.username} [STAFF]`,
        iconURL: sender.displayAvatarURL()
      })
      .setDescription('You do not have permission to view this message.')
      .setColor(MUTED_COLOR)
      .setTimestamp();

    // Send the message with permission checks
    const messageOptions: MessageCreateOptions = {
      embeds: [publicEmbed],
      components: [row]
    };

    const message = await channel.send(messageOptions);

    // Store the actual content in the button custom ID
    // We're storing it by adding it to a Map that maps button ID to content
    // This avoids exposing the content in the client
    staffMessageCache.set(messageId, {
      content,
      senderId: sender.id,
      senderName: sender.username,
      senderAvatar: sender.displayAvatarURL(),
      timestamp: new Date().toISOString()
    });

    logInfo('Ticket System', `Sent staff-only message in ${channel.name}`);
    return message;
  } catch (error) {
    logError('Ticket System', `Failed to send staff-only message: ${error}`);
    return null;
  }
}

// Cache to store staff message content (this would be cleared on bot restart)
export const staffMessageCache = new Map<string, {
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  timestamp: string;
}>();

/**
 * Handles a button click to view a staff message
 * @param interaction The button interaction
 */
export async function handleViewStaffMessage(interaction: ButtonInteraction): Promise<void> {
  try {
    const buttonId = interaction.customId;
    const messageData = staffMessageCache.get(buttonId);

    if (!messageData) {
      await interaction.reply({ 
        content: 'This message is no longer available.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Check if user is staff
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    const isStaff = member?.permissions.has(PermissionsBitField.Flags.ManageMessages) || 
                    member?.roles.cache.some(r => r.name.toLowerCase().includes('staff'));

    if (!isStaff) {
      await interaction.reply({ 
        content: 'You do not have permission to view this message [Admin only].',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Create the full message embed for staff
    const fullEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${messageData.senderName} [STAFF]`,
        iconURL: messageData.senderAvatar
      })
      .setDescription(messageData.content)
      .setColor(STAFF_COLOR)
      .setFooter({ text: 'Staff-only message' })
      .setTimestamp(new Date(messageData.timestamp));

    await interaction.reply({ 
      embeds: [fullEmbed], 
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    logError('Ticket System', `Error handling view staff message: ${error}`);
    await interaction.reply({ 
      content: 'An error occurred while retrieving this message.',
      flags: MessageFlags.Ephemeral
    });
  }
} 