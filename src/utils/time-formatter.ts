/**
 * Utility functions for formatting time in Israeli format
 */

/**
 * Format a date in Israeli format (DD/MM/YYYY, HH:MM)
 * 
 * @param date The date to format
 * @returns The formatted date string
 */
export function formatIsraeliDate(date: Date = new Date()): string {
  // Format date as DD/MM/YYYY, HH:MM (Israeli format)
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

/**
 * Format a time in Israeli format (HH:MM)
 * 
 * @param date The date to format
 * @returns The formatted time string
 */
export function formatIsraeliTime(date: Date = new Date()): string {
  // Format time as HH:MM (24-hour format)
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Format a relative time (e.g., "3 hours ago")
 * This uses proper Israeli time formatting
 * 
 * @param timestamp The timestamp to format
 * @returns The formatted relative time string
 */
export function formatRelativeTime(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffDay > 0) {
    return diffDay === 1 ? 'yesterday' : `${diffDay} days ago`;
  } else if (diffHour > 0) {
    return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
  } else if (diffMin > 0) {
    return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  } else {
    return 'just now';
  }
}

/**
 * Format a timestamp for Discord
 * 
 * @param timestamp The timestamp to format
 * @param format The format to use (t = short time, T = long time, d = short date, D = long date, f = short date/time, F = long date/time, R = relative)
 * @returns The formatted timestamp string for Discord
 */
export function formatDiscordTimestamp(timestamp: number | Date, format: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'f'): string {
  const unixTimestamp = Math.floor((timestamp instanceof Date ? timestamp.getTime() : timestamp) / 1000);
  return `<t:${unixTimestamp}:${format}>`;
}
