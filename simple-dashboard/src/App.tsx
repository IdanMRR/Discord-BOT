import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import DatabaseService from './DatabaseService';
import CorsTest from './CorsTest';

// Note: DatabaseService is imported as a module and is stable across renders
// It's not included in useEffect dependency arrays as it doesn't change

// Define types for our data
interface Server {
  guild_id: string;
  guild_name: string;
  prefix?: string;
  welcome_channel_id?: string;
  logs_channel_id?: string;
  mod_logs_channel_id?: string;
  ticket_category_id?: string;
  ticket_logs_channel_id?: string;
  welcome_channel_name?: string;
  logs_channel_name?: string;
  mod_logs_channel_name?: string;
  ticket_category_name?: string;
  ticket_logs_channel_name?: string;
  memberCount?: number;
  onlineCount?: number;
  icon?: string;
  banner?: string;
  description?: string;
  createdAt?: string;
  stats?: {
    tickets: number;
    warnings: number;
    commands: number;
    recentActivity?: any[];
  };
  recentData?: {
    tickets: any[];
    warnings: any[];
    commands: any[];
  };
}

interface Warning {
  id: number;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  reason: string;
  timestamp: number;
  active: number;
  user_name?: string;
  moderator_name?: string;
}

interface Ticket {
  id: number;
  guild_id: string;
  channel_id: string;
  user_id: string;
  status: string;
  ticket_number: number;
  subject?: string;
  category?: string;
  priority?: string;
  created_at: number;
  closed_at?: number;
  user_name?: string;
  channel_name?: string;
  ticket_description?: string;
}

// Create main styled components
const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family: 'Arial', sans-serif;
  background-color: #2c2f33;
  color: #ffffff;
`;

const Header = styled.header`
  background-color: #5865F2;
  color: white;
  padding: 1rem;
  text-align: center;
`;

const Navigation = styled.nav`
  background-color: #23272A;
  padding: 1rem;
  display: flex;
  justify-content: center;
  gap: 2rem;
`;

const NavLink = styled(Link)`
  color: #ffffff;
  text-decoration: none;
  font-weight: bold;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #5865F2;
  }
`;

const MainContent = styled.main`
  flex: 1;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Card = styled.div`
  background-color: #36393f;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  padding: 2rem;
  margin: 1rem 0;
  width: 100%;
  max-width: 800px;
`;

const Footer = styled.footer`
  background-color: #23272A;
  color: white;
  padding: 1rem;
  text-align: center;
`;

const Button = styled.button`
  background-color: #5865F2;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;

  &:hover {
    background-color: #4752C4;
  }
`;

const ServerCard = styled.div`
  background-color: #36393f;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  }
`;

// Add a loading indicator
const LoadingSpinner = styled.div`
  display: inline-block;
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255,255,255,.3);
  border-radius: 50%;
  border-top-color: #5865F2;
  animation: spin 1s ease-in-out infinite;
  margin: 2rem auto;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  width: 100%;
  text-align: center;
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  width: 100%;
  text-align: center;
  gap: 1rem;
`;

const ErrorMessage = styled.div`
  color: #ED4245;
  font-size: 1.2rem;
  margin-bottom: 1rem;
`;

// Helper function to format date safely
const formatDate = (timestamp: any) => {
  if (!timestamp) return 'Unknown';
  
  try {
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toLocaleString();
    } else if (typeof timestamp === 'string') {
      // Handle ISO string or custom date format
      return new Date(timestamp.replace(' ', 'T')).toLocaleString();
    }
    
    return timestamp.toString();
  } catch (error) {
    console.warn('Error formatting date:', error);
    return timestamp.toString();
  }
};

// Home page
const HomePage = () => {
  return (
    <MainContent>
      <Card>
        <h2>Welcome to Your Discord Bot Dashboard</h2>
        <p>This simplified dashboard allows you to manage your Discord bot settings directly.</p>
        <p>Choose an option from the navigation menu above to get started.</p>
      </Card>
    </MainContent>
  );
};

// Servers page
const ServersPage = () => {
  const navigate = useNavigate();
  const [servers, setServers] = useState<Server[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchServers = async () => {
      try {
        console.log('Fetching servers...');
        setLoading(true);
        const response = await DatabaseService.ServerSettings.getAll();
        console.log('Server response:', response);
        
        if (Array.isArray(response)) {
          // Handle the old format (just an array of servers)
          console.log('Array response format detected');
          setServers(response as Server[]);
        } else if (response && response.servers) {
          // Handle the new format (object with servers and stats)
          console.log('Object response format detected with servers and stats');
          setServers(response.servers as Server[]);
          setStats(response.stats);
        } else if (response) {
          // Fallback to any non-null response
          console.log('Unknown response format, using as is');
          setServers([response] as Server[]);
        } else {
          // Fallback to empty array if response format is unexpected
          console.log('Empty or null response');
          setServers([]);
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching servers:", err);
        setError("Failed to load servers. Please try again later.");
        setLoading(false);
      }
    };
    
    fetchServers();
    
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.log("Loading timeout triggered");
        setLoading(false);
        setError("Loading timed out. Please try again.");
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeout);
  }, [loading]);
  
  // Function to handle manage server button click
  const handleManageServer = (guildId: string) => {
    console.log(`Navigating to manage server with ID: ${guildId}`);
    navigate(`/servers/${guildId}/manage`);
  };
  
  if (loading) {
    return (
      <MainContent>
        <Card>
          <h2>Server Management</h2>
          <LoadingSpinner />
          <div>Loading server data...</div>
        </Card>
      </MainContent>
    );
  }
  
  if (error) {
    return (
      <MainContent>
        <Card>
          <h2>Server Management</h2>
          <ErrorMessage>{error}</ErrorMessage>
          <Button onClick={() => navigate('/servers')}>Back to Servers</Button>
        </Card>
      </MainContent>
    );
  }
  
  return (
    <MainContent>
      <Card>
        <h2>Server Management</h2>
        <p>View and manage your Discord servers below.</p>
        
        {stats && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-around', 
            margin: '1rem 0', 
            padding: '1rem',
            backgroundColor: '#36393f',
            borderRadius: '8px'
          }}>
            <div key="stat-servers" style={{ textAlign: 'center' }}>
              <h3>{stats.serverCount || servers.length}</h3>
              <p>Servers</p>
            </div>
            <div key="stat-tickets" style={{ textAlign: 'center' }}>
              <h3>{stats.activeTickets || 0}</h3>
              <p>Active Tickets</p>
            </div>
            <div key="stat-warnings" style={{ textAlign: 'center' }}>
              <h3>{stats.activeWarnings || 0}</h3>
              <p>Warnings</p>
            </div>
            <div key="stat-commands" style={{ textAlign: 'center' }}>
              <h3>{stats.commandsUsed || 0}</h3>
              <p>Commands Used</p>
            </div>
          </div>
        )}
        
        {servers.length === 0 ? (
          <p>No servers found. Please add a server to get started.</p>
        ) : (
          <div>
            {servers.map(server => (
              <ServerCard key={server.guild_id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3>{server.guild_name}</h3>
                    <p>Server ID: {server.guild_id}</p>
                    
                    {server.welcome_channel_name && (
                      <p><strong>Welcome Channel:</strong> {server.welcome_channel_name}</p>
                    )}
                    
                    {server.logs_channel_name && (
                      <p><strong>Logs Channel:</strong> {server.logs_channel_name}</p>
                    )}
                    
                    {server.mod_logs_channel_name && (
                      <p><strong>Mod Logs Channel:</strong> {server.mod_logs_channel_name}</p>
                    )}
                  </div>
                  
                  {server.stats && (
                    <div style={{ 
                      backgroundColor: '#2f3136', 
                      padding: '0.5rem', 
                      borderRadius: '4px',
                      minWidth: '150px'
                    }}>
                      <p><strong>Members:</strong> {server.memberCount || 0}</p>
                      <p><strong>Tickets:</strong> {server.stats.tickets || 0}</p>
                      <p><strong>Warnings:</strong> {server.stats.warnings || 0}</p>
                      <p><strong>Commands:</strong> {server.stats.commands || 0}</p>
                    </div>
                  )}
                </div>
                
                <div style={{ marginTop: '1rem' }}>
                  <Button onClick={() => handleManageServer(server.guild_id)}>Manage Settings</Button>
                </div>
              </ServerCard>
            ))}
          </div>
        )}
      </Card>
    </MainContent>
  );
};

// Warnings page
const WarningsPage = () => {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'username'>('newest');
  
  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true);
        const serverList = await DatabaseService.ServerSettings.getAll() as Server[];
        setServers(serverList);
        
        if (serverList.length > 0 && !selectedServer) {
          setSelectedServer(serverList[0].guild_id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching servers:", err);
        setError("Failed to load servers. Please try again later.");
        setLoading(false);
      }
    };
    
    fetchServers();
  }, [selectedServer]);
  
  useEffect(() => {
    const fetchWarnings = async () => {
      if (selectedServer) {
        try {
          setLoading(true);
          const warningsList = await DatabaseService.Warnings.getAll(selectedServer) as Warning[];
          
          // Sort the warnings based on the selected sort order
          let sortedWarnings = [...warningsList];
          
          if (sortOrder === 'newest') {
            sortedWarnings.sort((a, b) => {
              const aDate = new Date(a.timestamp).getTime();
              const bDate = new Date(b.timestamp).getTime();
              return bDate - aDate;
            });
          } else if (sortOrder === 'oldest') {
            sortedWarnings.sort((a, b) => {
              const aDate = new Date(a.timestamp).getTime();
              const bDate = new Date(b.timestamp).getTime();
              return aDate - bDate;
            });
          } else if (sortOrder === 'username') {
            sortedWarnings.sort((a, b) => {
              const aName = (a.user_name || a.user_id).toLowerCase();
              const bName = (b.user_name || b.user_id).toLowerCase();
              return aName.localeCompare(bName);
            });
          }
          
          setWarnings(sortedWarnings);
          setLoading(false);
        } catch (err) {
          console.error("Error fetching warnings:", err);
          setError("Failed to load warnings. Please try again later.");
          setLoading(false);
        }
      }
    };
    
    if (selectedServer) {
      fetchWarnings();
    }
  }, [selectedServer, sortOrder]);
  
  const handleRemoveWarning = async (warningId: number) => {
    if (!selectedServer) {
      alert("No server selected");
      return;
    }
    
    try {
      // Pass the selectedServer (guild ID) to the remove function
      await DatabaseService.Warnings.remove(warningId, selectedServer);
      
      // Update the warnings list after removing
      const warningsList = await DatabaseService.Warnings.getAll(selectedServer) as Warning[];
      
      // Apply the same sorting as in the fetchWarnings effect
      let sortedWarnings = [...warningsList];
      
      if (sortOrder === 'newest') {
        sortedWarnings.sort((a, b) => {
          const aDate = new Date(a.timestamp).getTime();
          const bDate = new Date(b.timestamp).getTime();
          return bDate - aDate;
        });
      } else if (sortOrder === 'oldest') {
        sortedWarnings.sort((a, b) => {
          const aDate = new Date(a.timestamp).getTime();
          const bDate = new Date(b.timestamp).getTime();
          return aDate - bDate;
        });
      } else if (sortOrder === 'username') {
        sortedWarnings.sort((a, b) => {
          const aName = (a.user_name || a.user_id).toLowerCase();
          const bName = (b.user_name || b.user_id).toLowerCase();
          return aName.localeCompare(bName);
        });
      }
      
      setWarnings(sortedWarnings);
    } catch (err) {
      console.error("Error removing warning:", err);
      alert("Failed to remove warning. Please try again.");
    }
  };
  
  if (loading && servers.length === 0) {
    return (
      <MainContent>
        <Card>
          <h2>User Warnings</h2>
          <LoadingSpinner />
        </Card>
      </MainContent>
    );
  }
  
  if (error && servers.length === 0) {
    return (
      <MainContent>
        <Card>
          <h2>User Warnings</h2>
          <p style={{ color: '#ED4245' }}>{error}</p>
        </Card>
      </MainContent>
    );
  }
  
  return (
    <MainContent>
      <Card>
        <h2>User Warnings</h2>
        <p>Manage user warnings for your Discord servers.</p>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ marginRight: '0.5rem' }}>
              Select Server:
              <select 
                value={selectedServer || ''}
                onChange={(e) => setSelectedServer(e.target.value)}
                style={{ marginLeft: '0.5rem', padding: '0.5rem', borderRadius: '4px', backgroundColor: '#4f545c', color: 'white', border: 'none' }}
              >
                {servers.map(server => (
                  <option key={server.guild_id} value={server.guild_id}>
                    {server.guild_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          
          <div>
            <label style={{ marginRight: '0.5rem' }}>
              Sort By:
              <select 
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest' | 'username')}
                style={{ marginLeft: '0.5rem', padding: '0.5rem', borderRadius: '4px', backgroundColor: '#4f545c', color: 'white', border: 'none' }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="username">Username</option>
              </select>
            </label>
          </div>
        </div>
        
        {loading ? (
          <LoadingSpinner />
        ) : warnings.length === 0 ? (
          <p>No warnings found for this server.</p>
        ) : (
          <div>
            {warnings.map(warning => (
              <div key={warning.id} style={{ margin: '1rem 0', padding: '1rem', backgroundColor: '#2f3136', borderRadius: '4px' }}>
                <p><strong>User:</strong> {warning.user_name || warning.user_id}</p>
                <p><strong>Reason:</strong> {warning.reason}</p>
                <p><strong>Issued by:</strong> {warning.moderator_name || warning.moderator_id}</p>
                <p><strong>Date:</strong> {formatDate(warning.timestamp)}</p>
                <p><strong>Status:</strong> {warning.active ? 'Active' : 'Removed'}</p>
                
                {warning.active === 1 && (
                  <Button onClick={() => handleRemoveWarning(warning.id)}>
                    Remove Warning
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </MainContent>
  );
};

// Tickets page
const TicketsPage = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [reopenModalOpen, setReopenModalOpen] = useState<boolean>(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  
  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true);
        const serverList = await DatabaseService.ServerSettings.getAll() as Server[];
        setServers(serverList);
        
        if (serverList.length > 0 && !selectedServer) {
          setSelectedServer(serverList[0].guild_id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching servers:", err);
        setError("Failed to load servers. Please try again later.");
        setLoading(false);
      }
    };
    
    fetchServers();
  }, [selectedServer]);
  
  useEffect(() => {
    const fetchTickets = async () => {
      if (selectedServer) {
        try {
          setLoading(true);
          const ticketsList = await DatabaseService.Tickets.getAll(selectedServer) as Ticket[];
          setTickets(ticketsList);
          setLoading(false);
        } catch (err) {
          console.error("Error fetching tickets:", err);
          setError("Failed to load tickets. Please try again later.");
          setLoading(false);
        }
      }
    };
    
    if (selectedServer) {
      fetchTickets();
    }
  }, [selectedServer]);
  
  const handleCloseTicket = async (ticketId: number) => {
    try {
      setLoading(true);
      const success = await DatabaseService.Tickets.closeTicket(ticketId, selectedServer || undefined);
      
      if (success) {
        // Update the tickets list after closing
        if (selectedServer) {
          const ticketsList = await DatabaseService.Tickets.getAll(selectedServer) as Ticket[];
          setTickets(ticketsList);
        }
        setLoading(false);
      } else {
        setError("Failed to close ticket. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Error closing ticket:", err);
      setError("Failed to close ticket. Please try again.");
      setLoading(false);
    }
  };
  
  const openReopenModal = (ticketId: number) => {
    setSelectedTicketId(ticketId);
    setReopenReason('');
    setReopenModalOpen(true);
  };
  
  const handleReopenTicket = async () => {
    if (!selectedTicketId) return;
    
    try {
      setLoading(true);
      const success = await DatabaseService.Tickets.reopenTicket(selectedTicketId, reopenReason, selectedServer || undefined);
      
      if (success) {
        // Update the tickets list after reopening
        if (selectedServer) {
          const ticketsList = await DatabaseService.Tickets.getAll(selectedServer) as Ticket[];
          setTickets(ticketsList);
        }
        setReopenModalOpen(false);
        setLoading(false);
      } else {
        setError("Failed to reopen ticket. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Error reopening ticket:", err);
      setError("Failed to reopen ticket. Please try again.");
      setLoading(false);
    }
  };
  
  if (loading && servers.length === 0) {
    return (
      <MainContent>
        <Card>
          <h2>Ticket System</h2>
          <LoadingSpinner />
        </Card>
      </MainContent>
    );
  }
  
  if (error && servers.length === 0) {
    return (
      <MainContent>
        <Card>
          <h2>Ticket System</h2>
          <p style={{ color: '#ED4245' }}>{error}</p>
        </Card>
      </MainContent>
    );
  }
  
  // Reopen Modal Component
  const ReopenModal = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}
    onClick={(e) => {
      // Only close if clicking the backdrop, not the modal content
      if (e.target === e.currentTarget) {
        setReopenModalOpen(false);
      }
    }}>
      <div style={{
        backgroundColor: '#36393F',
        padding: '2rem',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '500px'
      }}
      onClick={(e) => e.stopPropagation()}>
        <h3>Reopen Ticket</h3>
        <p>Please provide a reason for reopening this ticket:</p>
        
        <textarea
          value={reopenReason}
          onChange={(e) => setReopenReason(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '4px',
            backgroundColor: '#40444B',
            color: 'white',
            border: 'none',
            minHeight: '100px',
            resize: 'vertical',
            marginBottom: '1rem'
          }}
          placeholder="Enter reason for reopening the ticket..."
          autoFocus
        />
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button 
            onClick={(e) => {
              e.stopPropagation();
              setReopenModalOpen(false);
            }}
            style={{ backgroundColor: '#4F545C' }}
          >
            Cancel
          </Button>
          <Button onClick={(e) => {
            e.stopPropagation();
            handleReopenTicket();
          }}>
            Reopen Ticket
          </Button>
        </div>
      </div>
    </div>
  );
  
  return (
    <MainContent>
      <Card>
        <h2>Ticket System</h2>
        <p>Manage support tickets for your Discord servers.</p>
        
        <div>
          <label>
            Select Server:
            <select 
              value={selectedServer || ''}
              onChange={(e) => setSelectedServer(e.target.value)}
            >
              {servers.map(server => (
                <option key={server.guild_id} value={server.guild_id}>
                  {server.guild_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        
        {loading ? (
          <LoadingSpinner />
        ) : tickets.length === 0 ? (
          <p>No tickets found for this server.</p>
        ) : (
          <div>
            {tickets.map(ticket => (
              <div key={ticket.id} style={{ margin: '1rem 0', padding: '1rem', backgroundColor: '#2f3136', borderRadius: '4px' }}>
                <h3>Ticket #{ticket.ticket_number} {ticket.category ? `(${ticket.category})` : ''}</h3>
                <p><strong>Description:</strong> {ticket.ticket_description || ticket.subject || 'Support Ticket'}</p>
                <p><strong>User:</strong> {ticket.user_name || ticket.user_id}</p>
                <p><strong>Status:</strong> <span style={{ 
                  color: ticket.status === 'open' ? '#43B581' : '#ED4245'
                }}>{ticket.status}</span></p>
                <p><strong>Created:</strong> {formatDate(ticket.created_at)}</p>
                {ticket.closed_at && (
                  <p><strong>Closed:</strong> {formatDate(ticket.closed_at)}</p>
                )}
                {ticket.priority && (
                  <p><strong>Priority:</strong> {ticket.priority}</p>
                )}
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  {ticket.status === 'open' && (
                    <Button onClick={() => handleCloseTicket(ticket.id)} style={{ backgroundColor: '#ED4245' }}>
                      Close Ticket
                    </Button>
                  )}
                  
                  {ticket.status === 'closed' && (
                    <Button onClick={() => openReopenModal(ticket.id)} style={{ backgroundColor: '#43B581' }}>
                      Reopen Ticket
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {reopenModalOpen && <ReopenModal />}
        
        {error && <p style={{ color: '#ED4245', marginTop: '1rem' }}>{error}</p>}
      </Card>
    </MainContent>
  );
};

// Add the ServerManagePage component
const ServerManagePage = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [textChannels, setTextChannels] = useState<{id: string, name: string, type?: string}[]>([]);
  const [categories, setCategories] = useState<{id: string, name: string, type?: string}[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [formData, setFormData] = useState({
    welcome_channel_id: '',
    logs_channel_id: '',
    mod_logs_channel_id: '',
    ticket_category_id: '',
    ticket_logs_channel_id: ''
  });
  
  useEffect(() => {
    const fetchServer = async () => {
      if (!guildId || guildId === 'undefined') {
        setError("No server ID provided");
        setLoading(false);
        navigate('/servers'); // Redirect to servers list if guildId is undefined
        return;
      }
      
      try {
        setLoading(true);
        const serverData = await DatabaseService.ServerSettings.get(guildId) as Server;
        
        if (!serverData) {
          setError("Server data not found");
          setLoading(false);
          return;
        }
        
        setServer(serverData);
        
        // Save stats if available
        if (serverData.stats) {
          setStats(serverData.stats);
        }
        
        // Initialize form data with safe defaults
        setFormData({
          welcome_channel_id: serverData.welcome_channel_id || '',
          logs_channel_id: serverData.logs_channel_id || '',
          mod_logs_channel_id: serverData.mod_logs_channel_id || '',
          ticket_category_id: serverData.ticket_category_id || '',
          ticket_logs_channel_id: serverData.ticket_logs_channel_id || ''
        });
        
        // Fetch text channels from the API
        try {
          // Add a default 'None' option first
          setTextChannels([{ id: '', name: 'None' }]);
          
          const response = await fetch(`http://localhost:3001/api/servers/${guildId}/channels?type=text`, {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'f8e7d6c5b4a3928170615243cba98765'
            }
          });
          
          if (response.ok) {
            const textChannelData = await response.json();
            // Add the fetched channels after the 'None' option
            setTextChannels([{ id: '', name: 'None' }, ...textChannelData]);
          } else {
            console.error('Failed to fetch text channels');
          }
        } catch (channelError) {
          console.error('Error fetching text channels:', channelError);
        }
        
        // Fetch categories from the API
        try {
          // Add a default 'None' option first
          setCategories([{ id: '', name: 'None' }]);
          
          const categoryResponse = await fetch(`http://localhost:3001/api/servers/${guildId}/channels?type=category`, {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'f8e7d6c5b4a3928170615243cba98765'
            }
          });
          
          if (categoryResponse.ok) {
            const categoryData = await categoryResponse.json();
            // Add the fetched categories after the 'None' option
            setCategories([{ id: '', name: 'None' }, ...categoryData]);
          } else {
            console.error('Failed to fetch categories');
          }
        } catch (categoryError) {
          console.error('Error fetching categories:', categoryError);
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching server:", err);
        setError("Failed to load server data. Please try again later.");
        setLoading(false);
      }
    };
    
    fetchServer();
  }, [guildId, navigate]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!guildId || !server) return;
    
    try {
      await DatabaseService.ServerSettings.update(guildId, formData);
      alert('Server settings updated successfully!');
      navigate('/servers');
    } catch (err) {
      console.error("Error updating server:", err);
      alert("Failed to update server settings. Please try again.");
    }
  };
  
  if (loading) {
    return (
      <MainContent>
        <Card>
          <h2>Manage Server</h2>
          <LoadingSpinner />
        </Card>
      </MainContent>
    );
  }
  
  if (error || !server) {
    return (
      <MainContent>
        <Card>
          <h2>Manage Server</h2>
          <p style={{ color: '#ED4245' }}>{error || 'Server not found'}</p>
          <Link to="/servers">
            <Button>Back to Servers</Button>
          </Link>
        </Card>
      </MainContent>
    );
  }
  
  return (
    <MainContent>
      <Card>
        <h2>Manage Server: {server.guild_name}</h2>
        
        {stats && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-around', 
            margin: '1rem 0', 
            padding: '1rem',
            backgroundColor: '#36393f',
            borderRadius: '8px'
          }}>
            <div key="stat-members" style={{ textAlign: 'center' }}>
              <h3>{server.memberCount || 0}</h3>
              <p>Members</p>
            </div>
            <div key="stat-tickets" style={{ textAlign: 'center' }}>
              <h3>{stats.tickets || 0}</h3>
              <p>Tickets</p>
            </div>
            <div key="stat-warnings" style={{ textAlign: 'center' }}>
              <h3>{stats.warnings || 0}</h3>
              <p>Warnings</p>
            </div>
            <div key="stat-commands" style={{ textAlign: 'center' }}>
              <h3>{stats.commands || 0}</h3>
              <p>Commands</p>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label>
              Welcome Channel:
              <select 
                name="welcome_channel_id" 
                value={formData.welcome_channel_id} 
                onChange={handleInputChange}
                style={{ marginLeft: '0.5rem', padding: '0.5rem', borderRadius: '4px', backgroundColor: '#4f545c', color: 'white', border: 'none' }}
              >
                {textChannels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <label>
              Logs Channel:
              <select 
                name="logs_channel_id" 
                value={formData.logs_channel_id} 
                onChange={handleInputChange}
                style={{ marginLeft: '0.5rem', padding: '0.5rem', borderRadius: '4px', backgroundColor: '#4f545c', color: 'white', border: 'none' }}
              >
                {textChannels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <label>
              Mod Logs Channel:
              <select 
                name="mod_logs_channel_id" 
                value={formData.mod_logs_channel_id} 
                onChange={handleInputChange}
                style={{ marginLeft: '0.5rem', padding: '0.5rem', borderRadius: '4px', backgroundColor: '#4f545c', color: 'white', border: 'none' }}
              >
                {textChannels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <label>
              Ticket Category:
              <select 
                name="ticket_category_id" 
                value={formData.ticket_category_id} 
                onChange={handleInputChange}
                style={{ marginLeft: '0.5rem', padding: '0.5rem', borderRadius: '4px', backgroundColor: '#4f545c', color: 'white', border: 'none' }}
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <label>
              Ticket Logs Channel:
              <select 
                name="ticket_logs_channel_id" 
                value={formData.ticket_logs_channel_id} 
                onChange={handleInputChange}
                style={{ marginLeft: '0.5rem', padding: '0.5rem', borderRadius: '4px', backgroundColor: '#4f545c', color: 'white', border: 'none' }}
              >
                {textChannels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Button type="submit">Save Changes</Button>
            <Link to="/servers">
              <Button type="button" style={{ backgroundColor: '#4f545c' }}>Cancel</Button>
            </Link>
          </div>
        </form>
      </Card>
    </MainContent>
  );
};

// Add the LogsPage component
const LogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true);
        const serverList = await DatabaseService.ServerSettings.getAll() as Server[];
        setServers(serverList);
        
        if (serverList.length > 0 && !selectedServer) {
          setSelectedServer(serverList[0].guild_id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching servers:", err);
        setError("Failed to load servers. Please try again later.");
        setLoading(false);
      }
    };
    
    fetchServers();
  }, [selectedServer]);
  
  useEffect(() => {
    const fetchLogs = async () => {
      if (selectedServer) {
        try {
          setLoading(true);
          
          // Fetch all logs without type filtering
          const serverLogs = await DatabaseService.Logs.getAll(selectedServer, 'all') as any[];
          setLogs(serverLogs);
          setLoading(false);
        } catch (err) {
          console.error("Error fetching logs:", err);
          setError("Failed to load logs. Please try again later.");
          setLoading(false);
        }
      }
    };
    
    if (selectedServer) {
      fetchLogs();
    }
  }, [selectedServer]);
  
  const handleServerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedServer(e.target.value);
  };
  
  const refreshLogs = async () => {
    if (selectedServer) {
      try {
        setLoading(true);
        const serverLogs = await DatabaseService.Logs.getAll(selectedServer, 'all') as any[];
        setLogs(serverLogs);
        setLoading(false);
      } catch (err) {
        console.error("Error refreshing logs:", err);
        setError("Failed to refresh logs. Please try again.");
        setLoading(false);
      }
    }
  };
  
  // Function to get a color for log types
  const getLogTypeColor = (logType: string) => {
    switch (logType) {
      case 'mod':
        return '#ED4245'; // Red for moderation
      case 'ticket':
        return '#3BA55C'; // Green for tickets
      case 'command':
        return '#5865F2'; // Blue for commands
      case 'user':
        return '#FAA61A'; // Orange for user actions
      default:
        return '#FFFFFF'; // White for general
    }
  };
  
  if (loading && servers.length === 0) {
    return (
      <MainContent>
        <Card>
          <h2>Server Logs</h2>
          <LoadingSpinner />
        </Card>
      </MainContent>
    );
  }
  
  if (error && servers.length === 0) {
    return (
      <MainContent>
        <Card>
          <h2>Server Logs</h2>
          <p style={{ color: '#ED4245' }}>{error}</p>
        </Card>
      </MainContent>
    );
  }
  
  return (
    <MainContent>
      <Card>
        <h2>Server Logs</h2>
        <p>View comprehensive logs for your Discord servers.</p>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
          <div>
            <label style={{ marginRight: '0.5rem' }}>Select Server:</label>
            <select 
              value={selectedServer || ''}
              onChange={handleServerChange}
              style={{ padding: '0.5rem', borderRadius: '4px', backgroundColor: '#4f545c', color: 'white', border: 'none' }}
            >
              {servers.map(server => (
                <option key={server.guild_id} value={server.guild_id}>
                  {server.guild_name}
                </option>
              ))}
            </select>
          </div>
          
          <Button onClick={refreshLogs} style={{ marginLeft: 'auto' }}>
            Refresh Logs
          </Button>
        </div>
        
        {loading ? (
          <LoadingSpinner />
        ) : logs.length === 0 ? (
          <p>No logs found for this server.</p>
        ) : (
          <div style={{ 
            backgroundColor: '#2f3136', 
            padding: '1rem', 
            borderRadius: '4px',
            maxHeight: '600px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.9rem'
          }}>
            {logs.map((log, index) => (
              <div 
                key={index} 
                style={{ 
                  borderBottom: '1px solid #40444b', 
                  padding: '0.7rem 0',
                  borderLeft: `4px solid ${getLogTypeColor(log.log_type)}`,
                  paddingLeft: '10px'
                }}
              >
                <div style={{ marginBottom: '4px', color: '#B9BBBE' }}>
                  {log.formatted_time} - <span style={{ color: getLogTypeColor(log.log_type) }}>{log.action}</span>
                </div>
                <div style={{ marginBottom: '4px' }}>{log.details}</div>
                {log.user_name && (
                  <div style={{ color: '#B9BBBE', fontSize: '0.8rem' }}>
                    By: {log.user_name}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </MainContent>
  );
};

// App component
function App() {
  return (
    <Router>
      <AppContainer>
        <Header>
          <h1>Discord Bot Dashboard</h1>
        </Header>
        
        <Navigation>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/servers">Servers</NavLink>
          <NavLink to="/warnings">Warnings</NavLink>
          <NavLink to="/tickets">Tickets</NavLink>
          <NavLink to="/logs">Logs</NavLink>
          <NavLink to="/test">API Test</NavLink>
        </Navigation>
        
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/servers" element={<ServersPage />} />
          <Route path="/servers/:guildId/manage" element={<ServerManagePage />} />
          {/* Add a redirect for the undefined route */}
          <Route path="/servers/undefined/manage" element={<Navigate to="/servers" replace />} />
          <Route path="/warnings" element={<WarningsPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/test" element={<CorsTest />} />
        </Routes>
        
        <Footer>
          <p>Discord Bot Dashboard © {new Date().getFullYear()}</p>
        </Footer>
      </AppContainer>
    </Router>
  );
}

export default App;
