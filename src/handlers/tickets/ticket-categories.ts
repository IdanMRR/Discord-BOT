import { ButtonInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, MessageFlags, EmbedBuilder } from 'discord.js';
import { Colors } from '../../utils/embeds';

/**
 * Ticket category configuration
 * Each category has a unique identifier, display name, description, emoji, and color
 */
export const ticketCategories = [
  {
    id: 'donation',
    label: 'Donation',
    description: 'Use this ticket to receive your donations on the server',
    emoji: '💰',
    color: Colors.DONATION, // Green
  },
  {
    id: 'question',
    label: 'Question',
    description: 'Ask a question or get an answer related to the server',
    emoji: '❓',
    color: Colors.WARNING, // Yellow
  },
  {
    id: 'support',
    label: 'Support',
    description: 'Get help with any issues you might be experiencing',
    emoji: '🛠️',
    color: Colors.SUPPORT, // Blue
  },
  {
    id: 'other',
    label: 'Other',
    description: 'For any other inquiries not covered by the categories above',
    emoji: '📝',
    color: Colors.PRIMARY, // Blurple
  }
];

/**
 * Displays a professional category selection menu when a user creates a ticket
 * This presents users with a dropdown of available ticket categories
 * 
 * @param interaction The button interaction that triggered this function
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function showCategorySelection(interaction: ButtonInteraction) {
  try {
    // Get current time for footer timestamp
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Create the category selection menu with all available options
    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId('ticket_category_select')
      .setPlaceholder('Select a category for your ticket')
      .addOptions(
        ticketCategories.map(category => 
          new StringSelectMenuOptionBuilder()
            .setLabel(category.label)
            .setDescription(category.description)
            .setValue(category.id)
            .setEmoji(category.emoji)
        )
      );

    // Create the action row with the select menu
    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(categorySelect);
    
    // Create a professional embed to explain the category selection
    const embed = new EmbedBuilder()
      .setColor(Colors.TICKETS)
      .setTitle('📋 Select a Ticket Category')
      .setDescription(
        'Please select the most appropriate category for your ticket from the dropdown menu below.\n\n' +
        'This helps us route your request to the right team members and provide faster assistance.'
      )
      .setFooter({ text: `Coded by IdanMR • Today at ${timeString}` });

    // If the guild has an icon, add it as a thumbnail
    if (interaction.guild?.iconURL()) {
      embed.setThumbnail(interaction.guild.iconURL({ size: 128 }) || null);
    }

    // Send the selection menu as an ephemeral message (only visible to the user)
    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      flags: MessageFlags.Ephemeral
    });
    
    return true;
  } catch (error) {
    console.error('Error showing category selection:', error);
    return false;
  }
}

/**
 * Get a category by its ID
 */
export function getCategoryById(categoryId: string) {
  return ticketCategories.find(category => category.id === categoryId);
}
