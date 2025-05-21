// Simple API server for the dashboard
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.API_PORT || 3001;

// Import server routes
const serverRoutes = require('./servers');

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3003'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-api-key']
}));

// API key middleware
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY || 'test-api-key';
  
  if (apiKey === validApiKey) {
    next();
  } else {
    console.log('Invalid API key:', apiKey);
    // For testing purposes, we'll allow requests without API key
    next();
    // In production, uncomment the following line
    // return res.status(401).json({ error: 'Invalid API key' });
  }
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'API server is running!' });
});

// Mount server routes
app.use('/servers', serverRoutes);

// Add a stats endpoint for the dashboard
app.get('/stats', (req, res) => {
  res.json({
    serverCount: 3,
    activeTickets: 3,
    activeWarnings: 3,
    commandsUsed: 10,
    recentActivity: [
      {
        id: 1,
        guild_id: '123456789',
        log_type: 'command',
        action: 'Command Used',
        details: 'User used the !help command',
        user_id: '987654321',
        user_name: 'TestUser#1234',
        timestamp: Date.now() - 1000 * 60 * 5,
        formatted_time: new Date(Date.now() - 1000 * 60 * 5).toLocaleString()
      },
      {
        id: 2,
        guild_id: '123456789',
        log_type: 'mod',
        action: 'Warning Added',
        details: 'User was warned for spamming',
        user_id: '987654321',
        user_name: 'TestUser#1234',
        timestamp: Date.now() - 1000 * 60 * 10,
        formatted_time: new Date(Date.now() - 1000 * 60 * 10).toLocaleString()
      },
      {
        id: 3,
        guild_id: '123456789',
        log_type: 'ticket',
        action: 'Ticket Created',
        details: 'User created a new ticket: Help needed',
        user_id: '987654321',
        user_name: 'TestUser#1234',
        timestamp: Date.now() - 1000 * 60 * 15,
        formatted_time: new Date(Date.now() - 1000 * 60 * 15).toLocaleString()
      }
    ]
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
