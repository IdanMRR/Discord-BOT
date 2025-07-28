import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

export interface Giveaway {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id?: string;
  title: string;
  description?: string;
  prize: string;
  winner_count: number;
  host_user_id: string;
  end_time: string;
  requirements: string;
  status: 'active' | 'ended' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface GiveawayEntry {
  id: number;
  giveaway_id: number;
  user_id: string;
  entry_time: string;
}

export interface GiveawayWinner {
  id: number;
  giveaway_id: number;
  user_id: string;
  selected_at: string;
  claimed: boolean;
  claim_time?: string;
}

export interface GiveawayRequirement {
  id: number;
  giveaway_id: number;
  requirement_type: 'role' | 'level' | 'invite_count' | 'server_boost';
  requirement_value: string;
}

export interface CreateGiveawayData {
  guild_id: string;
  channel_id: string;
  title: string;
  description?: string;
  prize: string;
  winner_count: number;
  host_user_id: string;
  end_time: string;
  requirements?: GiveawayRequirement[];
}

export class GiveawayService {
  /**
   * Create a new giveaway
   */
  static createGiveaway(data: CreateGiveawayData): { success: boolean; giveaway?: Giveaway; error?: string } {
    try {
      const stmt = db.prepare(`
        INSERT INTO giveaways (guild_id, channel_id, title, description, prize, winner_count, host_user_id, end_time, requirements)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        data.guild_id,
        data.channel_id,
        data.title,
        data.description || null,
        data.prize,
        data.winner_count,
        data.host_user_id,
        data.end_time,
        JSON.stringify(data.requirements || [])
      );
      
      const giveaway = this.getGiveawayById(result.lastInsertRowid as number);
      if (!giveaway.success) {
        return { success: false, error: 'Failed to retrieve created giveaway' };
      }
      
      // Add requirements if any
      if (data.requirements && data.requirements.length > 0) {
        this.addGiveawayRequirements(giveaway.giveaway!.id, data.requirements);
      }
      
      logInfo('Giveaway Service', `Created new giveaway: ${data.title} (ID: ${result.lastInsertRowid})`);
      return { success: true, giveaway: giveaway.giveaway };
    } catch (error) {
      logError('Giveaway Service', `Error creating giveaway: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Get giveaway by ID
   */
  static getGiveawayById(id: number): { success: boolean; giveaway?: Giveaway; error?: string } {
    try {
      const stmt = db.prepare('SELECT * FROM giveaways WHERE id = ?');
      const giveaway = stmt.get(id) as Giveaway;
      
      if (!giveaway) {
        return { success: false, error: 'Giveaway not found' };
      }
      
      return { success: true, giveaway };
    } catch (error) {
      logError('Giveaway Service', `Error getting giveaway by ID: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Get giveaway by message ID
   */
  static getGiveawayByMessageId(messageId: string): { success: boolean; giveaway?: Giveaway; error?: string } {
    try {
      const stmt = db.prepare('SELECT * FROM giveaways WHERE message_id = ?');
      const giveaway = stmt.get(messageId) as Giveaway;
      
      if (!giveaway) {
        return { success: false, error: 'Giveaway not found' };
      }
      
      return { success: true, giveaway };
    } catch (error) {
      logError('Giveaway Service', `Error getting giveaway by message ID: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Get all giveaways for a guild
   */
  static getGuildGiveaways(guildId: string, status?: string): { success: boolean; giveaways?: Giveaway[]; error?: string } {
    try {
      let query = 'SELECT * FROM giveaways WHERE guild_id = ?';
      const params: any[] = [guildId];
      
      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const stmt = db.prepare(query);
      const giveaways = stmt.all(...params) as Giveaway[];
      
      return { success: true, giveaways };
    } catch (error) {
      logError('Giveaway Service', `Error getting guild giveaways: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Get active giveaways that have ended
   */
  static getEndedGiveaways(): { success: boolean; giveaways?: Giveaway[]; error?: string } {
    try {
      // Get current timestamp in the same format as stored in database
      const now = new Date().toISOString();
      
      const stmt = db.prepare(`
        SELECT * FROM giveaways 
        WHERE status = 'active' AND end_time <= ?
        ORDER BY end_time ASC
      `);
      const giveaways = stmt.all(now) as Giveaway[];
      
      // Only log if there are actual ended giveaways to process
      if (giveaways.length > 0) {
        logInfo('Giveaway Service', `Found ${giveaways.length} ended giveaways to process`);
      }
      return { success: true, giveaways };
    } catch (error) {
      logError('Giveaway Service', `Error getting ended giveaways: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Update giveaway message ID
   */
  static updateMessageId(giveawayId: number, messageId: string): { success: boolean; error?: string } {
    try {
      const stmt = db.prepare('UPDATE giveaways SET message_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(messageId, giveawayId);
      
      return { success: true };
    } catch (error) {
      logError('Giveaway Service', `Error updating message ID: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Update giveaway status
   */
  static updateStatus(giveawayId: number, status: 'active' | 'ended' | 'cancelled'): { success: boolean; error?: string } {
    try {
      const stmt = db.prepare('UPDATE giveaways SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(status, giveawayId);
      
      logInfo('Giveaway Service', `Updated giveaway ${giveawayId} status to: ${status}`);
      return { success: true };
    } catch (error) {
      logError('Giveaway Service', `Error updating giveaway status: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Add user entry to giveaway
   */
  static addEntry(giveawayId: number, userId: string): { success: boolean; error?: string } {
    try {
      const stmt = db.prepare('INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)');
      const result = stmt.run(giveawayId, userId);
      
      if (result.changes === 0) {
        return { success: false, error: 'User already entered this giveaway' };
      }
      
      logInfo('Giveaway Service', `User ${userId} entered giveaway ${giveawayId}`);
      return { success: true };
    } catch (error) {
      logError('Giveaway Service', `Error adding giveaway entry: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Remove user entry from giveaway
   */
  static removeEntry(giveawayId: number, userId: string): { success: boolean; error?: string } {
    try {
      const stmt = db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?');
      const result = stmt.run(giveawayId, userId);
      
      if (result.changes === 0) {
        return { success: false, error: 'User was not entered in this giveaway' };
      }
      
      logInfo('Giveaway Service', `User ${userId} removed from giveaway ${giveawayId}`);
      return { success: true };
    } catch (error) {
      logError('Giveaway Service', `Error removing giveaway entry: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Check if user has entered giveaway
   */
  static hasUserEntered(giveawayId: number, userId: string): { success: boolean; entered?: boolean; error?: string } {
    try {
      const stmt = db.prepare('SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?');
      const entry = stmt.get(giveawayId, userId);
      
      return { success: true, entered: !!entry };
    } catch (error) {
      logError('Giveaway Service', `Error checking user entry: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Get all entries for a giveaway
   */
  static getGiveawayEntries(giveawayId: number): { success: boolean; entries?: GiveawayEntry[]; error?: string } {
    try {
      const stmt = db.prepare('SELECT * FROM giveaway_entries WHERE giveaway_id = ? ORDER BY entry_time ASC');
      const entries = stmt.all(giveawayId) as GiveawayEntry[];
      
      return { success: true, entries };
    } catch (error) {
      logError('Giveaway Service', `Error getting giveaway entries: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Get entry count for a giveaway
   */
  static getEntryCount(giveawayId: number): { success: boolean; count?: number; error?: string } {
    try {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id = ?');
      const result = stmt.get(giveawayId) as { count: number };
      
      return { success: true, count: result.count };
    } catch (error) {
      logError('Giveaway Service', `Error getting entry count: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Select random winners for a giveaway
   */
  static selectWinners(giveawayId: number, winnerCount: number): { success: boolean; winners?: string[]; error?: string } {
    try {
      const entriesResult = this.getGiveawayEntries(giveawayId);
      if (!entriesResult.success || !entriesResult.entries) {
        return { success: false, error: 'Failed to get giveaway entries' };
      }
      
      const entries = entriesResult.entries;
      if (entries.length === 0) {
        return { success: false, error: 'No entries found for this giveaway' };
      }
      
      // Shuffle and select winners
      const shuffled = entries.sort(() => 0.5 - Math.random());
      const actualWinnerCount = Math.min(winnerCount, entries.length);
      const winners = shuffled.slice(0, actualWinnerCount).map(entry => entry.user_id);
      
      // Insert winners into database
      const stmt = db.prepare('INSERT INTO giveaway_winners (giveaway_id, user_id) VALUES (?, ?)');
      const insertMany = db.transaction((winnerIds: string[]) => {
        for (const userId of winnerIds) {
          stmt.run(giveawayId, userId);
        }
      });
      insertMany(winners);
      
      logInfo('Giveaway Service', `Selected ${winners.length} winners for giveaway ${giveawayId}`);
      return { success: true, winners };
    } catch (error) {
      logError('Giveaway Service', `Error selecting winners: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Get winners for a giveaway
   */
  static getGiveawayWinners(giveawayId: number): { success: boolean; winners?: GiveawayWinner[]; error?: string } {
    try {
      const stmt = db.prepare('SELECT * FROM giveaway_winners WHERE giveaway_id = ? ORDER BY selected_at ASC');
      const winners = stmt.all(giveawayId) as GiveawayWinner[];
      
      return { success: true, winners };
    } catch (error) {
      logError('Giveaway Service', `Error getting giveaway winners: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Mark winner as claimed
   */
  static markWinnerClaimed(giveawayId: number, userId: string): { success: boolean; error?: string } {
    try {
      const stmt = db.prepare('UPDATE giveaway_winners SET claimed = TRUE, claim_time = CURRENT_TIMESTAMP WHERE giveaway_id = ? AND user_id = ?');
      stmt.run(giveawayId, userId);
      
      logInfo('Giveaway Service', `Winner ${userId} claimed prize for giveaway ${giveawayId}`);
      return { success: true };
    } catch (error) {
      logError('Giveaway Service', `Error marking winner as claimed: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Add requirements to giveaway
   */
  static addGiveawayRequirements(giveawayId: number, requirements: Omit<GiveawayRequirement, 'id' | 'giveaway_id'>[]): void {
    const stmt = db.prepare('INSERT INTO giveaway_requirements (giveaway_id, requirement_type, requirement_value) VALUES (?, ?, ?)');
    const insertMany = db.transaction((reqs: typeof requirements) => {
      for (const req of reqs) {
        stmt.run(giveawayId, req.requirement_type, req.requirement_value);
      }
    });
    insertMany(requirements);
  }
  
  /**
   * Get requirements for a giveaway
   */
  static getGiveawayRequirements(giveawayId: number): { success: boolean; requirements?: GiveawayRequirement[]; error?: string } {
    try {
      const stmt = db.prepare('SELECT * FROM giveaway_requirements WHERE giveaway_id = ?');
      const requirements = stmt.all(giveawayId) as GiveawayRequirement[];
      
      return { success: true, requirements };
    } catch (error) {
      logError('Giveaway Service', `Error getting giveaway requirements: ${error}`);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Delete a giveaway and all related data
   */
  static deleteGiveaway(giveawayId: number): { success: boolean; error?: string } {
    try {
      const stmt = db.prepare('DELETE FROM giveaways WHERE id = ?');
      const result = stmt.run(giveawayId);
      
      if (result.changes === 0) {
        return { success: false, error: 'Giveaway not found' };
      }
      
      logInfo('Giveaway Service', `Deleted giveaway ${giveawayId}`);
      return { success: true };
    } catch (error) {
      logError('Giveaway Service', `Error deleting giveaway: ${error}`);
      return { success: false, error: String(error) };
    }
  }
} 