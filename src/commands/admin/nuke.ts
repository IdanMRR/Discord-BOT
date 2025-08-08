import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logWarning, logInfo, logError } from '../../utils/logger';
import { getContextLanguage, getTranslation as t } from '../../utils/language';

export const data = new SlashCommandBuilder()
  .setName('nuke')
  .setDescription('⚠️ WARNING: Deletes all channels and creates a new one. Server owner only!')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Quick validation checks first
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ 
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Check if the user is the server owner
    if (interaction.user.id !== guild.ownerId) {
      await interaction.reply({
        content: '⚠️ This command can only be used by the server owner.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Create and show modal immediately (this acknowledges the interaction)
    const modal = new ModalBuilder()
      .setCustomId(`nuke-confirm-${interaction.user.id}-${Date.now()}`)
      .setTitle('⚠️ Server Nuke Confirmation');

    const confirmInput = new TextInputBuilder()
      .setCustomId('nuke-confirm-input')
      .setLabel('Type CONFIRM-NUKE to proceed')
      .setPlaceholder('Type CONFIRM-NUKE in all caps')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(12)
      .setMaxLength(12);

    const warningInput = new TextInputBuilder()
      .setCustomId('nuke-warning')
      .setLabel('WARNING: This will delete ALL channels!')
      .setValue('This action will:\n• Delete ALL channels\n• Delete ALL categories\n• Create new bot-commands channel\n\nThis action CANNOT be undone!')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(confirmInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(warningInput)
    );

    // Show modal - this acknowledges the interaction
    await interaction.showModal(modal);

    // Wait for modal submission
    try {
      const filter = (i: ModalSubmitInteraction) => 
        i.customId.startsWith(`nuke-confirm-${interaction.user.id}`) &&
        i.user.id === interaction.user.id;

      const submission = await interaction.awaitModalSubmit({
        filter,
        time: 60000 // 1 minute timeout
      });

      // Get the confirmation text
      const confirmText = submission.fields.getTextInputValue('nuke-confirm-input');

      // IMMEDIATELY defer the modal reply to prevent timeout
      try {
        if (!submission.replied && !submission.deferred) {
          await submission.deferReply({ flags: MessageFlags.Ephemeral });
        }
      } catch (deferError: any) {
        if (deferError.code === 10062 || deferError.code === 10008) {
          logInfo('Nuke', 'Modal interaction expired before we could defer');
          return; // Exit early if interaction expired
        }
        logError('Nuke', `Error deferring modal reply: ${deferError}`);
        return;
      }

      if (confirmText.trim() !== 'CONFIRM-NUKE') {
        try {
          await submission.editReply({
            content: '❌ Nuke cancelled: Incorrect confirmation text. You must type exactly "CONFIRM-NUKE".'
          });
        } catch (editError: any) {
          if (editError.code === 10062 || editError.code === 10008) {
            logInfo('Nuke', 'Modal interaction expired during cancellation message');
          }
        }
        return;
      }

      // Log the action
      await logWarning('Server Nuke', `Server ${guild.name} (${guild.id}) is being nuked by owner ${interaction.user.tag} (${interaction.user.id})`);

      // Send initial confirmation
      await submission.editReply({
        content: '🚀 Initiating server nuke... This may take a moment.'
      });

      // Try to DM the owner BEFORE starting the nuke (in case channels get deleted)
      let dmSent = false;
      try {
        logInfo('Nuke', `Attempting to fetch owner for guild ${guild.id}`);
        const owner = await guild.fetchOwner();
        logInfo('Nuke', `Owner fetched: ${owner.user.tag} (${owner.user.id})`);
        
        const dmEmbed = new EmbedBuilder()
          .setColor(Colors.WARNING)
          .setTitle(`🚀 Server Nuke Started - ${guild.name}`)
          .setDescription(`Your server "${guild.name}" nuke operation has begun.\n\n**Initiated by:** ${interaction.user.tag} (${interaction.user.id})\n\nI'll send you another message when it's complete.`)
          .setTimestamp();

        logInfo('Nuke', `Attempting to send start DM to owner ${owner.user.tag}`);
        await owner.send({ embeds: [dmEmbed] });
        dmSent = true;
        logInfo('Nuke', `Successfully sent start DM to owner ${owner.user.tag}`);
      } catch (dmError: any) {
        logError('Nuke', `Failed to DM server owner (start notification). Error code: ${dmError.code}, message: ${dmError.message}`);
        if (dmError.code === 50007) {
          logInfo('Nuke', `Owner ${guild.ownerId} has DMs disabled`);
        } else if (dmError.code === 10013) {
          logInfo('Nuke', 'Unknown user - owner may have left Discord');
        } else {
          logError('Nuke', `Unexpected DM error: ${dmError}`);
        }
      }

      // Perform the nuke operation
      try {
        // Get all channels and categories
        const channels = await guild.channels.fetch();
        let deletedCount = 0;

        // Delete all channels and categories
        for (const [_, channel] of channels) {
          if (channel) {
            try {
              await channel.delete();
              deletedCount++;
            } catch (error) {
              logError('Nuke', `Failed to delete channel ${channel.name}: ${error}`);
            }
          }
        }

        // Create new bot-commands channel
        const newChannel = await guild.channels.create({
          name: 'bot-commands',
          type: ChannelType.GuildText,
        });

        // Send completion message in new channel
        const completionEmbed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle('🚀 Server Reset Complete')
          .setDescription(`The server has been reset by ${interaction.user.tag}.\n\n**Statistics:**\n• Deleted ${deletedCount} channels/categories\n• Created new bot-commands channel\n\nThis is your new bot-commands channel.`)
          .setTimestamp();

        await newChannel.send({ embeds: [completionEmbed] });

        // Try to update the modal reply (might fail if interaction expired)
        try {
          await submission.editReply({
            content: `✅ Server nuke completed successfully!\n• Deleted ${deletedCount} channels/categories\n• Created new #bot-commands channel\n\nCheck the new #bot-commands channel for confirmation.`
          });
        } catch (editError: any) {
          if (editError.code === 10008) {
            logInfo('Nuke', 'Modal interaction expired, but nuke completed successfully');
          } else {
            logError('Nuke', `Error updating modal reply: ${editError}`);
          }
        }

        // Send completion DM to owner
        try {
          logInfo('Nuke', 'Attempting to send completion DM to owner');
          const owner = await guild.fetchOwner();
          const completionDmEmbed = new EmbedBuilder()
            .setColor(Colors.SUCCESS)
            .setTitle(`✅ Server Nuke Complete - ${guild.name}`)
            .setDescription(`Your server "${guild.name}" has been successfully nuked.\n\n**Final Statistics:**\n• Deleted ${deletedCount} channels/categories\n• Created new "bot-commands" channel\n• Executed by: ${interaction.user.tag} (${interaction.user.id})\n\nYou can now find the new #bot-commands channel in your server.`)
            .setTimestamp();

          await owner.send({ embeds: [completionDmEmbed] });
          logInfo('Nuke', `Successfully sent completion DM to owner ${owner.user.tag}`);
        } catch (dmError: any) {
          logError('Nuke', `Failed to DM server owner (completion notification). Error code: ${dmError.code}, message: ${dmError.message}`);
          if (dmError.code === 50007) {
            logInfo('Nuke', `Owner ${guild.ownerId} has DMs disabled - cannot send completion notification`);
          } else if (dmError.code === 10013) {
            logInfo('Nuke', 'Unknown user - owner may have left Discord');
          } else {
            logError('Nuke', `Unexpected completion DM error: ${dmError}`);
          }
        }

      } catch (nukeError) {
        logError('Nuke', `Error during nuke operation: ${nukeError}`);
        
        try {
          await submission.editReply({
            content: '❌ An error occurred during the nuke operation. Some channels may not have been deleted.'
          });
        } catch (editError: any) {
          if (editError.code === 10008) {
            logInfo('Nuke', 'Modal interaction expired during error handling');
          } else {
            logError('Nuke', `Error updating modal reply: ${editError}`);
          }
        }

        // Send error DM to owner
        try {
          logInfo('Nuke', 'Attempting to send error DM to owner');
          const owner = await guild.fetchOwner();
          const errorDmEmbed = new EmbedBuilder()
            .setColor(Colors.ERROR)
            .setTitle(`❌ Server Nuke Failed - ${guild.name}`)
            .setDescription(`There was an error during the nuke operation for "${guild.name}".\n\n**Error:** ${nukeError}\n**Initiated by:** ${interaction.user.tag} (${interaction.user.id})\n\nSome channels may not have been deleted. Please check your server.`)
            .setTimestamp();

          await owner.send({ embeds: [errorDmEmbed] });
          logInfo('Nuke', 'Successfully sent error DM to owner');
        } catch (dmError: any) {
          logError('Nuke', `Failed to DM server owner (error notification). Error code: ${dmError.code}, message: ${dmError.message}`);
          if (dmError.code === 50007) {
            logInfo('Nuke', `Owner ${guild.ownerId} has DMs disabled - cannot send error notification`);
          } else if (dmError.code === 10013) {
            logInfo('Nuke', 'Unknown user - owner may have left Discord');
          } else {
            logError('Nuke', `Unexpected error DM error: ${dmError}`);
          }
        }
      }

    } catch (modalError: any) {
      // Modal timed out or other error
      if (modalError.code === 'InteractionCollectorError') {
        logInfo('Nuke', 'Modal timed out - user did not respond within 60 seconds');
      } else if (modalError.code === 10062 || modalError.code === 10008) {
        logInfo('Nuke', 'Modal interaction expired or unknown');
      } else {
        logError('Nuke', `Error waiting for modal submission: ${modalError}`);
      }
      // Don't try to respond - the modal interaction may have expired
      return;
    }

  } catch (error) {
    logError('Nuke', `Error in nuke command: ${error}`);
    
    // Only try to respond if we haven't shown a modal yet
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: '❌ An error occurred while executing the command.',
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (replyError) {
      logError('Nuke', `Error sending error message: ${replyError}`);
    }
  }
}
