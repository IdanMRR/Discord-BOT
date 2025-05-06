import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
  TextChannel,
  PermissionsBitField,
  Role
} from 'discord.js';
import { Colors, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { ServerSettingsService } from '../../database/services/sqliteService';
import { getTranslation as t, getContextLanguage } from '../../utils/language';

export const data = new SlashCommandBuilder()
  .setName('setup-ticket-logs')
  .setDescription('Set up a dedicated channel for ticket transcripts and logs')
  .addRoleOption(option => 
    option.setName('staff_role')
      .setDescription('The staff role that should have access to the logs channel')
      .setRequired(true)
  )
  .addChannelOption(option => 
    option.setName('channel')
      .setDescription('The channel to use for ticket logs (leave empty to create a new one)')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Defer the reply as this might take some time
    await interaction.deferReply({ flags: 64 }); // 64 is the flag for ephemeral messages

    // Get the guild's language preference
    const language = await getContextLanguage(interaction.guildId!);

    // Get options
    const existingChannel = interaction.options.getChannel('channel') as TextChannel | null;
    const staffRole = interaction.options.getRole('staff_role') as Role;

    // Log command usage
    try {
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'setup-ticket-logs',
        options: { 
          channel: existingChannel?.name,
          staffRole: staffRole?.name
        },
        channel: interaction.channel,
        success: true
      });
    } catch (error) {
      console.error('Error logging command usage:', error);
    }

    let ticketLogsChannel: TextChannel;

    // Use existing channel or create a new one
    if (existingChannel && existingChannel.type === ChannelType.GuildText) {
      ticketLogsChannel = existingChannel;
      
      // Update permissions for the existing channel
      await ticketLogsChannel.permissionOverwrites.set([
        {
          id: interaction.guild!.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: staffRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ],
          deny: [PermissionsBitField.Flags.SendMessages]
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages
          ]
        }
      ]);
    } else {
      // Create a new ticket logs channel
      ticketLogsChannel = await interaction.guild!.channels.create({
        name: 'ticket-logs',
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild!.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: staffRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.ReadMessageHistory
            ],
            deny: [PermissionsBitField.Flags.SendMessages]
          },
          {
            id: interaction.client.user!.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageMessages
            ]
          }
        ]
      });
    }

    // Update settings in the database
    const settings = await ServerSettingsService.getOrCreate(interaction.guildId!, interaction.guild!.name);
    if (!settings) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          t('error', language),
          t('settings.server_settings_error', language)
        )]
      });
      return;
    }

    // Update the ticket logs channel ID
    await ServerSettingsService.updateSettings(interaction.guildId!, {
      ticket_logs_channel_id: ticketLogsChannel.id
    });

    // Send welcome message to the logs channel
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`📋 ${t('tickets.transcript_title', language)}`)
      .setDescription(t('tickets.logs_channel_description', language))
      .setColor(Colors.INFO)
      .addFields([
        { 
          name: t('tickets.logs_purpose', language), 
          value: t('tickets.logs_purpose_description', language) 
        }
      ])
      .setTimestamp()
      .setFooter({ text: t('general.footer', language) });

    await ticketLogsChannel.send({ embeds: [welcomeEmbed] });

    // Send success message
    const successEmbed = new EmbedBuilder()
      .setTitle(`✅ ${t('success', language)}`)
      .setDescription(t('tickets.logs_setup_success', language))
      .setColor(Colors.SUCCESS)
      .addFields([
        { 
          name: t('tickets.logs_channel', language), 
          value: `<#${ticketLogsChannel.id}>` 
        }
      ]);

    await interaction.editReply({ embeds: [successEmbed] });
    
    logInfo('Ticket Logs Setup', `Set up ticket logs channel in ${interaction.guild!.name}`);
  } catch (error) {
    logError('Ticket Logs Setup', `Error setting up ticket logs: ${error}`);
    
    // Get the guild's language preference
    const language = await getContextLanguage(interaction.guildId!);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', language),
        t('tickets.logs_setup_error', language)
      )]
    });
  }
}
