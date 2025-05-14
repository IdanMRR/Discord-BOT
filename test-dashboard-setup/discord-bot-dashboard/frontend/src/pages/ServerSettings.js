import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography, Box, Paper, Grid, TextField, Button, Divider,
  Alert, Snackbar, CircularProgress, MenuItem, InputAdornment, IconButton,
  FormControl, InputLabel, Select
} from '@mui/material';
import { Save as SaveIcon, Refresh as RefreshIcon, Info as InfoIcon } from '@mui/icons-material';
import axios from 'axios';

export default function ServerSettings() {
  const { serverId } = useParams();
  const [settings, setSettings] = useState({
    guild_id: serverId,
    name: '',
    log_channel_id: '',
    mod_log_channel_id: '',
    member_log_channel_id: '',
    message_log_channel_id: '',
    server_log_channel_id: '',
    ticket_logs_channel_id: '',
    rules_channel_id: '',
    language: 'en'
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [serverName, setServerName] = useState('');
  const [channels, setChannels] = useState([]);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/guilds/${serverId}/settings`);
      
      // Get server name from the guilds endpoint
      try {
        const guildsResponse = await axios.get('/api/guilds');
        const server = guildsResponse.data.find(g => g.guild_id === serverId);
        if (server && server.name) {
          setServerName(server.name);
        } else {
          setServerName(`Server ${serverId.substring(0, 8)}...`);
        }
        
        // Fetch channels for this server
        const channelsResponse = await axios.get(`/api/guilds/${serverId}/channels`);
        if (channelsResponse.data && Array.isArray(channelsResponse.data)) {
          const textChannels = channelsResponse.data.filter(c => c.type === 0);
          setChannels(textChannels);
        } else {
          // Mock channels data for development
          setChannels([
            { id: '123456789', name: 'general', type: 0 },
            { id: '987654321', name: 'logs', type: 0 },
            { id: '456789123', name: 'mod-logs', type: 0 },
            { id: '111222333', name: 'member-logs', type: 0 },
            { id: '444555666', name: 'message-logs', type: 0 },
            { id: '777888999', name: 'server-logs', type: 0 },
            { id: '123123123', name: 'ticket-logs', type: 0 },
            { id: '456456456', name: 'rules', type: 0 }
          ]);
        }
      } catch (err) {
        console.error('Error fetching server data:', err);
        setServerName(`Server ${serverId.substring(0, 8)}...`);
      }
      
      // Use the response data or default values if not present
      setSettings({
        guild_id: serverId,
        name: response.data.name || '',
        log_channel_id: response.data.log_channel_id || '',
        mod_log_channel_id: response.data.mod_log_channel_id || '',
        member_log_channel_id: response.data.member_log_channel_id || '',
        message_log_channel_id: response.data.message_log_channel_id || '',
        server_log_channel_id: response.data.server_log_channel_id || '',
        ticket_logs_channel_id: response.data.ticket_logs_channel_id || '',
        rules_channel_id: response.data.rules_channel_id || '',
        language: response.data.language || 'en'
      });
    } catch (err) {
      console.error('Error fetching server settings:', err);
      setError('Failed to load server settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      await axios.put(`/api/guilds/${serverId}/settings`, settings);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving server settings:', err);
      setError('Failed to save server settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Server Settings: {serverName}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" paragraph>
        Configure general settings for your Discord server.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        message="Settings saved successfully!"
      />
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          General Settings
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Server Name"
              name="name"
              value={settings.name || serverName}
              onChange={handleChange}
              margin="normal"
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <IconButton size="small" edge="start">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              helperText="Server name (read-only)"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Language"
              name="language"
              value={settings.language}
              onChange={handleChange}
              margin="normal"
              helperText="Select the bot's language for this server"
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="es">Español</MenuItem>
              <MenuItem value="fr">Français</MenuItem>
              <MenuItem value="de">Deutsch</MenuItem>
            </TextField>
          </Grid>
          
          <Grid item xs={12}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="rules-channel-label">Rules Channel</InputLabel>
              <Select
                labelId="rules-channel-label"
                name="rules_channel_id"
                value={settings.rules_channel_id}
                onChange={handleChange}
                label="Rules Channel"
              >
                <MenuItem value="">
                  <em>Select a channel</em>
                </MenuItem>
                {channels.map(channel => (
                  <MenuItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Log Channels
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Configure where different types of logs should be sent. Select a channel for each log type.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="general-logs-channel-label">General Logs Channel</InputLabel>
              <Select
                labelId="general-logs-channel-label"
                name="log_channel_id"
                value={settings.log_channel_id}
                onChange={handleChange}
                label="General Logs Channel"
              >
                <MenuItem value="">
                  <em>Select a channel</em>
                </MenuItem>
                {channels.map(channel => (
                  <MenuItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="mod-logs-channel-label">Moderation Logs Channel</InputLabel>
              <Select
                labelId="mod-logs-channel-label"
                name="mod_log_channel_id"
                value={settings.mod_log_channel_id}
                onChange={handleChange}
                label="Moderation Logs Channel"
              >
                <MenuItem value="">
                  <em>Select a channel</em>
                </MenuItem>
                {channels.map(channel => (
                  <MenuItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="member-logs-channel-label">Member Logs Channel</InputLabel>
              <Select
                labelId="member-logs-channel-label"
                name="member_log_channel_id"
                value={settings.member_log_channel_id}
                onChange={handleChange}
                label="Member Logs Channel"
              >
                <MenuItem value="">
                  <em>Select a channel</em>
                </MenuItem>
                {channels.map(channel => (
                  <MenuItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="message-logs-channel-label">Message Logs Channel</InputLabel>
              <Select
                labelId="message-logs-channel-label"
                name="message_log_channel_id"
                value={settings.message_log_channel_id}
                onChange={handleChange}
                label="Message Logs Channel"
              >
                <MenuItem value="">
                  <em>Select a channel</em>
                </MenuItem>
                {channels.map(channel => (
                  <MenuItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="server-logs-channel-label">Server Logs Channel</InputLabel>
              <Select
                labelId="server-logs-channel-label"
                name="server_log_channel_id"
                value={settings.server_log_channel_id}
                onChange={handleChange}
                label="Server Logs Channel"
              >
                <MenuItem value="">
                  <em>Select a channel</em>
                </MenuItem>
                {channels.map(channel => (
                  <MenuItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="ticket-logs-channel-label">Ticket Logs Channel</InputLabel>
              <Select
                labelId="ticket-logs-channel-label"
                name="ticket_logs_channel_id"
                value={settings.ticket_logs_channel_id}
                onChange={handleChange}
                label="Ticket Logs Channel"
              >
                <MenuItem value="">
                  <em>Select a channel</em>
                </MenuItem>
                {channels.map(channel => (
                  <MenuItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />}
          onClick={fetchSettings}
          disabled={loading || saving}
        >
          Refresh
        </Button>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={loading || saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
} 