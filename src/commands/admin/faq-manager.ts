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

import { getContextLanguage, getTranslation as t, Language } from '../../utils/language';
import { db } from '../../database/sqlite';

// Define the database types to fix type issues
interface Statement {
  run(...params: any[]): Promise<any>;
  finalize(): Promise<void>;
}

interface Database {
  exec(sql: string): Promise<void>;
  prepare(sql: string): Promise<Statement>;
  get(sql: string, params?: any[]): Promise<any>;
  all(sql: string, params?: any[]): Promise<any[]>;
}

// Cast db to our Database interface to fix type issues
const typedDb = db as unknown as Database;

// Helper function to cast language string to Language type
function ensureLanguageType(lang: string): Language {
  return 'en';
}

// FAQ database setup
async function setupFaqTable() {
  try {
    await typedDb.exec(`
      CREATE TABLE IF NOT EXISTS faq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logInfo('FAQ Manager', 'FAQ table created or already exists');
  } catch (error) {
    logError('FAQ Manager', `Error setting up FAQ table: ${error}`);
  }
}

// Initialize the FAQ table when this module is loaded
setupFaqTable();

export const data = new SlashCommandBuilder()
  .setName('faq-manager')
  .setDescription('Manage frequently asked questions for your server')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a new FAQ')
      .addStringOption(option =>
        option.setName('question')
          .setDescription('The question to add')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('answer')
          .setDescription('The answer to the question')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Edit an existing FAQ')
      .addIntegerOption(option =>
        option.setName('id')
          .setDescription('The ID of the FAQ to edit')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('question')
          .setDescription('The new question text')
          .setRequired(false)
      )
      .addStringOption(option =>
        option.setName('answer')
          .setDescription('The new answer text')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete an FAQ')
      .addIntegerOption(option =>
        option.setName('id')
          .setDescription('The ID of the FAQ to delete')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all FAQs')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup-channel')
      .setDescription('Set up a channel for displaying FAQs')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('The channel to use for FAQs (leave empty to create a new one)')
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
      command: 'faq-manager',
      options: { subcommand },
      channel: interaction.channel,
      success: true
    });

    // Handle different subcommands
    switch (subcommand) {
      case 'add':
        await handleAddFaq(interaction, language);
        break;
      case 'edit':
        await handleEditFaq(interaction, language);
        break;
      case 'delete':
        await handleDeleteFaq(interaction, language);
        break;
      case 'list':
        await handleListFaq(interaction, language);
        break;
      case 'setup-channel':
        await handleSetupFaqChannel(interaction, language);
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
    logError('FAQ Manager', `Error executing command: ${error}`);
    
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

async function handleAddFaq(interaction: ChatInputCommandInteraction, language: string) {
  // Cast language to proper type
  const typedLanguage = ensureLanguageType(language);
  const question = interaction.options.getString('question', true);
  const answer = interaction.options.getString('answer', true);

  try {
    // Insert the FAQ into the database
    const stmt = await typedDb.prepare(
      'INSERT INTO faq (guild_id, question, answer) VALUES (?, ?, ?)'
    );
    await stmt.run(interaction.guildId, question, answer);
    await stmt.finalize();

    // Get the ID of the inserted FAQ
    const result = await typedDb.get('SELECT last_insert_rowid() as id');
    const faqId = result.id;

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setTitle(`✅ ${t('success', typedLanguage)}`)
      .setDescription(t('faq.add_success', typedLanguage) || 'FAQ added successfully!')
      .setColor(Colors.SUCCESS)
      .addFields([
        { name: t('faq.id', typedLanguage) || 'ID', value: `${faqId}` },
        { name: t('faq.question', typedLanguage) || 'Question', value: question },
        { name: t('faq.answer', typedLanguage) || 'Answer', value: answer }
      ]);

    await interaction.editReply({ embeds: [successEmbed] });
    
    // Update the FAQ channel if it exists
    await updateFaqChannel(interaction.guildId!, typedLanguage);
  } catch (error) {
    logError('FAQ Manager', `Error adding FAQ: ${error}`);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('faq.add_error', typedLanguage) || 'An error occurred while adding the FAQ.'
      )]
    });
  }
}

async function handleEditFaq(interaction: ChatInputCommandInteraction, language: string) {
  // Cast language to proper type
  const typedLanguage = ensureLanguageType(language);
  const faqId = interaction.options.getInteger('id', true);
  const question = interaction.options.getString('question');
  const answer = interaction.options.getString('answer');

  if (!question && !answer) {
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('faq.edit_no_changes', typedLanguage) || 'You must provide either a new question or a new answer.'
      )]
    });
    return;
  }

  try {
    // Check if the FAQ exists and belongs to this guild
    const existingFaq = await typedDb.get(
      'SELECT * FROM faq WHERE id = ? AND guild_id = ?',
      [faqId, interaction.guildId]
    );

    if (!existingFaq) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          t('error', typedLanguage),
          t('faq.not_found', typedLanguage) || 'FAQ not found or does not belong to this server.'
        )]
      });
      return;
    }

    // Update the FAQ
    const updates = [];
    const params = [];

    if (question) {
      updates.push('question = ?');
      params.push(question);
    }

    if (answer) {
      updates.push('answer = ?');
      params.push(answer);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(faqId, interaction.guildId);

    const stmt = await typedDb.prepare(
      `UPDATE faq SET ${updates.join(', ')} WHERE id = ? AND guild_id = ?`
    );
    await stmt.run(...params);
    await stmt.finalize();

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setTitle(`✅ ${t('success', typedLanguage)}`)
      .setDescription(t('faq.edit_success', typedLanguage) || 'FAQ updated successfully!')
      .setColor(Colors.SUCCESS)
      .addFields([
        { name: t('faq.id', typedLanguage) || 'ID', value: `${faqId}` },
        { name: t('faq.question', typedLanguage) || 'Question', value: question || existingFaq.question },
        { name: t('faq.answer', typedLanguage) || 'Answer', value: answer || existingFaq.answer }
      ]);

    await interaction.editReply({ embeds: [successEmbed] });
    
    // Update the FAQ channel if it exists
    await updateFaqChannel(interaction.guildId!, typedLanguage);
  } catch (error) {
    logError('FAQ Manager', `Error editing FAQ: ${error}`);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('faq.edit_error', typedLanguage) || 'An error occurred while editing the FAQ.'
      )]
    });
  }
}

async function handleDeleteFaq(interaction: ChatInputCommandInteraction, language: string) {
  // Cast language to proper type
  const typedLanguage = ensureLanguageType(language);
  const faqId = interaction.options.getInteger('id', true);

  try {
    // Check if the FAQ exists and belongs to this guild
    const existingFaq = await typedDb.get(
      'SELECT * FROM faq WHERE id = ? AND guild_id = ?',
      [faqId, interaction.guildId]
    );

    if (!existingFaq) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          t('error', typedLanguage),
          t('faq.not_found', typedLanguage) || 'FAQ not found or does not belong to this server.'
        )]
      });
      return;
    }

    // Delete the FAQ
    const stmt = await typedDb.prepare(
      'DELETE FROM faq WHERE id = ? AND guild_id = ?'
    );
    await stmt.run(faqId, interaction.guildId);
    await stmt.finalize();

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setTitle(`✅ ${t('success', typedLanguage)}`)
      .setDescription(t('faq.delete_success', typedLanguage) || 'FAQ deleted successfully!')
      .setColor(Colors.SUCCESS)
      .addFields([
        { name: t('faq.id', typedLanguage) || 'ID', value: `${faqId}` },
        { name: t('faq.question', typedLanguage) || 'Question', value: existingFaq.question }
      ]);

    await interaction.editReply({ embeds: [successEmbed] });
    
    // Update the FAQ channel if it exists
    await updateFaqChannel(interaction.guildId!, typedLanguage);
  } catch (error) {
    logError('FAQ Manager', `Error deleting FAQ: ${error}`);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('faq.delete_error', typedLanguage) || 'An error occurred while deleting the FAQ.'
      )]
    });
  }
}

async function handleListFaq(interaction: ChatInputCommandInteraction, language: string) {
  // Cast language to proper type
  const typedLanguage = ensureLanguageType(language);
  try {
    // Get all FAQs for this guild
    const faqs = await typedDb.all(
      'SELECT * FROM faq WHERE guild_id = ? ORDER BY id',
      [interaction.guildId]
    );

    if (faqs.length === 0) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          t('info', typedLanguage),
          t('faq.no_faqs', typedLanguage) || 'No FAQs found for this server.'
        )]
      });
      return;
    }

    // Create list embed
    const listEmbed = new EmbedBuilder()
      .setTitle(`📋 ${t('faq.list_title', typedLanguage) || 'FAQ List'}`)
      .setDescription(t('faq.list_description', typedLanguage) || 'Here are all the FAQs:')
      .setColor(Colors.INFO);

    // Add each FAQ as a field (limit to 25 due to Discord's field limit)
    const maxFields = 25;
    const displayFaqs = faqs.slice(0, maxFields);
    
    for (const faq of displayFaqs) {
      listEmbed.addFields([
        { 
          name: `#${faq.id}: ${faq.question.length > 100 ? faq.question.substring(0, 97) + '...' : faq.question}`, 
          value: faq.answer.length > 200 ? faq.answer.substring(0, 197) + '...' : faq.answer 
        }
      ]);
    }

    // Add a note if there are more FAQs than we can display
    if (faqs.length > maxFields) {
      listEmbed.setFooter({ 
        text: t('faq.more_faqs', typedLanguage) || 
          `And ${faqs.length - maxFields} more FAQs...` 
      });
    }

    await interaction.editReply({ embeds: [listEmbed] });
  } catch (error) {
    logError('FAQ Manager', `Error listing FAQs: ${error}`);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('faq.list_error', typedLanguage) || 'An error occurred while listing the FAQs.'
      )]
    });
  }
}

async function handleSetupFaqChannel(interaction: ChatInputCommandInteraction, language: string) {
  // Cast language to proper type
  const typedLanguage = ensureLanguageType(language);
  try {
    // Get the channel option
    const existingChannel = interaction.options.getChannel('channel') as TextChannel | null;
    
    let faqChannel: TextChannel;

    // Use existing channel or create a new one
    if (existingChannel && existingChannel.type === 0) { // 0 is TextChannel
      faqChannel = existingChannel;
    } else {
      // Create a new FAQ channel
      faqChannel = await interaction.guild!.channels.create({
        name: 'faq',
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
        faq_channel_id: faqChannel.id
      });
    } else {
      settings.faq_channel_id = faqChannel.id;
      await settingsManager.updateSettings(interaction.guildId!, settings);
    }

    // Update the FAQ channel content
    await updateFaqChannel(interaction.guildId!, typedLanguage);

    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setTitle(`✅ ${t('success', typedLanguage)}`)
      .setDescription(t('faq.channel_setup_success', typedLanguage) || 'FAQ channel has been successfully set up!')
      .setColor(Colors.SUCCESS)
      .addFields([
        { name: t('faq.channel', typedLanguage) || 'Channel', value: `<#${faqChannel.id}>` }
      ]);

    await interaction.editReply({ embeds: [successEmbed] });
    
    logInfo('FAQ Manager', `Set up FAQ channel in ${interaction.guild!.name}`);
  } catch (error) {
    logError('FAQ Manager', `Error setting up FAQ channel: ${error}`);
    
    await interaction.editReply({
      embeds: [createErrorEmbed(
        t('error', typedLanguage),
        t('faq.channel_setup_error', typedLanguage) || 'An error occurred while setting up the FAQ channel.'
      )]
    });
  }
}

// Helper function to update the FAQ channel content
async function updateFaqChannel(guildId: string, language: string) {
  // Cast language to proper type
  const typedLanguage = ensureLanguageType(language);
  try {
    // Get the settings
    const settings = await settingsManager.getSettings(guildId);
    if (!settings || !settings.faq_channel_id) {
      return; // No FAQ channel set up
    }

    // Get the guild and channel
    const client = (global as any).client as Client;
    const guild = client.guilds.cache.get(guildId);
    
    if (!guild) {
      logError('FAQ Manager', `Guild not found with ID ${guildId}`);
      return;
    }
    
    const faqChannel = await guild.channels.fetch(settings.faq_channel_id) as TextChannel;
    
    if (!faqChannel) {
      logError('FAQ Manager', `FAQ channel not found for guild ${guildId}`);
      return;
    }

    // Get all FAQs for this guild
    const faqs = await typedDb.all(
      'SELECT * FROM faq WHERE guild_id = ? ORDER BY id',
      [guildId]
    );

    // Clear the channel (delete all messages)
    try {
      const messages = await faqChannel.messages.fetch({ limit: 100 });
      await faqChannel.bulkDelete(messages);
    } catch (error) {
      logError('FAQ Manager', `Error clearing FAQ channel: ${error}`);
      // Continue anyway, as some messages might be too old to delete
    }

    // Create header embed
    const headerEmbed = new EmbedBuilder()
      .setTitle(`❓ ${t('faq.faq_title', typedLanguage)}`)
      .setDescription(t('faq.faq_description', typedLanguage))
      .setColor(Colors.INFO)
      .setTimestamp()
      .setFooter({ text: t('general.footer', typedLanguage) });

    // Add server icon if available
    if (guild.iconURL()) {
      headerEmbed.setThumbnail(guild.iconURL());
    }

    await faqChannel.send({ embeds: [headerEmbed] });

    // If there are no FAQs, send a message
    if (faqs.length === 0) {
      const noFaqsEmbed = new EmbedBuilder()
        .setDescription(t('faq.no_faqs_yet', typedLanguage) || 'No FAQs have been added yet.')
        .setColor(Colors.INFO);

      await faqChannel.send({ embeds: [noFaqsEmbed] });
      return;
    }

    // Send each FAQ as a separate embed
    for (const faq of faqs) {
      const faqEmbed = new EmbedBuilder()
        .setTitle(`#${faq.id}: ${faq.question}`)
        .setDescription(faq.answer)
        .setColor(Colors.INFO);

      await faqChannel.send({ embeds: [faqEmbed] });
    }
  } catch (error) {
    logError('FAQ Manager', `Error updating FAQ channel: ${error}`);
  }
}
