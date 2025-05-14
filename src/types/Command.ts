import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandsOnlyBuilder, AutocompleteInteraction } from 'discord.js';

export interface Command {
    data: Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand"> | SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
} 