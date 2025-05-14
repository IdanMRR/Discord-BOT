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
    description: 'Request or claim server donation rewards',
    emoji: '💰',
    color: Colors.DONATION, // Green
    priority: 'medium',
    expectedResponseTime: '24 hours',
    staffRoles: [] as string[], // Will be populated with role IDs that should be pinged for this category
  },
  {
    id: 'technical',
    label: 'Technical Support',
    description: 'Get help with technical issues, bugs or errors',
    emoji: '🔧',
    color: Colors.ERROR, // Red
    priority: 'high',
    expectedResponseTime: '12 hours',
    staffRoles: [] as string[],
  },
  {
    id: 'account',
    label: 'Account Support',
    description: 'Access, permissions, or account-related issues',
    emoji: '👤',
    color: Colors.PRIMARY, // Blue
    priority: 'medium',
    expectedResponseTime: '24 hours',
    staffRoles: [] as string[],
  },
  {
    id: 'question',
    label: 'General Question',
    description: 'Ask a question about the server or community',
    emoji: '❓',
    color: Colors.WARNING, // Yellow
    priority: 'low',
    expectedResponseTime: '48 hours',
    staffRoles: [] as string[],
  },
  {
    id: 'report',
    label: 'Report User',
    description: 'Report a user for breaking server rules',
    emoji: '🚨',
    color: Colors.ERROR, // Red
    priority: 'high',
    expectedResponseTime: '12 hours',
    staffRoles: [] as string[],
  },
  {
    id: 'feedback',
    label: 'Feedback',
    description: 'Provide feedback or suggestions for the server',
    emoji: '📝',
    color: Colors.SUCCESS, // Green
    priority: 'low',
    expectedResponseTime: '48 hours',
    staffRoles: [] as string[],
  },
  {
    id: 'other',
    label: 'Other',
    description: 'For any other inquiries not covered above',
    emoji: '🔍',
    color: Colors.SECONDARY, // Grey
    priority: 'medium',
    expectedResponseTime: '24 hours',
    staffRoles: [] as string[],
  }
];

/**
 * Get the priority level display information
 */
export function getPriorityInfo(priority: string) {
  switch (priority.toLowerCase()) {
    case 'high':
      return { emoji: '🔴', label: 'High', color: Colors.ERROR };
    case 'medium':
      return { emoji: '🟡', label: 'Medium', color: Colors.WARNING };
    case 'low':
      return { emoji: '🟢', label: 'Low', color: Colors.SUCCESS };
    default:
      return { emoji: '⚪', label: 'Normal', color: Colors.PRIMARY };
  }
}

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
      .setTitle('📋 Create a Support Ticket')
      .setDescription(
        'Thank you for reaching out to our support team. To help us assist you better, please select the most appropriate category for your request from the dropdown menu below.\n\n' +
        'This helps us direct your ticket to the right team members and provide faster assistance.'
      )
      .addFields([
        {
          name: '⏱️ Response Times',
          value: 'Our team typically responds within 24 hours, though response times may vary based on ticket priority and staff availability.',
          inline: false
        },
        {
          name: '💡 Helpful Tips',
          value: '• Provide as much detail as possible about your issue\n• Include screenshots if relevant\n• Be specific about what you need help with',
          inline: false
        }
      ])
      .setFooter({ text: `Made by Soggra. • Today at ${timeString}` });

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
    
    try {
      // Create an error embed
      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setTitle('❌ Error Creating Ticket')
        .setDescription('An error occurred while displaying ticket categories. Please try again later or contact a staff member.')
        .setFooter({ text: 'Made by Soggra.' })
        .setTimestamp();
        
      // Send the error as an ephemeral message
      await interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral
      });
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
    
    return false;
  }
}

/**
 * Get a category by its ID
 */
export function getCategoryById(categoryId: string) {
  return ticketCategories.find(category => category.id === categoryId);
}

/**
 * Assign staff roles to specific ticket categories
 * This should be called during setup with the appropriate role IDs
 */
export function assignStaffRolesToCategories(roleAssignments: {categoryId: string, roleIds: string[]}[]) {
  for (const assignment of roleAssignments) {
    const category = getCategoryById(assignment.categoryId);
    if (category) {
      category.staffRoles = assignment.roleIds;
    }
  }
}
