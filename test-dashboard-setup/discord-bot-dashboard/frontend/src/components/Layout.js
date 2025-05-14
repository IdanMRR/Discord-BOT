import React, { useState, useContext, useEffect } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  CircularProgress,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon,
  ConfirmationNumber as TicketIcon,
  Badge as VerificationIcon,
  Celebration as WelcomeIcon,
  BarChart as StatsIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Storage as LogsIcon
} from '@mui/icons-material';
import axios from 'axios';
import { AuthContext } from '../App';

const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth}px`,
    ...(open && {
      transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginLeft: 0,
    }),
  }),
);

const AppBarStyled = styled(AppBar, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
      width: `calc(100% - ${drawerWidth}px)`,
      marginLeft: `${drawerWidth}px`,
      transition: theme.transitions.create(['margin', 'width'], {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
    }),
  }),
);

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

export default function Layout() {
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, setUser } = useContext(AuthContext);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { serverId } = useParams();
  const [selectedServer, setSelectedServer] = useState(serverId || '');

  useEffect(() => {
    // Fetch servers the user has access to
    const fetchServers = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/guilds');
        setServers(response.data);
        
        // If no server is selected but we have servers, select the first one
        if ((!selectedServer || selectedServer === '') && response.data.length > 0) {
          const firstServer = response.data[0].guild_id;
          setSelectedServer(firstServer);
          navigate(`/servers/${firstServer}`);
        }
      } catch (error) {
        console.error('Error fetching servers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, [navigate, selectedServer]);

  useEffect(() => {
    // Update selected server when URL param changes
    if (serverId && serverId !== selectedServer) {
      setSelectedServer(serverId);
    }
  }, [serverId]);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleServerChange = (event) => {
    const newServerId = event.target.value;
    setSelectedServer(newServerId);
    navigate(`/servers/${newServerId}`);
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await axios.get('/api/auth/logout');
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
    handleClose();
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBarStyled position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{ mr: 2, ...(open && { display: 'none' }) }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Discord Bot Dashboard
          </Typography>

          {loading ? (
            <CircularProgress color="inherit" size={24} />
          ) : (
            <FormControl sx={{ minWidth: 200, mr: 2 }}>
              <InputLabel id="server-select-label" sx={{ color: 'white' }}>Server</InputLabel>
              <Select
                labelId="server-select-label"
                value={selectedServer}
                onChange={handleServerChange}
                label="Server"
                sx={{ color: 'white' }}
              >
                {servers.map((server) => (
                  <MenuItem key={server.guild_id} value={server.guild_id}>
                    {server.name || server.guild_id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
            {user?.avatar ? (
              <Avatar 
                src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} 
                alt={user.username} 
              />
            ) : (
              <Avatar alt={user?.username || 'User'}>
                {user?.username?.[0] || 'U'}
              </Avatar>
            )}
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem onClick={handleClose}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Profile" />
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBarStyled>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            <ChevronLeftIcon />
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={() => navigate('/')}>
              <ListItemIcon>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
          </ListItem>
          
          {selectedServer && (
            <>
              <Divider />
              <ListItem disablePadding>
                <ListItemButton onClick={() => navigate(`/servers/${selectedServer}`)}>
                  <ListItemIcon>
                    <SettingsIcon />
                  </ListItemIcon>
                  <ListItemText primary="Server Settings" />
                </ListItemButton>
              </ListItem>
              
              <ListItem disablePadding>
                <ListItemButton onClick={() => navigate(`/servers/${selectedServer}/tickets`)}>
                  <ListItemIcon>
                    <TicketIcon />
                  </ListItemIcon>
                  <ListItemText primary="Ticket Settings" />
                </ListItemButton>
              </ListItem>
              
              <ListItem disablePadding>
                <ListItemButton onClick={() => navigate(`/servers/${selectedServer}/tickets/stats`)}>
                  <ListItemIcon>
                    <StatsIcon />
                  </ListItemIcon>
                  <ListItemText primary="Ticket Stats" />
                </ListItemButton>
              </ListItem>
              
              <ListItem disablePadding>
                <ListItemButton onClick={() => navigate(`/servers/${selectedServer}/verification`)}>
                  <ListItemIcon>
                    <VerificationIcon />
                  </ListItemIcon>
                  <ListItemText primary="Verification" />
                </ListItemButton>
              </ListItem>
              
              <ListItem disablePadding>
                <ListItemButton onClick={() => navigate(`/servers/${selectedServer}/welcome`)}>
                  <ListItemIcon>
                    <WelcomeIcon />
                  </ListItemIcon>
                  <ListItemText primary="Welcome Messages" />
                </ListItemButton>
              </ListItem>
              
              <ListItem disablePadding>
                <ListItemButton onClick={() => navigate(`/servers/${selectedServer}/logs`)}>
                  <ListItemIcon>
                    <LogsIcon />
                  </ListItemIcon>
                  <ListItemText primary="Live Logs" />
                </ListItemButton>
              </ListItem>
            </>
          )}
        </List>
      </Drawer>
      <Main open={open}>
        <DrawerHeader />
        <Outlet />
      </Main>
    </Box>
  );
} 