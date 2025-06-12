import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';

export const data = new SlashCommandBuilder()
    .setName('language')
    .setDescription('Change the bot language');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({
        content: 'Language selection has been disabled. All content is provided in English.',
        flags: MessageFlags.Ephemeral
    });
}
