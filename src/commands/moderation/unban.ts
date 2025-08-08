import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { createModerationEmbed, createErrorEmbed, createSuccessEmbed } from '../../utils/embeds';
import { logModeration, logError, logInfo } from '../../utils/logger';
import { ModerationCaseService, WarningService } from '../../database/services/sqliteService';
import { logModerationToDatabase } from '../../utils/databaseLogger';
import { validateReason, sanitizeReason } from '../../utils/validation';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user from the server')
  .addStringOption(option => 
    option
      .setName('userid')
      .setDescription('The ID of the user to unban')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Check if user has permission to ban/unban members
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      const errorEmbed = createErrorEmbed(
        'Missing Permissions', 
        'You do not have permission to unban members in this server.'
      );
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }
    
    const userId = interaction.options.getString('userid', true);
    
    // Validate the user ID format
    if (!/^\d{17,19}$/.test(userId)) {
      const errorEmbed = createErrorEmbed(
        'Invalid User ID', 
        'Please provide a valid Discord user ID.'
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
    
    // Check if the bot has permission to unban members
    const botMember = guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      const errorEmbed = createErrorEmbed(
        'Bot Missing Permissions',
        'I need the "Ban Members" permission to unban users.'
      );
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }
    
    // Try to fetch the banned user
    let bannedUser;
    try {
      const ban = await guild.bans.fetch(userId);
      bannedUser = ban.user;
    } catch (error) {
      const errorEmbed = createErrorEmbed(
        'User Not Banned',
        'This user is not banned from this server.'
      );
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }
    
    // Create a modal for the unban reason
    const modal = new ModalBuilder()
      .setCustomId(`unban-modal-${userId}-${Date.now()}`)
      .setTitle(`Unban ${bannedUser.username}`);
    
    // Create the reason input field
    const reasonInput = new TextInputBuilder()
      .setCustomId('unban-reason')
      .setLabel('Reason for Unban')
      .setPlaceholder('Enter the reason for unbanning this user...')
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
      i.customId.startsWith(`unban-modal-${userId}`) && i.user.id === interaction.user.id;
    
    try {
      // Wait for the modal submission (5 minute timeout)
      const modalSubmission = await interaction.awaitModalSubmit({ filter, time: 300000 });
      
      // Get and validate the reason from the modal
      const rawReason = modalSubmission.fields.getTextInputValue('unban-reason');
      
      // Validate the reason
      const validation = validateReason(rawReason);
      if (!validation.isValid) {
        await modalSubmission.reply({
          content: validation.message!,
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Sanitize and use the reason
      const reason = sanitizeReason(rawReason);
      
      // Defer the reply to the modal submission with proper error handling
      try {
        if (!modalSubmission.replied && !modalSubmission.deferred) {
          await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
        }
      } catch (deferError: any) {
        // Handle interaction expiry or other errors
        if (deferError.code === 10062 || deferError.code === 10008) {
          console.log('[Unban] Modal interaction expired before we could defer');
          return; // Exit early if interaction expired
        }
        console.error('[Unban] Error deferring modal reply:', deferError);
        return;
      }
      
      // Create moderation case
      const moderationCase = await ModerationCaseService.create({
        guild_id: guild.id,
        action_type: 'Unban',
        user_id: bannedUser.id,
        moderator_id: interaction.user.id,
        reason: reason,
        additional_info: `Unban Case - User was unbanned from ${guild.name}`
      });
      
      // Unban the user
      await guild.members.unban(bannedUser.id, reason);
      
      // Get current warning count for the user
      const activeWarningCount = await WarningService.countActiveWarnings(guild.id, bannedUser.id);
      
      // Create a stylish moderation embed
      const unbanEmbed = createModerationEmbed({
        action: 'Unban',
        target: bannedUser,
        moderator: interaction.user,
        reason: reason,
        case_number: moderationCase?.case_number,
        additionalFields: [
          { name: '🕒 Action Time', value: new Date().toLocaleString(), inline: true },
          { name: '🏠 Server', value: guild.name, inline: true },
          { name: '⚠️ Active Warnings', value: activeWarningCount.toString(), inline: true }
        ]
      });
      
      try {
        await modalSubmission.editReply({ embeds: [unbanEmbed] });
      } catch (editError: any) {
        if (editError.code === 10062 || editError.code === 10008) {
          console.log('[Unban] Modal interaction expired during success message');
          return; // Exit if interaction expired
        }
        console.error('[Unban] Error editing reply:', editError);
        return;
      }
      
      // Log to the moderation log channel
      await logModeration({
        guild: guild,
        action: 'Unban',
        target: bannedUser,
        moderator: interaction.user,
        reason: reason,
        caseNumber: moderationCase?.case_number
      });
      
      // Log to database
      await logModerationToDatabase({
        guild: guild,
        action: 'Unban',
        target: bannedUser,
        moderator: interaction.user,
        reason: reason,
        additionalInfo: `Unban Case #${moderationCase?.case_number || 'Unknown'} - User was unbanned from ${guild.name}`
      });
      
    } catch (error: any) {
      // Modal timed out or was cancelled
      if (error?.code === 'InteractionCollectorError') {
        logInfo('Unban Command', `${interaction.user.tag} started but didn't complete unbanning ${bannedUser.username}`);
      } else {
        logError('Unban Modal', error);
        await interaction.followUp({ 
          content: 'There was an error processing your unban request. Please try again.', 
          flags: MessageFlags.Ephemeral 
        }).catch(() => {});
      }
    }
  } catch (error) {
    logError('Unban Command', error);
    const errorEmbed = createErrorEmbed('Command Error', 'There was an error trying to unban this user. Check my permissions and try again.');
    await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

