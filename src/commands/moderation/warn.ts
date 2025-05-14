import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { createModerationEmbed, createErrorEmbed, createInfoEmbed, createSuccessEmbed } from '../../utils/embeds';
import { logModeration, logError, logInfo, LogResult } from '../../utils/logger';
import { WarningService } from '../../database/services/sqliteService';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user for rule violations')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to warn')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
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
        
        // Defer the reply to the modal submission
        await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
      
        // Store the warning in the database first
        const newWarning = {
          guild_id: guild.id,
          user_id: targetUser.id,
          moderator_id: interaction.user.id,
          reason: reason,
          active: true
        };
        
        const savedWarning = await WarningService.create(newWarning);
        
        // Count active warnings for this user
        const activeWarnings = await WarningService.countActiveWarnings(guild.id, targetUser.id);
        
        // Create a stylish moderation embed for the server
        const warnEmbed = createModerationEmbed({
          action: 'Warning',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          caseNumber: savedWarning?.case_number || 0,
          // We don't need to manually add these fields as they're now handled by the embed creator
          additionalFields: []
        });
        
        // Update the reply with the warning information
        await modalSubmission.editReply({ embeds: [warnEmbed] });
        
        // Try to DM the user with a detailed warning message
        try {
          const warnDMEmbed = createModerationEmbed({
            action: 'Warn',
            target: targetUser,
            moderator: interaction.user,
            reason: reason,
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
        
        // Log the moderation action
        const logResult: LogResult = await logModeration({
          guild: guild,
          action: 'Warning',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          additionalInfo: `User was warned in ${guild.name}`
        });
        
        // If logging failed, add a note to the response
        if (!logResult.success && logResult.message) {
          const logInfoEmbed = createInfoEmbed('Logging Information', logResult.message);
          await modalSubmission.followUp({ embeds: [logInfoEmbed], flags: MessageFlags.Ephemeral });
        }
      } catch (error: any) {
        // Modal timed out or was cancelled
        if (error?.code === 'InteractionCollectorError') {
          logInfo('Warn Command', `${interaction.user.tag} started but didn't complete warning ${targetUser.tag}`);
        } else { logError('Warn Modal', error);
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
  },
};
