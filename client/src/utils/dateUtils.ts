/**
 * Date utility functions for Israeli timezone formatting
 */

/**
 * Format a date string to Israeli timezone (Asia/Jerusalem)
 * @param dateString - ISO date string or any valid date string
 * @param options - Optional formatting options
 * @returns Formatted date string in Israeli time
 */
export const formatIsraeliDate = (
  dateString: string, 
  options: {
    includeSeconds?: boolean;
    includeDate?: boolean;
    includeTime?: boolean;
    relative?: boolean;
  } = {}
): string => {
  const {
    includeSeconds = true,
    includeDate = true,
    includeTime = true,
    relative = false
  } = options;

  try {
    // Handle SQLite timestamps which are in UTC but without timezone info
    let date: Date;
    if (dateString.includes('T') || dateString.includes('Z')) {
      // ISO format with timezone info
      date = new Date(dateString);
    } else {
      // SQLite format (YYYY-MM-DD HH:MM:SS) - treat as UTC
      date = new Date(dateString + 'Z'); // Add Z to indicate UTC
    }
    
    // If relative time is requested, show relative time for recent dates
    if (relative) {
      const now = new Date();
      const diffTime = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffTime / (1000 * 60));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) {
        return 'Now';
      } else if (diffMinutes < 60) {
        return `${diffMinutes} minutes ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hours ago`;
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      }
      // Fall through to full date format for older dates
    }

    // Build format options
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Jerusalem',
      hour12: false
    };

    if (includeDate) {
      formatOptions.year = 'numeric';
      formatOptions.month = '2-digit';
      formatOptions.day = '2-digit';
    }

    if (includeTime) {
      formatOptions.hour = '2-digit';
      formatOptions.minute = '2-digit';
      if (includeSeconds) {
        formatOptions.second = '2-digit';
      }
    }

    // Use English locale but with Israeli timezone
    return date.toLocaleString('en-GB', formatOptions);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

/**
 * Format date for dashboard logs with relative time for recent entries
 * Uses the same Israeli timezone handling as Warnings and Tickets pages
 */
export const formatDashboardLogDate = (dateString: string): string => {
  try {
    if (!dateString) {
      return 'Invalid date';
    }
    
    // Create a date object from the input string (same as Warnings/Tickets)
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    // Force the date to be interpreted as UTC (same as Warnings/Tickets)
    const utcYear = date.getUTCFullYear();
    const utcMonth = date.getUTCMonth();
    const utcDay = date.getUTCDate();
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const utcSeconds = date.getUTCSeconds();
    
    // Create a new date object with the UTC values
    const utcDate = new Date(Date.UTC(utcYear, utcMonth, utcDay, utcHours, utcMinutes, utcSeconds));
    
    // Add 3 hours for Israeli time (UTC+3) - same as Warnings/Tickets
    const israeliTime = new Date(utcDate.getTime() + (3 * 60 * 60 * 1000));
    
    // Get current Israeli time for comparison
    const now = new Date();
    const currentIsraeliTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    
    // Calculate time difference using Israeli timestamps
    const diffMs = currentIsraeliTime.getTime() - israeliTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Show relative time for recent entries
    if (diffMinutes < 1 && diffMs >= 0) {
      return 'Just now';
    } else if (diffMinutes < 60 && diffMs >= 0) {
      return `${diffMinutes} min ago`;
    } else if (diffHours < 24 && diffMs >= 0) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7 && diffMs >= 0) {
      return `${diffDays}d ago`;
    } else {
      // For older entries, format same as Warnings/Tickets (DD.MM.YYYY, HH:MM)
      const day = israeliTime.getDate().toString().padStart(2, '0');
      const month = (israeliTime.getMonth() + 1).toString().padStart(2, '0');
      const year = israeliTime.getFullYear();
      const hours = israeliTime.getHours().toString().padStart(2, '0');
      const minutes = israeliTime.getMinutes().toString().padStart(2, '0');
      
      return `${day}.${month}.${year}, ${hours}:${minutes}`;
    }
    
  } catch (error) {
    console.error('Error formatting date:', error, 'for dateString:', dateString);
    return 'Invalid date';
  }
};

/**
 * Format date with relative time for recent entries
 */
export const formatRelativeDate = (dateString: string): string => {
  return formatIsraeliDate(dateString, {
    includeSeconds: false,
    includeDate: true,
    includeTime: true,
    relative: true
  });
};

/**
 * Get current Israeli time
 */
export const getCurrentIsraeliTime = (): string => {
  return formatIsraeliDate(new Date().toISOString());
};

/**
 * Check if a date is today in Israeli timezone
 */
export const isToday = (dateString: string): boolean => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    
    // Convert both dates to Israeli timezone
    const israeliDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const israeliNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    
    return israeliDate.toDateString() === israeliNow.toDateString();
  } catch {
    return false;
  }
};

/**
 * Get Israeli timezone offset (for display purposes)
 */
export const getIsraeliTimezoneOffset = (): string => {
  const now = new Date();
  const israeliTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  
  const offsetMs = israeliTime.getTime() - utcTime.getTime();
  const offsetHours = Math.floor(offsetMs / (1000 * 60 * 60));
  
  return offsetHours >= 0 ? `UTC+${offsetHours}` : `UTC${offsetHours}`;
}; 