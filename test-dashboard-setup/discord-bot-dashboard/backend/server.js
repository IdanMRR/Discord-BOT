// backend/server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const apiRoutes = require('./routes/api');

// Simple database simulation for testing
const db = {
  prepare: (query) => {
    return {
      get: (params) => {
        console.log('Database GET query:', query, 'params:', params);
        // Return mock data based on the query
        if (query.includes('server_settings')) {
          return { 
            guild_id: params, 
            prefix: '!',
            welcome_channel_id: '123456789',
            ticket_logs_channel_id: '987654321'
          };
        }
        return null;
      },
      all: (params) => {
        console.log('Database ALL query:', query, 'params:', params);
        // Return mock data
        if (query.includes('tickets')) {
          return [
            { 
              ticket_number: 1, 
              guild_id: params, 
              user_id: '123456', 
              subject: 'Help Request', 
              status: 'closed',
              created_at: new Date().toISOString(),
              closed_at: new Date().toISOString(),
              rating: 5,
              feedback: 'Excellent support!'
            },
            { 
              ticket_number: 2, 
              guild_id: params, 
              user_id: '654321', 
              subject: 'Bug Report', 
              status: 'closed',
              created_at: new Date().toISOString(),
              closed_at: new Date().toISOString(),
              rating: 3,
              feedback: 'Good but could be faster'
            }
          ];
        }
        if (query.includes('rating')) {
          return [
            { rating: 1, count: 2 },
            { rating: 2, count: 3 },
            { rating: 3, count: 7 },
            { rating: 4, count: 10 },
            { rating: 5, count: 15 }
          ];
        }
        return [];
      },
      run: (...args) => {
        console.log('Database RUN:', query, 'args:', args);
        return true;
      }
    };
  }
};

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60000 * 60 * 24 // 1 day
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Discord strategy
passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3001/api/auth/discord/callback',
  scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
  // Store user in session
  return done(null, profile);
}));

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Auth middleware
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // For development mode, bypass authentication
  if (process.env.NODE_ENV === 'development') {
    console.log('Auth check bypassed for development');
    req.user = {
      id: '12345',
      username: 'TestUser',
      discriminator: '1234',
      avatar: null,
      guilds: [
        {
          id: '123456789012345678',
          name: 'Test Server',
          icon: null,
          owner: true,
          permissions: 0x20
        },
        {
          id: '876543210987654321',
          name: 'Another Server',
          icon: null,
          owner: false,
          permissions: 0x20
        }
      ]
    };
    return next();
  }
  
  // If we're in production and not authenticated
  res.status(401).json({ error: 'Not authenticated' });
};

// Auth routes
app.get('/api/auth/discord', passport.authenticate('discord'));
app.get('/api/auth/discord/callback', 
  passport.authenticate('discord', { 
    failureRedirect: '/api/auth/failed' 
  }), 
  (req, res) => {
    res.redirect(process.env.CLIENT_URL || 'http://localhost:3000');
  }
);

app.get('/api/auth/user', isAuthenticated, (req, res) => {
  res.json(req.user);
});

app.get('/api/auth/logout', (req, res) => {
  if (req.logout) {
    req.logout((err) => {
      if (err) { return next(err); }
      res.redirect(process.env.CLIENT_URL || 'http://localhost:3000');
    });
  } else {
    // Fallback for older versions
    req.session.destroy();
    res.redirect(process.env.CLIENT_URL || 'http://localhost:3000');
  }
});

// Use API routes
app.use('/api', apiRoutes);

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  // Handle any requests that don't match the API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
});
