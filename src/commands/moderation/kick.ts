import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { createModerationEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';
import { logModeration, logError, logInfo, LogResult } from '../../utils/logger';
import { logModerationToDatabase } from '../../utils/databaseLogger';
import { ModerationCaseService } from '../../database/services/sqliteService';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a user from the server')
  .addUserOption(option => 
    option
      .setName('user')
      .setDescription('The user to kick')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
      // Check if user has permission to kick members
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
        const errorEmbed = createErrorEmbed(
          'Missing Permissions', 
          'You do not have permission to kick members from this server.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      const targetUser = interaction.options.getUser('user');
      
      if (!targetUser) {
        const errorEmbed = createErrorEmbed('User Not Found', 'Could not find the specified user.');
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Check if user is trying to kick themselves
      if (targetUser.id === interaction.user.id) {
        const errorEmbed = createErrorEmbed('Invalid Target', 'You cannot kick yourself.');
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Check if user is trying to kick the bot
      if (targetUser.id === interaction.client.user.id) {
        const errorEmbed = createErrorEmbed('Invalid Target', 'I cannot kick myself.');
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Get the guild and member objects
      const guild = interaction.guild;
      if (!guild) {
        const errorEmbed = createErrorEmbed('Guild Error', 'This command can only be used in a server.');
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      let member = guild.members.cache.get(targetUser.id);
      
      // If member not in cache, try to fetch from API
      if (!member) {
        try {
          member = await guild.members.fetch(targetUser.id);
        } catch (error) {
          const errorEmbed = createErrorEmbed('Member Not Found', 'Could not find that member in this server.');
          await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
          return;
        }
      }
      
      // Check role hierarchy - ensure the moderator can kick this member
      const moderatorMember = guild.members.cache.get(interaction.user.id);
      if (moderatorMember && member.roles.highest.position >= moderatorMember.roles.highest.position && guild.ownerId !== interaction.user.id) {
        const errorEmbed = createErrorEmbed(
          'Permission Error', 
          'You cannot kick someone with an equal or higher role than you.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Check if the bot can kick the member
      if (!member.kickable) {
        const errorEmbed = createErrorEmbed('Permission Error', 'I cannot kick this user. They may have higher permissions than me or I lack the required permissions.');
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Create a modal for the kick reason and confirmation
      const modal = new ModalBuilder()
        .setCustomId(`kick-modal-${targetUser.id}-${Date.now()}`)
        .setTitle(`Kick ${targetUser.username}`);
      
      // Create the reason input field
      const reasonInput = new TextInputBuilder()
        .setCustomId('kick-reason')
        .setLabel('Reason for Kick')
        .setPlaceholder('Enter the reason for kicking this user...')
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
        i.customId.startsWith(`kick-modal-${targetUser.id}`) && i.user.id === interaction.user.id;
      
      try {
        // Wait for the modal submission (5 minute timeout)
        const modalSubmission = await interaction.awaitModalSubmit({ filter, time: 300000 });
        
        // Get the reason from the modal
        const reason = modalSubmission.fields.getTextInputValue('kick-reason');
        
        // Defer the reply to the modal submission
        await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
      
        // Create moderation case first
        const moderationCase = await ModerationCaseService.create({
          guild_id: guild.id,
          action_type: 'Kick',
          user_id: targetUser.id,
          moderator_id: interaction.user.id,
          reason: reason,
          additional_info: `User was kicked from ${guild.name}`
        });
        
        if (!moderationCase) {
          await modalSubmission.editReply({ 
            content: 'Failed to create moderation case. Please try again.'
          });
          return;
        }

        // First try to DM the user before kicking them with a detailed message
        try {
          const kickDMEmbed = createModerationEmbed({
            action: 'Kick',
            target: targetUser,
            moderator: interaction.user,
            reason: reason,
            caseNumber: moderationCase.case_number,
            additionalFields: [
              { name: '🏠 Server', value: guild.name, inline: true },
              { name: '🔗 Rejoin Information', value: 'You may be able to rejoin the server with a new invite link.' }
            ]
          });
          
          await targetUser.send({ 
            content: `⚠️ **You have been kicked from ${guild.name}** ⚠️`, 
            embeds: [kickDMEmbed] 
          });
          
          console.log(`Successfully sent detailed DM to ${targetUser.tag} before kicking`);
        } catch (error) {
          // Couldn't DM the user, but we'll still proceed with the kick
          console.error(`Could not DM user ${targetUser.tag} before kicking: ${error}`);
        }
        
        // Now perform the kick
        await member.kick(reason);
        
        // Create a stylish moderation embed
        const kickEmbed = createModerationEmbed({
          action: 'Kick',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          caseNumber: moderationCase.case_number,
          additionalFields: [
            { name: '🕒 Action Time', value: new Date().toLocaleString(), inline: true },
            { name: '🏠 Server', value: guild.name, inline: true }
          ]
        });
        
        await modalSubmission.editReply({ embeds: [kickEmbed] });
        
        // Log the moderation action
        const logResult: LogResult = await logModeration({
          guild: guild,
          action: 'Kick',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          caseNumber: moderationCase.case_number,
          additionalInfo: `User was kicked from ${guild.name}`
        });
        
        // If logging failed, add a note to the response
        if (!logResult.success && logResult.message) {
          const logInfoEmbed = createInfoEmbed('Logging Information', logResult.message);
          await modalSubmission.followUp({ embeds: [logInfoEmbed], flags: MessageFlags.Ephemeral });
        }
        
        // Log to database
        await logModerationToDatabase({
          guild: guild,
          action: 'Kick',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          additionalInfo: `Kick Case #${moderationCase.case_number} - User was kicked from ${guild.name}`
        });
        
      } catch (error: any) {
        // Modal timed out or was cancelled
        if (error?.code === 'InteractionCollectorError') {
          logInfo('Kick Command', `${interaction.user.tag} started but didn't complete kicking ${targetUser.tag}`);
        } else {
          logError('Kick Modal', error);
          await interaction.followUp({ 
            content: 'There was an error processing your kick request. Please try again.', 
            flags: MessageFlags.Ephemeral 
          }).catch(() => {});
        }
      }
    } catch (error) {
      logError('Kick Command', error);
      const errorEmbed = createErrorEmbed('Command Error', 'There was an error trying to kick this user. Check my permissions and try again.');
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
}