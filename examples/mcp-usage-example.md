# MCP Server Usage Examples

This document provides examples of how to use the Discord Bot MCP server with Claude Desktop.

## Setup

1. **Install Claude Desktop** (if not already installed)
2. **Copy the MCP configuration**:
   ```bash
   cp mcp-config.json ~/.config/claude-desktop/
   ```
3. **Set environment variables**:
   ```bash
   export DISCORD_TOKEN="your-discord-bot-token"
   ```
4. **Restart Claude Desktop**

## Example Interactions

### Getting Bot Status

**User**: "What's the current status of my Discord bot?"

**Claude**: I'll check the bot's status for you.

**Tool Call**: `get_bot_status()`

**Response**: 
```json
{
  "online": true,
  "guilds": 5,
  "users": 1250,
  "uptime": 86400000,
  "ping": 45
}
```

**Claude**: Your Discord bot is currently online and running smoothly! Here's the status:
- **Online Status**: ✅ Online
- **Servers**: 5 servers
- **Users**: 1,250 total users
- **Uptime**: 24 hours
- **Ping**: 45ms (excellent connection)

### Server Information

**User**: "Show me information about my main server"

**Claude**: I'll get a list of your servers first, then show detailed information about your main one.

**Tool Call**: `get_server_list()`

**Response**:
```json
[
  {
    "id": "123456789012345678",
    "name": "My Gaming Community",
    "memberCount": 500,
    "ownerId": "987654321098765432"
  },
  {
    "id": "234567890123456789",
    "name": "Development Team",
    "memberCount": 25,
    "ownerId": "876543210987654321"
  }
]
```

**Tool Call**: `get_server_info({"serverId": "123456789012345678"})`

**Response**:
```json
{
  "id": "123456789012345678",
  "name": "My Gaming Community",
  "description": "A friendly gaming community",
  "memberCount": 500,
  "ownerId": "987654321098765432",
  "createdAt": "2023-01-15T10:30:00.000Z",
  "features": ["COMMUNITY", "NEWS"],
  "roles": 15,
  "channels": 25
}
```

**Claude**: Here's detailed information about your main server "My Gaming Community":

**Server Details**:
- **Name**: My Gaming Community
- **Description**: A friendly gaming community
- **Members**: 500 members
- **Created**: January 15, 2023
- **Roles**: 15 roles configured
- **Channels**: 25 channels
- **Features**: Community server with news announcements

### Bot Statistics

**User**: "Give me a comprehensive overview of my bot's performance"

**Claude**: I'll gather comprehensive statistics about your bot's performance.

**Tool Call**: `get_bot_stats()`

**Response**:
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
  }
}
```

**Claude**: Here's a comprehensive overview of your bot's performance:

**Bot Overview**:
- **Total Servers**: 5 servers
- **Total Users**: 1,250 users across all servers

**Database Statistics**:
- **Logs**: 15,420 log entries
- **Server Settings**: 5 configured servers
- **Users**: 1,250 registered users
- **Warnings**: 45 moderation warnings issued
- **Tickets**: 12 support tickets created

### Recent Activity

**User**: "Show me the recent bot activity"

**Claude**: I'll retrieve the recent bot logs to show you the latest activity.

**Tool Call**: `get_recent_logs({"limit": 10})`

**Response**:
```json
[
  {
    "id": 15420,
    "timestamp": "2024-01-15T14:30:00.000Z",
    "level": "INFO",
    "message": "User @john_doe used command /warn",
    "server_id": "123456789012345678",
    "user_id": "111111111111111111"
  },
  {
    "id": 15419,
    "timestamp": "2024-01-15T14:25:00.000Z",
    "level": "INFO",
    "message": "New member @jane_smith joined server",
    "server_id": "123456789012345678",
    "user_id": "222222222222222222"
  }
]
```

**Claude**: Here are the 10 most recent bot activities:

**Recent Activity**:
1. **14:30** - User @john_doe used the `/warn` command
2. **14:25** - New member @jane_smith joined the server
3. **14:20** - Ticket #1234 was closed
4. **14:15** - User @admin_bob used `/kick` command
5. **14:10** - New giveaway created by @moderator_alice

### Command Management

**User**: "What commands does my bot have available?"

**Claude**: I'll get a list of all the commands your bot has available.

**Tool Call**: `get_bot_commands()`

**Response**:
```json
[
  {
    "category": "admin",
    "name": "ban",
    "file": "ban.ts"
  },
  {
    "category": "admin",
    "name": "kick",
    "file": "kick.ts"
  },
  {
    "category": "moderation",
    "name": "warn",
    "file": "warn.ts"
  },
  {
    "category": "utility",
    "name": "serverinfo",
    "file": "serverinfo.ts"
  },
  {
    "category": "utility",
    "name": "userinfo",
    "file": "userinfo.ts"
  }
]
```

**Claude**: Your bot has a comprehensive set of commands organized by category:

**Admin Commands**:
- `/ban` - Ban users from the server
- `/kick` - Kick users from the server

**Moderation Commands**:
- `/warn` - Issue warnings to users

**Utility Commands**:
- `/serverinfo` - Display server information
- `/userinfo` - Display user information

## Advanced Usage

### Monitoring Multiple Servers

You can monitor multiple servers simultaneously by using the server list and then getting detailed information for each one.

### Troubleshooting

If you encounter issues:
1. Check that your Discord token is valid
2. Ensure the database file exists
3. Verify the bot has proper permissions
4. Check the MCP server logs for errors

### Custom Tools

You can extend the MCP server by adding new tools in the `src/mcp/discord-bot-mcp-server.ts` file. Each tool should:
1. Be defined in the `tools` array
2. Have a corresponding handler in the switch statement
3. Include proper error handling
4. Return data in the correct MCP format

## Integration Tips

- **Regular Monitoring**: Use the bot status tool to monitor uptime
- **Server Management**: Use server info tools to track growth
- **Log Analysis**: Use recent logs to identify patterns
- **Performance Tracking**: Use bot stats to monitor usage trends