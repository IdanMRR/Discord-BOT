# Enhanced Discord Bot MCP Server

This is an enhanced Model Context Protocol (MCP) server specifically designed for your Discord bot project that integrates with your existing API backend and React client frontend.

## Architecture Overview

Your Discord bot project has a sophisticated architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discord Bot   │    │   API Backend   │    │  React Client   │
│   (Discord.js)  │◄──►│   (Express.js)  │◄──►│   (Frontend)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   SQLite DB     │
                    │   (Shared)      │
                    └─────────────────┘
```

## Enhanced MCP Server Features

The enhanced MCP server provides comprehensive tools that integrate with all components of your system:

### 🔧 Bot Management Tools
- **`get_bot_status`**: Real-time bot status including API connectivity
- **`get_bot_stats`**: Comprehensive statistics from bot, database, and API
- **`get_bot_commands`**: List all available bot commands by category

### 🏠 Server Management Tools
- **`get_server_list`**: List all Discord servers the bot is in
- **`get_server_info`**: Detailed server information
- **`get_server_members`**: Member information for specific servers
- **`get_server_settings`**: Server configuration from database

### 📊 Analytics & Dashboard Tools
- **`get_analytics_data`**: Analytics data from your API endpoints
- **`get_dashboard_stats`**: Dashboard statistics from the React client API
- **`get_ticket_stats`**: Ticket system statistics
- **`get_giveaway_stats`**: Giveaway system statistics

### 📝 Logging & Monitoring Tools
- **`get_recent_logs`**: Recent bot logs from database
- **`get_api_endpoints`**: List all available API endpoints
- **`get_system_health`**: Overall system health monitoring
- **`get_database_info`**: Database statistics and table information

## Installation & Setup

### 1. Prerequisites
- Node.js and npm installed
- Discord bot token configured
- API backend running (typically on port 3001)
- React client running (typically on port 3000)

### 2. Environment Variables
Create a `.env` file in your project root:

```env
DISCORD_TOKEN=your_discord_bot_token_here
API_BASE_URL=http://localhost:3001
NODE_ENV=production
```

### 3. Build and Start

```bash
# Build the enhanced MCP server
npm run build

# Start the enhanced MCP server
npm run mcp:enhanced

# Or run in development mode
npm run mcp:enhanced:dev

# Test the enhanced MCP server
npm run mcp:enhanced:test
```

## Configuration

The enhanced MCP server is configured via `mcp-config.json`:

```json
{
  "mcpServers": {
    "enhanced-discord-bot": {
      "command": "node",
      "args": ["dist/mcp/enhanced-discord-bot-mcp-server.js"],
      "env": {
        "DISCORD_TOKEN": "${DISCORD_TOKEN}",
        "API_BASE_URL": "http://localhost:3001",
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Available Tools

### Bot Management

#### `get_bot_status`
Returns comprehensive bot status including API connectivity:
```json
{
  "online": true,
  "guilds": 5,
  "users": 1250,
  "uptime": 86400000,
  "ping": 45,
  "apiStatus": "online"
}
```

#### `get_bot_stats`
Returns comprehensive statistics from all system components:
```json
{
  "totalServers": 5,
  "totalUsers": 1250,
  "databaseStats": {
    "logs": 15420,
    "server_settings": 5,
    "users": 1250,
    "warnings": 45,
    "tickets": 12
  },
  "apiStats": {
    "endpoints": 15,
    "activeConnections": 3,
    "responseTime": 45
  }
}
```

### Analytics & Dashboard

#### `get_analytics_data`
Retrieves analytics data from your API:
```json
{
  "serverId": "123456789012345678",
  "timeframe": "week",
  "data": {
    "memberGrowth": 15,
    "messageActivity": 1250,
    "commandUsage": 89,
    "ticketVolume": 12
  }
}
```

#### `get_dashboard_stats`
Gets dashboard statistics from your React client API:
```json
{
  "serverId": "123456789012345678",
  "stats": {
    "totalMembers": 500,
    "activeUsers": 125,
    "recentActivity": 45,
    "moderationActions": 8
  }
}
```

### System Health

#### `get_system_health`
Comprehensive system health monitoring:
```json
{
  "bot": {
    "online": true,
    "uptime": 86400000,
    "ping": 45
  },
  "database": {
    "connected": true,
    "tables": 12
  },
  "api": {
    "status": "online",
    "baseUrl": "http://localhost:3001"
  },
  "memory": {
    "used": 52428800,
    "total": 104857600
  }
}
```

## Integration with Your Existing System

### API Integration
The enhanced MCP server integrates with your existing API endpoints:

- **Authentication**: `/api/auth`
- **Server Management**: `/api/servers`
- **Analytics**: `/api/analytics`
- **Dashboard**: `/api/dashboard`
- **Tickets**: `/api/tickets`
- **Giveaways**: `/api/giveaways`
- **Logs**: `/api/logs`
- **Members**: `/api/members`
- **Warnings**: `/api/warnings`
- **Activity**: `/api/activity`

### Database Integration
Direct access to your SQLite database for:
- Server settings
- User data
- Logs
- Warnings
- Tickets
- Giveaways
- Analytics data

### Client Integration
Integration with your React client through:
- Dashboard statistics
- Real-time data
- User interface metrics
- Performance monitoring

## Usage Examples

### Monitoring Bot Performance
```bash
# Get comprehensive bot status
get_bot_status()

# Get detailed statistics
get_bot_stats()

# Check system health
get_system_health()
```

### Server Management
```bash
# List all servers
get_server_list()

# Get server details
get_server_info({"serverId": "123456789012345678"})

# Get server members
get_server_members({"serverId": "123456789012345678"})
```

### Analytics & Dashboard
```bash
# Get analytics data
get_analytics_data({"serverId": "123456789012345678", "timeframe": "week"})

# Get dashboard stats
get_dashboard_stats({"serverId": "123456789012345678"})

# Get ticket statistics
get_ticket_stats({"serverId": "123456789012345678"})
```

## Advanced Features

### Real-time Monitoring
The enhanced MCP server provides real-time monitoring of:
- Bot connectivity and performance
- API endpoint availability
- Database health and performance
- Memory usage and system resources
- Client dashboard activity

### Cross-Component Integration
Seamless integration between:
- Discord bot functionality
- API backend services
- React client dashboard
- SQLite database
- External services

### Error Handling
Comprehensive error handling for:
- Discord API failures
- Database connection issues
- API endpoint timeouts
- Client connectivity problems
- System resource issues

## Troubleshooting

### Common Issues

1. **API Connection Failed**
   - Check if your API is running on the correct port
   - Verify `API_BASE_URL` environment variable
   - Ensure API endpoints are accessible

2. **Database Connection Issues**
   - Verify database file exists in `data/discord-bot.db`
   - Check file permissions
   - Ensure database is not locked by another process

3. **Discord Bot Issues**
   - Verify `DISCORD_TOKEN` is valid
   - Check bot permissions
   - Ensure bot is properly configured

4. **Client Integration Issues**
   - Verify React client is running
   - Check CORS configuration
   - Ensure API endpoints are properly configured

### Debugging

Enable debug mode by setting:
```env
NODE_ENV=development
DEBUG=mcp:*
```

### Logs
Check logs in:
- Console output for MCP server logs
- `logs/` directory for application logs
- Database logs in `data/discord-bot.db`

## Security Considerations

- **Token Security**: Discord tokens are handled securely through environment variables
- **Database Access**: Read-only access to prevent data corruption
- **API Security**: Uses existing API authentication mechanisms
- **Network Security**: All communications use HTTPS where applicable

## Performance Optimization

- **Caching**: Intelligent caching of frequently accessed data
- **Connection Pooling**: Efficient database connection management
- **Async Operations**: Non-blocking API calls and database queries
- **Memory Management**: Efficient memory usage and garbage collection

## Future Enhancements

Potential improvements:
- WebSocket integration for real-time updates
- Advanced analytics and reporting
- Machine learning integration
- Automated monitoring and alerting
- Multi-server cluster support
- Advanced security features

## Support

For issues with the enhanced MCP server:
1. Check the troubleshooting section above
2. Review console logs and error messages
3. Verify all components are running correctly
4. Test individual components separately
5. Check environment variable configuration