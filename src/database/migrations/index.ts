import { logInfo, logError } from '../../utils/logger';
import { db } from '../sqlite';
import { migrateAddLanguageColumn } from './add_language_column';
import { migrateAddRulesChannelColumn } from './add_rules_channel_column';
import { migrate as migrateAddTemplatesColumns } from './add_templates_columns';
import { migrateAddWeatherChannelColumn } from './add_weather_channel_column';
import { migrate as migrateTicketActionLogs } from './ticket-action-logs';
import { migrateAddTicketLogsColumn } from './add_ticket_logs_column';
import { migrateAddRedAlertChannels } from './add_red_alert_channels';
import { up as migrateCreateLogChannelsTable } from './0002_create_log_channels_table';
import { addTicketNotesColumn } from './add-ticket-notes';
import { migrateAddUsersTable } from './add_users_table';
import { addTicketStaffActivityTable } from './004-add-ticket-staff-activity';
import { addActionTypeToStaffActivity } from './005-add-action-type-to-staff-activity';
import { addTicketTranscriptsTable } from './006-add-ticket-transcripts';
import { createTicketStaffActivityTable } from './add-ticket-staff-activity';
import { addTicketStatusMigration } from './add-ticket-status';
import { addTicketLastActivityColumn } from './add-ticket-last-activity';
import { addTicketCaseNumber } from './add-ticket-case-number';
import { addSoftDeleteColumn } from './add-soft-delete-column';
import { addDashboardLogsTable } from './007-add-dashboard-logs';
import { fixDmLogsTable } from './fix-dm-logs-table';
import { createDashboardPermissionsTable } from './add-dashboard-permissions';
import { addGiveawaysTable } from './add-giveaways';
import { addAutomodEscalation } from './add-automod-escalation';
import { addAnalyticsSystem } from './add-analytics-system';
import { addLoggingSettings } from './add-logging-settings';
import { addComprehensiveSettingsSystem } from './add-comprehensive-settings-system';

/**
 * Run all database migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    logInfo('Database', 'Running database migrations...');
    
    // Run migrations in order
    await migrateAddLanguageColumn();
    await migrateAddRulesChannelColumn();
    await migrateAddTemplatesColumns(db);
    await migrateAddWeatherChannelColumn();
    await migrateTicketActionLogs();
    await migrateAddTicketLogsColumn();
    await migrateAddRedAlertChannels();
    
    // Create log channels table if it doesn't exist
    try {
      migrateCreateLogChannelsTable(db);
      logInfo('Database Migration', 'Log channels table migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in log channels migration: ${error}`);
      throw error;
    }
    
    // Add notes column to tickets table
    try {
      await addTicketNotesColumn();
      logInfo('Database Migration', 'Ticket notes column migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in ticket notes migration: ${error}`);
      throw error;
    }
    
    // Add users table if it doesn't exist
    try {
      await migrateAddUsersTable();
      logInfo('Database Migration', 'Users table migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in users table migration: ${error}`);
      throw error;
    }

    // Add ticket status and last activity columns
    try {
      await addTicketStatusMigration();
      logInfo('Database Migration', 'Ticket status migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in ticket status migration: ${error}`);
      throw error;
    }

    // Add last activity column to tickets
    try {
      await addTicketLastActivityColumn();
      logInfo('Database Migration', 'Ticket last activity column migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in ticket last activity migration: ${error}`);
      throw error;
    }
    
    // Add ticket_staff_activity table if it doesn't exist (using both functions for compatibility)
    try {
      await addTicketStaffActivityTable();
      logInfo('Database Migration', 'Ticket staff activity table migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in ticket staff activity table migration: ${error}`);
      throw error;
    }

    // Create ticket staff activity table (alternative function)
    try {
      await createTicketStaffActivityTable();
      logInfo('Database Migration', 'Ticket staff activity table creation completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in ticket staff activity table creation: ${error}`);
      throw error;
    }
    
    // Add action_type column to ticket_staff_activity table
    try {
      await addActionTypeToStaffActivity();
      logInfo('Database Migration', 'Added action_type column to ticket_staff_activity table');
    } catch (error) {
      logError('Database Migration', `Error adding action_type column to ticket_staff_activity table: ${error}`);
      throw error;
    }
    
    // Add ticket_transcripts table if it doesn't exist
    try {
      await addTicketTranscriptsTable();
      logInfo('Database Migration', 'Ticket transcripts table migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in ticket transcripts table migration: ${error}`);
      throw error;
    }
    
    // Add ticket case number to tickets
    try {
      await addTicketCaseNumber();
      logInfo('Database Migration', 'Ticket case number migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in ticket case number migration: ${error}`);
      throw error;
    }
    
    // Add soft delete column to tickets
    try {
      await addSoftDeleteColumn();
      logInfo('Database Migration', 'Ticket soft delete column migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in ticket soft delete migration: ${error}`);
      throw error;
    }
    
    // Add dashboard logs table if it doesn't exist
    try {
      await addDashboardLogsTable();
      logInfo('Database Migration', 'Dashboard logs table migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in dashboard logs migration: ${error}`);
      throw error;
    }
    
    // Fix dm_logs table if it exists
    try {
      await fixDmLogsTable();
      logInfo('Database Migration', 'dm_logs table migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in dm_logs table migration: ${error}`);
      throw error;
    }
    
    // Create dashboard_permissions table if it doesn't exist
    try {
      await createDashboardPermissionsTable();
      logInfo('Database Migration', 'Dashboard permissions table migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in dashboard permissions migration: ${error}`);
      throw error;
    }
    
    // Add giveaways tables if they don't exist
    try {
      await addGiveawaysTable();
      logInfo('Database Migration', 'Giveaways tables migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in giveaways tables migration: ${error}`);
      throw error;
    }
    
    // Add automod escalation system tables if they don't exist
    try {
      addAutomodEscalation.up(db);
      logInfo('Database Migration', 'Automod escalation system migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in automod escalation migration: ${error}`);
      throw error;
    }
    
    // Add analytics system tables if they don't exist
    try {
      addAnalyticsSystem.up(db);
      logInfo('Database Migration', 'Analytics system migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in analytics system migration: ${error}`);
      throw error;
    }
    
    // Add logging settings table if it doesn't exist
    try {
      addLoggingSettings();
      logInfo('Database Migration', 'Logging settings table migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in logging settings migration: ${error}`);
      throw error;
    }
    
    // Add comprehensive settings system tables if they don't exist
    try {
      await addComprehensiveSettingsSystem();
      logInfo('Database Migration', 'Comprehensive settings system migration completed successfully');
    } catch (error) {
      logError('Database Migration', `Error in comprehensive settings system migration: ${error}`);
      throw error;
    }
    
    logInfo('Database', 'Database migrations completed successfully');
  } catch (error) {
    logError('Database', `Error running migrations: ${error}`);
    throw error;
  }
}
