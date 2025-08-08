import Database from 'better-sqlite3';
import { logInfo, logError } from '../../utils/logger';

export const backfillDashboardWarningCaseNumbers = {
  name: 'backfill-dashboard-warning-case-numbers',
  up: (db: Database.Database) => {
    try {
      logInfo('Migration', 'Starting to backfill case numbers for dashboard warnings...');
      
      // Get all warnings that don't have case numbers
      const warningsWithoutCaseNumbers = db.prepare(`
        SELECT id, guild_id, user_id, moderator_id, created_at 
        FROM warnings 
        WHERE case_number IS NULL 
        ORDER BY guild_id, created_at ASC
      `).all();
      
      if (warningsWithoutCaseNumbers.length === 0) {
        logInfo('Migration', 'No warnings without case numbers found');
        return;
      }
      
      logInfo('Migration', `Found ${warningsWithoutCaseNumbers.length} warnings without case numbers`);
      
      // Group warnings by guild
      const warningsByGuild: Record<string, any[]> = warningsWithoutCaseNumbers.reduce((acc: Record<string, any[]>, warning: any) => {
        if (!acc[warning.guild_id]) {
          acc[warning.guild_id] = [];
        }
        acc[warning.guild_id].push(warning);
        return acc;
      }, {});
      
      // Process each guild
      for (const [guildId, guildWarnings] of Object.entries(warningsByGuild)) {
        // Get the current max case number for this guild
        const maxCaseResult = db.prepare(`
          SELECT MAX(case_number) as max_case 
          FROM warnings 
          WHERE guild_id = ?
        `).get(guildId) as { max_case: number | null };
        
        let nextCaseNumber = (maxCaseResult.max_case || 0) + 1;
        
        // Update each warning with a case number
        const updateStmt = db.prepare(`
          UPDATE warnings 
          SET case_number = ? 
          WHERE id = ?
        `);
        
        for (const warning of guildWarnings as any[]) {
          updateStmt.run(nextCaseNumber, warning.id);
          logInfo('Migration', `Updated warning ${warning.id} with case number ${nextCaseNumber}`);
          nextCaseNumber++;
        }
      }
      
      logInfo('Migration', 'Successfully backfilled case numbers for all warnings');
      
      // Also ensure moderation cases exist for warnings that were created via dashboard
      logInfo('Migration', 'Creating missing moderation cases for dashboard warnings...');
      
      const dashboardWarnings = db.prepare(`
        SELECT * FROM warnings 
        WHERE moderator_id = 'dashboard'
        ORDER BY guild_id, case_number ASC
      `).all();
      
      for (const warning of dashboardWarnings as any[]) {
        // Check if moderation case already exists
        const existingCase = db.prepare(`
          SELECT id FROM moderation_cases 
          WHERE guild_id = ? 
          AND case_number = ?
          AND action_type = 'Warning'
          AND user_id = ?
        `).get(warning.guild_id, warning.case_number, warning.user_id);
        
        if (!existingCase) {
          // Create moderation case
          db.prepare(`
            INSERT INTO moderation_cases 
            (guild_id, case_number, action_type, user_id, moderator_id, reason, additional_info, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            warning.guild_id,
            warning.case_number,
            'Warning',
            warning.user_id,
            warning.moderator_id,
            warning.reason,
            'Warning issued via Dashboard (backfilled)',
            warning.active ? 1 : 0,
            warning.created_at
          );
          
          logInfo('Migration', `Created moderation case for warning ${warning.id} (case #${warning.case_number})`);
        }
      }
      
      logInfo('Migration', 'Completed backfilling dashboard warning case numbers');
    } catch (error) {
      logError('Migration', `Error backfilling case numbers: ${error}`);
      throw error;
    }
  },
  
  down: (db: Database.Database) => {
    // This migration is not reversible as we're filling in missing data
    logInfo('Migration', 'This migration cannot be reversed');
  }
};

export default backfillDashboardWarningCaseNumbers;