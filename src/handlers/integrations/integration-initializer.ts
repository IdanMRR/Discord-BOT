import { Client } from 'discord.js';
import { logInfo, logError } from '../../utils/logger';
import IntegrationManager from './integration-manager';
import AutomationHandler from './automation-handler';
import WebhookHandler from './webhook-handler';

export class IntegrationInitializer {
  private client: Client;
  private integrationManager?: IntegrationManager;
  private automationHandler?: AutomationHandler;
  private webhookHandler?: WebhookHandler;

  constructor(client: Client) {
    this.client = client;
  }

  async initialize(): Promise<void> {
    try {
      logInfo('IntegrationInitializer', 'Initializing integration and automation systems...');

      // Initialize Integration Manager
      this.integrationManager = new IntegrationManager(this.client);
      
      // Get handlers from the manager
      this.automationHandler = this.integrationManager.getAutomationHandler();
      this.webhookHandler = this.integrationManager.getWebhookHandler();

      // Setup event listeners for comprehensive logging
      this.setupEventListeners();

      logInfo('IntegrationInitializer', '✅ Integration and automation systems initialized successfully');
    } catch (error) {
      logError('IntegrationInitializer', `❌ Failed to initialize integration systems: ${error}`);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.integrationManager) return;

    // Integration Manager Events
    this.integrationManager.on('integrationSyncStarted', (data) => {
      logInfo('IntegrationManager', `🔄 Started sync for integration ${data.integration.name} (ID: ${data.integration.id})`);
    });

    this.integrationManager.on('integrationSynced', (data) => {
      logInfo('IntegrationManager', `✅ Successfully synced integration ${data.integrationId}`);
    });

    this.integrationManager.on('integrationSyncError', (data) => {
      logError('IntegrationManager', `❌ Sync error for integration ${data.integrationId}: ${data.error}`);
    });

    this.integrationManager.on('integrationSyncStopped', (data) => {
      logInfo('IntegrationManager', `⏹️ Stopped sync for integration ${data.integrationId}`);
    });

    // Automation Handler Events
    if (this.automationHandler) {
      this.automationHandler.on('ruleExecuted', (data) => {
        const { ruleId, status, duration, actionsPerformed } = data;
        if (status === 'completed') {
          logInfo('AutomationHandler', `✅ Rule ${ruleId} executed successfully in ${duration}ms (${actionsPerformed.length} actions)`);
        } else if (status === 'failed') {
          logError('AutomationHandler', `❌ Rule ${ruleId} execution failed after ${duration}ms`);
        }
      });
    }

    // Webhook Handler Events (via Integration Manager)
    this.integrationManager.on('webhookHandlerReady', (webhookHandler: WebhookHandler) => {
      logInfo('IntegrationInitializer', '🌐 Webhook handler is ready');
    });

    // Global error handling for the integration systems
    process.on('unhandledPromiseRejection', (reason, promise) => {
      if (reason && typeof reason === 'object' && 'stack' in reason) {
        const error = reason as Error;
        if (error.stack?.includes('integration') || error.stack?.includes('automation')) {
          logError('IntegrationSystemError', `Unhandled promise rejection in integration systems: ${error.message}`);
          logError('IntegrationSystemError', `Stack trace: ${error.stack}`);
        }
      }
    });
  }

  getIntegrationManager(): IntegrationManager | undefined {
    return this.integrationManager;
  }

  getAutomationHandler(): AutomationHandler | undefined {
    return this.automationHandler;
  }

  getWebhookHandler(): WebhookHandler | undefined {
    return this.webhookHandler;
  }

  async shutdown(): Promise<void> {
    try {
      logInfo('IntegrationInitializer', 'Shutting down integration systems...');
      
      if (this.integrationManager) {
        await this.integrationManager.shutdown();
      }

      logInfo('IntegrationInitializer', '✅ Integration systems shut down successfully');
    } catch (error) {
      logError('IntegrationInitializer', `❌ Error during integration systems shutdown: ${error}`);
    }
  }
}

// Global instance
let integrationInitializer: IntegrationInitializer | null = null;

export function initializeIntegrationSystems(client: Client): Promise<void> {
  if (integrationInitializer) {
    logInfo('IntegrationInitializer', 'Integration systems already initialized');
    return Promise.resolve();
  }

  integrationInitializer = new IntegrationInitializer(client);
  return integrationInitializer.initialize();
}

export function getIntegrationManager(): IntegrationManager | undefined {
  return integrationInitializer?.getIntegrationManager();
}

export function getAutomationHandler(): AutomationHandler | undefined {
  return integrationInitializer?.getAutomationHandler();
}

export function getWebhookHandler(): WebhookHandler | undefined {
  return integrationInitializer?.getWebhookHandler();
}

export async function shutdownIntegrationSystems(): Promise<void> {
  if (integrationInitializer) {
    await integrationInitializer.shutdown();
    integrationInitializer = null;
  }
}