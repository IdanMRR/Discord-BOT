import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { integrationService, Integration } from '../../services/integrationService';
import { logCommandUsage } from '../../utils/command-logger';
import { logError } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('integrations')
  .setDescription('Manage external integrations and webhooks')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all integrations')
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Filter by integration type')
          .setRequired(false)
          .addChoices(
            { name: 'Webhook', value: 'webhook' },
            { name: 'RSS Feed', value: 'rss' },
            { name: 'GitHub', value: 'github' },
            { name: 'Twitter', value: 'twitter' },
            { name: 'Twitch', value: 'twitch' },
            { name: 'YouTube', value: 'youtube' },
            { name: 'API', value: 'api' },
            { name: 'Custom', value: 'custom' }
          )
      )
      .addBooleanOption(option =>
        option
          .setName('active-only')
          .setDescription('Show only active integrations')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a new integration')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View details of a specific integration')
      .addIntegerOption(option =>
        option
          .setName('integration-id')
          .setDescription('ID of the integration to view')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit an existing integration')
      .addIntegerOption(option =>
        option
          .setName('integration-id')
          .setDescription('ID of the integration to edit')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle')
      .setDescription('Enable or disable an integration')
      .addIntegerOption(option =>
        option
          .setName('integration-id')
          .setDescription('ID of the integration to toggle')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete an integration')
      .addIntegerOption(option =>
        option
          .setName('integration-id')
          .setDescription('ID of the integration to delete')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('sync')
      .setDescription('Manually sync an integration')
      .addIntegerOption(option =>
        option
          .setName('integration-id')
          .setDescription('ID of the integration to sync')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('webhooks')
      .setDescription('Manage integration webhooks')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('Action to perform')
          .setRequired(true)
          .addChoices(
            { name: 'List', value: 'list' },
            { name: 'Create', value: 'create' },
            { name: 'View', value: 'view' },
            { name: 'Delete', value: 'delete' }
          )
      )
      .addIntegerOption(option =>
        option
          .setName('webhook-id')
          .setDescription('Webhook ID (required for view/delete actions)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('logs')
      .setDescription('View integration logs and activity')
      .addIntegerOption(option =>
        option
          .setName('integration-id')
          .setDescription('ID of the integration (optional - shows all if not provided)')
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Number of records to show (default: 10)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(50)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  try {
            await logCommandUsage({
            command: interaction.commandName,
            user: interaction.user,
            guild: interaction.guild!,
            channel: interaction.channel!,
            success: true
        });

    switch (subcommand) {
      case 'list':
        await handleListIntegrations(interaction, guildId);
        break;
      case 'create':
        await handleCreateIntegration(interaction, guildId, userId);
        break;
      case 'view':
        await handleViewIntegration(interaction);
        break;
      case 'edit':
        await handleEditIntegration(interaction);
        break;
      case 'toggle':
        await handleToggleIntegration(interaction);
        break;
      case 'delete':
        await handleDeleteIntegration(interaction);
        break;
      case 'sync':
        await handleSyncIntegration(interaction);
        break;
      case 'webhooks':
        await handleWebhooks(interaction, guildId, userId);
        break;
      case 'logs':
        await handleIntegrationLogs(interaction, guildId);
        break;
    }
  } catch (error) {
    logError('Integrations', error as Error);
    console.error('Error in integrations command:', error);
    
    const errorMessage = 'An error occurred while executing the command.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleListIntegrations(interaction: ChatInputCommandInteraction, guildId: string) {
  const typeFilter = interaction.options.getString('type');
  const activeOnly = interaction.options.getBoolean('active-only') ?? false;

  const integrations = await integrationService.getGuildIntegrations(guildId);
  
  let filteredIntegrations = integrations;
  if (typeFilter) {
    filteredIntegrations = integrations.filter(integration => integration.integration_type === typeFilter);
  }
  if (activeOnly) {
    filteredIntegrations = filteredIntegrations.filter(integration => integration.is_active);
  }

  if (filteredIntegrations.length === 0) {
    await interaction.reply({
      content: `No integrations found${typeFilter ? ` for type "${typeFilter}"` : ''}${activeOnly ? ' (active only)' : ''}.`,
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🔗 Integrations')
    .setColor(0x00D4AA)
    .setDescription(`Found ${filteredIntegrations.length} integration(s)`)
    .setTimestamp();

  // Group integrations by type for better organization
  const integrationsByType: { [key: string]: Integration[] } = {};
  filteredIntegrations.forEach(integration => {
    if (!integrationsByType[integration.integration_type]) {
      integrationsByType[integration.integration_type] = [];
    }
    integrationsByType[integration.integration_type].push(integration);
  });

  Object.entries(integrationsByType).forEach(([type, integrationsOfType]) => {
    const integrationList = integrationsOfType.slice(0, 10).map(integration => {
      const status = integration.is_active ? '🟢' : '🔴';
      const lastSync = integration.last_sync ? `<t:${Math.floor(integration.last_sync.getTime() / 1000)}:R>` : 'Never';
      const errorInfo = integration.error_count > 0 ? `❌ ${integration.error_count}` : '✅';
      return `${status} **${integration.name}** (ID: ${integration.id})\n└ Provider: ${integration.provider} | Last Sync: ${lastSync} | ${errorInfo}`;
    }).join('\n\n');

    const typeName = type.charAt(0).toUpperCase() + type.slice(1);
    embed.addFields({
      name: `${typeName} Integrations (${integrationsOfType.length})`,
      value: integrationList || 'None',
      inline: false
    });
  });

  if (filteredIntegrations.length > 30) {
    embed.setFooter({ text: `Showing first 30 integrations. Use filters to narrow down results.` });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCreateIntegration(interaction: ChatInputCommandInteraction, guildId: string, userId: string) {
  const embed = new EmbedBuilder()
    .setTitle('🔗 Create Integration')
    .setDescription('Select the type of integration you want to create:')
    .setColor(0x00D4AA)
    .setTimestamp();

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId('integration_type_select')
    .setPlaceholder('Select integration type')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('RSS Feed')
        .setDescription('Subscribe to RSS/Atom feeds')
        .setValue('rss')
        .setEmoji('📰'),
      new StringSelectMenuOptionBuilder()
        .setLabel('GitHub')
        .setDescription('Monitor GitHub repositories')
        .setValue('github')
        .setEmoji('⚡'),
      new StringSelectMenuOptionBuilder()
        .setLabel('API Endpoint')
        .setDescription('Poll REST API endpoints')
        .setValue('api')
        .setEmoji('🔌'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Webhook')
        .setDescription('Receive webhook notifications')
        .setValue('webhook')
        .setEmoji('📡'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Twitter')
        .setDescription('Monitor Twitter feeds (coming soon)')
        .setValue('twitter')
        .setEmoji('🐦'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Twitch')
        .setDescription('Monitor Twitch streams (coming soon)')
        .setValue('twitch')
        .setEmoji('🎮'),
      new StringSelectMenuOptionBuilder()
        .setLabel('YouTube')
        .setDescription('Monitor YouTube channels (coming soon)')
        .setValue('youtube')
        .setEmoji('📺'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Custom')
        .setDescription('Custom integration with advanced configuration')
        .setValue('custom')
        .setEmoji('⚙️')
    );

  const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeSelect);

  await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
}

async function handleViewIntegration(interaction: ChatInputCommandInteraction) {
  const integrationId = interaction.options.getInteger('integration-id', true);
  
  const integration = await integrationService.getIntegration(integrationId);
  if (!integration) {
    await interaction.reply({ content: 'Integration not found.', ephemeral: true });
    return;
  }

  if (integration.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Integration not found in this server.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔗 Integration: ${integration.name}`)
    .setColor(integration.is_active ? 0x00D4AA : 0x747F8D)
    .setDescription(`Provider: **${integration.provider}** | Type: **${integration.integration_type}**`)
    .addFields(
      { name: 'Status', value: integration.is_active ? '🟢 Active' : '🔴 Inactive', inline: true },
      { name: 'Sync Count', value: integration.sync_count.toString(), inline: true },
      { name: 'Error Count', value: integration.error_count.toString(), inline: true },
      { name: 'Created By', value: `<@${integration.created_by}>`, inline: true }
    );

  if (integration.target_channel_id) {
    embed.addFields({ name: 'Target Channel', value: `<#${integration.target_channel_id}>`, inline: true });
  }

  if (integration.sync_frequency) {
    embed.addFields({ name: 'Sync Frequency', value: `${integration.sync_frequency} seconds`, inline: true });
  }

  if (integration.last_sync) {
    embed.addFields({ 
      name: 'Last Sync', 
      value: `<t:${Math.floor(integration.last_sync.getTime() / 1000)}:R>`, 
      inline: true 
    });
  }

  if (integration.next_sync) {
    embed.addFields({ 
      name: 'Next Sync', 
      value: `<t:${Math.floor(integration.next_sync.getTime() / 1000)}:R>`, 
      inline: true 
    });
  }

  // Show configuration (safely, without sensitive data)
  if (integration.config) {
    const safeConfig = { ...integration.config };
    delete safeConfig.api_key;
    delete safeConfig.token;
    delete safeConfig.password;
    delete safeConfig.secret;
    
    const configText = JSON.stringify(safeConfig, null, 2);
    if (configText.length > 1000) {
      embed.addFields({ name: 'Configuration', value: `\`\`\`json\n${configText.substring(0, 997)}...\`\`\``, inline: false });
    } else {
      embed.addFields({ name: 'Configuration', value: `\`\`\`json\n${configText}\`\`\``, inline: false });
    }
  }

  if (integration.last_error) {
    embed.addFields({ name: 'Last Error', value: `\`\`\`${integration.last_error.substring(0, 500)}\`\`\``, inline: false });
  }

  embed.setTimestamp(integration.created_at);
  embed.setFooter({ text: `Integration ID: ${integration.id}` });

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`edit_integration_${integrationId}`)
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId(`toggle_integration_${integrationId}`)
        .setLabel(integration.is_active ? 'Disable' : 'Enable')
        .setStyle(integration.is_active ? ButtonStyle.Danger : ButtonStyle.Success)
        .setEmoji(integration.is_active ? '⏸️' : '▶️'),
      new ButtonBuilder()
        .setCustomId(`sync_integration_${integrationId}`)
        .setLabel('Sync Now')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId(`delete_integration_${integrationId}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );

  await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
}

async function handleEditIntegration(interaction: ChatInputCommandInteraction) {
  const integrationId = interaction.options.getInteger('integration-id', true);
  
  const integration = await integrationService.getIntegration(integrationId);
  if (!integration) {
    await interaction.reply({ content: 'Integration not found.', ephemeral: true });
    return;
  }

  if (integration.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Integration not found in this server.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`edit_integration_${integrationId}`)
    .setTitle(`Edit Integration: ${integration.name}`);

  const nameInput = new TextInputBuilder()
    .setCustomId('integration_name')
    .setLabel('Integration Name')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(integration.name)
    .setMaxLength(100);

  const syncFrequencyInput = new TextInputBuilder()
    .setCustomId('sync_frequency')
    .setLabel('Sync Frequency (seconds, 0 to disable)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue((integration.sync_frequency || 0).toString())
    .setMaxLength(10);

  const messageTemplateInput = new TextInputBuilder()
    .setCustomId('message_template')
    .setLabel('Message Template (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setValue(integration.message_template || '')
    .setMaxLength(1500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(syncFrequencyInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(messageTemplateInput)
  );

  await interaction.showModal(modal);
}

async function handleToggleIntegration(interaction: ChatInputCommandInteraction) {
  const integrationId = interaction.options.getInteger('integration-id', true);
  
  const integration = await integrationService.getIntegration(integrationId);
  if (!integration) {
    await interaction.reply({ content: 'Integration not found.', ephemeral: true });
    return;
  }

  if (integration.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Integration not found in this server.', ephemeral: true });
    return;
  }

  const newStatus = !integration.is_active;
  await integrationService.updateIntegration(integrationId, { is_active: newStatus });

  const embed = new EmbedBuilder()
    .setTitle('✅ Integration Updated')
    .setDescription(`Integration **${integration.name}** has been ${newStatus ? 'enabled' : 'disabled'}.`)
    .setColor(newStatus ? 0x00D4AA : 0x747F8D)
    .setTimestamp();

  if (newStatus && integration.sync_frequency) {
    embed.addFields({ 
      name: 'Note', 
      value: `Sync will resume automatically every ${integration.sync_frequency} seconds.`, 
      inline: false 
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDeleteIntegration(interaction: ChatInputCommandInteraction) {
  const integrationId = interaction.options.getInteger('integration-id', true);
  
  const integration = await integrationService.getIntegration(integrationId);
  if (!integration) {
    await interaction.reply({ content: 'Integration not found.', ephemeral: true });
    return;
  }

  if (integration.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Integration not found in this server.', ephemeral: true });
    return;
  }

  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ Confirm Deletion')
    .setDescription(`Are you sure you want to delete the integration **${integration.name}**?\n\nThis action is irreversible and will also delete all associated webhooks and logs.`)
    .setColor(0xFF6B6B)
    .addFields(
      { name: 'Integration Details', value: `Type: ${integration.integration_type}\nProvider: ${integration.provider}\nSync Count: ${integration.sync_count}`, inline: false }
    )
    .setTimestamp();

  const confirmRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_delete_integration_${integrationId}`)
        .setLabel('Yes, Delete')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️'),
      new ButtonBuilder()
        .setCustomId('cancel_delete_integration')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌')
    );

  await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true });
}

async function handleSyncIntegration(interaction: ChatInputCommandInteraction) {
  const integrationId = interaction.options.getInteger('integration-id', true);
  
  const integration = await integrationService.getIntegration(integrationId);
  if (!integration) {
    await interaction.reply({ content: 'Integration not found.', ephemeral: true });
    return;
  }

  if (integration.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Integration not found in this server.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // This would trigger manual sync of the integration
    const embed = new EmbedBuilder()
      .setTitle('🔄 Integration Synced')
      .setDescription(`Integration **${integration.name}** has been manually synced.`)
      .setColor(0x00D4AA)
      .addFields(
        { name: 'Type', value: integration.integration_type, inline: true },
        { name: 'Provider', value: integration.provider, inline: true },
        { name: 'Sync Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Sync Failed')
      .setDescription(`Failed to sync integration **${integration.name}**.`)
      .setColor(0xFF6B6B)
      .addFields({ name: 'Error', value: `\`\`\`${error}\`\`\`` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

async function handleWebhooks(interaction: ChatInputCommandInteraction, guildId: string, userId: string) {
  const action = interaction.options.getString('action', true);
  const webhookId = interaction.options.getInteger('webhook-id');

  switch (action) {
    case 'list':
      await handleListWebhooks(interaction, guildId);
      break;
    case 'create':
      await handleCreateWebhook(interaction, guildId, userId);
      break;
    case 'view':
      if (!webhookId) {
        await interaction.reply({ content: 'Webhook ID is required for view action.', ephemeral: true });
        return;
      }
      await handleViewWebhook(interaction, webhookId);
      break;
    case 'delete':
      if (!webhookId) {
        await interaction.reply({ content: 'Webhook ID is required for delete action.', ephemeral: true });
        return;
      }
      await handleDeleteWebhook(interaction, webhookId);
      break;
  }
}

async function handleListWebhooks(interaction: ChatInputCommandInteraction, guildId: string) {
  const webhooks = await integrationService.getGuildWebhooks(guildId);

  if (webhooks.length === 0) {
    await interaction.reply({ content: 'No webhooks found in this server.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('📡 Webhooks')
    .setColor(0xED4245)
    .setDescription(`Found ${webhooks.length} webhook(s)`)
    .setTimestamp();

  const webhookList = webhooks.slice(0, 20).map(webhook => {
    const status = webhook.is_active ? '🟢' : '🔴';
    const stats = `✅ ${webhook.success_count} | ❌ ${webhook.failure_count}`;
    const lastTriggered = webhook.last_triggered ? `<t:${Math.floor(webhook.last_triggered.getTime() / 1000)}:R>` : 'Never';
    return `${status} **${webhook.name}** (ID: ${webhook.id})\n└ Events: ${webhook.events.join(', ')} | Stats: ${stats} | Last: ${lastTriggered}`;
  }).join('\n\n');

  embed.addFields({ name: 'Webhooks', value: webhookList, inline: false });

  if (webhooks.length > 20) {
    embed.setFooter({ text: `Showing first 20 webhooks.` });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCreateWebhook(interaction: ChatInputCommandInteraction, guildId: string, userId: string) {
  const embed = new EmbedBuilder()
    .setTitle('📡 Create Webhook')
    .setDescription('Webhooks allow external services to send notifications to your Discord server.')
    .setColor(0xED4245)
    .addFields(
      { name: 'What are webhooks?', value: 'Webhooks are HTTP endpoints that receive data from external services when events occur.', inline: false },
      { name: 'Security', value: 'Each webhook can have a secret token for verification and IP restrictions.', inline: false }
    )
    .setTimestamp();

  const createButton = new ButtonBuilder()
    .setCustomId('create_webhook_modal')
    .setLabel('Create Webhook')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📡');

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(createButton);

  await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
}

async function handleViewWebhook(interaction: ChatInputCommandInteraction, webhookId: number) {
  // Implementation for viewing webhook details
  await interaction.reply({ content: `Viewing webhook ${webhookId} (implementation pending)`, ephemeral: true });
}

async function handleDeleteWebhook(interaction: ChatInputCommandInteraction, webhookId: number) {
  // Implementation for deleting webhook
  await interaction.reply({ content: `Deleting webhook ${webhookId} (implementation pending)`, ephemeral: true });
}

async function handleIntegrationLogs(interaction: ChatInputCommandInteraction, guildId: string) {
  const integrationId = interaction.options.getInteger('integration-id');
  const limit = interaction.options.getInteger('limit') ?? 10;

  const embed = new EmbedBuilder()
    .setTitle('📊 Integration Logs')
    .setDescription(integrationId ? `Logs for integration ID ${integrationId}` : 'Recent activity logs for all integrations')
    .setColor(0x5865F2)
    .addFields({
      name: 'Coming Soon',
      value: 'Integration activity logs will be displayed here once the system is fully implemented.',
      inline: false
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}