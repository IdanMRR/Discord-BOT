import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';
import { logInfo, logError, logDirectMessage } from '../../utils/logger';
import { ModerationCaseService } from '../../database/services/sqliteService';

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
        // Wait for the modal submission (3 minute timeout to avoid Discord limits)
        const modalSubmission = await interaction.awaitModalSubmit({ filter, time: 180000 });
        
        // Check if the modal submission is still valid
        if (!modalSubmission || modalSubmission.replied || modalSubmission.deferred) {
          logError('Staff DM Modal', 'Modal submission already handled or invalid');
          return;
        }
        
        // Get the values from the modal
        const title = modalSubmission.fields.getTextInputValue('dm-title');
        const messageContent = modalSubmission.fields.getTextInputValue('dm-message');
        
        // Defer the reply to the modal submission with error handling
        try {
        await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (deferError: any) {
          if (deferError.code === 10062) {
            logError('Staff DM Modal', 'Modal interaction expired - user took too long to submit');
            return;
          }
          throw deferError;
        }
      
        // Create moderation case for tracking staff DM
        const moderationCase = await ModerationCaseService.create({
          guild_id: guild.id,
          action_type: 'Staff DM',
          user_id: targetUser.id,
          moderator_id: interaction.user.id,
          reason: title,
          additional_info: `Staff message sent to user: ${messageContent.substring(0, 500)}${messageContent.length > 500 ? '...' : ''}`
        });

        // Create a stylish embed for the DM
        const dmEmbed = createInfoEmbed(
          title,
          messageContent
        );
        
        // Add additional fields to the embed with enhanced styling
        const embedFields = [
          { name: '🛡️ Staff Member', value: `${interaction.user.tag}`, inline: true },
          { name: '🏠 Server', value: guild.name, inline: true },
          { name: '🔒 Official', value: 'Staff Message', inline: true },
          { name: '🕒 Sent At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        ];

        // Add case number if moderation case was created successfully
        if (moderationCase) {
          embedFields.unshift({ name: '📋 Case Number', value: `#${moderationCase.case_number}`, inline: true });
        }

        dmEmbed.addFields(embedFields);
        
        // Add server icon and make it more official looking
        dmEmbed.setThumbnail(guild.iconURL({ size: 256 }) || null);
        dmEmbed.setAuthor({
          name: `Official Message from ${guild.name}`,
          iconURL: guild.iconURL({ size: 64 }) || undefined
        });
        dmEmbed.setFooter({
          text: `This is an official message from the ${guild.name} staff team`,
          iconURL: interaction.user.displayAvatarURL({ size: 32 })
        });
        
        // Try to send the DM to the user
        try {
          await targetUser.send({ embeds: [dmEmbed] });
          
          // Create a success embed for the staff member
          const successEmbed = createSuccessEmbed(
            '✅ Staff Message Delivered',
            `Your official message has been successfully delivered to ${targetUser.tag}.`
          );
          
          // Preview of the message (truncated if too long)
          const messagePreview = messageContent.length > 150 
            ? messageContent.substring(0, 147) + '...'
            : messageContent;
          
          const successFields = [
            { name: '📋 Title', value: title, inline: true },
            { name: '👤 Recipient', value: `${targetUser.tag}`, inline: true },
            { name: '📊 Length', value: `${messageContent.length} characters`, inline: true },
            { name: '📝 Message Preview', value: messagePreview, inline: false },
            { name: '🔗 Message Details', value: `**ID:** ${targetUser.id}\n**Type:** Staff DM\n**Status:** Delivered`, inline: true },
            { name: '🕒 Delivery Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          ];

          // Add case number if available
          if (moderationCase) {
            successFields.unshift({ name: '📋 Case Number', value: `#${moderationCase.case_number}`, inline: true });
          }

          successEmbed.addFields(successFields);
          
          // Add staff member info
          successEmbed.setAuthor({
            name: `Message sent by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL({ size: 64 })
          });
          
          successEmbed.setThumbnail(targetUser.displayAvatarURL({ size: 128 }));
          
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
            success: true,
            caseNumber: moderationCase?.case_number
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
          logInfo('Staff DM', `${interaction.user.tag} started but didn't complete a DM to ${targetUser.tag} (modal timed out after 3 minutes)`);
        } else if (error?.code === 10062) {
          logError('Staff DM Modal', `Modal interaction expired for ${interaction.user.tag} -> ${targetUser.tag}`);
        } else {
          logError('Staff DM Modal', `Unexpected error: ${error?.message || error}`);
        }
      }
    } catch (error) {
      logError('DM Command', error);
      const errorEmbed = createErrorEmbed('Command Error', 'There was an error trying to send the direct message. Please try again later.');
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  },
};
