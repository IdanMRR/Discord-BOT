import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Chip,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  LinearProgress,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tab,
  Tabs,
  CircularProgress,
  Badge
} from '@mui/material';
// Removed div import - using custom CSS grid instead
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  Settings as SettingsIcon,
  CloudSync as CloudSyncIcon,
  Webhook as WebhookIcon,
  Api as ApiIcon,
  RssFeed as RssIcon,
  GitHub as GitHubIcon,
  Twitter as TwitterIcon,
  YouTube as YouTubeIcon,
  SportsEsports as TwitchIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Visibility as ViewIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

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

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const IntegrationsHub: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Set<number>>(new Set());
  
  // Dialog states
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
    events: [],
    rate_limit_per_minute: 60,
    secret_token: ''
  });

  const { enqueueSnackbar } = useSnackbar();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load integrations
      const integrationsResponse = await fetch('/api/integrations');
      if (integrationsResponse.ok) {
        const integrationsData = await integrationsResponse.json();
        setIntegrations(integrationsData);
      }

      // Load webhooks
      const webhooksResponse = await fetch('/api/webhooks');
      if (webhooksResponse.ok) {
        const webhooksData = await webhooksResponse.json();
        setWebhooks(webhooksData);
      }

      // Load recent logs
      const logsResponse = await fetch('/api/integration-logs?limit=50');
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setLogs(logsData);
      }

    } catch (error) {
      console.error('Error loading integrations data:', error);
      enqueueSnackbar('Failed to load integrations data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleCreateIntegration = async () => {
    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIntegration)
      });

      if (response.ok) {
        enqueueSnackbar('Integration created successfully', { variant: 'success' });
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
      } else {
        throw new Error('Failed to create integration');
      }
    } catch (error) {
      console.error('Error creating integration:', error);
      enqueueSnackbar('Failed to create integration', { variant: 'error' });
    }
  };

  const handleToggleIntegration = async (id: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });

      if (response.ok) {
        enqueueSnackbar(`Integration ${!isActive ? 'enabled' : 'disabled'}`, { variant: 'success' });
        loadData();
      } else {
        throw new Error('Failed to toggle integration');
      }
    } catch (error) {
      console.error('Error toggling integration:', error);
      enqueueSnackbar('Failed to toggle integration', { variant: 'error' });
    }
  };

  const handleSyncIntegration = async (id: number) => {
    try {
      setSyncing(prev => new Set(prev.add(id)));
      
      const response = await fetch(`/api/integrations/${id}/sync`, {
        method: 'POST'
      });

      if (response.ok) {
        enqueueSnackbar('Integration synced successfully', { variant: 'success' });
        loadData();
      } else {
        throw new Error('Failed to sync integration');
      }
    } catch (error) {
      console.error('Error syncing integration:', error);
      enqueueSnackbar('Failed to sync integration', { variant: 'error' });
    } finally {
      setSyncing(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDeleteIntegration = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this integration? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/integrations/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        enqueueSnackbar('Integration deleted successfully', { variant: 'success' });
        loadData();
      } else {
        throw new Error('Failed to delete integration');
      }
    } catch (error) {
      console.error('Error deleting integration:', error);
      enqueueSnackbar('Failed to delete integration', { variant: 'error' });
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'rss': return <RssIcon />;
      case 'github': return <GitHubIcon />;
      case 'api': return <ApiIcon />;
      case 'webhook': return <WebhookIcon />;
      case 'twitter': return <TwitterIcon />;
      case 'twitch': return <TwitchIcon />;
      case 'youtube': return <YouTubeIcon />;
      default: return <CloudSyncIcon />;
    }
  };

  const getStatusColor = (integration: Integration) => {
    if (!integration.is_active) return 'default';
    if (integration.error_count > 0) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Integrations Hub
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateIntegrationOpen(true)}
        >
          Create Integration
        </Button>
      </Box>

      <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={`Integrations (${integrations.length})`} />
        <Tab label={`Webhooks (${webhooks.length})`} />
        <Tab label="Activity Logs" />
        <Tab label="Statistics" />
      </Tabs>

      {/* Integrations Tab */}
      <TabPanel value={tabValue} index={0}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {integrations.map((integration) => (
            <div key={integration.id}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    {getIntegrationIcon(integration.integration_type)}
                    <Box ml={2} flexGrow={1}>
                      <Typography variant="h6" noWrap>
                        {integration.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {integration.provider} • {integration.integration_type.toUpperCase()}
                      </Typography>
                    </Box>
                    <Chip
                      label={integration.is_active ? 'Active' : 'Inactive'}
                      color={getStatusColor(integration)}
                      size="small"
                    />
                  </Box>

                  <Box display="flex" justifyContent="space-between" mb={2}>
                    <Box textAlign="center">
                      <Typography variant="h6">{integration.sync_count}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Syncs
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" color={integration.error_count > 0 ? 'error' : 'inherit'}>
                        {integration.error_count}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Errors
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6">
                        {integration.sync_frequency ? `${integration.sync_frequency}s` : 'Manual'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Frequency
                      </Typography>
                    </Box>
                  </Box>

                  {integration.last_sync && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Last sync: {new Date(integration.last_sync).toLocaleString()}
                    </Typography>
                  )}

                  {integration.last_error && (
                    <Alert severity="error" sx={{ mt: 1, fontSize: '0.75rem' }}>
                      {integration.last_error.substring(0, 100)}
                      {integration.last_error.length > 100 && '...'}
                    </Alert>
                  )}
                </CardContent>

                <CardActions>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={integration.is_active}
                        onChange={() => handleToggleIntegration(integration.id, integration.is_active)}
                        size="small"
                      />
                    }
                    label=""
                  />
                  
                  <Tooltip title="Sync Now">
                    <IconButton
                      onClick={() => handleSyncIntegration(integration.id)}
                      disabled={syncing.has(integration.id)}
                      size="small"
                    >
                      {syncing.has(integration.id) ? <CircularProgress size={20} /> : <SyncIcon />}
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Edit">
                    <IconButton
                      onClick={() => {
                        setSelectedIntegration(integration);
                        setEditIntegrationOpen(true);
                      }}
                      size="small"
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="View Details">
                    <IconButton size="small">
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Delete">
                    <IconButton
                      onClick={() => handleDeleteIntegration(integration.id)}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </div>
          ))}

          {integrations.length === 0 && (
            <div>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <CloudSyncIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Integrations Yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Create your first integration to connect external services with Discord.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateIntegrationOpen(true)}
                  >
                    Create Integration
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </TabPanel>

      {/* Webhooks Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">Webhooks</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateWebhookOpen(true)}
          >
            Create Webhook
          </Button>
        </Box>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {webhooks.map((webhook) => (
            <div key={webhook.id}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <WebhookIcon />
                    <Box ml={2} flexGrow={1}>
                      <Typography variant="h6" noWrap>
                        {webhook.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {webhook.events.join(', ')}
                      </Typography>
                    </Box>
                    <Chip
                      label={webhook.is_active ? 'Active' : 'Inactive'}
                      color={webhook.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  <Box display="flex" justifyContent="space-between" mb={2}>
                    <Box textAlign="center">
                      <Typography variant="h6" color="success.main">
                        {webhook.success_count}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Success
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" color="error.main">
                        {webhook.failure_count}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Failures
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6">
                        {webhook.rate_limit_per_minute}/min
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Rate Limit
                      </Typography>
                    </Box>
                  </Box>

                  {webhook.last_triggered && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Last triggered: {new Date(webhook.last_triggered).toLocaleString()}
                    </Typography>
                  )}
                </CardContent>

                <CardActions>
                  <Button size="small" startIcon={<ViewIcon />}>
                    View
                  </Button>
                  <Button size="small" startIcon={<EditIcon />}>
                    Edit
                  </Button>
                  <Button size="small" color="error" startIcon={<DeleteIcon />}>
                    Delete
                  </Button>
                </CardActions>
              </Card>
            </div>
          ))}

          {webhooks.length === 0 && (
            <div>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <WebhookIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Webhooks Yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Create webhooks to receive real-time notifications from external services.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateWebhookOpen(true)}
                  >
                    Create Webhook
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </TabPanel>

      {/* Activity Logs Tab */}
      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" gutterBottom>
          Recent Activity
        </Typography>
        
        <List>
          {logs.slice(0, 20).map((log, index) => (
            <React.Fragment key={log.id}>
              <ListItem>
                <ListItemIcon>
                  {log.status === 'success' ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <ErrorIcon color="error" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={log.event_type}
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        {new Date(log.created_at).toLocaleString()}
                      </Typography>
                      {log.processing_time && (
                        <Typography variant="caption" color="text.secondary">
                          Processing time: {log.processing_time}ms
                        </Typography>
                      )}
                      {log.error_message && (
                        <Typography variant="caption" color="error.main" display="block">
                          Error: {log.error_message.substring(0, 100)}
                          {log.error_message.length > 100 && '...'}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Chip
                    label={log.status}
                    color={log.status === 'success' ? 'success' : 'error'}
                    size="small"
                  />
                </ListItemSecondaryAction>
              </ListItem>
              {index < logs.length - 1 && <Divider />}
            </React.Fragment>
          ))}

          {logs.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No activity logs yet"
                secondary="Integration activity will appear here"
              />
            </ListItem>
          )}
        </List>
      </TabPanel>

      {/* Statistics Tab */}
      <TabPanel value={tabValue} index={3}>
        <Typography variant="h6" gutterBottom>
          Integration Statistics
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Detailed statistics and analytics will be available here in a future update.
        </Typography>
      </TabPanel>

      {/* Create Integration Dialog */}
      <Dialog
        open={createIntegrationOpen}
        onClose={() => setCreateIntegrationOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Integration</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Integration Name"
              value={newIntegration.name}
              onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
              fullWidth
            />
            
            <TextField
              select
              label="Integration Type"
              value={newIntegration.integration_type}
              onChange={(e) => setNewIntegration({ ...newIntegration, integration_type: e.target.value })}
              fullWidth
            >
              <MenuItem value="rss">RSS Feed</MenuItem>
              <MenuItem value="github">GitHub</MenuItem>
              <MenuItem value="api">REST API</MenuItem>
              <MenuItem value="webhook">Webhook</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </TextField>

            <TextField
              label="Provider"
              value={newIntegration.provider}
              onChange={(e) => setNewIntegration({ ...newIntegration, provider: e.target.value })}
              fullWidth
              helperText="e.g., github.com, reddit.com, custom-api"
            />

            <TextField
              label="Target Channel ID"
              value={newIntegration.target_channel_id}
              onChange={(e) => setNewIntegration({ ...newIntegration, target_channel_id: e.target.value })}
              fullWidth
              helperText="Discord channel ID where notifications will be sent"
            />

            <TextField
              label="Sync Frequency (seconds)"
              type="number"
              value={newIntegration.sync_frequency}
              onChange={(e) => setNewIntegration({ ...newIntegration, sync_frequency: parseInt(e.target.value) })}
              fullWidth
              helperText="How often to check for updates (0 for manual only)"
            />

            <TextField
              label="Message Template (optional)"
              value={newIntegration.message_template}
              onChange={(e) => setNewIntegration({ ...newIntegration, message_template: e.target.value })}
              multiline
              rows={3}
              fullWidth
              helperText="Custom message format for notifications"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateIntegrationOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateIntegration} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IntegrationsHub;