import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { createModerationEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';
import { logModeration, logError, logInfo, LogResult } from '../../utils/logger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to kick')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
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
      
      // Get the guild and member objects
      const guild = interaction.guild;
      const member = guild?.members.cache.get(targetUser.id);
      
      if (!guild || !member) {
        const errorEmbed = createErrorEmbed('Member Not Found', 'Could not find that member in this server.');
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
      
        // First try to DM the user before kicking them with a detailed message
        try {
          const kickDMEmbed = createModerationEmbed({
            action: 'Kick',
            target: targetUser,
            moderator: interaction.user,
            reason: reason,
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
          additionalInfo: `User was kicked from ${guild.name}`
        });
        
        // If logging failed, add a note to the response
        if (!logResult.success && logResult.message) {
          const logInfoEmbed = createInfoEmbed('Logging Information', logResult.message);
          await modalSubmission.followUp({ embeds: [logInfoEmbed], flags: MessageFlags.Ephemeral });
        }
        
        // We already tried to DM the user before kicking them
      } catch (error: any) {
        // Modal timed out or was cancelled
        if (error?.code === 'InteractionCollectorError') {
          logInfo('Kick Command', `${interaction.user.tag} started but didn't complete kicking ${targetUser.tag}`);
        } else { logError('Kick Modal', error);
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
  },
};
