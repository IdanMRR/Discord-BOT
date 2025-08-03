import { Client } from 'discord.js';
import { integrationService, Integration, Webhook } from '../../services/integrationService';
import { scheduledTaskService, ScheduledTask, AutomationRule } from '../../services/scheduledTaskService';
import WebhookHandler from './webhook-handler';
import AutomationHandler from './automation-handler';
import { logInfo, logError } from '../../utils/logger';
import { EventEmitter } from 'events';
import axios from 'axios';
import cron from 'node-cron';

export interface IntegrationSync {
  integration: Integration;
  lastData?: any;
  isRunning: boolean;
  nextSync: Date;
}

export class IntegrationManager extends EventEmitter {
  private client: Client;
  private webhookHandler: WebhookHandler;
  private automationHandler: AutomationHandler;
  private activeSyncs = new Map<number, IntegrationSync>();
  private syncIntervals = new Map<number, NodeJS.Timeout>();

  constructor(client: Client) {
    super();
    this.client = client;
    this.webhookHandler = new WebhookHandler(client);
    this.automationHandler = new AutomationHandler(client);
    
    this.initializeIntegrations();
    this.setupEventListeners();
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  private async initializeIntegrations(): Promise<void> {
    try {
      logInfo('IntegrationManager', 'Initializing integration systems...');
      
      // Initialize webhook handler
      this.initializeWebhookRoutes();
      
      // Load and start all active integrations
      await this.loadActiveIntegrations();
      
      // Setup periodic sync scheduler
      this.setupSyncScheduler();
      
      logInfo('IntegrationManager', 'Integration systems initialized successfully');
    } catch (error) {
      logError('IntegrationManager', `Error initializing integrations: ${error}`);
    }
  }

  private initializeWebhookRoutes(): void {
    // This would be integrated with your Express server
    // For now, we just expose the handler
    this.emit('webhookHandlerReady', this.webhookHandler);
  }

  private async loadActiveIntegrations(): Promise<void> {
    try {
      // This would load all active integrations from all guilds
      // For now, we'll implement per-guild loading
      logInfo('IntegrationManager', 'Loading active integrations...');
      
      // The actual loading would happen when guilds are processed
      // This is just initialization
    } catch (error) {
      logError('IntegrationManager', `Error loading active integrations: ${error}`);
    }
  }

  private setupSyncScheduler(): void {
    // Run sync check every minute
    cron.schedule('* * * * *', async () => {
      await this.processSyncQueue();
    });
  }

  private setupEventListeners(): void {
    // Listen to integration service events
    integrationService.on('integrationCreated', async (data) => {
      const { integrationId } = data;
      const integration = await integrationService.getIntegration(integrationId);
      if (integration && integration.is_active) {
        await this.startIntegrationSync(integration);
      }
    });

    integrationService.on('integrationUpdated', async (data) => {
      const { integrationId } = data;
      const integration = await integrationService.getIntegration(integrationId);
      if (integration) {
        if (integration.is_active) {
          await this.startIntegrationSync(integration);
        } else {
          this.stopIntegrationSync(integrationId);
        }
      }
    });

    integrationService.on('integrationDeleted', (data) => {
      this.stopIntegrationSync(data.integrationId);
    });

    // Listen to automation handler events
    this.automationHandler.on('ruleExecuted', (data) => {
      this.emit('automationRuleExecuted', data);
    });

    // Listen to scheduled task service events
    scheduledTaskService.on('taskExecuted', (data) => {
      this.emit('scheduledTaskExecuted', data);
    });
  }

  // ==========================================
  // INTEGRATION SYNC MANAGEMENT
  // ==========================================

  async startIntegrationSync(integration: Integration): Promise<void> {
    try {
      if (!integration.id) return;

      // Stop existing sync if running
      this.stopIntegrationSync(integration.id);

      // Calculate next sync time
      const nextSync = new Date();
      if (integration.sync_frequency) {
        nextSync.setSeconds(nextSync.getSeconds() + integration.sync_frequency);
      } else {
        nextSync.setMinutes(nextSync.getMinutes() + 5); // Default 5 minutes
      }

      // Create sync record
      const syncRecord: IntegrationSync = {
        integration,
        isRunning: false,
        nextSync
      };

      this.activeSyncs.set(integration.id, syncRecord);

      // Schedule sync if frequency is set
      if (integration.sync_frequency && integration.sync_frequency > 0) {
        const intervalId = setInterval(async () => {
          await this.syncIntegration(integration.id!);
        }, integration.sync_frequency * 1000);

        this.syncIntervals.set(integration.id, intervalId);
      }

      logInfo('IntegrationManager', `Started sync for integration ${integration.id} (${integration.name})`);
      this.emit('integrationSyncStarted', { integration });

    } catch (error) {
      logError('IntegrationManager', `Error starting integration sync: ${error}`);
    }
  }

  stopIntegrationSync(integrationId: number): void {
    try {
      // Clear interval if exists
      const intervalId = this.syncIntervals.get(integrationId);
      if (intervalId) {
        clearInterval(intervalId);
        this.syncIntervals.delete(integrationId);
      }

      // Remove from active syncs
      this.activeSyncs.delete(integrationId);

      logInfo('IntegrationManager', `Stopped sync for integration ${integrationId}`);
      this.emit('integrationSyncStopped', { integrationId });

    } catch (error) {
      logError('IntegrationManager', `Error stopping integration sync: ${error}`);
    }
  }

  private async processSyncQueue(): Promise<void> {
    const now = new Date();
    
    for (const [integrationId, syncRecord] of this.activeSyncs.entries()) {
      if (!syncRecord.isRunning && now >= syncRecord.nextSync) {
        await this.syncIntegration(integrationId);
      }
    }
  }

  private async syncIntegration(integrationId: number): Promise<void> {
    const syncRecord = this.activeSyncs.get(integrationId);
    if (!syncRecord || syncRecord.isRunning) return;

    syncRecord.isRunning = true;
    const startTime = Date.now();

    try {
      const integration = syncRecord.integration;
      
      logInfo('IntegrationManager', `Syncing integration ${integrationId} (${integration.name})`);

      let syncResult: any = null;

      // Sync based on integration type
      switch (integration.integration_type) {
        case 'rss':
          syncResult = await this.syncRSSFeed(integration);
          break;
        case 'github':
          syncResult = await this.syncGitHub(integration);
          break;
        case 'api':
          syncResult = await this.syncAPI(integration);
          break;
        case 'twitter':
          syncResult = await this.syncTwitter(integration);
          break;
        case 'twitch':
          syncResult = await this.syncTwitch(integration);
          break;
        case 'youtube':
          syncResult = await this.syncYouTube(integration);
          break;
        default:
          logInfo('IntegrationManager', `No sync handler for integration type: ${integration.integration_type}`);
      }

      // Update sync stats
      const processingTime = Date.now() - startTime;
      await integrationService.updateIntegration(integrationId, {
        last_sync: new Date(),
        sync_count: integration.sync_count + 1,
        next_sync: this.calculateNextSync(integration)
      });

      // Update sync record
      syncRecord.lastData = syncResult;
      syncRecord.nextSync = this.calculateNextSync(integration);

      // Log sync activity
      await integrationService.logIntegrationActivity({
        guild_id: integration.guild_id,
        integration_id: integrationId,
        event_type: 'sync',
        event_source: integration.integration_type,
        status: 'success',
        processing_time: processingTime,
        response_body: syncResult,
        retry_count: 0
      });

      logInfo('IntegrationManager', `Successfully synced integration ${integrationId}`);
      this.emit('integrationSynced', { integrationId, result: syncResult });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError('IntegrationManager', `Error syncing integration ${integrationId}: ${error}`);

      // Update error stats
      await integrationService.updateIntegration(integrationId, {
        error_count: syncRecord.integration.error_count + 1,
        last_error: errorMessage
      });

      // Log sync error
      await integrationService.logIntegrationActivity({
        guild_id: syncRecord.integration.guild_id,
        integration_id: integrationId,
        event_type: 'sync',
        event_source: syncRecord.integration.integration_type,
        status: 'failed',
        error_message: errorMessage,
        retry_count: 0
      });

      this.emit('integrationSyncError', { integrationId, error: errorMessage });

    } finally {
      syncRecord.isRunning = false;
    }
  }

  // ==========================================
  // INTEGRATION SYNC HANDLERS
  // ==========================================

  private async syncRSSFeed(integration: Integration): Promise<any> {
    const { feed_url } = integration.config;
    if (!feed_url) throw new Error('RSS feed URL not configured');

    const response = await axios.get(feed_url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Discord Bot RSS Reader'
      }
    });

    // Parse RSS feed (simplified - would use proper RSS parser)
    const feedData = response.data;
    
    // Process new items and send to Discord
    if (integration.target_channel_id) {
      const channel = await this.client.channels.fetch(integration.target_channel_id);
      if (channel && channel.isTextBased()) {
        // Send RSS updates to channel
        // Implementation would parse RSS and send formatted messages
      }
    }

    return { items_processed: 0, last_updated: new Date().toISOString() };
  }

  private async syncGitHub(integration: Integration): Promise<any> {
    const { repo_owner, repo_name, api_token } = integration.config;
    if (!repo_owner || !repo_name) throw new Error('GitHub repository not configured');

    const headers: any = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Discord Bot GitHub Integration'
    };

    if (api_token) {
      const credentials = integrationService.decryptCredentials(integration.credentials_encrypted || '');
      headers['Authorization'] = `token ${credentials.api_token}`;
    }

    // Get recent commits, issues, PRs, etc.
    const response = await axios.get(
      `https://api.github.com/repos/${repo_owner}/${repo_name}/events`,
      { headers, timeout: 30000 }
    );

    const events = response.data;
    
    // Process and send to Discord
    if (integration.target_channel_id && events.length > 0) {
      const channel = await this.client.channels.fetch(integration.target_channel_id);
      if (channel && channel.isTextBased()) {
        // Send GitHub updates to channel
        // Implementation would format events and send as embeds
      }
    }

    return { events_processed: events.length, last_event: events[0]?.created_at };
  }

  private async syncAPI(integration: Integration): Promise<any> {
    const { api_url, method = 'GET', headers = {} } = integration.config;
    if (!api_url) throw new Error('API URL not configured');

    const requestConfig: any = {
      method,
      url: api_url,
      timeout: 30000,
      headers: {
        'User-Agent': 'Discord Bot API Integration',
        ...headers
      }
    };

    // Add authentication if configured
    if (integration.credentials_encrypted) {
      const credentials = integrationService.decryptCredentials(integration.credentials_encrypted);
      if (credentials.api_key) {
        requestConfig.headers['Authorization'] = `Bearer ${credentials.api_key}`;
      }
    }

    const response = await axios(requestConfig);
    const data = response.data;

    // Apply filters if configured
    let filteredData = data;
    if (integration.filter_config) {
      filteredData = this.applyFilters(data, integration.filter_config);
    }

    // Apply transformations if configured
    if (integration.transform_config) {
      filteredData = this.applyTransformations(filteredData, integration.transform_config);
    }

    // Send to Discord if target channel is configured
    if (integration.target_channel_id && filteredData) {
      const channel = await this.client.channels.fetch(integration.target_channel_id);
      if (channel && channel.isTextBased()) {
        const message = this.formatAPIResponse(filteredData, integration);
        await (channel as any).send(message);
      }
    }

    return { data_received: true, response_size: JSON.stringify(data).length };
  }

  private async syncTwitter(integration: Integration): Promise<any> {
    // Twitter API integration
    // Implementation would use Twitter API v2
    throw new Error('Twitter integration not implemented yet');
  }

  private async syncTwitch(integration: Integration): Promise<any> {
    // Twitch API integration
    // Implementation would check for stream status, new clips, etc.
    throw new Error('Twitch integration not implemented yet');
  }

  private async syncYouTube(integration: Integration): Promise<any> {
    // YouTube API integration
    // Implementation would check for new videos, live streams, etc.
    throw new Error('YouTube integration not implemented yet');
  }

  // ==========================================
  // PUBLIC METHODS
  // ==========================================

  async createIntegration(integration: Omit<Integration, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const integrationId = await integrationService.createIntegration(integration);
    
    if (integration.is_active) {
      const fullIntegration = await integrationService.getIntegration(integrationId);
      if (fullIntegration) {
        await this.startIntegrationSync(fullIntegration);
      }
    }
    
    return integrationId;
  }

  async createWebhook(webhook: Omit<Webhook, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    return await integrationService.createWebhook(webhook);
  }

  async createScheduledTask(task: Omit<ScheduledTask, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    return await scheduledTaskService.createScheduledTask(task);
  }

  async createAutomationRule(rule: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    return await scheduledTaskService.createAutomationRule(rule);
  }

  getWebhookHandler(): WebhookHandler {
    return this.webhookHandler;
  }

  getAutomationHandler(): AutomationHandler {
    return this.automationHandler;
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private calculateNextSync(integration: Integration): Date {
    const now = new Date();
    const frequency = integration.sync_frequency || 300; // Default 5 minutes
    return new Date(now.getTime() + (frequency * 1000));
  }

  private applyFilters(data: any, filterConfig: any): any {
    // Apply filtering logic based on configuration
    // This is a simplified implementation
    return data;
  }

  private applyTransformations(data: any, transformConfig: any): any {
    // Apply transformation logic based on configuration
    // This is a simplified implementation
    return data;
  }

  private formatAPIResponse(data: any, integration: Integration): any {
    if (integration.message_template) {
      return {
        content: integration.message_template.replace(/\{data\}/g, JSON.stringify(data, null, 2))
      };
    }

    if (integration.embed_template) {
      return {
        embeds: [integration.embed_template]
      };
    }

    return {
      content: `**API Response:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
    };
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  async shutdown(): Promise<void> {
    try {
      logInfo('IntegrationManager', 'Shutting down integration manager...');
      
      // Stop all active syncs
      for (const integrationId of this.activeSyncs.keys()) {
        this.stopIntegrationSync(integrationId);
      }

      // Clear all intervals
      for (const intervalId of this.syncIntervals.values()) {
        clearInterval(intervalId);
      }

      this.activeSyncs.clear();
      this.syncIntervals.clear();

      logInfo('IntegrationManager', 'Integration manager shut down successfully');
    } catch (error) {
      logError('IntegrationManager', `Error during shutdown: ${error}`);
    }
  }
}

export default IntegrationManager;