import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logCommandUsage, logWarning } from '../../utils/logger';
import { getContextLanguage, getTranslation as t } from '../../utils/language';

export const data = new SlashCommandBuilder()
  .setName('nuke')
  .setDescription('⚠️ WARNING: Deletes all channels and creates a new one. Server owner only!')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Get guild and check if user is owner
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

    // Get language setting
    const language = await getContextLanguage(guild.id);

    // Create confirmation modal
    const modal = new ModalBuilder()
      .setCustomId(`nuke-confirm-${interaction.user.id}-${Date.now()}`)
      .setTitle('⚠️ Server Nuke Confirmation');

    // Create confirmation input
    const confirmInput = new TextInputBuilder()
      .setCustomId('nuke-confirm-input')
      .setLabel('Type CONFIRM-NUKE to proceed')
      .setPlaceholder('Type CONFIRM-NUKE in all caps')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(0)
      .setMaxLength(20);

    // Add warning text
    const warningInput = new TextInputBuilder()
      .setCustomId('nuke-warning')
      .setLabel('WARNING: This will delete ALL channels!')
      .setValue('• Delete ALL channels\n• Delete ALL categories\n• Create new bot-commands channel')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    // Add inputs to modal
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(confirmInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(warningInput)
    );

    // Show the modal
    await interaction.showModal(modal);

    try {
      // Wait for modal submission
      const filter = (i: ModalSubmitInteraction) => 
        i.customId.startsWith(`nuke-confirm-${interaction.user.id}`) &&
        i.user.id === interaction.user.id;

      const submission = await interaction.awaitModalSubmit({
        filter,
        time: 60000 // 1 minute
      });

      // Get the confirmation text
      const confirmText = submission.fields.getTextInputValue('nuke-confirm-input');

      if (confirmText.trim() !== 'CONFIRM-NUKE') {
        await submission.reply({
          content: '❌ Nuke cancelled: Incorrect confirmation text.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Log the action first
      await logWarning('Server Nuke', `Server ${guild.name} (${guild.id}) is being nuked by owner ${interaction.user.tag} (${interaction.user.id})`);

      // Defer the reply since this will take a while
      await submission.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        // Get all channels and categories
        const channels = await guild.channels.fetch();

        // Send initial response
        await submission.editReply({
          content: '🚀 Initiating server nuke...'
        });

        // Delete all channels and categories
        for (const [_, channel] of channels) {
          if (channel) {
            await channel.delete().catch(console.error);
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
          .setTitle('Server Reset Complete')
          .setDescription(`The server has been reset by ${interaction.user.tag}. This is the new bot-commands channel.`)
          .setTimestamp();

        await newChannel.send({ embeds: [completionEmbed] });

        // Try to DM the owner
        try {
          const owner = await guild.fetchOwner();
          const dmEmbed = new EmbedBuilder()
            .setColor(Colors.WARNING)
            .setTitle(`Server Nuke Executed - ${guild.name}`)
            .setDescription(`Your server "${guild.name}" has been nuked as requested.\nAll channels have been deleted and a new "bot-commands" channel has been created.\n\nExecuted by: ${interaction.user.tag} (${interaction.user.id})`)
            .setTimestamp();

          await owner.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.error('Failed to DM server owner:', error);
        }

        // Log command usage
        await logCommandUsage({
          guild: guild,
          user: interaction.user,
          command: 'nuke',
          options: interaction.options.data,
          channel: newChannel,
          success: true
        });

      } catch (error) {
        console.error('Error during nuke:', error);
        await submission.followUp({
          content: '❌ An error occurred while nuking the server.',
          flags: MessageFlags.Ephemeral
        });
      }

    } catch (error: any) {
      console.error('Error in modal handling:', error);
      // Don't try to respond to the original interaction as it may have timed out
      if (error.code === 'InteractionCollectorError') {
        console.error('Modal submission timeout');
        // Modal timed out, we can't respond to the original interaction anymore
      } else { console.error('Error in modal handling:', error);
        // Only attempt to respond if we haven't already
        try {
          // Check if the interaction can still be replied to
          if (!interaction.replied && !interaction.deferred) {
            await interaction.followUp({
              content: '❌ An error occurred while processing your confirmation.',
              flags: MessageFlags.Ephemeral
             });
          }
        } catch (followUpError) {
          console.error('Error sending follow-up message:', followUpError);
        }
      }
    }

  } catch (error) {
    console.error('Error in nuke command:', error);
    try {
      // Only reply if we haven't already responded to the interaction
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: '❌ An error occurred while executing the command.',
          flags: MessageFlags.Ephemeral
         });
      }
    } catch (error) {
      console.error('Error sending error message:', error);
    }
  }
}
