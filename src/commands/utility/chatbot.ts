import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, EmbedBuilder, Message, MessageFlags } from 'discord.js';
import { Command, ExecuteProps } from '../../types/Command';

// This is a simple AI-powered chatbot command that uses an external API to generate responses
// You'll need to set up the API_KEY in your .env file

const API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY;

// Command usage is automatically logged by index.ts - no need for additional logging

// Create the command data using SlashCommandBuilder and convert to JSON to match the Command type
const slashCommand = new SlashCommandBuilder()
  .setName('chatbot')
  .setDescription('Ask the AI chatbot a question')
  .addStringOption(option => 
    option.setName('question')
      .setDescription('The question or message for the chatbot')
      .setRequired(true))
  .addBooleanOption(option =>
    option.setName('private')
      .setDescription('Whether to show the response only to you (default: false)')
      .setRequired(false));

// Properly format the command export to match expected Command type
const command: Command = {
  data: slashCommand as unknown as Omit<SlashCommandBuilder, 'addSubcommandGroup' | 'addSubcommand'>,

  async execute(interaction: ExecuteProps) {
    // Cast to ChatInputCommandInteraction since we know this command only handles slash commands
    const chatInteraction = interaction as ChatInputCommandInteraction;
    try {
      // Get the user's question
      const question = chatInteraction.options.getString('question');
      const isPrivate = chatInteraction.options.getBoolean('private') || false;

      if (!question || question.trim() === '') {
        await chatInteraction.reply({ content: 'Please provide a question!', flags: MessageFlags.Ephemeral });
        return;
      }

      // Show typing indicator
      await chatInteraction.deferReply({ ephemeral: isPrivate });

      // Command usage is automatically logged by index.ts

      if (!API_KEY) {
        await chatInteraction.editReply(
          'The chatbot is not configured properly. Please ask an administrator to set up the AI API key.'
        );
        return;
      }

      try {
        // Simulate AI response for now (replace with actual API call when API key is configured)
        let aiResponse = 'This is a simulated AI response since no API key is configured. In a real setup, this would connect to an AI service.';
        
        // If API key is available, make the actual API call
        if (API_KEY !== 'YOUR_API_KEY_HERE') {
          try {
            // Use dynamic import for axios to avoid issues
            const { default: axios } = await import('axios');
            
            const response = await axios.post(
              API_URL,
              {
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a helpful assistant in a Discord server. Keep responses concise and helpful.'
                  },
                  {
                    role: 'user',
                    content: question
                  }
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

            // Extract the AI's response
            aiResponse = response.data.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
          } catch (apiError) {
            console.error('Error calling AI API:', apiError);
            aiResponse = 'Sorry, I encountered an error while processing your request. Please try again later.';
          }
        }

        // Create a nice embed for the response
        const responseEmbed = new EmbedBuilder()
          .setColor('#5865F2') // Discord blue
          .setTitle('AI Assistant')
          .setDescription(aiResponse)
          .setFooter({ text: `Requested by ${chatInteraction.user.username}` })
          .setTimestamp();

        // Send the response
        await chatInteraction.editReply({ embeds: [responseEmbed] });
      } catch (error) {
        console.error('Error in chatbot command:', error);
        await chatInteraction.reply({ content: 'There was an error processing your command.', flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      console.error('Error in chatbot command:', error);
      
      if (!chatInteraction.replied && !chatInteraction.deferred) {
        await chatInteraction.reply({ content: 'There was an error processing your command.', flags: MessageFlags.Ephemeral });
      } else {
        await chatInteraction.editReply('There was an error processing your command.');
      }
    }
  }
};

/**
 * Handle direct messages to the bot
 */
async function handleDirectMessage(message: Message) {
  // Ignore messages from bots
  if (message.author.bot) return;
  
  try {
    // Show typing indicator (using a different approach to avoid TypeScript errors)
    try {
      // @ts-ignore - TypeScript doesn't recognize sendTyping on all channel types
      await message.channel.sendTyping();
    } catch (e) {
      // Silently fail if sendTyping is not available
    }
    
    if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
      await message.reply('The chatbot is not configured properly. Please ask an administrator to set up the AI API key.');
      return;
    }
    
    try {
      // Use dynamic import for axios to avoid issues
      const { default: axios } = await import('axios');
      
      // Make API request to the AI service
      const response = await axios.post(
        API_URL,
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant in a Discord DM. Keep responses concise and helpful.'
            },
            {
              role: 'user',
              content: message.content
            }
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
      
      // Extract the AI's response
      const aiResponse = response.data.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
      
      // Send the response
      await message.reply(aiResponse);
    } catch (error) {
      console.error('Error calling AI API:', error);
      await message.reply('Sorry, I encountered an error while processing your message. Please try again later.');
    }
  } catch (error) {
    console.error('Error handling direct message:', error);
  }
}

// Export just the command object
export default command;
