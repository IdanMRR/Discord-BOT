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
 * Based on the working GitHub implementation
 */
export const formatDashboardLogDate = (dateString: string): string => {
  try {
    if (!dateString || dateString.trim() === '' || dateString === 'null' || dateString === 'undefined') {
      return 'Recently';
    }
    
    let date: Date;
    
    // Handle formatted timestamps from backend (DD/MM/YYYY, HH:mm:ss) - already in Israeli timezone
    if (dateString.match(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}$/)) {
      const [datePart, timePart] = dateString.split(', ');
      const [day, month, year] = datePart.split('/');
      
      // Create date object - months are 0-indexed in JavaScript
      // Important: treat this as local time (already in Israeli timezone)
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                     parseInt(timePart.split(':')[0]), 
                     parseInt(timePart.split(':')[1]), 
                     parseInt(timePart.split(':')[2]));
    }
    // Handle Hebrew/Israeli locale timestamps (DD.MM.YYYY, HH:mm:ss) 
    else if (dateString.match(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}$/)) {
      const [datePart, timePart] = dateString.split(', ');
      const [day, month, year] = datePart.split('.');
      
      // Create date object - months are 0-indexed in JavaScript
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                     parseInt(timePart.split(':')[0]), 
                     parseInt(timePart.split(':')[1]), 
                     parseInt(timePart.split(':')[2]));
    } 
    // Handle numeric timestamps
    else if (!isNaN(Number(dateString)) && dateString.length > 10) {
      date = new Date(Number(dateString));
    } 
    // Handle ISO format
    else if (dateString.includes('T') || dateString.includes('Z')) {
      date = new Date(dateString);
    } 
    // Handle SQLite format - treat as UTC
    else if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      date = new Date(dateString + 'Z');
    } 
    // Generic fallback
    else {
      date = new Date(dateString);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return 'Recently';
    }
    
    const now = new Date();
    
    // If the date is from an Israeli formatted string, adjust for timezone comparison
    let adjustedDate = date;
    if (dateString.match(/^\d{2}[/.]\d{2}[/.]\d{4}, \d{2}:\d{2}:\d{2}$/)) {
      // The backend already added +3 hours, so we need to subtract them for proper comparison
      // since the browser's "now" is in local time
      const israeliOffset = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
      const browserOffset = now.getTimezoneOffset() * 60 * 1000; // Browser timezone offset
      adjustedDate = new Date(date.getTime() - israeliOffset + browserOffset);
    }
    
    const diffTime = now.getTime() - adjustedDate.getTime();
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Debug logging
    console.log('Date parsing debug:', {
      original: dateString,
      parsed: date.toISOString(),
      adjusted: adjustedDate.toISOString(),
      now: now.toISOString(),
      diffMinutes,
      diffHours,
      diffDays
    });

    // Show relative time for recent entries
    if (diffMinutes < 1 && diffTime >= 0) {
      return 'Just now';
    } else if (diffMinutes < 60 && diffTime >= 0) {
      return `${diffMinutes} min ago`;
    } else if (diffHours < 24 && diffTime >= 0) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7 && diffTime >= 0) {
      return `${diffDays}d ago`;
    } else {
      // For older entries, show the formatted timestamp as-is since it's already in Israeli timezone
      if (dateString.match(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}$/)) {
        return dateString; // Already formatted properly in Israeli time
      }
      
      // For other formats, convert to Israeli timezone
      return date.toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jerusalem'
      });
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