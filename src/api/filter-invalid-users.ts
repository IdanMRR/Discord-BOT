/**
 * Utility functions for filtering out invalid user IDs from API responses
 * Specifically targets problematic IDs like "_soill_" that cause errors
 */

/**
 * Checks if a user ID is valid (i.e., a Discord snowflake)
 */
export function isValidUserId(id: string | undefined | null): boolean {
  if (!id) return false;
  if (id === '_soill_') return false;
  if (typeof id === 'string' && id.includes('_soill_')) return false;
  
  // Special case for dashboard system
  if (id === 'dashboard') return true;
  
  return /^\d{17,20}$/.test(id);
}

/**
 * Filters out activities with invalid user IDs
 */
export function filterInvalidUserActivities<T extends { user_id?: string }>(activities: T[]): T[] {
  return activities.filter(activity => {
    if (!activity.user_id) return true; // Keep items without user_id
    return isValidUserId(activity.user_id);
  });
}

/**
 * Provides a fallback for missing or invalid user names
 */
export function getSafeUserName(userId: string | undefined | null, fallback: string = 'Unknown User'): string {
  if (!isValidUserId(userId)) {
    return fallback;
  }
  return userId as string; // This will typically be replaced with the actual username
}

/**
 * Log helper for invalid user IDs
 */
export function logInvalidUserId(id: string | undefined | null, context: string = ''): void {
  if (!isValidUserId(id)) {
    console.log(`Invalid user_id format${context ? ' in ' + context : ''}: ${id}`);
  }
}
