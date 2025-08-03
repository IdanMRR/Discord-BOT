import { Request, Response } from 'express';
import crypto from 'crypto';
import { integrationService, IntegrationLog } from '../../services/integrationService';
import { logInfo, logError } from '../../utils/logger';
import { Client } from 'discord.js';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  signature?: string;
  delivery_id?: string;
}

export interface WebhookProcessor {
  type: string;
  process(payload: WebhookPayload, webhook: any, client: Client): Promise<void>;
}

export class WebhookHandler {
  private processors = new Map<string, WebhookProcessor>();
  private client: Client;

  constructor(client: Client) {
    this.client = client;
    this.registerDefaultProcessors();
  }

  // ==========================================
  // MAIN WEBHOOK HANDLER
  // ==========================================

  async handleWebhook(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    let webhookId: number | undefined;
    let status: 'success' | 'failed' = 'success';
    let errorMessage: string | undefined;

    try {
      const { webhookId: id } = req.params;
      webhookId = parseInt(id);

      if (!webhookId || isNaN(webhookId)) {
        res.status(400).json({ error: 'Invalid webhook ID' });
        return;
      }

      // Get webhook configuration
      const webhook = await integrationService.getWebhook(webhookId);
      if (!webhook || !webhook.is_active) {
        res.status(404).json({ error: 'Webhook not found or inactive' });
        return;
      }

      // Verify webhook signature if secret token is set
      if (webhook.secret_token) {
        const signature = (req.headers['x-webhook-signature'] || req.headers['x-hub-signature-256']) as string;
        if (!this.verifySignature(req.body, webhook.secret_token, signature)) {
          res.status(401).json({ error: 'Invalid signature' });
          status = 'failed';
          errorMessage = 'Invalid webhook signature';
          return;
        }
      }

      // Check rate limiting
      if (!(await this.checkRateLimit(webhook))) {
        res.status(429).json({ error: 'Rate limit exceeded' });
        status = 'failed';
        errorMessage = 'Rate limit exceeded';
        return;
      }

      // Check payload size
      const payloadSize = JSON.stringify(req.body).length;
      if (payloadSize > webhook.max_payload_size) {
        res.status(413).json({ error: 'Payload too large' });
        status = 'failed';
        errorMessage = 'Payload too large';
        return;
      }

      // Parse webhook payload
      const payload: WebhookPayload = {
        event: req.headers['x-event-type'] as string || 'webhook',
        timestamp: new Date().toISOString(),
        data: req.body,
        signature: req.headers['x-webhook-signature'] as string,
        delivery_id: req.headers['x-delivery-id'] as string || crypto.randomUUID()
      };

      // Check if this event is handled by the webhook
      if (!webhook.events.includes(payload.event) && !webhook.events.includes('*')) {
        res.status(200).json({ message: 'Event not subscribed' });
        return;
      }

      // Get integration if linked
      let integration = null;
      if (webhook.integration_id) {
        integration = await integrationService.getIntegration(webhook.integration_id);
      }

      // Process webhook based on integration type
      await this.processWebhook(payload, webhook, integration);

      // Update webhook stats
      await integrationService.updateWebhookStats(webhookId, true);

      res.status(200).json({ 
        message: 'Webhook processed successfully',
        delivery_id: payload.delivery_id 
      });

      logInfo('WebhookHandler', `Successfully processed webhook ${webhookId} for event ${payload.event}`);

    } catch (error) {
      status = 'failed';
      errorMessage = error instanceof Error ? error.message : String(error);
      
      logError('WebhookHandler', `Error processing webhook ${webhookId}: ${error}`);

      if (webhookId) {
        await integrationService.updateWebhookStats(webhookId, false, errorMessage);
      }

      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    } finally {
      // Log webhook activity
      if (webhookId) {
        const processingTime = Date.now() - startTime;
        
        await integrationService.logIntegrationActivity({
          guild_id: req.headers['x-guild-id'] as string || '',
          webhook_id: webhookId,
          event_type: req.headers['x-event-type'] as string || 'webhook',
          event_source: 'webhook',
          status,
          request_method: req.method,
          request_url: req.url,
          request_headers: this.sanitizeHeaders(req.headers),
          request_body: req.body,
          response_status: res.statusCode,
          processing_time: processingTime,
          error_message: errorMessage,
          retry_count: 0,
          user_agent: req.headers['user-agent'],
          ip_address: req.ip || req.connection.remoteAddress
        });
      }
    }
  }

  // ==========================================
  // WEBHOOK PROCESSING
  // ==========================================

  private async processWebhook(payload: WebhookPayload, webhook: any, integration: any): Promise<void> {
    try {
      // Determine processor based on integration type or webhook configuration
      let processorType = 'default';
      
      if (integration) {
        processorType = integration.integration_type;
      } else {
        // Try to detect from payload or webhook name
        processorType = this.detectProcessorType(payload, webhook);
      }

      const processor = this.processors.get(processorType);
      if (processor) {
        await processor.process(payload, webhook, this.client);
      } else {
        // Use default processor
        await this.processDefaultWebhook(payload, webhook);
      }

    } catch (error) {
      logError('WebhookHandler', `Error in webhook processor: ${error}`);
      throw error;
    }
  }

  private async processDefaultWebhook(payload: WebhookPayload, webhook: any): Promise<void> {
    // Default webhook processing - just send to target channel
    if (webhook.target_channel_id) {
      const channel = await this.client.channels.fetch(webhook.target_channel_id);
      if (channel && channel.isTextBased()) {
        let message = `**Webhook Event:** ${payload.event}\n`;
        message += `**Time:** ${payload.timestamp}\n`;
        message += `**Data:** \`\`\`json\n${JSON.stringify(payload.data, null, 2)}\n\`\`\``;
        
        await (channel as any).send({
          content: message.length > 2000 ? message.substring(0, 1997) + '...' : message
        });
      }
    }
  }

  private detectProcessorType(payload: WebhookPayload, webhook: any): string {
    // Try to detect from user agent, headers, or payload structure
    if (payload.data?.repository) return 'github';
    if (payload.data?.tweet_create_events) return 'twitter';
    if (payload.data?.stream?.type) return 'twitch';
    if (payload.data?.snippet?.channelId) return 'youtube';
    
    return 'default';
  }

  // ==========================================
  // WEBHOOK PROCESSORS
  // ==========================================

  private registerDefaultProcessors(): void {
    // GitHub webhook processor
    this.registerProcessor({
      type: 'github',
      async process(payload: WebhookPayload, webhook: any, client: Client) {
        const { data } = payload;
        
        if (webhook.target_channel_id) {
          const channel = await client.channels.fetch(webhook.target_channel_id);
          if (channel && channel.isTextBased()) {
            let embed: any = {
              color: 0x333333,
              timestamp: payload.timestamp,
              footer: { text: 'GitHub' }
            };

            switch (payload.event) {
              case 'push':
                embed.title = `📝 Push to ${data.repository.name}`;
                embed.description = `**${data.pusher.name}** pushed ${data.commits.length} commit(s) to **${data.ref.replace('refs/heads/', '')}**`;
                embed.url = data.compare;
                break;
                
              case 'pull_request':
                embed.title = `🔀 Pull Request ${data.action}`;
                embed.description = `**${data.pull_request.title}**\n${data.pull_request.body?.substring(0, 200) || ''}`;
                embed.url = data.pull_request.html_url;
                break;
                
              case 'issues':
                embed.title = `🐛 Issue ${data.action}`;
                embed.description = `**${data.issue.title}**\n${data.issue.body?.substring(0, 200) || ''}`;
                embed.url = data.issue.html_url;
                break;
                
              default:
                embed.title = `GitHub ${payload.event}`;
                embed.description = JSON.stringify(data).substring(0, 200) + '...';
            }

            await (channel as any).send({ embeds: [embed] });
          }
        }
      }
    });

    // Discord webhook processor
    this.registerProcessor({
      type: 'discord',
      async process(payload: WebhookPayload, webhook: any, client: Client) {
        // Handle Discord-to-Discord webhooks (cross-server communication)
        if (webhook.target_channel_id) {
          const channel = await client.channels.fetch(webhook.target_channel_id);
          if (channel && channel.isTextBased()) {
            const embed = {
              title: `Discord Event: ${payload.event}`,
              description: JSON.stringify(payload.data, null, 2),
              color: 0x5865F2,
              timestamp: payload.timestamp
            };

            await (channel as any).send({ embeds: [embed] });
          }
        }
      }
    });

    // RSS webhook processor
    this.registerProcessor({
      type: 'rss',
      async process(payload: WebhookPayload, webhook: any, client: Client) {
        const { data } = payload;
        
        if (webhook.target_channel_id && data.items) {
          const channel = await client.channels.fetch(webhook.target_channel_id);
          if (channel && channel.isTextBased()) {
            for (const item of data.items.slice(0, 3)) { // Limit to 3 items
              const embed = {
                title: item.title,
                description: item.description?.substring(0, 200) || '',
                url: item.link,
                color: 0xFF6600,
                timestamp: item.pubDate || payload.timestamp,
                footer: { text: data.feed?.title || 'RSS Feed' }
              };

              await (channel as any).send({ embeds: [embed] });
            }
          }
        }
      }
    });

    // Custom API webhook processor
    this.registerProcessor({
      type: 'api',
      async process(payload: WebhookPayload, webhook: any, client: Client) {
        // Generic API webhook processing with transformation
        if (webhook.target_channel_id) {
          const channel = await client.channels.fetch(webhook.target_channel_id);
          if (channel && channel.isTextBased()) {
            // Apply transformation if configured
            let processedData = payload.data;
            
            // TODO: Apply transformation rules from webhook configuration
            
            const embed = {
              title: `API Event: ${payload.event}`,
              description: JSON.stringify(processedData, null, 2).substring(0, 200) + '...',
              color: 0x00FF00,
              timestamp: payload.timestamp
            };

            await (channel as any).send({ embeds: [embed] });
          }
        }
      }
    });
  }

  registerProcessor(processor: WebhookProcessor): void {
    this.processors.set(processor.type, processor);
    logInfo('WebhookHandler', `Registered webhook processor: ${processor.type}`);
  }

  // ==========================================
  // SECURITY AND VALIDATION
  // ==========================================

  private verifySignature(payload: any, secret: string, signature: string): boolean {
    if (!signature) return false;

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      // Handle different signature formats
      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      logError('WebhookHandler', `Error verifying signature: ${error}`);
      return false;
    }
  }

  private async checkRateLimit(webhook: any): Promise<boolean> {
    // Simple rate limiting - can be enhanced with Redis for distributed systems
    const now = Date.now();
    const window = 60 * 1000; // 1 minute window
    
    // This is a simplified implementation
    // In production, you'd want to use Redis or a proper rate limiting solution
    return true;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    delete sanitized['x-secret-token'];
    
    return sanitized;
  }
}

export default WebhookHandler;