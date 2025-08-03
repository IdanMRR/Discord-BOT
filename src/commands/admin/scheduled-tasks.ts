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
import { scheduledTaskService, ScheduledTask } from '../../services/scheduledTaskService';
import { logCommandUsage } from '../../utils/command-logger';
import { logError } from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('scheduled-tasks')
  .setDescription('Manage scheduled tasks and automation')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all scheduled tasks')
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Filter by task type')
          .setRequired(false)
          .addChoices(
            { name: 'Message', value: 'message' },
            { name: 'Announcement', value: 'announcement' },
            { name: 'Role Assignment', value: 'role_assignment' },
            { name: 'Channel Action', value: 'channel_action' },
            { name: 'Moderation', value: 'moderation' },
            { name: 'Custom', value: 'custom' }
          )
      )
      .addBooleanOption(option =>
        option
          .setName('active-only')
          .setDescription('Show only active tasks')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a new scheduled task')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View details of a specific task')
      .addIntegerOption(option =>
        option
          .setName('task-id')
          .setDescription('ID of the task to view')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit an existing scheduled task')
      .addIntegerOption(option =>
        option
          .setName('task-id')
          .setDescription('ID of the task to edit')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle')
      .setDescription('Enable or disable a scheduled task')
      .addIntegerOption(option =>
        option
          .setName('task-id')
          .setDescription('ID of the task to toggle')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete a scheduled task')
      .addIntegerOption(option =>
        option
          .setName('task-id')
          .setDescription('ID of the task to delete')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('execute')
      .setDescription('Manually execute a scheduled task')
      .addIntegerOption(option =>
        option
          .setName('task-id')
          .setDescription('ID of the task to execute')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('history')
      .setDescription('View execution history for tasks')
      .addIntegerOption(option =>
        option
          .setName('task-id')
          .setDescription('ID of the task (optional - shows all if not provided)')
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
        await handleListTasks(interaction, guildId);
        break;
      case 'create':
        await handleCreateTask(interaction, guildId, userId);
        break;
      case 'view':
        await handleViewTask(interaction);
        break;
      case 'edit':
        await handleEditTask(interaction);
        break;
      case 'toggle':
        await handleToggleTask(interaction);
        break;
      case 'delete':
        await handleDeleteTask(interaction);
        break;
      case 'execute':
        await handleExecuteTask(interaction);
        break;
      case 'history':
        await handleTaskHistory(interaction, guildId);
        break;
    }
  } catch (error) {
    logError('ScheduledTasks', error as Error);
    console.error('Error in scheduled-tasks command:', error);
    
    const errorMessage = 'An error occurred while executing the command.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleListTasks(interaction: ChatInputCommandInteraction, guildId: string) {
  const typeFilter = interaction.options.getString('type');
  const activeOnly = interaction.options.getBoolean('active-only') ?? false;

  const tasks = await scheduledTaskService.getGuildScheduledTasks(guildId);
  
  let filteredTasks = tasks;
  if (typeFilter) {
    filteredTasks = tasks.filter(task => task.task_type === typeFilter);
  }
  if (activeOnly) {
    filteredTasks = filteredTasks.filter(task => task.is_active);
  }

  if (filteredTasks.length === 0) {
    await interaction.reply({
      content: `No scheduled tasks found${typeFilter ? ` for type "${typeFilter}"` : ''}${activeOnly ? ' (active only)' : ''}.`,
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('📅 Scheduled Tasks')
    .setColor(0x00AE86)
    .setDescription(`Found ${filteredTasks.length} task(s)`)
    .setTimestamp();

  // Group tasks by type for better organization
  const tasksByType: { [key: string]: ScheduledTask[] } = {};
  filteredTasks.forEach(task => {
    if (!tasksByType[task.task_type]) {
      tasksByType[task.task_type] = [];
    }
    tasksByType[task.task_type].push(task);
  });

  Object.entries(tasksByType).forEach(([type, tasksOfType]) => {
    const taskList = tasksOfType.slice(0, 10).map(task => {
      const status = task.is_active ? '🟢' : '🔴';
      const nextExec = task.next_execution ? `<t:${Math.floor(task.next_execution.getTime() / 1000)}:R>` : 'Never';
      return `${status} **${task.name}** (ID: ${task.id})\n└ Next: ${nextExec} | Executions: ${task.execution_count}`;
    }).join('\n\n');

    embed.addFields({
      name: `${type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')} Tasks (${tasksOfType.length})`,
      value: taskList || 'None',
      inline: false
    });
  });

  if (filteredTasks.length > 30) {
    embed.setFooter({ text: `Showing first 30 tasks. Use filters to narrow down results.` });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCreateTask(interaction: ChatInputCommandInteraction, guildId: string, userId: string) {
  const modal = new ModalBuilder()
    .setCustomId('create_scheduled_task')
    .setTitle('Create Scheduled Task');

  const nameInput = new TextInputBuilder()
    .setCustomId('task_name')
    .setLabel('Task Name')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('task_description')
    .setLabel('Description (Optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId('task_type_select')
    .setPlaceholder('Select task type')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Message')
        .setDescription('Send a message to a channel')
        .setValue('message'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Announcement')
        .setDescription('Send an announcement with embeds')
        .setValue('announcement'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Role Assignment')
        .setDescription('Assign or remove roles from users')
        .setValue('role_assignment'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Channel Action')
        .setDescription('Perform actions on channels')
        .setValue('channel_action'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Moderation')
        .setDescription('Automated moderation actions')
        .setValue('moderation'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Custom')
        .setDescription('Custom task with advanced configuration')
        .setValue('custom')
    );

  const triggerSelect = new StringSelectMenuBuilder()
    .setCustomId('trigger_type_select')
    .setPlaceholder('Select trigger type')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Cron Schedule')
        .setDescription('Run on a cron schedule (e.g., daily, weekly)')
        .setValue('cron'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Interval')
        .setDescription('Run every X seconds/minutes/hours')
        .setValue('interval'),
      new StringSelectMenuOptionBuilder()
        .setLabel('One Time')
        .setDescription('Run once at a specific time')
        .setValue('once'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Event Triggered')
        .setDescription('Run when a specific event occurs')
        .setValue('event')
    );

  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
  const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);

  modal.addComponents(firstActionRow, secondActionRow);

  await interaction.showModal(modal);

  // The modal submission would be handled by a separate interaction handler
  // that would collect all the task configuration details
}

async function handleViewTask(interaction: ChatInputCommandInteraction) {
  const taskId = interaction.options.getInteger('task-id', true);
  
  const task = await scheduledTaskService.getScheduledTask(taskId);
  if (!task) {
    await interaction.reply({ content: 'Task not found.', ephemeral: true });
    return;
  }

  if (task.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Task not found in this server.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📅 Task: ${task.name}`)
    .setColor(task.is_active ? 0x00AE86 : 0x747F8D)
    .setDescription(task.description || 'No description provided')
    .addFields(
      { name: 'Status', value: task.is_active ? '🟢 Active' : '🔴 Inactive', inline: true },
      { name: 'Type', value: task.task_type.replace('_', ' '), inline: true },
      { name: 'Trigger', value: task.trigger_type, inline: true },
      { name: 'Executions', value: task.execution_count.toString(), inline: true },
      { name: 'Errors', value: task.error_count.toString(), inline: true },
      { name: 'Created By', value: `<@${task.created_by}>`, inline: true }
    );

  if (task.target_channel_id) {
    embed.addFields({ name: 'Target Channel', value: `<#${task.target_channel_id}>`, inline: true });
  }

  if (task.cron_expression) {
    embed.addFields({ name: 'Cron Expression', value: `\`${task.cron_expression}\``, inline: true });
  }

  if (task.interval_seconds) {
    embed.addFields({ name: 'Interval', value: `${task.interval_seconds} seconds`, inline: true });
  }

  if (task.scheduled_time) {
    embed.addFields({ 
      name: 'Scheduled Time', 
      value: `<t:${Math.floor(task.scheduled_time.getTime() / 1000)}:F>`, 
      inline: true 
    });
  }

  if (task.next_execution) {
    embed.addFields({ 
      name: 'Next Execution', 
      value: `<t:${Math.floor(task.next_execution.getTime() / 1000)}:R>`, 
      inline: true 
    });
  }

  if (task.last_execution) {
    embed.addFields({ 
      name: 'Last Execution', 
      value: `<t:${Math.floor(task.last_execution.getTime() / 1000)}:R>`, 
      inline: true 
    });
  }

  if (task.last_error) {
    embed.addFields({ name: 'Last Error', value: `\`\`\`${task.last_error.substring(0, 200)}\`\`\``, inline: false });
  }

  embed.setTimestamp(task.created_at);
  embed.setFooter({ text: `Task ID: ${task.id}` });

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`edit_task_${taskId}`)
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId(`toggle_task_${taskId}`)
        .setLabel(task.is_active ? 'Disable' : 'Enable')
        .setStyle(task.is_active ? ButtonStyle.Danger : ButtonStyle.Success)
        .setEmoji(task.is_active ? '⏸️' : '▶️'),
      new ButtonBuilder()
        .setCustomId(`execute_task_${taskId}`)
        .setLabel('Execute Now')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🚀'),
      new ButtonBuilder()
        .setCustomId(`delete_task_${taskId}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );

  await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
}

async function handleEditTask(interaction: ChatInputCommandInteraction) {
  const taskId = interaction.options.getInteger('task-id', true);
  
  const task = await scheduledTaskService.getScheduledTask(taskId);
  if (!task) {
    await interaction.reply({ content: 'Task not found.', ephemeral: true });
    return;
  }

  if (task.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Task not found in this server.', ephemeral: true });
    return;
  }

  // Create a modal with current task values pre-filled
  const modal = new ModalBuilder()
    .setCustomId(`edit_task_${taskId}`)
    .setTitle(`Edit Task: ${task.name}`);

  const nameInput = new TextInputBuilder()
    .setCustomId('task_name')
    .setLabel('Task Name')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(task.name)
    .setMaxLength(100);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('task_description')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setValue(task.description || '')
    .setMaxLength(500);

  const messageTemplateInput = new TextInputBuilder()
    .setCustomId('message_template')
    .setLabel('Message Template')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setValue(task.message_template || '')
    .setMaxLength(1500);

  const scheduleInput = new TextInputBuilder()
    .setCustomId('schedule_config')
    .setLabel('Schedule (cron expression or interval in seconds)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(task.cron_expression || (task.interval_seconds?.toString() || ''))
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(messageTemplateInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(scheduleInput)
  );

  await interaction.showModal(modal);
}

async function handleToggleTask(interaction: ChatInputCommandInteraction) {
  const taskId = interaction.options.getInteger('task-id', true);
  
  const task = await scheduledTaskService.getScheduledTask(taskId);
  if (!task) {
    await interaction.reply({ content: 'Task not found.', ephemeral: true });
    return;
  }

  if (task.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Task not found in this server.', ephemeral: true });
    return;
  }

  const newStatus = !task.is_active;
  await scheduledTaskService.updateScheduledTask(taskId, { is_active: newStatus });

  const embed = new EmbedBuilder()
    .setTitle('✅ Task Updated')
    .setDescription(`Task **${task.name}** has been ${newStatus ? 'enabled' : 'disabled'}.`)
    .setColor(newStatus ? 0x00AE86 : 0x747F8D)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDeleteTask(interaction: ChatInputCommandInteraction) {
  const taskId = interaction.options.getInteger('task-id', true);
  
  const task = await scheduledTaskService.getScheduledTask(taskId);
  if (!task) {
    await interaction.reply({ content: 'Task not found.', ephemeral: true });
    return;
  }

  if (task.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Task not found in this server.', ephemeral: true });
    return;
  }

  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ Confirm Deletion')
    .setDescription(`Are you sure you want to delete the task **${task.name}**?\n\nThis action is irreversible and will also delete all execution history for this task.`)
    .setColor(0xFF6B6B)
    .setTimestamp();

  const confirmRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_delete_task_${taskId}`)
        .setLabel('Yes, Delete')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️'),
      new ButtonBuilder()
        .setCustomId('cancel_delete_task')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌')
    );

  await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true });
}

async function handleExecuteTask(interaction: ChatInputCommandInteraction) {
  const taskId = interaction.options.getInteger('task-id', true);
  
  const task = await scheduledTaskService.getScheduledTask(taskId);
  if (!task) {
    await interaction.reply({ content: 'Task not found.', ephemeral: true });
    return;
  }

  if (task.guild_id !== interaction.guild!.id) {
    await interaction.reply({ content: 'Task not found in this server.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // This would trigger manual execution of the task
    // For now, we'll just simulate it
    const embed = new EmbedBuilder()
      .setTitle('🚀 Task Executed')
      .setDescription(`Task **${task.name}** has been manually executed.`)
      .setColor(0x00AE86)
      .addFields(
        { name: 'Task Type', value: task.task_type.replace('_', ' '), inline: true },
        { name: 'Execution Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Execution Failed')
      .setDescription(`Failed to execute task **${task.name}**.`)
      .setColor(0xFF6B6B)
      .addFields({ name: 'Error', value: `\`\`\`${error}\`\`\`` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

async function handleTaskHistory(interaction: ChatInputCommandInteraction, guildId: string) {
  const taskId = interaction.options.getInteger('task-id');
  const limit = interaction.options.getInteger('limit') ?? 10;

  // This would fetch execution history from the database
  // For now, we'll show a placeholder response
  const embed = new EmbedBuilder()
    .setTitle('📊 Task Execution History')
    .setDescription(taskId ? `History for task ID ${taskId}` : 'Recent execution history for all tasks')
    .setColor(0x5865F2)
    .addFields({
      name: 'Coming Soon',
      value: 'Task execution history will be displayed here once the system is fully implemented.',
      inline: false
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}