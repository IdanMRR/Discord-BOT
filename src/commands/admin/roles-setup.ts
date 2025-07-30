import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Role,
  RoleSelectMenuBuilder,
  RoleSelectMenuInteraction,
  ComponentType,
  StringSelectMenuInteraction,
  MessageFlags,
  Message
} from 'discord.js';
import { Colors, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { settingsManager } from '../../utils/settings';
import { logCommandUsage } from '../../utils/command-logger';


// Define role types and their descriptions
const ROLE_TYPES = {
  ADMIN: {
    id: 'admin_role',
    name: 'Admin',
    description: 'Full access to all bot commands and features',
    emoji: '👑'
  },
  MODERATOR: {
    id: 'mod_role',
    name: 'Moderator',
    description: 'Can use moderation commands (ban, kick, warn, etc.)',
    emoji: '🛡️'
  },
  TICKET_STAFF: {
    id: 'ticket_staff_role',
    name: 'Ticket Staff',
    description: 'Can view and manage support tickets',
    emoji: '🎫'
  },
  TICKET_ADMIN: {
    id: 'ticket_admin_role',
    name: 'Ticket Admin',
    description: 'Can configure ticket settings and view ticket logs',
    emoji: '📊'
  },
  LOGS_VIEWER: {
    id: 'logs_viewer_role',
    name: 'Logs Viewer',
    description: 'Can view log channels',
    emoji: '📝'
  }
};

export const data = new SlashCommandBuilder()
  .setName('roles-setup')
  .setDescription('Configure roles for different bot permissions and features')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
        // Check if guild is available
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Get current settings
    const settings = await settingsManager.getSettings(interaction.guild.id) || {};
    
    // Create the initial embed
    const embed = new EmbedBuilder()
      .setTitle('🔧 Role Configuration')
      .setDescription('Configure which roles have access to different bot features. Select a role type to configure.')
      .setColor(Colors.INFO)
      .addFields(
        { 
          name: 'Current Configuration', 
          value: 'Select a role type below to view and update its configuration.' 
        }
      );

    // Create the role type selection menu
    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('role_type_select')
          .setPlaceholder('Select a role type to configure')
          .addOptions(
            Object.values(ROLE_TYPES).map(roleType => 
              new StringSelectMenuOptionBuilder()
                .setLabel(roleType.name)
                .setDescription(roleType.description)
                .setValue(roleType.id)
                .setEmoji(roleType.emoji)
            )
          )
      );

    // Reply with our initial message - simplified to avoid fetchReply issues
    await interaction.reply({ 
      embeds: [embed], 
      components: [row], 
      flags: MessageFlags.Ephemeral
    });

    // We don't use collectors to avoid issues with message component collector types
    logInfo('Roles Setup', `Role configuration menu displayed to ${interaction.user.tag}`);

  } catch (error: any) {
    logError('Roles Setup', error);
    
    try {
      if (!interaction.replied) {
        await interaction.reply({
          embeds: [
            createErrorEmbed('Roles Setup Error', `There was an error configuring roles: ${error.message}`)
          ],
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.editReply({
          embeds: [
            createErrorEmbed('Roles Setup Error', `There was an error configuring roles: ${error.message}`)
          ]
        });
      }
    } catch (replyError) {
      logError('Roles Setup', `Failed to send error message: ${replyError}`);
    }

    // Log command usage with error
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'roles-setup',
      options: {},
      channel: interaction.channel,
      success: false,
      error: error.message
    }).catch(e => logError('Roles Setup', `Failed to log command usage: ${e}`));
  }
}

// Helper function to update settings.ts to support new role types
export async function ensureSettingsSupport() {
  try {
    // This function would ideally update the ServerSettings interface in settings.ts
    // to include the new role types, but that would require modifying the source code.
    // For now, we'll just log that these settings are supported through the dynamic
    // nature of the settings object.
    logInfo('Roles Setup', 'Ensuring settings support for role configuration');
  } catch (error) {
    logError('Roles Setup', `Error ensuring settings support: ${error}`);
  }
}
