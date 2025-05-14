import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import axios from 'axios';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

// Status color mapping
const statusColors = {
  open: '#2ecc71',
  in_progress: '#3498db',
  on_hold: '#f39c12',
  closed: '#e74c3c',
  deleted: '#95a5a6'
};

// Helper function to format dates
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function TicketStats() {
  const { serverId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    byStatus: [],
    ratings: []
  });
  const [timeRange, setTimeRange] = useState('all'); // 'all', 'week', 'month'
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get ticket statistics
        const statsResponse = await axios.get(`/api/guilds/${serverId}/ticket-stats`);
        setStats(statsResponse.data);
        
        // Get all tickets
        const ticketsResponse = await axios.get(`/api/guilds/${serverId}/tickets`);
        setTickets(ticketsResponse.data);
      } catch (error) {
        console.error('Error fetching ticket data:', error);
        setError('Failed to load ticket statistics. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    if (serverId) {
      fetchData();
    }
  }, [serverId]);
  
  // Filter tickets based on time range
  const getFilteredTickets = () => {
    if (timeRange === 'all') return tickets;
    
    const now = new Date();
    let cutoffDate;
    
    if (timeRange === 'week') {
      cutoffDate = new Date(now.setDate(now.getDate() - 7));
    } else if (timeRange === 'month') {
      cutoffDate = new Date(now.setMonth(now.getMonth() - 1));
    }
    
    return tickets.filter(ticket => {
      const ticketDate = new Date(ticket.created_at);
      return ticketDate >= cutoffDate;
    });
  };
  
  // Status distribution chart data
  const statusChartData = {
    labels: stats.byStatus.map(status => status.status.charAt(0).toUpperCase() + status.status.slice(1).replace('_', ' ')),
    datasets: [
      {
        label: '# of Tickets',
        data: stats.byStatus.map(status => status.count),
        backgroundColor: stats.byStatus.map(status => statusColors[status.status] || '#7289da'),
        borderWidth: 1,
      },
    ],
  };
  
  // Rating distribution chart data
  const ratingChartData = {
    labels: stats.ratings.map(rating => `${rating.rating} Stars`),
    datasets: [
      {
        label: '# of Ratings',
        data: stats.ratings.map(rating => rating.count),
        backgroundColor: [
          '#e74c3c',
          '#e67e22',
          '#f1c40f',
          '#2ecc71',
          '#3498db',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  // Create data for monthly ticket creation
  const prepareMonthlyData = () => {
    const filteredTickets = getFilteredTickets();
    
    // Get last 6 months
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push(date.toLocaleString('default', { month: 'short', year: 'numeric' }));
    }
    
    // Count tickets per month
    const counts = months.map(month => {
      const [monthName, year] = month.split(' ');
      return filteredTickets.filter(ticket => {
        const date = new Date(ticket.created_at);
        return date.toLocaleString('default', { month: 'short' }) === monthName && 
               date.getFullYear().toString() === year;
      }).length;
    });
    
    return {
      labels: months,
      datasets: [
        {
          label: 'Tickets Created',
          data: counts,
          backgroundColor: '#7289da',
        }
      ]
    };
  };
  
  const monthlyData = prepareMonthlyData();
  
  // Chart options
  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Monthly Ticket Activity',
      },
    },
  };
  
  const handleTimeRangeChange = (event) => {
    setTimeRange(event.target.value);
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
  
  const filteredTickets = getFilteredTickets();
  
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4" component="h1" gutterBottom>
          Ticket Statistics
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" paragraph>
          View statistics and performance metrics for your support tickets.
        </Typography>
      </Grid>
      
      {/* Time range filter */}
      <Grid item xs={12}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="time-range-label">Time Range</InputLabel>
          <Select
            labelId="time-range-label"
            value={timeRange}
            label="Time Range"
            onChange={handleTimeRangeChange}
          >
            <MenuItem value="all">All Time</MenuItem>
            <MenuItem value="month">Last Month</MenuItem>
            <MenuItem value="week">Last Week</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      
      {/* Stats cards */}
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, backgroundColor: '#7289da', color: 'white' }}>
          <Typography variant="h6">Total Tickets</Typography>
          <Typography variant="h3">{stats.total}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, backgroundColor: '#2ecc71', color: 'white' }}>
          <Typography variant="h6">Open Tickets</Typography>
          <Typography variant="h3">
            {stats.byStatus.find(s => s.status === 'open')?.count || 0}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, backgroundColor: '#3498db', color: 'white' }}>
          <Typography variant="h6">In Progress</Typography>
          <Typography variant="h3">
            {stats.byStatus.find(s => s.status === 'in_progress')?.count || 0}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, backgroundColor: '#e74c3c', color: 'white' }}>
          <Typography variant="h6">Closed Tickets</Typography>
          <Typography variant="h3">
            {stats.byStatus.find(s => s.status === 'closed')?.count || 0}
          </Typography>
        </Paper>
      </Grid>
      
      {/* Charts */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Ticket Status Distribution
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 300 }}>
              <Pie data={statusChartData} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Monthly Tickets
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ height: 300 }}>
              <Bar options={barOptions} data={monthlyData} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      {stats.ratings.length > 0 && (
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Rating Distribution
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ height: 300 }}>
                <Pie data={ratingChartData} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      )}
      
      {/* Recent tickets table */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Tickets
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Closed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTickets.slice(0, 10).map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>#{ticket.ticket_number}</TableCell>
                      <TableCell>{ticket.subject}</TableCell>
                      <TableCell>{ticket.category || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1).replace('_', ' ')}
                          sx={{ 
                            backgroundColor: statusColors[ticket.status] || '#7289da',
                            color: 'white'
                          }}
                        />
                      </TableCell>
                      <TableCell>{formatDate(ticket.created_at)}</TableCell>
                      <TableCell>{formatDate(ticket.closed_at)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredTickets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No tickets found for the selected time period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
} 