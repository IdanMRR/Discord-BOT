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
 */
export const formatDashboardLogDate = (dateString: string): string => {
  try {
    // Handle different date formats more robustly
    let date: Date;
    
    if (!dateString) {
      return 'Invalid date';
    }
    
    // Convert to ISO format if needed
    if (dateString.includes('T') || dateString.includes('Z')) {
      // Already in ISO format
      date = new Date(dateString);
    } else if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      // SQLite format (YYYY-MM-DD HH:MM:SS) - treat as UTC
      date = new Date(dateString + 'Z');
    } else {
      // Try to parse as-is
      date = new Date(dateString);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    // Calculate time difference using UTC timestamps (much simpler and accurate)
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    // Show relative time for recent entries (within 24 hours)
    if (diffMinutes < 1 && diffMs >= 0) {
      return 'Just now';
    } else if (diffMinutes < 60 && diffMs >= 0) {
      return `${diffMinutes} min ago`;
    } else if (diffHours < 24 && diffMs >= 0) {
      return `${diffHours}h ago`;
    } else {
      // For older entries, show full date in Israeli timezone
      return date.toLocaleString('en-GB', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }
    
  } catch (error) {
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