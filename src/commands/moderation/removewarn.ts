import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { logModeration, logError, logInfo, LogResult } from '../../utils/logger';
import { logModerationToDatabase } from '../../utils/databaseLogger';
import { createModerationEmbed, createErrorEmbed, createInfoEmbed, createSuccessEmbed } from '../../utils/embeds';
import { WarningService, ModerationCaseService } from '../../database/services/sqliteService';

export const data = new SlashCommandBuilder()
  .setName('removewarn')
  .setDescription('Remove a warning from a user')
  .addUserOption(option => 
    option
      .setName('user')
      .setDescription('The user to remove a warning from')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
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
        
        // Defer the reply to the modal submission with proper error handling
        try {
          if (!modalSubmission.replied && !modalSubmission.deferred) {
            await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
          }
        } catch (deferError: any) {
          // Handle interaction expiry or other errors
          if (deferError.code === 10062 || deferError.code === 10008) {
            console.log('[Remove Warning] Modal interaction expired before we could defer');
            return; // Exit early if interaction expired
          }
          console.error('[Remove Warning] Error deferring modal reply:', deferError);
          return;
        }
        
        // Find active warnings for this user
        const activeWarnings = await WarningService.getActiveWarnings(guild.id, targetUser.id);
        
        if (activeWarnings.length === 0) {
          try {
            await modalSubmission.editReply({ content: `${targetUser.tag} has no active warnings to remove.` });
          } catch (editError: any) {
            if (editError.code === 10062 || editError.code === 10008) {
              console.log('[Remove Warning] Modal interaction expired during no warnings message');
            }
          }
          return;
        }
        
        // Get the most recent warning
        const warningToRemove = activeWarnings[0];
        
        // Update the warning in the database
        if (!warningToRemove.id) {
          try {
            await modalSubmission.editReply({ content: `Error: Could not find warning ID.` });
          } catch (editError: any) {
            if (editError.code === 10062 || editError.code === 10008) {
              console.log('[Remove Warning] Modal interaction expired during error message');
            }
          }
          return;
        }

        // Create moderation case for warning removal
        const moderationCase = await ModerationCaseService.create({
          guild_id: guild.id,
          action_type: 'Warning Removal',
          user_id: targetUser.id,
          moderator_id: interaction.user.id,
          reason: reason,
          additional_info: `Warning removed from user in ${guild.name}. Original warning case: #${warningToRemove.case_number || 'Unknown'}`
        });
        
        await WarningService.removeWarning(
          warningToRemove.id, 
          interaction.user.id, 
          reason
        );
      
        // Get remaining active warnings count
        const remainingActiveWarnings = await WarningService.countActiveWarnings(guild.id, targetUser.id);
        
        // Create a proper moderation embed that matches all other moderation commands
        const moderationEmbed = createModerationEmbed({
          action: 'Warning Removed',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          case_number: moderationCase?.case_number,
          issuedAt: warningToRemove.created_at,
          removedAt: new Date().toISOString(),
          removedBy: interaction.user.username,
          additionalFields: [
            { name: '🏠 Server', value: guild.name, inline: true },
            { name: '⚠️ Active Warnings', value: remainingActiveWarnings.toString(), inline: true }
          ]
        });
        
        try {
          await modalSubmission.editReply({ embeds: [moderationEmbed] });
        } catch (editError: any) {
          if (editError.code === 10062 || editError.code === 10008) {
            console.log('[Remove Warning] Modal interaction expired during success message');
            return; // Exit if interaction expired
          }
          console.error('[Remove Warning] Error editing reply:', editError);
          return;
        }
        
        // Try to DM the user about the removed warning with consistent moderation embed style
        try {
          const userModerationEmbed = createModerationEmbed({
            action: 'Warning Removed',
            target: targetUser,
            moderator: interaction.user,
            reason: reason,
            case_number: moderationCase?.case_number,
            issuedAt: warningToRemove.created_at,
            removedAt: new Date().toISOString(),
            removedBy: interaction.user.username,
            additionalFields: [
              { name: '🏠 Server', value: guild.name, inline: true },
              { name: '⚠️ Active Warnings', value: remainingActiveWarnings.toString(), inline: true }
            ]
          });
          
          await targetUser.send({ embeds: [userModerationEmbed] });
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
          caseNumber: moderationCase?.case_number,
          additionalInfo: `Warning removed from user in ${guild.name}`
        });
        
        // If logging failed, add a note to the response
        if (!logResult.success && logResult.message) {
          const logInfoEmbed = createInfoEmbed('Logging Information', logResult.message);
          await modalSubmission.followUp({ embeds: [logInfoEmbed], flags: MessageFlags.Ephemeral });
        }
        
        // Log the moderation action to the database
        await logModerationToDatabase({
          guild: guild,
          action: 'Warning Removed',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          additionalInfo: `Warning Removal Case #${moderationCase?.case_number || 'Unknown'} - Warning removed from user in ${guild.name}`
        });
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
}
