import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Paper, 
  Typography, 
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  TextField,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { Refresh, FilterList } from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';

interface LogEntry {
  id: number;
  guild_id: string;
  action_type: string;
  user_id?: string;
  channel_id?: string;
  message_id?: string;
  details: any;
  created_at: string;
}

const Logs: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [guildId, setGuildId] = useState('');

  useEffect(() => {
    const guildIdParam = searchParams.get('guildId');
    if (guildIdParam) {
      setGuildId(guildIdParam);
    }
  }, [location.search, searchParams]);

  useEffect(() => {
    if (guildId) {
      fetchLogs();
    }
  }, [guildId, page, rowsPerPage]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/logs', {
        params: {
          guildId,
          page: page + 1,
          limit: rowsPerPage,
          search
        }
      });
      setLogs(response.data.data || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'messageDelete': return 'error';
      case 'messageEdit': return 'warning';
      case 'channelCreate': return 'success';
      case 'channelDelete': return 'error';
      case 'channelUpdate': return 'info';
      default: return 'default';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading && logs.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography>Loading logs...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Server Logs</Typography>
        <IconButton onClick={fetchLogs} disabled={loading}>
          <Refresh />
        </IconButton>
      </Box>

      <TextField
        fullWidth
        label="Search logs..."
        variant="outlined"
        margin="normal"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && fetchLogs()}
        sx={{ mb: 2 }}
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Details</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Channel</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  {loading ? <CircularProgress /> : 'No logs found'}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>{formatTimestamp(log.created_at)}</TableCell>
                  <TableCell>
                    <Chip 
                      label={log.action_type} 
                      color={getActionColor(log.action_type) as any} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    <Box component="pre" sx={{ 
                      fontFamily: 'monospace', 
                      whiteSpace: 'pre-wrap',
                      maxHeight: '100px',
                      overflow: 'auto',
                      margin: 0,
                      fontSize: '0.8rem'
                    }}>
                      {JSON.stringify(log.details, null, 2)}
                    </Box>
                  </TableCell>
                  <TableCell>{log.user_id || 'System'}</TableCell>
                  <TableCell>{log.channel_id || 'N/A'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[10, 25, 50]}
        component="div"
        count={total}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(e, newPage) => setPage(newPage)}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Container>
  );
};

export default Logs;
