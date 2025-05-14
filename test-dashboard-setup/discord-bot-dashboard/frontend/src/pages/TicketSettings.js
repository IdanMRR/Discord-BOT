import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography, Box, Paper, Grid, TextField, Button, Divider,
  FormControlLabel, Switch, Alert, Snackbar,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  DialogContentText, Chip, Stack, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import {
  Save as SaveIcon, Add as AddIcon,
  CategoryRounded as CategoryIcon, PersonAdd as StaffIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import axios from 'axios';

export default function TicketSettings() {
  const { serverId } = useParams();
  const [settings, setSettings] = useState({
    guild_id: serverId,
    ticket_category_id: '',
    ticket_logs_channel_id: '',
    ticket_panel_channel_id: '',
    ticket_panel_message_id: '',
    staff_role_ids: '',
    auto_close_enabled: false,
    auto_close_hours: 24,
    transcript_enabled: true
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [openStaffDialog, setOpenStaffDialog] = useState(false);
  const [newStaffRole, setNewStaffRole] = useState('');
  const [staffRoles, setStaffRoles] = useState([]);
  const [serverName, setServerName] = useState('');
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);

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
          const categoryChannels = channelsResponse.data.filter(c => c.type === 4);
          setChannels(textChannels);
          setCategories(categoryChannels);
        } else {
          // Mock channels data for development
          setChannels([
            { id: '123456789', name: 'general', type: 0 },
            { id: '987654321', name: 'ticket-logs', type: 0 },
            { id: '456789123', name: 'ticket-panel', type: 0 }
          ]);
          setCategories([
            { id: '111222333', name: 'TICKETS', type: 4 },
            { id: '444555666', name: 'IMPORTANT', type: 4 }
          ]);
        }
      } catch (err) {
        console.error('Error fetching server data:', err);
        setServerName(`Server ${serverId.substring(0, 8)}...`);
      }
      
      // Parse staff role IDs into array
      let staffRolesList = [];
      if (response.data.staff_role_ids) {
        staffRolesList = response.data.staff_role_ids.split(',').filter(id => id.trim() !== '');
      }
      setStaffRoles(staffRolesList);
      
      // Use the response data or default values if not present
      setSettings({
        guild_id: serverId,
        ticket_category_id: response.data.ticket_category_id || '',
        ticket_logs_channel_id: response.data.ticket_logs_channel_id || '',
        ticket_panel_channel_id: response.data.ticket_panel_channel_id || '',
        ticket_panel_message_id: response.data.ticket_panel_message_id || '',
        staff_role_ids: response.data.staff_role_ids || '',
        auto_close_enabled: !!response.data.auto_close_enabled,
        auto_close_hours: response.data.auto_close_hours || 24,
        transcript_enabled: response.data.transcript_enabled !== false
      });
    } catch (err) {
      console.error('Error fetching ticket settings:', err);
      setError('Failed to load ticket settings. Please try again.');
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

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Update staff role IDs from the array
      const updatedSettings = {
        ...settings,
        staff_role_ids: staffRoles.join(',')
      };
      
      await axios.put(`/api/guilds/${serverId}/settings`, updatedSettings);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving ticket settings:', err);
      setError('Failed to save ticket settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleAddStaffRole = () => {
    if (newStaffRole && !staffRoles.includes(newStaffRole)) {
      const updatedRoles = [...staffRoles, newStaffRole];
      setStaffRoles(updatedRoles);
      setSettings(prev => ({
        ...prev,
        staff_role_ids: updatedRoles.join(',')
      }));
    }
    setNewStaffRole('');
    setOpenStaffDialog(false);
  };
  
  const handleRemoveStaffRole = (roleId) => {
    const updatedRoles = staffRoles.filter(id => id !== roleId);
    setStaffRoles(updatedRoles);
    setSettings(prev => ({
      ...prev,
      staff_role_ids: updatedRoles.join(',')
    }));
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
        Ticket Settings: {serverName}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" paragraph>
        Configure settings for the ticket system.
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
          <CategoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Channel Configuration
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="ticket-category-label">Ticket Category</InputLabel>
              <Select
                labelId="ticket-category-label"
                name="ticket_category_id"
                value={settings.ticket_category_id}
                onChange={handleChange}
                label="Ticket Category"
              >
                <MenuItem value="">
                  <em>Select a category</em>
                </MenuItem>
                {categories.map(category => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
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
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="ticket-panel-channel-label">Ticket Panel Channel</InputLabel>
              <Select
                labelId="ticket-panel-channel-label"
                name="ticket_panel_channel_id"
                value={settings.ticket_panel_channel_id}
                onChange={handleChange}
                label="Ticket Panel Channel"
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
            <TextField
              fullWidth
              label="Ticket Panel Message ID"
              name="ticket_panel_message_id"
              value={settings.ticket_panel_message_id}
              onChange={handleChange}
              margin="normal"
              helperText="Message ID of the ticket panel (leave blank to create new)"
            />
          </Grid>
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          <StaffIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Staff Roles
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Users with these roles will have access to all tickets.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Box sx={{ mb: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />} 
            onClick={() => setOpenStaffDialog(true)}
          >
            Add Staff Role
          </Button>
        </Box>
        
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
          {staffRoles.length > 0 ? (
            staffRoles.map(roleId => (
              <Chip
                key={roleId}
                label={roleId}
                onDelete={() => handleRemoveStaffRole(roleId)}
                color="primary"
                variant="outlined"
                sx={{ mb: 1 }}
              />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No staff roles configured yet.
            </Typography>
          )}
        </Stack>
        
        <Dialog open={openStaffDialog} onClose={() => setOpenStaffDialog(false)}>
          <DialogTitle>Add Staff Role</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Enter the role ID that should have access to all tickets.
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              label="Role ID"
              fullWidth
              variant="outlined"
              value={newStaffRole}
              onChange={(e) => setNewStaffRole(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenStaffDialog(false)}>Cancel</Button>
            <Button onClick={handleAddStaffRole} color="primary">Add</Button>
          </DialogActions>
        </Dialog>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Ticket Behavior
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.transcript_enabled}
                  onChange={handleChange}
                  name="transcript_enabled"
                  color="primary"
                />
              }
              label="Enable Ticket Transcripts"
            />
            <Typography variant="body2" color="text.secondary">
              Create a transcript when a ticket is closed
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.auto_close_enabled}
                  onChange={handleChange}
                  name="auto_close_enabled"
                  color="primary"
                />
              }
              label="Enable Auto-Close for Inactive Tickets"
            />
          </Grid>
          
          {settings.auto_close_enabled && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Auto-Close After (Hours)"
                name="auto_close_hours"
                value={settings.auto_close_hours}
                onChange={handleChange}
                margin="normal"
                inputProps={{ min: 1 }}
                helperText="Automatically close tickets after this many hours of inactivity"
              />
            </Grid>
          )}
        </Grid>
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button 
          variant="outlined" 
          onClick={() => fetchSettings()}
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