/**
 * Utility functions for formatting time in Israeli timezone (UTC+3)
 */

/**
 * Get Israeli time from any date
 * @param date The date to convert (defaults to current time)
 * @returns Date object representing Israeli time
 */
export function getIsraeliTime(date: Date = new Date()): Date {
  // Convert to Israeli timezone (UTC+3)
  const israeliTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  return israeliTime;
}

/**
 * Format a date in Israeli format (DD/MM/YYYY, HH:MM)
 * 
 * @param date The date to format (defaults to current Israeli time)
 * @returns The formatted date string
 */
export function formatIsraeliDate(date: Date = new Date()): string {
  const israeliTime = getIsraeliTime(date);
  
  // Format date as DD/MM/YYYY, HH:MM (Israeli format)
  const day = israeliTime.getDate().toString().padStart(2, '0');
  const month = (israeliTime.getMonth() + 1).toString().padStart(2, '0');
  const year = israeliTime.getFullYear();
  const hours = israeliTime.getHours().toString().padStart(2, '0');
  const minutes = israeliTime.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

/**
 * Format a time in Israeli format (HH:MM) - for Discord footers
 * 
 * @param date The date to format (defaults to current Israeli time)
 * @returns The formatted time string (HH:MM)
 */
export function formatIsraeliTime(date: Date = new Date()): string {
  const israeliTime = getIsraeliTime(date);
  
  // Format time as HH:MM (24-hour format)
  const hours = israeliTime.getHours().toString().padStart(2, '0');
  const minutes = israeliTime.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Format Israeli date and time for database logs (DD.MM.YYYY HH:MM:SS)
 * 
 * @param date The date to format (defaults to current Israeli time)
 * @returns The formatted date and time string
 */
export function formatIsraeliDateTime(date: Date = new Date()): string {
  const israeliTime = getIsraeliTime(date);
  
  const day = israeliTime.getDate().toString().padStart(2, '0');
  const month = (israeliTime.getMonth() + 1).toString().padStart(2, '0');
  const year = israeliTime.getFullYear();
  const hours = israeliTime.getHours().toString().padStart(2, '0');
  const minutes = israeliTime.getMinutes().toString().padStart(2, '0');
  const seconds = israeliTime.getSeconds().toString().padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format Israeli date for ticket transcripts (DD/MM/YYYY at HH:MM)
 * 
 * @param date The date to format (defaults to current Israeli time)
 * @returns The formatted date string
 */
export function formatIsraeliDateForTranscript(date: Date = new Date()): string {
  const israeliTime = getIsraeliTime(date);
  
  const day = israeliTime.getDate().toString().padStart(2, '0');
  const month = (israeliTime.getMonth() + 1).toString().padStart(2, '0');
  const year = israeliTime.getFullYear();
  const hours = israeliTime.getHours().toString().padStart(2, '0');
  const minutes = israeliTime.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} at ${hours}:${minutes}`;
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
  const now = getIsraeliTime();
  const israeliDate = getIsraeliTime(date);
  
  const diffMs = now.getTime() - israeliDate.getTime();
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
