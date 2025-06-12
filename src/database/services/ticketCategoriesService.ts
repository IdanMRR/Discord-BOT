import { db } from '../sqlite';
import { logInfo, logError } from '../../utils/logger';

export interface TicketCategory {
  id?: number;
  guild_id: string;
  category_id: string;
  name: string;
  description?: string;
  emoji?: string;
  color?: number;
  priority?: string;
  expected_response_time?: string;
  category_type?: 'custom' | 'discord_category' | 'default';
  discord_category_id?: string;
  position?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export class TicketCategoriesService {
  /**
   * Get all ticket categories for a server
   */
  static async getServerCategories(guildId: string): Promise<TicketCategory[]> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM ticket_categories 
        WHERE guild_id = ? AND is_active = 1 
        ORDER BY position ASC, created_at ASC
      `);
      
      const categories = stmt.all(guildId) as TicketCategory[];
      logInfo('TicketCategoriesService', `Retrieved ${categories.length} categories for guild ${guildId}`);
      
      return categories;
    } catch (error: any) {
      logError('TicketCategoriesService', `Error getting categories for guild ${guildId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Add or update a ticket category
   */
  static async upsertCategory(category: TicketCategory): Promise<boolean> {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO ticket_categories (
          guild_id, category_id, name, description, emoji, color, 
          priority, expected_response_time, category_type, 
          discord_category_id, position, is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      const result = stmt.run(
        category.guild_id,
        category.category_id,
        category.name,
        category.description || null,
        category.emoji || '📁',
        category.color || 0x5865F2,
        category.priority || 'medium',
        category.expected_response_time || '24 hours',
        category.category_type || 'custom',
        category.discord_category_id || null,
        category.position || 0,
        category.is_active !== false ? 1 : 0
      );
      
      logInfo('TicketCategoriesService', `Upserted category ${category.category_id} for guild ${category.guild_id}`);
      return result.changes > 0;
    } catch (error: any) {
      logError('TicketCategoriesService', `Error upserting category: ${error.message}`);
      return false;
    }
  }

  /**
   * Create default categories from Discord categories
   */
  static async createFromDiscordCategories(guildId: string, discordCategories: any[]): Promise<boolean> {
    try {
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO ticket_categories (
          guild_id, category_id, name, description, emoji, color,
          priority, expected_response_time, category_type, 
          discord_category_id, position, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let inserted = 0;
      for (const category of discordCategories) {
        const result = insertStmt.run(
          guildId,
          category.id,
          category.name,
          `Discord category: ${category.name}`,
          '📁',
          0x5865F2,
          'medium',
          '24 hours',
          'discord_category',
          category.id,
          category.position || 0,
          1
        );
        
        if (result.changes > 0) {
          inserted++;
        }
      }
      
      logInfo('TicketCategoriesService', `Created ${inserted} Discord categories for guild ${guildId}`);
      return inserted > 0;
    } catch (error: any) {
      logError('TicketCategoriesService', `Error creating Discord categories: ${error.message}`);
      return false;
    }
  }

  /**
   * Create default template categories if no categories exist
   */
  static async createDefaultCategories(guildId: string): Promise<boolean> {
    try {
      // Check if any categories already exist
      const existingCount = db.prepare(
        'SELECT COUNT(*) as count FROM ticket_categories WHERE guild_id = ? AND is_active = 1'
      ).get(guildId) as { count: number };
      
      if (existingCount.count > 0) {
        logInfo('TicketCategoriesService', `Guild ${guildId} already has ${existingCount.count} categories`);
        return true;
      }
      
      // Import default categories
      const { ticketCategories } = await import('../../handlers/tickets/ticket-categories');
      
      const insertStmt = db.prepare(`
        INSERT INTO ticket_categories (
          guild_id, category_id, name, description, emoji, color,
          priority, expected_response_time, category_type, position, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let inserted = 0;
      ticketCategories.forEach((category, index) => {
        const result = insertStmt.run(
          guildId,
          category.id,
          category.label,
          category.description,
          category.emoji,
          category.color,
          category.priority,
          category.expectedResponseTime,
          'default',
          index,
          1
        );
        
        if (result.changes > 0) {
          inserted++;
        }
      });
      
      logInfo('TicketCategoriesService', `Created ${inserted} default categories for guild ${guildId}`);
      return inserted > 0;
    } catch (error: any) {
      logError('TicketCategoriesService', `Error creating default categories: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete a category
   */
  static async deleteCategory(guildId: string, categoryId: string): Promise<boolean> {
    try {
      const stmt = db.prepare(`
        UPDATE ticket_categories 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE guild_id = ? AND category_id = ?
      `);
      
      const result = stmt.run(guildId, categoryId);
      logInfo('TicketCategoriesService', `Deactivated category ${categoryId} for guild ${guildId}`);
      
      return result.changes > 0;
    } catch (error: any) {
      logError('TicketCategoriesService', `Error deleting category: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a specific category by ID
   */
  static async getCategory(guildId: string, categoryId: string): Promise<TicketCategory | null> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM ticket_categories 
        WHERE guild_id = ? AND category_id = ? AND is_active = 1
      `);
      
      const category = stmt.get(guildId, categoryId) as TicketCategory | undefined;
      return category || null;
    } catch (error: any) {
      logError('TicketCategoriesService', `Error getting category: ${error.message}`);
      return null;
    }
  }
} 