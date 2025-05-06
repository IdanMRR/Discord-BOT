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
  MessageFlags
} from 'discord.js';
import { Colors, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { settingsManager } from '../../utils/settings';


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
    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'roles-setup',
      options: {},
      channel: interaction.channel,
      success: true
    });

    // Get current settings
    const settings = await settingsManager.getSettings(interaction.guild!.id) || {};
    
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

    // Send the initial message
    const response = await interaction.reply({ 
      embeds: [embed], 
      components: [row], 
      flags: MessageFlags.Ephemeral,
      fetchReply: true
    });

    // Create collector for role type selection
    const collector = response.createMessageComponentCollector({ 
      componentType: ComponentType.StringSelect,
      filter: i => i.user.id === interaction.user.id && i.customId === 'role_type_select',
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (i: StringSelectMenuInteraction) => {
      const selectedRoleTypeId = i.values[0];
      const selectedRoleType = Object.values(ROLE_TYPES).find(rt => rt.id === selectedRoleTypeId);
      
      if (!selectedRoleType) {
        await i.reply({ 
          content: 'Invalid role type selected.', 
          flags: MessageFlags.Ephemeral 
        });
        return;
      }

      // Get current role for this type
      const currentRoleId = (settings as any)[selectedRoleTypeId];
      const currentRole = currentRoleId ? 
        interaction.guild!.roles.cache.get(currentRoleId) : 
        null;

      // Create embed for this role type
      const roleEmbed = new EmbedBuilder()
        .setTitle(`${selectedRoleType.emoji} ${selectedRoleType.name} Role Configuration`)
        .setDescription(selectedRoleType.description)
        .setColor(Colors.INFO)
        .addFields(
          { 
            name: 'Current Role', 
            value: currentRole ? `<@&${currentRole.id}>` : 'No role configured' 
          },
          {
            name: 'Select Role',
            value: 'Use the menu below to select a role for this permission type.'
          }
        );

      // Create role selection menu
      const roleRow = new ActionRowBuilder<RoleSelectMenuBuilder>()
        .addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(`role_select_${selectedRoleTypeId}`)
            .setPlaceholder('Select a role')
        );

      // Create back button row
      const backRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('role_type_select')
            .setPlaceholder('Back to role type selection')
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

      // Update the message
      await i.update({ 
        embeds: [roleEmbed], 
        components: [roleRow, backRow] 
      });

      // Create collector for role selection
      const roleCollector = response.createMessageComponentCollector({ 
        componentType: ComponentType.RoleSelect,
        filter: i => i.user.id === interaction.user.id && i.customId === `role_select_${selectedRoleTypeId}`,
        time: 300000 // 5 minutes
      });

      roleCollector.on('collect', async (roleInteraction: RoleSelectMenuInteraction) => {
        const selectedRole = roleInteraction.roles.first();
        
        if (!selectedRole) {
          await roleInteraction.reply({ 
            content: 'No role selected.', 
            flags: MessageFlags.Ephemeral 
          });
          return;
        }

        // Update settings
        const updatedSettings = { ...settings } as any;
        updatedSettings[selectedRoleTypeId] = selectedRole.id;
        
        // If this is the admin role, also update staff_role_ids for backward compatibility
        if (selectedRoleTypeId === 'admin_role') {
          updatedSettings.staff_role_ids = [selectedRole.id];
        }
        
        await settingsManager.updateSettings(interaction.guild!.id, updatedSettings);

        // Create success embed
        const successEmbed = new EmbedBuilder()
          .setTitle(`${selectedRoleType.emoji} ${selectedRoleType.name} Role Updated`)
          .setDescription(`The ${selectedRoleType.name} role has been set to <@&${selectedRole.id}>.`)
          .setColor(Colors.SUCCESS)
          .addFields(
            { 
              name: 'Permissions', 
              value: selectedRoleType.description 
            },
            {
              name: 'Next Steps',
              value: 'You can continue configuring other role types or close this menu.'
            }
          );

        // Update the message
        await roleInteraction.update({ 
          embeds: [successEmbed], 
          components: [backRow] 
        });

        // Log the role update
        logInfo('Roles Setup', `${selectedRoleType.name} role set to ${selectedRole.name} (${selectedRole.id}) in ${interaction.guild!.name}`);
      });
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        // If no interactions, update the message to show it's expired
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏱️ Configuration Timeout')
          .setDescription('The role configuration session has timed out due to inactivity.')
          .setColor(Colors.WARNING);

        await interaction.editReply({ 
          embeds: [timeoutEmbed], 
          components: [] 
        });
      }
    });

  } catch (error: any) {
    logError('Roles Setup', error);
    
    await interaction.reply({
      embeds: [
        createErrorEmbed('Roles Setup Error', `There was an error configuring roles: ${error.message}`)
      ],
      flags: MessageFlags.Ephemeral
    });

    // Log command usage with error
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'roles-setup',
      options: {},
      channel: interaction.channel,
      success: false,
      error: error.message
    });
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
