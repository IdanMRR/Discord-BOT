import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';
import { logInfo, logError, logDirectMessage } from '../../utils/logger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Send a direct message to a user from the staff team')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to send a message to')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Check if user has permission to use this command
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        const errorEmbed = createErrorEmbed(
          'Missing Permissions', 
          'You do not have permission to send staff DMs in this server.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      const targetUser = interaction.options.getUser('user', true);
      
      // Get the guild object
      const guild = interaction.guild;
      
      if (!guild) {
        const errorEmbed = createErrorEmbed('Server Not Found', 'Could not find this server. This should never happen.');
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Create a modal for the staff to input their message
      const modal = new ModalBuilder()
        .setCustomId(`dm-modal-${targetUser.id}-${Date.now()}`)
        .setTitle(`Send DM to ${targetUser.username}`);
      
      // Create the title input field
      const titleInput = new TextInputBuilder()
        .setCustomId('dm-title')
        .setLabel('Message Title')
        .setPlaceholder('Enter a title for your message')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue('Message from Staff');
      
      // Create the message input field (paragraph style for longer messages)
      const messageInput = new TextInputBuilder()
        .setCustomId('dm-message')
        .setLabel('Message Content')
        .setPlaceholder('Enter your message to the user here...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000);
      
      // Create action rows to hold the inputs
      const titleRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
      const messageRow = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
      
      // Add the inputs to the modal
      modal.addComponents(titleRow, messageRow);
      
      // Show the modal to the user
      await interaction.showModal(modal);
      
      // Wait for the modal submission
      const filter = (i: ModalSubmitInteraction) => 
        i.customId.startsWith(`dm-modal-${targetUser.id}`) && i.user.id === interaction.user.id;
      
      try {
        // Wait for the modal submission (5 minute timeout)
        const modalSubmission = await interaction.awaitModalSubmit({ filter, time: 300000 });
        
        // Get the values from the modal
        const title = modalSubmission.fields.getTextInputValue('dm-title');
        const messageContent = modalSubmission.fields.getTextInputValue('dm-message');
        
        // Defer the reply to the modal submission
        await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
      
        // Create a stylish embed for the DM
        const dmEmbed = createInfoEmbed(
          title,
          `**The Message is:**\n\n${messageContent}`
        );
        
        // Add additional fields to the embed
        dmEmbed.addFields([
          { name: '🛡️ Sent by', value: `${interaction.user.tag}`, inline: true },
          { name: '🏠 Server', value: guild.name, inline: true },
          { name: '🕒 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        ]);
        
        // Try to send the DM to the user
        try {
          await targetUser.send({ embeds: [dmEmbed] });
          
          // Create a success embed for the staff member
          const successEmbed = createSuccessEmbed(
            'Direct Message Sent',
            `Your message has been sent to ${targetUser.tag}.`
          );
          
          // Preview of the message (truncated if too long)
          const messagePreview = messageContent.length > 100 
            ? messageContent.substring(0, 97) + '...'
            : messageContent;
          
          successEmbed.addFields([
            { name: '📝 Message Preview', value: `**The Message is:**\n\n${messagePreview}` },
            { name: '👤 Recipient', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
            { name: '🕒 Sent at', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
          ]);
          
          await modalSubmission.editReply({ embeds: [successEmbed] });
          
          // Log the action to console
          logInfo('Staff DM', `${interaction.user.tag} sent a DM to ${targetUser.tag} in ${guild.name}: ${messageContent}`);
          
          // Log the DM to database and log channel
          await logDirectMessage({
            guild: guild,
            sender: interaction.user,
            recipient: targetUser,
            content: messageContent,
            command: 'dm',
            success: true
          });
        } catch (error) {
          // Couldn't DM the user
          const errorEmbed = createErrorEmbed(
            'Message Not Sent',
            `Could not send a message to ${targetUser.tag}. They may have DMs disabled or have blocked the bot.`
          );
          
          await modalSubmission.editReply({ embeds: [errorEmbed] });
          logError('Staff DM', `Failed to send DM to ${targetUser.tag}: ${error}`);
          
          // Log the failed DM attempt to database and log channel
          await logDirectMessage({
            guild: guild,
            sender: interaction.user,
            recipient: targetUser,
            content: messageContent,
            command: 'dm',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } catch (error: any) {
        // Modal timed out or was cancelled
        if (error?.code === 'InteractionCollectorError') {
          logInfo('Staff DM', `${interaction.user.tag} started but didn't complete a DM to ${targetUser.tag}`);
        } else {
          logError('Staff DM Modal', error);
        }
      }
    } catch (error) {
      logError('DM Command', error);
      const errorEmbed = createErrorEmbed('Command Error', 'There was an error trying to send the direct message. Please try again later.');
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  },
};
