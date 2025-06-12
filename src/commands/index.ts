import logText from './admin/logs';
import chatbot from './utility/chatbot';

// We're no longer exporting commands array to prevent duplicates
// The commands are loaded directly from the file system
// This was causing duplicate commands in the bot
export const commands = [];

// Re-export for backward compatibility
export { default as logs } from './admin/logs';
export { default as chatbot } from './utility/chatbot';

type Command = {
  data: any;
  execute: (interaction: any) => Promise<void>;
  autocomplete?: (interaction: any) => Promise<void>;
};

// Export command type for TypeScript
export type { Command };

// Export all command types from types
export * from '../types/command';
