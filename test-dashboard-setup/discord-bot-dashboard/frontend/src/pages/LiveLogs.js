import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography, Box, Paper, Grid, Divider, CircularProgress,
  Alert, FormControl, InputLabel, Select, MenuItem,
  List, ListItem, ListItemText, Chip, IconButton,
  TextField, Stack, Switch, FormControlLabel, Fade
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Delete as ClearIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import axios from 'axios';

// Log type to color mapping
const logTypeColors = {
  'info': 'info',
  'warning': 'warning',
  'error': 'error',
  'success': 'success',
  'mod': 'secondary',
  'member': 'primary',
  'message': 'default',
  'server': 'info',
  'ticket': 'primary',
  'command': 'secondary'
};

export default function LiveLogs() {
  const { serverId } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [serverName, setServerName] = useState('');
  const [logTypes] = useState([
    'info', 'warning', 'error', 'success', 'mod', 'member', 'message', 'server', 'ticket', 'command'
  ]);
  const [channels, setChannels] = useState([]);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    types: logTypes,
    search: '',
    channel: '',
    liveUpdate: true
  });
  const [filteredLogs, setFilteredLogs] = useState([]);
  const webSocketRef = useRef(null);
  const logsEndRef = useRef(null);
  
  // Auto-scroll to bottom of logs
  const scrollToBottom = useCallback(() => {
    if (logsEndRef.current && activeFilters.liveUpdate) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeFilters.liveUpdate]);

  // Generate mock logs for development
  const generateMockLogs = useCallback((count = 20) => {
    const types = Object.keys(logTypeColors);
    const events = [
      'User joined', 'User left', 'Message deleted', 'Message edited',
      'Channel created', 'Role assigned', 'Command executed', 'Ticket created',
      'Ticket closed', 'User banned', 'User kicked', 'User timed out'
    ];
    
    return Array(count).fill(0).map((_, i) => {
      const type = types[Math.floor(Math.random() * types.length)];
      const timestamp = new Date(Date.now() - Math.floor(Math.random() * 86400000));
      return {
        id: `log-${i}`,
        timestamp: timestamp.toISOString(),
        type,
        content: `${events[Math.floor(Math.random() * events.length)]}: User${Math.floor(Math.random() * 1000)}`,
        channel_id: channels.length > 0 ? channels[Math.floor(Math.random() * channels.length)].id : '123456789',
        user_id: `user-${Math.floor(Math.random() * 1000)}`
      };
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [channels]);

  const fetchServerInfo = useCallback(async () => {
    try {
      // Get server name
      const guildsResponse = await axios.get('/api/guilds');
      const server = guildsResponse.data.find(g => g.guild_id === serverId);
      if (server && server.name) {
        setServerName(server.name);
      } else {
        setServerName(`Server ${serverId.substring(0, 8)}...`);
      }
      
      // Fetch channels
      const channelsResponse = await axios.get(`/api/guilds/${serverId}/channels`);
      if (channelsResponse.data && Array.isArray(channelsResponse.data)) {
        const textChannels = channelsResponse.data.filter(c => c.type === 0);
        setChannels(textChannels);
      } else {
        // Mock channels for development
        setChannels([
          { id: '123456789', name: 'general', type: 0 },
          { id: '987654321', name: 'logs', type: 0 },
          { id: '456789123', name: 'mod-logs', type: 0 }
        ]);
      }
    } catch (err) {
      console.error('Error fetching server info:', err);
      setError('Failed to load server information');
      setServerName(`Server ${serverId.substring(0, 8)}...`);
    }
  }, [serverId]);

  const fetchInitialLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/guilds/${serverId}/logs`);
      if (response.data && Array.isArray(response.data)) {
        setLogs(response.data);
      } else {
        // Generate mock logs for development
        const mockLogs = generateMockLogs(50);
        setLogs(mockLogs);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Failed to load logs');
      // Still generate mock logs for development
      const mockLogs = generateMockLogs(50);
      setLogs(mockLogs);
    } finally {
      setLoading(false);
    }
  }, [serverId, generateMockLogs]);

  const setupWebSocketConnection = useCallback(() => {
    // In a real implementation, you would connect to your actual WebSocket server
    // For development purposes, we'll simulate incoming logs
    if (process.env.NODE_ENV === 'development') {
      // Clear any existing interval
      if (webSocketRef.current) {
        clearInterval(webSocketRef.current);
      }
      
      // Simulate real-time logs by adding a new log every few seconds
      webSocketRef.current = setInterval(() => {
        if (activeFilters.liveUpdate) {
          const newLog = generateMockLogs(1)[0];
          setLogs(prev => [newLog, ...prev].slice(0, 500)); // Limit to 500 logs
        }
      }, 5000);
      
      return () => {
        if (webSocketRef.current) {
          clearInterval(webSocketRef.current);
        }
      };
    } else {
      // Real WebSocket implementation would go here
      const ws = new WebSocket(`wss://your-api-server.com/ws/logs/${serverId}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (activeFilters.liveUpdate) {
          setLogs(prev => [data, ...prev].slice(0, 500)); // Limit to 500 logs
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
      };
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
      };
      
      webSocketRef.current = ws;
      
      return () => {
        if (webSocketRef.current) {
          webSocketRef.current.close();
        }
      };
    }
  }, [serverId, activeFilters.liveUpdate, generateMockLogs]);

  // Apply filters to logs
  const applyFilters = useCallback(() => {
    const filtered = logs.filter(log => {
      // Filter by type
      if (!activeFilters.types.includes(log.type)) {
        return false;
      }
      
      // Filter by channel
      if (activeFilters.channel && log.channel_id !== activeFilters.channel) {
        return false;
      }
      
      // Filter by search text
      if (activeFilters.search && !log.content.toLowerCase().includes(activeFilters.search.toLowerCase())) {
        return false;
      }
      
      return true;
    });
    
    setFilteredLogs(filtered);
  }, [logs, activeFilters]);

  // Initialize component
  useEffect(() => {
    fetchServerInfo();
    fetchInitialLogs();
  }, [fetchServerInfo, fetchInitialLogs]);
  
  // Setup WebSocket connection
  useEffect(() => {
    const cleanupWs = setupWebSocketConnection();
    return cleanupWs;
  }, [setupWebSocketConnection]);
  
  // Apply filters when logs or filter settings change
  useEffect(() => {
    applyFilters();
  }, [logs, applyFilters]);
  
  // Scroll to bottom when logs update
  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs, scrollToBottom]);

  // Handle filter changes
  const handleFilterChange = (type, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [type]: value
    }));
  };

  // Toggle log type filter
  const toggleLogType = (type) => {
    setActiveFilters(prev => {
      const types = [...prev.types];
      if (types.includes(type)) {
        return { ...prev, types: types.filter(t => t !== type) };
      } else {
        return { ...prev, types: [...types, type] };
      }
    });
  };

  // Clear all logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Get channel name from ID
  const getChannelName = (channelId) => {
    const channel = channels.find(c => c.id === channelId);
    return channel ? `#${channel.name}` : 'Unknown channel';
  };

  if (loading && logs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Live Logs: {serverName}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" paragraph>
        View real-time logs from your Discord server.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Logs
          </Typography>
          <Box>
            <IconButton onClick={() => setFilterExpanded(!filterExpanded)} color="primary">
              <FilterIcon />
              {filterExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
            <IconButton onClick={clearLogs} color="error">
              <ClearIcon />
            </IconButton>
            <IconButton onClick={fetchInitialLogs} color="primary">
              <RefreshIcon />
            </IconButton>
            <FormControlLabel
              control={
                <Switch
                  checked={activeFilters.liveUpdate}
                  onChange={(e) => handleFilterChange('liveUpdate', e.target.checked)}
                  color="primary"
                />
              }
              label="Live Updates"
              sx={{ ml: 1 }}
            />
          </Box>
        </Box>
        
        <Fade in={filterExpanded}>
          <Box sx={{ mb: 2, display: filterExpanded ? 'block' : 'none' }}>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Search Logs"
                  value={activeFilters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel id="channel-filter-label">Filter by Channel</InputLabel>
                  <Select
                    labelId="channel-filter-label"
                    value={activeFilters.channel}
                    onChange={(e) => handleFilterChange('channel', e.target.value)}
                    label="Filter by Channel"
                  >
                    <MenuItem value="">
                      <em>All Channels</em>
                    </MenuItem>
                    {channels.map(channel => (
                      <MenuItem key={channel.id} value={channel.id}>
                        #{channel.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" gutterBottom>
                  Log Types:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {logTypes.map(type => (
                    <Chip
                      key={type}
                      label={type}
                      color={logTypeColors[type]}
                      variant={activeFilters.types.includes(type) ? "filled" : "outlined"}
                      onClick={() => toggleLogType(type)}
                      size="small"
                      sx={{ mb: 1 }}
                    />
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Fade>
        
        <Divider sx={{ mb: 2 }} />
        
        <Box sx={{ 
          maxHeight: '600px', 
          overflowY: 'auto',
          backgroundColor: '#2b2d31',
          borderRadius: 1,
          p: 1
        }}>
          {filteredLogs.length > 0 ? (
            <List dense>
              {filteredLogs.map((log) => (
                <ListItem 
                  key={log.id} 
                  sx={{ 
                    mb: 0.5, 
                    backgroundColor: '#36393f',
                    borderRadius: 1,
                    '&:hover': {
                      backgroundColor: '#32353b',
                    }
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Chip 
                          label={log.type} 
                          color={logTypeColors[log.type]} 
                          size="small" 
                          sx={{ mr: 1 }}
                        />
                        <Typography variant="body2" component="span">
                          {log.content}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatTimestamp(log.timestamp)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getChannelName(log.channel_id)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
              <div ref={logsEndRef} />
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No logs found. Try changing your filters or wait for new logs.
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
} 