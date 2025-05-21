import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
  SlashCommandSubcommandsOnlyBuilder, 
  AutocompleteInteraction 
} from 'discord.js';

export type ExecuteProps = 
  | ChatInputCommandInteraction
  | MessageContextMenuCommandInteraction
  | UserContextMenuCommandInteraction;

export interface Command {
  data: 
    | Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand"> 
    | SlashCommandSubcommandsOnlyBuilder
    | ContextMenuCommandBuilder;
  execute: (interaction: ExecuteProps) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}