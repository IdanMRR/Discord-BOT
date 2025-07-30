import { Message } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import axios from 'axios';

// Get API URL and key from environment variables
const API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY;

/**
 * Handle direct messages to the bot
 * @param message The message object from Discord
 */
export async function handleDM(message: Message): Promise<void> {
  try {
    // Skip if no content or from a bot
    if (!message.content || message.author.bot) return;

    // Show typing indicator
    try {
      // Use type assertion to handle typing indicator
      await (message.channel as any).sendTyping?.();
    } catch (error) {
      console.error('Error sending typing indicator:', error);
      // Continue with the message processing even if typing fails
    }

    // DM chatbot interactions are not logged to avoid confusion with slash commands

    if (!API_KEY) {
      await message.reply(
        'The chatbot is not configured properly. Please ask an administrator to set up the AI API key.'
      );
      return;
    }

    try {
      // Call the AI API
      const response = await axios.post(
        API_URL,
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant in a Discord server.' },
            { role: 'user', content: message.content }
          ],
          max_tokens: 500
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          }
        }
      );

      // Extract the AI response
      const aiResponse = response.data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

      // Create a nice embed for the response
      const responseEmbed = new EmbedBuilder()
        .setColor('#5865F2') // Discord blue
        .setTitle('AI Assistant')
        .setDescription(aiResponse)
        .setFooter({ text: `Requested by ${message.author.username}` })
        .setTimestamp();

      // Send the response
      await message.reply({ embeds: [responseEmbed] });
    } catch (error) {
      console.error('Error calling AI API:', error);
      await message.reply('There was an error processing your request. Please try again later.');
    }
  } catch (error) {
    console.error('Error in handleDM:', error);
    
    try {
      await message.reply('There was an error processing your message. Please try again later.');
    } catch (replyError) {
      console.error('Error sending error reply:', replyError);
    }
  }
}
