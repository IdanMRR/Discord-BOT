import { ButtonInteraction, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ModalSubmitInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle, MessageFlags } from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { db } from '../../database/sqlite';

/**
 * Shows a rating modal when a user clicks the rate ticket button
 * 
 * @param interaction The button interaction that triggered this function
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function showRatingModal(interaction: ButtonInteraction) {
  try {
    // Extract ticket number from the custom ID (format: rate_ticket_XXXX)
    const ticketNumber = interaction.customId.split('_')[2];
    
    if (!ticketNumber) {
      await interaction.reply({ 
        content: 'Error: Could not determine ticket number.',
        flags: MessageFlags.Ephemeral
       });
      return false;
    }
    
    // Create the modal
    const modal = new ModalBuilder()
      .setCustomId(`ticket_rating_${ticketNumber}`)
      .setTitle(`Rate Ticket #${ticketNumber}`);
    
    // Create the rating input (1-5 stars)
    const ratingInput = new TextInputBuilder()
      .setCustomId('rating')
      .setLabel('Rating (1-5 stars)')
      .setPlaceholder('Enter a number from 1 to 5')
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(1)
      .setRequired(true);
    
    // Create the feedback input
    const feedbackInput = new TextInputBuilder()
      .setCustomId('feedback')
      .setLabel('Feedback (optional)')
      .setPlaceholder('Please share your experience with our support team...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);
    
    // Add inputs to the modal
    const ratingRow = new ActionRowBuilder<TextInputBuilder>().addComponents(ratingInput);
    const feedbackRow = new ActionRowBuilder<TextInputBuilder>().addComponents(feedbackInput);
    
    modal.addComponents(ratingRow, feedbackRow);
    
    // Show the modal
    await interaction.showModal(modal);
    
    logInfo('Ticket Rating', `Showed rating modal for ticket #${ticketNumber} to user ${interaction.user.tag}`);
    return true;
  } catch (error) {
    logError('Ticket Rating', `Error showing rating modal: ${error}`);
    return false;
  }
}

/**
 * Handles the submission of a ticket rating modal
 * 
 * @param interaction The modal submit interaction
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function handleRatingSubmission(interaction: ModalSubmitInteraction) {
  try {
    // Extract ticket number from the custom ID (format: ticket_rating_XXXX)
    const ticketNumber = interaction.customId.split('_')[2];
    
    // Get the rating and feedback from the modal
    const rating = interaction.fields.getTextInputValue('rating');
    const feedback = interaction.fields.getTextInputValue('feedback') || 'No feedback provided';
    
    // Validate rating
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      await interaction.reply({ 
        content: 'Please provide a valid rating between 1 and 5.',
        flags: MessageFlags.Ephemeral
       });
      return false;
    }
    
    // Save rating to database
    try {
      // First check if the ticket exists
      const ticketStmt = db.prepare(`
        SELECT * FROM tickets WHERE ticket_number = ? AND guild_id = ?
      `);
      
      const ticket = ticketStmt.get(parseInt(ticketNumber), interaction.guildId);
      
      if (!ticket) {
        await interaction.reply({ 
          content: 'Error: Ticket not found in the database.',
          flags: MessageFlags.Ephemeral
         });
        return false;
      }
      
      // Check if we need to add the rating column to the tickets table
      try {
        // Check if the rating column exists
        const columnCheckStmt = db.prepare(`PRAGMA table_info(tickets)`);
        const columns = columnCheckStmt.all() as Array<{name: string}>;
        
        if (!columns.some(col => col.name === 'rating')) {
          // Add rating column
          db.prepare(`ALTER TABLE tickets ADD COLUMN rating INTEGER`).run();
        }
        
        if (!columns.some(col => col.name === 'feedback')) {
          // Add feedback column
          db.prepare(`ALTER TABLE tickets ADD COLUMN feedback TEXT`).run();
        }
      } catch (columnError) {
        logError('Ticket Rating', `Error checking/adding columns: ${columnError}`);
      }
      
      // Update the ticket with the rating
      const updateStmt = db.prepare(`
        UPDATE tickets 
        SET rating = ?, feedback = ?
        WHERE ticket_number = ? AND guild_id = ?
      `);
      
      updateStmt.run(
        ratingNum,
        feedback,
        parseInt(ticketNumber),
        interaction.guildId
      );
      
      logInfo('Ticket Rating', `Saved rating ${ratingNum}/5 for ticket #${ticketNumber}`);
    } catch (dbError) {
      logError('Ticket Rating', `Database error saving rating: ${dbError}`);
      await interaction.reply({ 
        content: 'An error occurred while saving your rating. Please try again later.',
        flags: MessageFlags.Ephemeral
       });
      return false;
    }
    
    // Create a thank you embed
    const starEmoji = '⭐'.repeat(ratingNum);
    const thankYouEmbed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle('Thank You for Your Feedback!')
      .setDescription(`You rated your support experience ${ratingNum}/5 ${starEmoji}`)
      .addFields([
        { name: 'Ticket', value: `#${ticketNumber}`, inline: true },
        { name: 'Rating', value: `${ratingNum}/5 ${starEmoji}`, inline: true },
        { name: 'Your Feedback', value: feedback }
      ])
      .setTimestamp();
    
    // Reply to the user
    await interaction.reply({ 
      embeds: [thankYouEmbed],
      flags: MessageFlags.Ephemeral
     });
    
    // Send the rating to the mod log channel
    try {
      // Get settings to find log channel
      const settings = await db.prepare(`
        SELECT * FROM server_settings WHERE guild_id = ?
      `).get(interaction.guildId) as any;
      
      if (settings && settings.mod_log_channel_id) {
        const logChannel = await interaction.guild?.channels.fetch(settings.mod_log_channel_id);
        
        if (logChannel && logChannel.isTextBased()) {
          const ratingLogEmbed = new EmbedBuilder()
            .setColor(ratingNum >= 4 ? Colors.SUCCESS : (ratingNum >= 3 ? Colors.WARNING : Colors.ERROR))
            .setTitle(`Ticket Rating Received | #${ticketNumber}`)
            .setDescription(`User <@${interaction.user.id}> has rated their ticket experience`)
            .addFields([
              { name: 'Ticket', value: `#${ticketNumber}`, inline: true },
              { name: 'Rating', value: `${ratingNum}/5 ${starEmoji}`, inline: true },
              { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Feedback', value: feedback }
            ])
            .setTimestamp();
          
          await logChannel.send({ embeds: [ratingLogEmbed] });
        }
      }
    } catch (logError) {
      console.error('Error sending rating to log channel:', logError);
      // Continue even if sending to log channel fails
    }
    
    return true;
  } catch (error) {
    logError('Ticket Rating', `Error handling rating submission: ${error}`);
    
    try {
      await interaction.reply({ 
        content: 'An error occurred while processing your rating. Please try again later.',
        flags: MessageFlags.Ephemeral
       });
    } catch (replyError) {
      // If we can't reply, just log it
      console.error('Failed to send error message:', replyError);
    }
    
    return false;
  }
}

/**
 * Creates a button for rating a ticket
 * 
 * @param ticketNumber The ticket number
 * @returns A button builder for rating the ticket
 */
export function createRatingButton(ticketNumber: number | string) {
  return new ButtonBuilder()
    .setCustomId(`rate_ticket_${ticketNumber}`)
    .setLabel('Rate Your Experience')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('⭐');
}
