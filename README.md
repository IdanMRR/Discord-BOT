# Discord Bot with Simplified Dashboard

This is a Discord bot with a simplified dashboard that directly accesses your bot's database.

## Why this approach?

The previous dashboard was complex because it used:
1. A separate backend API layer
2. Authentication systems
3. Complex state management
4. Multiple server components

This simplified version:
- Reads directly from your bot's SQLite database file
- Runs as a single process
- Requires no separate backend
- Is much easier to set up and maintain

## Getting Started

### 1. Set up the bot

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Deploy slash commands
npm run deploy-commands

# Start the bot
npm start
```

### 2. Set up the dashboard

```bash
# Set up the dashboard (one-time setup)
npm run setup-dashboard

# Start the dashboard
npm run dashboard
```

The dashboard will be available at http://localhost:3000

## Features

- Server management
- User warnings
- Ticket system
- Welcome message configuration
- Log channel settings

## How it works

The dashboard is a React application that directly reads from and writes to the bot's SQLite database file. This eliminates the need for a separate backend API server.

When you make changes in the dashboard, they're immediately reflected in the database, and the bot will use these settings the next time it needs them.

## Customization

You can customize the dashboard by editing the files in the `simple-dashboard` directory. The dashboard is built with React and uses styled-components for styling.

## AI Chatbot Setup

The ticket system includes an AI chatbot feature powered by OpenAI. To enable it:

1. Get an API key from [OpenAI's platform](https://platform.openai.com/)
2. Add the key to your `.env` file as shown above
3. Use the `/toggle-ai-chatbot enabled:true` command in Discord
4. If the key is missing, the bot will automatically fall back to keyword-based responses

## Development

- **Build**: `npm run build`
- **Development Mode**: `npm run dev`
- **Watch Mode**: `npm run watch`
- **Deploy Commands**: `npm run deploy-commands`
- **Clear Commands**: `npm run clear-commands`
- **Reset Commands**: `npm run reset-commands`

## Maintenance

To fix common issues in the codebase:

```
node fix-all.js
```

This script will automatically scan for and fix:
- Ephemeral message deprecation warnings
- Duplicate imports
- Missing imports

## Database

The bot uses SQLite for data storage. Database file is located at `src/database/database.db`.

## License

ISC License 