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
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  FormControl,
  InputLabel,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
// Removed div import - using custom CSS grid instead
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Settings as SettingsIcon,
  SmartToy as AutomationIcon,
  Schedule as ScheduleIcon,
  Event as EventIcon,
  Person as PersonIcon,
  Message as MessageIcon,
  VolumeUp as VoiceIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as ViewIcon,
  History as HistoryIcon,
  Timeline as TimelineIcon,
  Build as BuildIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

interface ScheduledTask {
  id: number;
  name: string;
  description?: string;
  task_type: string;
  trigger_type: string;
  cron_expression?: string;
  interval_seconds?: number;
  scheduled_time?: string;
  is_active: boolean;
  execution_count: number;
  error_count: number;
  last_execution?: string;
  next_execution?: string;
  target_channel_id?: string;
  message_template?: string;
  created_at: string;
  last_error?: string;
}

interface AutomationRule {
  id: number;
  name: string;
  description?: string;
  trigger_event: string;
  actions: any[];
  is_active: boolean;
  priority: number;
  execution_count: number;
  success_count: number;
  error_count: number;
  last_execution?: string;
  cooldown_seconds: number;
  max_triggers_per_user?: number;
  created_at: string;
  last_error?: string;
}

interface ExecutionHistory {
  id: number;
  execution_type: 'scheduled_task' | 'automation_rule';
  task_id?: number;
  rule_id?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  start_time: string;
  end_time?: string;
  execution_duration?: number;
  actions_performed?: any[];
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

const Automation: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<Set<number>>(new Set());
  
  // Dialog states
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editRuleOpen, setEditRuleOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  
  // Form states
  const [newTask, setNewTask] = useState({
    name: '',
    description: '',
    task_type: 'message',
    trigger_type: 'cron',
    cron_expression: '0 9 * * *',
    interval_seconds: 3600,
    target_channel_id: '',
    message_template: '',
    timezone: 'UTC'
  });

  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    trigger_event: 'member_join',
    actions: [],
    priority: 0,
    cooldown_seconds: 0,
    max_triggers_per_user: null as number | null
  });

  const { enqueueSnackbar } = useSnackbar();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load scheduled tasks
      const tasksResponse = await fetch('/api/scheduled-tasks');
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json();
        setScheduledTasks(tasksData);
      }

      // Load automation rules
      const rulesResponse = await fetch('/api/automation-rules');
      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setAutomationRules(rulesData);
      }

      // Load execution history
      const historyResponse = await fetch('/api/execution-history?limit=50');
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setExecutionHistory(historyData);
      }

    } catch (error) {
      console.error('Error loading automation data:', error);
      enqueueSnackbar('Failed to load automation data', { variant: 'error' });
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

  const handleCreateTask = async () => {
    try {
      const response = await fetch('/api/scheduled-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });

      if (response.ok) {
        enqueueSnackbar('Scheduled task created successfully', { variant: 'success' });
        setCreateTaskOpen(false);
        setNewTask({
          name: '',
          description: '',
          task_type: 'message',
          trigger_type: 'cron',
          cron_expression: '0 9 * * *',
          interval_seconds: 3600,
          target_channel_id: '',
          message_template: '',
          timezone: 'UTC'
        });
        loadData();
      } else {
        throw new Error('Failed to create scheduled task');
      }
    } catch (error) {
      console.error('Error creating scheduled task:', error);
      enqueueSnackbar('Failed to create scheduled task', { variant: 'error' });
    }
  };

  const handleCreateRule = async () => {
    try {
      const response = await fetch('/api/automation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });

      if (response.ok) {
        enqueueSnackbar('Automation rule created successfully', { variant: 'success' });
        setCreateRuleOpen(false);
        setNewRule({
          name: '',
          description: '',
          trigger_event: 'member_join',
          actions: [],
          priority: 0,
          cooldown_seconds: 0,
          max_triggers_per_user: null
        });
        loadData();
      } else {
        throw new Error('Failed to create automation rule');
      }
    } catch (error) {
      console.error('Error creating automation rule:', error);
      enqueueSnackbar('Failed to create automation rule', { variant: 'error' });
    }
  };

  const handleToggleTask = async (id: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/scheduled-tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });

      if (response.ok) {
        enqueueSnackbar(`Task ${!isActive ? 'enabled' : 'disabled'}`, { variant: 'success' });
        loadData();
      } else {
        throw new Error('Failed to toggle task');
      }
    } catch (error) {
      console.error('Error toggling task:', error);
      enqueueSnackbar('Failed to toggle task', { variant: 'error' });
    }
  };

  const handleToggleRule = async (id: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/automation-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });

      if (response.ok) {
        enqueueSnackbar(`Rule ${!isActive ? 'enabled' : 'disabled'}`, { variant: 'success' });
        loadData();
      } else {
        throw new Error('Failed to toggle rule');
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
      enqueueSnackbar('Failed to toggle rule', { variant: 'error' });
    }
  };

  const handleExecuteTask = async (id: number) => {
    try {
      setExecuting(prev => new Set(prev.add(id)));
      
      const response = await fetch(`/api/scheduled-tasks/${id}/execute`, {
        method: 'POST'
      });

      if (response.ok) {
        enqueueSnackbar('Task executed successfully', { variant: 'success' });
        loadData();
      } else {
        throw new Error('Failed to execute task');
      }
    } catch (error) {
      console.error('Error executing task:', error);
      enqueueSnackbar('Failed to execute task', { variant: 'error' });
    } finally {
      setExecuting(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleTestRule = async (id: number) => {
    try {
      const response = await fetch(`/api/automation-rules/${id}/test`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        enqueueSnackbar('Rule test completed - check logs for details', { variant: 'info' });
      } else {
        throw new Error('Failed to test rule');
      }
    } catch (error) {
      console.error('Error testing rule:', error);
      enqueueSnackbar('Failed to test rule', { variant: 'error' });
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'message':
      case 'announcement':
        return <MessageIcon />;
      case 'role_assignment':
        return <PersonIcon />;
      case 'channel_action':
        return <SettingsIcon />;
      case 'moderation':
        return <SecurityIcon />;
      default:
        return <ScheduleIcon />;
    }
  };

  const getRuleIcon = (event: string) => {
    switch (event) {
      case 'member_join':
      case 'member_leave':
        return <PersonIcon />;
      case 'message_sent':
        return <MessageIcon />;
      case 'voice_join':
      case 'voice_leave':
        return <VoiceIcon />;
      case 'reaction_added':
        return <EventIcon />;
      default:
        return <AutomationIcon />;
    }
  };

  const getStatusColor = (item: ScheduledTask | AutomationRule) => {
    if (!item.is_active) return 'default';
    if (item.error_count > 0) return 'warning';
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
          Automation Center
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<ScheduleIcon />}
            onClick={() => setCreateTaskOpen(true)}
            sx={{ mr: 1 }}
          >
            Create Task
          </Button>
          <Button
            variant="contained"
            startIcon={<AutomationIcon />}
            onClick={() => setCreateRuleOpen(true)}
          >
            Create Rule
          </Button>
        </Box>
      </Box>

      <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={`Scheduled Tasks (${scheduledTasks.length})`} />
        <Tab label={`Automation Rules (${automationRules.length})`} />
        <Tab label="Execution History" />
        <Tab label="Task Builder" />
      </Tabs>

      {/* Scheduled Tasks Tab */}
      <TabPanel value={tabValue} index={0}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {scheduledTasks.map((task) => (
            <div key={task.id}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    {getTaskIcon(task.task_type)}
                    <Box ml={2} flexGrow={1}>
                      <Typography variant="h6" noWrap>
                        {task.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {task.task_type.replace('_', ' ')} • {task.trigger_type}
                      </Typography>
                    </Box>
                    <Chip
                      label={task.is_active ? 'Active' : 'Inactive'}
                      color={getStatusColor(task)}
                      size="small"
                    />
                  </Box>

                  {task.description && (
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      {task.description}
                    </Typography>
                  )}

                  <Box display="flex" justifyContent="space-between" mb={2}>
                    <Box textAlign="center">
                      <Typography variant="h6">{task.execution_count}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Executions
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" color={task.error_count > 0 ? 'error' : 'inherit'}>
                        {task.error_count}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Errors
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6">
                        {task.cron_expression ? 'Cron' : task.interval_seconds ? `${task.interval_seconds}s` : 'Once'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Schedule
                      </Typography>
                    </Box>
                  </Box>

                  {task.next_execution && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Next: {new Date(task.next_execution).toLocaleString()}
                    </Typography>
                  )}

                  {task.last_execution && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Last: {new Date(task.last_execution).toLocaleString()}
                    </Typography>
                  )}

                  {task.last_error && (
                    <Alert severity="error" sx={{ mt: 1, fontSize: '0.75rem' }}>
                      {task.last_error.substring(0, 100)}
                      {task.last_error.length > 100 && '...'}
                    </Alert>
                  )}
                </CardContent>

                <CardActions>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={task.is_active}
                        onChange={() => handleToggleTask(task.id, task.is_active)}
                        size="small"
                      />
                    }
                    label=""
                  />
                  
                  <Tooltip title="Execute Now">
                    <IconButton
                      onClick={() => handleExecuteTask(task.id)}
                      disabled={executing.has(task.id)}
                      size="small"
                    >
                      {executing.has(task.id) ? <CircularProgress size={20} /> : <PlayIcon />}
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Edit">
                    <IconButton
                      onClick={() => {
                        setSelectedTask(task);
                        setEditTaskOpen(true);
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
                    <IconButton size="small" color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </div>
          ))}

          {scheduledTasks.length === 0 && (
            <div>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <ScheduleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Scheduled Tasks Yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Create your first scheduled task to automate recurring actions.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateTaskOpen(true)}
                  >
                    Create Task
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </TabPanel>

      {/* Automation Rules Tab */}
      <TabPanel value={tabValue} index={1}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {automationRules.map((rule) => (
            <div key={rule.id}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    {getRuleIcon(rule.trigger_event)}
                    <Box ml={2} flexGrow={1}>
                      <Typography variant="h6" noWrap>
                        {rule.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {rule.trigger_event.replace('_', ' ')} • Priority: {rule.priority}
                      </Typography>
                    </Box>
                    <Chip
                      label={rule.is_active ? 'Active' : 'Inactive'}
                      color={getStatusColor(rule)}
                      size="small"
                    />
                  </Box>

                  {rule.description && (
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      {rule.description}
                    </Typography>
                  )}

                  <Box display="flex" justifyContent="space-between" mb={2}>
                    <Box textAlign="center">
                      <Typography variant="h6">{rule.execution_count}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Total
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" color="success.main">
                        {rule.success_count}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Success
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" color={rule.error_count > 0 ? 'error' : 'inherit'}>
                        {rule.error_count}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Errors
                      </Typography>
                    </Box>
                  </Box>

                  <Box display="flex" justifyContent="space-between" mb={2}>
                    <Typography variant="caption" color="text.secondary">
                      Actions: {rule.actions.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Cooldown: {rule.cooldown_seconds}s
                    </Typography>
                  </Box>

                  {rule.last_execution && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Last: {new Date(rule.last_execution).toLocaleString()}
                    </Typography>
                  )}

                  {rule.last_error && (
                    <Alert severity="error" sx={{ mt: 1, fontSize: '0.75rem' }}>
                      {rule.last_error.substring(0, 100)}
                      {rule.last_error.length > 100 && '...'}
                    </Alert>
                  )}
                </CardContent>

                <CardActions>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={rule.is_active}
                        onChange={() => handleToggleRule(rule.id, rule.is_active)}
                        size="small"
                      />
                    }
                    label=""
                  />
                  
                  <Tooltip title="Test Rule">
                    <IconButton
                      onClick={() => handleTestRule(rule.id)}
                      size="small"
                      color="info"
                    >
                      <PlayIcon />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Edit">
                    <IconButton
                      onClick={() => {
                        setSelectedRule(rule);
                        setEditRuleOpen(true);
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
                    <IconButton size="small" color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </div>
          ))}

          {automationRules.length === 0 && (
            <div>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <AutomationIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Automation Rules Yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Create your first automation rule to respond to server events automatically.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateRuleOpen(true)}
                  >
                    Create Rule
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </TabPanel>

      {/* Execution History Tab */}
      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" gutterBottom>
          Recent Executions
        </Typography>
        
        <List>
          {executionHistory.slice(0, 20).map((execution, index) => (
            <React.Fragment key={execution.id}>
              <ListItem>
                <ListItemIcon>
                  {execution.status === 'completed' ? (
                    <CheckCircleIcon color="success" />
                  ) : execution.status === 'failed' ? (
                    <ErrorIcon color="error" />
                  ) : execution.status === 'running' ? (
                    <CircularProgress size={24} />
                  ) : (
                    <WarningIcon color="warning" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={`${execution.execution_type === 'scheduled_task' ? 'Task' : 'Rule'} ${execution.task_id || execution.rule_id}`}
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        {new Date(execution.start_time).toLocaleString()}
                      </Typography>
                      {execution.execution_duration && (
                        <Typography variant="caption" color="text.secondary">
                          Duration: {execution.execution_duration}ms
                        </Typography>
                      )}
                      {execution.actions_performed && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Actions: {execution.actions_performed.length}
                        </Typography>
                      )}
                      {execution.error_message && (
                        <Typography variant="caption" color="error.main" display="block">
                          Error: {execution.error_message.substring(0, 100)}
                          {execution.error_message.length > 100 && '...'}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Chip
                    label={execution.status}
                    color={
                      execution.status === 'completed' ? 'success' :
                      execution.status === 'failed' ? 'error' :
                      execution.status === 'running' ? 'info' : 'warning'
                    }
                    size="small"
                  />
                </ListItemSecondaryAction>
              </ListItem>
              {index < executionHistory.length - 1 && <Divider />}
            </React.Fragment>
          ))}

          {executionHistory.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No execution history yet"
                secondary="Task and rule executions will appear here"
              />
            </ListItem>
          )}
        </List>
      </TabPanel>

      {/* Task Builder Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box textAlign="center" py={6}>
          <BuildIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Visual Task Builder
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            A drag-and-drop interface for building complex automation workflows will be available here.
          </Typography>
          <Button variant="outlined" disabled startIcon={<BuildIcon />}>
            Coming Soon
          </Button>
        </Box>
      </TabPanel>

      {/* Create Task Dialog */}
      <Dialog
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Scheduled Task</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Task Name"
              value={newTask.name}
              onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
              fullWidth
            />
            
            <TextField
              label="Description (optional)"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            
            <TextField
              select
              label="Task Type"
              value={newTask.task_type}
              onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}
              fullWidth
            >
              <MenuItem value="message">Send Message</MenuItem>
              <MenuItem value="announcement">Send Announcement</MenuItem>
              <MenuItem value="role_assignment">Role Assignment</MenuItem>
              <MenuItem value="channel_action">Channel Action</MenuItem>
              <MenuItem value="moderation">Moderation Action</MenuItem>
              <MenuItem value="custom">Custom Action</MenuItem>
            </TextField>

            <TextField
              select
              label="Trigger Type"
              value={newTask.trigger_type}
              onChange={(e) => setNewTask({ ...newTask, trigger_type: e.target.value })}
              fullWidth
            >
              <MenuItem value="cron">Cron Schedule</MenuItem>
              <MenuItem value="interval">Interval</MenuItem>
              <MenuItem value="once">One Time</MenuItem>
              <MenuItem value="event">Event Triggered</MenuItem>
            </TextField>

            {newTask.trigger_type === 'cron' && (
              <TextField
                label="Cron Expression"
                value={newTask.cron_expression}
                onChange={(e) => setNewTask({ ...newTask, cron_expression: e.target.value })}
                fullWidth
                helperText="e.g., '0 9 * * *' for daily at 9 AM"
              />
            )}

            {newTask.trigger_type === 'interval' && (
              <TextField
                label="Interval (seconds)"
                type="number"
                value={newTask.interval_seconds}
                onChange={(e) => setNewTask({ ...newTask, interval_seconds: parseInt(e.target.value) })}
                fullWidth
                helperText="How often to run the task"
              />
            )}

            <TextField
              label="Target Channel ID"
              value={newTask.target_channel_id}
              onChange={(e) => setNewTask({ ...newTask, target_channel_id: e.target.value })}
              fullWidth
              helperText="Discord channel ID where action will be performed"
            />

            <TextField
              label="Message Template (optional)"
              value={newTask.message_template}
              onChange={(e) => setNewTask({ ...newTask, message_template: e.target.value })}
              multiline
              rows={3}
              fullWidth
              helperText="Message content with placeholders like {user}, {server}, etc."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateTask} variant="contained">
            Create Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Rule Dialog */}
      <Dialog
        open={createRuleOpen}
        onClose={() => setCreateRuleOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Automation Rule</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Rule Name"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              fullWidth
            />
            
            <TextField
              label="Description (optional)"
              value={newRule.description}
              onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            
            <TextField
              select
              label="Trigger Event"
              value={newRule.trigger_event}
              onChange={(e) => setNewRule({ ...newRule, trigger_event: e.target.value })}
              fullWidth
            >
              <MenuItem value="member_join">Member Join</MenuItem>
              <MenuItem value="member_leave">Member Leave</MenuItem>
              <MenuItem value="message_sent">Message Sent</MenuItem>
              <MenuItem value="reaction_added">Reaction Added</MenuItem>
              <MenuItem value="role_assigned">Role Assigned</MenuItem>
              <MenuItem value="voice_join">Voice Join</MenuItem>
              <MenuItem value="voice_leave">Voice Leave</MenuItem>
              <MenuItem value="custom">Custom Event</MenuItem>
            </TextField>

            <TextField
              label="Priority"
              type="number"
              value={newRule.priority}
              onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
              fullWidth
              helperText="Higher priority rules execute first (0-100)"
            />

            <TextField
              label="Cooldown (seconds)"
              type="number"
              value={newRule.cooldown_seconds}
              onChange={(e) => setNewRule({ ...newRule, cooldown_seconds: parseInt(e.target.value) })}
              fullWidth
              helperText="Minimum time between executions for the same user"
            />

            <TextField
              label="Max Triggers per User (optional)"
              type="number"
              value={newRule.max_triggers_per_user || ''}
              onChange={(e) => setNewRule({ ...newRule, max_triggers_per_user: e.target.value ? parseInt(e.target.value) : null })}
              fullWidth
              helperText="Maximum number of times this rule can trigger for one user"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateRuleOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateRule} variant="contained">
            Create Rule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Automation;