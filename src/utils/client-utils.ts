import { Client } from 'discord.js';

// Store the client instance
let clientInstance: Client | null = null;

/**
 * Set the Discord client instance for use across the application
 * @param client The Discord.js Client instance
 */
export function setClient(client: Client): void {
  clientInstance = client;
}

/**
 * Get the Discord client instance
 * @returns The Discord.js Client instance or null if not initialized
 */
export function getClient(): Client | null {
  return clientInstance;
}

/**
 * Check if the Discord client is ready and connected
 * @returns True if client is ready, false otherwise
 */
export function isClientReady(): boolean {
  return clientInstance?.isReady() || false;
}

/**
 * Get a user's display name from Discord
 * @param userId Discord user ID
 * @returns Promise<string> The user's display name or fallback
 */
export async function getDiscordUsername(userId: string): Promise<string> {
  if (!userId) return 'Unknown User';
  
  try {
    if (!clientInstance || !clientInstance.isReady()) {
      return 'Unknown User';
    }

    // Try to get from cache first
    let user = clientInstance.users.cache.get(userId);
    
    // If not in cache, try to fetch from Discord API
    if (!user) {
      try {
        user = await clientInstance.users.fetch(userId);
      } catch (fetchError) {
        console.log(`Could not fetch user ${userId} from Discord API`);
        return 'Unknown User';
      }
    }

    if (user) {
      // Use displayName (global display name) if available, otherwise username
      return user.displayName || user.username || 'Unknown User';
    }

    return 'Unknown User';
  } catch (error) {
    console.log('Error resolving Discord username for', userId, ':', error);
    return 'Unknown User';
  }
}

/**
 * Get a user's display name from Discord (synchronous version with cache only)
 * @param userId Discord user ID
 * @returns The user's display name or fallback
 */
export function getDiscordUsernameSync(userId: string): string {
  if (!userId) return 'Unknown User';
  
  try {
    if (!clientInstance || !clientInstance.isReady()) {
      return 'Unknown User';
    }

    // Only check cache for synchronous version
    const user = clientInstance.users.cache.get(userId);
    
    if (user) {
      return user.displayName || user.username || 'Unknown User';
    }

    return 'Unknown User';
  } catch (error) {
    console.log('Error resolving Discord username for', userId, ':', error);
    return 'Unknown User';
  }
}