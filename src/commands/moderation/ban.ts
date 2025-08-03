import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { createModerationEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';
import { logModeration, logError, logInfo, LogResult } from '../../utils/logger';
import { logModerationToDatabase } from '../../utils/databaseLogger';
import { ModerationCaseService } from '../../database/services/sqliteService';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to ban')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Check if user has permission to ban members
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
        const errorEmbed = createErrorEmbed(
          'Missing Permissions', 
          'You do not have permission to ban members from this server.'
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
      
      // Get the guild and member objects
      const guild = interaction.guild;
      const member = guild?.members.cache.get(targetUser.id);
      
      if (!guild) {
        const errorEmbed = createErrorEmbed('Server Not Found', 'Could not find this server. This should never happen.');
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Check if the member exists and if the bot can ban them
      if (member && !member.bannable) {
        const errorEmbed = createErrorEmbed('Permission Error', 'I cannot ban this user. They may have higher permissions than me or I lack the required permissions.');
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Create a modal for the ban reason and options
      const modal = new ModalBuilder()
        .setCustomId(`ban-modal-${targetUser.id}-${Date.now()}`)
        .setTitle(`Ban ${targetUser.username}`);
      
      // Create the reason input field
      const reasonInput = new TextInputBuilder()
        .setCustomId('ban-reason')
        .setLabel('Reason for Ban')
        .setPlaceholder('Enter the reason for banning this user...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);
      
      // Create the days input field
      const daysInput = new TextInputBuilder()
        .setCustomId('ban-days')
        .setLabel('Delete Message History (days, 0-7)')
        .setPlaceholder('Enter number of days of message history to delete (0-7)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue('0');
      
      // Create action rows to hold the inputs
      const reasonRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
      const daysRow = new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput);
      
      // Add the inputs to the modal
      modal.addComponents(reasonRow, daysRow);
      
      // Show the modal to the user
      await interaction.showModal(modal);
      
      // Wait for the modal submission
      const filter = (i: ModalSubmitInteraction) => 
        i.customId.startsWith(`ban-modal-${targetUser.id}`) && i.user.id === interaction.user.id;
      
      try {
        // Wait for the modal submission (5 minute timeout)
        const modalSubmission = await interaction.awaitModalSubmit({ filter, time: 300000 });
        
        // Get the values from the modal
        const reason = modalSubmission.fields.getTextInputValue('ban-reason');
        const daysValue = modalSubmission.fields.getTextInputValue('ban-days');
        
        // Parse the days value, ensuring it's between 0-7
        let days = parseInt(daysValue) || 0;
        days = Math.max(0, Math.min(7, days)); // Ensure days is between 0 and 7
        
        // Defer the reply to the modal submission
        await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
      
        // Create moderation case first
        const moderationCase = await ModerationCaseService.create({
          guild_id: guild.id,
          action_type: 'Ban',
          user_id: targetUser.id,
          moderator_id: interaction.user.id,
          reason: reason,
          additional_info: `User was banned from ${guild.name}. Message history deleted: ${days} day(s).`
        });
        
        if (!moderationCase) {
          await modalSubmission.editReply({ 
            content: 'Failed to create moderation case. Please try again.'
          });
          return;
        }

        // First try to DM the user before banning them with a detailed message
        try {
          const banDMEmbed = createModerationEmbed({
            action: 'Ban',
            target: targetUser,
            moderator: interaction.user,
            reason: reason,
            caseNumber: moderationCase.case_number,
            additionalFields: [
              { name: '⏱️ Message History Deleted', value: `${days} day(s)`, inline: true },
              { name: '🏠 Server', value: guild.name, inline: true },
              { name: '📢 Appeal Information', value: 'If you believe this ban was a mistake, you may contact a server administrator.' }
            ]
          });
          
          await targetUser.send({ 
            content: `⚠️ **You have been banned from ${guild.name}** ⚠️`, 
            embeds: [banDMEmbed] 
          });
          
          console.log(`Successfully sent detailed DM to ${targetUser.tag} before banning`);
        } catch (error) {
          // Couldn't DM the user, but we'll still proceed with the ban
          console.error(`Could not DM user ${targetUser.tag} before banning: ${error}`);
        }
        
        // Now perform the ban
        await guild.members.ban(targetUser, { 
          deleteMessageSeconds: days * 86400, // Convert days to seconds
          reason: reason 
        });
        
        // Create a stylish moderation embed
        const banEmbed = createModerationEmbed({
          action: 'Ban',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          caseNumber: moderationCase.case_number,
          additionalFields: [
            { name: '⏱️ Message History Deleted', value: `${days} day(s)`, inline: true },
            { name: '🕒 Action Time', value: new Date().toLocaleString(), inline: true },
            { name: '🏠 Server', value: guild.name, inline: true }
          ]
        });
        
        await modalSubmission.editReply({ embeds: [banEmbed] });
        
        // Log to database
        await logModerationToDatabase({
          guild: guild,
          action: 'Ban',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          additionalInfo: `Ban Case #${moderationCase.case_number} - User was banned from ${guild.name}. Message history deleted: ${days} day(s).`
        });
        
      } catch (error: any) {
        // Modal timed out or was cancelled
        if (error?.code === 'InteractionCollectorError') {
          logInfo('Ban Command', `${interaction.user.tag} started but didn't complete banning ${targetUser.tag}`);
        } else { logError('Ban Modal', error);
          await interaction.followUp({ 
            content: 'There was an error processing your ban request. Please try again.', 
            flags: MessageFlags.Ephemeral 
           }).catch(() => {});
        }
      }
    } catch (error) {
      logError('Ban Command', error);
      const errorEmbed = createErrorEmbed('Command Error', 'There was an error trying to ban this user. Check my permissions and try again.');
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  },
};
