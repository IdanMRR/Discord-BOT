import { 
  Message, 
  EmbedBuilder, 
  TextChannel, 
  ChannelType, 
  PermissionsBitField 
} from 'discord.js';
import { Colors } from '../../utils/embeds';
import { logInfo, logError } from '../../utils/logger';
import { db } from '../../database/sqlite';
import { settingsManager } from '../../utils/settings';
import { getAIResponse, initializeAI, TicketContext } from '../../utils/ai-service';

// Map to track tickets with staff activity to avoid responding in tickets that staff are already handling
export const staffActiveTickets = new Map<string, Date>();

// Define timeout for staff activity (15 minutes)
const STAFF_ACTIVITY_TIMEOUT = 15 * 60 * 1000;

// Flag to track if AI service is available
let isAIAvailable = false;

// Simple FAQ dataset with common questions and answers
const faqData = [
  {
    keywords: ['how', 'get', 'role', 'roles', 'assign'],
    response: "To get roles, you can use the role-assignment channel or ask a moderator to assign them to you."
  },
  {
    keywords: ['server', 'rules', 'guidelines'],
    response: "Our server rules can be found in the #rules channel. Please make sure to read and follow them."
  },
  {
    keywords: ['donate', 'donation', 'support', 'patreon'],
    response: "You can support our server through donations on our Patreon page. Visit #donation-info for more details."
  },
  {
    keywords: ['bot', 'command', 'commands', 'prefix'],
    response: "Our server uses slash commands. Type / to see available commands you can use."
  },
  {
    keywords: ['ban', 'banned', 'appeal', 'unban'],
    response: "If you want to appeal a ban, please fill out the ban appeal form in our website."
  },
  {
    keywords: ['verification', 'verify', 'verified'],
    response: "To verify your account, go to the #verification channel and follow the instructions there."
  },
  {
    keywords: ['invite', 'invites', 'invite link', 'server link'],
    response: "You can invite friends to our server using the invite link in #invite-friends channel."
  },
  {
    keywords: ['help', 'support', 'assistance', 'problem'],
    response: "A staff member will be with you shortly to assist with your issue. In the meantime, could you provide more details about what you need help with?"
  },
  {
    keywords: ['status', 'ticket status', 'progress'],
    response: "Your ticket is currently open and waiting for staff attention. A team member will respond as soon as possible."
  },
  {
    keywords: ['thanks', 'thank you', 'thx', 'ty'],
    response: "You're welcome! If you need further assistance, please let us know."
  }
];

// Secondary dataset with more specific help topics
const helpTopics = [
  {
    keywords: ['password', 'reset', 'forgot', 'login', 'cant login'],
    response: "To reset your password, please go to our website's login page and click on 'Forgot Password'. Follow the instructions sent to your email."
  },
  {
    keywords: ['account', 'delete', 'remove', 'data', 'privacy'],
    response: "If you want to delete your account or have questions about data privacy, please let us know and a staff member will guide you through the process."
  },
  {
    keywords: ['purchase', 'bought', 'order', 'payment', 'transaction'],
    response: "For issues with purchases or payments, please provide your order number or transaction ID so we can look into it for you."
  },
  {
    keywords: ['bug', 'glitch', 'issue', 'not working', 'broken'],
    response: "I'm sorry to hear you've encountered an issue. Could you please provide more details like what you were doing when the problem occurred and any error messages you received?"
  },
  {
    keywords: ['event', 'contest', 'giveaway', 'when', 'schedule'],
    response: "Information about upcoming events and giveaways can be found in the #events channel. Check out the server calendar for the complete schedule."
  }
];

/**
 * Initialize the ticket chatbot system
 */
export function initializeTicketChatbot() {
  // Try to initialize the AI service
  isAIAvailable = initializeAI();
  
  if (isAIAvailable) {
    logInfo('Ticket Chatbot', 'Initialized ticket chatbot system with AI capabilities');
  } else {
    logInfo('Ticket Chatbot', 'Initialized ticket mini-chatbot system (AI not available, using keyword matching)');
  }
}

/**
 * Processes a new message in a ticket channel
 * 
 * @param message The Discord message object
 * @returns Promise resolving to true if processed
 */
export async function processTicketMessage(message: Message): Promise<boolean> {
  try {
    // Skip if not in a guild
    if (!message.guild) {
      return false;
    }
    
    // Skip if not in a text channel
    if (!message.channel.isTextBased() || message.channel.type !== ChannelType.GuildText) {
      return false;
    }
    
    // Get the channel as TextChannel
    const channel = message.channel as TextChannel;
    
    // Skip if not in a ticket channel
    if (!channel.name.toLowerCase().includes('ticket-')) {
      return false;
    }
    
    // Skip if message is from a bot
    if (message.author.bot) {
      return false;
    }
    
    // Get ticket information from channel name
    const match = channel.name.match(/ticket-(\d+)/);
    if (!match) {
      return false;
    }
    
    const ticketNumber = parseInt(match[1]);
    
    // Get guild settings
    const settings = await settingsManager.getSettings(message.guild.id);
    
    // Skip if chatbot is disabled in settings
    if (!settings.ticket_chatbot_enabled) {
      return false;
    }
    
    // Check if any staff members are active in this ticket
    const ticketKey = `${message.guild.id}-${ticketNumber}`;
    const lastStaffActivity = staffActiveTickets.get(ticketKey);
    
    // If staff were active recently, don't use the chatbot
    if (lastStaffActivity && (Date.now() - lastStaffActivity.getTime()) < STAFF_ACTIVITY_TIMEOUT) {
      logInfo('Ticket Activity', `Skipping AI response - staff were active in the last ${STAFF_ACTIVITY_TIMEOUT/60000} minutes in ticket #${ticketNumber}`);
      return false;
    }
    
    // Check if message author is staff
    const isStaff = message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages) || 
                    message.member?.roles.cache.some(r => r.name.toLowerCase().includes('staff'));
    
    // If staff member sent a message, update the staff activity timestamp and don't respond
    if (isStaff) {
      staffActiveTickets.set(ticketKey, new Date());
      logInfo('Ticket Activity', `Updated staff activity timestamp for ticket #${ticketNumber} in ${message.guild.name}`);
      return false;
    }
    
    // Get the message content for processing
    const content = message.content;
    
    // Create a typing indicator to simulate the bot thinking
    await channel.sendTyping();
    
    // Get response based on available capabilities
    let response: string | null | undefined;
    
    // Try to get ticket topic from database - safely handle missing column
    let ticketTopic: string | undefined;
    try {
      // First check if the topic column exists
      const columnsCheck = db.prepare(`PRAGMA table_info(tickets)`).all() as Array<{name: string}>;
      const hasTopicColumn = columnsCheck.some(col => col.name === 'topic');
      
      if (hasTopicColumn) {
        const ticketData = db.prepare(`
          SELECT topic FROM tickets 
          WHERE guild_id = ? AND ticket_number = ?
        `).get(message.guild.id, ticketNumber) as { topic?: string } | undefined;
        ticketTopic = ticketData?.topic;
      }
    } catch (error) {
      logError('Ticket Chatbot', `Error checking for ticket topic: ${error}`);
      // Continue without topic data
    }
    
    // Check if AI is available and enabled in settings
    const useAI = isAIAvailable && settings.ticket_chatbot_ai_enabled;
    
    // If AI is available and enabled, try to get an AI response
    if (useAI) {
      // Create ticket context for AI
      const ticketContext: TicketContext = {
        ticketNumber: ticketNumber,
        username: message.author.username,
        topic: ticketTopic
      };
      
      // Get AI response with longer delay to simulate thinking
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
      response = await getAIResponse(content, ticketContext);
    }
    
    // Fall back to keyword matching if AI is not available/enabled or failed
    if (!response) {
      // Small delay to make it seem like the bot is thinking (1-2 seconds)
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      response = findBestResponse(content.toLowerCase());
    }
    
    // If no good response found, don't reply
    if (!response) {
      return false;
    }
    
    // Send the response
    const responseEmbed = new EmbedBuilder()
      .setAuthor({
        name: 'Ticket Assistant',
        iconURL: message.client.user?.displayAvatarURL()
      })
      .setDescription(response)
      .setColor(Colors.INFO)
      .setFooter({ 
        text: useAI 
          ? 'This is an AI-assisted response. Staff will assist you shortly. • Made by Soggra.' 
          : 'This is an automated response. Staff will assist you shortly. • Made by Soggra.' 
      });
    
    await channel.send({ embeds: [responseEmbed] });
    
    // Update the activity timestamp
    db.prepare(`
      UPDATE tickets 
      SET last_activity_at = CURRENT_TIMESTAMP
      WHERE guild_id = ? AND ticket_number = ?
    `).run(message.guild.id, ticketNumber);
    
    logInfo('Ticket Chatbot', `Responded to message in ticket #${ticketNumber} using ${useAI ? 'AI' : 'keyword matching'}`);
    return true;
  } catch (error) {
    logError('Ticket Chatbot', `Error processing message: ${error}`);
    return false;
  }
}

/**
 * Track staff activity in tickets
 * 
 * @param message The Discord message object
 * @returns Promise resolving to true if processed
 */
export async function trackStaffActivity(message: Message): Promise<boolean> {
  try {
    // Skip if not in a guild
    if (!message.guild) return false;
    
    // Skip if not in a text channel
    if (!message.channel.isTextBased() || message.channel.type !== ChannelType.GuildText) {
      return false;
    }
    
    // Get the channel as TextChannel
    const channel = message.channel as TextChannel;
    
    // Skip if not in a ticket channel
    if (!channel.name.toLowerCase().includes('ticket-')) {
      return false;
    }
    
    // Skip if message is from a bot
    if (message.author.bot) return false;
    
    // Check if message author is staff
    const isStaff = message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages) || 
                    message.member?.roles.cache.some(r => r.name.toLowerCase().includes('staff'));
    
    // If not staff, nothing to track
    if (!isStaff) return false;
    
    // Get ticket information from channel name
    const match = channel.name.match(/ticket-(\d+)/);
    if (!match) return false;
    
    const ticketNumber = parseInt(match[1]);
    
    // Mark this ticket as having staff activity
    const ticketKey = `${message.guild.id}-${ticketNumber}`;
    staffActiveTickets.set(ticketKey, new Date());
    
    // Also update the activity timestamp in the database
    db.prepare(`
      UPDATE tickets 
      SET last_activity_at = CURRENT_TIMESTAMP
      WHERE guild_id = ? AND ticket_number = ?
    `).run(message.guild.id, ticketNumber);
    
    // Also log staff activity
    try {
      const ticket = db.prepare(`
        SELECT id FROM tickets 
        WHERE guild_id = ? AND ticket_number = ?
      `).get(message.guild.id, ticketNumber) as { id: number } | undefined;
      
      if (ticket) {
        // Insert into staff activity table
        db.prepare(`
          INSERT INTO ticket_staff_activity
          (guild_id, ticket_id, staff_id, action_type)
          VALUES (?, ?, ?, ?)
        `).run(message.guild.id, ticket.id, message.author.id, 'message');
      }
    } catch (dbError) {
      logError('Ticket Chatbot', `Error logging staff activity: ${dbError}`);
      // Continue anyway - this is not critical
    }
    
    return true;
  } catch (error) {
    logError('Ticket Chatbot', `Error tracking staff activity: ${error}`);
    return false;
  }
}

/**
 * Find the best response for a given message
 * 
 * @param messageContent The content of the user's message
 * @returns The best response or undefined if no good match
 */
function findBestResponse(messageContent: string): string | undefined {
  const content = messageContent.toLowerCase();
  const words = content.split(/\s+/);
  
  // First check for specific help topics (more specific answers)
  for (const topic of helpTopics) {
    const matchCount = countKeywordMatches(words, topic.keywords);
    if (matchCount >= 2) {
      return topic.response;
    }
  }
  
  // Then fall back to general FAQ data
  let bestMatch: { response: string, score: number } | undefined;
  
  for (const faq of faqData) {
    const matchCount = countKeywordMatches(words, faq.keywords);
    
    // If we found a good match
    if (matchCount >= 1) {
      // If we don't have a best match yet or this one is better
      if (!bestMatch || matchCount > bestMatch.score) {
        bestMatch = {
          response: faq.response,
          score: matchCount
        };
      }
    }
  }
  
  return bestMatch?.response;
}

/**
 * Count how many keywords match in the message
 * 
 * @param words Array of words from the message
 * @param keywords Array of keywords to match
 * @returns Number of matching keywords
 */
function countKeywordMatches(words: string[], keywords: string[]): number {
  let count = 0;
  
  for (const keyword of keywords) {
    if (words.includes(keyword)) {
      count++;
    }
  }
  
  return count;
} 