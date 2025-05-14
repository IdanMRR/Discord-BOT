import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography, Box, Paper, Grid, TextField, Button, Divider,
  FormControlLabel, Switch, Alert, Snackbar, CircularProgress,
  InputAdornment, IconButton, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Image as ImageIcon,
  FormatColorFill as ColorIcon
} from '@mui/icons-material';
import axios from 'axios';

export default function WelcomeSettings() {
  const { serverId } = useParams();
  const [settings, setSettings] = useState({
    guild_id: serverId,
    welcome_enabled: false,
    welcome_channel_id: '',
    welcome_message: 'Welcome {user} to {server}!',
    welcome_image_enabled: false,
    welcome_image_background: '',
    welcome_embed_enabled: false,
    welcome_embed_color: '#5865F2'
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
      const response = await axios.get(`/api/guilds/${serverId}/welcome`);
      
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
          setChannels(channelsResponse.data);
        } else {
          // Mock channels data for development
          setChannels([
            { id: '123456789', name: 'general', type: 0 },
            { id: '987654321', name: 'welcome', type: 0 },
            { id: '456789123', name: 'logs', type: 0 }
          ]);
        }
      } catch (err) {
        console.error('Error fetching server data:', err);
        setServerName(`Server ${serverId.substring(0, 8)}...`);
      }
      
      // Use the response data or default values if not present
      setSettings({
        guild_id: serverId,
        welcome_enabled: response.data.welcome_enabled || false,
        welcome_channel_id: response.data.welcome_channel_id || '',
        welcome_message: response.data.welcome_message || 'Welcome {user} to {server}!',
        welcome_image_enabled: response.data.welcome_image_enabled || false,
        welcome_image_background: response.data.welcome_image_background || '',
        welcome_embed_enabled: response.data.welcome_embed_enabled || false,
        welcome_embed_color: response.data.welcome_embed_color || '#5865F2'
      });
    } catch (err) {
      console.error('Error fetching welcome settings:', err);
      setError('Failed to load welcome message settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSwitchChange = (event) => {
    const { name, checked } = event.target;
    setSettings(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      await axios.put(`/api/guilds/${serverId}/welcome`, settings);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving welcome settings:', err);
      setError('Failed to save welcome message settings. Please try again.');
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
        Welcome Settings: {serverName}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" paragraph>
        Configure welcome messages for new members.
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
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Welcome Messages
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.welcome_enabled}
                onChange={handleSwitchChange}
                name="welcome_enabled"
                color="primary"
              />
            }
            label={settings.welcome_enabled ? "Enabled" : "Disabled"}
          />
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="welcome-channel-label">Welcome Channel</InputLabel>
              <Select
                labelId="welcome-channel-label"
                name="welcome_channel_id"
                value={settings.welcome_channel_id}
                onChange={handleChange}
                disabled={!settings.welcome_enabled}
                label="Welcome Channel"
              >
                <MenuItem value="">
                  <em>Select a channel</em>
                </MenuItem>
                {channels.filter(c => c.type === 0).map(channel => (
                  <MenuItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Welcome Message"
              name="welcome_message"
              value={settings.welcome_message}
              onChange={handleChange}
              margin="normal"
              disabled={!settings.welcome_enabled}
              multiline
              rows={3}
              helperText={
                <span>
                  You can use the following variables: {'{user}'} for the username, {'{server}'} for the server name, 
                  {'{mention}'} to mention the user, {'{count}'} for the member count
                </span>
              }
            />
          </Grid>
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            <ImageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Welcome Image
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.welcome_image_enabled}
                onChange={handleSwitchChange}
                name="welcome_image_enabled"
                color="primary"
                disabled={!settings.welcome_enabled}
              />
            }
            label={settings.welcome_image_enabled ? "Enabled" : "Disabled"}
          />
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        {settings.welcome_enabled && settings.welcome_image_enabled && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Background Image URL (optional)"
                name="welcome_image_background"
                value={settings.welcome_image_background}
                onChange={handleChange}
                margin="normal"
                helperText="URL of the background image for welcome cards"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconButton size="small" edge="start">
                        <ImageIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        )}
        
        {!settings.welcome_enabled && (
          <Typography variant="body2" color="text.secondary">
            Enable welcome messages to configure the welcome image.
          </Typography>
        )}
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            <ColorIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Welcome Embed
        </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.welcome_embed_enabled}
                onChange={handleSwitchChange}
                name="welcome_embed_enabled"
                color="primary"
                disabled={!settings.welcome_enabled}
              />
            }
            label={settings.welcome_embed_enabled ? "Enabled" : "Disabled"}
          />
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        {settings.welcome_enabled && settings.welcome_embed_enabled && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Embed Color"
                name="welcome_embed_color"
                value={settings.welcome_embed_color}
                onChange={handleChange}
                margin="normal"
                helperText="Color for the welcome embed (hex code)"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box 
                        sx={{ 
                          width: 20, 
                          height: 20, 
                          backgroundColor: settings.welcome_embed_color,
                          borderRadius: '4px',
                          border: '1px solid #555'
                        }} 
                      />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        )}
        
        {!settings.welcome_enabled && (
          <Typography variant="body2" color="text.secondary">
            Enable welcome messages to configure the welcome embed.
        </Typography>
        )}
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />}
          onClick={fetchSettings}
          disabled={loading || saving}
        >
          Reset
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