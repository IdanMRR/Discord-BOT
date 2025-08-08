import { Client } from 'discord.js';
import { isValidUserId } from './filter-invalid-users';

// Cache to store usernames and avoid duplicate API calls
const usernameCache = new Map<string, string>();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get a user's name from Discord, with fallback handling
 */
async function getUserName(client: Client | null, userId: string | undefined | null): Promise<string> {
  try {
    if (!client) {
      return 'Unknown User';
    }

    if (!userId || !isValidUserId(userId)) {
      return 'Unknown User';
    }
    
    // Special case for dashboard moderator
    if (userId === 'dashboard') {
      return 'Dashboard';
    }
    
    // Check cache first to avoid duplicate API calls
    if (usernameCache.has(userId)) {
      return usernameCache.get(userId) as string;
    }
    
    // Only log if we're not in a high-volume context
    // We'll keep this commented out to reduce console spam
    // console.log(`[getUserName] Fetching username for user ID: ${userId}`);

    // First try to fetch directly from Discord API (most reliable)
    try {
      const user = await client.users.fetch(userId);
      if (user) {
        // console.log(`[getUserName] Successfully fetched user ${userId} from API: ${user.username}`);
        // Cache the result
        usernameCache.set(userId, user.username);
        
        // Set a timeout to clear this cache entry after the expiry time
        setTimeout(() => {
          usernameCache.delete(userId);
        }, CACHE_EXPIRY);
        
        return user.username;
      }
    } catch (apiError) {
      // console.log(`[getUserName] Failed to fetch user ${userId} from Discord API, trying other methods`);
    }

    // Try client users cache
    const cachedUser = client.users.cache.get(userId);
    if (cachedUser) {
      // console.log(`[getUserName] Found user ${userId} in cache: ${cachedUser.username}`);
      return cachedUser.username;
    }

    // Try to fetch from each guild the bot is in
    for (const [guildId, guild] of client.guilds.cache) {
      try {
        // console.log(`[getUserName] Trying to fetch user ${userId} from guild ${guild.name} (${guildId})`);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          // console.log(`[getUserName] Found user ${userId} in guild ${guild.name}: ${member.user.username}`);
          return member.user.username;
        }
      } catch (err) {
        // console.log(`[getUserName] Failed to fetch user ${userId} from guild ${guild.name}`);
        // Continue to next guild
      }
    }

    // If we still don't have a username, try one more time with REST API
    try {
      // console.log(`[getUserName] Making final attempt to fetch user ${userId} with REST API`);
      const restUser = await client.rest.get(`/users/${userId}`) as any;
      if (restUser && typeof restUser === 'object' && 'username' in restUser) {
        // console.log(`[getUserName] Successfully fetched user ${userId} with REST API: ${restUser.username}`);
        return restUser.username;
      }
    } catch (restError) {
      // console.log(`[getUserName] Failed to fetch user ${userId} with REST API`);
    }

    // If we've tried everything and still don't have a username, use the ID as fallback
    // console.log(`[getUserName] Could not find username for user ID: ${userId}, using ID as fallback`);
    const fallbackName = `User ${userId.slice(0, 6)}...`;
    
    // Cache the fallback result too
    usernameCache.set(userId, fallbackName);
    
    // Set a timeout to clear this cache entry after the expiry time
    setTimeout(() => {
      usernameCache.delete(userId);
    }, CACHE_EXPIRY);
    
    return fallbackName;
  } catch (error) {
    // Only log critical errors
    // console.error(`[getUserName] Error getting username for ${userId}:`, error);
    return `User ${userId ? userId.slice(0, 6) + '...' : 'Unknown'}`;
  }
}

/**
 * Warning format: "Case #0001: (admin nickname) warned (warned user) - reason"
 */
async function formatWarning(
  client: Client | null, 
  moderatorId: string | undefined | null, 
  targetUserId: string | undefined | null, 
  reason: string,
  caseNumber?: number
): Promise<string> {
  // Ensure we have a client
  if (!client) {
    const caseStr = caseNumber ? `Case #${String(caseNumber).padStart(4, '0')}: ` : '';
    return `${caseStr}Warning issued to user - ${reason}`;
  }
  
  // Get admin name with priority
  let adminName = 'Unknown Admin';
  if (moderatorId && isValidUserId(moderatorId)) {
    try {
      // Try direct fetch first for admin
      const admin = await client.users.fetch(moderatorId).catch(() => null);
      if (admin) {
        adminName = admin.username;
      } else {
        // Fallback to getUserName
        adminName = await getUserName(client, moderatorId);
      }
    } catch (error) {
      adminName = `Admin ${moderatorId.slice(0, 6)}...`;
    }
  }
  
  // Get target user name with priority
  let targetName = 'Unknown User';
  if (targetUserId && isValidUserId(targetUserId)) {
    try {
      // Try direct fetch first for target
      const target = await client.users.fetch(targetUserId).catch(() => null);
      if (target) {
        targetName = target.username;
      } else {
        // Fallback to getUserName
        targetName = await getUserName(client, targetUserId);
      }
    } catch (error) {
      targetName = `User ${targetUserId.slice(0, 6)}...`;
    }
  }
  
  // Format with case number
  const caseStr = caseNumber ? `Case #${String(caseNumber).padStart(4, '0')}: ` : '';
  return `${caseStr}${adminName} warned ${targetName} - ${reason}`;
}

/**
 * Warning removal format: "Case #0001: (admin nickname) removed warning from (user) - reason"
 */
async function formatWarningRemoval(
  client: Client | null, 
  moderatorId: string | undefined | null, 
  targetUserId: string | undefined | null, 
  reason: string,
  caseNumber?: number
): Promise<string> {
  // Ensure we have a client
  if (!client) {
    const caseStr = caseNumber ? `Case #${String(caseNumber).padStart(4, '0')}: ` : '';
    return `${caseStr}Warning removed from user - ${reason}`;
  }
  
  // Get admin name with priority
  let adminName = 'Unknown Admin';
  if (moderatorId && isValidUserId(moderatorId)) {
    try {
      // Try direct fetch first for admin
      const admin = await client.users.fetch(moderatorId).catch(() => null);
      if (admin) {
        adminName = admin.username;
      } else {
        // Fallback to getUserName
        adminName = await getUserName(client, moderatorId);
      }
    } catch (error) {
      adminName = `Admin ${moderatorId.slice(0, 6)}...`;
    }
  }
  
  // Get target user name with priority
  let targetName = 'Unknown User';
  if (targetUserId && isValidUserId(targetUserId)) {
    try {
      // Try direct fetch first for target
      const target = await client.users.fetch(targetUserId).catch(() => null);
      if (target) {
        targetName = target.username;
      } else {
        // Fallback to getUserName
        targetName = await getUserName(client, targetUserId);
      }
    } catch (error) {
      targetName = `User ${targetUserId.slice(0, 6)}...`;
    }
  }
  
  // Format with case number
  const caseStr = caseNumber ? `Case #${String(caseNumber).padStart(4, '0')}: ` : '';
  return `${caseStr}${adminName} removed warning from ${targetName} - ${reason}`;
}

/**
 * Clear the username cache - useful for testing or when usernames might have changed
 */
function clearUsernameCache() {
  usernameCache.clear();
  // console.log('[getUserName] Username cache cleared');
}

export {
  getUserName,
  formatWarning,
  formatWarningRemoval,
  clearUsernameCache
};
