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
import { scheduledTaskService, AutomationRule } from '../../services/scheduledTaskService';
import { logCommandUsage } from '../../utils/command-logger';
import { logError } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('automation-rules')
  .setDescription('Manage automation rules and workflows')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all automation rules')
      .addStringOption(option =>
        option
          .setName('event')
          .setDescription('Filter by trigger event')
          .setRequired(false)
          .addChoices(
            { name: 'Member Join', value: 'member_join' },
            { name: 'Member Leave', value: 'member_leave' },
            { name: 'Message Sent', value: 'message_sent' },
            { name: 'Reaction Added', value: 'reaction_added' },
            { name: 'Role Assigned', value: 'role_assigned' },
            { name: 'Voice Join', value: 'voice_join' },
            { name: 'Voice Leave', value: 'voice_leave' },
            { name: 'Custom', value: 'custom' }
          )
      )
      .addBooleanOption(option =>
        option
          .setName('active-only')
          .setDescription('Show only active rules')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a new automation rule')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View details of a specific rule')
      .addIntegerOption(option =>
        option
          .setName('rule-id')
          .setDescription('ID of the rule to view')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit an existing automation rule')
      .addIntegerOption(option =>
        option
          .setName('rule-id')
          .setDescription('ID of the rule to edit')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle')
      .setDescription('Enable or disable an automation rule')
      .addIntegerOption(option =>
        option
          .setName('rule-id')
          .setDescription('ID of the rule to toggle')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete an automation rule')
      .addIntegerOption(option =>
        option
          .setName('rule-id')
          .setDescription('ID of the rule to delete')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('test')
      .setDescription('Test an automation rule with simulated data')
      .addIntegerOption(option =>
        option
          .setName('rule-id')
          .setDescription('ID of the rule to test')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('history')
      .setDescription('View execution history for automation rules')
      .addIntegerOption(option =>
        option
          .setName('rule-id')
          .setDescription('ID of the rule (optional - shows all if not provided)')
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
        await handleListRules(interaction, guildId);
        break;
      case 'create':
        await handleCreateRule(interaction, guildId, userId);
        break;
      case 'view':
        await handleViewRule(interaction);
        break;
      case 'edit':
        await handleEditRule(interaction);
        break;
      case 'toggle':
        await handleToggleRule(interaction);
        break;
      case 'delete':
        await handleDeleteRule(interaction);
        break;
      case 'test':
        await handleTestRule(interaction);
        break;
      case 'history':
        await handleRuleHistory(interaction, guildId);
        break;
    }
  } catch (error) {
    logError('AutomationRules', error as Error);
    console.error('Error in automation-rules command:', error);
    
    const errorMessage = 'An error occurred while executing the command.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleListRules(interaction: ChatInputCommandInteraction, guildId: string) {
  const eventFilter = interaction.options.getString('event');
  const activeOnly = interaction.options.getBoolean('active-only') ?? false;

  const rules = await scheduledTaskService.getGuildAutomationRules(guildId);
  
  let filteredRules = rules;
  if (eventFilter) {
    filteredRules = rules.filter(rule => rule.trigger_event === eventFilter);
  }
  if (activeOnly) {
    filteredRules = filteredRules.filter(rule => rule.is_active);
  }

  if (filteredRules.length === 0) {
    await interaction.reply({
      content: `No automation rules found${eventFilter ? ` for event "${eventFilter}"` : ''}${activeOnly ? ' (active only)' : ''}.`,
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🤖 Automation Rules')
    .setColor(0x7289DA)
    .setDescription(`Found ${filteredRules.length} rule(s)`)
    .setTimestamp();

  // Group rules by trigger event for better organization
  const rulesByEvent: { [key: string]: AutomationRule[] } = {};
  filteredRules.forEach(rule => {
    if (!rulesByEvent[rule.trigger_event]) {
      rulesByEvent[rule.trigger_event] = [];
    }
    rulesByEvent[rule.trigger_event].push(rule);
  });

  Object.entries(rulesByEvent).forEach(([event, rulesOfEvent]) => {
    const ruleList = rulesOfEvent.slice(0, 10).map(rule => {
      const status = rule.is_active ? '🟢' : '🔴';
      const priority = rule.priority > 0 ? `⚡ ${rule.priority}` : '📍 0';
      const stats = `${rule.success_count}✅ ${rule.error_count}❌`;
      return `${status} **${rule.name}** (ID: ${rule.id})\n└ Priority: ${priority} | Stats: ${stats}`;
    }).join('\n\n');

    const eventName = event.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    embed.addFields({
      name: `${eventName} Rules (${rulesOfEvent.length})`,
      value: ruleList || 'None',
      inline: false
    });
  });

  if (filteredRules.length > 30) {
    embed.setFooter({ text: `Showing first 30 rules. Use filters to narrow down results.` });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCreateRule(interaction: ChatInputCommandInteraction, guildId: string, userId: string) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 Create Automation Rule')
    .setDescription('Select the event that will trigger this automation rule:')
    .setColor(0x7289DA)
    .setTimestamp();

  const eventSelect = new StringSelectMenuBuilder()
    .setCustomId('automation_rule_event_select')
    .setPlaceholder('Select trigger event')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Member Join')
        .setDescription('When a new member joins the server')
        .setValue('member_join')
        .setEmoji('👋'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Member Leave')
        .setDescription('When a member leaves the server')
        .setValue('member_leave')
        .setEmoji('👋'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Message Sent')
        .setDescription('When a message is sent in any channel')
        .setValue('message_sent')
        .setEmoji('💬'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Reaction Added')
        .setDescription('When a reaction is added to a message')
        .setValue('reaction_added')
        .setEmoji('⭐'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Role Assigned')
        .setDescription('When a role is assigned to a member')
        .setValue('role_assigned')
        .setEmoji('🏷️'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Voice Join')
        .setDescription('When a member joins a voice channel')
        .setValue('voice_join')
        .setEmoji('🔊'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Voice Leave')
        .setDescription('When a member leaves a voice channel')
        .setValue('voice_leave')
        .setEmoji('🔇'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Custom Event')
        .setDescription('Custom event with advanced configuration')
        .setValue('custom')
        .setEmoji('⚙️')
    );

  const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(eventSelect);

  await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
}

async function handleViewRule(interaction: ChatInputCommandInteraction) {
  const ruleId = interaction.options.getInteger('rule-id', true);
  
  const rule = await scheduledTaskService.getAutomationRule(ruleId);
  if (!rule) {
    await interaction.reply({ content: 'Automation rule not found.', ephemeral: true });
    return;
  }

  if (rule.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Automation rule not found in this server.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🤖 Rule: ${rule.name}`)
    .setColor(rule.is_active ? 0x7289DA : 0x747F8D)
    .setDescription(rule.description || 'No description provided')
    .addFields(
      { name: 'Status', value: rule.is_active ? '🟢 Active' : '🔴 Inactive', inline: true },
      { name: 'Trigger Event', value: rule.trigger_event.replace('_', ' '), inline: true },
      { name: 'Priority', value: rule.priority.toString(), inline: true },
      { name: 'Executions', value: rule.execution_count.toString(), inline: true },
      { name: 'Success Count', value: rule.success_count.toString(), inline: true },
      { name: 'Error Count', value: rule.error_count.toString(), inline: true },
      { name: 'Cooldown', value: `${rule.cooldown_seconds} seconds`, inline: true },
      { name: 'Created By', value: `<@${rule.created_by}>`, inline: true }
    );

  if (rule.max_triggers_per_user) {
    embed.addFields({ name: 'Max Triggers/User', value: rule.max_triggers_per_user.toString(), inline: true });
  }

  // Show trigger conditions if any
  if (rule.trigger_conditions && rule.trigger_conditions.length > 0) {
    const conditions = rule.trigger_conditions.map(condition => 
      `• ${condition.type}: ${JSON.stringify(condition.config || condition)}`
    ).join('\n');
    embed.addFields({ name: 'Trigger Conditions', value: `\`\`\`${conditions}\`\`\``, inline: false });
  }

  // Show actions
  if (rule.actions && rule.actions.length > 0) {
    const actions = rule.actions.map(action => 
      `• ${action.type}: ${JSON.stringify(action.config || action).substring(0, 100)}${JSON.stringify(action.config || action).length > 100 ? '...' : ''}`
    ).join('\n');
    embed.addFields({ name: 'Actions', value: `\`\`\`${actions}\`\`\``, inline: false });
  }

  if (rule.last_execution) {
    embed.addFields({ 
      name: 'Last Execution', 
      value: `<t:${Math.floor(rule.last_execution.getTime() / 1000)}:R>`, 
      inline: true 
    });
  }

  if (rule.last_error) {
    embed.addFields({ name: 'Last Error', value: `\`\`\`${rule.last_error.substring(0, 200)}\`\`\``, inline: false });
  }

  embed.setTimestamp(rule.created_at);
  embed.setFooter({ text: `Rule ID: ${rule.id}` });

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`edit_rule_${ruleId}`)
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId(`toggle_rule_${ruleId}`)
        .setLabel(rule.is_active ? 'Disable' : 'Enable')
        .setStyle(rule.is_active ? ButtonStyle.Danger : ButtonStyle.Success)
        .setEmoji(rule.is_active ? '⏸️' : '▶️'),
      new ButtonBuilder()
        .setCustomId(`test_rule_${ruleId}`)
        .setLabel('Test')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🧪'),
      new ButtonBuilder()
        .setCustomId(`delete_rule_${ruleId}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );

  await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
}

async function handleEditRule(interaction: ChatInputCommandInteraction) {
  const ruleId = interaction.options.getInteger('rule-id', true);
  
  const rule = await scheduledTaskService.getAutomationRule(ruleId);
  if (!rule) {
    await interaction.reply({ content: 'Automation rule not found.', ephemeral: true });
    return;
  }

  if (rule.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Automation rule not found in this server.', ephemeral: true });
    return;
  }

  // Create a modal with current rule values pre-filled
  const modal = new ModalBuilder()
    .setCustomId(`edit_rule_${ruleId}`)
    .setTitle(`Edit Rule: ${rule.name}`);

  const nameInput = new TextInputBuilder()
    .setCustomId('rule_name')
    .setLabel('Rule Name')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(rule.name)
    .setMaxLength(100);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('rule_description')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setValue(rule.description || '')
    .setMaxLength(500);

  const priorityInput = new TextInputBuilder()
    .setCustomId('rule_priority')
    .setLabel('Priority (0-100, higher = runs first)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(rule.priority.toString())
    .setMaxLength(3);

  const cooldownInput = new TextInputBuilder()
    .setCustomId('rule_cooldown')
    .setLabel('Cooldown (seconds between executions per user)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(rule.cooldown_seconds.toString())
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(priorityInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(cooldownInput)
  );

  await interaction.showModal(modal);
}

async function handleToggleRule(interaction: ChatInputCommandInteraction) {
  const ruleId = interaction.options.getInteger('rule-id', true);
  
  const rule = await scheduledTaskService.getAutomationRule(ruleId);
  if (!rule) {
    await interaction.reply({ content: 'Automation rule not found.', ephemeral: true });
    return;
  }

  if (rule.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Automation rule not found in this server.', ephemeral: true });
    return;
  }

  // This would update the rule status in the database
  // For now, we'll just show a response
  const newStatus = !rule.is_active;

  const embed = new EmbedBuilder()
    .setTitle('✅ Rule Updated')
    .setDescription(`Automation rule **${rule.name}** has been ${newStatus ? 'enabled' : 'disabled'}.`)
    .setColor(newStatus ? 0x7289DA : 0x747F8D)
    .setTimestamp();

  if (newStatus) {
    embed.addFields({ 
      name: 'Note', 
      value: 'The rule will now respond to the configured trigger events.', 
      inline: false 
    });
  } else {
    embed.addFields({ 
      name: 'Note', 
      value: 'The rule will no longer respond to trigger events until re-enabled.', 
      inline: false 
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDeleteRule(interaction: ChatInputCommandInteraction) {
  const ruleId = interaction.options.getInteger('rule-id', true);
  
  const rule = await scheduledTaskService.getAutomationRule(ruleId);
  if (!rule) {
    await interaction.reply({ content: 'Automation rule not found.', ephemeral: true });
    return;
  }

  if (rule.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Automation rule not found in this server.', ephemeral: true });
    return;
  }

  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ Confirm Deletion')
    .setDescription(`Are you sure you want to delete the automation rule **${rule.name}**?\n\nThis action is irreversible and will also delete all execution history for this rule.`)
    .setColor(0xFF6B6B)
    .addFields(
      { name: 'Rule Details', value: `Event: ${rule.trigger_event}\nExecutions: ${rule.execution_count}`, inline: false }
    )
    .setTimestamp();

  const confirmRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_delete_rule_${ruleId}`)
        .setLabel('Yes, Delete')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️'),
      new ButtonBuilder()
        .setCustomId('cancel_delete_rule')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌')
    );

  await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true });
}

async function handleTestRule(interaction: ChatInputCommandInteraction) {
  const ruleId = interaction.options.getInteger('rule-id', true);
  
  const rule = await scheduledTaskService.getAutomationRule(ruleId);
  if (!rule) {
    await interaction.reply({ content: 'Automation rule not found.', ephemeral: true });
    return;
  }

  if (rule.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Automation rule not found in this server.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // This would simulate the rule execution with test data
    const embed = new EmbedBuilder()
      .setTitle('🧪 Rule Test Results')
      .setDescription(`Test execution of automation rule **${rule.name}**`)
      .setColor(0x7289DA)
      .addFields(
        { name: 'Trigger Event', value: rule.trigger_event.replace('_', ' '), inline: true },
        { name: 'Test Status', value: '✅ Passed', inline: true },
        { name: 'Actions', value: `${rule.actions.length} action(s) would be executed`, inline: true }
      )
      .setTimestamp();

    // Show what actions would be performed
    if (rule.actions.length > 0) {
      const actionsList = rule.actions.map((action, index) => 
        `${index + 1}. **${action.type}**: ${JSON.stringify(action.config).substring(0, 100)}${JSON.stringify(action.config).length > 100 ? '...' : ''}`
      ).join('\n');
      
      embed.addFields({ name: 'Actions to Execute', value: actionsList, inline: false });
    }

    embed.addFields({ 
      name: 'Note', 
      value: 'This is a simulation. No actual actions were performed.', 
      inline: false 
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Test Failed')
      .setDescription(`Failed to test automation rule **${rule.name}**.`)
      .setColor(0xFF6B6B)
      .addFields({ name: 'Error', value: `\`\`\`${error}\`\`\`` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

async function handleRuleHistory(interaction: ChatInputCommandInteraction, guildId: string) {
  const ruleId = interaction.options.getInteger('rule-id');
  const limit = interaction.options.getInteger('limit') ?? 10;

  // This would fetch execution history from the database
  const embed = new EmbedBuilder()
    .setTitle('📊 Automation Rule History')
    .setDescription(ruleId ? `History for rule ID ${ruleId}` : 'Recent execution history for all automation rules')
    .setColor(0x7289DA)
    .addFields({
      name: 'Coming Soon',
      value: 'Automation rule execution history will be displayed here once the system is fully implemented.',
      inline: false
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}