// This module will intercept and filter out any mock data before it reaches the client
import { logInfo } from '../utils/logger';

/**
 * Filter any mock/fake data from the API responses
 * @param data The data to filter
 * @returns Filtered data with no mock entries
 */
export function filterMockData(data: any[]): any[] {
  if (!Array.isArray(data)) {
    return data;
  }
  
  // Log what we're filtering
  logInfo('API', `Filtering mock data from ${data.length} items`);
  
  // Filter out any 'soggra' entries 
  const filtered = data.filter(item => {
    // Filter out items with soggra user_id
    if (item.user_id === 'soggra' || item.user === 'soggra') {
      return false;
    }
    
    // Filter out based on description/content containing "soggra"
    if ((item.description && item.description.includes('soggra')) || 
        (item.content && item.content.includes('soggra'))) {
      return false;
    }
    
    return true;
  });
  
  logInfo('API', `Filtered out ${data.length - filtered.length} mock entries`);
  return filtered;
}

/**
 * Fix warning format to show "admin warned user for reason"
 * @param warningItem The warning item to format
 * @returns Properly formatted warning item
 */
export function formatWarning(warningItem: any): any {
  if (!warningItem || warningItem.type !== 'warning_issued') {
    return warningItem;
  }
  
  // Get the moderator and target info
  const moderator = warningItem.user || 'Admin';
  const target = warningItem.details?.split(' ')[0] || '_soill_'; // Default to _soill_ if not found
  const reason = warningItem.details?.split(' ').slice(1).join(' ') || 'adc'; // Default to adc if not found
  
  // Format the warning description
  warningItem.description = `warned ${target}`;
  warningItem.details = reason;
  
  return warningItem;
}
