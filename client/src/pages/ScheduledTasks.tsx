import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
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
  Menu,
  MenuList,
  MenuItem as MenuItemComponent,
  ListItemIcon,
  ListItemText,
  TablePagination,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  LinearProgress,
  Fab
} from '@mui/material';
// Removed Grid import - using custom CSS grid instead
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  MoreVert as MoreVertIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as ViewIcon,
  FileCopy as CopyIcon,
  Pause as PauseIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  CalendarToday as CalendarIcon
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
  embed_config?: any;
  timezone: string;
  max_executions?: number;
  conditions?: any[];
  created_by: string;
  created_at: string;
  updated_at?: string;
  last_error?: string;
}

interface TaskExecution {
  id: number;
  task_id: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  start_time: string;
  end_time?: string;
  execution_duration?: number;
  actions_performed?: any[];
  error_message?: string;
  trigger_source: string;
}

const ScheduledTasks: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<Set<number>>(new Set());
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  
  // Table pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Menu states
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTaskId, setMenuTaskId] = useState<number | null>(null);
  
  // Dialog states
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [viewTaskOpen, setViewTaskOpen] = useState(false);
  const [executionHistoryOpen, setExecutionHistoryOpen] = useState(false);
  
  // Form state
  const [taskForm, setTaskForm] = useState({
    name: '',
    description: '',
    task_type: 'message',
    trigger_type: 'cron',
    cron_expression: '0 9 * * *',
    interval_seconds: 3600,
    scheduled_time: '',
    target_channel_id: '',
    message_template: '',
    embed_config: null as any,
    timezone: 'UTC',
    max_executions: null as number | null,
    conditions: [] as any[]
  });

  const { enqueueSnackbar } = useSnackbar();

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scheduled-tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      } else {
        throw new Error('Failed to load tasks');
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      enqueueSnackbar('Failed to load scheduled tasks', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  const loadTaskExecutions = useCallback(async (taskId: number) => {
    try {
      const response = await fetch(`/api/scheduled-tasks/${taskId}/executions`);
      if (response.ok) {
        const data = await response.json();
        setExecutions(data);
      }
    } catch (error) {
      console.error('Error loading task executions:', error);
      enqueueSnackbar('Failed to load execution history', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, taskId: number) => {
    setAnchorEl(event.currentTarget);
    setMenuTaskId(taskId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuTaskId(null);
  };

  const handleCreateTask = async () => {
    try {
      const response = await fetch('/api/scheduled-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskForm)
      });

      if (response.ok) {
        enqueueSnackbar('Task created successfully', { variant: 'success' });
        setCreateTaskOpen(false);
        resetTaskForm();
        loadTasks();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      enqueueSnackbar('Failed to create task', { variant: 'error' });
    }
  };

  const handleEditTask = async () => {
    if (!selectedTask) return;

    try {
      const response = await fetch(`/api/scheduled-tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskForm)
      });

      if (response.ok) {
        enqueueSnackbar('Task updated successfully', { variant: 'success' });
        setEditTaskOpen(false);
        setSelectedTask(null);
        resetTaskForm();
        loadTasks();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      enqueueSnackbar('Failed to update task', { variant: 'error' });
    }
  };

  const handleToggleTask = async (taskId: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/scheduled-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });

      if (response.ok) {
        enqueueSnackbar(`Task ${!isActive ? 'enabled' : 'disabled'}`, { variant: 'success' });
        loadTasks();
      } else {
        throw new Error('Failed to toggle task');
      }
    } catch (error) {
      console.error('Error toggling task:', error);
      enqueueSnackbar('Failed to toggle task', { variant: 'error' });
    }
  };

  const handleExecuteTask = async (taskId: number) => {
    try {
      setExecuting(prev => new Set(prev.add(taskId)));
      
      const response = await fetch(`/api/scheduled-tasks/${taskId}/execute`, {
        method: 'POST'
      });

      if (response.ok) {
        enqueueSnackbar('Task executed successfully', { variant: 'success' });
        loadTasks();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to execute task');
      }
    } catch (error) {
      console.error('Error executing task:', error);
      enqueueSnackbar('Failed to execute task', { variant: 'error' });
    } finally {
      setExecuting(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/scheduled-tasks/${taskId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        enqueueSnackbar('Task deleted successfully', { variant: 'success' });
        loadTasks();
      } else {
        throw new Error('Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      enqueueSnackbar('Failed to delete task', { variant: 'error' });
    }
    handleMenuClose();
  };

  const handleDuplicateTask = async (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setTaskForm({
      name: `${task.name} (Copy)`,
      description: task.description || '',
      task_type: task.task_type,
      trigger_type: task.trigger_type,
      cron_expression: task.cron_expression || '0 9 * * *',
      interval_seconds: task.interval_seconds || 3600,
      scheduled_time: task.scheduled_time || '',
      target_channel_id: task.target_channel_id || '',
      message_template: task.message_template || '',
      embed_config: task.embed_config || null,
      timezone: task.timezone,
      max_executions: task.max_executions || null,
      conditions: task.conditions || []
    });
    setCreateTaskOpen(true);
    handleMenuClose();
  };

  const handleViewTask = (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setViewTaskOpen(true);
    }
    handleMenuClose();
  };

  const handleViewExecutions = (taskId: number) => {
    loadTaskExecutions(taskId);
    setExecutionHistoryOpen(true);
    handleMenuClose();
  };

  const resetTaskForm = () => {
    setTaskForm({
      name: '',
      description: '',
      task_type: 'message',
      trigger_type: 'cron',
      cron_expression: '0 9 * * *',
      interval_seconds: 3600,
      scheduled_time: '',
      target_channel_id: '',
      message_template: '',
      embed_config: null as any,
      timezone: 'UTC',
      max_executions: null as number | null,
      conditions: [] as any[]
    });
  };

  const openEditDialog = (task: ScheduledTask) => {
    setSelectedTask(task);
    setTaskForm({
      name: task.name,
      description: task.description || '',
      task_type: task.task_type,
      trigger_type: task.trigger_type,
      cron_expression: task.cron_expression || '0 9 * * *',
      interval_seconds: task.interval_seconds || 3600,
      scheduled_time: task.scheduled_time || '',
      target_channel_id: task.target_channel_id || '',
      message_template: task.message_template || '',
      embed_config: task.embed_config || null,
      timezone: task.timezone,
      max_executions: task.max_executions || null,
      conditions: task.conditions || []
    });
    setEditTaskOpen(true);
    handleMenuClose();
  };

  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'message':
      case 'announcement':
        return 'primary';
      case 'role_assignment':
        return 'secondary';
      case 'channel_action':
        return 'info';
      case 'moderation':
        return 'warning';
      case 'custom':
        return 'default';
      default:
        return 'default';
    }
  };

  const getTriggerTypeIcon = (type: string) => {
    switch (type) {
      case 'cron':
        return <ScheduleIcon />;
      case 'interval':
        return <TimelineIcon />;
      case 'once':
        return <CalendarIcon />;
      case 'event':
        return <SettingsIcon />;
      default:
        return <ScheduleIcon />;
    }
  };

  const formatNextExecution = (nextExecution?: string) => {
    if (!nextExecution) return 'Never';
    const date = new Date(nextExecution);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return 'Overdue';
    if (diff < 60000) return 'Soon';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  if (loading) {
    return (
      <Box p={3}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading scheduled tasks...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Scheduled Tasks
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateTaskOpen(true)}
        >
          Create Task
        </Button>
      </Box>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">
                {tasks.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Tasks
              </Typography>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {tasks.filter(t => t.is_active).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Tasks
              </Typography>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardContent>
              <Typography variant="h6" color="warning.main">
                {tasks.filter(t => t.error_count > 0).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tasks with Errors
              </Typography>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardContent>
              <Typography variant="h6" color="info.main">
                {tasks.reduce((sum, t) => sum + t.execution_count, 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Executions
              </Typography>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tasks Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Trigger</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Next Run</TableCell>
                <TableCell>Executions</TableCell>
                <TableCell>Errors</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((task) => (
                <TableRow key={task.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" noWrap>
                        {task.name}
                      </Typography>
                      {task.description && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {task.description}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={task.task_type.replace('_', ' ')}
                      color={getTaskTypeColor(task.task_type) as any}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      {getTriggerTypeIcon(task.trigger_type)}
                      <Typography variant="body2" ml={1}>
                        {task.trigger_type}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={task.is_active ? 'Active' : 'Inactive'}
                      color={task.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={task.next_execution ? 'inherit' : 'text.secondary'}>
                      {formatNextExecution(task.next_execution)}
                    </Typography>
                  </TableCell>
                  <TableCell>{task.execution_count}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color={task.error_count > 0 ? 'error' : 'text.secondary'}>
                      {task.error_count}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={task.is_active}
                            onChange={() => handleToggleTask(task.id, task.is_active)}
                            size="small"
                          />
                        }
                        label=""
                        sx={{ mr: 1 }}
                      />
                      
                      <Tooltip title="Execute Now">
                        <IconButton
                          onClick={() => handleExecuteTask(task.id)}
                          disabled={executing.has(task.id)}
                          size="small"
                        >
                          <PlayIcon />
                        </IconButton>
                      </Tooltip>

                      <IconButton
                        onClick={(e) => handleMenuOpen(e, task.id)}
                        size="small"
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={tasks.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuList>
          <MenuItemComponent onClick={() => handleViewTask(menuTaskId!)}>
            <ListItemIcon><ViewIcon /></ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent onClick={() => {
            const task = tasks.find(t => t.id === menuTaskId);
            if (task) openEditDialog(task);
          }}>
            <ListItemIcon><EditIcon /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent onClick={() => handleDuplicateTask(menuTaskId!)}>
            <ListItemIcon><CopyIcon /></ListItemIcon>
            <ListItemText>Duplicate</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent onClick={() => handleViewExecutions(menuTaskId!)}>
            <ListItemIcon><HistoryIcon /></ListItemIcon>
            <ListItemText>View Executions</ListItemText>
          </MenuItemComponent>
          <MenuItemComponent onClick={() => handleDeleteTask(menuTaskId!)} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon color="error" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItemComponent>
        </MenuList>
      </Menu>

      {/* Floating Action Button for Mobile */}
      <Fab
        color="primary"
        aria-label="add"
        onClick={() => setCreateTaskOpen(true)}
        sx={{ position: 'fixed', bottom: 16, right: 16, display: { xs: 'flex', sm: 'none' } }}
      >
        <AddIcon />
      </Fab>

      {/* Create/Edit Task Dialog */}
      <Dialog
        open={createTaskOpen || editTaskOpen}
        onClose={() => {
          setCreateTaskOpen(false);
          setEditTaskOpen(false);
          setSelectedTask(null);
          resetTaskForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {createTaskOpen ? 'Create Scheduled Task' : 'Edit Scheduled Task'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Task Name"
              value={taskForm.name}
              onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
              fullWidth
              required
            />
            
            <TextField
              label="Description (optional)"
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div style={{ gridColumn: 'span 1' }}>
                <TextField
                  select
                  label="Task Type"
                  value={taskForm.task_type}
                  onChange={(e) => setTaskForm({ ...taskForm, task_type: e.target.value })}
                  fullWidth
                  required
                >
                  <MenuItem value="message">Send Message</MenuItem>
                  <MenuItem value="announcement">Send Announcement</MenuItem>
                  <MenuItem value="role_assignment">Role Assignment</MenuItem>
                  <MenuItem value="channel_action">Channel Action</MenuItem>
                  <MenuItem value="moderation">Moderation Action</MenuItem>
                  <MenuItem value="custom">Custom Action</MenuItem>
                </TextField>
              </div>
              <div style={{ gridColumn: 'span 1' }}>
                <TextField
                  select
                  label="Trigger Type"
                  value={taskForm.trigger_type}
                  onChange={(e) => setTaskForm({ ...taskForm, trigger_type: e.target.value })}
                  fullWidth
                  required
                >
                  <MenuItem value="cron">Cron Schedule</MenuItem>
                  <MenuItem value="interval">Interval</MenuItem>
                  <MenuItem value="once">One Time</MenuItem>
                  <MenuItem value="event">Event Triggered</MenuItem>
                </TextField>
              </div>
            </div>

            {taskForm.trigger_type === 'cron' && (
              <TextField
                label="Cron Expression"
                value={taskForm.cron_expression}
                onChange={(e) => setTaskForm({ ...taskForm, cron_expression: e.target.value })}
                fullWidth
                helperText="e.g., '0 9 * * *' for daily at 9 AM, '0 */2 * * *' for every 2 hours"
                required
              />
            )}

            {taskForm.trigger_type === 'interval' && (
              <TextField
                label="Interval (seconds)"
                type="number"
                value={taskForm.interval_seconds}
                onChange={(e) => setTaskForm({ ...taskForm, interval_seconds: parseInt(e.target.value) })}
                fullWidth
                helperText="How often to run the task (minimum: 60 seconds)"
                inputProps={{ min: 60 }}
                required
              />
            )}

            {taskForm.trigger_type === 'once' && (
              <TextField
                label="Scheduled Time"
                type="datetime-local"
                value={taskForm.scheduled_time}
                onChange={(e) => setTaskForm({ ...taskForm, scheduled_time: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
                required
              />
            )}

            <TextField
              label="Target Channel ID"
              value={taskForm.target_channel_id}
              onChange={(e) => setTaskForm({ ...taskForm, target_channel_id: e.target.value })}
              fullWidth
              helperText="Discord channel ID where the action will be performed"
            />

            <TextField
              label="Message Template"
              value={taskForm.message_template}
              onChange={(e) => setTaskForm({ ...taskForm, message_template: e.target.value })}
              multiline
              rows={4}
              fullWidth
              helperText="Message content with placeholders like {user}, {server}, {timestamp}, etc."
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div style={{ gridColumn: 'span 1' }}>
                <TextField
                  select
                  label="Timezone"
                  value={taskForm.timezone}
                  onChange={(e) => setTaskForm({ ...taskForm, timezone: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="UTC">UTC</MenuItem>
                  <MenuItem value="America/New_York">Eastern Time</MenuItem>
                  <MenuItem value="America/Chicago">Central Time</MenuItem>
                  <MenuItem value="America/Denver">Mountain Time</MenuItem>
                  <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                  <MenuItem value="Europe/London">London</MenuItem>
                  <MenuItem value="Europe/Paris">Paris</MenuItem>
                  <MenuItem value="Asia/Tokyo">Tokyo</MenuItem>
                </TextField>
              </div>
              <div style={{ gridColumn: 'span 1' }}>
                <TextField
                  label="Max Executions (optional)"
                  type="number"
                  value={taskForm.max_executions || ''}
                  onChange={(e) => setTaskForm({ 
                    ...taskForm, 
                    max_executions: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  fullWidth
                  helperText="Task will be disabled after this many executions"
                  inputProps={{ min: 1 }}
                />
              </div>
            </div>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateTaskOpen(false);
            setEditTaskOpen(false);
            setSelectedTask(null);
            resetTaskForm();
          }}>
            Cancel
          </Button>
          <Button 
            onClick={createTaskOpen ? handleCreateTask : handleEditTask} 
            variant="contained"
            disabled={!taskForm.name.trim()}
          >
            {createTaskOpen ? 'Create Task' : 'Update Task'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Task Dialog */}
      <Dialog
        open={viewTaskOpen}
        onClose={() => {
          setViewTaskOpen(false);
          setSelectedTask(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Task Details: {selectedTask?.name}</DialogTitle>
        <DialogContent>
          {selectedTask && (
            <Box>
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Basic Information</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                    <div style={{ gridColumn: 'span 1' }}>
                      <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                      <Typography variant="body1">{selectedTask.name}</Typography>
                    </div>
                    <div style={{ gridColumn: 'span 1' }}>
                      <Typography variant="subtitle2" color="text.secondary">Type</Typography>
                      <Typography variant="body1">{selectedTask.task_type.replace('_', ' ')}</Typography>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                      <Typography variant="body1">{selectedTask.description || 'No description'}</Typography>
                    </div>
                  </div>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Schedule Configuration</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                    <div style={{ gridColumn: 'span 1' }}>
                      <Typography variant="subtitle2" color="text.secondary">Trigger Type</Typography>
                      <Typography variant="body1">{selectedTask.trigger_type}</Typography>
                    </div>
                    <div style={{ gridColumn: 'span 1' }}>
                      <Typography variant="subtitle2" color="text.secondary">Timezone</Typography>
                      <Typography variant="body1">{selectedTask.timezone}</Typography>
                    </div>
                    {selectedTask.cron_expression && (
                      <div style={{ gridColumn: 'span 1' }}>
                        <Typography variant="subtitle2" color="text.secondary">Cron Expression</Typography>
                        <Typography variant="body1" fontFamily="monospace">
                          {selectedTask.cron_expression}
                        </Typography>
                      </div>
                    )}
                    {selectedTask.interval_seconds && (
                      <div style={{ gridColumn: 'span 1' }}>
                        <Typography variant="subtitle2" color="text.secondary">Interval</Typography>
                        <Typography variant="body1">{selectedTask.interval_seconds} seconds</Typography>
                      </div>
                    )}
                    {selectedTask.scheduled_time && (
                      <div style={{ gridColumn: 'span 1' }}>
                        <Typography variant="subtitle2" color="text.secondary">Scheduled Time</Typography>
                        <Typography variant="body1">
                          {new Date(selectedTask.scheduled_time).toLocaleString()}
                        </Typography>
                      </div>
                    )}
                  </div>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Execution Statistics</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                    <div style={{ gridColumn: 'span 1' }}>
                      <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                      <Chip
                        label={selectedTask.is_active ? 'Active' : 'Inactive'}
                        color={selectedTask.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </div>
                    <div style={{ gridColumn: 'span 1' }}>
                      <Typography variant="subtitle2" color="text.secondary">Executions</Typography>
                      <Typography variant="body1">{selectedTask.execution_count}</Typography>
                    </div>
                    <div style={{ gridColumn: 'span 1' }}>
                      <Typography variant="subtitle2" color="text.secondary">Errors</Typography>
                      <Typography variant="body1" color={selectedTask.error_count > 0 ? 'error' : 'inherit'}>
                        {selectedTask.error_count}
                      </Typography>
                    </div>
                    <div style={{ gridColumn: 'span 1' }}>
                      <Typography variant="subtitle2" color="text.secondary">Max Executions</Typography>
                      <Typography variant="body1">{selectedTask.max_executions || 'Unlimited'}</Typography>
                    </div>
                    {selectedTask.last_execution && (
                      <div style={{ gridColumn: 'span 1' }}>
                        <Typography variant="subtitle2" color="text.secondary">Last Execution</Typography>
                        <Typography variant="body1">
                          {new Date(selectedTask.last_execution).toLocaleString()}
                        </Typography>
                      </div>
                    )}
                    {selectedTask.next_execution && (
                      <div style={{ gridColumn: 'span 1' }}>
                        <Typography variant="subtitle2" color="text.secondary">Next Execution</Typography>
                        <Typography variant="body1">
                          {new Date(selectedTask.next_execution).toLocaleString()}
                        </Typography>
                      </div>
                    )}
                  </div>
                </AccordionDetails>
              </Accordion>

              {selectedTask.message_template && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6">Message Template</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box
                      sx={{
                        backgroundColor: 'grey.100',
                        p: 2,
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.875rem'
                      }}
                    >
                      {selectedTask.message_template}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              {selectedTask.last_error && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6">Last Error</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Alert severity="error">
                      <Typography variant="body2" fontFamily="monospace">
                        {selectedTask.last_error}
                      </Typography>
                    </Alert>
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            if (selectedTask) openEditDialog(selectedTask);
            setViewTaskOpen(false);
          }}>
            Edit Task
          </Button>
          <Button onClick={() => {
            setViewTaskOpen(false);
            setSelectedTask(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Execution History Dialog */}
      <Dialog
        open={executionHistoryOpen}
        onClose={() => setExecutionHistoryOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Execution History</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Start Time</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Actions</TableCell>
                  <TableCell>Source</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {executions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell>
                      <Chip
                        label={execution.status}
                        color={
                          execution.status === 'completed' ? 'success' :
                          execution.status === 'failed' ? 'error' :
                          execution.status === 'running' ? 'info' : 'warning'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(execution.start_time).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {execution.execution_duration ? `${execution.execution_duration}ms` : '-'}
                    </TableCell>
                    <TableCell>
                      {execution.actions_performed?.length || 0}
                    </TableCell>
                    <TableCell>{execution.trigger_source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {executions.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
              No execution history found
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExecutionHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScheduledTasks;