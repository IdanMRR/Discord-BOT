import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { createSuccessEmbed, createErrorEmbed, Colors } from '../../utils/embeds';
import { 
  getVerificationSettings, 
  VerificationSettings,
  VerificationType
} from '../../handlers/verification/verification-config';
import { createVerificationMessage } from '../../handlers/verification/verification-handler';

export const data = new SlashCommandBuilder()
  .setName('test-verification')
  .setDescription('Test the verification system by creating a verification message')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Channel to send the verification message to')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.guild) {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'This command can only be used in a server.')],
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    // Get verification settings
    const settings = await getVerificationSettings(interaction.guild.id);
    
    if (!settings || !settings.enabled) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          'Verification System Not Configured',
          'Verification is not enabled on this server. Use `/verification-setup` to configure it first.'
        )]
      });
      return;
    }

    // Get target channel
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    
    if (!targetChannel || !('isTextBased' in targetChannel) || !targetChannel.isTextBased()) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Invalid channel selected.')]
      });
      return;
    }

    // Create verification message
    const messageId = await createVerificationMessage(
      targetChannel.id,
      interaction.guild.id,
      settings
    );

    if (!messageId) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Error', 'Failed to create verification message.')]
      });
      return;
    }

    // Create status embed
    const statusEmbed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle('✅ Verification Test Successful')
      .setDescription(`Verification message has been created in <#${targetChannel.id}>`)
      .addFields([
        { name: 'Verification Type', value: settings.type, inline: true },
        { name: 'Role ID', value: settings.role_id || 'Not set', inline: true },
        { name: 'Log Channel', value: settings.log_channel_id ? `<#${settings.log_channel_id}>` : 'Not set', inline: true },
        { name: 'Message ID', value: messageId, inline: false }
      ])
      .setFooter({ text: 'Users can now click the verification button to test the system' })
      .setTimestamp();

    await interaction.editReply({
      embeds: [statusEmbed]
    });

  } catch (error) {
    console.error('[Test Verification] Error:', error);
    
    const errorEmbed = createErrorEmbed(
      'Test Failed',
      'An error occurred while testing the verification system. Check console for details.'
    );

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
} 