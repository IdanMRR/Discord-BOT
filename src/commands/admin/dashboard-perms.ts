import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, CommandInteraction, PermissionsBitField } from 'discord.js';
import { logInfo, logError } from '../../utils/logger';
import { 
  getDashboardPermissions as getPerms, 
  saveDashboardPermissions as savePerms, 
  getAllDashboardPermissions as getAllPerms 
} from '../../database/migrations/add-dashboard-permissions';

// Available dashboard permissions
const DASHBOARD_PERMISSIONS = {
  'admin': 'Full administrative access',
  'system_admin': 'System-level administrative access',
  'manage_users': 'Manage user permissions',
  'manage_tickets': 'Create, edit, and manage tickets',
  'manage_warnings': 'Create, edit, and manage warnings',
  'manage_settings': 'Modify server settings',
  'view_logs': 'View server and system logs',
  'view_tickets': 'View tickets (read-only)',
  'view_warnings': 'View warnings (read-only)',
  'view_dashboard': 'Basic dashboard access',
  'moderate_users': 'Moderate users (kick, ban, timeout)',
  'manage_roles': 'Manage server roles and permissions'
};

// Permission levels for easier management
const PERMISSION_LEVELS = {
  'owner': ['admin', 'system_admin', 'manage_users', 'manage_tickets', 'manage_warnings', 'manage_settings', 'view_logs', 'view_tickets', 'view_warnings', 'view_dashboard', 'moderate_users', 'manage_roles'],
  'admin': ['manage_tickets', 'manage_warnings', 'manage_settings', 'view_logs', 'view_tickets', 'view_warnings', 'view_dashboard', 'moderate_users', 'manage_roles'],
  'moderator': ['manage_tickets', 'manage_warnings', 'view_logs', 'view_tickets', 'view_warnings', 'view_dashboard', 'moderate_users'],
  'support': ['view_tickets', 'view_warnings', 'view_dashboard'],
  'viewer': ['view_dashboard']
};

export const data = new SlashCommandBuilder()
  .setName('dashboard-perms')
  .setDescription('Manage dashboard permissions for users')
  .addSubcommand(subcommand =>
    subcommand
      .setName('grant')
      .setDescription('Grant dashboard permissions to a user')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to grant permissions to')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('level')
          .setDescription('Permission level to grant')
          .setRequired(false)
          .addChoices(
            { name: 'Owner (Full Access)', value: 'owner' },
            { name: 'Admin (Most Access)', value: 'admin' },
            { name: 'Moderator (Moderate Access)', value: 'moderator' },
            { name: 'Support (Limited Access)', value: 'support' },
            { name: 'Viewer (Read Only)', value: 'viewer' }
          )
      )
      .addStringOption(option =>
        option
          .setName('permission')
          .setDescription('Specific permission to grant (alternative to level)')
          .setRequired(false)
          .addChoices(
            ...Object.entries(DASHBOARD_PERMISSIONS).map(([key, desc]) => ({
              name: `${key} - ${desc}`,
              value: key
            }))
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('revoke')
      .setDescription('Revoke dashboard permissions from a user')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('The user to revoke permissions from')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('permission')
          .setDescription('Specific permission to revoke (leave empty to revoke all)')
          .setRequired(false)
          .addChoices(
            ...Object.entries(DASHBOARD_PERMISSIONS).map(([key, desc]) => ({
              name: `${key} - ${desc}`,
              value: key
            }))
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List users with dashboard permissions')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Check permissions for a specific user')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('levels')
      .setDescription('Show available permission levels and their descriptions')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: CommandInteraction): Promise<void> {
  // Check if user has permission to manage dashboard permissions
  const member = interaction.member;
  if (!member || !interaction.guild) {
    await interaction.reply({ 
      content: '❌ This command can only be used in a server.', 
      ephemeral: true 
    });
    return;
  }

  // Check if user is server owner or has administrator permission
  const isOwner = interaction.guild.ownerId === interaction.user.id;
  const memberPerms = member.permissions;
  const hasAdminPerm = memberPerms instanceof PermissionsBitField ? 
    memberPerms.has(PermissionFlagsBits.Administrator) : false;

  if (!isOwner && !hasAdminPerm) {
    await interaction.reply({
      content: '❌ You need to be the server owner or have Administrator permission to manage dashboard permissions.',
      ephemeral: true
    });
    return;
  }

  const subcommand = interaction.options.data[0]?.name;

  try {
    switch (subcommand) {
      case 'grant':
        await handleGrantPermissions(interaction);
        break;
      case 'revoke':
        await handleRevokePermissions(interaction);
        break;
      case 'list':
        await handleListPermissions(interaction);
        break;
      case 'levels':
        await handleShowLevels(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand.',
          ephemeral: true
        });
    }
  } catch (error) {
    logError('DashboardPerms', `Error executing dashboard-perms command: ${error}`);
    await interaction.reply({
      content: '❌ An error occurred while managing dashboard permissions.',
      ephemeral: true
    });
  }
}

async function handleGrantPermissions(interaction: CommandInteraction) {
  const user = interaction.options.data[0]?.options?.find(opt => opt.name === 'user')?.user;
  const level = interaction.options.data[0]?.options?.find(opt => opt.name === 'level')?.value as string;
  const permission = interaction.options.data[0]?.options?.find(opt => opt.name === 'permission')?.value as string;
  const guildId = interaction.guild!.id;

  if (!user) {
    await interaction.reply({
      content: '❌ User not found.',
      ephemeral: true
    });
    return;
  }

  if (!level && !permission) {
    await interaction.reply({
      content: '❌ You must specify either a permission level or a specific permission.',
      ephemeral: true
    });
    return;
  }

  let permissionsToGrant: string[] = [];
  
  if (level) {
    permissionsToGrant = PERMISSION_LEVELS[level as keyof typeof PERMISSION_LEVELS] || [];
  } else if (permission) {
    permissionsToGrant = [permission];
  }

  if (permissionsToGrant.length === 0) {
    await interaction.reply({
      content: '❌ No valid permissions found.',
      ephemeral: true
    });
    return;
  }

  // Get existing permissions
  const existingPerms = getPerms(user.id, guildId);
  const newPerms = [...new Set([...existingPerms, ...permissionsToGrant])];

  // Save to database
  savePerms(user.id, guildId, newPerms);

  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('✅ Dashboard Permissions Granted')
    .setDescription(`Successfully granted dashboard permissions to ${user.tag}`)
    .addFields([
      {
        name: 'User',
        value: `${user.tag} (${user.id})`,
        inline: true
      },
      {
        name: level ? 'Permission Level' : 'Permission',
        value: level ? `${level.charAt(0).toUpperCase() + level.slice(1)}` : permission!,
        inline: true
      },
      {
        name: 'Permissions Granted',
        value: permissionsToGrant.map(p => `• ${p}`).join('\n'),
        inline: false
      }
    ])
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });

  logInfo('DashboardPerms', `${interaction.user.tag} granted dashboard permissions ${permissionsToGrant.join(', ')} to ${user.tag} in guild ${guildId}`);
}

async function handleRevokePermissions(interaction: CommandInteraction) {
  const user = interaction.options.data[0]?.options?.find(opt => opt.name === 'user')?.user;
  const permission = interaction.options.data[0]?.options?.find(opt => opt.name === 'permission')?.value as string;
  const guildId = interaction.guild!.id;

  if (!user) {
    await interaction.reply({
      content: '❌ User not found.',
      ephemeral: true
    });
    return;
  }

  if (!permission) {
    // Revoke all permissions
    savePerms(user.id, guildId, []);
    
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('✅ All Dashboard Permissions Revoked')
      .setDescription(`Successfully revoked all dashboard permissions from ${user.tag}`)
      .addFields([
        {
          name: 'User',
          value: `${user.tag} (${user.id})`,
          inline: true
        }
      ])
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    // Revoke specific permission
    const existingPerms = getPerms(user.id, guildId);
    const newPerms = existingPerms.filter(p => p !== permission);

    savePerms(user.id, guildId, newPerms);

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('✅ Dashboard Permission Revoked')
      .setDescription(`Successfully revoked dashboard permission from ${user.tag}`)
      .addFields([
        {
          name: 'User',
          value: `${user.tag} (${user.id})`,
          inline: true
        },
        {
          name: 'Permission Revoked',
          value: permission,
          inline: true
        }
      ])
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  logInfo('DashboardPerms', `${interaction.user.tag} revoked dashboard permission ${permission || 'ALL'} from ${user.tag} in guild ${guildId}`);
}

async function handleListPermissions(interaction: CommandInteraction) {
  const user = interaction.options.data[0]?.options?.find(opt => opt.name === 'user')?.user;
  const guildId = interaction.guild!.id;

  if (user) {
    // Show permissions for specific user
    const permissions = getPerms(user.id, guildId);
    
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📋 Dashboard Permissions')
      .setDescription(`Dashboard permissions for ${user.tag}`)
      .addFields([
        {
          name: 'User',
          value: `${user.tag} (${user.id})`,
          inline: true
        },
        {
          name: 'Permissions',
          value: permissions.length > 0 ? permissions.map(p => `• ${p}`).join('\n') : 'No permissions granted',
          inline: false
        }
      ])
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    // Show all users with permissions
    const allPermissions = getAllPerms(guildId);
    
    if (allPermissions.length === 0) {
      await interaction.reply({
        content: '📋 No users currently have dashboard permissions in this server.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📋 All Dashboard Permissions')
      .setDescription(`Users with dashboard permissions in this server`)
      .setTimestamp();

    // Add fields for each user (limit to first 10 to avoid embed limits)
    const usersToShow = allPermissions.slice(0, 10);
    for (const userPerm of usersToShow) {
      try {
        const discordUser = await interaction.client.users.fetch(userPerm.user_id);
        embed.addFields([
          {
            name: `${discordUser.tag}`,
            value: userPerm.permissions.map((p: string) => `• ${p}`).join('\n') || 'No permissions',
            inline: true
          }
        ]);
      } catch (error) {
        embed.addFields([
          {
            name: `Unknown User (${userPerm.user_id})`,
            value: userPerm.permissions.map((p: string) => `• ${p}`).join('\n') || 'No permissions',
            inline: true
          }
        ]);
      }
    }

    if (allPermissions.length > 10) {
      embed.setFooter({ text: `Showing first 10 of ${allPermissions.length} users` });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleShowLevels(interaction: CommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('📊 Dashboard Permission Levels')
    .setDescription('Available permission levels and their included permissions');

  for (const [level, permissions] of Object.entries(PERMISSION_LEVELS)) {
    embed.addFields([
      {
        name: `${level.charAt(0).toUpperCase() + level.slice(1)}`,
        value: permissions.map(p => `• ${p}`).join('\n'),
        inline: true
      }
    ]);
  }

  embed.addFields([
    {
      name: 'Individual Permissions',
      value: Object.entries(DASHBOARD_PERMISSIONS)
        .map(([key, desc]) => `• **${key}**: ${desc}`)
        .join('\n'),
      inline: false
    }
  ]);

  await interaction.reply({ embeds: [embed], ephemeral: true });
} 