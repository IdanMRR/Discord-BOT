import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { formatIsraeliTime } from '../../utils/time-formatter';

/**
 * FAQ entries for the ticket system
 * Each entry has a question and answer
 */
const faqEntries = [
  {
    question: 'How do I create a ticket?',
    answer: 'Click the "Create Ticket" button in the ticket panel, select a category that best matches your request, and a new ticket channel will be created for you.'
  },
  {
    question: 'How long does it take to get a response?',
    answer: 'Our staff team typically responds within a few hours. Response times may vary based on staff availability and the complexity of your request.'
  },
  {
    question: 'Can I add other users to my ticket?',
    answer: 'Yes, staff members can add other users to your ticket using the `/adduser` command if needed for resolving your issue.'
  },
  {
    question: 'How do I close my ticket?',
    answer: 'You can close your ticket by clicking the "Close Ticket" button in your ticket channel. You can also reopen it later if needed.'
  },
  {
    question: 'What information should I include in my ticket?',
    answer: 'Please provide as much detail as possible about your request or issue. Include any relevant information such as usernames, dates, screenshots, or error messages to help us assist you more effectively.'
  },
  {
    question: 'Can I have multiple tickets open at once?',
    answer: 'Yes, you can have multiple tickets open for different issues. However, please avoid creating multiple tickets for the same issue.'
  }
];

/**
 * Handles the FAQ button click interaction
 * Displays a list of frequently asked questions and answers
 * 
 * @param interaction The button interaction that triggered this function
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function handleFaqButtonClick(interaction: ButtonInteraction) {
  try {
    logInfo('Tickets', `User ${interaction.user.tag} (${interaction.user.id}) clicked the FAQ button`);
    
    // Format the current time for the footer
    const timeString = formatIsraeliTime();
    
    // Create the FAQ embed
    const faqEmbed = new EmbedBuilder()
      .setTitle('📚 Frequently Asked Questions')
      .setDescription('Here are answers to some common questions about our ticket system. If you need further assistance, please create a ticket.')
      .setColor(Colors.INFO)
      .setFooter({ text: `Made by Soggra. • Today at ${timeString}` });
    
    // Add each FAQ entry as a field
    faqEntries.forEach((entry, index) => {
      faqEmbed.addFields([
        { 
          name: `${index + 1}. ${entry.question}`, 
          value: entry.answer 
        }
      ]);
    });
    
    // Create a button to create a ticket
    const ticketButton = new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel('Create Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫');
    
    // Create a button to dismiss the FAQ
    const dismissButton = new ButtonBuilder()
      .setCustomId('dismiss_faq')
      .setLabel('Dismiss')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✖️');
    
    // Add buttons to the action row
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(ticketButton, dismissButton);
    
    // Send the FAQ embed as an ephemeral message
    await interaction.reply({
      embeds: [faqEmbed],
      components: [row],
      flags: MessageFlags.Ephemeral
    });
    
    return true;
  } catch (error) {
    logError('FAQ Button', error);
    
    // Handle error gracefully
    try {
      await interaction.reply({ 
        content: 'An error occurred while displaying the FAQ. Please try again later or create a ticket for assistance.',
        flags: MessageFlags.Ephemeral
       });
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
    
    return false;
  }
}

/**
 * Handles the dismiss FAQ button click
 * Simply deletes the FAQ message
 * 
 * @param interaction The button interaction that triggered this function
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function handleDismissFaqButtonClick(interaction: ButtonInteraction) {
  try {
    // Delete the FAQ message
    await interaction.update({
      content: 'FAQ dismissed.',
      embeds: [],
      components: []
    });
    
    return true;
  } catch (error) {
    logError('Dismiss FAQ Button', error);
    return false;
  }
}
