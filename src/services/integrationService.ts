import { db } from '../database/sqlite';
import { logInfo, logError } from '../utils/logger';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface Integration {
  id?: number;
  guild_id: string;
  name: string;
  integration_type: 'webhook' | 'rest_api' | 'rss' | 'github' | 'weather' | 'custom';
  provider: string;
  config: any;
  credentials_encrypted?: string;
  target_channel_id?: string;
  message_template?: string;
  embed_template?: string;
  is_active: boolean;
  sync_frequency?: number;
  last_sync?: Date;
  next_sync?: Date;
  sync_count: number;
  error_count: number;
  last_error?: string;
  rate_limit_config?: any;
  retry_config?: any;
  filter_config?: any;
  transform_config?: any;
  created_by: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface Webhook {
  id?: number;
  guild_id: string;
  integration_id?: number;
  name: string;
  webhook_url: string;
  secret_token?: string;
  events: string[];
  is_active: boolean;
  security_config?: any;
  rate_limit_per_minute: number;
  max_payload_size: number;
  timeout_seconds: number;
  retry_attempts: number;
  success_count: number;
  failure_count: number;
  last_triggered?: Date;
  last_success?: Date;
  last_failure?: Date;
  last_error?: string;
  created_by: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface IntegrationLog {
  id?: number;
  guild_id: string;
  integration_id?: number;
  webhook_id?: number;
  event_type: string;
  event_source: string;
  status: 'success' | 'failed' | 'pending' | 'cancelled';
  request_method?: string;
  request_url?: string;
  request_headers?: any;
  request_body?: any;
  response_status?: number;
  response_headers?: any;
  response_body?: any;
  processing_time?: number;
  error_message?: string;
  retry_count: number;
  metadata?: any;
  user_agent?: string;
  ip_address?: string;
  created_at?: Date;
}

export class IntegrationService extends EventEmitter {
  private encryptionKey: string;
  
  constructor() {
    super();
    this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  }

  // ==========================================
  // INTEGRATION MANAGEMENT
  // ==========================================

  async createIntegration(integration: Omit<Integration, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const stmt = db.prepare(`
        INSERT INTO integrations (
          guild_id, name, integration_type, provider, config, credentials_encrypted,
          target_channel_id, message_template, embed_template, is_active,
          sync_frequency, rate_limit_config, retry_config, filter_config,
          transform_config, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        integration.guild_id,
        integration.name,
        integration.integration_type,
        integration.provider,
        JSON.stringify(integration.config),
        integration.credentials_encrypted || null,
        integration.target_channel_id || null,
        integration.message_template || null,
        integration.embed_template ? JSON.stringify(integration.embed_template) : null,
        integration.is_active ? 1 : 0,
        integration.sync_frequency || null,
        integration.rate_limit_config ? JSON.stringify(integration.rate_limit_config) : null,
        integration.retry_config ? JSON.stringify(integration.retry_config) : null,
        integration.filter_config ? JSON.stringify(integration.filter_config) : null,
        integration.transform_config ? JSON.stringify(integration.transform_config) : null,
        integration.created_by
      );

      logInfo('IntegrationService', `Created integration ${integration.name} for guild ${integration.guild_id}`);
      this.emit('integrationCreated', { integrationId: result.lastInsertRowid, integration });
      
      return result.lastInsertRowid as number;
    } catch (error) {
      logError('IntegrationService', `Error creating integration: ${error}`);
      throw error;
    }
  }

  async getIntegration(integrationId: number): Promise<Integration | null> {
    try {
      const stmt = db.prepare('SELECT * FROM integrations WHERE id = ?');
      const row = stmt.get(integrationId) as any;
      
      if (!row) return null;
      
      return this.parseIntegrationRow(row);
    } catch (error) {
      logError('IntegrationService', `Error getting integration: ${error}`);
      throw error;
    }
  }

  async getGuildIntegrations(guildId: string): Promise<Integration[]> {
    try {
      const stmt = db.prepare('SELECT * FROM integrations WHERE guild_id = ? ORDER BY created_at DESC');
      const rows = stmt.all(guildId) as any[];
      
      return rows.map(row => this.parseIntegrationRow(row));
    } catch (error) {
      logError('IntegrationService', `Error getting guild integrations: ${error}`);
      throw error;
    }
  }

  async updateIntegration(integrationId: number, updates: Partial<Integration>): Promise<void> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'id' || key === 'created_at') return;
        
        updateFields.push(`${key} = ?`);
        
        if (typeof value === 'object' && value !== null) {
          values.push(JSON.stringify(value));
        } else if (typeof value === 'boolean') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      });

      if (updateFields.length === 0) return;

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(integrationId);

      const stmt = db.prepare(`UPDATE integrations SET ${updateFields.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      logInfo('IntegrationService', `Updated integration ${integrationId}`);
      this.emit('integrationUpdated', { integrationId, updates });
    } catch (error) {
      logError('IntegrationService', `Error updating integration: ${error}`);
      throw error;
    }
  }

  async deleteIntegration(integrationId: number): Promise<void> {
    try {
      const stmt = db.prepare('DELETE FROM integrations WHERE id = ?');
      stmt.run(integrationId);

      logInfo('IntegrationService', `Deleted integration ${integrationId}`);
      this.emit('integrationDeleted', { integrationId });
    } catch (error) {
      logError('IntegrationService', `Error deleting integration: ${error}`);
      throw error;
    }
  }

  // ==========================================
  // WEBHOOK MANAGEMENT
  // ==========================================

  async createWebhook(webhook: Omit<Webhook, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const stmt = db.prepare(`
        INSERT INTO webhooks (
          guild_id, integration_id, name, webhook_url, secret_token, events,
          is_active, security_config, rate_limit_per_minute, max_payload_size,
          timeout_seconds, retry_attempts, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        webhook.guild_id,
        webhook.integration_id || null,
        webhook.name,
        webhook.webhook_url,
        webhook.secret_token || null,
        JSON.stringify(webhook.events),
        webhook.is_active ? 1 : 0,
        webhook.security_config ? JSON.stringify(webhook.security_config) : null,
        webhook.rate_limit_per_minute,
        webhook.max_payload_size,
        webhook.timeout_seconds,
        webhook.retry_attempts,
        webhook.created_by
      );

      logInfo('IntegrationService', `Created webhook ${webhook.name} for guild ${webhook.guild_id}`);
      this.emit('webhookCreated', { webhookId: result.lastInsertRowid, webhook });
      
      return result.lastInsertRowid as number;
    } catch (error) {
      logError('IntegrationService', `Error creating webhook: ${error}`);
      throw error;
    }
  }

  async getWebhook(webhookId: number): Promise<Webhook | null> {
    try {
      const stmt = db.prepare('SELECT * FROM webhooks WHERE id = ?');
      const row = stmt.get(webhookId) as any;
      
      if (!row) return null;
      
      return this.parseWebhookRow(row);
    } catch (error) {
      logError('IntegrationService', `Error getting webhook: ${error}`);
      throw error;
    }
  }

  async getGuildWebhooks(guildId: string): Promise<Webhook[]> {
    try {
      const stmt = db.prepare('SELECT * FROM webhooks WHERE guild_id = ? ORDER BY created_at DESC');
      const rows = stmt.all(guildId) as any[];
      
      return rows.map(row => this.parseWebhookRow(row));
    } catch (error) {
      logError('IntegrationService', `Error getting guild webhooks: ${error}`);
      throw error;
    }
  }

  async updateWebhookStats(webhookId: number, success: boolean, error?: string): Promise<void> {
    try {
      const stmt = db.prepare(`
        UPDATE webhooks SET 
          ${success ? 'success_count = success_count + 1, last_success = CURRENT_TIMESTAMP' : 'failure_count = failure_count + 1, last_failure = CURRENT_TIMESTAMP, last_error = ?'},
          last_triggered = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      if (success) {
        stmt.run(webhookId);
      } else {
        stmt.run(error || 'Unknown error', webhookId);
      }

      this.emit('webhookStatsUpdated', { webhookId, success, error });
    } catch (error) {
      logError('IntegrationService', `Error updating webhook stats: ${error}`);
      throw error;
    }
  }

  // ==========================================
  // INTEGRATION LOGGING
  // ==========================================

  async logIntegrationActivity(log: Omit<IntegrationLog, 'id' | 'created_at'>): Promise<number> {
    try {
      const stmt = db.prepare(`
        INSERT INTO integration_logs (
          guild_id, integration_id, webhook_id, event_type, event_source, status,
          request_method, request_url, request_headers, request_body,
          response_status, response_headers, response_body, processing_time,
          error_message, retry_count, metadata, user_agent, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        log.guild_id,
        log.integration_id || null,
        log.webhook_id || null,
        log.event_type,
        log.event_source,
        log.status,
        log.request_method || null,
        log.request_url || null,
        log.request_headers ? JSON.stringify(log.request_headers) : null,
        log.request_body ? JSON.stringify(log.request_body) : null,
        log.response_status || null,
        log.response_headers ? JSON.stringify(log.response_headers) : null,
        log.response_body ? JSON.stringify(log.response_body) : null,
        log.processing_time || null,
        log.error_message || null,
        log.retry_count,
        log.metadata ? JSON.stringify(log.metadata) : null,
        log.user_agent || null,
        log.ip_address || null
      );

      this.emit('integrationActivityLogged', { logId: result.lastInsertRowid, log });
      
      return result.lastInsertRowid as number;
    } catch (error) {
      logError('IntegrationService', `Error logging integration activity: ${error}`);
      throw error;
    }
  }

  async getIntegrationLogs(integrationId: number, limit: number = 100): Promise<IntegrationLog[]> {
    try {
      const stmt = db.prepare(`
        SELECT * FROM integration_logs 
        WHERE integration_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `);
      const rows = stmt.all(integrationId, limit) as any[];
      
      return rows.map(row => this.parseLogRow(row));
    } catch (error) {
      logError('IntegrationService', `Error getting integration logs: ${error}`);
      throw error;
    }
  }

  // ==========================================
  // ENCRYPTION UTILITIES
  // ==========================================

  encryptCredentials(credentials: any): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      cipher.setAutoPadding(true);
      
      let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logError('IntegrationService', `Error encrypting credentials: ${error}`);
      throw error;
    }
  }

  decryptCredentials(encryptedCredentials: string): any {
    try {
      const parts = encryptedCredentials.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      decipher.setAutoPadding(true);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      logError('IntegrationService', `Error decrypting credentials: ${error}`);
      throw error;
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private parseIntegrationRow(row: any): Integration {
    return {
      ...row,
      config: row.config ? JSON.parse(row.config) : {},
      embed_template: row.embed_template ? JSON.parse(row.embed_template) : null,
      is_active: Boolean(row.is_active),
      rate_limit_config: row.rate_limit_config ? JSON.parse(row.rate_limit_config) : null,
      retry_config: row.retry_config ? JSON.parse(row.retry_config) : null,
      filter_config: row.filter_config ? JSON.parse(row.filter_config) : null,
      transform_config: row.transform_config ? JSON.parse(row.transform_config) : null,
      last_sync: row.last_sync ? new Date(row.last_sync) : null,
      next_sync: row.next_sync ? new Date(row.next_sync) : null,
      created_at: new Date(row.created_at),
      updated_at: row.updated_at ? new Date(row.updated_at) : null
    };
  }

  private parseWebhookRow(row: any): Webhook {
    return {
      ...row,
      events: row.events ? JSON.parse(row.events) : [],
      is_active: Boolean(row.is_active),
      security_config: row.security_config ? JSON.parse(row.security_config) : null,
      last_triggered: row.last_triggered ? new Date(row.last_triggered) : null,
      last_success: row.last_success ? new Date(row.last_success) : null,
      last_failure: row.last_failure ? new Date(row.last_failure) : null,
      created_at: new Date(row.created_at),
      updated_at: row.updated_at ? new Date(row.updated_at) : null
    };
  }

  private parseLogRow(row: any): IntegrationLog {
    return {
      ...row,
      request_headers: row.request_headers ? JSON.parse(row.request_headers) : null,
      request_body: row.request_body ? JSON.parse(row.request_body) : null,
      response_headers: row.response_headers ? JSON.parse(row.response_headers) : null,
      response_body: row.response_body ? JSON.parse(row.response_body) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      created_at: new Date(row.created_at)
    };
  }
}

export const integrationService = new IntegrationService();