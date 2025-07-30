import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

class SimpleClientMCPServer extends Server {
  constructor() {
    super({
      name: 'simple-client-mcp-server',
      version: '1.0.0',
    });
  }

  async initialize() {
    // Register tools
    this.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_dashboard_status',
            description: 'Get the current status of the React dashboard',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_api_status',
            description: 'Check the status of the backend API',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_client_info',
            description: 'Get basic information about the client application',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_api_endpoints',
            description: 'Get available API endpoints',
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
        case 'get_dashboard_status':
          return await this.getDashboardStatus();
        case 'get_api_status':
          return await this.getApiStatus();
        case 'get_client_info':
          return await this.getClientInfo();
        case 'get_api_endpoints':
          return await this.getApiEndpoints();
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async getDashboardStatus() {
    try {
      const status = {
        status: 'running',
        port: 3003,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        features: [
          'React Dashboard',
          'Real-time Updates',
          'API Integration',
          'User Management',
          'Server Monitoring'
        ]
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Failed to get dashboard status' }, null, 2),
          },
        ],
      };
    }
  }

  private async getApiStatus() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/status`, { timeout: 5000 });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'connected',
              apiUrl: API_BASE_URL,
              response: response.data,
              timestamp: new Date().toISOString()
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'disconnected',
              apiUrl: API_BASE_URL,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }, null, 2),
          },
        ],
      };
    }
  }

  private async getClientInfo() {
    const info = {
      name: 'Discord Bot Dashboard',
      version: '1.0.0',
      port: 3003,
      environment: process.env.NODE_ENV || 'development',
      apiUrl: API_BASE_URL,
      features: [
        'User Authentication',
        'Server Management',
        'Real-time Monitoring',
        'Analytics Dashboard',
        'Settings Management'
      ],
      technologies: [
        'React',
        'TypeScript',
        'Tailwind CSS',
        'Axios',
        'Socket.io'
      ]
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

  private async getApiEndpoints() {
    const endpoints = [
      {
        method: 'GET',
        path: '/api/status',
        description: 'Get API status'
      },
      {
        method: 'GET',
        path: '/api/servers',
        description: 'Get list of servers'
      },
      {
        method: 'GET',
        path: '/api/analytics',
        description: 'Get analytics data'
      },
      {
        method: 'GET',
        path: '/api/logs',
        description: 'Get system logs'
      },
      {
        method: 'POST',
        path: '/api/auth/login',
        description: 'User authentication'
      }
    ];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            baseUrl: API_BASE_URL,
            endpoints: endpoints,
            timestamp: new Date().toISOString()
          }, null, 2),
        },
      ],
    };
  }
}

const server = new SimpleClientMCPServer();
const transport = new StdioServerTransport();
server.connect(transport);