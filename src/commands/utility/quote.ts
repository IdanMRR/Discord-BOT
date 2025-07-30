import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from 'discord.js';
import { createInfoEmbed, Colors } from '../../utils/embeds';

export const data = new SlashCommandBuilder()
  .setName('quote')
  .setDescription('Get an inspirational quote')
  .addStringOption(option =>
    option
      .setName('category')
      .setDescription('Quote category')
      .setRequired(false)
      .addChoices(
        { name: '💡 Inspirational', value: 'inspirational' },
        { name: '🎯 Motivational', value: 'motivational' },
        { name: '💭 Wisdom', value: 'wisdom' },
        { name: '💪 Success', value: 'success' },
        { name: '😊 Happiness', value: 'happiness' },
        { name: '🌟 Life', value: 'life' },
        { name: '❤️ Love', value: 'love' },
        { name: '🎲 Random', value: 'random' }
      ));

const quotes = {
  inspirational: [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
    { text: "Life is what happens to you while you're busy making other plans.", author: "John Lennon" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" }
  ],
  motivational: [
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { text: "If you really look closely, most overnight successes took a long time.", author: "Steve Jobs" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" }
  ],
  wisdom: [
    { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
    { text: "Yesterday is history, tomorrow is a mystery, today is a gift.", author: "Eleanor Roosevelt" },
    { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" }
  ],
  success: [
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Success is going from failure to failure without losing your enthusiasm.", author: "Winston Churchill" },
    { text: "The way to achieve your own success is to be willing to help somebody else get it first.", author: "Iyanla Vanzant" },
    { text: "Don't be afraid of failure. Be afraid of not trying.", author: "Unknown" },
    { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" }
  ],
  happiness: [
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "Happiness is not something ready made. It comes from your own actions.", author: "Dalai Lama" },
    { text: "The purpose of our lives is to be happy.", author: "Dalai Lama" },
    { text: "Count your age by friends, not years. Count your life by smiles, not tears.", author: "John Lennon" },
    { text: "Life is really simple, but we insist on making it complicated.", author: "Confucius" }
  ],
  life: [
    { text: "Life is 10% what happens to you and 90% how you react to it.", author: "Charles R. Swindoll" },
    { text: "In the end, we will remember not the words of our enemies, but the silence of our friends.", author: "Martin Luther King Jr." },
    { text: "Life is a journey that must be traveled no matter how bad the roads and accommodations.", author: "Oliver Goldsmith" },
    { text: "The biggest adventure you can take is to live the life of your dreams.", author: "Oprah Winfrey" },
    { text: "Life isn't about finding yourself. Life is about creating yourself.", author: "George Bernard Shaw" }
  ],
  love: [
    { text: "Being deeply loved by someone gives you strength, while loving someone deeply gives you courage.", author: "Lao Tzu" },
    { text: "The best thing to hold onto in life is each other.", author: "Audrey Hepburn" },
    { text: "Love is not about how many days, months, or years you have been together, it's about how much you love each other every single day.", author: "Unknown" },
    { text: "Where there is love there is life.", author: "Mahatma Gandhi" },
    { text: "Love yourself first and everything else falls into line.", author: "Lucille Ball" }
  ]
};

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();
    
    const category = interaction.options.getString('category') || 'random';
    const guild = interaction.guild;
    
    // Get a random quote
    let selectedQuote: { text: string; author: string; category: string };
    if (category === 'random') {
      // Get a random category first
      const categories = Object.keys(quotes);
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const categoryQuotes = quotes[randomCategory as keyof typeof quotes];
      const baseQuote = categoryQuotes[Math.floor(Math.random() * categoryQuotes.length)];
      selectedQuote = { ...baseQuote, category: randomCategory };
    } else {
      const categoryQuotes = quotes[category as keyof typeof quotes];
      const baseQuote = categoryQuotes[Math.floor(Math.random() * categoryQuotes.length)];
      selectedQuote = { ...baseQuote, category: category };
    }
    
    // Get category info
    const categoryInfo = getCategoryInfo(selectedQuote.category);
    
    // Create beautiful embed
    const embed = new EmbedBuilder()
      .setColor(categoryInfo.color)
      .setTitle(`${categoryInfo.emoji} ${categoryInfo.name} Quote`)
      .setDescription(`*"${selectedQuote.text}"*`)
      .addFields([
        { name: '✍️ Author', value: selectedQuote.author, inline: true },
        { name: '📚 Category', value: `${categoryInfo.emoji} ${categoryInfo.name}`, inline: true },
        { name: '🎲 Quote ID', value: `#${Math.floor(Math.random() * 10000)}`, inline: true }
      ])
      .setFooter({ 
        text: 'Daily inspiration • Share the wisdom',
        iconURL: interaction.user.displayAvatarURL({ size: 32 })
      })
      .setTimestamp();
    
    // Add inspirational image/thumbnail based on category
    const thumbnails = {
      inspirational: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=256',
      motivational: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=256',
      wisdom: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=256',
      success: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=256',
      happiness: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=256',
      life: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=256',
      love: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=256'
    };
    
    // Set user's avatar as author
    embed.setAuthor({
      name: `Quote requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL({ size: 64 })
    });
    
    // Create action buttons
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`quote-new-${selectedQuote.category}`)
          .setLabel('New Quote')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId(`quote-random`)
          .setLabel('Random')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎲'),
        new ButtonBuilder()
          .setCustomId(`quote-share-${Date.now()}`)
          .setLabel('Share')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📤')
      );
    
    // Add category-specific button
    if (selectedQuote.category !== 'inspirational') {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`quote-new-inspirational`)
          .setLabel('Inspire Me')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💡')
      );
    }
    
    await interaction.editReply({ 
      embeds: [embed], 
      components: [row]
    });
    
  } catch (error) {
    console.error('Error in quote command:', error);
    
    const errorEmbed = createInfoEmbed(
      'Error',
      'There was an error getting your quote. Please try again.'
    );
    errorEmbed.setColor(Colors.ERROR);
    
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
}

// Helper function to get category information
function getCategoryInfo(category: string) {
  const info = {
    inspirational: { name: 'Inspirational', emoji: '💡', color: Colors.INFO },
    motivational: { name: 'Motivational', emoji: '🎯', color: Colors.SUCCESS },
    wisdom: { name: 'Wisdom', emoji: '💭', color: Colors.SECONDARY },
    success: { name: 'Success', emoji: '💪', color: Colors.PRIMARY },
    happiness: { name: 'Happiness', emoji: '😊', color: Colors.SUCCESS },
    life: { name: 'Life', emoji: '🌟', color: Colors.WARNING },
    love: { name: 'Love', emoji: '❤️', color: Colors.MODERATION }
  };
  
  return info[category as keyof typeof info] || info.inspirational;
} 