import { SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
  Colors, MessageFlags } from 'discord.js';
import { logError, logInfo } from '../../utils/logger';
import { settingsManager } from '../../utils/settings';
import { 
  TemplateType, 
  getGuildTemplates, 
  getTemplatesByType, 
  setActiveTemplate,
  getActiveTemplate
} from '../../utils/templates';
import { execute as setupServer } from './server-setup';

// Command metadata
export const data = new SlashCommandBuilder()
  .setName('setup-wizard')
  .setDescription('Interactive setup wizard for customizing your server')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Command execution
export async function execute(interaction: ChatInputCommandInteraction) {
  // Defer the reply as this might take some time
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  try {
    // Start the wizard
    await startWizard(interaction);
  } catch (error) {
    logError('SetupWizard', `Error in setup wizard: ${error}`);
    await interaction.editReply({
      content: '❌ An error occurred while running the setup wizard. Please try again later.'
    });
  }
}

// Main wizard function
async function startWizard(interaction: ChatInputCommandInteraction) {
  const { guild, user } = interaction;
  
  if (!guild) {
    await interaction.editReply({
      content: '❌ This command can only be used in a server.'
    });
    return;
  }
  
  // Welcome message
  const welcomeEmbed = new EmbedBuilder()
    .setTitle('🧙‍♂️ Server Setup Wizard')
    .setDescription(
      'Welcome to the interactive setup wizard! This will help you customize your server with templates for rules, welcome messages, tickets, and more.\n\n' +
      'You can choose from pre-made templates or create your own custom ones.'
    )
    .setColor(Colors.Blue)
    .addFields(
      { name: 'What would you like to set up?', value: 'Choose an option below to get started.' }
    )
    .setFooter({ text: `Requested by ${user.tag}`, iconURL: user.displayAvatarURL() });
  
  // Create selection menu for setup options
  const setupOptions = new StringSelectMenuBuilder()
    .setCustomId('setup_option')
    .setPlaceholder('Select what to set up...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Run Full Server Setup')
        .setDescription('Set up all server components with default templates')
        .setValue('full_setup')
        .setEmoji('🚀'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Rules Templates')
        .setDescription('Choose a template for your server rules')
        .setValue('rules')
        .setEmoji('📜'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Welcome Messages')
        .setDescription('Choose a template for welcome messages')
        .setValue('welcome')
        .setEmoji('👋'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Ticket Panels')
        .setDescription('Choose a template for ticket panels')
        .setValue('ticket')
        .setEmoji('🎫'),
      new StringSelectMenuOptionBuilder()
        .setLabel('FAQ Templates')
        .setDescription('Choose a template for frequently asked questions')
        .setValue('faq')
        .setEmoji('❓')
    );
  
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(setupOptions);
  
  // Send initial message
  const response = await interaction.editReply({
    embeds: [welcomeEmbed],
    components: [row]
  });
  
  // Create collector for the selection menu
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 300000 // 5 minutes
  });
  
  collector.on('collect', async (i) => {
    // Ensure it's the same user
    if (i.user.id !== interaction.user.id) {
      await i.reply({ 
        content: '❌ This wizard is being used by someone else.',
        flags: MessageFlags.Ephemeral
       });
      return;
    }
    
    await i.deferUpdate();
    
    const selectedOption = i.values[0] as TemplateType | 'full_setup';
    
    if (selectedOption === 'full_setup') {
      // Run the full server setup
      collector.stop();
      await interaction.editReply({
        content: '🚀 Running full server setup...',
        embeds: [],
        components: []
      });
      await setupServer(interaction);
      return;
    }
    
    // Handle template selection
    await handleTemplateSelection(interaction, selectedOption as TemplateType);
    collector.stop();
  });
  
  collector.on('end', async (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
      await interaction.editReply({
        content: '⏱️ Setup wizard timed out. Please run the command again if you want to continue.',
        embeds: [],
        components: []
      });
    }
  });
}

// Handle template selection for a specific type
async function handleTemplateSelection(
  interaction: ChatInputCommandInteraction,
  templateType: TemplateType
) {
  const { guild, user } = interaction;
  
  if (!guild) return;
  
  // Get available templates for this type
  const templates = await getGuildTemplates(guild.id, templateType);
  
  // Get currently active template
  const activeTemplate = await getActiveTemplate(guild.id, templateType);
  
  // Create embed for template selection
  const templateEmbed = new EmbedBuilder()
    .setTitle(`${getEmojiForType(templateType)} ${getNameForType(templateType)} Templates`)
    .setDescription(
      `Choose a template for your server's ${getNameForType(templateType).toLowerCase()}.\n\n` +
      `Currently active: **${activeTemplate.name}**`
    )
    .setColor(Colors.Blue)
    .setFooter({ text: `Requested by ${user.tag}`, iconURL: user.displayAvatarURL() });
  
  // Create selection menu for templates
  const templateOptions = new StringSelectMenuBuilder()
    .setCustomId(`template_${templateType}`)
    .setPlaceholder(`Select a ${templateType} template...`);
  
  // Add options for each template
  templates.forEach(template => {
    templateOptions.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(template.name)
        .setDescription(template.description || 'No description')
        .setValue(template.id)
        .setDefault(template.id === activeTemplate.id)
    );
  });
  
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(templateOptions);
  
  // Add back button
  const backButton = new ButtonBuilder()
    .setCustomId('back_to_main')
    .setLabel('Back to Main Menu')
    .setStyle(ButtonStyle.Secondary);
  
  const buttonRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(backButton);
  
  // Send template selection message
  const response = await interaction.editReply({
    embeds: [templateEmbed],
    components: [row, buttonRow]
  });
  
  // Create collector for the components
  const collector = response.createMessageComponentCollector({
    time: 300000 // 5 minutes
  });
  
  collector.on('collect', async (i) => {
    // Ensure it's the same user
    if (i.user.id !== interaction.user.id) {
      await i.reply({ 
        content: '❌ This wizard is being used by someone else.',
        flags: MessageFlags.Ephemeral
       });
      return;
    }
    
    await i.deferUpdate();
    
    if (i.customId === 'back_to_main') {
      // Go back to main menu
      collector.stop();
      await startWizard(interaction);
      return;
    }
    
    if (i.customId === `template_${templateType}` && i.isStringSelectMenu()) {
      const selectedTemplateId = i.values[0];
      
      // Set the selected template as active
      const success = await setActiveTemplate(guild.id, templateType, selectedTemplateId);
      
      if (success) {
        const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
        
        // Show preview of the selected template
        await showTemplatePreview(interaction, templateType, selectedTemplate!, collector);
      } else {
        await interaction.editReply({
          content: '❌ Failed to set the template. Please try again.',
          embeds: [],
          components: []
        });
        collector.stop();
      }
    }
  });
  
  collector.on('end', async (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
      await interaction.editReply({
        content: '⏱️ Template selection timed out. Please run the command again if you want to continue.',
        embeds: [],
        components: []
      });
    }
  });
}

// Show preview of selected template
async function showTemplatePreview(
  interaction: ChatInputCommandInteraction,
  templateType: TemplateType,
  template: any,
  collector: any
) {
  const { guild, user } = interaction;
  
  if (!guild) return;
  
  // Create preview embed
  const previewEmbed = new EmbedBuilder()
    .setTitle(`${getEmojiForType(templateType)} Template Preview: ${template.name}`)
    .setDescription(
      `You've selected the **${template.name}** template for your server's ${getNameForType(templateType).toLowerCase()}.\n\n` +
      'Here\'s a preview of how it will look:'
    )
    .setColor(Colors.Green);
  
  // Add preview content
  if (template.embed) {
    // If the template uses embeds, show a sample embed
    const contentEmbed = new EmbedBuilder()
      .setTitle(template.embedTitle || `Server ${getNameForType(templateType)}`)
      .setDescription(template.content)
      .setColor(template.embedColor ? 
        (typeof template.embedColor === 'string' ? parseInt(template.embedColor, 16) : template.embedColor) : 
        Colors.Blue);
    
    if (template.embedFooter) {
      contentEmbed.setFooter({ text: template.embedFooter });
    }
    
    // Add buttons for actions
    const applyButton = new ButtonBuilder()
      .setCustomId('apply_template')
      .setLabel('Apply Template')
      .setStyle(ButtonStyle.Success);
    
    const backButton = new ButtonBuilder()
      .setCustomId('back_to_templates')
      .setLabel('Back to Templates')
      .setStyle(ButtonStyle.Secondary);
    
    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(applyButton, backButton);
    
    // Send preview
    await interaction.editReply({
      embeds: [previewEmbed, contentEmbed],
      components: [buttonRow]
    });
  } else {
    // If the template doesn't use embeds, show the content directly
    previewEmbed.addFields(
      { name: 'Content', value: template.content.length > 1024 ? 
        template.content.substring(0, 1021) + '...' : template.content }
    );
    
    // Add buttons for actions
    const applyButton = new ButtonBuilder()
      .setCustomId('apply_template')
      .setLabel('Apply Template')
      .setStyle(ButtonStyle.Success);
    
    const backButton = new ButtonBuilder()
      .setCustomId('back_to_templates')
      .setLabel('Back to Templates')
      .setStyle(ButtonStyle.Secondary);
    
    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(applyButton, backButton);
    
    // Send preview
    await interaction.editReply({
      embeds: [previewEmbed],
      components: [buttonRow]
    });
  }
  
  // Update collector filter to handle the new buttons
  collector.on('collect', async (i: any) => {
    // Ensure it's the same user
    if (i.user.id !== interaction.user.id) {
      await i.reply({ 
        content: '❌ This wizard is being used by someone else.',
        flags: MessageFlags.Ephemeral
       });
      return;
    }
    
    await i.deferUpdate();
    
    if (i.customId === 'apply_template') {
      // Apply the template
      await applyTemplate(interaction, templateType, template.id);
      collector.stop();
    } else if (i.customId === 'back_to_templates') {
      // Go back to template selection
      collector.stop();
      await handleTemplateSelection(interaction, templateType);
    }
  });
}

// Apply the selected template
async function applyTemplate(
  interaction: ChatInputCommandInteraction,
  templateType: TemplateType,
  templateId: string
) {
  const { guild } = interaction;
  
  if (!guild) return;
  
  try {
    // Different actions based on template type
    switch (templateType) {
      case 'welcome':
        // Apply welcome template
        await applyWelcomeTemplate(interaction, templateId);
        break;
      case 'ticket':
        // Apply ticket template
        await applyTicketTemplate(interaction, templateId);
        break;
      case 'faq':
        // Apply FAQ template
        await applyFaqTemplate(interaction, templateId);
        break;
    }
    
    // Show success message
    await interaction.editReply({
      content: `✅ Successfully applied the ${getNameForType(templateType)} template!`,
      embeds: [],
      components: []
    });
    
    // Log the action
    logInfo('SetupWizard', `Applied ${templateType} template ${templateId} for guild ${guild.id}`);
  } catch (error) {
    logError('SetupWizard', `Error applying template: ${error}`);
    await interaction.editReply({
      content: '❌ An error occurred while applying the template. Please try again later.',
      embeds: [],
      components: []
    });
  }
}


// Apply welcome template
async function applyWelcomeTemplate(
  interaction: ChatInputCommandInteraction,
  templateId: string
) {
  const { guild } = interaction;
  
  if (!guild) return;
  
  // Get the template
  const template = (await getGuildTemplates(guild.id, 'welcome')).find(t => t.id === templateId);
  
  if (!template) {
    throw new Error('Template not found');
  }
  
  // Get or create welcome channel
  const settings = await settingsManager.getSettings(guild.id);
  let welcomeChannel = settings.welcome_channel_id ? 
    guild.channels.cache.get(settings.welcome_channel_id) : null;
  
  if (!welcomeChannel) {
    // Create welcome channel if it doesn't exist
    welcomeChannel = await guild.channels.create({
      name: '👋-welcome',
      topic: 'Welcome new members',
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages]
        }
      ]
    });
    
    // Update settings with new channel
    await settingsManager.setSetting(guild.id, 'welcome_channel_id', welcomeChannel.id);
  }
  
  // Save welcome message template
  await settingsManager.setSetting(guild.id, 'welcome_message', template.content);
}

// Apply ticket template
async function applyTicketTemplate(
  interaction: ChatInputCommandInteraction,
  templateId: string
) {
  const { guild } = interaction;
  
  if (!guild) return;
  
  // Get the template
  const template = (await getGuildTemplates(guild.id, 'ticket')).find(t => t.id === templateId);
  
  if (!template) {
    throw new Error('Template not found');
  }
  
  // Set active template for tickets
  await setActiveTemplate(guild.id, 'ticket', templateId);
  
  // Note: The actual ticket panel setup is handled by the /setup-tickets command
  // This just sets the active template
}

// Apply FAQ template
async function applyFaqTemplate(
  interaction: ChatInputCommandInteraction,
  templateId: string
) {
  const { guild } = interaction;
  
  if (!guild) return;
  
  // Get the template
  const template = (await getGuildTemplates(guild.id, 'faq')).find(t => t.id === templateId);
  
  if (!template) {
    throw new Error('Template not found');
  }
  
  // Get or create FAQ channel
  const settings = await settingsManager.getSettings(guild.id);
  let faqChannel = settings.faq_channel_id ? 
    guild.channels.cache.get(settings.faq_channel_id) : null;
  
  if (!faqChannel) {
    // Create FAQ channel if it doesn't exist
    faqChannel = await guild.channels.create({
      name: '❓-faq',
      topic: 'Frequently Asked Questions',
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages]
        }
      ]
    });
    
    // Update settings with new channel
    await settingsManager.setSetting(guild.id, 'faq_channel_id', faqChannel.id);
  }
  
  // Make sure the channel is a text channel
  if (faqChannel && faqChannel.isTextBased()) {
    // Send FAQ message
    if (template.embed) {
      const faqEmbed = new EmbedBuilder()
        .setTitle(template.embedTitle || 'Frequently Asked Questions')
        .setDescription(template.content.replace(/{server}/g, guild.name))
        .setColor(template.embedColor ? 
          (typeof template.embedColor === 'string' ? parseInt(template.embedColor, 16) : template.embedColor) : 
          Colors.Blue);
      
      if (template.embedFooter) {
        faqEmbed.setFooter({ 
          text: template.embedFooter.replace(/{server}/g, guild.name),
          iconURL: guild.iconURL() || undefined
        });
      }
      
      await faqChannel.send({ embeds: [faqEmbed] });
    } else {
      await faqChannel.send({ 
        content: template.content.replace(/{server}/g, guild.name)
      });
    }
  }
}

// Helper functions
function getEmojiForType(type: TemplateType): string {
  switch (type) {
    case 'welcome': return '👋';
    case 'ticket': return '🎫';
    case 'faq': return '❓';
    default: return '📄';
  }
}

function getNameForType(type: TemplateType): string {
  switch (type) {
    case 'welcome': return 'Welcome Message';
    case 'ticket': return 'Ticket Panel';
    case 'faq': return 'FAQ';
    default: return 'Template';
  }
}
