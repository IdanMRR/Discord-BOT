import { logInfo, logError } from '../../utils/logger';
import { db } from '../sqlite';
import { migrateAddLanguageColumn } from './add_language_column';
import { migrateAddRulesChannelColumn } from './add_rules_channel_column';
import { migrate as migrateAddTemplatesColumns } from './add_templates_columns';
import { migrateAddWeatherChannelColumn } from './add_weather_channel_column';

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
    
    logInfo('Database', 'Database migrations completed successfully');
  } catch (error) {
    logError('Database', `Error running migrations: ${error}`);
    throw error;
  }
}
