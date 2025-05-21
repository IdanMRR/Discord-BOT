-- Create logs table
CREATE TABLE IF NOT EXISTS server_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    user_id TEXT,
    channel_id TEXT,
    message_id TEXT,
    target_id TEXT,
    reason TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_server_logs_guild ON server_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_server_logs_user ON server_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_server_logs_channel ON server_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_server_logs_action ON server_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_server_logs_created ON server_logs(created_at);
