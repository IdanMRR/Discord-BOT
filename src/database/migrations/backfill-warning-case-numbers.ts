import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';
import { ModerationCaseService } from '../services/sqliteService';

/**
 * Migration to backfill case numbers for existing warnings
 * This creates moderation cases for old warnings that don't have case numbers
 */
export async function backfillWarningCaseNumbers(): Promise<void> {
  try {
    logInfo('Migration', 'Starting backfill of warning case numbers...');

    // Get all warnings without case numbers, ordered by creation date
    const warningsWithoutCases = db.prepare(`
      SELECT * FROM warnings 
      WHERE case_number IS NULL 
      ORDER BY created_at ASC
    `).all() as any[];

    if (warningsWithoutCases.length === 0) {
      logInfo('Migration', 'No warnings found without case numbers. Migration complete.');
      return;
    }

    logInfo('Migration', `Found ${warningsWithoutCases.length} warnings without case numbers`);

    let processedCount = 0;
    let errorCount = 0;

    // Process warnings by guild to maintain proper case numbering per guild
    const warningsByGuild = warningsWithoutCases.reduce((acc, warning) => {
      if (!acc[warning.guild_id]) {
        acc[warning.guild_id] = [];
      }
      acc[warning.guild_id].push(warning);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [guildId, guildWarnings] of Object.entries(warningsByGuild)) {
      const warnings = guildWarnings as any[];
      logInfo('Migration', `Processing ${warnings.length} warnings for guild ${guildId}`);

      for (const warning of warnings) {
        try {
          // Create a moderation case for this old warning
          const moderationCase = await ModerationCaseService.create({
            guild_id: warning.guild_id,
            action_type: 'Warning',
            user_id: warning.user_id,
            moderator_id: warning.moderator_id,
            reason: warning.reason || 'No reason provided',
            additional_info: `Backfilled case for legacy warning (ID: ${warning.id})`
          });

          if (moderationCase) {
            // Update the warning with the case number
            const updateStmt = db.prepare(`
              UPDATE warnings 
              SET case_number = ? 
              WHERE id = ?
            `);
            
            updateStmt.run(moderationCase.case_number, warning.id);
            processedCount++;
            
            logInfo('Migration', `Assigned case #${moderationCase.case_number} to warning ID ${warning.id}`);
          } else {
            logError('Migration', `Failed to create moderation case for warning ID ${warning.id}`);
            errorCount++;
          }
        } catch (error) {
          logError('Migration', `Error processing warning ID ${warning.id}: ${error}`);
          errorCount++;
        }
      }
    }

    logInfo('Migration', `Backfill complete. Processed: ${processedCount}, Errors: ${errorCount}`);
    
    if (errorCount > 0) {
      logError('Migration', `${errorCount} warnings could not be processed. Check logs for details.`);
    }

  } catch (error) {
    logError('Migration', `Error during warning case number backfill: ${error}`);
    throw error;
  }
}

/**
 * Check if backfill is needed
 */
export function needsWarningCaseBackfill(): boolean {
  try {
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM warnings 
      WHERE case_number IS NULL
    `).get() as { count: number };
    
    return result.count > 0;
  } catch (error) {
    logError('Migration', `Error checking if warning case backfill is needed: ${error}`);
    return false;
  }
}

/**
 * Get statistics about warning case numbers
 */
export function getWarningCaseStats(): { total: number; withCases: number; withoutCases: number } {
  try {
    const totalResult = db.prepare(`SELECT COUNT(*) as count FROM warnings`).get() as { count: number };
    const withCasesResult = db.prepare(`SELECT COUNT(*) as count FROM warnings WHERE case_number IS NOT NULL`).get() as { count: number };
    const withoutCasesResult = db.prepare(`SELECT COUNT(*) as count FROM warnings WHERE case_number IS NULL`).get() as { count: number };
    
    return {
      total: totalResult.count,
      withCases: withCasesResult.count,
      withoutCases: withoutCasesResult.count
    };
  } catch (error) {
    logError('Migration', `Error getting warning case stats: ${error}`);
    return { total: 0, withCases: 0, withoutCases: 0 };
  }
} 