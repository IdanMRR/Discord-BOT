import { logInfo, logError } from '../../utils/logger';
import { db } from '../sqlite';

export async function addGiveawaysTable(): Promise<void> {
  try {
    logInfo('Migration', 'Creating giveaways table...');
    
    // Create the main giveaways table
    db.exec(`
      CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        prize TEXT NOT NULL,
        winner_count INTEGER NOT NULL DEFAULT 1,
        host_user_id TEXT NOT NULL,
        end_time TIMESTAMP NOT NULL,
        requirements TEXT DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create giveaway entries (participants) table
    db.exec(`
      CREATE TABLE IF NOT EXISTS giveaway_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        giveaway_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE,
        UNIQUE(giveaway_id, user_id)
      )
    `);
    
    // Create giveaway winners table
    db.exec(`
      CREATE TABLE IF NOT EXISTS giveaway_winners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        giveaway_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        claimed BOOLEAN DEFAULT FALSE,
        claim_time TIMESTAMP,
        FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE,
        UNIQUE(giveaway_id, user_id)
      )
    `);
    
    // Create giveaway requirements table (for role/level requirements)
    db.exec(`
      CREATE TABLE IF NOT EXISTS giveaway_requirements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        giveaway_id INTEGER NOT NULL,
        requirement_type TEXT NOT NULL CHECK (requirement_type IN ('role', 'level', 'invite_count', 'server_boost')),
        requirement_value TEXT NOT NULL,
        FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
      )
    `);
    
    // Create indexes for better performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id)
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status)
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_giveaways_end_time ON giveaways(end_time)
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway ON giveaway_entries(giveaway_id)
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user ON giveaway_entries(user_id)
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_giveaway_winners_giveaway ON giveaway_winners(giveaway_id)
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_giveaway_requirements_giveaway ON giveaway_requirements(giveaway_id)
    `);
    
    logInfo('Migration', 'Giveaways tables created successfully');
  } catch (error) {
    logError('Migration', `Error creating giveaways tables: ${error}`);
    throw error;
  }
} 