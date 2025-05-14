import { Language } from './language';

/**
 * This file provides a simplified approach to command localization.
 * 
 * Instead of trying to use Discord's built-in localization (which requires specific locale codes
 * and has limitations), we'll focus on translating command responses based on the user's
 * or server's language preference.
 * 
 * Command names and descriptions will remain in English in the Discord UI,
 * but all responses and content will be translated based on the context language.
 */

/**
 * A helper function to get a translated command description
 * This is for documentation purposes only - Discord command descriptions
 * will remain in English, but we can use these translations in help messages
 * 
 * @param commandName The name of the command
 * @param language The language to translate to
 */
export function getLocalizedCommandDescription(commandName: string, language: Language): string {
  const translations = commandDescriptions[language] || commandDescriptions.en;
  return translations[commandName] || commandDescriptions.en[commandName] || commandName;
}

/**
 * Command descriptions in different languages
 */
const commandDescriptions: Record<Language, Record<string, string>> = {
  en: {
    // Admin commands
    'setup-ticket-logs': 'Set up a dedicated channel for ticket transcripts and logs',
    'server-setup': 'Set up essential server features like logs and tickets',
    
    // Utility commands
    'language': 'Change your language preference or the server language',
    'help': 'Get help with bot commands',
    
    // Ticket commands
    'create-ticket': 'Create a new support ticket',
    'close': 'Close a ticket',
    
    // Moderation commands
    'warn': 'Warn a user',
    'kick': 'Kick a user from the server',
    'ban': 'Ban a user from the server'
  }
};

/**
 * This function can be used in the help command to show localized command descriptions
 * based on the user's preferred language
 */
export function getHelpCommandDescriptions(language: Language): Record<string, string> {
  return commandDescriptions[language] || commandDescriptions.en;
}
