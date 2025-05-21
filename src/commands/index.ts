import logText from './admin/logs';
import chatbot from './utility/chatbot';

// Export all commands
export const commands = [
  logText,
  chatbot
];

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
