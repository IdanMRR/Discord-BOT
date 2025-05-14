import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  MessageFlags, 
  EmbedBuilder,
  User
} from 'discord.js';
import { Colors, createErrorEmbed } from '../../utils/embeds';
import { logInfo, logError, logCommandUsage } from '../../utils/logger';
import { db } from '../../database/sqlite';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-stats')
    .setDescription('View ticket handling statistics for staff members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('individual')
        .setDescription('View stats for a specific staff member')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The staff member to view stats for')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('View a leaderboard of staff ticket handling')
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Time period to get stats for')
            .setRequired(false)
            .addChoices(
              { name: 'Today', value: 'today' },
              { name: 'This Week', value: 'week' },
              { name: 'This Month', value: 'month' },
              { name: 'All Time', value: 'all' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of staff members to show (default: 10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)
        )
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      // Check if user has permission
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        const errorEmbed = createErrorEmbed(
          'Missing Permissions', 
          'You do not have permission to view staff statistics in this server.'
        );
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        return;
      }
      
      // Ensure the table exists
      await ensureTableExists();
      
      // Log command usage
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: interaction.commandName,
        options: interaction.options.data,
        channel: interaction.channel,
        success: true
      });
      
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'individual') {
        // Get user option
        const user = interaction.options.getUser('user', true);
        
        // Get and show individual stats
        await showIndividualStats(interaction, user);
      } else if (subcommand === 'leaderboard') {
        // Get options
        const timeframe = interaction.options.getString('timeframe') || 'all';
        const limit = interaction.options.getInteger('limit') || 10;
        
        // Show leaderboard
        await showLeaderboard(interaction, timeframe, limit);
      }
    } catch (error) {
      logError('Staff Stats', `Error showing staff stats: ${error}`);
      const errorEmbed = createErrorEmbed(
        'Error', 
        'An error occurred while retrieving staff statistics.'
      );
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
};

/**
 * Show statistics for an individual staff member
 */
async function showIndividualStats(interaction: ChatInputCommandInteraction, user: User) {
  try {
    // Check if the table exists first
    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='ticket_staff_activity'
    `).get();
    
    if (!tableCheck) {
      // Table doesn't exist, handle gracefully
      const embed = new EmbedBuilder()
        .setTitle(`Staff Performance: ${user.username}`)
        .setThumbnail(user.displayAvatarURL({ size: 128 }))
        .setColor(Colors.PRIMARY)
        .setDescription('No ticket activity data has been recorded yet.')
        .setFooter({ text: 'Staff stats will be collected as staff interact with tickets' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      return;
    }
    
    // Get staff member's statistics
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT ticket_id) as total_tickets,
        COUNT(*) as total_actions,
        SUM(CASE WHEN action_type = 'message' THEN 1 ELSE 0 END) as messages,
        SUM(CASE WHEN action_type LIKE 'status_change_%' THEN 1 ELSE 0 END) as status_changes,
        MIN(created_at) as first_action,
        MAX(created_at) as last_action
      FROM ticket_staff_activity
      WHERE guild_id = ? AND staff_id = ?
    `).get(interaction.guildId, user.id) as {
      total_tickets: number;
      total_actions: number;
      messages: number;
      status_changes: number;
      first_action: string;
      last_action: string;
    } | undefined;
    
    // Get ticket status breakdown
    const statusBreakdown = db.prepare(`
      SELECT
        action_type,
        COUNT(*) as count
      FROM ticket_staff_activity
      WHERE guild_id = ? AND staff_id = ? AND action_type LIKE 'status_change_%'
      GROUP BY action_type
    `).all(interaction.guildId, user.id) as { action_type: string, count: number }[];
    
    // Calculate average response time (time between ticket creation and first staff message)
    const responseTime = db.prepare(`
      SELECT AVG(
        (julianday(tsa.created_at) - julianday(t.created_at)) * 24 * 60
      ) as avg_response_minutes
      FROM (
        SELECT ticket_id, MIN(created_at) as created_at
        FROM ticket_staff_activity
        WHERE guild_id = ? AND staff_id = ? AND action_type = 'message'
        GROUP BY ticket_id
      ) tsa
      JOIN tickets t ON tsa.ticket_id = t.id
    `).get(interaction.guildId, user.id) as { avg_response_minutes: number } | undefined;
    
    // Create response embed
    const embed = new EmbedBuilder()
      .setTitle(`Staff Performance: ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 128 }))
      .setColor(Colors.PRIMARY)
      .setTimestamp();
    
    if (!stats || stats.total_tickets === 0) {
      embed.setDescription('This user has not handled any tickets yet.');
    } else {
      // Format dates
      const firstActionDate = new Date(stats.first_action);
      const lastActionDate = new Date(stats.last_action);
      
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      // Add general stats fields
      embed.addFields([
        { name: 'Tickets Handled', value: stats.total_tickets.toString(), inline: true },
        { name: 'Total Actions', value: stats.total_actions.toString(), inline: true },
        { name: 'Messages Sent', value: stats.messages.toString(), inline: true },
        { name: 'Status Changes', value: stats.status_changes.toString(), inline: true },
        { name: 'First Activity', value: formatter.format(firstActionDate), inline: true },
        { name: 'Last Activity', value: formatter.format(lastActionDate), inline: true }
      ]);
      
      // Add response time if available
      if (responseTime && responseTime.avg_response_minutes) {
        const minutes = Math.floor(responseTime.avg_response_minutes);
        const hours = Math.floor(minutes / 60);
        const remainingMins = minutes % 60;
        
        let responseTimeText;
        if (hours > 0) {
          responseTimeText = `${hours}h ${remainingMins}m`;
        } else {
          responseTimeText = `${minutes}m`;
        }
        
        embed.addFields([
          { name: 'Average Response Time', value: responseTimeText, inline: true }
        ]);
      }
      
      // Add status breakdown
      if (statusBreakdown.length > 0) {
        const statusInfo = statusBreakdown.map(item => {
          const status = item.action_type.replace('status_change_', '');
          return `${formatStatusName(status)}: ${item.count}`;
        }).join('\n');
        
        embed.addFields([
          { name: 'Status Changes Breakdown', value: statusInfo }
        ]);
      }
    }
    
    // Send the embed
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    logError('Staff Stats', `Error showing individual stats: ${error}`);
    throw error;
  }
}

/**
 * Show a leaderboard of staff ticket handling
 */
async function showLeaderboard(interaction: ChatInputCommandInteraction, timeframe: string, limit: number) {
  try {
    // Check if the table exists first
    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='ticket_staff_activity'
    `).get();
    
    if (!tableCheck) {
      // Table doesn't exist, handle gracefully
      const embed = new EmbedBuilder()
        .setTitle(`🏆 Staff Ticket Handling Leaderboard`)
        .setColor(Colors.PRIMARY)
        .setDescription('No ticket activity data has been recorded yet.')
        .setFooter({ text: 'Staff stats will be collected as staff interact with tickets' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      return;
    }
    
    // Create date filter based on timeframe
    let dateFilter = '';
    let dateLabel = '';
    
    switch (timeframe) {
      case 'today':
        dateFilter = "WHERE created_at >= date('now', 'start of day')";
        dateLabel = 'Today';
        break;
      case 'week':
        dateFilter = "WHERE created_at >= date('now', '-6 days')";
        dateLabel = 'This Week';
        break;
      case 'month':
        dateFilter = "WHERE created_at >= date('now', 'start of month')";
        dateLabel = 'This Month';
        break;
      default:
        dateFilter = '';
        dateLabel = 'All Time';
    }
    
    // Get guild filter
    const guildFilter = dateFilter 
      ? `AND guild_id = '${interaction.guildId}'` 
      : `WHERE guild_id = '${interaction.guildId}'`;
    
    // Get staff leaderboard
    const leaderboard = db.prepare(`
      SELECT 
        staff_id,
        COUNT(DISTINCT ticket_id) as total_tickets,
        COUNT(*) as total_actions,
        SUM(CASE WHEN action_type = 'message' THEN 1 ELSE 0 END) as messages
      FROM ticket_staff_activity
      ${dateFilter} ${guildFilter}
      GROUP BY staff_id
      ORDER BY total_tickets DESC, total_actions DESC
      LIMIT ?
    `).all(limit) as {
      staff_id: string;
      total_tickets: number;
      total_actions: number;
      messages: number;
    }[];
    
    // Create response embed
    const embed = new EmbedBuilder()
      .setTitle(`🏆 Staff Ticket Handling Leaderboard (${dateLabel})`)
      .setColor(Colors.PRIMARY)
      .setTimestamp();
    
    if (leaderboard.length === 0) {
      embed.setDescription('No staff activity data available for this timeframe.');
    } else {
      // Fetch user data for each staff member
      const staffEntries = [];
      
      for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i];
        let username = entry.staff_id;
        
        // Try to get the user from the cache or API
        try {
          const user = await interaction.client.users.fetch(entry.staff_id);
          username = user.username;
        } catch (error) {
          // If we can't get the user, use the ID
          logError('Staff Stats', `Error fetching user ${entry.staff_id}: ${error}`);
        }
        
        staffEntries.push({
          rank: i + 1,
          username,
          userId: entry.staff_id,
          tickets: entry.total_tickets,
          actions: entry.total_actions,
          messages: entry.messages
        });
      }
      
      // Format the leaderboard
      const leaderboardText = staffEntries.map(entry => {
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
        return `${medal} **${entry.username}**: ${entry.tickets} tickets, ${entry.messages} messages`;
      }).join('\n');
      
      embed.setDescription(leaderboardText);
      
      // Add footer note
      embed.setFooter({ text: `Showing top ${leaderboard.length} staff members` });
    }
    
    // Send the embed
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    logError('Staff Stats', `Error showing leaderboard: ${error}`);
    throw error;
  }
}

/**
 * Format a status code into a readable name
 */
function formatStatusName(status: string): string {
  switch (status) {
    case 'open': return '🟢 Open';
    case 'in_progress': return '🔵 In Progress';
    case 'on_hold': return '🟠 On Hold';
    case 'closed': return '🔴 Closed';
    case 'deleted': return '⚫ Deleted';
    default: return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  }
}

/**
 * Ensure the ticket_staff_activity table exists
 */
async function ensureTableExists() {
  try {
    // Check if the table exists
    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='ticket_staff_activity'
    `).get();
    
    if (!tableCheck) {
      logInfo('Staff Stats', 'Creating missing ticket_staff_activity table');
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
      logInfo('Staff Stats', 'Successfully created ticket_staff_activity table');
    }
  } catch (error) {
    logError('Staff Stats', `Error ensuring ticket_staff_activity table exists: ${error}`);
  }
} 