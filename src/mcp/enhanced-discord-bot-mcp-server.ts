import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Client, GatewayIntentBits } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import axios from 'axios';

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// Database connection
let db: Database.Database | null = null;

// API base URL (assuming the API runs on the same server)
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Initialize database connection
function initDatabase() {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'discord-bot.db');
    db = new Database(dbPath);
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }
}

// Enhanced MCP Server implementation
class EnhancedDiscordBotMCPServer extends Server {
  constructor() {
    super({
      name: 'enhanced-discord-bot-mcp-server',
      version: '2.0.0',
    });
  }

  async initialize() {
    // Initialize Discord client
    const token = process.env.DISCORD_TOKEN;
    if (token) {
      try {
        await client.login(token);
        console.log('Discord client logged in successfully');
      } catch (error) {
        console.error('Failed to login to Discord:', error);
      }
    }

    // Initialize database
    initDatabase();

    // Register enhanced tools
    this.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Bot Management Tools
          {
            name: 'get_bot_status',
            description: 'Get the current status of the Discord bot',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_bot_stats',
            description: 'Get comprehensive bot statistics and analytics',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_bot_commands',
            description: 'Get a list of available bot commands',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          
          // Server Management Tools
          {
            name: 'get_server_list',
            description: 'Get a list of all servers the bot is in',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_server_info',
            description: 'Get detailed information about a specific server',
            inputSchema: {
              type: 'object',
              properties: {
                serverId: {
                  type: 'string',
                  description: 'The Discord server ID',
                },
              },
              required: ['serverId'],
            },
          },
          {
            name: 'get_server_members',
            description: 'Get member information for a server',
            inputSchema: {
              type: 'object',
              properties: {
                serverId: {
                  type: 'string',
                  description: 'The Discord server ID',
                },
              },
              required: ['serverId'],
            },
          },
          {
            name: 'get_server_settings',
            description: 'Get server settings and configuration',
            inputSchema: {
              type: 'object',
              properties: {
                serverId: {
                  type: 'string',
                  description: 'The Discord server ID',
                },
              },
              required: ['serverId'],
            },
          },
          
          // Logging and Analytics Tools
          {
            name: 'get_recent_logs',
            description: 'Get recent bot logs',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Number of logs to retrieve (default: 10)',
                },
              },
            },
          },
          {
            name: 'get_analytics_data',
            description: 'Get analytics data from the API',
            inputSchema: {
              type: 'object',
              properties: {
                serverId: {
                  type: 'string',
                  description: 'Server ID for analytics (optional)',
                },
                timeframe: {
                  type: 'string',
                  description: 'Timeframe for analytics (day, week, month)',
                },
              },
            },
          },
          
          // Dashboard and API Tools
          {
            name: 'get_dashboard_stats',
            description: 'Get dashboard statistics from the API',
            inputSchema: {
              type: 'object',
              properties: {
                serverId: {
                  type: 'string',
                  description: 'Server ID for dashboard stats',
                },
              },
            },
          },
          {
            name: 'get_api_endpoints',
            description: 'List available API endpoints',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_ticket_stats',
            description: 'Get ticket statistics from the API',
            inputSchema: {
              type: 'object',
              properties: {
                serverId: {
                  type: 'string',
                  description: 'Server ID for ticket stats',
                },
              },
            },
          },
          {
            name: 'get_giveaway_stats',
            description: 'Get giveaway statistics from the API',
            inputSchema: {
              type: 'object',
              properties: {
                serverId: {
                  type: 'string',
                  description: 'Server ID for giveaway stats',
                },
              },
            },
          },
          
          // System Health Tools
          {
            name: 'get_system_health',
            description: 'Get system health and performance metrics',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_database_info',
            description: 'Get database information and statistics',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    this.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        // Bot Management
        case 'get_bot_status':
          return await this.getBotStatus();
        case 'get_bot_stats':
          return await this.getBotStats();
        case 'get_bot_commands':
          return await this.getBotCommands();
        
        // Server Management
        case 'get_server_list':
          return await this.getServerList();
        case 'get_server_info':
          if (!args || typeof args !== 'object' || !('serverId' in args) || typeof args.serverId !== 'string') {
            throw new Error('serverId is required and must be a string');
          }
          return await this.getServerInfo(args.serverId);
        case 'get_server_members':
          if (!args || typeof args !== 'object' || !('serverId' in args) || typeof args.serverId !== 'string') {
            throw new Error('serverId is required and must be a string');
          }
          return await this.getServerMembers(args.serverId);
        case 'get_server_settings':
          if (!args || typeof args !== 'object' || !('serverId' in args) || typeof args.serverId !== 'string') {
            throw new Error('serverId is required and must be a string');
          }
          return await this.getServerSettings(args.serverId);
        
        // Logging and Analytics
        case 'get_recent_logs':
          const limit = args && typeof args === 'object' && 'limit' in args && typeof args.limit === 'number' 
            ? args.limit 
            : 10;
          return await this.getRecentLogs(limit);
        case 'get_analytics_data':
          return await this.getAnalyticsData(args);
        
        // Dashboard and API
        case 'get_dashboard_stats':
          return await this.getDashboardStats(args);
        case 'get_api_endpoints':
          return await this.getApiEndpoints();
        case 'get_ticket_stats':
          return await this.getTicketStats(args);
        case 'get_giveaway_stats':
          return await this.getGiveawayStats(args);
        
        // System Health
        case 'get_system_health':
          return await this.getSystemHealth();
        case 'get_database_info':
          return await this.getDatabaseInfo();

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  // Bot Management Methods
  private async getBotStatus() {
    const status = {
      online: client.isReady(),
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      uptime: client.uptime,
      ping: client.ws.ping,
      apiStatus: await this.checkApiStatus(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }

  private async getBotStats() {
    if (!db) {
      throw new Error('Database not connected');
    }

    try {
      const stats: any = {
        totalServers: client.guilds.cache.size,
        totalUsers: client.users.cache.size,
        databaseStats: {},
        apiStats: await this.getApiStats(),
      };

      // Get database statistics
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{name: string}>;
      for (const table of tables) {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as {count: number};
        stats.databaseStats[table.name] = count.count;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get bot stats: ${error}`);
    }
  }

  private async getBotCommands() {
    try {
      const commandsPath = path.join(process.cwd(), 'src', 'commands');
      const commands: any[] = [];

      if (fs.existsSync(commandsPath)) {
        const categories = fs.readdirSync(commandsPath);
        
        for (const category of categories) {
          const categoryPath = path.join(commandsPath, category);
          if (fs.statSync(categoryPath).isDirectory()) {
            const files = fs.readdirSync(categoryPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
            
            for (const file of files) {
              const commandName = file.replace(/\.(ts|js)$/, '');
              commands.push({
                category,
                name: commandName,
                file: file,
              });
            }
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(commands, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get bot commands: ${error}`);
    }
  }

  // Server Management Methods
  private async getServerList() {
    const guilds = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(guilds, null, 2),
        },
      ],
    };
  }

  private async getServerInfo(serverId: string) {
    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      throw new Error(`Server with ID ${serverId} not found`);
    }

    const info = {
      id: guild.id,
      name: guild.name,
      description: guild.description,
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      createdAt: guild.createdAt.toISOString(),
      features: guild.features,
      roles: guild.roles.cache.size,
      channels: guild.channels.cache.size,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(info, null, 2),
        },
      ],
    };
  }

  private async getServerMembers(serverId: string) {
    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      throw new Error(`Server with ID ${serverId} not found`);
    }

    const members = guild.members.cache.map(member => ({
      id: member.id,
      username: member.user.username,
      displayName: member.displayName,
      joinedAt: member.joinedAt?.toISOString(),
      roles: member.roles.cache.map(role => ({
        id: role.id,
        name: role.name,
      })),
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(members, null, 2),
        },
      ],
    };
  }

  private async getServerSettings(serverId: string) {
    if (!db) {
      throw new Error('Database not connected');
    }

    try {
      const settings = db.prepare(`
        SELECT * FROM server_settings 
        WHERE server_id = ?
      `).get(serverId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(settings || {}, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get server settings: ${error}`);
    }
  }

  // Logging and Analytics Methods
  private async getRecentLogs(limit: number) {
    if (!db) {
      throw new Error('Database not connected');
    }

    try {
      const logs = db.prepare(`
        SELECT * FROM logs 
        ORDER BY timestamp DESC 
        LIMIT ?
      `).all(limit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(logs, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get recent logs: ${error}`);
    }
  }

  private async getAnalyticsData(args: any) {
    try {
      const serverId = args?.serverId || '';
      const timeframe = args?.timeframe || 'week';
      
      const response = await axios.get(`${API_BASE_URL}/api/analytics`, {
        params: { serverId, timeframe }
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get analytics data: ${error}`);
    }
  }

  // Dashboard and API Methods
  private async getDashboardStats(args: any) {
    try {
      const serverId = args?.serverId || '';
      
      const response = await axios.get(`${API_BASE_URL}/api/dashboard/stats`, {
        params: { serverId }
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get dashboard stats: ${error}`);
    }
  }

  private async getApiEndpoints() {
    try {
      const endpoints = [
        { path: '/api/auth', description: 'Authentication endpoints' },
        { path: '/api/servers', description: 'Server management endpoints' },
        { path: '/api/analytics', description: 'Analytics endpoints' },
        { path: '/api/dashboard', description: 'Dashboard endpoints' },
        { path: '/api/tickets', description: 'Ticket management endpoints' },
        { path: '/api/giveaways', description: 'Giveaway endpoints' },
        { path: '/api/logs', description: 'Logging endpoints' },
        { path: '/api/members', description: 'Member management endpoints' },
        { path: '/api/warnings', description: 'Warning system endpoints' },
        { path: '/api/activity', description: 'Activity tracking endpoints' },
      ];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(endpoints, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get API endpoints: ${error}`);
    }
  }

  private async getTicketStats(args: any) {
    try {
      const serverId = args?.serverId || '';
      
      const response = await axios.get(`${API_BASE_URL}/api/tickets/stats`, {
        params: { serverId }
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get ticket stats: ${error}`);
    }
  }

  private async getGiveawayStats(args: any) {
    try {
      const serverId = args?.serverId || '';
      
      const response = await axios.get(`${API_BASE_URL}/api/giveaways/stats`, {
        params: { serverId }
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get giveaway stats: ${error}`);
    }
  }

  // System Health Methods
  private async getSystemHealth() {
    try {
      const health = {
        bot: {
          online: client.isReady(),
          uptime: client.uptime,
          ping: client.ws.ping,
        },
        database: {
          connected: db !== null,
          tables: db ? db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length : 0,
        },
        api: {
          status: await this.checkApiStatus(),
          baseUrl: API_BASE_URL,
        },
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(health, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get system health: ${error}`);
    }
  }

  private async getDatabaseInfo() {
    if (!db) {
      throw new Error('Database not connected');
    }

    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{name: string}>;
      const dbInfo: any = {
        tables: [],
        totalRecords: 0,
      };

      for (const table of tables) {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as {count: number};
        dbInfo.tables.push({
          name: table.name,
          recordCount: count.count,
        });
        dbInfo.totalRecords += count.count;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(dbInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get database info: ${error}`);
    }
  }

  // Helper Methods
  private async checkApiStatus() {
    try {
      await axios.get(`${API_BASE_URL}/api/health`, { timeout: 5000 });
      return 'online';
    } catch (error) {
      return 'offline';
    }
  }

  private async getApiStats() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/stats`);
      return response.data;
    } catch (error) {
      return { error: 'API not available' };
    }
  }
}

// Create and run the server
const server = new EnhancedDiscordBotMCPServer();
const transport = new StdioServerTransport();
server.connect(transport);