import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

export interface ServerAnalytics {
  id?: number;
  guild_id: string;
  metric_type: 'message_count' | 'command_usage' | 'member_join' | 'member_leave' | 'voice_activity' | 'reaction_count';
  channel_id?: string;
  user_id?: string;
  command_name?: string;
  value?: number;
  metadata?: string;
  created_at?: string;
}

export interface DailyServerStats {
  id?: number;
  guild_id: string;
  date: string;
  total_messages: number;
  total_members: number;
  active_members: number;
  total_commands: number;
  peak_online: number;
  voice_minutes: number;
  reactions_given: number;
  new_members: number;
  left_members: number;
  created_at?: string;
  updated_at?: string;
}

export interface HourlyActivity {
  id?: number;
  guild_id: string;
  hour: number;
  date: string;
  message_count: number;
  command_count: number;
  voice_users: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChannelAnalytics {
  id?: number;
  guild_id: string;
  channel_id: string;
  channel_name: string;
  channel_type: string;
  date: string;
  message_count: number;
  unique_users: number;
  voice_minutes: number;
  created_at?: string;
  updated_at?: string;
}

export interface CommandAnalytics {
  id?: number;
  guild_id: string;
  command_name: string;
  user_id: string;
  channel_id: string;
  success: boolean;
  execution_time?: number;
  error_message?: string;
  created_at?: string;
}

export interface MemberEngagement {
  id?: number;
  guild_id: string;
  user_id: string;
  date: string;
  messages_sent: number;
  commands_used: number;
  reactions_given: number;
  voice_minutes: number;
  first_message_time?: string;
  last_message_time?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ServerHealth {
  id?: number;
  guild_id: string;
  timestamp?: string;
  member_count: number;
  online_count: number;
  bot_latency?: number;
  api_response_time?: number;
  memory_usage?: number;
  cpu_usage?: number;
  uptime?: number;
  error_count: number;
}

export class AnalyticsService {
  
  // Track individual activities
  static async trackActivity(data: ServerAnalytics): Promise<void> {
    try {
      const stmt = db.prepare(`
        INSERT INTO server_analytics 
        (guild_id, metric_type, channel_id, user_id, command_name, value, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        data.guild_id,
        data.metric_type,
        data.channel_id || null,
        data.user_id || null,
        data.command_name || null,
        data.value || 1,
        data.metadata || null
      );
      
      // Also update daily stats
      await this.updateDailyStats(data.guild_id, data.metric_type, data.value || 1);
      
      // Update hourly activity
      await this.updateHourlyActivity(data.guild_id, data.metric_type, data.value || 1);
      
    } catch (error) {
      logError('AnalyticsService', `Error tracking activity: ${error}`);
      throw error;
    }
  }

  // Update daily statistics
  static async updateDailyStats(guildId: string, metricType: string, value: number = 1): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const column = this.getDailyStatColumn(metricType);
      
      const sql = `
        INSERT INTO daily_server_stats (guild_id, date, ${column})
        VALUES (?, ?, ?)
        ON CONFLICT(guild_id, date) DO UPDATE SET
        ${column} = ${column} + ?,
        updated_at = CURRENT_TIMESTAMP
      `;
      
      const stmt = db.prepare(sql);
      stmt.run(guildId, today, value, value);
      
    } catch (error) {
      logError('AnalyticsService', `Error updating daily stats: ${error}`);
    }
  }

  // Update hourly activity
  static async updateHourlyActivity(guildId: string, metricType: string, value: number = 1): Promise<void> {
    try {
      const now = new Date();
      const hour = now.getHours();
      const date = now.toISOString().split('T')[0];
      
      const column = metricType === 'message_count' ? 'message_count' : 'command_count';
      
      const sql = `
        INSERT INTO hourly_activity (guild_id, hour, date, ${column})
        VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id, date, hour) DO UPDATE SET
        ${column} = ${column} + ?,
        updated_at = CURRENT_TIMESTAMP
      `;
      
      const stmt = db.prepare(sql);
      stmt.run(guildId, hour, date, value, value);
      
    } catch (error) {
      logError('AnalyticsService', `Error updating hourly activity: ${error}`);
    }
  }

  // Track command usage
  static async trackCommand(data: CommandAnalytics): Promise<void> {
    try {
      const stmt = db.prepare(`
        INSERT INTO command_analytics 
        (guild_id, command_name, user_id, channel_id, success, execution_time, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        data.guild_id,
        data.command_name,
        data.user_id,
        data.channel_id,
        data.success ? 1 : 0,
        data.execution_time || null,
        data.error_message || null
      );
      
      // Track as general activity
      await this.trackActivity({
        guild_id: data.guild_id,
        metric_type: 'command_usage',
        channel_id: data.channel_id,
        user_id: data.user_id,
        command_name: data.command_name,
        value: 1
      });
      
    } catch (error) {
      logError('AnalyticsService', `Error tracking command: ${error}`);
      throw error;
    }
  }

  // Record server health metrics
  static async recordServerHealth(data: ServerHealth): Promise<void> {
    try {
      const stmt = db.prepare(`
        INSERT INTO server_health 
        (guild_id, member_count, online_count, bot_latency, api_response_time, memory_usage, cpu_usage, uptime, error_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        data.guild_id,
        data.member_count,
        data.online_count,
        data.bot_latency || null,
        data.api_response_time || null,
        data.memory_usage || null,
        data.cpu_usage || null,
        data.uptime || null,
        data.error_count
      );
      
    } catch (error) {
      logError('AnalyticsService', `Error recording server health: ${error}`);
      throw error;
    }
  }

  // Get server overview stats
  static async getServerOverview(guildId: string, days: number = 7): Promise<any> {
    try {
      const stmt = db.prepare(`
        SELECT 
          SUM(total_messages) as total_messages,
          AVG(total_members) as avg_members,
          SUM(total_commands) as total_commands,
          MAX(peak_online) as peak_online,
          SUM(new_members) as new_members,
          SUM(left_members) as left_members,
          SUM(voice_minutes) as voice_minutes,
          SUM(reactions_given) as reactions_given
        FROM daily_server_stats 
        WHERE guild_id = ? AND date >= date('now', '-' || ? || ' days')
      `);
      
      const overview = stmt.get(guildId, days) as any;
      
      // Get current online count
      const healthStmt = db.prepare(`
        SELECT online_count, member_count
        FROM server_health 
        WHERE guild_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `);
      
      const health = healthStmt.get(guildId) as { online_count?: number; member_count?: number } | undefined;
      
      return {
        ...(overview || {}),
        current_online: health?.online_count || 0,
        current_members: health?.member_count || 0
      };
      
    } catch (error) {
      logError('AnalyticsService', `Error getting server overview: ${error}`);
      throw error;
    }
  }

  // Get hourly activity patterns
  static async getHourlyActivity(guildId: string, days: number = 7): Promise<HourlyActivity[]> {
    try {
      const stmt = db.prepare(`
        SELECT 
          hour,
          AVG(message_count) as avg_messages,
          AVG(command_count) as avg_commands,
          AVG(voice_users) as avg_voice_users
        FROM hourly_activity 
        WHERE guild_id = ? AND date >= date('now', '-' || ? || ' days')
        GROUP BY hour
        ORDER BY hour
      `);
      
      return stmt.all(guildId, days) as HourlyActivity[];
      
    } catch (error) {
      logError('AnalyticsService', `Error getting hourly activity: ${error}`);
      throw error;
    }
  }

  // Get top channels by activity
  static async getTopChannels(guildId: string, days: number = 7, limit: number = 10): Promise<ChannelAnalytics[]> {
    try {
      const stmt = db.prepare(`
        SELECT 
          channel_id,
          channel_name,
          channel_type,
          SUM(message_count) as total_messages,
          COUNT(DISTINCT date) as active_days,
          AVG(unique_users) as avg_users
        FROM channel_analytics 
        WHERE guild_id = ? AND date >= date('now', '-' || ? || ' days')
        GROUP BY channel_id, channel_name, channel_type
        ORDER BY total_messages DESC
        LIMIT ?
      `);
      
      return stmt.all(guildId, days, limit) as ChannelAnalytics[];
      
    } catch (error) {
      logError('AnalyticsService', `Error getting top channels: ${error}`);
      throw error;
    }
  }

  // Get command usage statistics
  static async getCommandStats(guildId: string, days: number = 7): Promise<any[]> {
    try {
      const stmt = db.prepare(`
        SELECT 
          command_name,
          COUNT(*) as usage_count,
          AVG(execution_time) as avg_execution_time,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count
        FROM command_analytics 
        WHERE guild_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY command_name
        ORDER BY usage_count DESC
      `);
      
      return stmt.all(guildId, days);
      
    } catch (error) {
      logError('AnalyticsService', `Error getting command stats: ${error}`);
      throw error;
    }
  }

  // Get member engagement data
  static async getMemberEngagement(guildId: string, days: number = 7): Promise<any> {
    try {
      const stmt = db.prepare(`
        SELECT 
          COUNT(DISTINCT user_id) as active_members,
          AVG(messages_sent) as avg_messages_per_member,
          AVG(commands_used) as avg_commands_per_member,
          AVG(voice_minutes) as avg_voice_per_member,
          MAX(messages_sent) as most_messages,
          MAX(voice_minutes) as most_voice_time
        FROM member_engagement 
        WHERE guild_id = ? AND date >= date('now', '-' || ? || ' days')
      `);
      
      return stmt.get(guildId, days);
      
    } catch (error) {
      logError('AnalyticsService', `Error getting member engagement: ${error}`);
      throw error;
    }
  }

  // Get server health history
  static async getServerHealthHistory(guildId: string, hours: number = 24): Promise<ServerHealth[]> {
    try {
      const stmt = db.prepare(`
        SELECT *
        FROM server_health 
        WHERE guild_id = ? AND timestamp >= datetime('now', '-' || ? || ' hours')
        ORDER BY timestamp DESC
      `);
      
      return stmt.all(guildId, hours) as ServerHealth[];
      
    } catch (error) {
      logError('AnalyticsService', `Error getting server health history: ${error}`);
      throw error;
    }
  }

  // Update channel analytics
  static async updateChannelAnalytics(guildId: string, channelId: string, channelName: string, channelType: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const stmt = db.prepare(`
        INSERT INTO channel_analytics (guild_id, channel_id, channel_name, channel_type, date, message_count, unique_users)
        VALUES (?, ?, ?, ?, ?, 1, 1)
        ON CONFLICT(guild_id, channel_id, date) DO UPDATE SET
        message_count = message_count + 1,
        updated_at = CURRENT_TIMESTAMP
      `);
      
      stmt.run(guildId, channelId, channelName, channelType, today);
      
    } catch (error) {
      logError('AnalyticsService', `Error updating channel analytics: ${error}`);
    }
  }

  // Helper method to get the correct column name for daily stats
  private static getDailyStatColumn(metricType: string): string {
    switch (metricType) {
      case 'message_count': return 'total_messages';
      case 'command_usage': return 'total_commands';
      case 'member_join': return 'new_members';
      case 'member_leave': return 'left_members';
      case 'voice_activity': return 'voice_minutes';
      case 'reaction_count': return 'reactions_given';
      default: return 'total_messages';
    }
  }

  // Clean old analytics data (keep last N days)
  static async cleanOldData(daysToKeep: number = 90): Promise<void> {
    try {
      const tables = [
        'server_analytics',
        'daily_server_stats', 
        'hourly_activity',
        'channel_analytics',
        'command_analytics',
        'member_engagement',
        'server_health'
      ];

      for (const table of tables) {
        const stmt = db.prepare(`
          DELETE FROM ${table} 
          WHERE created_at < datetime('now', '-' || ? || ' days')
        `);
        
        const result = stmt.run(daysToKeep);
        logInfo('AnalyticsService', `Cleaned ${result.changes} old records from ${table}`);
      }
      
    } catch (error) {
      logError('AnalyticsService', `Error cleaning old data: ${error}`);
      throw error;
    }
  }

  // Export analytics data to JSON
  static async exportData(guildId: string, days: number = 30): Promise<any> {
    try {
      const overview = await this.getServerOverview(guildId, days);
      const hourlyActivity = await this.getHourlyActivity(guildId, days);
      const topChannels = await this.getTopChannels(guildId, days);
      const commandStats = await this.getCommandStats(guildId, days);
      const engagement = await this.getMemberEngagement(guildId, days);
      const healthHistory = await this.getServerHealthHistory(guildId, days * 24);

      return {
        guild_id: guildId,
        period_days: days,
        exported_at: new Date().toISOString(),
        overview,
        hourly_activity: hourlyActivity,
        top_channels: topChannels,
        command_stats: commandStats,
        member_engagement: engagement,
        health_history: healthHistory
      };
      
    } catch (error) {
      logError('AnalyticsService', `Error exporting data: ${error}`);
      throw error;
    }
  }
}

export default AnalyticsService;