import { 
  ButtonInteraction, 
  ActionRowBuilder, 
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle, 
  MessageFlags,
  ComponentType,
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
 * @param interaction The button interaction
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function showRatingModal(interaction: ButtonInteraction | any) {
  // Extract ticket number from the interaction first
  let ticketNumber: string | number = '';
  
  try {
    if (interaction instanceof ButtonInteraction) {
      ticketNumber = interaction.customId.split('_')[2];
    } else {
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
    
      // Check if interaction is already deferred by main handler
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const ratingMessage = await interaction.editReply({ 
        embeds: [ratingEmbed], 
        components: [row]
      });
      
      console.log(`[Debug] Created rating message for ticket ${ticketNumber}, setting up collector...`);
      
      const collector = ratingMessage.createMessageComponentCollector({ 
        componentType: ComponentType.Button,
        filter: (i: ButtonInteraction) => {
          const shouldCollect = i.customId.startsWith(`rate_stars_${ticketNumber}_`) && i.user.id === interaction.user.id;
          console.log(`[Debug] Collector filter - CustomId: ${i.customId}, User: ${i.user.id}, Expected User: ${interaction.user.id}, Should Collect: ${shouldCollect}`);
          return shouldCollect;
        },
        time: 60000
      });
    
    console.log(`[Debug] Collector created successfully for ticket ${ticketNumber}`);
    
    collector.on('collect', async (i: ButtonInteraction) => {
      console.log(`[Debug] Collector collected interaction: ${i.customId}`);
      // Get the selected rating from the button ID
      const parts = i.customId.split('_');
      if (parts[0] === 'rate' && parts[1] === 'stars') {
        const selectedRating = parseInt(parts[3]);
        console.log(`[Debug] Processing rating: ${selectedRating} for ticket ${ticketNumber}`);
        
        try {
          // Save rating directly to database without feedback modal
          await saveRatingDirectly(i, ticketNumber.toString(), selectedRating);
          
          // Stop the collector since we've processed this rating
          collector.stop('rating_selected');
        } catch (error) {
          logError('Ticket Rating', `Error saving rating: ${error}`);
          // Remove the active rating to allow the user to try again
          activeRatings.delete(ratingKey);
        }
      }
    });
    
    collector.on('end', async (collected: Collection<string, ButtonInteraction>, reason: string) => {
      console.log(`[Debug] Collector ended for ticket ${ticketNumber} - Reason: ${reason}, Collected: ${collected.size} interactions`);
      
      // If the collector ended due to timeout or another reason besides selection
      if (reason !== 'rating_selected' && collected.size === 0) {
        console.log(`[Debug] Collector timed out or failed for ticket ${ticketNumber}`);
        
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

/**
 * Saves a rating directly to the database and shows a thank you message
 * 
 * @param interaction The button interaction from star selection
 * @param ticketNumber The ticket number
 * @param rating The selected star rating (1-5)
 * @returns Promise resolving to true if successful
 */
async function saveRatingDirectly(interaction: ButtonInteraction, ticketNumber: string, rating: number): Promise<boolean> {
  try {
    const feedback = 'No feedback provided'; // Since we're not asking for feedback
    
    // Create a rating key to remove from active ratings
    const ratingKey = `${interaction.user.id}_${ticketNumber}`;
    
    // Validate rating
    if (isNaN(rating) || rating < 1 || rating > 5) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'Please provide a valid rating between 1 and 5.',
          flags: MessageFlags.Ephemeral
        });
      }
      
      // Remove from active ratings so user can try again
      activeRatings.delete(ratingKey);
      return false;
    }
    
    // Save rating to database
    try {
      // Find the ticket
      const ticketStmt = db.prepare(`
        SELECT * FROM tickets WHERE ticket_number = ?
      `);
      
      const ticket = ticketStmt.get(parseInt(ticketNumber)) as {
        id: number;
        guild_id?: string;
        channel_id?: string;
        ticket_number: number;
      } | undefined;
      
      if (!ticket) {
        logError('Ticket Rating', `Could not find ticket #${ticketNumber} in database`);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: 'We could not find your ticket. Please contact support.',
            flags: MessageFlags.Ephemeral
          });
        }
        // Remove from active ratings
        activeRatings.delete(ratingKey);
        return false;
      }
      
      // Check if rating and feedback columns exist, add them if they don't
      try {
        const columnCheckStmt = db.prepare(`PRAGMA table_info(tickets)`);
        const columns = columnCheckStmt.all() as Array<{name: string}>;
        
        if (!columns.some(col => col.name === 'rating')) {
          db.prepare(`ALTER TABLE tickets ADD COLUMN rating INTEGER`).run();
        }
        
        if (!columns.some(col => col.name === 'feedback')) {
          db.prepare(`ALTER TABLE tickets ADD COLUMN feedback TEXT`).run();
        }
      } catch (columnError) {
        logError('Ticket Rating', `Error checking/adding columns: ${columnError}`);
      }
      
      // Update the ticket with the rating
      const updateStmt = db.prepare(`
        UPDATE tickets 
        SET rating = ?, feedback = ?
        WHERE ticket_number = ?
      `);
      
      updateStmt.run(rating, feedback, parseInt(ticketNumber));
      
      logInfo('Ticket Rating', `Saved rating ${rating}/5 for ticket #${ticketNumber}`);
      
      // Log the rating to the ticket logs system
      if (ticket.guild_id) {
        await logTicketEvent({
          guildId: ticket.guild_id,
          actionType: 'ticketRating',
          userId: interaction.user.id,
          channelId: ticket.channel_id || interaction.channelId || '',
          ticketNumber: parseInt(ticketNumber),
          rating: rating,

        });
        
        logInfo('Ticket Rating', `User ${interaction.user.tag} rated ticket #${ticketNumber} with ${rating}/5 stars.`);
      }
    } catch (dbError) {
      logError('Ticket Rating', `Database error saving rating: ${dbError}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred while saving your rating. Please try again later.',
          flags: MessageFlags.Ephemeral
        });
      }
      // Remove from active ratings
      activeRatings.delete(ratingKey);
      return false;
    }
    
    // Create a thank you embed
    const starDisplay = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
    const thankYouEmbed = new EmbedBuilder()
      .setColor(getColorForRating(rating))
      .setTitle('✅ Thank You for Your Feedback!')
      .addFields([
        { name: 'Rating', value: `${rating}/5 ${starDisplay}`, inline: false },
        { name: 'Ticket', value: `#${ticketNumber}`, inline: true },
        { name: 'Status', value: '✅ Rating saved successfully!', inline: true }
      ])
      .setFooter({ text: 'Made by Soggra.' })
      .setTimestamp();
    
    // Update the interaction with the thank you message
    if (!interaction.replied && !interaction.deferred) {
      await interaction.update({ 
        embeds: [thankYouEmbed],
        components: [] // Remove the rating buttons
      });
    }
    
    // Send the rating to log channels
    try {
      const settings = await db.prepare(`
        SELECT * FROM server_settings WHERE guild_id = ?
      `).get(interaction.guildId) as any;
      
      if (settings && settings.ticket_logs_channel_id) {
        const logChannel = await interaction.guild?.channels.fetch(settings.ticket_logs_channel_id);
        
        if (logChannel && logChannel.isTextBased()) {
          const ratingLogEmbed = new EmbedBuilder()
            .setColor(getColorForRating(rating))
            .setTitle(`⭐ Ticket Rating | Ticket #${ticketNumber}`)
            .setDescription(`User <@${interaction.user.id}> has rated their ticket experience`)
            .addFields([
              { name: 'User', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
              { name: 'Ticket', value: `#${ticketNumber}`, inline: true },
              { name: 'Rating', value: `${rating}/5 ${starDisplay}`, inline: false }
            ])
            .setFooter({ text: 'Made by Soggra.' })
            .setTimestamp();
          
          await logChannel.send({ embeds: [ratingLogEmbed] });
        }
      }
    } catch (logError) {
      console.error('Error sending rating to ticket log channel:', logError);
    }
    
    // Remove from active ratings when done
    activeRatings.delete(ratingKey);
    
    return true;
  } catch (error) {
    logError('Ticket Rating', `Error in saveRatingDirectly: ${error}`);
    
    // Clean up active ratings on error
    try {
      const ratingKey = `${interaction.user.id}_${ticketNumber}`;
      activeRatings.delete(ratingKey);
    } catch (cleanupError) {
      logError('Ticket Rating', `Error cleaning up active ratings: ${cleanupError}`);
    }
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'An error occurred while processing your rating. Please try again later.',
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
    
    return false;
  }
}
