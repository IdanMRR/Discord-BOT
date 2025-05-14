# Discord Bot Dashboard

A full-featured web dashboard for managing your Discord bot. Built with React, Material UI, and Express.

## Features

- **Server Management**: Manage bot settings across multiple Discord servers
- **Ticket System**: View ticket statistics, track performance, and configure ticket settings
- **Verification System**: Set up and customize user verification
- **Welcome Messages**: Configure custom welcome messages for new members
- **Discord Authentication**: Secure login using Discord OAuth2
- **Responsive Design**: Works on desktop and mobile devices

## Structure

This project consists of two main parts:

- **Frontend**: React application with Material UI
- **Backend**: Express API server that connects to your bot's SQLite database

## Prerequisites

- Node.js (v16+)
- Your Discord bot running with SQLite database
- Discord Application with OAuth2 credentials

## Setup

### Backend Configuration

1. Navigate to the backend directory:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with the following settings:

```
# Server settings
PORT=3001
NODE_ENV=development  # Change to 'production' for production deployment

# Discord OAuth2 settings
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_CALLBACK_URL=http://localhost:3001/api/auth/discord/callback

# Security settings
SESSION_SECRET=your_random_session_secret

# Frontend URL
CLIENT_URL=http://localhost:3000
```

### Frontend Configuration

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

## Development

To run the dashboard in development mode:

1. Start the backend server:

```bash
cd backend
npm start
```

2. In a separate terminal, start the frontend development server:

```bash
cd frontend
npm start
```

3. Visit http://localhost:3000 in your browser

## Production Deployment

For production deployment:

1. Build the frontend:

```bash
cd frontend
npm run build
```

2. Start the backend server in production mode:

```bash
cd backend
NODE_ENV=production npm start
```

The backend will serve the built frontend files.

## Connecting to Your Bot

This dashboard is designed to connect directly to your bot's SQLite database. Ensure your bot is running and the database is accessible to the dashboard backend.

By default, the dashboard looks for the database at `../../data/database.sqlite` relative to the backend directory. You can modify this path in the `backend/routes/api.js` file.

## Discord OAuth2 Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to OAuth2 settings
4. Add a redirect URL: `http://localhost:3001/api/auth/discord/callback` (for development)
5. Copy your Client ID and Client Secret to the `.env` file

## Security Considerations

- Never expose your SQLite database file directly to the internet
- Set a strong SESSION_SECRET in production
- Use HTTPS in production
- Consider implementing rate limiting for API endpoints

## License

This project is licensed under the MIT License - see the LICENSE file for details. 