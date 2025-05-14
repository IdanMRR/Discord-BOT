// backend/mock/mockDatabase.js
// Mock database that simulates the SQLite methods

const mockGuilds = [
  { guild_id: "123456789012345678", name: "Test Server" },
  { guild_id: "876543210987654321", name: "Another Server" }
];

const mockSettings = {
  "123456789012345678": {
    id: 1,
    guild_id: "123456789012345678",
    name: "Test Server",
    log_channel_id: "111222333444555666",
    mod_log_channel_id: "222333444555666777",
    member_log_channel_id: "333444555666777888",
    message_log_channel_id: "444555666777888999",
    server_log_channel_id: "555666777888999000",
    welcome_channel_id: "666777888999000111",
    welcome_message: "Welcome {user} to {server}!",
    ticket_category_id: "777888999000111222",
    staff_role_ids: "888999000111222333,999000111222333444",
    auto_mod_enabled: 1,
    auto_mod_settings: "{}",
    ticket_panel_channel_id: "000111222333444555",
    ticket_panel_message_id: "111222333444555666",
    language: "en",
    ticket_logs_channel_id: "222333444555666777",
    rules_channel_id: "333444555666777888",
    templates: "{}",
    active_templates: "{}",
    member_events_config: null,
    weather_channel_id: null,
    custom_cities: null,
    weather_schedule: null,
    red_alert_channels: "[]"
  },
  "876543210987654321": {
    id: 2,
    guild_id: "876543210987654321",
    name: "Another Server",
    log_channel_id: "444555666777888999",
    mod_log_channel_id: null,
    member_log_channel_id: null,
    message_log_channel_id: null,
    server_log_channel_id: null,
    welcome_channel_id: null,
    welcome_message: "Welcome to our server, {user}!",
    ticket_category_id: null,
    staff_role_ids: null,
    auto_mod_enabled: 0,
    auto_mod_settings: "{}",
    ticket_panel_channel_id: null,
    ticket_panel_message_id: null,
    language: "en",
    ticket_logs_channel_id: null,
    rules_channel_id: null,
    templates: "{}",
    active_templates: "{}",
    member_events_config: null,
    weather_channel_id: null,
    custom_cities: null,
    weather_schedule: null,
    red_alert_channels: "[]"
  }
};

const mockTickets = [
  {
    id: 1,
    ticket_number: 1,
    guild_id: "123456789012345678",
    user_id: "111222333444555666",
    subject: "Help with bot setup",
    status: "open",
    created_at: "2023-04-01T12:00:00Z",
    closed_at: null,
    closed_by: null,
    rating: null,
    feedback: null
  },
  {
    id: 2,
    ticket_number: 2,
    guild_id: "123456789012345678",
    user_id: "222333444555666777",
    subject: "Bot isn't responding",
    status: "closed",
    created_at: "2023-04-02T12:00:00Z",
    closed_at: "2023-04-02T15:30:00Z",
    closed_by: "333444555666777888",
    rating: 5,
    feedback: "Great support!"
  }
];

// Mock implementation of the SQLite methods
const mockDb = {
  prepare: (query) => {
    console.log('Mock DB Query:', query);
    
    return {
      get: (param) => {
        if (query.includes('FROM server_settings WHERE guild_id')) {
          return mockSettings[param] || null;
        }
        
        if (query.includes('FROM verification_settings WHERE guild_id')) {
          return {
            guild_id: param,
            enabled: 1,
            type: 'form',
            role_id: "123456789012345678",
            channel_id: "234567890123456789",
            custom_questions: JSON.stringify([
              { question: "How old are you?", type: "text" },
              { question: "Have you read the rules?", type: "boolean" }
            ])
          };
        }
        
        if (query.includes('FROM sqlite_master')) {
          return { name: 'verification_settings' };
        }
        
        return null;
      },
      
      all: (param) => {
        if (query.includes('SELECT DISTINCT guild_id FROM server_settings')) {
          return mockGuilds;
        }
        
        if (query.includes('FROM tickets WHERE guild_id')) {
          return mockTickets.filter(t => t.guild_id === param);
        }
        
        if (query.includes('SELECT status, COUNT(*) as count')) {
          return [
            { status: 'open', count: 1 },
            { status: 'closed', count: 1 }
          ];
        }
        
        if (query.includes('SELECT COUNT(*) as total')) {
          return [{ total: 2 }];
        }
        
        if (query.includes('SELECT rating, COUNT(*) as count')) {
          return [
            { rating: 5, count: 1 },
            { rating: 4, count: 0 },
            { rating: 3, count: 0 },
            { rating: 2, count: 0 },
            { rating: 1, count: 0 }
          ];
        }
        
        return [];
      },
      
      run: (...args) => {
        console.log('Mock DB Run:', query, args);
        return { changes: 1 };
      }
    };
  }
};

module.exports = mockDb; 