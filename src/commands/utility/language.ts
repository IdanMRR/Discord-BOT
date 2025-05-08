import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';

export const data = new SlashCommandBuilder()
    .setName('language')
    .setDescription('This command has been temporarily disabled');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({
        content: 'Language selection has been disabled. All content is provided in English.',
        ephemeral: true
    });
}
