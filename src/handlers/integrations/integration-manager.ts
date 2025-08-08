import { Client } from 'discord.js';
import { integrationService, Integration, Webhook } from '../../services/integrationService';
import { scheduledTaskService, ScheduledTask, AutomationRule } from '../../services/scheduledTaskService';
import WebhookHandler from './webhook-handler';
import AutomationHandler from './automation-handler';
import { logInfo, logError } from '../../utils/logger';
import { EventEmitter } from 'events';
import axios from 'axios';
import cron from 'node-cron';
import { ApiIntegrationHandlers } from './api-integration-handlers';

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

  // Public method for manual sync
  async manualSync(integrationId: number): Promise<void> {
    logInfo('IntegrationManager', `Manual sync triggered for integration ${integrationId}`);
    
    // Get the integration details
    const integration = await integrationService.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    // Make sure it's in active syncs
    if (!this.activeSyncs.has(integrationId)) {
      this.activeSyncs.set(integrationId, {
        integration,
        nextSync: new Date(),
        isRunning: false
      });
    }

    // Trigger the sync
    await this.syncIntegration(integrationId);
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
        case 'rest_api':
          syncResult = await this.syncAPI(integration);
          break;
        case 'weather':
          syncResult = await this.syncWeather(integration);
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

    // Simple RSS parsing - extract items from XML
    const feedData = response.data;
    let itemsProcessed = 0;
    
    // Process new items and send to Discord
    if (integration.target_channel_id) {
      try {
        const channel = await this.client.channels.fetch(integration.target_channel_id);
        if (channel && channel.isTextBased() && 'send' in channel) {
          // Extract RSS items using simple regex (for demo purposes)
          const itemMatches = feedData.match(/<item>([\s\S]*?)<\/item>/g);
          
          if (itemMatches && itemMatches.length > 0) {
            // Process only the latest item to avoid spam
            const latestItem = itemMatches[0];
            
            // Extract title, link, and description
            const titleMatch = latestItem.match(/<title>([\s\S]*?)<\/title>/);
            const linkMatch = latestItem.match(/<link>([\s\S]*?)<\/link>/);
            const descMatch = latestItem.match(/<description>([\s\S]*?)<\/description>/);
            
            const title = titleMatch ? titleMatch[1].trim() : 'No title';
            const link = linkMatch ? linkMatch[1].trim() : '';
            const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : '';
            
            // Create Discord message
            const embed = {
              title: title.substring(0, 256), // Discord embed title limit
              url: link,
              description: description.substring(0, 2048), // Discord embed description limit
              color: 0x00AE86, // Teal color
              timestamp: new Date().toISOString(),
              footer: {
                text: `${integration.name} • RSS Feed`
              }
            };

            await channel.send({ embeds: [embed] });
            itemsProcessed = 1;
            
            logInfo('IntegrationManager', `Sent RSS update to channel ${integration.target_channel_id}: ${title}`);
          } else {
            logInfo('IntegrationManager', `No RSS items found in feed for integration ${integration.id}`);
          }
        } else {
          logError('IntegrationManager', `Target channel ${integration.target_channel_id} not found or not text-based`);
        }
      } catch (channelError) {
        logError('IntegrationManager', `Error sending RSS message to channel: ${channelError}`);
        throw new Error(`Failed to send message to channel: ${channelError}`);
      }
    } else {
      logError('IntegrationManager', `No target channel configured for RSS integration ${integration.id}`);
    }

    return { items_processed: itemsProcessed, last_updated: new Date().toISOString() };
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
    // Extract and validate configuration
    const config = integration.config || {};
    const api_url = config.api_url || config.url || integration.provider;
    const method = (config.method || 'GET').toUpperCase();
    const headers = config.headers || {};
    const query_params = config.query_params || config.params || {};
    const request_body = config.request_body || config.body || config.data;
    const auth_type = config.auth_type || 'none';
    const data_path = config.data_path || '';
    const embed_config = config.embed_config || {};
    
    if (!api_url) {
      throw new Error('API URL not configured. Please provide api_url in configuration or use provider field.');
    }

    // Build request configuration - REST APIs are JSON by default
    const requestConfig: any = {
      method,
      url: api_url,
      timeout: 30000,
      headers: {
        'User-Agent': 'Discord Bot REST API Integration',
        'Accept': 'application/json',
        ...headers
      }
    };

    // Add query parameters
    if (query_params && Object.keys(query_params).length > 0) {
      requestConfig.params = query_params;
    }

    // Add request body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(method) && request_body) {
      requestConfig.data = request_body;
      // Ensure JSON content type for request body
      if (!requestConfig.headers['Content-Type']) {
        requestConfig.headers['Content-Type'] = 'application/json';
      }
    }

    // Handle authentication
    if (integration.credentials_encrypted && auth_type !== 'none') {
      const credentials = integrationService.decryptCredentials(integration.credentials_encrypted);
      
      switch (auth_type) {
        case 'bearer':
          if (credentials.api_key) {
            requestConfig.headers['Authorization'] = `Bearer ${credentials.api_key}`;
          }
          break;
        case 'api_key':
          if (credentials.api_key) {
            requestConfig.headers['X-API-Key'] = credentials.api_key;
          }
          break;
        case 'basic':
          if (credentials.username && credentials.password) {
            const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
            requestConfig.headers['Authorization'] = `Basic ${encoded}`;
          }
          break;
        case 'custom':
          if (credentials.custom_header && credentials.api_key) {
            requestConfig.headers[credentials.custom_header] = credentials.api_key;
          }
          break;
      }
    }

    try {
      logInfo('IntegrationManager', `Making REST API request to ${api_url} with method ${method}`);
      const response = await axios(requestConfig);
      let data = response.data;

      // REST APIs should return JSON - validate response
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (parseError) {
          logError('IntegrationManager', `Invalid JSON response from API: ${parseError}`);
          // If it's not JSON, treat as plain text
          data = { message: data };
        }
      }

      // Extract specific data using path if configured
      if (data_path && data_path.trim() !== '') {
        const extractedData = this.extractDataByPath(data, data_path);
        if (extractedData !== null && extractedData !== undefined) {
          data = extractedData;
        } else {
          logError('IntegrationManager', `Data path "${data_path}" not found in response`);
        }
      }

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
        if (channel && channel.isTextBased() && 'send' in channel) {
          const message = this.formatCustomAPIResponse(filteredData, integration, embed_config);
          await channel.send(message);
          logInfo('IntegrationManager', `Sent API response to channel ${integration.target_channel_id}`);
        }
      }

      return { 
        success: true,
        status_code: response.status,
        data_received: true, 
        response_size: JSON.stringify(data).length,
        last_updated: new Date().toISOString()
      };

    } catch (error: any) {
      logError('IntegrationManager', `API request failed: ${error.message}`);
      
      // Send error notification to Discord if configured
      if (integration.target_channel_id && integration.config.notify_on_error) {
        const channel = await this.client.channels.fetch(integration.target_channel_id);
        if (channel && channel.isTextBased() && 'send' in channel) {
          const errorEmbed = {
            embeds: [{
              title: '❌ API Integration Error',
              description: `Failed to fetch data from ${api_url}`,
              color: 0xFF0000,
              fields: [
                { name: 'Error', value: error.message || 'Unknown error', inline: false },
                { name: 'Status Code', value: error.response?.status?.toString() || 'N/A', inline: true },
                { name: 'Integration', value: integration.name, inline: true }
              ],
              timestamp: new Date().toISOString(),
              footer: { text: 'Custom API Integration' }
            }]
          };
          await channel.send(errorEmbed);
        }
      }
      
      throw error;
    }
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

  private async syncWeather(integration: Integration): Promise<any> {
    const { location, api_service = 'openweathermap' } = integration.config;
    if (!location) throw new Error('Weather location not configured');

    let weatherData: any;

    try {
      if (api_service === 'openweathermap') {
        // Use OpenWeatherMap API (requires API key)
        const { api_key } = integration.config;
        if (!api_key) throw new Error('OpenWeatherMap API key not configured');

        const response = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather`,
          {
            params: {
              q: location,
              appid: api_key,
              units: 'metric'
            },
            timeout: 30000,
            headers: {
              'User-Agent': 'Discord Bot Weather Integration'
            }
          }
        );

        weatherData = this.convertOpenWeatherToWttr(response.data);
      } else {
        // Use wttr.in (free, no API key required)
        const response = await axios.get(
          `https://wttr.in/${encodeURIComponent(location)}?format=j1`,
          {
            timeout: 30000,
            headers: {
              'User-Agent': 'Discord Bot Weather Integration'
            }
          }
        );

        weatherData = response.data;
      }

      // Send weather update to Discord
      if (integration.target_channel_id) {
        try {
          const channel = await this.client.channels.fetch(integration.target_channel_id);
          if (channel && channel.isTextBased() && 'send' in channel) {
            const message = this.formatWeatherEmbed(weatherData, integration);
            await channel.send(message);
            
            logInfo('IntegrationManager', `Sent weather update to channel ${integration.target_channel_id} for ${location}`);
          } else {
            logError('IntegrationManager', `Target channel ${integration.target_channel_id} not found or not text-based`);
          }
        } catch (channelError) {
          logError('IntegrationManager', `Error sending weather message to channel: ${channelError}`);
          throw new Error(`Failed to send weather message to channel: ${channelError}`);
        }
      } else {
        logError('IntegrationManager', `No target channel configured for weather integration ${integration.id}`);
      }

      return { 
        location,
        temperature: weatherData.current_condition[0].temp_C,
        conditions: weatherData.current_condition[0].weatherDesc[0].value,
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      logError('IntegrationManager', `Error fetching weather data: ${error}`);
      throw error;
    }
  }

  private convertOpenWeatherToWttr(openWeatherData: any): any {
    // Convert OpenWeatherMap format to wttr.in format for consistent processing
    const main = openWeatherData.main;
    const weather = openWeatherData.weather[0];
    const wind = openWeatherData.wind;
    const sys = openWeatherData.sys;

    return {
      current_condition: [{
        temp_C: Math.round(main.temp).toString(),
        FeelsLikeC: Math.round(main.feels_like).toString(),
        humidity: main.humidity.toString(),
        windspeedKmph: Math.round((wind?.speed || 0) * 3.6).toString(), // Convert m/s to km/h
        winddir16Point: this.getWindDirection(wind?.deg || 0),
        pressure: main.pressure.toString(),
        visibility: '10', // OpenWeather doesn't provide visibility in free tier
        weatherDesc: [{ value: weather.description }],
        cloudcover: (openWeatherData.clouds?.all || 0).toString(),
        weatherCode: this.mapOpenWeatherToWttrCode(weather.id).toString()
      }],
      nearest_area: [{
        areaName: [{ value: openWeatherData.name }],
        country: [{ value: sys.country }]
      }],
      weather: [{
        maxtempC: Math.round(main.temp_max).toString(),
        mintempC: Math.round(main.temp_min).toString(),
        hourly: [{
          chanceofrain: '0' // OpenWeather free tier doesn't provide this
        }]
      }]
    };
  }

  private getWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  private mapOpenWeatherToWttrCode(openWeatherId: number): number {
    // Map OpenWeatherMap weather IDs to wttr.in weather codes
    const idMapping: { [key: number]: number } = {
      // Clear
      800: 113, // clear sky
      // Clouds
      801: 116, // few clouds
      802: 119, // scattered clouds
      803: 122, // broken clouds
      804: 122, // overcast clouds
      // Rain
      500: 296, // light rain
      501: 302, // moderate rain
      502: 308, // heavy intensity rain
      503: 308, // very heavy rain
      504: 308, // extreme rain
      511: 314, // freezing rain
      520: 353, // light intensity shower rain
      521: 356, // shower rain
      522: 359, // heavy intensity shower rain
      531: 359, // ragged shower rain
      // Drizzle
      300: 263, // light intensity drizzle
      301: 266, // drizzle
      302: 266, // heavy intensity drizzle
      310: 263, // light intensity drizzle rain
      311: 266, // drizzle rain
      312: 266, // heavy intensity drizzle rain
      313: 356, // shower rain and drizzle
      314: 356, // heavy shower rain and drizzle
      321: 356, // shower drizzle
      // Snow
      600: 326, // light snow
      601: 332, // snow
      602: 338, // heavy snow
      611: 317, // sleet
      612: 317, // light shower sleet
      613: 320, // shower sleet
      615: 323, // light rain and snow
      616: 329, // rain and snow
      620: 368, // light shower snow
      621: 371, // shower snow
      622: 371, // heavy shower snow
      // Thunderstorm
      200: 386, // thunderstorm with light rain
      201: 389, // thunderstorm with rain
      202: 389, // thunderstorm with heavy rain
      210: 386, // light thunderstorm
      211: 389, // thunderstorm
      212: 389, // heavy thunderstorm
      221: 389, // ragged thunderstorm
      230: 392, // thunderstorm with light drizzle
      231: 392, // thunderstorm with drizzle
      232: 395, // thunderstorm with heavy drizzle
      // Atmosphere
      701: 248, // mist
      711: 248, // smoke
      721: 248, // haze
      731: 248, // sand/dust whirls
      741: 248, // fog
      751: 248, // sand
      761: 248, // dust
      762: 248, // volcanic ash
      771: 248, // squalls
      781: 248  // tornado
    };

    return idMapping[openWeatherId] || 113; // Default to sunny
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

  // Note: applyFilters and applyTransformations methods are implemented in the CUSTOM API HELPER METHODS section below

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

    // Special formatting for cryptocurrency price data
    if (this.isCryptoPriceData(data)) {
      logInfo('IntegrationManager', 'Detected crypto price data');
      return this.formatCryptoPriceEmbed(data, integration);
    }

    // Special formatting for weather data
    if (this.isWeatherData(data)) {
      logInfo('IntegrationManager', 'Detected weather data');
      return this.formatWeatherEmbed(data, integration);
    }

    logInfo('IntegrationManager', `No special formatting detected for integration ${integration.name}, using JSON fallback`);
    return {
      content: `**API Response:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
    };
  }

  private isCryptoPriceData(data: any): boolean {
    // Check if this looks like CoinGecko crypto price data
    return data && typeof data === 'object' && 
           (data.bitcoin || data.ethereum || data.solana) &&
           Object.values(data).some((coin: any) => coin.usd !== undefined);
  }

  private formatCryptoPriceEmbed(data: any, integration: Integration): any {
    const fields: any[] = [];
    const cryptoEmojis: { [key: string]: string } = {
      bitcoin: '₿',
      ethereum: 'Ξ',
      solana: '◎'
    };

    const cryptoNames: { [key: string]: string } = {
      bitcoin: 'Bitcoin',
      ethereum: 'Ethereum',
      solana: 'Solana'
    };

    // Process each cryptocurrency
    Object.entries(data).forEach(([coin, priceData]: [string, any]) => {
      if (priceData && priceData.usd !== undefined) {
        const price = priceData.usd;
        const change24h = priceData.usd_24h_change || 0;
        const emoji = cryptoEmojis[coin] || '💰';
        const name = cryptoNames[coin] || coin.charAt(0).toUpperCase() + coin.slice(1);
        
        // Format price with appropriate decimal places
        const formattedPrice = price >= 1 ? 
          `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` :
          `$${price.toFixed(6)}`;
        
        // Format 24h change with color indication
        const changePrefix = change24h >= 0 ? '+' : '';
        const changeFormatted = `${changePrefix}${change24h.toFixed(2)}%`;
        const changeIndicator = change24h >= 0 ? '📈' : '📉';
        
        fields.push({
          name: `${emoji} ${name}`,
          value: `**${formattedPrice}**\n${changeIndicator} ${changeFormatted} (24h)`,
          inline: true
        });
      }
    });

    const embed = {
      title: '💰 Cryptocurrency Prices',
      description: 'Real-time cryptocurrency market data',
      color: 0x00D4AA, // Crypto green color
      fields: fields,
      footer: {
        text: `${integration.name} • Powered by CoinGecko`,
        icon_url: 'https://static.coingecko.com/s/thumbnail-007177f3eca19695592f0b8b0eabbdae282b54154e1be912285c9034ea6cbaf2.png'
      },
      timestamp: new Date().toISOString()
    };

    return { embeds: [embed] };
  }

  private isWeatherData(data: any): boolean {
    // Check if this looks like wttr.in weather data
    return data && typeof data === 'object' && 
           data.current_condition && Array.isArray(data.current_condition) &&
           data.weather && Array.isArray(data.weather);
  }

  private formatWeatherEmbed(data: any, integration: Integration): any {
    const current = data.current_condition[0];
    const location = data.nearest_area ? data.nearest_area[0] : null;
    const forecast = data.weather && data.weather[0] ? data.weather[0] : null;

    const locationName = location ? 
      `${location.areaName[0].value}, ${location.country[0].value}` : 
      'Unknown Location';

    const temp = current.temp_C;
    const feelsLike = current.FeelsLikeC;
    const humidity = current.humidity;
    const windSpeed = current.windspeedKmph;
    const windDir = current.winddir16Point;
    const pressure = current.pressure;
    const visibility = current.visibility;
    const weatherDesc = current.weatherDesc[0].value;
    const cloudCover = current.cloudcover;

    // Get weather emoji based on weather code
    const weatherCode = parseInt(current.weatherCode);
    const weatherEmoji = this.getWeatherEmoji(weatherCode);

    const embed = {
      title: `${weatherEmoji} Current Weather in ${locationName}`,
      color: this.getWeatherColor(weatherCode),
      fields: [
        {
          name: '🌡️ Temperature',
          value: `${temp}°C (feels like ${feelsLike}°C)`,
          inline: true
        },
        {
          name: '☁️ Conditions',
          value: weatherDesc,
          inline: true
        },
        {
          name: '💧 Humidity',
          value: `${humidity}%`,
          inline: true
        },
        {
          name: '💨 Wind',
          value: `${windSpeed} km/h ${windDir}`,
          inline: true
        },
        {
          name: '🌊 Pressure',
          value: `${pressure} mb`,
          inline: true
        },
        {
          name: '👁️ Visibility',
          value: `${visibility} km`,
          inline: true
        }
      ],
      footer: {
        text: `${integration.name} • Weather data from wttr.in`,
        icon_url: 'https://wttr.in/favicon.ico'
      },
      timestamp: new Date().toISOString()
    };

    // Add forecast if available
    if (forecast && forecast.hourly && forecast.hourly.length > 0) {
      const todayForecast = forecast.hourly[0];
      embed.fields.push({
        name: '📈 Today\'s Forecast',
        value: `High: ${forecast.maxtempC}°C | Low: ${forecast.mintempC}°C\nChance of rain: ${todayForecast.chanceofrain}%`,
        inline: false
      });
    }

    return { embeds: [embed] };
  }

  private getWeatherEmoji(weatherCode: number): string {
    // Map weather codes to emojis
    const weatherEmojis: { [key: number]: string } = {
      113: '☀️', // Sunny
      116: '⛅', // Partly cloudy
      119: '☁️', // Cloudy
      122: '☁️', // Overcast
      143: '🌫️', // Mist
      176: '🌦️', // Patchy rain possible
      179: '🌨️', // Patchy snow possible
      182: '🌧️', // Patchy sleet possible
      185: '🌧️', // Patchy freezing drizzle possible
      200: '⛈️', // Thundery outbreaks possible
      227: '🌨️', // Blowing snow
      230: '❄️', // Blizzard
      248: '🌫️', // Fog
      260: '🌫️', // Freezing fog
      263: '🌦️', // Patchy light drizzle
      266: '🌧️', // Light drizzle
      281: '🌧️', // Freezing drizzle
      284: '🌧️', // Heavy freezing drizzle
      293: '🌦️', // Patchy light rain
      296: '🌧️', // Light rain
      299: '🌧️', // Moderate rain at times
      302: '🌧️', // Moderate rain
      305: '🌧️', // Heavy rain at times
      308: '🌧️', // Heavy rain
      311: '🌧️', // Light freezing rain
      314: '🌧️', // Moderate or heavy freezing rain
      317: '🌧️', // Light sleet
      320: '🌧️', // Moderate or heavy sleet
      323: '🌨️', // Patchy light snow
      326: '🌨️', // Light snow
      329: '🌨️', // Patchy moderate snow
      332: '🌨️', // Moderate snow
      335: '❄️', // Patchy heavy snow
      338: '❄️', // Heavy snow
      350: '🌧️', // Ice pellets
      353: '🌦️', // Light rain shower
      356: '🌧️', // Moderate or heavy rain shower
      359: '🌧️', // Torrential rain shower
      362: '🌨️', // Light sleet showers
      365: '🌨️', // Moderate or heavy sleet showers
      368: '🌨️', // Light snow showers
      371: '❄️', // Moderate or heavy snow showers
      374: '🌧️', // Light showers of ice pellets
      377: '🌧️', // Moderate or heavy showers of ice pellets
      386: '⛈️', // Patchy light rain with thunder
      389: '⛈️', // Moderate or heavy rain with thunder
      392: '⛈️', // Patchy light snow with thunder
      395: '⛈️'  // Moderate or heavy snow with thunder
    };

    return weatherEmojis[weatherCode] || '🌤️';
  }

  private getWeatherColor(weatherCode: number): number {
    // Return colors based on weather conditions
    if ([113].includes(weatherCode)) return 0xFFD700; // Sunny - gold
    if ([116, 119].includes(weatherCode)) return 0x87CEEB; // Partly cloudy - sky blue
    if ([122, 143, 248, 260].includes(weatherCode)) return 0x708090; // Cloudy/foggy - slate gray
    if ([200, 386, 389, 392, 395].includes(weatherCode)) return 0x4B0082; // Thunder - indigo
    if ([176, 179, 182, 185, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308, 311, 314, 317, 320, 350, 353, 356, 359, 362, 365, 374, 377].includes(weatherCode)) return 0x4169E1; // Rain - royal blue
    if ([227, 230, 323, 326, 329, 332, 335, 338, 368, 371].includes(weatherCode)) return 0xF0F8FF; // Snow - alice blue
    return 0x87CEEB; // Default sky blue
  }

  // Note: All specific API types (crypto, stocks, news, etc.) are now handled 
  // through the generic rest_api type with proper configuration

  // ==========================================
  // CUSTOM API HELPER METHODS
  // ==========================================

  private extractDataByPath(data: any, path: string): any {
    if (!path || path === '') return data;
    
    const keys = path.split('.');
    let current = data;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return null;
      }
      
      // Handle array indices like "data[0]" or "items[0].name"
      if (key.includes('[') && key.includes(']')) {
        const [arrayKey, indexStr] = key.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        
        if (arrayKey) {
          current = current[arrayKey];
        }
        
        if (Array.isArray(current) && index >= 0 && index < current.length) {
          current = current[index];
        } else {
          return null;
        }
      } else {
        current = current[key];
      }
    }
    
    return current;
  }

  private applyFilters(data: any, filterConfig: any): any {
    try {
      const filters = typeof filterConfig === 'string' ? JSON.parse(filterConfig) : filterConfig;
      let result = data;

      // Apply array filters
      if (Array.isArray(result) && filters.array) {
        if (filters.array.limit && typeof filters.array.limit === 'number') {
          result = result.slice(0, filters.array.limit);
        }
        
        if (filters.array.filter_by && typeof filters.array.filter_by === 'object') {
          const { field, operator, value } = filters.array.filter_by;
          result = result.filter((item: any) => {
            const itemValue = this.extractDataByPath(item, field);
            
            switch (operator) {
              case 'equals': return itemValue === value;
              case 'contains': return typeof itemValue === 'string' && itemValue.includes(value);
              case 'greater_than': return typeof itemValue === 'number' && itemValue > value;
              case 'less_than': return typeof itemValue === 'number' && itemValue < value;
              case 'not_empty': return itemValue !== null && itemValue !== undefined && itemValue !== '';
              default: return true;
            }
          });
        }
      }

      // Apply field filters (select specific fields)
      if (filters.fields && Array.isArray(filters.fields)) {
        if (Array.isArray(result)) {
          result = result.map((item: any) => {
            const filtered: any = {};
            filters.fields.forEach((field: string) => {
              const value = this.extractDataByPath(item, field);
              if (value !== undefined) {
                filtered[field] = value;
              }
            });
            return filtered;
          });
        } else if (typeof result === 'object') {
          const filtered: any = {};
          filters.fields.forEach((field: string) => {
            const value = this.extractDataByPath(result, field);
            if (value !== undefined) {
              filtered[field] = value;
            }
          });
          result = filtered;
        }
      }

      return result;
    } catch (error) {
      logError('IntegrationManager', `Error applying filters: ${error}`);
      return data; // Return original data if filtering fails
    }
  }

  private applyTransformations(data: any, transformConfig: any): any {
    try {
      const transforms = typeof transformConfig === 'string' ? JSON.parse(transformConfig) : transformConfig;
      let result = data;

      // Apply field mappings (rename fields)
      if (transforms.field_mappings && typeof transforms.field_mappings === 'object') {
        if (Array.isArray(result)) {
          result = result.map((item: any) => {
            const transformed: any = { ...item };
            Object.entries(transforms.field_mappings).forEach(([oldField, newField]) => {
              if (item.hasOwnProperty(oldField)) {
                transformed[newField as string] = item[oldField];
                delete transformed[oldField];
              }
            });
            return transformed;
          });
        } else if (typeof result === 'object') {
          const transformed: any = { ...result };
          Object.entries(transforms.field_mappings).forEach(([oldField, newField]) => {
            if (result.hasOwnProperty(oldField)) {
              transformed[newField as string] = result[oldField];
              delete transformed[oldField];
            }
          });
          result = transformed;
        }
      }

      // Apply value transformations
      if (transforms.value_transforms && Array.isArray(transforms.value_transforms)) {
        transforms.value_transforms.forEach((transform: any) => {
          const { field, operation, value } = transform;
          
          if (Array.isArray(result)) {
            result = result.map((item: any) => {
              const fieldValue = this.extractDataByPath(item, field);
              const newItem = { ...item };
              
              switch (operation) {
                case 'multiply':
                  if (typeof fieldValue === 'number') {
                    this.setValueByPath(newItem, field, fieldValue * value);
                  }
                  break;
                case 'format_date':
                  if (fieldValue) {
                    this.setValueByPath(newItem, field, new Date(fieldValue).toLocaleDateString());
                  }
                  break;
                case 'uppercase':
                  if (typeof fieldValue === 'string') {
                    this.setValueByPath(newItem, field, fieldValue.toUpperCase());
                  }
                  break;
                case 'lowercase':
                  if (typeof fieldValue === 'string') {
                    this.setValueByPath(newItem, field, fieldValue.toLowerCase());
                  }
                  break;
              }
              
              return newItem;
            });
          }
        });
      }

      return result;
    } catch (error) {
      logError('IntegrationManager', `Error applying transformations: ${error}`);
      return data; // Return original data if transformation fails
    }
  }

  private setValueByPath(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  private formatCustomAPIResponse(data: any, integration: Integration, embedConfig: any = {}): any {
    try {
      const {
        title = `📡 ${integration.name}`,
        description = 'API Response',
        color = 0x00D4AA,
        max_fields = 10,
        format_as_code = false,
        thumbnail_url = '',
        show_timestamp = true
      } = embedConfig;

      // If data is simple (string, number, boolean), show it directly
      if (typeof data !== 'object' || data === null) {
        return {
          embeds: [{
            title,
            description: format_as_code ? `\`\`\`\n${data}\n\`\`\`` : String(data),
            color,
            thumbnail: thumbnail_url ? { url: thumbnail_url } : undefined,
            timestamp: show_timestamp ? new Date().toISOString() : undefined,
            footer: { text: `${integration.name} • Custom API` }
          }]
        };
      }

      // If data is an array, show first few items
      if (Array.isArray(data)) {
        const fields: any[] = [];
        const itemsToShow = Math.min(data.length, max_fields);
        
        for (let i = 0; i < itemsToShow; i++) {
          const item = data[i];
          let fieldValue = '';
          
          if (typeof item === 'object') {
            // Show key properties of the object
            const keys = Object.keys(item).slice(0, 3);
            fieldValue = keys.map(key => `**${key}:** ${String(item[key]).substring(0, 100)}`).join('\n');
          } else {
            fieldValue = String(item).substring(0, 200);
          }
          
          fields.push({
            name: `📄 Item ${i + 1}`,
            value: fieldValue || 'No data',
            inline: false
          });
        }

        if (data.length > max_fields) {
          fields.push({
            name: '➕ More items',
            value: `... and ${data.length - max_fields} more items`,
            inline: false
          });
        }

        return {
          embeds: [{
            title,
            description: `Found ${data.length} items`,
            color,
            fields,
            thumbnail: thumbnail_url ? { url: thumbnail_url } : undefined,
            timestamp: show_timestamp ? new Date().toISOString() : undefined,
            footer: { text: `${integration.name} • Custom API` }
          }]
        };
      }

      // If data is an object, show its properties
      const fields: any[] = [];
      const entries = Object.entries(data).slice(0, max_fields);
      
      entries.forEach(([key, value]) => {
        let fieldValue = '';
        
        if (typeof value === 'object') {
          if (Array.isArray(value)) {
            fieldValue = `Array with ${value.length} items`;
          } else if (value === null) {
            fieldValue = 'null';
          } else {
            fieldValue = JSON.stringify(value).substring(0, 200);
          }
        } else {
          fieldValue = String(value).substring(0, 200);
        }
        
        fields.push({
          name: `🔗 ${key}`,
          value: format_as_code ? `\`\`\`\n${fieldValue}\n\`\`\`` : fieldValue,
          inline: true
        });
      });

      return {
        embeds: [{
          title,
          description,
          color,
          fields,
          thumbnail: thumbnail_url ? { url: thumbnail_url } : undefined,
          timestamp: show_timestamp ? new Date().toISOString() : undefined,
          footer: { text: `${integration.name} • Custom API` }
        }]
      };

    } catch (error) {
      logError('IntegrationManager', `Error formatting API response: ${error}`);
      
      // Fallback to simple text format
      return {
        embeds: [{
          title: `📡 ${integration.name}`,
          description: `\`\`\`json\n${JSON.stringify(data, null, 2).substring(0, 1900)}\n\`\`\``,
          color: 0x00D4AA,
          timestamp: new Date().toISOString(),
          footer: { text: `${integration.name} • Custom API (Raw)` }
        }]
      };
    }
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