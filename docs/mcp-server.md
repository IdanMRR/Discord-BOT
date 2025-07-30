# Discord Bot MCP Server

This is a Model Context Protocol (MCP) server specifically designed for the Discord bot project. It provides tools for monitoring, managing, and analyzing the bot's performance and server data.

## Features

The MCP server provides the following tools:

### Bot Management
- **get_bot_status**: Get the current status of the Discord bot (online status, guild count, user count, uptime, ping)
- **get_bot_stats**: Get comprehensive bot statistics and analytics
- **get_bot_commands**: List all available bot commands organized by category

### Server Management
- **get_server_list**: Get a list of all servers the bot is in
- **get_server_info**: Get detailed information about a specific server
- **get_server_members**: Get member information for a specific server
- **get_server_settings**: Get server settings and configuration

### Logging and Analytics
- **get_recent_logs**: Get recent bot logs with configurable limit

## Installation

The MCP server is already installed with the following packages:
- `@modelcontextprotocol/sdk`: Core MCP SDK
- `@modelcontextprotocol/server-filesystem`: Filesystem access
- `@modelcontextprotocol/server-memory`: Memory and knowledge graph
- `mcp-starter`: Starter template

## Configuration

The MCP server is configured via `mcp-config.json`:

```json
{
  "mcpServers": {
    "discord-bot": {
      "command": "node",
      "args": ["dist/mcp/discord-bot-mcp-server.js"],
      "env": {
        "DISCORD_TOKEN": "${DISCORD_TOKEN}",
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Usage

### Starting the MCP Server

1. **Compile the TypeScript code:**
   ```bash
   npm run build
   ```

2. **Start the MCP server:**
   ```bash
   node scripts/start-mcp-server.js
   ```

3. **Or use the npm script:**
   ```bash
   npm run mcp:start
   ```

### Environment Variables

Make sure to set the following environment variables:
- `DISCORD_TOKEN`: Your Discord bot token
- `NODE_ENV`: Set to "production" for production use

### Integration with Claude Desktop

To use this MCP server with Claude Desktop:

1. Copy the `mcp-config.json` to your Claude Desktop configuration directory
2. Ensure the Discord bot is running and accessible
3. Restart Claude Desktop to load the new MCP servers

## Available Tools

### get_bot_status
Returns the current status of the Discord bot including:
- Online status
- Number of guilds
- Number of users
- Uptime
- Ping

### get_server_list
Returns a list of all servers the bot is in with:
- Server ID
- Server name
- Member count
- Owner ID

### get_server_info
Returns detailed information about a specific server:
- Server ID and name
- Description
- Member count
- Owner ID
- Creation date
- Features
- Role and channel counts

### get_bot_stats
Returns comprehensive bot statistics:
- Total servers and users
- Database statistics for all tables

### get_recent_logs
Returns recent bot logs from the database:
- Configurable limit (default: 10)
- Ordered by timestamp (newest first)

### get_server_members
Returns member information for a specific server:
- Member ID and username
- Display name
- Join date
- Roles

### get_bot_commands
Returns a list of all available bot commands:
- Organized by category
- Command names and files

### get_server_settings
Returns server settings and configuration from the database.

## Error Handling

The MCP server includes comprehensive error handling:
- Database connection errors
- Discord API errors
- File system errors
- Invalid server ID errors

## Development

### Adding New Tools

To add new tools to the MCP server:

1. Add the tool definition to the `tools` array in the `ListToolsRequestSchema` handler
2. Add the tool implementation in the `CallToolRequestSchema` handler
3. Create the corresponding private method
4. Update this documentation

### Testing

Test the MCP server by running:
```bash
npm run mcp:test
```

## Troubleshooting

### Common Issues

1. **Database connection failed**: Ensure the database file exists and is accessible
2. **Discord client login failed**: Check your Discord token is valid
3. **TypeScript compilation errors**: Run `npm run build` to recompile

### Logs

The MCP server logs to stdout and stderr. Check the console output for detailed error messages.

## Security

- The MCP server requires a valid Discord token
- Database access is restricted to read-only operations for security
- All sensitive data is handled securely through environment variables

## Support

For issues with the MCP server, check:
1. Discord bot logs
2. MCP server console output
3. Database connectivity
4. Environment variable configuration