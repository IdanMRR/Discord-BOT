import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Divider,
  CardActions,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  ConfirmationNumber as TicketIcon,
  Badge as VerificationIcon,
  Celebration as WelcomeIcon,
  Settings as SettingsIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import axios from 'axios';
import { AuthContext } from '../App';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalServers: 0,
    totalTickets: 0,
    activeTickets: 0,
    verifiedUsers: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch servers the user has access to
        const response = await axios.get('/api/guilds');
        setServers(response.data);
        
        // Calculate stats
        setStats({
          totalServers: response.data.length,
          totalTickets: 0, // We'll update these below
          activeTickets: 0,
          verifiedUsers: 0
        });

        // If we have servers, fetch ticket stats for each
        let totalTickets = 0;
        let activeTickets = 0;

        for (const server of response.data) {
          try {
            const ticketStats = await axios.get(`/api/guilds/${server.guild_id}/ticket-stats`);
            totalTickets += ticketStats.data.total || 0;
            
            // Count active tickets (open, in_progress, on_hold)
            const active = ticketStats.data.byStatus.reduce((acc, status) => {
              if (['open', 'in_progress', 'on_hold'].includes(status.status)) {
                return acc + status.count;
              }
              return acc;
            }, 0);
            
            activeTickets += active;
          } catch (error) {
            console.error(`Error fetching ticket stats for server ${server.guild_id}:`, error);
            // Continue with other servers
          }
        }

        setStats(prev => ({
          ...prev,
          totalTickets,
          activeTickets
        }));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const navigateToServer = (serverId) => {
    navigate(`/servers/${serverId}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" paragraph>
          Welcome back, {user?.username || 'User'}! Here's an overview of your Discord bot.
        </Typography>
      </Grid>

      {/* Stats cards */}
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, backgroundColor: '#4a154b', color: 'white' }}>
          <Typography variant="h6">Total Servers</Typography>
          <Typography variant="h3">{stats.totalServers}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, backgroundColor: '#4a76f5', color: 'white' }}>
          <Typography variant="h6">Total Tickets</Typography>
          <Typography variant="h3">{stats.totalTickets}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, backgroundColor: '#00b37e', color: 'white' }}>
          <Typography variant="h6">Active Tickets</Typography>
          <Typography variant="h3">{stats.activeTickets}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, backgroundColor: '#e94560', color: 'white' }}>
          <Typography variant="h6">Features Enabled</Typography>
          <Typography variant="h3">3</Typography>
        </Paper>
      </Grid>

      {/* Quick access */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h5" component="div" gutterBottom>
              Quick Access
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              <ListItem>
                <ListItemIcon>
                  <TicketIcon />
                </ListItemIcon>
                <ListItemText primary="Tickets" secondary="Manage support tickets and view statistics" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <VerificationIcon />
                </ListItemIcon>
                <ListItemText primary="Verification" secondary="Configure user verification settings" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <WelcomeIcon />
                </ListItemIcon>
                <ListItemText primary="Welcome Messages" secondary="Set up welcome messages for new members" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary="Server Settings" secondary="Configure general bot settings" />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>

      {/* Your servers */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h5" component="div" gutterBottom>
              Your Servers
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {servers.length === 0 ? (
              <Typography color="text.secondary">
                No servers found. Add the bot to a server to get started.
              </Typography>
            ) : (
              servers.slice(0, 5).map((server) => (
                <Card key={server.guild_id} sx={{ mb: 1, backgroundColor: '#2b2d31' }}>
                  <CardContent sx={{ py: 1 }}>
                    <Grid container alignItems="center">
                      <Grid item xs>
                        <Typography variant="subtitle1">
                          {server.name || `Server ${server.guild_id.substr(0, 8)}...`}
                        </Typography>
                      </Grid>
                      <Grid item>
                        <Button 
                          size="small" 
                          endIcon={<ArrowForwardIcon />}
                          onClick={() => navigateToServer(server.guild_id)}
                        >
                          Manage
                        </Button>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
          {servers.length > 5 && (
            <CardActions>
              <Button size="small">View all servers</Button>
            </CardActions>
          )}
        </Card>
      </Grid>
    </Grid>
  );
} 