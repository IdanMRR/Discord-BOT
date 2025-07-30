# Client Dashboard MCP Server

This is a Model Context Protocol (MCP) server specifically designed for your React client dashboard that provides tools for monitoring and managing the frontend application.

## Architecture Overview

The client MCP server integrates with your React dashboard:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React Client   │    │   API Backend   │    │   Discord Bot   │
│   (Dashboard)   │◄──►│   (Express.js)  │◄──►│   (Discord.js)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   SQLite DB     │
                    │   (Shared)      │
                    └─────────────────┘
```

## Client MCP Server Features

The client MCP server provides comprehensive tools for monitoring your React dashboard:

### 🎯 Dashboard Tools
- **`get_dashboard_status`**: Real-time dashboard status and performance
- **`get_dashboard_stats`**: Dashboard statistics from API
- **`get_user_sessions`**: User authentication and session management

### 🔌 API Integration Tools
- **`get_api_status`**: Check API connectivity and status
- **`get_api_endpoints`**: List available API endpoints
- **`get_server_list`**: Get server list from API

### 📊 Analytics Tools
- **`get_analytics_data`**: Analytics data from API
- **`get_user_activity`**: User activity and engagement metrics

### ⚛️ Component Tools
- **`get_component_status`**: React component monitoring
- **`get_routing_info`**: Current routing information

### 📈 Performance Tools
- **`get_performance_metrics`**: Client-side performance monitoring
- **`get_error_logs`**: Error logging and tracking

### ⚙️ Configuration Tools
- **`get_client_config`**: Client configuration and settings
- **`get_environment_info`**: Environment information

## Installation & Setup

### 1. Prerequisites
- Node.js and npm installed
- React client running (typically on port 3002)
- API backend running (typically on port 3001)

### 2. Environment Variables
Create a `.env` file in your client directory:

```env
REACT_APP_API_URL=http://localhost:3001
NODE_ENV=development
```

### 3. Build and Start

```bash
# Navigate to client directory
cd client

# Build the client MCP server
npm run mcp:build

# Start the client MCP server
npm run mcp:start

# Or run in development mode
npm run mcp:dev

# Test the client MCP server
npm run mcp:test
```

## Configuration

The client MCP server is configured via `client/mcp-config.json`:

```json
{
  "mcpServers": {
    "client-dashboard": {
      "command": "node",
      "args": ["dist/mcp/client-mcp-server.js"],
      "env": {
        "REACT_APP_API_URL": "http://localhost:3001",
        "NODE_ENV": "development"
      }
    }
  }
}
```

## Available Tools

### Dashboard Management

#### `get_dashboard_status`
Returns comprehensive dashboard status:
```json
{
  "client": {
    "version": "1.0.0",
    "environment": "development",
    "apiUrl": "http://localhost:3001"
  },
  "api": {
    "status": "online",
    "baseUrl": "http://localhost:3001"
  },
  "performance": {
    "loadTime": 1234.56,
    "memoryUsage": 52428800
  }
}
```

#### `get_dashboard_stats`
Returns dashboard statistics from API:
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

#### `get_user_sessions`
Returns user session information:
```json
{
  "isAuthenticated": true,
  "userInfo": {
    "id": "123456789",
    "username": "admin",
    "role": "admin"
  },
  "sessionData": {
    "lastActivity": "2024-01-15T14:30:00.000Z",
    "permissions": ["read", "write", "admin"]
  },
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

### API Integration

#### `get_api_status`
Returns API connectivity status:
```json
{
  "status": "online",
  "baseUrl": "http://localhost:3001",
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

#### `get_api_endpoints`
Returns available API endpoints:
```json
[
  { "path": "/api/auth", "description": "Authentication endpoints" },
  { "path": "/api/servers", "description": "Server management endpoints" },
  { "path": "/api/analytics", "description": "Analytics endpoints" },
  { "path": "/api/dashboard", "description": "Dashboard endpoints" },
  { "path": "/api/tickets", "description": "Ticket management endpoints" },
  { "path": "/api/giveaways", "description": "Giveaway endpoints" },
  { "path": "/api/logs", "description": "Logging endpoints" },
  { "path": "/api/members", "description": "Member management endpoints" },
  { "path": "/api/warnings", "description": "Warning system endpoints" },
  { "path": "/api/activity", "description": "Activity tracking endpoints" }
]
```

### Analytics

#### `get_analytics_data`
Returns analytics data from API:
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

#### `get_user_activity`
Returns user activity metrics:
```json
{
  "serverId": "123456789012345678",
  "activity": {
    "activeUsers": 125,
    "newUsers": 8,
    "messageCount": 1250,
    "commandUsage": 89,
    "averageSessionTime": 1800
  }
}
```

### Component Monitoring

#### `get_component_status`
Returns React component status:
```json
{
  "componentName": "Dashboard",
  "mounted": true,
  "renderCount": 1,
  "props": {},
  "state": {},
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

#### `get_routing_info`
Returns current routing information:
```json
{
  "currentPath": "/dashboard",
  "currentHash": "",
  "searchParams": "?server=123456789012345678",
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

### Performance Monitoring

#### `get_performance_metrics`
Returns client-side performance metrics:
```json
{
  "loadTime": 1234.56,
  "memoryUsage": {
    "used": 52428800,
    "total": 104857600,
    "limit": 2147483648
  },
  "navigationTiming": {
    "domContentLoaded": 500,
    "loadComplete": 1200
  },
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

#### `get_error_logs`
Returns client-side error logs:
```json
[
  {
    "id": 1,
    "timestamp": "2024-01-15T14:30:00.000Z",
    "level": "info",
    "message": "Client MCP server initialized",
    "component": "ClientMCPServer"
  }
]
```

### Configuration

#### `get_client_config`
Returns client configuration:
```json
{
  "apiUrl": "http://localhost:3001",
  "environment": "development",
  "version": "1.0.0",
  "features": {
    "analytics": true,
    "realTimeUpdates": true,
    "errorTracking": true
  },
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

#### `get_environment_info`
Returns environment information:
```json
{
  "nodeEnv": "development",
  "apiUrl": "http://localhost:3001",
  "userAgent": "Mozilla/5.0...",
  "platform": "Win32",
  "language": "en-US",
  "cookieEnabled": true,
  "onLine": true,
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

## Integration with Your React Dashboard

### Dashboard Integration
The client MCP server integrates with your React dashboard through:
- Real-time status monitoring
- Performance metrics collection
- Error tracking and logging
- User session management
- Component state monitoring

### API Integration
Seamless integration with your backend API:
- Authentication status
- Server data retrieval
- Analytics data fetching
- Real-time updates

### Browser Integration
Access to browser APIs for:
- Performance monitoring
- Memory usage tracking
- Navigation timing
- User agent information
- Session storage management

## Usage Examples

### Monitoring Dashboard Performance
```bash
# Get dashboard status
get_dashboard_status()

# Get performance metrics
get_performance_metrics()

# Get error logs
get_error_logs({"limit": 10})
```

### User Session Management
```bash
# Get user sessions
get_user_sessions()

# Get user activity
get_user_activity({"serverId": "123456789012345678"})
```

### API Integration
```bash
# Check API status
get_api_status()

# Get server list
get_server_list()

# Get analytics data
get_analytics_data({"serverId": "123456789012345678", "timeframe": "week"})
```

### Component Monitoring
```bash
# Get component status
get_component_status({"componentName": "Dashboard"})

# Get routing info
get_routing_info()
```

## Advanced Features

### Real-time Monitoring
The client MCP server provides real-time monitoring of:
- Dashboard performance and load times
- Memory usage and browser performance
- API connectivity and response times
- User session activity
- React component lifecycle

### Error Tracking
Comprehensive error tracking for:
- JavaScript runtime errors
- API request failures
- Component rendering errors
- Network connectivity issues
- Performance degradation

### Performance Optimization
Built-in performance monitoring:
- Page load times
- Memory usage tracking
- Component render optimization
- API response time monitoring
- User interaction metrics

## Troubleshooting

### Common Issues

1. **API Connection Failed**
   - Check if your API is running on the correct port
   - Verify `REACT_APP_API_URL` environment variable
   - Ensure API endpoints are accessible

2. **Client Build Issues**
   - Verify TypeScript compilation
   - Check for missing dependencies
   - Ensure proper module resolution

3. **Performance Issues**
   - Monitor memory usage
   - Check for memory leaks
   - Optimize component rendering

4. **Authentication Issues**
   - Verify user session data
   - Check authentication tokens
   - Ensure proper CORS configuration

### Debugging

Enable debug mode by setting:
```env
NODE_ENV=development
DEBUG=mcp:*
```

### Logs
Check logs in:
- Console output for MCP server logs
- Browser developer tools for client errors
- Network tab for API request logs

## Security Considerations

- **Session Security**: User sessions are handled securely
- **API Security**: Uses existing API authentication
- **Data Privacy**: No sensitive data is exposed
- **CORS Configuration**: Proper cross-origin setup

## Performance Optimization

- **Caching**: Intelligent caching of API responses
- **Lazy Loading**: Component-level code splitting
- **Memory Management**: Efficient memory usage
- **Error Boundaries**: Graceful error handling

## Future Enhancements

Potential improvements:
- WebSocket integration for real-time updates
- Advanced analytics and reporting
- Machine learning integration
- Automated performance optimization
- Advanced error tracking
- User behavior analytics

## Support

For issues with the client MCP server:
1. Check the troubleshooting section above
2. Review browser console logs
3. Verify API connectivity
4. Test individual components
5. Check environment configuration