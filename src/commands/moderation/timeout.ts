import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { createModerationEmbed, createErrorEmbed, createInfoEmbed } from '../../utils/embeds';
import { logModeration, logError, logInfo, LogResult } from '../../utils/logger';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user for a specified duration')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to timeout')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Check if user has permission to moderate members
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        const errorEmbed = createErrorEmbed(
          'Missing Permissions', 
          'You do not have permission to timeout members in this server.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      const targetUser = interaction.options.getUser('user', true);
      
      // Get the guild and member objects
      const guild = interaction.guild;
      const member = guild?.members.cache.get(targetUser.id);
      
      if (!guild || !member) {
        const errorEmbed = createErrorEmbed('Member Not Found', 'Could not find that member in this server.');
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Check if the bot can timeout the member
      if (!member.moderatable) {
        const errorEmbed = createErrorEmbed(
          'Permission Error', 
          'I cannot timeout this user. They may have higher permissions than me or I lack the required permissions.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Create a modal for the timeout details
      const modal = new ModalBuilder()
        .setCustomId(`timeout-modal-${targetUser.id}-${Date.now()}`)
        .setTitle(`Timeout ${targetUser.username}`);
      
      // Create the duration input field
      const durationInput = new TextInputBuilder()
        .setCustomId('timeout-duration')
        .setLabel('Duration (e.g. 10m, 1h, 1d)')
        .setPlaceholder('Enter timeout duration like 10m, 1h, or 1d (max 28d)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      
      // Create the reason input field
      const reasonInput = new TextInputBuilder()
        .setCustomId('timeout-reason')
        .setLabel('Reason for Timeout')
        .setPlaceholder('Enter the reason for timing out this user...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);
      
      // Create action rows to hold the inputs
      const durationRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);
      const reasonRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
      
      // Add the inputs to the modal
      modal.addComponents(durationRow, reasonRow);
      
      // Show the modal to the user
      await interaction.showModal(modal);
      
      // Wait for the modal submission
      const filter = (i: ModalSubmitInteraction) => 
        i.customId.startsWith(`timeout-modal-${targetUser.id}`) && i.user.id === interaction.user.id;
      
      try {
        // Wait for the modal submission (5 minute timeout)
        const modalSubmission = await interaction.awaitModalSubmit({ filter, time: 300000 });
        
        // Get the values from the modal
        const durationString = modalSubmission.fields.getTextInputValue('timeout-duration');
        const reason = modalSubmission.fields.getTextInputValue('timeout-reason');
        
        // Parse the duration string (e.g., "10m", "1h", "1d")
        const duration = parseDuration(durationString);
        
        if (duration === null) {
          await modalSubmission.reply({  
            content: 'Invalid duration format. Please use formats like 10m, 1h, or 1d (maximum 28 days).', 
            flags: MessageFlags.Ephemeral 
           });
          return;
        }
        
        // Defer the reply to the modal submission
        await modalSubmission.deferReply({ flags: MessageFlags.Ephemeral });
      
        // First try to DM the user with a detailed timeout message
        try {
          const timeoutDMEmbed = createModerationEmbed({
            action: 'Timeout',
            target: targetUser,
            moderator: interaction.user,
            reason: reason,
            additionalFields: [
              { name: '⏱️ Duration', value: formatDuration(duration), inline: true },
              { name: '🏠 Server', value: guild.name, inline: true },
              { name: '⚠️ Timeout Information', value: 'While timed out, you cannot send messages, react to messages, join voice channels, or use slash commands.' }
            ]
          });
          
          await targetUser.send({ 
            content: `⚠️ **You have been timed out in ${guild.name}** ⚠️`, 
            embeds: [timeoutDMEmbed] 
          });
          
          console.log(`Successfully sent detailed timeout DM to ${targetUser.tag}`);
        } catch (error) {
          // Couldn't DM the user, but we'll still proceed with the timeout
          console.error(`Could not DM user ${targetUser.tag} for timeout: ${error}`);
        }
        
        // Now perform the timeout
        await member.timeout(duration, reason);
        
        // Create a stylish moderation embed for the server
        const timeoutEmbed = createModerationEmbed({
          action: 'Timeout',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          additionalFields: [
            { name: '⏱️ Duration', value: formatDuration(duration), inline: true },
            { name: '🔚 Expires', value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`, inline: true },
            { name: '🏠 Server', value: guild.name, inline: true }
          ]
        });
        
        await modalSubmission.editReply({ embeds: [timeoutEmbed] });
        
        // Log the moderation action
        const logResult: LogResult = await logModeration({
          guild: guild,
          action: 'Timeout',
          target: targetUser,
          moderator: interaction.user,
          reason: reason,
          duration: formatDuration(duration),
          additionalInfo: `User was timed out in ${guild.name} for ${formatDuration(duration)}`
        });
        
        // If logging failed, add a note to the response
        if (!logResult.success && logResult.message) {
          const logInfoEmbed = createInfoEmbed('Logging Information', logResult.message);
          await modalSubmission.followUp({ embeds: [logInfoEmbed], flags: MessageFlags.Ephemeral });
        }
      } catch (error: any) {
        // Modal timed out or was cancelled
        if (error?.code === 'InteractionCollectorError') {
          logInfo('Timeout Command', `${interaction.user.tag} started but didn't complete timing out ${targetUser.tag}`);
        } else { logError('Timeout Modal', error);
          await interaction.followUp({ 
            content: 'There was an error processing your timeout request. Please try again.', 
            flags: MessageFlags.Ephemeral 
           }).catch(() => {});
        }
      }
    } catch (error) {
      logError('Timeout Command', error);
      const errorEmbed = createErrorEmbed('Command Error', 'There was an error trying to timeout this user. Please try again later.');
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  },
};

// Helper function to parse duration strings like "10m", "1h", "1d" into milliseconds
function parseDuration(durationString: string): number | null {
  const regex = /^(\d+)([mhd])$/;
  const match = durationString.match(regex);
  
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  if (value <= 0) return null;
  
  // Convert to milliseconds
  switch (unit) {
    case 'm': // minutes
      return value * 60 * 1000;
    case 'h': // hours
      return value * 60 * 60 * 1000;
    case 'd': // days
      // Discord has a maximum timeout of 28 days
      if (value > 28) return null;
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

// Format milliseconds into a human-readable duration
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'}`;
  } else if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  } else {
    return `${seconds} second${seconds === 1 ? '' : 's'}`;
  }
}
