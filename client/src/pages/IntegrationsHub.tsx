import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  CloudIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  RssIcon,
  CommandLineIcon,
  ClockIcon,
  EyeIcon,
  SunIcon
} from '@heroicons/react/24/outline';
import ActionButton from '../components/common/ActionButton';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PermissionGuard from '../components/common/PermissionGuard';
import toast from 'react-hot-toast';

interface Integration {
  id: number;
  name: string;
  integration_type: string;
  provider: string;
  is_active: boolean;
  sync_count: number;
  error_count: number;
  last_sync?: string;
  next_sync?: string;
  target_channel_id?: string;
  sync_frequency?: number;
  created_at: string;
  last_error?: string;
}

interface Webhook {
  id: number;
  name: string;
  webhook_url: string;
  events: string[];
  is_active: boolean;
  success_count: number;
  failure_count: number;
  last_triggered?: string;
  rate_limit_per_minute: number;
}

interface IntegrationLog {
  id: number;
  event_type: string;
  status: 'success' | 'failed' | 'pending' | 'cancelled';
  processing_time?: number;
  created_at: string;
  error_message?: string;
}

// Tab Panel Component
function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <div>{children}</div>}
    </div>
  );
}

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const IntegrationsHubContent: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const [tabValue, setTabValue] = useState(0);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Set<number>>(new Set());
  
  // Modal states
  const [createIntegrationOpen, setCreateIntegrationOpen] = useState(false);
  const [editIntegrationOpen, setEditIntegrationOpen] = useState(false);
  const [createWebhookOpen, setCreateWebhookOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  
  // Form states
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    integration_type: 'rss',
    provider: '',
    config: {},
    target_channel_id: '',
    sync_frequency: 300,
    message_template: ''
  });

  const [newWebhook, setNewWebhook] = useState({
    name: '',
    events: [] as string[],
    rate_limit_per_minute: 60,
    secret_token: ''
  });

  const loadData = useCallback(async () => {
    if (!serverId) return;
    
    try {
      setLoading(true);
      
      // Load integrations first
      const integrationsResponse = await fetch(`/api/integrations?guild_id=${serverId}`, {
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        }
      });
      
      let currentIntegrations: Integration[] = [];
      if (integrationsResponse.ok) {
        const data = await integrationsResponse.json();
        currentIntegrations = data.data || [];
        setIntegrations(currentIntegrations);
      }

      // Load webhooks
      const webhooksResponse = await fetch(`/api/integrations/webhooks?guild_id=${serverId}`, {
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        }
      });
      
      if (webhooksResponse.ok) {
        const webhookData = await webhooksResponse.json();
        setWebhooks(webhookData.data || []);
      }

      // Load logs - use the current integrations data
      try {
        if (currentIntegrations.length > 0) {
          const integrationsWithLogs = await Promise.all(
            currentIntegrations.map(async (integration) => {
              try {
                const logResponse = await fetch(`/api/integrations/${integration.id}/logs?limit=10`, {
                  headers: {
                    'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': 'dashboard-user',
                    'Content-Type': 'application/json'
                  }
                });
                if (logResponse.ok) {
                  const logData = await logResponse.json();
                  return logData.data || [];
                }
                return [];
              } catch {
                return [];
              }
            })
          );
          
          // Flatten all logs and sort by created_at
          const allLogs = integrationsWithLogs.flat().sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ).slice(0, 50); // Keep only the 50 most recent logs
          
          setLogs(allLogs);
        }
      } catch (error) {
        console.error('Error loading logs:', error);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSyncIntegration = async (integrationId: number) => {
    setSyncing(prev => new Set(prev).add(integrationId));
    
    try {
      await fetch(`/api/integrations/${integrationId}/sync`, {
        method: 'POST',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        }
      });
      toast.success('Integration synced successfully');
      loadData();
    } catch (error) {
      toast.error('Failed to sync integration');
    } finally {
      setSyncing(prev => {
        const newSet = new Set(prev);
        newSet.delete(integrationId);
        return newSet;
      });
    }
  };

  const handleToggleIntegration = async (integrationId: number, currentState: boolean) => {
    try {
      await fetch(`/api/integrations/${integrationId}`, {
        method: 'PUT',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !currentState })
      });
      toast.success(`Integration ${!currentState ? 'enabled' : 'disabled'}`);
      loadData();
    } catch (error) {
      toast.error('Failed to update integration');
    }
  };

  const handleDeleteIntegration = async (integrationId: number) => {
    if (!window.confirm('Are you sure you want to delete this integration?')) return;
    
    try {
      await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        }
      });
      toast.success('Integration deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete integration');
    }
  };

  const handleCreateIntegration = async () => {
    try {
      const config: any = {};
      
      // Configure based on integration type
      switch (newIntegration.integration_type) {
        case 'rss':
          config.feed_url = newIntegration.provider;
          config.url = newIntegration.provider;
          break;
        case 'rest_api':
          config.api_url = newIntegration.provider;
          config.method = 'GET';
          config.auth_type = 'none';
          config.headers = {};
          break;
        case 'webhook':
          config.webhook_url = newIntegration.provider;
          config.url = newIntegration.provider;
          break;
        case 'github':
          config.repository = newIntegration.provider;
          config.url = `https://api.github.com/repos/${newIntegration.provider}`;
          break;
        case 'weather':
          config.location = newIntegration.provider;
          config.api_service = 'wttr.in'; // Default to free wttr.in service
          break;
        default:
          config.url = newIntegration.provider;
      }

      await fetch('/api/integrations', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newIntegration.name,
          integration_type: newIntegration.integration_type,
          provider: newIntegration.provider,
          config: config,
          target_channel_id: newIntegration.target_channel_id,
          sync_frequency: newIntegration.sync_frequency,
          message_template: newIntegration.message_template,
          guild_id: serverId
        })
      });
      toast.success('Integration created successfully');
      setCreateIntegrationOpen(false);
      setNewIntegration({
        name: '',
        integration_type: 'rss',
        provider: '',
        config: {},
        target_channel_id: '',
        sync_frequency: 300,
        message_template: ''
      });
      loadData();
    } catch (error) {
      toast.error('Failed to create integration');
    }
  };

  const handleCreateWebhook = async () => {
    try {
      const webhookData = {
        ...newWebhook,
        guild_id: serverId,
        webhook_url: `${window.location.origin}/api/integrations/webhooks/receive` // Generate a webhook URL
      };

      await fetch('/api/integrations/webhooks', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookData)
      });
      toast.success('Webhook created successfully');
      setCreateWebhookOpen(false);
      setNewWebhook({
        name: '',
        events: [],
        rate_limit_per_minute: 60,
        secret_token: ''
      });
      loadData();
    } catch (error) {
      toast.error('Failed to create webhook');
    }
  };

  const handleUpdateIntegration = async () => {
    if (!selectedIntegration) return;
    
    try {
      const config: any = {};
      
      // Configure based on integration type
      switch (selectedIntegration.integration_type) {
        case 'rss':
          config.feed_url = selectedIntegration.provider;
          config.url = selectedIntegration.provider;
          break;
        case 'rest_api':
          config.api_url = selectedIntegration.provider;
          config.method = 'GET';
          config.auth_type = 'none';
          config.headers = {};
          break;
        case 'webhook':
          config.webhook_url = selectedIntegration.provider;
          config.url = selectedIntegration.provider;
          break;
        case 'github':
          config.repository = selectedIntegration.provider;
          config.url = `https://api.github.com/repos/${selectedIntegration.provider}`;
          break;
        case 'weather':
          config.location = selectedIntegration.provider;
          config.api_service = 'wttr.in'; // Default to free wttr.in service
          break;
        default:
          config.url = selectedIntegration.provider;
      }

      await fetch(`/api/integrations/${selectedIntegration.id}`, {
        method: 'PUT',
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': 'dashboard-user',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: selectedIntegration.name,
          integration_type: selectedIntegration.integration_type,
          provider: selectedIntegration.provider,
          config: config,
          target_channel_id: selectedIntegration.target_channel_id,
          sync_frequency: selectedIntegration.sync_frequency || 300
        })
      });
      toast.success('Integration updated successfully');
      setEditIntegrationOpen(false);
      setSelectedIntegration(null);
      loadData();
    } catch (error) {
      toast.error('Failed to update integration');
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'rss': return RssIcon;
      case 'rest_api': return GlobeAltIcon;
      case 'github': return CodeBracketIcon;
      case 'weather': return SunIcon;
      case 'webhook': return CommandLineIcon;
      case 'custom': return CloudIcon;
      default: return CloudIcon;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-success';
      case 'failed': return 'text-destructive';
      case 'pending': return 'text-warning';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrations Hub</h1>
          <p className="text-muted-foreground">
            Connect external services and manage webhooks for your Discord server
          </p>
        </div>
        <ActionButton
          variant="primary"
          icon={PlusIcon}
          onClick={() => setCreateIntegrationOpen(true)}
        >
          Create Integration
        </ActionButton>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {[
            { name: `Integrations (${integrations.length})`, index: 0 },
            { name: `Webhooks (${webhooks.length})`, index: 1 },
            { name: 'Activity Logs', index: 2 },
            { name: 'Statistics', index: 3 }
          ].map((tab) => (
            <button
              key={tab.index}
              onClick={() => setTabValue(tab.index)}
              className={classNames(
                'py-2 px-1 border-b-2 font-medium text-sm',
                tabValue === tab.index
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Integrations Tab */}
      <TabPanel value={tabValue} index={0}>
        {integrations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.map((integration) => {
              const IconComponent = getIntegrationIcon(integration.integration_type);
              return (
                <div key={integration.id} className="card hover:shadow-lg transition-shadow min-h-[280px]">
                  <div className="p-6 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-foreground truncate">
                            {integration.name}
                          </h3>
                          <p className="text-sm text-muted-foreground capitalize break-words">
                            {integration.integration_type}
                          </p>
                          <p className="text-xs text-muted-foreground break-all mt-1" title={integration.provider}>
                            {integration.provider}
                          </p>
                        </div>
                      </div>
                      <span className={classNames(
                        'px-2 py-1 rounded-lg text-xs font-medium border',
                        integration.is_active ? 'bg-success/20 text-success border-success/20' : 'bg-muted text-muted-foreground'
                      )}>
                        {integration.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-success">{integration.sync_count}</div>
                        <div className="text-xs text-muted-foreground">Syncs</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-destructive">{integration.error_count}</div>
                        <div className="text-xs text-muted-foreground">Errors</div>
                      </div>
                    </div>

                    {integration.last_sync && (
                      <p className="text-xs text-muted-foreground mb-4">
                        Last sync: {new Date(integration.last_sync).toLocaleString()}
                      </p>
                    )}

                    <div className="border-t border-border pt-4 flex items-center justify-between mt-auto">
                      {/* Toggle Switch */}
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={integration.is_active}
                          onChange={() => handleToggleIntegration(integration.id, integration.is_active)}
                          className="sr-only"
                        />
                        <div className={classNames(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
                          integration.is_active ? "bg-primary" : "bg-muted"
                        )}>
                          <span className={classNames(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200",
                            integration.is_active ? "translate-x-6" : "translate-x-1"
                          )} />
                        </div>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {integration.is_active ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleSyncIntegration(integration.id)}
                          disabled={syncing.has(integration.id)}
                          className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                          title="Sync Now"
                        >
                          {syncing.has(integration.id) ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          ) : (
                            <ArrowPathIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setSelectedIntegration(integration);
                            setEditIntegrationOpen(true);
                          }}
                          className="p-2 rounded-lg hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4 text-muted-foreground" />
                        </button>

                        <button
                          className="p-2 rounded-lg hover:bg-muted transition-colors"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4 text-muted-foreground" />
                        </button>

                        <button
                          onClick={() => handleDeleteIntegration(integration.id)}
                          className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card text-center py-12">
            <CloudIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">
              No Integrations Yet
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first integration to connect external services with Discord.
            </p>
            <ActionButton
              variant="primary"
              icon={PlusIcon}
              onClick={() => setCreateIntegrationOpen(true)}
            >
              Create Integration
            </ActionButton>
          </div>
        )}
      </TabPanel>

      {/* Webhooks Tab */}
      <TabPanel value={tabValue} index={1}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Webhooks</h2>
          <ActionButton
            variant="primary"
            icon={PlusIcon}
            onClick={() => setCreateWebhookOpen(true)}
          >
            Create Webhook
          </ActionButton>
        </div>

        {webhooks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="card hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <GlobeAltIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-foreground truncate">
                          {webhook.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {webhook.events.join(', ')}
                        </p>
                      </div>
                    </div>
                    <span className={classNames(
                      'px-2 py-1 rounded-lg text-xs font-medium border',
                      webhook.is_active ? 'bg-success/20 text-success border-success/20' : 'bg-muted text-muted-foreground'
                    )}>
                      {webhook.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-success">{webhook.success_count}</div>
                      <div className="text-xs text-muted-foreground">Success</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-destructive">{webhook.failure_count}</div>
                      <div className="text-xs text-muted-foreground">Failures</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-foreground">{webhook.rate_limit_per_minute}/min</div>
                      <div className="text-xs text-muted-foreground">Rate Limit</div>
                    </div>
                  </div>

                  {webhook.last_triggered && (
                    <p className="text-xs text-muted-foreground mb-4">
                      Last triggered: {new Date(webhook.last_triggered).toLocaleString()}
                    </p>
                  )}

                  <div className="border-t border-border pt-4 flex items-center justify-end space-x-1">
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors" title="View">
                      <EyeIcon className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors" title="Edit">
                      <PencilIcon className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors" title="Delete">
                      <TrashIcon className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <GlobeAltIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">
              No Webhooks Yet
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create webhooks to receive real-time notifications from external services.
            </p>
            <ActionButton
              variant="primary"
              icon={PlusIcon}
              onClick={() => setCreateWebhookOpen(true)}
            >
              Create Webhook
            </ActionButton>
          </div>
        )}
      </TabPanel>

      {/* Activity Logs Tab */}
      <TabPanel value={tabValue} index={2}>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Recent Activity</h2>
          
          {logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={classNames(
                        'w-2 h-2 rounded-full',
                        log.status === 'success' ? 'bg-success' :
                        log.status === 'failed' ? 'bg-destructive' :
                        log.status === 'pending' ? 'bg-warning' : 'bg-muted'
                      )} />
                      <div>
                        <p className="font-medium text-foreground">{log.event_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={classNames(
                        'px-2 py-1 rounded text-xs font-medium',
                        getStatusColor(log.status)
                      )}>
                        {log.status}
                      </span>
                      {log.processing_time && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {log.processing_time}ms
                        </p>
                      )}
                    </div>
                  </div>
                  {log.error_message && (
                    <div className="mt-2 text-sm text-destructive">
                      {log.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-12">
              <ClockIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                No Activity Yet
              </h3>
              <p className="text-muted-foreground">
                Activity logs will appear here once integrations start running.
              </p>
            </div>
          )}
        </div>
      </TabPanel>

      {/* Statistics Tab */}
      <TabPanel value={tabValue} index={3}>
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Integration Statistics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-6 text-center">
              <div className="text-3xl font-bold text-primary mb-2">{integrations.length}</div>
              <div className="text-sm text-muted-foreground">Total Integrations</div>
            </div>
            <div className="card p-6 text-center">
              <div className="text-3xl font-bold text-success mb-2">
                {integrations.filter(i => i.is_active).length}
              </div>
              <div className="text-sm text-muted-foreground">Active Integrations</div>
            </div>
            <div className="card p-6 text-center">
              <div className="text-3xl font-bold text-info mb-2">
                {integrations.reduce((sum, i) => sum + i.sync_count, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Syncs</div>
            </div>
            <div className="card p-6 text-center">
              <div className="text-3xl font-bold text-destructive mb-2">
                {integrations.reduce((sum, i) => sum + i.error_count, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Errors</div>
            </div>
          </div>
        </div>
      </TabPanel>

      {/* Create Integration Modal */}
      {createIntegrationOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 overflow-y-auto flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-4">Create Integration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={newIntegration.name}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="My Integration"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                  <select
                    value={newIntegration.integration_type}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, integration_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="rss">RSS Feed</option>
                    <option value="rest_api">REST API (JSON)</option>
                    <option value="github">GitHub</option>
                    <option value="weather">Weather</option>
                    <option value="webhook">Webhook</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {newIntegration.integration_type === 'rss' ? 'RSS Feed URL' :
                     newIntegration.integration_type === 'rest_api' ? 'API Endpoint URL' :
                     newIntegration.integration_type === 'github' ? 'GitHub Repository (owner/repo)' :
                     newIntegration.integration_type === 'weather' ? 'Location (e.g., Kiryat Yam, Israel)' :
                     newIntegration.integration_type === 'webhook' ? 'Webhook URL' :
                     'Provider/Source'}
                  </label>
                  <input
                    type="text"
                    value={newIntegration.provider}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, provider: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={
                      newIntegration.integration_type === 'rss' ? 'https://example.com/feed.xml' :
                      newIntegration.integration_type === 'rest_api' ? 'https://api.example.com/data (JSON endpoint)' :
                      newIntegration.integration_type === 'github' ? 'username/repository' :
                      newIntegration.integration_type === 'weather' ? 'Kiryat Yam, Israel' :
                      newIntegration.integration_type === 'webhook' ? 'https://example.com/webhook' :
                      'Enter provider name or URL'
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Target Channel ID</label>
                  <input
                    type="text"
                    value={newIntegration.target_channel_id}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, target_channel_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Channel ID where messages will be sent"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Right-click on a Discord channel and select "Copy ID"</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Sync Frequency (seconds)</label>
                  <input
                    type="number"
                    value={newIntegration.sync_frequency}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, sync_frequency: parseInt(e.target.value) || 300 }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="300"
                    min="60"
                    max="3600"
                  />
                  <p className="text-xs text-muted-foreground mt-1">How often to check for new content (60-3600 seconds)</p>
                </div>

                {/* Advanced REST API Configuration */}
                {newIntegration.integration_type === 'rest_api' && (
                  <div className="border-t border-border pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3">⚙️ Advanced API Configuration</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">HTTP Method</label>
                        <select className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground">
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Authentication</label>
                        <select className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground">
                          <option value="none">None</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="api_key">API Key</option>
                          <option value="basic">Basic Auth</option>
                          <option value="custom">Custom Header</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-medium text-foreground mb-1">Data Path (optional)</label>
                      <input
                        type="text"
                        className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                        placeholder="data.items or items[0].name"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Extract specific data from response (e.g., "data.items" or "user.name")</p>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-medium text-foreground mb-1">Custom Headers (JSON)</label>
                      <textarea
                        rows={2}
                        className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                        placeholder='{"Accept": "application/json", "User-Agent": "MyBot"}'
                      />
                    </div>

                    <div className="mt-3">
                      <details className="border border-border rounded">
                        <summary className="px-3 py-2 cursor-pointer text-sm font-medium text-foreground bg-muted/50">
                          🎯 Advanced Filtering & Formatting
                        </summary>
                        <div className="p-3 space-y-3 text-xs">
                          <div>
                            <label className="block font-medium text-foreground mb-1">Filter Config (JSON)</label>
                            <textarea
                              rows={3}
                              className="w-full px-2 py-1 border border-border rounded bg-background text-foreground"
                              placeholder='{"array": {"limit": 5}, "fields": ["id", "name", "status"]}'
                            />
                          </div>
                          <div>
                            <label className="block font-medium text-foreground mb-1">Embed Config (JSON)</label>
                            <textarea
                              rows={3}
                              className="w-full px-2 py-1 border border-border rounded bg-background text-foreground"
                              placeholder='{"title": "📊 API Data", "color": 54442, "max_fields": 10}'
                            />
                          </div>
                        </div>
                      </details>
                    </div>

                    <div className="mt-3 p-3 bg-muted/20 rounded border-l-4 border-primary">
                      <p className="text-xs text-muted-foreground">
                        💡 <strong>REST API Examples (JSON endpoints):</strong><br/>
                        • <strong>Crypto Prices:</strong> <code>https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd</code><br/>
                        • <strong>Cat Facts:</strong> <code>https://catfact.ninja/fact</code> (data path: "fact")<br/>
                        • <strong>News:</strong> <code>https://jsonplaceholder.typicode.com/posts</code> (limit with filters)<br/>
                        • <strong>GitHub:</strong> <code>https://api.github.com/users/username</code> (needs Bearer token)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer - Fixed at bottom */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-card">
              <button
                onClick={() => setCreateIntegrationOpen(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <ActionButton
                variant="primary"
                onClick={handleCreateIntegration}
                disabled={!newIntegration.name || !newIntegration.provider}
              >
                Create Integration
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Integration Modal */}
      {editIntegrationOpen && selectedIntegration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 overflow-y-auto flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-4">Edit Integration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={selectedIntegration.name}
                    onChange={(e) => setSelectedIntegration(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="My Integration"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                  <select
                    value={selectedIntegration.integration_type}
                    onChange={(e) => setSelectedIntegration(prev => prev ? ({ ...prev, integration_type: e.target.value }) : null)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="rss">RSS Feed</option>
                    <option value="rest_api">REST API (JSON)</option>
                    <option value="github">GitHub</option>
                    <option value="weather">Weather</option>
                    <option value="webhook">Webhook</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {selectedIntegration.integration_type === 'rss' ? 'RSS Feed URL' :
                     selectedIntegration.integration_type === 'rest_api' ? 'API Endpoint URL' :
                     selectedIntegration.integration_type === 'github' ? 'GitHub Repository (owner/repo)' :
                     selectedIntegration.integration_type === 'weather' ? 'Location (e.g., Kiryat Yam, Israel)' :
                     selectedIntegration.integration_type === 'webhook' ? 'Webhook URL' :
                     'Provider/Source'}
                  </label>
                  <input
                    type="text"
                    value={selectedIntegration.provider}
                    onChange={(e) => setSelectedIntegration(prev => prev ? ({ ...prev, provider: e.target.value }) : null)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={
                      selectedIntegration.integration_type === 'rss' ? 'https://example.com/feed.xml' :
                      selectedIntegration.integration_type === 'rest_api' ? 'https://api.example.com/data (JSON endpoint)' :
                      selectedIntegration.integration_type === 'github' ? 'username/repository' :
                      selectedIntegration.integration_type === 'weather' ? 'Kiryat Yam, Israel' :
                      selectedIntegration.integration_type === 'webhook' ? 'https://example.com/webhook' :
                      'Enter provider name or URL'
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Target Channel ID</label>
                  <input
                    type="text"
                    value={selectedIntegration.target_channel_id || ''}
                    onChange={(e) => setSelectedIntegration(prev => prev ? ({ ...prev, target_channel_id: e.target.value }) : null)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Channel ID where messages will be sent"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Right-click on a Discord channel and select "Copy ID"</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Sync Frequency (seconds)</label>
                  <input
                    type="number"
                    value={selectedIntegration.sync_frequency || 300}
                    onChange={(e) => setSelectedIntegration(prev => prev ? ({ ...prev, sync_frequency: parseInt(e.target.value) || 300 }) : null)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="300"
                    min="60"
                    max="3600"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Minimum: 60 seconds, Maximum: 3600 seconds (1 hour)</p>
                </div>
              </div>
            </div>
            
            {/* Modal Footer - Fixed at bottom */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-card">
              <button
                onClick={() => {
                  setEditIntegrationOpen(false);
                  setSelectedIntegration(null);
                }}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <ActionButton
                variant="primary"
                onClick={handleUpdateIntegration}
                disabled={!selectedIntegration.name || !selectedIntegration.provider}
              >
                Update Integration
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Create Webhook Modal */}
      {createWebhookOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 overflow-y-auto flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-4">Create Webhook</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={newWebhook.name}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="My Webhook"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Events</label>
                  <select
                    multiple
                    value={newWebhook.events}
                    onChange={(e) => {
                      const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                      setNewWebhook(prev => ({ ...prev, events: selectedOptions }));
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                  >
                    <option value="member_join">Member Join</option>
                    <option value="member_leave">Member Leave</option>
                    <option value="message_delete">Message Delete</option>
                    <option value="message_edit">Message Edit</option>
                    <option value="role_update">Role Update</option>
                    <option value="channel_create">Channel Create</option>
                    <option value="channel_delete">Channel Delete</option>
                    <option value="ban_add">Member Ban</option>
                    <option value="ban_remove">Member Unban</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Hold Ctrl/Cmd to select multiple events</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Rate Limit (per minute)</label>
                  <input
                    type="number"
                    value={newWebhook.rate_limit_per_minute}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, rate_limit_per_minute: parseInt(e.target.value) || 60 }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="60"
                    min="1"
                    max="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Secret Token (optional)</label>
                  <input
                    type="text"
                    value={newWebhook.secret_token}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, secret_token: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter secret token for webhook security"
                  />
                </div>
              </div>
            </div>
            
            {/* Modal Footer - Fixed at bottom */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-card">
              <button
                onClick={() => setCreateWebhookOpen(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <ActionButton
                variant="primary"
                onClick={handleCreateWebhook}
                disabled={!newWebhook.name || newWebhook.events.length === 0}
              >
                Create Webhook
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const IntegrationsHub: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['view_integrations', 'manage_integrations', 'admin']}
      fallbackMessage="You need integration management permissions to access this page."
    >
      <IntegrationsHubContent />
    </PermissionGuard>
  );
};

export default IntegrationsHub;