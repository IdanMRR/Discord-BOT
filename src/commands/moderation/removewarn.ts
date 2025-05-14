import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';
import { logModeration, logError, logInfo, LogResult } from '../../utils/logger';
import { WarningService } from '../../database/services/sqliteService';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removewarn')
    .setDescription('Remove a warning from a user')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to remove a warning from')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Check if user has permission to moderate members
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        const errorEmbed = createErrorEmbed(
          'Missing Permissions', 
          'You do not have permission to remove warnings in this server.'
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
      
      // Create a modal for the warning removal reason
      const modal = new ModalBuilder()
        .setCustomId(`removewarn-modal-${targetUser.id}-${Date.now()}`)
        .setTitle(`Remove Warning from ${targetUser.username}`);
      
      // Create the reason input field
      const reasonInput = new TextInputBuilder()
        .setCustomId('removewarn-reason')
        .setLabel('Reason for Removing Warning')
        .setPlaceholder('Enter the reason for removing this warning...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);
      
      // Create action row to hold the input
      const reasonRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
      
      // Add the input to the modal
      modal.addComponents(reasonRow);
      
      // Show the modal to the user
      await interaction.showModal(modal);
      
      // Wait for the modal submission
      const filter = (i: ModalSubmitInteraction) => 
        i.customId.startsWith(`removewarn-modal-${targetUser.id}`) && i.user.id === interaction.user.id;
      
      try {
        // Wait for the modal submission (5 minute timeout)
        const modalSubmission = await interaction.awaitModalSubmit({ filter, time: 300000 });
        
        // Get the reason from the modal
        const reason = modalSubmission.fields.getTextInputValue('removewarn-reason');
        
        // Defer the reply to the modal submission
        await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
        
        // Find active warnings for this user
        const activeWarnings = await WarningService.getActiveWarnings(guild.id, targetUser.id);
        
        if (activeWarnings.length === 0) {
          await modalSubmission.editReply({ content: `${targetUser.tag} has no active warnings to remove.` });
          return;
        }
        
        // Get the most recent warning
        const warningToRemove = activeWarnings[0];
        
        // Update the warning in the database
        if (!warningToRemove.id) {
          await modalSubmission.editReply({ content: `Error: Could not find warning ID.` });
          return;
        }
        
        await WarningService.removeWarning(
          warningToRemove.id, 
          interaction.user.id, 
          reason
        );
      
        // Get remaining active warnings count
        const remainingActiveWarnings = await WarningService.countActiveWarnings(guild.id, targetUser.id);
        
        // Format current time correctly (Israeli format)
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const formattedTime = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} at ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // Create a stylish success embed
        const successEmbed = createSuccessEmbed(
          'Warning Removed',
          `A warning has been removed from ${targetUser} by ${interaction.user}.\n\n**Reason:** ${reason}`
        );
        
        // Add additional fields to the embed
        successEmbed.addFields([
          { name: '👤 User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '⚠️ Remaining Warnings', value: `${remainingActiveWarnings}`, inline: true },
          { name: '🕒 Time', value: formattedTime, inline: false }
        ]);
        
        await modalSubmission.editReply({ embeds: [successEmbed] });
        
        // Try to DM the user about the removed warning
        try {
          const userEmbed = createSuccessEmbed(
            'Warning Removed',
            `A warning has been removed from your account in **${guild.name}**.\n\n**Reason:** ${reason}`
          );
          
          userEmbed.addFields([
            { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
            { name: '⚠️ Remaining Warnings', value: `${remainingActiveWarnings}`, inline: true },
            { name: '🕒 Time', value: formattedTime, inline: true }
          ]);
          
          await targetUser.send({ embeds: [userEmbed] });
          console.log(`Successfully sent warning removal DM to ${targetUser.tag}`);
        } catch (error) {
          // Couldn't DM the user
          console.error(`Could not DM user ${targetUser.tag} about warning removal: ${error}`);
        }
        
        // Log the moderation action
        const logResult: LogResult = await logModeration({
          guild: guild,
          action: 'Warning Removed',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          additionalInfo: `Warning removed from user in ${guild.name}`
        });
        
        // If logging failed, add a note to the response
        if (!logResult.success && logResult.message) {
          const logInfoEmbed = createInfoEmbed('Logging Information', logResult.message);
          await modalSubmission.followUp({ embeds: [logInfoEmbed], flags: MessageFlags.Ephemeral });
        }
      } catch (error: any) {
        // Modal timed out or was cancelled
        if (error?.code === 'InteractionCollectorError') {
          logInfo('Remove Warning Command', `${interaction.user.tag} started but didn't complete removing warning from ${targetUser.tag}`);
        } else { logError('Remove Warning Modal', error);
          await interaction.followUp({ 
            content: 'There was an error processing your warning removal request. Please try again.', 
            flags: MessageFlags.Ephemeral 
           }).catch(() => {});
        }
      }
    } catch (error) {
      logError('Remove Warning Command', error);
      const errorEmbed = createErrorEmbed('Command Error', 'There was an error trying to remove the warning. Please try again later.');
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  },
};
