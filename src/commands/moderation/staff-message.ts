import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  MessageFlags, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ModalSubmitInteraction,
  TextChannel,
  ChannelType
} from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { sendStaffOnlyMessage } from '../../utils/ticket-utils';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-message')
    .setDescription('Send a staff-only message in a ticket channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option => 
      option
        .setName('message')
        .setDescription('The message content (or use /staff-message without this option for a modal)')
        .setRequired(false)),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Check if user has permission
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        const errorEmbed = createErrorEmbed(
          'Missing Permissions', 
          'You do not have permission to send staff messages in this server.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Verify the command is being used in a ticket channel
      if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText || 
          !interaction.channel.name.toLowerCase().includes('ticket-')) {
        const errorEmbed = createErrorEmbed(
          'Invalid Channel', 
          'This command can only be used in ticket channels.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Check if a message was provided directly as an option
      const directMessage = interaction.options.getString('message');
      
      if (directMessage) {
        // Send the staff message directly
        const channel = interaction.channel as TextChannel;
        await sendStaffOnlyMessage(channel, interaction.user, directMessage);
        
        // Reply with success message
        const successEmbed = createSuccessEmbed(
          'Staff Message Sent',
          'Your restricted message has been sent in this channel.'
        );
        await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
      } else {
        // Create a modal for the staff to input their message
        const modal = new ModalBuilder()
          .setCustomId(`staff-message-modal-${Date.now()}`)
          .setTitle('Send Staff-Only Message');
        
        // Create the message input field (paragraph style for longer messages)
        const messageInput = new TextInputBuilder()
          .setCustomId('staff-message-content')
          .setLabel('Message Content')
          .setPlaceholder('Enter your staff-only message here...')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(2000);
        
        // Create action row to hold the input
        const messageRow = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
        
        // Add the rows to the modal
        modal.addComponents(messageRow);
        
        // Show the modal to the user
        await interaction.showModal(modal);
      }
    } catch (error) {
      logError('Staff Message', `Error sending staff message: ${error}`);
      const errorEmbed = createErrorEmbed(
        'Error', 
        'An error occurred while sending the staff message.'
      );
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  },
  
  // Handle the modal submission
  async handleModalSubmit(interaction: ModalSubmitInteraction) {
    try {
      if (!interaction.isModalSubmit()) return;
      
      // Only handle modals with our custom ID
      if (!interaction.customId.startsWith('staff-message-modal-')) return;
      
      // Get the message content from the modal
      const messageContent = interaction.fields.getTextInputValue('staff-message-content');
      
      // Send the staff message
      if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
        await interaction.reply({ 
          content: 'Error: This command can only be used in text channels.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      const channel = interaction.channel as TextChannel;
      await sendStaffOnlyMessage(channel, interaction.user, messageContent);
      
      // Reply with success message
      const successEmbed = createSuccessEmbed(
        'Staff Message Sent',
        'Your restricted message has been sent in this channel.'
      );
      await interaction.reply({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    } catch (error) {
      logError('Staff Message Modal', `Error handling modal submission: ${error}`);
      const errorEmbed = createErrorEmbed(
        'Error', 
        'An error occurred while sending the staff message.'
      );
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
}; 