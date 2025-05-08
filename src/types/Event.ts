import { Client, ClientEvents } from 'discord.js';

export interface Event {
    name: keyof ClientEvents;
    once: boolean;
    execute: (client: Client, ...args: any[]) => Promise<void>;
} 