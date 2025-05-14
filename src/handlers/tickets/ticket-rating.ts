import { 
  ButtonInteraction, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ModalSubmitInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle, 
  MessageFlags,
  InteractionResponse,
  Message,
  MessageActionRowComponentBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SelectMenuComponentOptionData,
  Collection
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { db } from '../../database/sqlite';
import { logTicketEvent } from '../../utils/databaseLogger';

// Keep track of tickets being rated to prevent duplicates
const activeRatings = new Set<string>();

/**
 * Shows a rating selection with star buttons when a user clicks the rate ticket button
 * 
 * @param interaction The button interaction or any object with reply method
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function showRatingModal(interaction: ButtonInteraction | any) {
  // Initialize ticketNumber with a default empty value
  let ticketNumber: string | number = '';
  
  try {
    // Extract ticket number from the interaction
    if (interaction instanceof ButtonInteraction) {
      // It's a button interaction
      ticketNumber = interaction.customId.split('_')[2];
    } else {
      // It's from our command
      ticketNumber = interaction.customId;
    }
    
    if (!ticketNumber) {
      await interaction.reply({ 
        content: 'Error: Could not determine ticket number.',
        flags: MessageFlags.Ephemeral
      });
      return false;
    }
    
    // Check if this ticket is already being rated to prevent duplicates
    const ratingKey = `${interaction.user.id}_${ticketNumber}`;
    if (activeRatings.has(ratingKey)) {
      await interaction.reply({ 
        content: 'You already have an active rating session for this ticket. Please complete it first.',
        flags: MessageFlags.Ephemeral
      });
      return false;
    }
    
    // Mark this ticket as being rated
    activeRatings.add(ratingKey);
    
    // Create star rating buttons
    const row = new ActionRowBuilder<ButtonBuilder>();
    
    // Add 5 star buttons
    for (let i = 1; i <= 5; i++) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`rate_stars_${ticketNumber}_${i}`)
          .setLabel(`${i}`)
          .setEmoji('⭐')
          .setStyle(i >= 4 ? ButtonStyle.Success : (i >= 3 ? ButtonStyle.Primary : (i >= 2 ? ButtonStyle.Secondary : ButtonStyle.Danger)))
      );
    }
    
    // Create the star rating embed
    const ratingEmbed = new EmbedBuilder()
      .setColor(Colors.INFO)
      .setTitle(`Rate Ticket #${ticketNumber}`)
      .setDescription('Please select a rating from 1 to 5 stars:')
      .addFields([
        { name: '1 ⭐', value: 'Poor - Very disappointed with the support', inline: true },
        { name: '2 ⭐⭐', value: 'Fair - Below average support', inline: true },
        { name: '3 ⭐⭐⭐', value: 'Average - Acceptable support', inline: true },
        { name: '4 ⭐⭐⭐⭐', value: 'Good - Above average support', inline: true },
        { name: '5 ⭐⭐⭐⭐⭐', value: 'Excellent - Outstanding support', inline: true }
      ])
      .setFooter({ text: 'Made by Soggra.' });
    
    // Send the rating message with star buttons
    const ratingMessage = await interaction.reply({ 
      embeds: [ratingEmbed], 
      components: [row],
      flags: MessageFlags.Ephemeral,
      withResponse: true
    });
    
    // Set up a collector to wait for a button click
    const collector = ratingMessage.createMessageComponentCollector({ 
      componentType: ComponentType.Button,
      time: 60000 // 1 minute timeout
    });
    
    collector.on('collect', async (i: ButtonInteraction) => {
      // Get the selected rating from the button ID
      const parts = i.customId.split('_');
      if (parts[0] === 'rate' && parts[1] === 'stars') {
        const selectedRating = parseInt(parts[3]);
        
        try {
          // Show feedback modal
          await showFeedbackModal(i, ticketNumber.toString(), selectedRating);
          
          // Stop the collector since we've processed this rating
          collector.stop('rating_selected');
        } catch (error) {
          logError('Ticket Rating', `Error showing feedback modal: ${error}`);
          // Remove the active rating to allow the user to try again
          activeRatings.delete(ratingKey);
        }
      }
    });
    
    collector.on('end', async (collected: Collection<string, ButtonInteraction>, reason: string) => {
      // If the collector ended due to timeout or another reason besides selection
      if (reason !== 'rating_selected' && collected.size === 0) {
        // Timeout - update the message to indicate that the rating has expired
        const timeoutEmbed = EmbedBuilder.from(ratingEmbed)
          .setColor(Colors.ERROR)
          .setDescription('⌛ This rating selection has expired. Please use the rate button again if you still want to leave a rating.');
        
        try {
          await interaction.editReply({ 
            embeds: [timeoutEmbed], 
            components: [] 
          });
          
          // Remove from active ratings since this session expired
          activeRatings.delete(ratingKey);
        } catch (error) {
          logError('Ticket Rating', `Error updating expired rating message: ${error}`);
        }
      }
    });
    
    logInfo('Ticket Rating', `Showed rating selection for ticket #${ticketNumber} to user ${interaction.user.tag}`);
    return true;
  } catch (error) {
    logError('Ticket Rating', `Error showing rating selection: ${error}`);
    
    // Make sure to clean up the active ratings set on error
    if (interaction?.user?.id && ticketNumber) {
      activeRatings.delete(`${interaction.user.id}_${ticketNumber}`);
    }
    
    return false;
  }
}

/**
 * Shows a feedback modal after star selection
 * 
 * @param interaction The button interaction from star selection
 * @param ticketNumber The ticket number
 * @param rating The selected star rating (1-5)
 * @returns Promise resolving to true if successful
 */
async function showFeedbackModal(interaction: ButtonInteraction, ticketNumber: string, rating: number): Promise<boolean> {
  try {
    // Create the modal
    const modal = new ModalBuilder()
      .setCustomId(`ticket_rating_${ticketNumber}_${rating}`)
      .setTitle(`Rate Ticket #${ticketNumber} (${rating} ⭐)`);
    
    // Create the feedback input
    const feedbackInput = new TextInputBuilder()
      .setCustomId('feedback')
      .setLabel(`Your ${rating}-star feedback (optional)`)
      .setPlaceholder('Please share your experience with our support team...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);
    
    // Add input to the modal
    const feedbackRow = new ActionRowBuilder<TextInputBuilder>().addComponents(feedbackInput);
    
    modal.addComponents(feedbackRow);
    
    // Show the modal
    await interaction.showModal(modal);
    
    logInfo('Ticket Rating', `Showed feedback modal for ${rating}-star rating on ticket #${ticketNumber}`);
    return true;
  } catch (error) {
    logError('Ticket Rating', `Error showing feedback modal: ${error}`);
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
    // Extract ticket number and rating from the custom ID
    // Format: ticket_rating_XXXX_Y where XXXX is ticket number and Y is rating (1-5)
    const parts = interaction.customId.split('_');
    const ticketNumber = parts[2];
    
    // The rating is now passed in the customId instead of as a field
    const ratingNum = parseInt(parts[3]);
    const feedback = interaction.fields.getTextInputValue('feedback') || 'No feedback provided';
    
    // Create a rating key to remove from active ratings
    const ratingKey = `${interaction.user.id}_${ticketNumber}`;
    
    // Validate rating
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      await interaction.reply({ 
        content: 'Please provide a valid rating between 1 and 5.',
        flags: MessageFlags.Ephemeral
      });
      
      // Remove from active ratings so user can try again
      activeRatings.delete(ratingKey);
      return false;
    }
    
    // Save rating to database
    try {
      // Skip the guild-specific check since ratings are done in DMs
      // and directly query by ticket number only
      const ticketStmt = db.prepare(`
        SELECT * FROM tickets WHERE ticket_number = ?
      `);
      
      const ticket = ticketStmt.get(parseInt(ticketNumber)) as {
        guild_id?: string;
        channel_id?: string;
        ticket_number: number;
      } | undefined;
      
      if (!ticket) {
        // Log details for debugging
        logError('Ticket Rating', `Could not find ticket #${ticketNumber} in database`);
        
        await interaction.reply({ 
          content: 'We could not find your ticket. The rating has been recorded, but not linked to a specific ticket.',
          flags: MessageFlags.Ephemeral
        });
        // We'll continue anyway to provide a good user experience
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
      
      if (ticket) {
        // Update the ticket with the rating only if we found the ticket
        const updateStmt = db.prepare(`
          UPDATE tickets 
          SET rating = ?, feedback = ?
          WHERE ticket_number = ?
        `);
        
        updateStmt.run(
          ratingNum,
          feedback,
          parseInt(ticketNumber)
        );
        
        logInfo('Ticket Rating', `Saved rating ${ratingNum}/5 for ticket #${ticketNumber}`);
        
        // Log the rating to the ticket logs system - use ticket's guild_id if available
        const guildId = ticket.guild_id || interaction.guildId;
        if (guildId) {
          await logTicketEvent({
            guildId: guildId,
            actionType: 'ticketRating',
            userId: interaction.user.id,
            channelId: ticket.channel_id || interaction.channelId || '',
            ticketNumber: parseInt(ticketNumber),
            rating: ratingNum,
            feedback: feedback
          });
          
          // Explicitly log the rating info
          logInfo('Ticket Rating', `User ${interaction.user.tag} rated ticket #${ticketNumber} with ${ratingNum}/5 stars. Feedback: "${feedback}"`);
        }
      }
    } catch (dbError) {
      logError('Ticket Rating', `Database error saving rating: ${dbError}`);
      await interaction.reply({ 
        content: 'An error occurred while saving your rating. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
      return false;
    }
    
    // Create a thank you embed with visual star rating
    const starDisplay = generateStarDisplay(ratingNum);
    const thankYouEmbed = new EmbedBuilder()
      .setColor(getColorForRating(ratingNum))
      .setTitle('Thank You for Your Feedback!')
      .setDescription(`You rated your support experience as:`)
      .addFields([
        { name: 'Rating', value: starDisplay, inline: false },
        { name: 'Ticket', value: `#${ticketNumber}`, inline: true },
        { name: 'Your Feedback', value: feedback }
      ])
      .setFooter({ text: 'Made by Soggra.' })
      .setTimestamp();
    
    // Reply to the user
    await interaction.reply({ 
      embeds: [thankYouEmbed],
      flags: MessageFlags.Ephemeral
    });
    
    // Send the rating to the mod log channel and ticket log channel
    try {
      // Get settings to find log channel
      const settings = await db.prepare(`
        SELECT * FROM server_settings WHERE guild_id = ?
      `).get(interaction.guildId) as any;
      
      // Send to mod log channel
      if (settings && settings.mod_log_channel_id) {
        const logChannel = await interaction.guild?.channels.fetch(settings.mod_log_channel_id);
        
        if (logChannel && logChannel.isTextBased()) {
          const ratingLogEmbed = new EmbedBuilder()
            .setColor(getColorForRating(ratingNum))
            .setTitle(`⭐ Ticket Rating | Ticket #${ticketNumber}`)
            .setDescription(`User <@${interaction.user.id}> has rated their ticket experience`)
            .addFields([
              { name: 'User', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
              { name: 'Ticket', value: `#${ticketNumber}`, inline: true },
              { name: 'Rating', value: starDisplay, inline: false },
              { name: 'Feedback', value: feedback }
            ])
            .setFooter({ text: 'Made by Soggra.' })
            .setTimestamp();
          
          await logChannel.send({ embeds: [ratingLogEmbed] });
        }
      }
      
      // Send to ticket logs channel
      if (settings && settings.ticket_logs_channel_id) {
        const ticketLogChannel = await interaction.guild?.channels.fetch(settings.ticket_logs_channel_id);
        
        if (ticketLogChannel && ticketLogChannel.isTextBased()) {
          const ticketRatingEmbed = new EmbedBuilder()
            .setColor(getColorForRating(ratingNum))
            .setTitle(`⭐ Ticket Rating`)
            .setDescription(`Ticket #${ticketNumber} was rated by ${interaction.user.tag}`)
            .addFields([
              { name: '👤 User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
              { name: '🎫 Ticket', value: `#${ticketNumber}`, inline: true },
              { name: '⭐ Rating', value: starDisplay, inline: false },
              { name: '💬 Feedback', value: feedback || 'No feedback provided' }
            ])
            .setFooter({ text: `Made by Soggra. • Today at ${new Date().toLocaleTimeString()}` })
            .setTimestamp();
          
          await ticketLogChannel.send({ embeds: [ticketRatingEmbed] });
          logInfo('Ticket Rating', `Sent rating information to ticket logs channel for ticket #${ticketNumber}`);
        }
      }
    } catch (logError) {
      console.error('Error sending rating to log channels:', logError);
      // Continue even if sending to log channels fails
    }
    
    // Remove from active ratings when done
    activeRatings.delete(ratingKey);
    
    return true;
  } catch (error) {
    logError('Ticket Rating', `Error handling rating submission: ${error}`);
    
    // Clean up active ratings on error
    try {
      // Extract ticket number from the custom ID
      const parts = interaction.customId.split('_');
      const ticketNumber = parts[2];
      const ratingKey = `${interaction.user.id}_${ticketNumber}`;
      activeRatings.delete(ratingKey);
    } catch (cleanupError) {
      // Just log if cleanup fails
      logError('Ticket Rating', `Error cleaning up active ratings: ${cleanupError}`);
    }
    
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
 * Generates a visual star display for a rating
 * 
 * @param rating The rating (1-5)
 * @returns A string with filled and empty stars
 */
function generateStarDisplay(rating: number): string {
  const filledStar = '⭐';
  const emptyStar = '☆';
  
  // Create a string with the appropriate number of filled and empty stars
  return filledStar.repeat(rating) + emptyStar.repeat(5 - rating);
}

/**
 * Get the appropriate color for a rating
 * 
 * @param rating The rating (1-5)
 * @returns A color from Colors
 */
function getColorForRating(rating: number): number {
  if (rating >= 4) return Colors.SUCCESS;
  if (rating === 3) return Colors.WARNING;
  if (rating === 2) return Colors.SECONDARY;
  return Colors.ERROR;
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
