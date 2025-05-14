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