# Discord Bot

A feature-rich Discord bot built with TypeScript, featuring ticket management, verification, and moderation capabilities.

## Features

- **Command System**: Slash commands for easy interaction
- **Ticket System**: User support ticket creation and management
- **Verification System**: User verification with CAPTCHA
- **Moderation Tools**: Moderation commands for server management
- **API Integration**: Express server for external integrations

## Setup and Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_bot_client_id
   TEST_GUILD_ID=optional_test_guild_id
   ```
4. Build the project:
   ```
   npm run build
   ```
5. Deploy commands:
   ```
   npm run deploy-commands
   ```
6. Start the bot:
   ```
   npm start
   ```

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