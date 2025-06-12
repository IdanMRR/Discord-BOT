/**
 * Utility functions to validate Discord user IDs and handle invalid IDs gracefully
 */

/**
 * Checks if a user ID is a valid Discord snowflake
 * Discord snowflakes are numeric strings of a certain length
 */
export function isValidDiscordId(id: string | undefined | null): boolean {
  if (!id) return false;
  
  // Discord IDs are numeric strings (snowflakes)
  // They should be digits only and typically 17-20 digits long
  return /^\d{17,20}$/.test(id);
}

/**
 * Safely formats a user ID for display, handling invalid IDs
 */
export function safeUserIdDisplay(id: string | undefined | null): string {
  if (!id) return 'Unknown';
  
  // Filter out known invalid IDs
  if (id === '_soill_' || id.includes('_soill_')) {
    return 'Unknown User';
  }
  
  // Check if it's a valid Discord ID
  if (!isValidDiscordId(id)) {
    return 'Unknown User';
  }
  
  // For valid IDs, show the last 4 digits
  return `User#${id.slice(-4)}`;
}
