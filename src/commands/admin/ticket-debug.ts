import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  MessageFlags
} from 'discord.js';
import { settingsManager } from '../../utils/settings';
import { db } from '../../database/sqlite';
import { staffActiveTickets } from '../../handlers/tickets/ticket-chatbot';
import { logError, logInfo } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('ticket-debug')
  .setDescription('Debug commands for ticket system (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand => 
    subcommand
      .setName('update-activity')
      .setDescription('Update last_activity_at for a ticket')
      .addIntegerOption(option => 
        option
          .setName('ticket_number')
          .setDescription('The ticket number to update')
          .setRequired(true)
      )
      .addIntegerOption(option => 
        option
          .setName('minutes_ago')
          .setDescription('Set last activity to X minutes ago')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(120)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('force-response')
      .setDescription('Force the ticket chatbot to respond')
      .addIntegerOption(option => 
        option
          .setName('ticket_number')
          .setDescription('The ticket number to test')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Defer the reply immediately to prevent timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    // Get the guild ID
    const guildId = interaction.guildId;
    
        const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'update-activity') {
      const ticketNumber = interaction.options.getInteger('ticket_number')!;
      const minutesAgo = interaction.options.getInteger('minutes_ago')!;
      
      // Calculate timestamp
      const date = new Date();
      date.setMinutes(date.getMinutes() - minutesAgo);
      const timestamp = date.toISOString();
      
      // Update the ticket's last activity timestamp
      const result = db.prepare(`
        UPDATE tickets 
        SET last_activity_at = ?
        WHERE guild_id = ? AND ticket_number = ?
      `).run(timestamp, interaction.guildId!, ticketNumber);
      
      if (result.changes > 0) {
        const embed = new EmbedBuilder()
          .setTitle('✅ Ticket Activity Updated')
          .setDescription(`Ticket #${ticketNumber}'s last activity set to ${minutesAgo} minutes ago.`)
          .setColor(Colors.Green)
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        logInfo('Ticket Debug', `Updated ticket #${ticketNumber} activity to ${minutesAgo} minutes ago`);
      } else {
        const embed = new EmbedBuilder()
          .setTitle('❌ Ticket Not Found')
          .setDescription(`Could not find ticket #${ticketNumber} in this server.`)
          .setColor(Colors.Red)
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
      }
    }
    else if (subcommand === 'force-response') {
      const ticketNumber = interaction.options.getInteger('ticket_number')!;
      
      // Get the ticket channel
      const ticket = db.prepare(`
        SELECT channel_id FROM tickets 
        WHERE guild_id = ? AND ticket_number = ?
      `).get(interaction.guildId!, ticketNumber) as { channel_id: string } | undefined;
      
      if (!ticket) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Ticket Not Found')
          .setDescription(`Could not find ticket #${ticketNumber} in this server.`)
          .setColor(Colors.Red)
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      
      const channel = await interaction.guild!.channels.fetch(ticket.channel_id);
      if (!channel || !channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Channel Not Found')
          .setDescription(`Could not find the channel for ticket #${ticketNumber}.`)
          .setColor(Colors.Red)
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      
      // Clear staff activity cache for this ticket
      const ticketKey = `${interaction.guildId!}-${ticketNumber}`;
      staffActiveTickets.delete(ticketKey);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Chatbot Reset')
        .setDescription(`The staff activity for ticket #${ticketNumber} has been reset.\nThe chatbot will now respond to the next message.`)
        .setColor(Colors.Green)
        .setFooter({ text: 'Try sending a message with "help" now' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      logInfo('Ticket Debug', `Reset staff activity for ticket #${ticketNumber}`);
    }
  } catch (error) {
    logError('Ticket Debug', `Error during debug: ${error}`);
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription(`An error occurred: ${error}`)
      .setColor(Colors.Red)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
} 