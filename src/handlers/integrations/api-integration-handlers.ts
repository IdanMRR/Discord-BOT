import { Integration } from '../../services/integrationService';
import axios from 'axios';
import { logInfo, logError } from '../../utils/logger';

export class ApiIntegrationHandlers {
  
  // Cryptocurrency Price Integration (using CoinGecko free API)
  static async syncCrypto(integration: Integration, client: any): Promise<any> {
    const { coins = 'bitcoin,ethereum,solana', currency = 'usd' } = integration.config;
    
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price`,
        {
          params: {
            ids: coins,
            vs_currencies: currency,
            include_24hr_change: true,
            include_market_cap: true
          },
          timeout: 30000,
          headers: {
            'User-Agent': 'Discord Bot Crypto Integration'
          }
        }
      );

      const data = response.data;
      
      if (integration.target_channel_id) {
        const channel = await client.channels.fetch(integration.target_channel_id);
        if (channel && channel.isTextBased() && 'send' in channel) {
          const embed = this.formatCryptoPriceEmbed(data, integration, currency);
          await channel.send(embed);
          logInfo('IntegrationManager', `Sent crypto update to channel ${integration.target_channel_id}`);
        }
      }

      return { coins: Object.keys(data).length, currency, last_updated: new Date().toISOString() };
    } catch (error) {
      logError('IntegrationManager', `Error fetching crypto data: ${error}`);
      throw error;
    }
  }

  // Stock Market Integration (using Alpha Vantage free tier or Yahoo Finance)
  static async syncStocks(integration: Integration, client: any): Promise<any> {
    const { symbols = 'AAPL,GOOGL,MSFT', api_key } = integration.config;
    
    try {
      // Using Yahoo Finance API alternative (free)
      const symbolsArray = symbols.split(',').map((s: string) => s.trim());
      const stockData: any = {};
      
      for (const symbol of symbolsArray) {
        const response = await axios.get(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
          {
            timeout: 30000,
            headers: {
              'User-Agent': 'Discord Bot Stock Integration'
            }
          }
        );
        
        const result = response.data.chart.result[0];
        const quote = result.meta;
        const previousClose = quote.previousClose || quote.regularMarketPrice;
        
        stockData[symbol] = {
          price: quote.regularMarketPrice,
          previousClose: previousClose,
          change: quote.regularMarketPrice - previousClose,
          changePercent: ((quote.regularMarketPrice - previousClose) / previousClose * 100).toFixed(2),
          currency: quote.currency
        };
      }
      
      if (integration.target_channel_id) {
        const channel = await client.channels.fetch(integration.target_channel_id);
        if (channel && channel.isTextBased() && 'send' in channel) {
          const embed = this.formatStockPriceEmbed(stockData, integration);
          await channel.send(embed);
          logInfo('IntegrationManager', `Sent stock update to channel ${integration.target_channel_id}`);
        }
      }

      return { stocks_updated: symbolsArray.length, last_updated: new Date().toISOString() };
    } catch (error) {
      logError('IntegrationManager', `Error fetching stock data: ${error}`);
      throw error;
    }
  }

  // News Feed Integration (using NewsAPI free tier or RSS feeds)
  static async syncNews(integration: Integration, client: any): Promise<any> {
    const { category = 'general', country = 'us', api_key } = integration.config;
    
    try {
      let articles = [];
      
      if (api_key) {
        // Using NewsAPI
        const response = await axios.get(
          `https://newsapi.org/v2/top-headlines`,
          {
            params: {
              country,
              category,
              apiKey: api_key,
              pageSize: 5
            },
            timeout: 30000
          }
        );
        articles = response.data.articles;
      } else {
        // Fallback to free news RSS feed
        const rssUrl = `https://news.google.com/rss/search?q=${category}&hl=en-${country.toUpperCase()}&gl=${country.toUpperCase()}&ceid=${country.toUpperCase()}:en`;
        const response = await axios.get(rssUrl, { timeout: 30000 });
        
        // Parse RSS (simplified)
        const items = response.data.match(/<item>([\s\S]*?)<\/item>/g) || [];
        articles = items.slice(0, 5).map((item: string) => {
          const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
          const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
          const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
          
          return {
            title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
            url: link,
            publishedAt: pubDate,
            source: { name: 'Google News' }
          };
        });
      }
      
      if (integration.target_channel_id && articles.length > 0) {
        const channel = await client.channels.fetch(integration.target_channel_id);
        if (channel && channel.isTextBased() && 'send' in channel) {
          const embed = this.formatNewsEmbed(articles.slice(0, 3), integration, category);
          await channel.send(embed);
          logInfo('IntegrationManager', `Sent news update to channel ${integration.target_channel_id}`);
        }
      }

      return { articles_processed: articles.length, category, last_updated: new Date().toISOString() };
    } catch (error) {
      logError('IntegrationManager', `Error fetching news: ${error}`);
      throw error;
    }
  }

  // Sports Scores Integration (using free sports APIs)
  static async syncSports(integration: Integration, client: any): Promise<any> {
    const { sport = 'soccer', league = 'premier-league' } = integration.config;
    
    try {
      // Using football-data.org free tier (10 requests/minute)
      const response = await axios.get(
        `https://api.football-data.org/v4/competitions/PL/matches`,
        {
          params: {
            status: 'FINISHED',
            limit: 5
          },
          headers: {
            'X-Auth-Token': integration.config.api_key || '',
            'User-Agent': 'Discord Bot Sports Integration'
          },
          timeout: 30000
        }
      );
      
      const matches = response.data.matches || [];
      
      if (integration.target_channel_id && matches.length > 0) {
        const channel = await client.channels.fetch(integration.target_channel_id);
        if (channel && channel.isTextBased() && 'send' in channel) {
          const embed = this.formatSportsEmbed(matches.slice(0, 5), integration, sport);
          await channel.send(embed);
          logInfo('IntegrationManager', `Sent sports update to channel ${integration.target_channel_id}`);
        }
      }

      return { matches_processed: matches.length, sport, league, last_updated: new Date().toISOString() };
    } catch (error) {
      logError('IntegrationManager', `Error fetching sports data: ${error}`);
      throw error;
    }
  }

  // Exchange Rates Integration (using exchangerate-api.com free tier)
  static async syncExchangeRates(integration: Integration, client: any): Promise<any> {
    const { base_currency = 'USD', target_currencies = 'EUR,GBP,JPY,CAD,AUD' } = integration.config;
    
    try {
      const response = await axios.get(
        `https://api.exchangerate-api.com/v4/latest/${base_currency}`,
        {
          timeout: 30000,
          headers: {
            'User-Agent': 'Discord Bot Exchange Rate Integration'
          }
        }
      );
      
      const data = response.data;
      const targets = target_currencies.split(',').map((c: string) => c.trim());
      const rates: any = {};
      
      targets.forEach((currency: string) => {
        if (data.rates[currency]) {
          rates[currency] = data.rates[currency];
        }
      });
      
      if (integration.target_channel_id) {
        const channel = await client.channels.fetch(integration.target_channel_id);
        if (channel && channel.isTextBased() && 'send' in channel) {
          const embed = this.formatExchangeRateEmbed(base_currency, rates, integration);
          await channel.send(embed);
          logInfo('IntegrationManager', `Sent exchange rate update to channel ${integration.target_channel_id}`);
        }
      }

      return { base_currency, rates_count: Object.keys(rates).length, last_updated: data.date };
    } catch (error) {
      logError('IntegrationManager', `Error fetching exchange rates: ${error}`);
      throw error;
    }
  }

  // Jokes Integration (using free joke APIs)
  static async syncJokes(integration: Integration, client: any): Promise<any> {
    const { category = 'any', type = 'single' } = integration.config;
    
    try {
      const response = await axios.get(
        `https://v2.jokeapi.dev/joke/${category}`,
        {
          params: {
            type,
            blacklistFlags: 'nsfw,religious,political,racist,sexist'
          },
          timeout: 30000,
          headers: {
            'User-Agent': 'Discord Bot Joke Integration'
          }
        }
      );
      
      const joke = response.data;
      
      if (integration.target_channel_id) {
        const channel = await client.channels.fetch(integration.target_channel_id);
        if (channel && channel.isTextBased() && 'send' in channel) {
          const embed = this.formatJokeEmbed(joke, integration);
          await channel.send(embed);
          logInfo('IntegrationManager', `Sent joke to channel ${integration.target_channel_id}`);
        }
      }

      return { joke_sent: true, category, last_updated: new Date().toISOString() };
    } catch (error) {
      logError('IntegrationManager', `Error fetching joke: ${error}`);
      throw error;
    }
  }

  // Quotes Integration (using free quote APIs)
  static async syncQuotes(integration: Integration, client: any): Promise<any> {
    const { category = 'inspirational' } = integration.config;
    
    try {
      const response = await axios.get(
        `https://api.quotable.io/random`,
        {
          params: {
            tags: category
          },
          timeout: 30000,
          headers: {
            'User-Agent': 'Discord Bot Quote Integration'
          }
        }
      );
      
      const quote = response.data;
      
      if (integration.target_channel_id) {
        const channel = await client.channels.fetch(integration.target_channel_id);
        if (channel && channel.isTextBased() && 'send' in channel) {
          const embed = this.formatQuoteEmbed(quote, integration);
          await channel.send(embed);
          logInfo('IntegrationManager', `Sent quote to channel ${integration.target_channel_id}`);
        }
      }

      return { quote_sent: true, category, last_updated: new Date().toISOString() };
    } catch (error) {
      logError('IntegrationManager', `Error fetching quote: ${error}`);
      throw error;
    }
  }

  // Space/NASA Integration (using NASA's free APIs)
  static async syncSpace(integration: Integration, client: any): Promise<any> {
    const { content_type = 'apod' } = integration.config; // apod = Astronomy Picture of the Day
    
    try {
      const response = await axios.get(
        `https://api.nasa.gov/planetary/apod`,
        {
          params: {
            api_key: integration.config.api_key || 'DEMO_KEY'
          },
          timeout: 30000,
          headers: {
            'User-Agent': 'Discord Bot Space Integration'
          }
        }
      );
      
      const data = response.data;
      
      if (integration.target_channel_id) {
        const channel = await client.channels.fetch(integration.target_channel_id);
        if (channel && channel.isTextBased() && 'send' in channel) {
          const embed = this.formatSpaceEmbed(data, integration);
          await channel.send(embed);
          logInfo('IntegrationManager', `Sent space content to channel ${integration.target_channel_id}`);
        }
      }

      return { content_type, title: data.title, last_updated: new Date().toISOString() };
    } catch (error) {
      logError('IntegrationManager', `Error fetching space content: ${error}`);
      throw error;
    }
  }

  // Formatting Helper Methods
  
  private static formatCryptoPriceEmbed(data: any, integration: Integration, currency: string): any {
    const fields: any[] = [];
    const cryptoEmojis: { [key: string]: string } = {
      bitcoin: '₿',
      ethereum: 'Ξ',
      solana: '◎',
      cardano: '₳',
      polkadot: '●',
      chainlink: '⬡'
    };

    Object.entries(data).forEach(([coin, priceData]: [string, any]) => {
      const price = priceData[currency];
      const change24h = priceData[`${currency}_24h_change`] || 0;
      const marketCap = priceData[`${currency}_market_cap`];
      const emoji = cryptoEmojis[coin] || '💰';
      const name = coin.charAt(0).toUpperCase() + coin.slice(1);
      
      const formattedPrice = price >= 1 ? 
        `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
        `$${price.toFixed(6)}`;
      
      const changePrefix = change24h >= 0 ? '+' : '';
      const changeFormatted = `${changePrefix}${change24h.toFixed(2)}%`;
      const changeIndicator = change24h >= 0 ? '📈' : '📉';
      
      let value = `**${formattedPrice}**\n${changeIndicator} ${changeFormatted} (24h)`;
      if (marketCap) {
        value += `\n💎 MCap: $${(marketCap / 1e9).toFixed(2)}B`;
      }
      
      fields.push({
        name: `${emoji} ${name}`,
        value,
        inline: true
      });
    });

    return {
      embeds: [{
        title: '💰 Cryptocurrency Prices',
        description: `Real-time cryptocurrency market data in ${currency.toUpperCase()}`,
        color: 0x00D4AA,
        fields,
        footer: {
          text: `${integration.name} • Powered by CoinGecko`,
          icon_url: 'https://static.coingecko.com/s/thumbnail-007177f3eca19695592f0b8b0eabbdae282b54154e1be912285c9034ea6cbaf2.png'
        },
        timestamp: new Date().toISOString()
      }]
    };
  }

  private static formatStockPriceEmbed(stockData: any, integration: Integration): any {
    const fields: any[] = [];

    Object.entries(stockData).forEach(([symbol, data]: [string, any]) => {
      const changeIndicator = data.change >= 0 ? '📈' : '📉';
      const changePrefix = data.change >= 0 ? '+' : '';
      
      fields.push({
        name: `📊 ${symbol}`,
        value: `**${data.currency} ${data.price.toFixed(2)}**\n${changeIndicator} ${changePrefix}${data.change.toFixed(2)} (${changePrefix}${data.changePercent}%)`,
        inline: true
      });
    });

    return {
      embeds: [{
        title: '📈 Stock Market Update',
        description: 'Real-time stock prices',
        color: 0x0099FF,
        fields,
        footer: {
          text: `${integration.name} • Market Data`,
          icon_url: 'https://cdn-icons-png.flaticon.com/512/2936/2936712.png'
        },
        timestamp: new Date().toISOString()
      }]
    };
  }

  private static formatNewsEmbed(articles: any[], integration: Integration, category: string): any {
    const fields = articles.map((article, index) => ({
      name: `📰 ${index + 1}. ${article.title.substring(0, 100)}${article.title.length > 100 ? '...' : ''}`,
      value: `[Read More](${article.url})\n📅 ${new Date(article.publishedAt).toLocaleDateString()}`,
      inline: false
    }));

    return {
      embeds: [{
        title: `📰 Latest ${category.charAt(0).toUpperCase() + category.slice(1)} News`,
        description: 'Top news stories',
        color: 0xFF6B6B,
        fields,
        footer: {
          text: `${integration.name} • News Update`,
          icon_url: 'https://cdn-icons-png.flaticon.com/512/2964/2964063.png'
        },
        timestamp: new Date().toISOString()
      }]
    };
  }

  private static formatSportsEmbed(matches: any[], integration: Integration, sport: string): any {
    const fields = matches.map((match: any) => ({
      name: `⚽ ${match.homeTeam.name} vs ${match.awayTeam.name}`,
      value: `**${match.score.fullTime.home} - ${match.score.fullTime.away}**\n📅 ${new Date(match.utcDate).toLocaleDateString()}`,
      inline: true
    }));

    return {
      embeds: [{
        title: `⚽ ${sport.charAt(0).toUpperCase() + sport.slice(1)} Results`,
        description: 'Latest match results',
        color: 0x2ECC71,
        fields,
        footer: {
          text: `${integration.name} • Sports Update`,
          icon_url: 'https://cdn-icons-png.flaticon.com/512/857/857455.png'
        },
        timestamp: new Date().toISOString()
      }]
    };
  }

  private static formatExchangeRateEmbed(baseCurrency: string, rates: any, integration: Integration): any {
    const fields = Object.entries(rates).map(([currency, rate]) => ({
      name: `💱 ${baseCurrency} → ${currency}`,
      value: `**${(rate as number).toFixed(4)}**`,
      inline: true
    }));

    return {
      embeds: [{
        title: `💱 Exchange Rates`,
        description: `Current exchange rates for ${baseCurrency}`,
        color: 0x9B59B6,
        fields,
        footer: {
          text: `${integration.name} • Exchange Rates`,
          icon_url: 'https://cdn-icons-png.flaticon.com/512/3310/3310619.png'
        },
        timestamp: new Date().toISOString()
      }]
    };
  }

  private static formatJokeEmbed(joke: any, integration: Integration): any {
    let description = '';
    if (joke.type === 'single') {
      description = joke.joke;
    } else {
      description = `${joke.setup}\n\n||${joke.delivery}||`;
    }

    return {
      embeds: [{
        title: '😄 Daily Joke',
        description,
        color: 0xFFD700,
        fields: [{
          name: 'Category',
          value: joke.category,
          inline: true
        }],
        footer: {
          text: `${integration.name} • JokeAPI`,
          icon_url: 'https://cdn-icons-png.flaticon.com/512/1384/1384012.png'
        },
        timestamp: new Date().toISOString()
      }]
    };
  }

  private static formatQuoteEmbed(quote: any, integration: Integration): any {
    return {
      embeds: [{
        title: '💭 Quote of the Day',
        description: `*"${quote.content}"*`,
        color: 0x3498DB,
        fields: [{
          name: 'Author',
          value: quote.author || 'Unknown',
          inline: true
        }],
        footer: {
          text: `${integration.name} • Quotable`,
          icon_url: 'https://cdn-icons-png.flaticon.com/512/1491/1491499.png'
        },
        timestamp: new Date().toISOString()
      }]
    };
  }

  private static formatSpaceEmbed(data: any, integration: Integration): any {
    const embed: any = {
      title: `🌌 ${data.title}`,
      description: data.explanation.substring(0, 1024) + (data.explanation.length > 1024 ? '...' : ''),
      color: 0x000080,
      footer: {
        text: `${integration.name} • NASA APOD`,
        icon_url: 'https://api.nasa.gov/assets/img/favicons/favicon-192.png'
      },
      timestamp: new Date().toISOString()
    };

    if (data.media_type === 'image' && data.url) {
      embed.image = { url: data.url };
    } else if (data.media_type === 'video' && data.url) {
      embed.fields = [{
        name: '🎥 Video',
        value: `[Watch on YouTube](${data.url})`,
        inline: false
      }];
    }

    if (data.copyright) {
      embed.fields = embed.fields || [];
      embed.fields.push({
        name: '📸 Copyright',
        value: data.copyright,
        inline: true
      });
    }

    return { embeds: [embed] };
  }
}

export default ApiIntegrationHandlers;