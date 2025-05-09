import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  Client
} from 'discord.js';
import { Colors, createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { settingsManager } from '../../utils/settings';

import { getContextLanguage, getTranslation as t } from '../../utils/language';
import { db } from '../../database/sqlite';
import { Language } from '../../utils/language';

// Define the database types to fix type issues for better-sqlite3 (which uses synchronous methods)
interface Statement {
  run(...params: any[]): any;
  finalize(): void;
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  get(sql: string, params?: any[]): any;
}

// Cast db to our Database interface to fix type issues
const typedDb = db as unknown as Database;

// Helper function to cast language string to Language type
function ensureLanguageType(lang: string): Language {
  return 'en';
}

// Rules database setup
function setupRulesTable() {
  try {
    typedDb.exec(`
      CREATE TABLE IF NOT EXISTS server_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        rule_number INTEGER NOT NULL,
        rule_title TEXT NOT NULL,
        rule_description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logInfo('Rules Manager', 'Server rules table created or already exists');
  } catch (error) {
    logError('Rules Manager', `Error setting up server rules table: ${error}`);
  }
}

// Initialize the rules table when this module is loaded
setupRulesTable();

export const data = new SlashCommandBuilder()
  .setName('rules-manager')
  .setDescription('Manage server rules for your server')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a new server rule')
      .addIntegerOption(option =>
        option.setName('number')
          .setDescription('The rule number (1, 2, 3, etc.)')
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption(option =>
        option.setName('title')
          .setDescription('The title of the rule')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('description')
          .setDescription('The description of the rule')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit an existing server rule')
      .addIntegerOption(option =>
        option.setName('number')
          .setDescription('The rule number to edit')
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption(option =>
        option.setName('title')
          .setDescription('The new title of the rule')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('description')
          .setDescription('The new description of the rule')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete a server rule')
      .addIntegerOption(option =>
        option.setName('number')
          .setDescription('The rule number to delete')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all server rules')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup-channel')
      .setDescription('Set up a channel for displaying server rules')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('The channel to use for rules (leave empty to create a new one)')
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Defer the reply as this might take some time
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Get the guild's language preference
    const language = await getContextLanguage(interaction.guildId!);

    // Get the subcommand
    const subcommand = interaction.options.getSubcommand();

    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'rules-manager',
      options: { subcommand },
      channel: interaction.channel,
      success: true
    });

    // Handle different subcommands
    switch (subcommand) {
      case 'add':
        await handleAddRule(interaction, language);
        break;
      case 'edit':
        await handleEditRule(interaction, language);
        break;
      case 'delete':
        await handleDeleteRule(interaction, language);
        break;
      case 'list':
        await handleListRules(interaction, language);
        break;
      case 'setup-channel':
        await handleSetupRulesChannel(interaction, language);
        break;
      default:
        await interaction.editReply({
          embeds: [createErrorEmbed(
            t('error', language),
            t('general.invalid_subcommand', language) || 'Invalid subcommand'
          )]
        });
    }
  } catch (error) {
    logError('Rules Manager', `Error executing command: ${error}`);
    
    // Get the guild's language preference
    const language = await getContextLanguage(interaction.guildId!);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', language),
        t('general.command_error', language) || 'An error occurred while executing the command.'
      )]
    });
  }
}

async function handleAddRule(interaction: ChatInputCommandInteraction, language: string) {
  // Cast language to proper type
  const typedLanguage = ensureLanguageType(language);
  const ruleNumber = interaction.options.getInteger('number', true);
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description', true);

  try {
    // Check if a rule with this number already exists
    const checkStmt = typedDb.prepare(
      'SELECT * FROM server_rules WHERE guild_id = ? AND rule_number = ?'
    );
    const existingRule = checkStmt.get(interaction.guildId, ruleNumber);

    if (existingRule) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          t('error', typedLanguage),
          t('rules.rule_exists', typedLanguage) || `A rule with number ${ruleNumber} already exists. Use the edit command to modify it.`
        )]
      });
      return;
    }

    // Insert the rule into the database
    const insertStmt = typedDb.prepare(
      'INSERT INTO server_rules (guild_id, rule_number, rule_title, rule_description) VALUES (?, ?, ?, ?)'
    );
    insertStmt.run(interaction.guildId, ruleNumber, title, description);
    insertStmt.finalize();

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setTitle(`✅ ${t('success', typedLanguage)}`)
      .setDescription(t('rules.add_success', typedLanguage) || 'Server rule added successfully!')
      .setColor(Colors.SUCCESS)
      .addFields([
        { name: t('rules.rule_number', typedLanguage) || 'Rule Number', value: `${ruleNumber}` },
        { name: t('rules.rule_title', typedLanguage) || 'Title', value: title },
        { name: t('rules.rule_description', typedLanguage) || 'Description', value: description }
      ]);

    await interaction.editReply({ embeds: [successEmbed] });
    
    // Update the rules channel if it exists
    await updateRulesChannel(interaction.guildId!, typedLanguage);
  } catch (error) {
    logError('Rules Manager', `Error adding rule: ${error}`);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('rules.add_error', typedLanguage) || 'An error occurred while adding the server rule.'
      )]
    });
  }
}

async function handleEditRule(interaction: ChatInputCommandInteraction, language: string) {
  // Cast language to proper type
  const typedLanguage = ensureLanguageType(language);
  const ruleNumber = interaction.options.getInteger('number', true);
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');

  if (!title && !description) {
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('rules.edit_no_changes', typedLanguage) || 'You must provide either a new title or a new description.'
      )]
    });
    return;
  }

  try {
    // Check if the rule exists
    const existingRule = typedDb.get(
      'SELECT * FROM server_rules WHERE guild_id = ? AND rule_number = ?',
      [interaction.guildId, ruleNumber]
    );

    if (!existingRule) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          t('error', typedLanguage),
          t('rules.not_found', typedLanguage) || `Rule number ${ruleNumber} not found.`
        )]
      });
      return;
    }

    // Update the rule
    const updates = [];
    const params = [];

    if (title) {
      updates.push('rule_title = ?');
      params.push(title);
    }

    if (description) {
      updates.push('rule_description = ?');
      params.push(description);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(interaction.guildId, ruleNumber);

    const stmt = typedDb.prepare(
      `UPDATE server_rules SET ${updates.join(', ')} WHERE guild_id = ? AND rule_number = ?`
    );
    stmt.run(...params);
    stmt.finalize();

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setTitle(`✅ ${t('success', typedLanguage)}`)
      .setDescription(t('rules.edit_success', typedLanguage) || 'Server rule updated successfully!')
      .setColor(Colors.SUCCESS)
      .addFields([
        { name: t('rules.rule_number', typedLanguage) || 'Rule Number', value: `${ruleNumber}` },
        { name: t('rules.rule_title', typedLanguage) || 'Title', value: title || existingRule.rule_title },
        { name: t('rules.rule_description', typedLanguage) || 'Description', value: description || existingRule.rule_description }
      ]);

    await interaction.editReply({ embeds: [successEmbed] });
    
    // Update the rules channel if it exists
    await updateRulesChannel(interaction.guildId!, typedLanguage);
  } catch (error) {
    logError('Rules Manager', `Error editing rule: ${error}`);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('rules.edit_error', typedLanguage) || 'An error occurred while editing the server rule.'
      )]
    });
  }
}

async function handleDeleteRule(interaction: ChatInputCommandInteraction, language: string) {
  // Cast language to proper type
  const typedLanguage = ensureLanguageType(language);
  const ruleNumber = interaction.options.getInteger('number', true);

  try {
    // Check if the rule exists
    const existingRule = typedDb.get(
      'SELECT * FROM server_rules WHERE guild_id = ? AND rule_number = ?',
      [interaction.guildId, ruleNumber]
    );

    if (!existingRule) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          t('error', typedLanguage),
          t('rules.not_found', typedLanguage) || `Rule number ${ruleNumber} not found.`
        )]
      });
      return;
    }

    // Delete the rule
    const stmt = typedDb.prepare(
      'DELETE FROM server_rules WHERE guild_id = ? AND rule_number = ?'
    );
    stmt.run(interaction.guildId, ruleNumber);
    stmt.finalize();

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setTitle(`✅ ${t('success', typedLanguage)}`)
      .setDescription(t('rules.delete_success', typedLanguage) || 'Server rule deleted successfully!')
      .setColor(Colors.SUCCESS)
      .addFields([
        { name: t('rules.rule_number', typedLanguage) || 'Rule Number', value: `${ruleNumber}` },
        { name: t('rules.rule_title', typedLanguage) || 'Title', value: existingRule.rule_title }
      ]);

    await interaction.editReply({ embeds: [successEmbed] });
    
    // Update the rules channel if it exists
    await updateRulesChannel(interaction.guildId!, typedLanguage);
  } catch (error) {
    logError('Rules Manager', `Error deleting rule: ${error}`);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('rules.delete_error', typedLanguage) || 'An error occurred while deleting the server rule.'
      )]
    });
  }
}

async function handleListRules(interaction: ChatInputCommandInteraction, language: string) {
  // Cast language to proper type
  const typedLanguage = ensureLanguageType(language);
  try {
    // Get all rules for this guild
    const stmt = typedDb.prepare(
      'SELECT * FROM server_rules WHERE guild_id = ? ORDER BY rule_number ASC'
    );
    const rules = stmt.all(interaction.guildId);

    if (rules.length === 0) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          t('info', typedLanguage),
          t('rules.no_rules', typedLanguage) || 'No server rules found for this server.'
        )]
      });
      return;
    }

    // Create list embed
    const listEmbed = new EmbedBuilder()
      .setTitle(`📜 ${t('rules.list_title', typedLanguage)}`)
      .setDescription(t('rules.list_description', typedLanguage) || 'Here are all the server rules:')
      .setColor(Colors.INFO);

    // Add each rule as a field (limit to 25 due to Discord's field limit)
    const maxFields = 25;
    const displayRules = rules.slice(0, maxFields);
    
    for (const rule of displayRules) {
      listEmbed.addFields([
        { 
          name: `#${rule.rule_number}: ${rule.rule_title}`, 
          value: rule.rule_description.length > 200 ? rule.rule_description.substring(0, 197) + '...' : rule.rule_description 
        }
      ]);
    }

    // Add a note if there are more rules than we can display
    if (rules.length > maxFields) {
      listEmbed.setFooter({ 
        text: t('rules.more_rules', typedLanguage) || 
          `And ${rules.length - maxFields} more rules...` 
      });
    }

    await interaction.editReply({ embeds: [listEmbed] });
  } catch (error) {
    logError('Rules Manager', `Error listing rules: ${error}`);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('rules.list_error', typedLanguage) || 'An error occurred while listing the server rules.'
      )]
    });
  }
}

async function handleSetupRulesChannel(interaction: ChatInputCommandInteraction, language: string) {
  // Cast language to proper type
  const typedLanguage = ensureLanguageType(language);
  try {
    // Get the channel option
    const existingChannel = interaction.options.getChannel('channel') as TextChannel | null;
    
    let rulesChannel: TextChannel;

    // Use existing channel or create a new one
    if (existingChannel && existingChannel.type === 0) { // 0 is TextChannel
      rulesChannel = existingChannel;
    } else {
      // Create a new rules channel
      rulesChannel = await interaction.guild!.channels.create({
        name: t('rules.channel_name', typedLanguage),
        type: 0, // TextChannel
        permissionOverwrites: [
          {
            id: interaction.guild!.roles.everyone.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory
            ],
            deny: [PermissionFlagsBits.SendMessages]
          },
          {
            id: interaction.client.user!.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageMessages
            ]
          }
        ]
      });
    }

    // Update settings in the database
    const settings = await settingsManager.getSettings(interaction.guildId!);
    if (!settings) {
      await settingsManager.updateSettings(interaction.guildId!, {
        rules_channel_id: rulesChannel.id
      });
    } else {
      settings.rules_channel_id = rulesChannel.id;
      await settingsManager.updateSettings(interaction.guildId!, settings);
    }

    // Update the rules channel content
    await updateRulesChannel(interaction.guildId!, typedLanguage);

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setTitle(`✅ ${t('success', typedLanguage)}`)
      .setDescription(t('rules.channel_setup_success', typedLanguage) || 'Rules channel has been successfully set up!')
      .setColor(Colors.SUCCESS)
      .addFields([
        { name: t('rules.channel', typedLanguage) || 'Channel', value: `<#${rulesChannel.id}>` }
      ]);

    await interaction.editReply({ embeds: [successEmbed] });
    
    logInfo('Rules Manager', `Set up rules channel in ${interaction.guild!.name}`);
  } catch (error) {
    logError('Rules Manager', `Error setting up rules channel: ${error}`);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('rules.channel_setup_error', typedLanguage) || 'An error occurred while setting up the rules channel.'
      )]
    });
  }
}

// Helper function to update the rules channel content
async function updateRulesChannel(guildId: string, language: string) {
  try {
    // Cast language to proper type
    const typedLanguage = ensureLanguageType(language);
    // Get the settings
    const settings = await settingsManager.getSettings(guildId);
    if (!settings || !settings.rules_channel_id) {
      return; // No rules channel set up
    }

    // Get the guild
    const client = (global as any).client as Client;
    const guild = client.guilds.cache.get(guildId);
    
    if (!guild) {
      logError('Rules Manager', `Guild not found with ID ${guildId}`);
      return;
    }
    
    const rulesChannel = await guild.channels.fetch(settings.rules_channel_id) as TextChannel;
    
    if (!rulesChannel) {
      logError('Rules Manager', `Rules channel not found for guild ${guildId}`);
      return;
    }

    // Get all rules for this guild
    const stmt = typedDb.prepare(
      'SELECT * FROM server_rules WHERE guild_id = ? ORDER BY rule_number ASC'
    );
    const rules = stmt.all(guildId);

    // Clear the channel (delete all messages)
    try {
      const messages = await rulesChannel.messages.fetch({ limit: 100 });
      await rulesChannel.bulkDelete(messages);
    } catch (error) {
      logError('Rules Manager', `Error clearing rules channel: ${error}`);
      // Continue anyway, as some messages might be too old to delete
    }

    // Create header embed
    const headerEmbed = new EmbedBuilder()
      .setTitle(`📜 ${t('rules.rules_title', typedLanguage)}`)
      .setDescription(t('rules.rules_description', typedLanguage))
      .setColor(Colors.INFO)
      .setTimestamp()
      .setFooter({ text: t('general.footer', typedLanguage) });

    // Add server icon if available
    if (guild.iconURL()) {
      headerEmbed.setThumbnail(guild.iconURL());
    }

    await rulesChannel.send({ embeds: [headerEmbed] });

    // If there are no rules, send a message
    if (rules.length === 0) {
      const noRulesEmbed = new EmbedBuilder()
        .setDescription(t('rules.no_rules_yet', typedLanguage) || 'No server rules have been added yet.')
        .setColor(Colors.INFO);

      await rulesChannel.send({ embeds: [noRulesEmbed] });
      return;
    }

    // Create rule embeds for each rule
    for (const rule of rules) {
      const ruleEmbed = new EmbedBuilder()
        .setTitle(`${t('rules.rule', typedLanguage)} ${rule.rule_number}: ${rule.rule_title}`)
        .setDescription(rule.rule_description)
        .setColor(Colors.INFO);
      await rulesChannel.send({ embeds: [ruleEmbed] });
    }

    // Add a button to acknowledge the rules
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('rules_acknowledge')
          .setLabel(t('rules.acknowledge_button', typedLanguage))
          .setStyle(ButtonStyle.Primary)
      );

    await rulesChannel.send({
      content: t('rules.acknowledge_prompt', typedLanguage),
      components: [row],
    });
  } catch (error) {
    logError('Rules Manager', `Error updating rules channel: ${error}`);
  }
}
