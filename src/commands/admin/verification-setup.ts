import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ChannelType, TextChannel, Role, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { 
  VerificationType, 
  getVerificationSettings, 
  saveVerificationSettings,
  addCustomQuestion,
  removeCustomQuestion
} from '../../handlers/verification/verification-config';
import { createVerificationMessage } from '../../handlers/verification/verification-handler';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { settingsManager } from '../../utils/settings';

export const data = new SlashCommandBuilder()
  .setName('verification-setup')
  .setDescription('Configure the verification system for your server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('enable')
      .setDescription('Enable the verification system')
      .addStringOption(option => 
        option
          .setName('type')
          .setDescription('The type of verification to use')
          .setRequired(true)
          .addChoices(
            { name: 'Button (Simple Click)', value: VerificationType.BUTTON },
            { name: 'CAPTCHA (Code Entry)', value: VerificationType.CAPTCHA },
            { name: 'Custom Question', value: VerificationType.CUSTOM_QUESTION },
            { name: 'Age Verification', value: VerificationType.AGE_VERIFICATION }
          )
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('The role to assign to verified users')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('The channel to send the verification message in')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addChannelOption(option =>
        option
          .setName('log_channel')
          .setDescription('The channel to log verification attempts in')
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('disable')
      .setDescription('Disable verification for your server')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add_question')
      .setDescription('Add a custom question for verification')
      .addStringOption(option =>
        option.setName('question')
          .setDescription('The question to ask')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('answer')
          .setDescription('The answer to the question')
          .setRequired(true)
      )
      .addBooleanOption(option =>
        option.setName('case_sensitive')
          .setDescription('Whether the answer is case sensitive')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove_question')
      .setDescription('Remove a custom question from verification')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('set_min_age')
      .setDescription('Set the minimum age for age verification')
      .addIntegerOption(option =>
        option.setName('age')
          .setDescription('The minimum age required')
          .setRequired(true)
          .setMinValue(13)
          .setMaxValue(100)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('account_age')
      .setDescription('Set account age requirements for verification')
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Whether to require a minimum account age')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option.setName('days')
          .setDescription('The minimum account age in days')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(365)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('welcome_message')
      .setDescription('Set a welcome message for verified users')
      .addStringOption(option =>
        option.setName('message')
          .setDescription('The welcome message (use {user} for the user mention)')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('The channel to send welcome messages in')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Check the current verification settings')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('diagnose')
      .setDescription('Check and fix verification system settings')
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  
  try {
    switch (subcommand) {
      case 'enable':
        await handleEnableVerification(interaction);
        break;
      
      case 'disable':
        await handleDisableVerification(interaction);
        break;
      
      case 'add_question':
        await handleAddQuestion(interaction);
        break;
      
      case 'remove_question':
        await handleRemoveQuestion(interaction);
        break;
      
      case 'set_min_age':
        await handleSetMinAge(interaction);
        break;
      
      case 'account_age':
        await handleAccountAge(interaction);
        break;
      
      case 'welcome_message':
        await handleWelcomeMessage(interaction);
        break;
      
      case 'status':
        await handleStatus(interaction);
        break;
      
      case 'diagnose':
        await handleDiagnoseVerification(interaction);
        break;
      
      default:
        await interaction.reply('Unknown subcommand.');
    }
  } catch (error) {
    logError('Verification Setup', `Error executing command: ${error}`);
    
    try {
      if (interaction.deferred) {
        await interaction.editReply('An error occurred while setting up verification. Please try again.');
      } else {
        await interaction.reply('An error occurred while setting up verification. Please try again.');
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
}

/**
 * Handle enabling verification
 */
async function handleEnableVerification(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  const type = interaction.options.getString('type') as VerificationType;
  const role = interaction.options.getRole('role') as Role;
  const channel = interaction.options.getChannel('channel') as TextChannel;
  const logChannel = interaction.options.getChannel('log_channel') as TextChannel | null;
  
  // Get current settings
  const settings = await getVerificationSettings(interaction.guildId!);
  
  if (!settings) {
    await interaction.editReply('Failed to get verification settings. Please try again.');
    return;
  }
  
  // Update settings
  settings.enabled = true;
  settings.type = type;
  settings.role_id = role.id;
  settings.channel_id = channel.id;
  
  if (logChannel) {
    settings.log_channel_id = logChannel.id;
  }
  
  // Create verification message
  const messageId = await createVerificationMessage(channel.id, interaction.guildId!, settings);
  
  if (!messageId) {
    await interaction.editReply('Failed to create verification message. Please try again.');
    return;
  }
  
  // Save message ID
  settings.message_id = messageId;
  
  // Save settings
  const success = await saveVerificationSettings(interaction.guildId!, settings);
  
  if (!success) {
    await interaction.editReply('Failed to save verification settings. Please try again.');
    return;
  }
  
  // Create success embed
  const embed = new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setTitle('✅ Verification Enabled')
    .setDescription(`Verification has been enabled for your server using the ${type} method.`)
    .addFields([
      { name: 'Verification Channel', value: `<#${channel.id}>`, inline: true },
      { name: 'Verified Role', value: `<@&${role.id}>`, inline: true }
    ]);
  
  if (logChannel) {
    embed.addFields([{ name: 'Log Channel', value: `<#${logChannel.id}>`, inline: true }]);
  }
  
  // Add type-specific instructions
  switch (type) {
    case VerificationType.CUSTOM_QUESTION:
      embed.addFields([
        { 
          name: 'Next Steps', 
          value: 'Use `/verification-setup add_question` to add custom questions for verification.' 
        }
      ]);
      break;
    
    case VerificationType.AGE_VERIFICATION:
      embed.addFields([
        { 
          name: 'Next Steps', 
          value: 'Use `/verification-setup set_min_age` to set the minimum age required for verification.' 
        }
      ]);
      break;
  }
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle disabling verification
 */
async function handleDisableVerification(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  // Get current settings
  const settings = await getVerificationSettings(interaction.guildId!);
  
  if (!settings) {
    await interaction.editReply('Failed to get verification settings. Please try again.');
    return;
  }
  
  // Check if verification is already disabled
  if (!settings.enabled) {
    await interaction.editReply('Verification is already disabled for this server.');
    return;
  }
  
  // Update settings
  settings.enabled = false;
  
  // Save settings
  const success = await saveVerificationSettings(interaction.guildId!, settings);
  
  if (!success) {
    await interaction.editReply('Failed to save verification settings. Please try again.');
    return;
  }
  
  // Create success embed
  const embed = new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setTitle('✅ Verification Disabled')
    .setDescription('Verification has been disabled for your server.');
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle adding a custom question
 */
async function handleAddQuestion(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  // Get current settings
  const settings = await getVerificationSettings(interaction.guildId!);
  
  if (!settings) {
    await interaction.editReply('Failed to get verification settings. Please try again.');
    return;
  }
  
  // Check if verification is enabled
  if (!settings.enabled) {
    await interaction.editReply('Verification is not enabled for this server. Enable it first with `/verification-setup enable`.');
    return;
  }
  
  // Check if verification type is custom question
  if (settings.type !== VerificationType.CUSTOM_QUESTION) {
    await interaction.editReply('Custom questions are only available for the Custom Question verification type.');
    return;
  }
  
  // Get question and answer
  const question = interaction.options.getString('question')!;
  const answer = interaction.options.getString('answer')!;
  const caseSensitive = interaction.options.getBoolean('case_sensitive') ?? false;
  
  // Create question object
  const questionObj = {
    id: uuidv4(),
    question,
    answer,
    case_sensitive: caseSensitive
  };
  
  // Add question
  const success = await addCustomQuestion(interaction.guildId!, questionObj);
  
  if (!success) {
    await interaction.editReply('Failed to add custom question. Please try again.');
    return;
  }
  
  // Create success embed
  const embed = new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setTitle('✅ Custom Question Added')
    .setDescription('A custom question has been added to your verification system.')
    .addFields([
      { name: 'Question', value: question, inline: false },
      { name: 'Answer', value: answer, inline: true },
      { name: 'Case Sensitive', value: caseSensitive ? 'Yes' : 'No', inline: true }
    ]);
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle removing a custom question
 */
async function handleRemoveQuestion(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  // Get current settings
  const settings = await getVerificationSettings(interaction.guildId!);
  
  if (!settings) {
    await interaction.editReply('Failed to get verification settings. Please try again.');
    return;
  }
  
  // Check if verification is enabled
  if (!settings.enabled) {
    await interaction.editReply('Verification is not enabled for this server.');
    return;
  }
  
  // Check if verification type is custom question
  if (settings.type !== VerificationType.CUSTOM_QUESTION) {
    await interaction.editReply('Custom questions are only available for the Custom Question verification type.');
    return;
  }
  
  // Check if there are any questions
  if (!settings.custom_questions || settings.custom_questions.length === 0) {
    await interaction.editReply('There are no custom questions to remove.');
    return;
  }
  
  // Create select menu for questions
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('remove_question_select')
    .setPlaceholder('Select a question to remove')
    .addOptions(
      settings.custom_questions.map((q, index) => 
        new StringSelectMenuOptionBuilder()
          .setLabel(`Question ${index + 1}`)
          .setDescription(q.question.length > 100 ? q.question.substring(0, 97) + '...' : q.question)
          .setValue(q.id)
      )
    );
  
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selectMenu);
  
  const response = await interaction.editReply({
    content: 'Select a question to remove:',
    components: [row]
  });
  
  // Create a filter for the select menu
  const filter = (i: any) => 
    i.customId === 'remove_question_select' && 
    i.user.id === interaction.user.id;
  
  try {
    // Wait for selection (60 second timeout)
    const selection = await response.awaitMessageComponent({
      filter,
      time: 60000
    });
    
    // Get the selected question ID
    const questionId = (selection as any).values?.[0];
    
    // Remove the question
    const success = await removeCustomQuestion(interaction.guildId!, questionId);
    
    if (!success) {
      await selection.update({
        content: 'Failed to remove custom question. Please try again.',
        components: []
      });
      return;
    }
    
    // Create success embed
    const embed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle('✅ Custom Question Removed')
      .setDescription('The selected custom question has been removed from your verification system.');
    
    await selection.update({
      content: '',
      embeds: [embed],
      components: []
    });
  } catch (error) {
    // Timeout or error
    await interaction.editReply({
      content: 'Question removal canceled or timed out.',
      components: []
    });
  }
}

/**
 * Handle setting minimum age
 */
async function handleSetMinAge(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  // Get current settings
  const settings = await getVerificationSettings(interaction.guildId!);
  
  if (!settings) {
    await interaction.editReply('Failed to get verification settings. Please try again.');
    return;
  }
  
  // Check if verification is enabled
  if (!settings.enabled) {
    await interaction.editReply('Verification is not enabled for this server. Enable it first with `/verification-setup enable`.');
    return;
  }
  
  // Get minimum age
  const minAge = interaction.options.getInteger('age')!;
  
  // Update settings
  settings.min_age = minAge;
  
  // Save settings
  const success = await saveVerificationSettings(interaction.guildId!, settings);
  
  if (!success) {
    await interaction.editReply('Failed to save verification settings. Please try again.');
    return;
  }
  
  // Create success embed
  const embed = new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setTitle('✅ Minimum Age Set')
    .setDescription(`The minimum age for verification has been set to ${minAge} years.`);
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle account age requirements
 */
async function handleAccountAge(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  // Get current settings
  const settings = await getVerificationSettings(interaction.guildId!);
  
  if (!settings) {
    await interaction.editReply('Failed to get verification settings. Please try again.');
    return;
  }
  
  // Check if verification is enabled
  if (!settings.enabled) {
    await interaction.editReply('Verification is not enabled for this server. Enable it first with `/verification-setup enable`.');
    return;
  }
  
  // Get options
  const enabled = interaction.options.getBoolean('enabled')!;
  const days = interaction.options.getInteger('days') ?? 7;
  
  // Update settings
  settings.require_account_age = enabled;
  settings.min_account_age_days = days;
  
  // Save settings
  const success = await saveVerificationSettings(interaction.guildId!, settings);
  
  if (!success) {
    await interaction.editReply('Failed to save verification settings. Please try again.');
    return;
  }
  
  // Create success embed
  const embed = new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setTitle('✅ Account Age Requirements Updated')
    .setDescription(enabled ? 
      `Account age verification has been enabled. Users must have accounts at least ${days} days old.` : 
      'Account age verification has been disabled.'
    );
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle welcome message
 */
async function handleWelcomeMessage(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  // Get current settings
  const settings = await getVerificationSettings(interaction.guildId!);
  
  if (!settings) {
    await interaction.editReply('Failed to get verification settings. Please try again.');
    return;
  }
  
  // Check if verification is enabled
  if (!settings.enabled) {
    await interaction.editReply('Verification is not enabled for this server. Enable it first with `/verification-setup enable`.');
    return;
  }
  
  // Get options
  const message = interaction.options.getString('message')!;
  const channel = interaction.options.getChannel('channel') as TextChannel;
  
  // Update settings
  settings.welcome_message = message;
  settings.welcome_channel_id = channel.id;
  
  // Save settings
  const success = await saveVerificationSettings(interaction.guildId!, settings);
  
  if (!success) {
    await interaction.editReply('Failed to save verification settings. Please try again.');
    return;
  }
  
  // Create success embed
  const embed = new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setTitle('✅ Welcome Message Set')
    .setDescription('The welcome message for verified users has been set.')
    .addFields([
      { name: 'Message', value: message, inline: false },
      { name: 'Channel', value: `<#${channel.id}>`, inline: true }
    ]);
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle status check
 */
async function handleStatus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  // Get current settings
  const settings = await getVerificationSettings(interaction.guildId!);
  
  if (!settings) {
    await interaction.editReply('Failed to get verification settings. Please try again.');
    return;
  }
  
  // Create status embed
  const embed = new EmbedBuilder()
    .setColor(settings.enabled ? Colors.SUCCESS : Colors.ERROR)
    .setTitle('Verification Status')
    .setDescription(`Verification is currently ${settings.enabled ? 'enabled' : 'disabled'} for this server.`);
  
  if (settings.enabled) {
    embed.addFields([
      { name: 'Verification Type', value: settings.type, inline: true }
    ]);
    
    if (settings.role_id) {
      embed.addFields([{ name: 'Verified Role', value: `<@&${settings.role_id}>`, inline: true }]);
    }
    
    if (settings.channel_id) {
      embed.addFields([{ name: 'Verification Channel', value: `<#${settings.channel_id}>`, inline: true }]);
    }
    
    if (settings.log_channel_id) {
      embed.addFields([{ name: 'Log Channel', value: `<#${settings.log_channel_id}>`, inline: true }]);
    }
    
    if (settings.type === VerificationType.CUSTOM_QUESTION && settings.custom_questions) {
      embed.addFields([
        { name: 'Custom Questions', value: `${settings.custom_questions.length} question(s) configured`, inline: true }
      ]);
    }
    
    if (settings.type === VerificationType.AGE_VERIFICATION && settings.min_age) {
      embed.addFields([
        { name: 'Minimum Age', value: `${settings.min_age} years`, inline: true }
      ]);
    }
    
    if (settings.require_account_age) {
      embed.addFields([
        { name: 'Account Age Requirement', value: `${settings.min_account_age_days} days`, inline: true }
      ]);
    }
    
    if (settings.welcome_message && settings.welcome_channel_id) {
      embed.addFields([
        { name: 'Welcome Channel', value: `<#${settings.welcome_channel_id}>`, inline: true }
      ]);
    }
  }
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle diagnosing and fixing verification
 */
async function handleDiagnoseVerification(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  // Get current verification settings
  const settings = await getVerificationSettings(interaction.guildId!);
  
  if (!settings) {
    await interaction.editReply('Failed to get verification settings. Please try again.');
    return;
  }
  
  // Check if verification is enabled
  if (!settings.enabled) {
    await interaction.editReply('Verification is not enabled for this server. Enable it first with `/verification-setup enable`.');
    return;
  }
  
  // Create diagnostic results
  const diagnosticResults: { name: string; value: string; isError: boolean }[] = [];
  let fixesApplied = false;
  
  // Check if role exists
  let role = null;
  if (settings.role_id) {
    try {
      role = await interaction.guild!.roles.fetch(settings.role_id);
      if (role) {
        diagnosticResults.push({
          name: "Verification Role",
          value: `✅ Role found: <@&${role.id}>`,
          isError: false
        });
      } else {
        diagnosticResults.push({
          name: "Verification Role",
          value: `❌ Role not found with ID ${settings.role_id}`,
          isError: true
        });
      }
    } catch (error) {
      diagnosticResults.push({
        name: "Verification Role",
        value: `❌ Error fetching role: ${error}`,
        isError: true
      });
    }
  } else {
    diagnosticResults.push({
      name: "Verification Role",
      value: "❌ No role set for verification",
      isError: true
    });
  }
  
  // Check if channel exists
  let channel = null;
  if (settings.channel_id) {
    try {
      channel = await interaction.guild!.channels.fetch(settings.channel_id);
      if (channel) {
        diagnosticResults.push({
          name: "Verification Channel",
          value: `✅ Channel found: <#${channel.id}>`,
          isError: false
        });
      } else {
        diagnosticResults.push({
          name: "Verification Channel",
          value: `❌ Channel not found with ID ${settings.channel_id}`,
          isError: true
        });
      }
    } catch (error) {
      diagnosticResults.push({
        name: "Verification Channel",
        value: `❌ Error fetching channel: ${error}`,
        isError: true
      });
    }
  } else {
    diagnosticResults.push({
      name: "Verification Channel",
      value: "❌ No channel set for verification message",
      isError: true
    });
  }
  
  // Check if log channel exists
  let logChannel = null;
  let logChannelFixed = false;
  
  if (settings.log_channel_id) {
    try {
      logChannel = await interaction.guild!.channels.fetch(settings.log_channel_id);
      if (logChannel && logChannel.isTextBased()) {
        diagnosticResults.push({
          name: "Log Channel",
          value: `✅ Log channel found: <#${logChannel.id}>`,
          isError: false
        });
      } else {
        diagnosticResults.push({
          name: "Log Channel",
          value: `❌ Log channel not found or not a text channel: ${settings.log_channel_id}`,
          isError: true
        });
        
        // Get server settings to check for mod log or member log channel
        const serverSettings = await settingsManager.getSettings(interaction.guild!.id);
        
        if (serverSettings && serverSettings.mod_log_channel_id) {
          // Try to use the mod log channel instead
          try {
            const modLogChannel = await interaction.guild!.channels.fetch(serverSettings.mod_log_channel_id);
            if (modLogChannel && modLogChannel.isTextBased()) {
              settings.log_channel_id = serverSettings.mod_log_channel_id;
              await saveVerificationSettings(interaction.guildId!, settings);
              diagnosticResults.push({
                name: "Fix Applied",
                value: `✅ Updated log channel to mod log channel: <#${modLogChannel.id}>`,
                isError: false
              });
              logChannelFixed = true;
              fixesApplied = true;
            }
          } catch (error) {
            // Skip if there's an error
          }
        }
        
        if (!logChannelFixed && serverSettings && serverSettings.member_log_channel_id) {
          // Try to use the member log channel as a fallback
          try {
            const memberLogChannel = await interaction.guild!.channels.fetch(serverSettings.member_log_channel_id);
            if (memberLogChannel && memberLogChannel.isTextBased()) {
              settings.log_channel_id = serverSettings.member_log_channel_id;
              await saveVerificationSettings(interaction.guildId!, settings);
              diagnosticResults.push({
                name: "Fix Applied",
                value: `✅ Updated log channel to member log channel: <#${memberLogChannel.id}>`,
                isError: false
              });
              logChannelFixed = true;
              fixesApplied = true;
            }
          } catch (error) {
            // Skip if there's an error
          }
        }
      }
    } catch (error) {
      diagnosticResults.push({
        name: "Log Channel",
        value: `❌ Error fetching log channel: ${error}`,
        isError: true
      });
    }
  } else {
    diagnosticResults.push({
      name: "Log Channel",
      value: "❌ No log channel set for verification attempts",
      isError: true
    });
    
    // Try to find a suitable log channel from server settings
    const serverSettings = await settingsManager.getSettings(interaction.guild!.id);
    
    if (serverSettings && serverSettings.mod_log_channel_id) {
      try {
        const modLogChannel = await interaction.guild!.channels.fetch(serverSettings.mod_log_channel_id);
        if (modLogChannel && modLogChannel.isTextBased()) {
          settings.log_channel_id = serverSettings.mod_log_channel_id;
          await saveVerificationSettings(interaction.guildId!, settings);
          diagnosticResults.push({
            name: "Fix Applied",
            value: `✅ Set log channel to mod log channel: <#${modLogChannel.id}>`,
            isError: false
          });
          logChannelFixed = true;
          fixesApplied = true;
        }
      } catch (error) {
        // Skip if there's an error
      }
    }
    
    if (!logChannelFixed && serverSettings && serverSettings.member_log_channel_id) {
      try {
        const memberLogChannel = await interaction.guild!.channels.fetch(serverSettings.member_log_channel_id);
        if (memberLogChannel && memberLogChannel.isTextBased()) {
          settings.log_channel_id = serverSettings.member_log_channel_id;
          await saveVerificationSettings(interaction.guildId!, settings);
          diagnosticResults.push({
            name: "Fix Applied",
            value: `✅ Set log channel to member log channel: <#${memberLogChannel.id}>`,
            isError: false
          });
          logChannelFixed = true;
          fixesApplied = true;
        }
      } catch (error) {
        // Skip if there's an error
      }
    }
  }
  
  // Check verification message
  if (settings.message_id && settings.channel_id) {
    try {
      const messageChannel = await interaction.guild!.channels.fetch(settings.channel_id) as TextChannel;
      if (messageChannel && messageChannel.isTextBased()) {
        try {
          const message = await messageChannel.messages.fetch(settings.message_id);
          if (message) {
            diagnosticResults.push({
              name: "Verification Message",
              value: "✅ Verification message found",
              isError: false
            });
          } else {
            diagnosticResults.push({
              name: "Verification Message",
              value: "❌ Verification message not found",
              isError: true
            });
          }
        } catch (error) {
          diagnosticResults.push({
            name: "Verification Message",
            value: `❌ Error fetching verification message: ${error}`,
            isError: true
          });
        }
      }
    } catch (error) {
      // Already covered in channel check
    }
  } else {
    diagnosticResults.push({
      name: "Verification Message",
      value: "❌ No verification message ID set",
      isError: true
    });
  }
  
  // Create embed for diagnostic results
  const embed = new EmbedBuilder()
    .setColor(fixesApplied ? Colors.SUCCESS : Colors.INFO)
    .setTitle("Verification System Diagnostic")
    .setDescription(`Diagnostic results for your verification system. ${fixesApplied ? '**Fixes have been automatically applied.**' : ''}`)
    .addFields(
      diagnosticResults.map(result => ({
        name: result.name,
        value: result.value,
        inline: false
      }))
    )
    .setFooter({ text: "Use /verification-setup enable to reconfigure verification if needed" });
  
  await interaction.editReply({ embeds: [embed] });
}
