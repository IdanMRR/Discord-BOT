import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { createModerationEmbed, createErrorEmbed, createInfoEmbed, createSuccessEmbed } from '../../utils/embeds';
import { logModeration, logError, logInfo, LogResult } from '../../utils/logger';
import { WarningService, ModerationCaseService } from '../../database/services/sqliteService';
import { logModerationToDatabase } from '../../utils/databaseLogger';
import { AutomodEscalationHandler } from '../../handlers/automod/automodEscalationHandler';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a user for rule violations')
  .addUserOption(option => 
    option
      .setName('user')
      .setDescription('The user to warn')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
      // Check if user has permission to moderate members
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        const errorEmbed = createErrorEmbed(
          'Missing Permissions', 
          'You do not have permission to warn members in this server.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      const targetUser = interaction.options.getUser('user', true);
      
      // Validate the target user
      if (targetUser.id === interaction.user.id) {
        const errorEmbed = createErrorEmbed(
          'Invalid Target', 
          'You cannot warn yourself.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      if (targetUser.bot) {
        const errorEmbed = createErrorEmbed(
          'Invalid Target', 
          'You cannot warn bots.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Check if the user ID is a valid Discord snowflake (numeric string)
      if (!/^\d+$/.test(targetUser.id) || targetUser.id === '_soill_' || targetUser.id.includes('_soill_')) {
        const errorEmbed = createErrorEmbed(
          'Invalid User ID', 
          'The selected user has an invalid ID. Please select a valid user.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Get the guild object
      const guild = interaction.guild;
      
      if (!guild) {
        const errorEmbed = createErrorEmbed('Server Not Found', 'Could not find this server. This should never happen.');
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Create a modal for the warning reason
      const modal = new ModalBuilder()
        .setCustomId(`warn-modal-${targetUser.id}-${Date.now()}`)
        .setTitle(`Warn ${targetUser.username}`);
      
      // Create the reason input field
      const reasonInput = new TextInputBuilder()
        .setCustomId('warn-reason')
        .setLabel('Reason for Warning')
        .setPlaceholder('Enter the reason for warning this user...')
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
        i.customId.startsWith(`warn-modal-${targetUser.id}`) && i.user.id === interaction.user.id;
      
      try {
        // Wait for the modal submission (5 minute timeout)
        const modalSubmission = await interaction.awaitModalSubmit({ filter, time: 300000 });
        
        // Get the reason from the modal
        const reason = modalSubmission.fields.getTextInputValue('warn-reason');
        
        // Defer the reply to the modal submission with proper error handling
        try {
          if (!modalSubmission.replied && !modalSubmission.deferred) {
            await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
          }
        } catch (deferError: any) {
          // Handle interaction expiry or other errors
          if (deferError.code === 10062 || deferError.code === 10008) {
            console.log('[Warn] Modal interaction expired before we could defer');
            return; // Exit early if interaction expired
          }
          console.error('[Warn] Error deferring modal reply:', deferError);
          return;
        }
      
        // Create moderation case first
        const moderationCase = await ModerationCaseService.create({
          guild_id: guild.id,
          action_type: 'Warning',
          user_id: targetUser.id,
          moderator_id: interaction.user.id,
          reason: reason,
          additional_info: `Warning issued to user in ${guild.name}`
        });
        
        if (!moderationCase) {
          try {
            await modalSubmission.editReply({ 
              content: 'Failed to create moderation case. Please try again.'
            });
          } catch (editError: any) {
            if (editError.code === 10062 || editError.code === 10008) {
              console.log('[Warn] Modal interaction expired during database error message');
            }
          }
          return;
        }

        // Store the warning in the database with the case number
        const newWarning = {
          guild_id: guild.id,
          user_id: targetUser.id,
          moderator_id: interaction.user.id,
          reason: reason,
          active: true,
          case_number: moderationCase.case_number
        };
        
        const savedWarning = await WarningService.create(newWarning);
        
        if (!savedWarning) {
          // Warning creation failed, but we still have the moderation case
          console.log('[Warn] Warning creation failed, but moderation case was created');
          try {
            await modalSubmission.editReply({ 
              content: 'Warning moderation case created successfully, but failed to save to warnings table. The action has been logged.'
            });
          } catch (editError: any) {
            if (editError.code === 10062 || editError.code === 10008) {
              console.log('[Warn] Modal interaction expired during database error message');
            }
          }
          // Continue with the rest of the process since we have the moderation case
        }
        
        // Count active warnings for this user
        const activeWarnings = await WarningService.countActiveWarnings(guild.id, targetUser.id);
        
        // Check for automod escalation using the proper handler
        let escalationResult = null;
        try {
          console.log(`[Warn] Checking automod escalation for ${targetUser.tag} with ${activeWarnings} warnings`);
          
          // Get the guild member for escalation check
          const member = await guild.members.fetch(targetUser.id).catch(() => null);
          
          if (member) {
            const escalationTriggerResult = await AutomodEscalationHandler.checkAndExecuteEscalation(
              guild,
              member,
              `Warning issued - escalation triggered at ${activeWarnings} warnings`
            );
            
            console.log(`[Warn] Escalation check result: triggered=${escalationTriggerResult.triggered}, warningCount=${escalationTriggerResult.warningCount}`);
            
            if (escalationTriggerResult.triggered && escalationTriggerResult.punishmentResult) {
              escalationResult = escalationTriggerResult.punishmentResult;
              console.log(`[Warn] Automod punishment executed: ${escalationResult.success ? 'SUCCESS' : 'FAILED'} - ${escalationResult.action}`);
            }
          } else {
            console.log(`[Warn] Could not fetch member for escalation - user may have left the server`);
          }
        } catch (escalationError) {
          console.error('[Warn] Error during automod escalation:', escalationError);
        }
        
        // Create additional fields for the embed
        const additionalFields = [
          { name: '🏠 Server', value: guild.name, inline: true },
          { name: '⚠️ Active Warnings', value: activeWarnings.toString(), inline: true }
        ];
        
        // Add escalation information if punishment was applied
        if (escalationResult) {
          if (escalationResult.success) {
            additionalFields.push({
              name: '🛡️ Auto-Punishment Applied',
              value: `${escalationResult.action}${escalationResult.caseNumber ? ` (Case #${escalationResult.caseNumber})` : ''}`,
              inline: false
            });
          } else {
            additionalFields.push({
              name: '⚠️ Auto-Punishment Failed',
              value: escalationResult.error || 'Unknown error occurred',
              inline: false
            });
          }
        }
        
        // Create a stylish moderation embed for the server
        const warnEmbed = createModerationEmbed({
          action: 'Warning',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          caseNumber: moderationCase.case_number,
          additionalFields: additionalFields
        });
        
        // Update the reply with the warning information
        try {
          await modalSubmission.editReply({ embeds: [warnEmbed] });
        } catch (editError: any) {
          if (editError.code === 10062 || editError.code === 10008) {
            console.log('[Warn] Modal interaction expired during success message');
            return; // Exit if interaction expired
          }
          console.error('[Warn] Error editing reply:', editError);
          return;
        }
        
        // Try to DM the user with a detailed warning message
        try {
          const warnDMEmbed = createModerationEmbed({
            action: 'Warn',
            target: targetUser,
            moderator: interaction.user,
            reason: reason,
            caseNumber: moderationCase.case_number,
            additionalFields: [
              { name: '🏠 Server', value: guild.name, inline: true },
              { name: '⚠️ Warning Information', value: 'This is a formal warning. Continued rule violations may result in kicks, timeouts, or bans.' }
            ]
          });
          
          await targetUser.send({ 
            content: `⚠️ **You have received a warning in ${guild.name}** ⚠️`, 
            embeds: [warnDMEmbed] 
          });
          
          console.log(`Successfully sent detailed warning DM to ${targetUser.tag}`);
        } catch (error) {
          // Couldn't DM the user, but we already stored the warning and updated the reply
          console.log(`Could not send DM to ${targetUser.tag}: ${error}`);
        }
        
        // Log to database
        await logModerationToDatabase({
          guild: guild,
          action: 'Warning',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
                      additionalInfo: `Warning Case #${moderationCase.case_number} - Warning issued to user in ${guild.name}`
        });
      } catch (error: any) {
        // Modal timed out or was cancelled
        if (error?.code === 'InteractionCollectorError') {
          logInfo('Warn Command', `${interaction.user.tag} started but didn't complete warning ${targetUser.tag}`);
        } else {
          logError('Warn Modal', error);
          await interaction.followUp({ 
            content: 'There was an error processing your warning. Please try again.', 
            flags: MessageFlags.Ephemeral 
          }).catch(() => {});
        }
      }
    } catch (error) {
      logError('Warn Command', error);
      const errorEmbed = createErrorEmbed('Command Error', 'There was an error trying to warn this user. Please try again later.');
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
}
