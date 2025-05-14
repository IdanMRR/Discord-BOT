import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';
import { logInfo, logError } from './logger';

// Load environment variables
dotenv.config();

// Initialize OpenAI
let openai: OpenAI | null = null;

// Check if OpenAI API key is configured
const openaiApiKey = process.env.OPENAI_API_KEY;

/**
 * Initialize the OpenAI client
 * 
 * @returns True if initialized successfully, false otherwise
 */
export function initializeAI(): boolean {
  try {
    if (!openaiApiKey) {
      logError('AI Service', 'OpenAI API key not found in environment variables');
      return false;
    }

    openai = new OpenAI({
      apiKey: openaiApiKey
    });

    logInfo('AI Service', 'OpenAI client initialized successfully');
    return true;
  } catch (error) {
    logError('AI Service', `Error initializing OpenAI client: ${error}`);
    return false;
  }
}

/**
 * Get a response from the AI for a given message
 * 
 * @param message The user's message
 * @param context Additional context about the ticket
 * @returns The AI response or null if there's an error
 */
export async function getAIResponse(message: string, context: TicketContext): Promise<string | null> {
  try {
    if (!openai) {
      // Try to initialize if not already initialized
      if (!initializeAI()) {
        logError('AI Service', 'Failed to initialize OpenAI client');
        return null;
      }
    }

    const systemPrompt = `You are a helpful ticket assistant bot for a Discord server.
Your job is to assist users who have opened support tickets, before staff can respond.
Keep responses brief, friendly, and helpful. If you don't know something specific to the server,
say you'll ask staff to help with that question.

Ticket Context:
- Ticket Number: ${context.ticketNumber}
- User: ${context.username}
- Topic: ${context.topic || 'Not specified'}`;
    
    // Call the OpenAI API with non-null assertion since we validated above
    const aiClient = openai!; // Use non-null assertion after checks
    const response = await aiClient.chat.completions.create({
      model: "gpt-3.5-turbo", // You can use other models like "gpt-4" if available
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 150, // Keep responses relatively short
      temperature: 0.7,
    });

    const responseContent = response.choices[0]?.message?.content || null;
    
    // Return the AI response
    return responseContent;
  } catch (error) {
    logError('AI Service', `Error getting AI response: ${error}`);
    return null;
  }
}

/**
 * Interface for ticket context information
 */
export interface TicketContext {
  ticketNumber: number;
  username: string;
  topic?: string;
  createdAt?: Date;
} 