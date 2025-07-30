import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  TextChannel,
  MessageFlags
} from 'discord.js';
import { logCommandUsage } from '../../utils/command-logger';
export const data = new SlashCommandBuilder()
  .setName('test-chatbot')
  .setDescription('Test the ticket chatbot directly (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option => 
    option
      .setName('message')
      .setDescription('The message to test with the chatbot')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  let isReplySent = false;
  
  try {
    // First try to defer the reply
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      isReplySent = true;
    } catch (deferError) {
      logError('Test Chatbot', `Failed to defer reply: ${deferError}`);
      // Continue with the function even if we can't reply
    }
    
    // Log command usage
    try {
      await logCommandUsage({
        guild: interaction.guild!,
        user: interaction.user,
        command: 'test-chatbot',
        options: interaction.options.data,
        channel: interaction.channel,
        success: true
      });
    } catch (logError) {
      // Continue even if logging fails
    }
    
    const message = interaction.options.getString('message')!;
    
    // Test if in a ticket channel
    const channel = interaction.channel as TextChannel;
    const isTicketChannel = channel.name.toLowerCase().includes('ticket-');
    
    // Create an embed for the response
    const embed = new EmbedBuilder()
      .setTitle('🤖 Chatbot Test')
      .setColor(Colors.Blue)
      .addFields([
        { name: 'Test Message', value: message, inline: false },
        { name: 'In Ticket Channel', value: isTicketChannel ? '✅ Yes' : '❌ No', inline: true }
      ])
      .setTimestamp();
      
    try {
      // Try to get a response manually
      const response = getTestResponse(message);
      
      if (response) {
        embed.addFields({ name: 'Chatbot Response', value: response, inline: false });
        embed.setColor(Colors.Green);
      } else {
        embed.addFields({ name: 'Chatbot Response', value: 'No response found for this message', inline: false });
        embed.setColor(Colors.Orange);
      }
    } catch (responseError) {
      embed.addFields({ name: 'Error', value: `Failed to get response: ${responseError}`, inline: false });
      embed.setColor(Colors.Red);
      
      logError('Test Chatbot', `Error getting response: ${responseError}`);
    }
    
    // Try to send the reply if possible
    if (isReplySent) {
      try {
        await interaction.editReply({ embeds: [embed] });
      } catch (replyError) {
        logError('Test Chatbot', `Failed to send results: ${replyError}`);
        // Continue anyway
      }
    }
    
    // Log the results
    logInfo('Test Chatbot', `Tested "${message}" - Response: ${embed.data.fields?.find(f => f.name === 'Chatbot Response')?.value || 'None'}`);
    
  } catch (error) {
    logError('Test Chatbot', `Error testing chatbot: ${error}`);
    
    // Try to send an error message if possible
    if (isReplySent) {
      try {
        await interaction.editReply({
          content: `An error occurred: ${error}`,
        });
      } catch (replyError) {
        logError('Test Chatbot', `Failed to send error message: ${replyError}`);
      }
    }
  }
}

// Manual implementation to test response functionality
function getTestResponse(messageContent: string): string | undefined {
  const content = messageContent.toLowerCase();
  const words = content.split(/\s+/);
  
  console.log(`[TEST] Testing words: ${words.join(', ')}`);
  
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
  
  // Find the best match
  let bestMatch: { response: string, score: number } | undefined;
  
  for (const faq of faqData) {
    const matchCount = countKeywordMatches(words, faq.keywords);
    console.log(`[TEST] FAQ "${faq.keywords[0]}" match count: ${matchCount}`);
    
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