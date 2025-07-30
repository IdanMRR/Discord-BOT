import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  MessageFlags, 
  EmbedBuilder 
} from 'discord.js';
import { Colors, createErrorEmbed } from '../../utils/embeds';
import { db } from '../../database/sqlite';
import { showRatingModal } from '../../handlers/tickets/ticket-rating';
import { logError, logInfo } from '../../utils/logger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-rate')
    .setDescription('Rate a closed ticket and provide feedback')
    .addIntegerOption(option => 
      option
        .setName('ticket_number')
        .setDescription('The ticket number to rate')
        .setRequired(true)
        .setMinValue(1))
    .addIntegerOption(option => 
      option
        .setName('rating')
        .setDescription('Your rating from 1-5 stars')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5))
    .addStringOption(option => 
      option
        .setName('feedback')
        .setDescription('Optional feedback about your support experience')
        .setRequired(false)),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Get the ticket number
      const ticketNumber = interaction.options.getInteger('ticket_number', true);
      
      // Check if the ticket exists and belongs to this user
      const ticket = db.prepare(`
        SELECT * FROM tickets
        WHERE ticket_number = ? AND user_id = ?
      `).get(ticketNumber, interaction.user.id) as { 
        id: number; 
        status: string; 
        guild_id: string;
        channel_id: string;
      } | undefined;
      
      if (!ticket) {
        await interaction.reply({ 
          embeds: [createErrorEmbed(
            'Ticket Not Found',
            `You don't have a ticket with number #${ticketNumber} or you're not the ticket creator.`
          )],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
            // Check if rating and feedback were provided directly
      const rating = interaction.options.getInteger('rating');
      const feedback = interaction.options.getString('feedback');
      
      if (rating) {
        // Process direct rating
        try {
          // Update the ticket with the rating
          db.prepare(`
            UPDATE tickets 
            SET rating = ?, feedback = ?
            WHERE ticket_number = ? AND user_id = ?
          `).run(
            rating,
            feedback || 'No feedback provided',
            ticketNumber,
            interaction.user.id
          );
          
          // Log the rating
          const { logTicketEvent } = await import('../../utils/databaseLogger');
          await logTicketEvent({
            guildId: ticket.guild_id,
            actionType: 'ticketRating',
            userId: interaction.user.id,
            channelId: ticket.channel_id,
            ticketNumber: ticketNumber,
            rating: rating,
            feedback: feedback || 'No feedback provided'
          });
          
          // Log to console
          logInfo('Ticket Rating', `User ${interaction.user.tag} rated ticket #${ticketNumber} with ${rating}/5 stars. Feedback: "${feedback || 'No feedback provided'}"`);
          
          // Create a thank you embed
          const starEmoji = '⭐'.repeat(rating);
          const thankYouEmbed = new EmbedBuilder()
            .setColor(Colors.SUCCESS)
            .setTitle('Thank You for Your Feedback!')
            .setDescription(`You rated your support experience ${rating}/5 ${starEmoji}`)
            .addFields([
              { name: 'Ticket', value: `#${ticketNumber}`, inline: true },
              { name: 'Rating', value: `${rating}/5 ${starEmoji}`, inline: true },
              { name: 'Your Feedback', value: feedback || 'No feedback provided' }
            ])
            .setTimestamp();
          
          await interaction.reply({ 
            embeds: [thankYouEmbed],
            flags: MessageFlags.Ephemeral
          });
        } catch (error) {
          logError('Ticket Rate', `Error rating ticket: ${error}`);
          await interaction.reply({ 
            embeds: [createErrorEmbed(
              'Error',
              'An error occurred while saving your rating. Please try again later.'
            )],
            flags: MessageFlags.Ephemeral
          });
        }
      } else {
        // Show the rating modal
        await showRatingModal({
          customId: `rate_ticket_${ticketNumber}`,
          user: interaction.user,
          reply: interaction.reply.bind(interaction),
          showModal: interaction.showModal.bind(interaction),
          deferReply: interaction.deferReply.bind(interaction)
        } as any);
      }
    } catch (error) {
      logError('Ticket Rate', `Error in ticket-rate command: ${error}`);
      await interaction.reply({ 
        embeds: [createErrorEmbed(
          'Error',
          'An error occurred while processing your rating. Please try again later.'
        )],
        flags: MessageFlags.Ephemeral
      });
    }
  }
}; 