import { apiService } from './api';

interface DashboardAction {
  action: string;
  details?: string;
  serverId: string;
  userId?: string;
  username?: string;
}

class DashboardLogger {
  private queue: DashboardAction[] = [];
  private isProcessing = false;

  /**
   * Log a dashboard action to Discord
   */
  async logAction(action: DashboardAction): Promise<void> {
    try {
      // Add to queue for batch processing
      this.queue.push(action);
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
    } catch (error) {
      console.error('Error queueing dashboard action:', error);
    }
  }

  /**
   * Process the action queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const action = this.queue.shift();
        if (action) {
          await this.sendActionToServer(action);
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Error processing dashboard action queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send action to server for Discord logging
   */
  private async sendActionToServer(action: DashboardAction): Promise<void> {
    try {
      const response = await apiService.post(`/servers/${action.serverId}/dashboard-actions`, {
        action: action.action,
        details: action.details,
        userId: action.userId,
        username: action.username
      });

      if (!response.success) {
        console.warn('Dashboard action logging failed:', response.error);
      }
    } catch (error: any) {
      console.error('Error sending dashboard action to server:', error.message);
    }
  }

  /**
   * Convenience methods for common actions
   */
  async logWarningIssued(serverId: string, targetUser: string, reason: string, username?: string): Promise<void> {
    await this.logAction({
      serverId,
      action: 'Warning Issued',
      details: `Warned ${targetUser} for: ${reason}`,
      username
    });
  }

  async logWarningDeleted(serverId: string, targetUser: string, warningId: string, username?: string): Promise<void> {
    await this.logAction({
      serverId,
      action: 'Warning Deleted',
      details: `Deleted warning #${warningId} for ${targetUser}`,
      username
    });
  }

  async logTicketCreated(serverId: string, ticketId: string, category: string, username?: string): Promise<void> {
    await this.logAction({
      serverId,
      action: 'Ticket Created',
      details: `Created ticket #${ticketId} in category: ${category}`,
      username
    });
  }

  async logTicketClosed(serverId: string, ticketId: string, reason?: string, username?: string): Promise<void> {
    await this.logAction({
      serverId,
      action: 'Ticket Closed',
      details: `Closed ticket #${ticketId}${reason ? ` - Reason: ${reason}` : ''}`,
      username
    });
  }

  async logSettingsChanged(serverId: string, setting: string, oldValue: any, newValue: any, username?: string): Promise<void> {
    await this.logAction({
      serverId,
      action: 'Settings Changed',
      details: `Changed ${setting} from "${oldValue}" to "${newValue}"`,
      username
    });
  }

  async logLevelingAction(serverId: string, targetUser: string, action: string, value?: number, username?: string): Promise<void> {
    await this.logAction({
      serverId,
      action: 'Leveling Action',
      details: `${action} for ${targetUser}${value !== undefined ? ` - Value: ${value}` : ''}`,
      username
    });
  }

  async logLogSettingsChanged(serverId: string, logType: string, enabled: boolean, channelId?: string, username?: string): Promise<void> {
    const status = enabled ? 'enabled' : 'disabled';
    const channelInfo = channelId ? ` in <#${channelId}>` : '';
    
    await this.logAction({
      serverId,
      action: 'Log Settings Changed',
      details: `${logType} logging ${status}${channelInfo}`,
      username
    });
  }
}

// Export singleton instance
export const dashboardLogger = new DashboardLogger();
export default dashboardLogger;