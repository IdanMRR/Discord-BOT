import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, EmbedBuilder, User } from 'discord.js';
import { createErrorEmbed, createInfoEmbed } from '../../utils/embeds';
import { logError } from '../../utils/logger';
import { WarningService } from '../../database/services/sqliteService';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a user')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to check warnings for')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Defer reply to give us time to fetch warnings
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      // Get the target user
      const targetUser = interaction.options.getUser('user', true);
      
      // Get the guild
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'This command can only be used in a server.' });
        return;
      }
      
      // Fetch warnings for the user
      const { data: warnings, error } = await WarningService.getWarnings(guild.id, targetUser.id);
      
      if (error) {
        logError('Warnings Command', `Error fetching warnings: ${error}`);
        await interaction.editReply({ content: 'There was an error fetching warnings. Please try again later.' });
        return;
      }
      
      // Count active warnings
      const activeWarnings = warnings.filter(w => w.active).length;
      
      if (warnings.length === 0) {
        await interaction.editReply({ content: `${targetUser.tag} has no warnings in this server.` });
        return;
      }
      
      // Create an embed to display the warnings
      const embed = new EmbedBuilder()
        .setTitle(`Warnings for ${targetUser.tag}`)
        .setColor('#FF9900')
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(`**Total Warnings:** ${warnings.length}\n**Active Warnings:** ${activeWarnings}`)
        .setTimestamp()
        .setFooter({ text: `${guild.name} • User ID: ${targetUser.id}` });
      
      // Add warnings to the embed (limit to 10 most recent)
      const recentWarnings = warnings.slice(0, 10);
      
      for (const warning of recentWarnings) {
        let moderator: User | null = null;
        try {
          moderator = await interaction.client.users.fetch(warning.moderator_id);
        } catch (error) {
          console.error(`Could not fetch moderator: ${error}`);
        }
        
        const moderatorName = moderator ? moderator.tag : 'Unknown Moderator';
        const timestamp = warning.created_at ? 
          `<t:${Math.floor(new Date(warning.created_at).getTime() / 1000)}:F>` : 
          'Unknown time';
        const status = warning.active ? '🟢 Active' : '🔴 Removed';
        
        let removalInfo = '';
        if (!warning.active && warning.removed_at) {
          let removalModerator: User | null = null;
          try {
            removalModerator = warning.removed_by ? await interaction.client.users.fetch(warning.removed_by) : null;
          } catch (error) {
            console.error(`Could not fetch removal moderator: ${error}`);
          }
          
          const removalModName = removalModerator ? removalModerator.tag : 'Unknown Moderator';
          const removalTime = `<t:${Math.floor(new Date(warning.removed_at).getTime() / 1000)}:F>`;
          removalInfo = `\n**Removed by:** ${removalModName}\n**Removed:** ${removalTime}\n**Removal Reason:** ${warning.removal_reason || 'No reason provided'}`;
        }
        
        embed.addFields({
          name: `Warning ${status}`,
          value: `**Reason:** ${warning.reason}\n**Moderator:** ${moderatorName}\n**Issued:** ${timestamp}${removalInfo}`,
          inline: false
        });
      }
      
      if (warnings.length > 10) {
        embed.addFields({
          name: 'Note',
          value: `Only showing the 10 most recent warnings. ${warnings.length - 10} more warnings exist.`,
          inline: false
        });
      }
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Warnings Command', error);
      const errorEmbed = createErrorEmbed('Command Error', 'There was an error trying to fetch warnings. Please try again later.');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
