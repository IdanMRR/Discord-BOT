const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

// Guild ID from your env
const guildId = '1368637479653216297';

// Add some test raw analytics data
console.log('Adding test analytics data...');

// Insert test server analytics
const insertAnalytics = db.prepare(`
  INSERT INTO server_analytics (guild_id, metric_type, channel_id, user_id, command_name, value, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Add data for the last 7 days
for (let day = 0; day < 7; day++) {
  const date = new Date();
  date.setDate(date.getDate() - day);
  const dateStr = date.toISOString();
  
  // Add messages
  for (let i = 0; i < 50; i++) {
    insertAnalytics.run(guildId, 'message_count', `channel_${i % 5}`, `user_${i % 10}`, null, Math.floor(Math.random() * 5) + 1, dateStr);
  }
  
  // Add commands
  for (let i = 0; i < 20; i++) {
    insertAnalytics.run(guildId, 'command_usage', `channel_${i % 3}`, `user_${i % 8}`, `cmd_${i % 6}`, 1, dateStr);
  }
  
  // Add member joins/leaves
  insertAnalytics.run(guildId, 'member_join', null, `new_user_${day}_${Math.random()}`, null, 1, dateStr);
  if (Math.random() > 0.7) {
    insertAnalytics.run(guildId, 'member_leave', null, `left_user_${day}_${Math.random()}`, null, 1, dateStr);
  }
}

// Now aggregate the data into daily stats
console.log('Aggregating daily stats...');

const aggregateDaily = db.prepare(`
  INSERT OR REPLACE INTO daily_server_stats 
  (guild_id, date, total_messages, total_commands, new_members, left_members, peak_online, total_members, active_members, voice_minutes, reactions_given)
  SELECT 
    guild_id,
    DATE(created_at) as date,
    SUM(CASE WHEN metric_type = 'message_count' THEN value ELSE 0 END) as total_messages,
    SUM(CASE WHEN metric_type = 'command_usage' THEN value ELSE 0 END) as total_commands,
    SUM(CASE WHEN metric_type = 'member_join' THEN value ELSE 0 END) as new_members,
    SUM(CASE WHEN metric_type = 'member_leave' THEN value ELSE 0 END) as left_members,
    100 + CAST(RANDOM() % 50 AS INTEGER) as peak_online,
    150 + CAST(RANDOM() % 50 AS INTEGER) as total_members,
    50 + CAST(RANDOM() % 30 AS INTEGER) as active_members,
    300 + CAST(RANDOM() % 200 AS INTEGER) as voice_minutes,
    20 + CAST(RANDOM() % 40 AS INTEGER) as reactions_given
  FROM server_analytics
  WHERE guild_id = ?
  GROUP BY guild_id, DATE(created_at)
`);

aggregateDaily.run(guildId);

// Aggregate hourly activity
console.log('Aggregating hourly activity...');

const aggregateHourly = db.prepare(`
  INSERT OR REPLACE INTO hourly_activity 
  (guild_id, hour, date, message_count, command_count, voice_users)
  SELECT 
    guild_id,
    CAST(strftime('%H', created_at) AS INTEGER) as hour,
    DATE(created_at) as date,
    SUM(CASE WHEN metric_type = 'message_count' THEN value ELSE 0 END) as message_count,
    SUM(CASE WHEN metric_type = 'command_usage' THEN value ELSE 0 END) as command_count,
    5 + CAST(RANDOM() % 20 AS INTEGER) as voice_users
  FROM server_analytics
  WHERE guild_id = ?
  GROUP BY guild_id, DATE(created_at), CAST(strftime('%H', created_at) AS INTEGER)
`);

aggregateHourly.run(guildId);

// Add some server health data
console.log('Adding server health data...');

const insertHealth = db.prepare(`
  INSERT INTO server_health 
  (guild_id, member_count, online_count, bot_latency, memory_usage, uptime, error_count, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Add health data for the last 24 hours
for (let hour = 0; hour < 24; hour++) {
  const timestamp = new Date();
  timestamp.setHours(timestamp.getHours() - hour);
  
  insertHealth.run(
    guildId,
    150 + Math.floor(Math.random() * 50), // member_count
    80 + Math.floor(Math.random() * 30),  // online_count
    50 + Math.floor(Math.random() * 100), // bot_latency
    200 + Math.floor(Math.random() * 100), // memory_usage
    86400 + hour * 3600, // uptime
    Math.floor(Math.random() * 3), // error_count
    timestamp.toISOString()
  );
}

// Add channel analytics
console.log('Adding channel analytics...');

const insertChannel = db.prepare(`
  INSERT OR REPLACE INTO channel_analytics 
  (guild_id, channel_id, channel_name, channel_type, date, message_count, unique_users)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const channels = [
  { id: 'channel_0', name: 'general', type: 'text' },
  { id: 'channel_1', name: 'random', type: 'text' },
  { id: 'channel_2', name: 'memes', type: 'text' },
  { id: 'channel_3', name: 'support', type: 'text' },
  { id: 'channel_4', name: 'announcements', type: 'text' }
];

for (let day = 0; day < 7; day++) {
  const date = new Date();
  date.setDate(date.getDate() - day);
  const dateStr = date.toISOString().split('T')[0];
  
  channels.forEach(channel => {
    insertChannel.run(
      guildId,
      channel.id,
      channel.name,
      channel.type,
      dateStr,
      Math.floor(Math.random() * 100) + 10,
      Math.floor(Math.random() * 20) + 5
    );
  });
}

console.log('Analytics data populated successfully!');
db.close();