import { logInfo, logError } from '../../utils/logger';
import { db } from '../sqlite';

export async function createDashboardPermissionsTable(): Promise<void> {
  try {
    logInfo('Migration', 'Creating dashboard_permissions table...');
    
    // Create the dashboard_permissions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS dashboard_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        permissions TEXT NOT NULL DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, guild_id)
      )
    `);
    
    // Create indexes for better performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_user_guild 
      ON dashboard_permissions(user_id, guild_id)
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_dashboard_permissions_guild 
      ON dashboard_permissions(guild_id)
    `);
    
    logInfo('Migration', 'Dashboard permissions table created successfully');
  } catch (error) {
    logError('Migration', `Error creating dashboard_permissions table: ${error}`);
    throw error;
  }
}

// Helper function to get dashboard permissions for a user
export function getDashboardPermissions(userId: string, guildId: string): string[] {
  try {
    logInfo('DashboardPermissions', `Getting permissions for user ${userId} in guild ${guildId}`);
    
    const stmt = db.prepare('SELECT permissions FROM dashboard_permissions WHERE user_id = ? AND guild_id = ?');
    const result = stmt.get(userId, guildId) as { permissions: string } | undefined;
    
    if (result) {
      const permissions = JSON.parse(result.permissions || '[]');
      logInfo('DashboardPermissions', `Found permissions for user ${userId}: ${permissions.join(', ')}`);
      return permissions;
    }
    
    logInfo('DashboardPermissions', `No permissions found for user ${userId} in guild ${guildId}`);
    return [];
  } catch (error) {
    logError('DashboardPermissions', `Error getting dashboard permissions for user ${userId} in guild ${guildId}: ${error}`);
    return [];
  }
}

// Helper function to save dashboard permissions for a user
export function saveDashboardPermissions(userId: string, guildId: string, permissions: string[]): void {
  try {
    const permissionsJson = JSON.stringify(permissions);
    
    logInfo('DashboardPermissions', `Saving permissions for user ${userId} in guild ${guildId}: ${permissions.join(', ')}`);
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO dashboard_permissions (user_id, guild_id, permissions, updated_at) 
      VALUES (?, ?, ?, datetime('now'))
    `);
    
    const result = stmt.run(userId, guildId, permissionsJson);
    logInfo('DashboardPermissions', `Successfully saved permissions for user ${userId}. Rows affected: ${result.changes}`);
  } catch (error) {
    logError('DashboardPermissions', `Error saving dashboard permissions for user ${userId} in guild ${guildId}: ${error}`);
    throw error;
  }
}

// Helper function to get all users with dashboard permissions in a guild
export function getAllDashboardPermissions(guildId: string): Array<{ user_id: string; permissions: string[] }> {
  try {
    const stmt = db.prepare("SELECT user_id, permissions FROM dashboard_permissions WHERE guild_id = ? AND permissions != '[]'");
    const results = stmt.all(guildId) as Array<{ user_id: string; permissions: string }>;
    
    logInfo('DashboardPermissions', `Found ${results.length} users with permissions in guild ${guildId}`);
    
    return results.map(row => ({
      user_id: row.user_id,
      permissions: JSON.parse(row.permissions || '[]')
    }));
  } catch (error) {
    logError('DashboardPermissions', `Error getting all dashboard permissions: ${error}`);
    return [];
  }
}

// Export the migration function for the migration system
export default createDashboardPermissionsTable; 