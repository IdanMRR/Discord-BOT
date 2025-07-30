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

// MCP Server implementation
class DiscordBotMCPServer extends Server {
  constructor() {
    super({
      name: 'discord-bot-mcp-server',
      version: '1.0.0',
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

    // Register tools
    this.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_bot_status',
            description: 'Get the current status of the Discord bot',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
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
            name: 'get_bot_stats',
            description: 'Get bot statistics and analytics',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
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
            name: 'get_bot_commands',
            description: 'Get a list of available bot commands',
            inputSchema: {
              type: 'object',
              properties: {},
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
        ],
      };
    });

    this.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_bot_status':
          return await this.getBotStatus();

        case 'get_server_list':
          return await this.getServerList();

        case 'get_server_info':
          if (!args || typeof args !== 'object' || !('serverId' in args) || typeof args.serverId !== 'string') {
            throw new Error('serverId is required and must be a string');
          }
          return await this.getServerInfo(args.serverId);

        case 'get_bot_stats':
          return await this.getBotStats();

        case 'get_recent_logs':
          const limit = args && typeof args === 'object' && 'limit' in args && typeof args.limit === 'number' 
            ? args.limit 
            : 10;
          return await this.getRecentLogs(limit);

        case 'get_server_members':
          if (!args || typeof args !== 'object' || !('serverId' in args) || typeof args.serverId !== 'string') {
            throw new Error('serverId is required and must be a string');
          }
          return await this.getServerMembers(args.serverId);

        case 'get_bot_commands':
          return await this.getBotCommands();

        case 'get_server_settings':
          if (!args || typeof args !== 'object' || !('serverId' in args) || typeof args.serverId !== 'string') {
            throw new Error('serverId is required and must be a string');
          }
          return await this.getServerSettings(args.serverId);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async getBotStatus() {
    const status = {
      online: client.isReady(),
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      uptime: client.uptime,
      ping: client.ws.ping,
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

  private async getBotStats() {
    if (!db) {
      throw new Error('Database not connected');
    }

    try {
      // Get various statistics from the database
      const stats: any = {
        totalServers: client.guilds.cache.size,
        totalUsers: client.users.cache.size,
        databaseStats: {},
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
}

// Create and run the server
const server = new DiscordBotMCPServer();
const transport = new StdioServerTransport();
server.connect(transport);