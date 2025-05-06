import { EmbedBuilder, Guild, TextChannel } from 'discord.js';
import { Colors } from './embeds';
import { settingsManager } from './settings';
import { logInfo, logError } from './logger';
import { Language, getTranslation as t } from './language';

/**
 * Template types supported by the system
 */
export type TemplateType = 'rules' | 'welcome' | 'ticket' | 'faq';

/**
 * Template structure
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  embed?: boolean;
  embedTitle?: string;
  embedColor?: number;
  embedFooter?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default templates for various components
 */
export const defaultTemplates: Record<TemplateType, Template[]> = {
  rules: [
    {
      id: 'rules-default',
      name: 'Default Rules',
      description: 'Standard server rules template',
      content: 'Welcome to {server}! To ensure everyone has a positive experience, please follow these rules:\n\n' +
        '1. **Be Respectful** - Treat all members with respect. Harassment, hate speech, discrimination, or bullying will not be tolerated.\n\n' +
        '2. **No Inappropriate Content** - Do not post NSFW, illegal, or offensive content in any channel.\n\n' +
        '3. **No Spamming** - Avoid sending repeated messages, excessive mentions, or flooding channels with messages.\n\n' +
        '4. **Follow Discord TOS** - Adhere to Discord\'s Terms of Service and Community Guidelines at all times.\n\n' +
        '5. **Use Appropriate Channels** - Post content in the relevant channels. Keep discussions on-topic.',
      embed: true,
      embedTitle: '📜 Server Rules',
      embedColor: Colors.INFO,
      embedFooter: 'Last updated: {date}',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'rules-minimal',
      name: 'Minimal Rules',
      description: 'A simplified set of essential rules',
      content: 'Welcome to {server}! Please follow these basic rules:\n\n' +
        '1. Be respectful to all members\n' +
        '2. No inappropriate content\n' +
        '3. No spamming\n' +
        '4. Follow Discord TOS',
      embed: true,
      embedTitle: '📜 Server Rules',
      embedColor: Colors.INFO,
      embedFooter: 'Last updated: {date}',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],
  welcome: [
    {
      id: 'welcome-default',
      name: 'Default Welcome',
      description: 'Standard welcome message for new members',
      content: 'Welcome to {server}, {user}! We\'re glad to have you here.\n\n' +
        'Please read our rules in <#{rules_channel}> and enjoy your stay!\n\n' +
        'If you need help, feel free to create a ticket in <#{ticket_channel}>.',
      embed: true,
      embedTitle: '👋 Welcome to {server}!',
      embedColor: Colors.SUCCESS,
      embedFooter: 'Joined: {date}',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'welcome-detailed',
      name: 'Detailed Welcome',
      description: 'A more comprehensive welcome message with server information',
      content: 'Welcome to {server}, {user}!\n\n' +
        '**About Us**\nWe are a community focused on creating a friendly environment for everyone.\n\n' +
        '**Important Channels**\n' +
        '• <#{rules_channel}> - Server rules\n' +
        '• <#{ticket_channel}> - Get support\n\n' +
        'Enjoy your stay and don\'t hesitate to reach out if you need anything!',
      embed: true,
      embedTitle: '👋 Welcome to {server}!',
      embedColor: Colors.SUCCESS,
      embedFooter: 'Joined: {date}',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],
  ticket: [
    {
      id: 'ticket-default',
      name: 'Default Ticket Panel',
      description: 'Standard ticket panel message',
      content: 'Need help? Have a question? Want to report something? Create a ticket and our staff team will assist you as soon as possible.\n\n' +
        '**How to Create a Ticket**\nClick the button below to create a new support ticket.\n\n' +
        '**Available Categories**\n{categories}',
      embed: true,
      embedTitle: '🎫 Support Tickets',
      embedColor: Colors.PRIMARY,
      embedFooter: 'Support system powered by BotAI',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'ticket-simple',
      name: 'Simple Ticket Panel',
      description: 'A minimalist ticket panel',
      content: 'Need assistance? Click the button below to create a support ticket.\n\n{categories}',
      embed: true,
      embedTitle: '🎫 Support',
      embedColor: Colors.PRIMARY,
      embedFooter: 'Support system powered by BotAI',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],
  faq: [
    {
      id: 'faq-default',
      name: 'Default FAQ',
      description: 'Standard frequently asked questions',
      content: 'Here are answers to some common questions about our server and ticket system. If you need further assistance, please create a ticket.\n\n' +
        '**How do I create a ticket?**\nClick the "Create Ticket" button in the ticket panel, select a category that best matches your request, and a new ticket channel will be created for you.\n\n' +
        '**How long does it take to get a response?**\nOur staff team typically responds within a few hours. Response times may vary based on staff availability and the complexity of your request.\n\n' +
        '**Can I add other users to my ticket?**\nYes, staff members can add other users to your ticket using the `/adduser` command if needed for resolving your issue.\n\n' +
        '**How do I close my ticket?**\nYou can close your ticket by clicking the "Close Ticket" button in your ticket channel. You can also reopen it later if needed.',
      embed: true,
      embedTitle: '📚 Frequently Asked Questions',
      embedColor: Colors.INFO,
      embedFooter: 'Support system powered by BotAI',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
};

/**
 * Get a template by its ID
 * @param templateId The ID of the template to retrieve
 * @returns The template or undefined if not found
 */
export function getTemplateById(templateId: string): Template | undefined {
  for (const type in defaultTemplates) {
    const templates = defaultTemplates[type as TemplateType];
    const template = templates.find(t => t.id === templateId);
    if (template) {
      return template;
    }
  }
  return undefined;
}

/**
 * Get all templates for a specific type
 * @param type The type of templates to retrieve
 * @returns Array of templates
 */
export function getTemplatesByType(type: TemplateType): Template[] {
  return defaultTemplates[type] || [];
}

/**
 * Process template placeholders in a string
 * @param content The template content with placeholders
 * @param replacements Object containing key-value pairs for replacements
 * @returns Processed string with placeholders replaced
 */
export function processTemplate(content: string, replacements: Record<string, string>): string {
  let processed = content;
  
  for (const [key, value] of Object.entries(replacements)) {
    processed = processed.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  
  return processed;
}

/**
 * Create an embed from a template
 * @param template The template to use
 * @param replacements Object containing key-value pairs for replacements
 * @returns EmbedBuilder with processed content
 */
export function createTemplateEmbed(template: Template, replacements: Record<string, string>): EmbedBuilder {
  const processedContent = processTemplate(template.content, replacements);
  const processedTitle = template.embedTitle ? processTemplate(template.embedTitle, replacements) : undefined;
  const processedFooter = template.embedFooter ? processTemplate(template.embedFooter, replacements) : undefined;
  
  const embed = new EmbedBuilder()
    .setDescription(processedContent)
    .setColor(template.embedColor || Colors.PRIMARY);
  
  if (processedTitle) {
    embed.setTitle(processedTitle);
  }
  
  if (processedFooter) {
    embed.setFooter({ text: processedFooter });
  }
  
  return embed;
}

/**
 * Save a custom template for a guild
 * @param guildId The ID of the guild
 * @param type The type of template
 * @param template The template data
 */
export async function saveGuildTemplate(guildId: string, type: TemplateType, template: Partial<Template>): Promise<boolean> {
  try {
    // Get existing settings
    const settings = await settingsManager.getSettings(guildId);
    if (!settings) {
      return false;
    }
    
    // Initialize templates object if it doesn't exist
    if (!settings.templates) {
      settings.templates = {};
    }
    
    // Initialize template type array if it doesn't exist
    if (!settings.templates[type]) {
      settings.templates[type] = [];
    }
    
    // Check if template with this ID already exists
    const existingIndex = settings.templates[type].findIndex((t: any) => t.id === template.id);
    
    if (existingIndex >= 0) {
      // Update existing template
      settings.templates[type][existingIndex] = {
        ...settings.templates[type][existingIndex],
        ...template,
        updatedAt: new Date()
      };
    } else {
      // Add new template
      settings.templates[type].push({
        id: template.id || `${type}-custom-${Date.now()}`,
        name: template.name || 'Custom Template',
        description: template.description || 'Custom template',
        content: template.content || '',
        embed: template.embed !== undefined ? template.embed : true,
        embedTitle: template.embedTitle,
        embedColor: template.embedColor,
        embedFooter: template.embedFooter,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Save updated settings
    await settingsManager.updateSettings(guildId, settings);
    
    logInfo('Templates', `Saved custom ${type} template for guild ${guildId}`);
    return true;
  } catch (error) {
    logError('Templates', `Error saving custom template: ${error}`);
    return false;
  }
}

/**
 * Get all templates for a guild (including defaults and custom ones)
 * @param guildId The ID of the guild
 * @param type The type of templates to retrieve
 * @returns Array of templates
 */
export async function getGuildTemplates(guildId: string, type: TemplateType): Promise<Template[]> {
  try {
    // Get default templates
    const defaultTemplatesForType = getTemplatesByType(type);
    
    // Get guild settings
    const settings = await settingsManager.getSettings(guildId);
    if (!settings || !settings.templates || !settings.templates[type]) {
      return defaultTemplatesForType;
    }
    
    // Combine default and custom templates
    const customTemplates = settings.templates[type] as Template[];
    
    // Filter out default templates that have been overridden by custom ones
    const filteredDefaults = defaultTemplatesForType.filter(
      defaultTemplate => !customTemplates.some(custom => custom.id === defaultTemplate.id)
    );
    
    return [...filteredDefaults, ...customTemplates];
  } catch (error) {
    logError('Templates', `Error getting guild templates: ${error}`);
    return getTemplatesByType(type);
  }
}

/**
 * Delete a custom template for a guild
 * @param guildId The ID of the guild
 * @param type The type of template
 * @param templateId The ID of the template to delete
 */
export async function deleteGuildTemplate(guildId: string, type: TemplateType, templateId: string): Promise<boolean> {
  try {
    // Get existing settings
    const settings = await settingsManager.getSettings(guildId);
    if (!settings || !settings.templates || !settings.templates[type]) {
      return false;
    }
    
    // Check if template exists and is custom (not default)
    const isDefault = defaultTemplates[type].some(t => t.id === templateId);
    if (isDefault) {
      // Cannot delete default templates
      return false;
    }
    
    // Filter out the template to delete
    settings.templates[type] = settings.templates[type].filter((t: any) => t.id !== templateId);
    
    // Save updated settings
    await settingsManager.updateSettings(guildId, settings);
    
    logInfo('Templates', `Deleted custom ${type} template ${templateId} for guild ${guildId}`);
    return true;
  } catch (error) {
    logError('Templates', `Error deleting custom template: ${error}`);
    return false;
  }
}

/**
 * Get the active template for a specific type and guild
 * @param guildId The ID of the guild
 * @param type The type of template
 * @returns The active template or the default one if not set
 */
export async function getActiveTemplate(guildId: string, type: TemplateType): Promise<Template> {
  try {
    // Get guild settings
    const settings = await settingsManager.getSettings(guildId);
    if (!settings || !settings.active_templates || !settings.active_templates[type]) {
      // Return the first default template if no active template is set
      return defaultTemplates[type][0];
    }
    
    // Get the active template ID
    const activeTemplateId = settings.active_templates[type];
    
    // Get all templates for this guild and type
    const allTemplates = await getGuildTemplates(guildId, type);
    
    // Find the active template
    const activeTemplate = allTemplates.find(t => t.id === activeTemplateId);
    
    // Return the active template or the default one if not found
    return activeTemplate || defaultTemplates[type][0];
  } catch (error) {
    logError('Templates', `Error getting active template: ${error}`);
    return defaultTemplates[type][0];
  }
}

/**
 * Set the active template for a specific type and guild
 * @param guildId The ID of the guild
 * @param type The type of template
 * @param templateId The ID of the template to set as active
 */
export async function setActiveTemplate(guildId: string, type: TemplateType, templateId: string): Promise<boolean> {
  try {
    // Get existing settings
    const settings = await settingsManager.getSettings(guildId);
    if (!settings) {
      return false;
    }
    
    // Initialize active_templates object if it doesn't exist
    if (!settings.active_templates) {
      settings.active_templates = {};
    }
    
    // Set the active template
    settings.active_templates[type] = templateId;
    
    // Save updated settings
    await settingsManager.updateSettings(guildId, settings);
    
    logInfo('Templates', `Set active ${type} template to ${templateId} for guild ${guildId}`);
    return true;
  } catch (error) {
    logError('Templates', `Error setting active template: ${error}`);
    return false;
  }
}
