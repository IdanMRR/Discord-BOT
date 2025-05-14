import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  Colors 
} from 'discord.js';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { db } from '../../database/sqlite';

export const data = new SlashCommandBuilder()
  .setName('reset-staff-table')
  .setDescription('Reset the staff activity tracking table (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Log command usage
    await logCommandUsage({
      guild: interaction.guild!,
      user: interaction.user,
      command: 'reset-staff-table',
      options: interaction.options.data,
      channel: interaction.channel,
      success: true
    });
    
    // Check if table exists first
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_staff_activity'
    `).get();
    
    if (!tableExists) {
      // Create the table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS ticket_staff_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          ticket_id INTEGER NOT NULL,
          staff_id TEXT NOT NULL,
          action_type TEXT NOT NULL, 
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ Staff Table Created')
        .setDescription('The ticket staff activity table has been created successfully.')
        .setColor(Colors.Green)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
      logInfo('Reset Staff Table', `Created new ticket_staff_activity table for ${interaction.guildId}`);
      return;
    }
    
    // Drop and recreate the table
    db.exec(`
      DROP TABLE IF EXISTS ticket_staff_activity;
      
      CREATE TABLE ticket_staff_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        ticket_id INTEGER NOT NULL,
        staff_id TEXT NOT NULL,
        action_type TEXT NOT NULL, 
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Staff Table Reset')
      .setDescription('The ticket staff activity table has been successfully reset.')
      .setColor(Colors.Green)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
    logInfo('Reset Staff Table', `Reset ticket_staff_activity table for ${interaction.guildId}`);
  } catch (error) {
    logError('Reset Staff Table', `Error resetting staff table: ${error}`);
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription(`Failed to reset staff activity table: ${error}`)
      .setColor(Colors.Red)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
} 