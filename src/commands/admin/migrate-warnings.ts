import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags, EmbedBuilder, Colors } from 'discord.js';
import { createErrorEmbed, createSuccessEmbed, createInfoEmbed } from '../../utils/embeds';
import { logError, logInfo } from '../../utils/logger';
import { backfillWarningCaseNumbers, needsWarningCaseBackfill, getWarningCaseStats } from '../../database/migrations/backfill-warning-case-numbers';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('migrate-warnings')
    .setDescription('Migrate old warnings to use the new case number system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Check if migration is needed and show statistics')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('run')
        .setDescription('Run the migration to assign case numbers to old warnings')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Check if user has administrator permission
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        const errorEmbed = createErrorEmbed(
          'Missing Permissions', 
          'You must be an Administrator to run warning migrations.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      const subcommand = interaction.options.getSubcommand();
      
      // Defer reply for database operations
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      switch (subcommand) {
        case 'check':
          await handleCheckMigration(interaction);
          break;
        case 'run':
          await handleRunMigration(interaction);
          break;
        default:
          await interaction.editReply({ content: 'Unknown subcommand.' });
      }
    } catch (error) {
      logError('Migrate Warnings Command', error);
      const errorEmbed = createErrorEmbed('Command Error', 'There was an error processing your request.');
      
      try {
        if (interaction.deferred) {
          await interaction.editReply({ embeds: [errorEmbed] });
        } else {
          await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
      } catch (replyError) {
        logError('Migrate Warnings Reply', replyError);
      }
    }
  }
};

async function handleCheckMigration(interaction: ChatInputCommandInteraction) {
  try {
    const stats = getWarningCaseStats();
    const needsMigration = needsWarningCaseBackfill();
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Warning Migration Status')
      .setColor(needsMigration ? Colors.Orange : Colors.Green)
      .addFields([
        { name: '📋 Total Warnings', value: stats.total.toString(), inline: true },
        { name: '✅ With Case Numbers', value: stats.withCases.toString(), inline: true },
        { name: '⚠️ Without Case Numbers', value: stats.withoutCases.toString(), inline: true },
        { name: '🔄 Migration Needed', value: needsMigration ? 'Yes' : 'No', inline: true },
        { name: '📈 Progress', value: stats.total > 0 ? `${Math.round((stats.withCases / stats.total) * 100)}%` : '100%', inline: true }
      ]);

    if (needsMigration) {
      embed.setDescription(
        `⚠️ **Migration Required**\n\n` +
        `You have ${stats.withoutCases} warning(s) that need case numbers assigned.\n` +
        `Use \`/migrate-warnings run\` to assign case numbers to these warnings.`
      );
      embed.addFields([
        { 
          name: '🛠️ What Migration Does', 
          value: 
            '• Creates moderation cases for old warnings\n' +
            '• Assigns sequential case numbers\n' +
            '• Maintains chronological order\n' +
            '• Does not modify existing warning data\n' +
            '• Safe to run multiple times',
          inline: false 
        }
      ]);
    } else {
      embed.setDescription(
        `✅ **Migration Complete**\n\n` +
        `All warnings have been assigned case numbers. No migration needed.`
      );
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logError('Check Migration', error);
    const errorEmbed = createErrorEmbed('Database Error', 'Failed to check migration status.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleRunMigration(interaction: ChatInputCommandInteraction) {
  try {
    const stats = getWarningCaseStats();
    const needsMigration = needsWarningCaseBackfill();
    
    if (!needsMigration) {
      const alreadyDoneEmbed = createInfoEmbed(
        'Migration Not Needed',
        'All warnings already have case numbers assigned. No migration required.'
      );
      await interaction.editReply({ embeds: [alreadyDoneEmbed] });
      return;
    }

    // Show initial status
    const startEmbed = createInfoEmbed(
      'Starting Migration',
      `🔄 Starting migration for ${stats.withoutCases} warning(s)...\n\nThis may take a moment.`
    );
    await interaction.editReply({ embeds: [startEmbed] });

    // Run the migration
    const startTime = Date.now();
    await backfillWarningCaseNumbers();
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Get updated stats
    const updatedStats = getWarningCaseStats();
    const processed = stats.withoutCases - updatedStats.withoutCases;

    // Show success message
    const successEmbed = createSuccessEmbed(
      'Migration Complete',
      `✅ Successfully migrated ${processed} warning(s) to use case numbers!`
    );
    
    successEmbed.addFields([
      { name: '📊 Results', value: `**Before:** ${stats.withCases}/${stats.total} with case numbers\n**After:** ${updatedStats.withCases}/${updatedStats.total} with case numbers`, inline: false },
      { name: '⏱️ Duration', value: `${duration} seconds`, inline: true },
      { name: '🎯 Success Rate', value: `${processed}/${stats.withoutCases} warnings processed`, inline: true }
    ]);

    if (updatedStats.withoutCases > 0) {
      successEmbed.addFields([
        { name: '⚠️ Note', value: `${updatedStats.withoutCases} warning(s) still need migration. You can run this command again.`, inline: false }
      ]);
      successEmbed.setColor(Colors.Orange);
    }

    await interaction.editReply({ embeds: [successEmbed] });
    
    logInfo('Migration', `Warning case number migration completed. Processed: ${processed}, Duration: ${duration}s`);
  } catch (error) {
    logError('Run Migration', error);
    const errorEmbed = createErrorEmbed(
      'Migration Failed', 
      `❌ Migration encountered an error:\n\`\`\`${error instanceof Error ? error.message : String(error)}\`\`\``
    );
    await interaction.editReply({ embeds: [errorEmbed] });
  }
} 