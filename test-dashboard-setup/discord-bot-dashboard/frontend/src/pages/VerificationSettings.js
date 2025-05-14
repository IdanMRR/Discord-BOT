import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Grid,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  Switch,
  TextField,
  Button,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Snackbar,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import axios from 'axios';

export default function VerificationSettings() {
  const { serverId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    type: 'button',
    role_id: '',
    channel_id: '',
    message_id: '',
    custom_questions: [],
    min_age: 13,
    require_account_age: false,
    min_account_age_days: 7,
    log_channel_id: '',
    timeout_minutes: 10,
    welcome_message: '',
    welcome_channel_id: ''
  });
  const [newQuestion, setNewQuestion] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/guilds/${serverId}/verification`);
        
        // Convert numeric booleans to actual booleans
        const data = {
          ...response.data,
          enabled: !!response.data.enabled,
          require_account_age: !!response.data.require_account_age,
          custom_questions: response.data.custom_questions || []
        };
        
        setSettings(data);
      } catch (error) {
        console.error('Error fetching verification settings:', error);
        setError('Failed to load verification settings. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    if (serverId) {
      fetchSettings();
    }
  }, [serverId]);

  const handleChange = (event) => {
    const { name, value, checked } = event.target;
    
    if (name === 'enabled' || name === 'require_account_age') {
      setSettings(prev => ({ ...prev, [name]: checked }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleNumberChange = (event) => {
    const { name, value } = event.target;
    // Ensure we have a valid number
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      setSettings(prev => ({ ...prev, [name]: numValue }));
    }
  };

  const handleAddQuestion = () => {
    if (newQuestion.trim()) {
      const question = {
        question: newQuestion,
        required: true
      };
      setSettings(prev => ({
        ...prev,
        custom_questions: [...prev.custom_questions, question]
      }));
      setNewQuestion('');
    }
  };

  const handleDeleteQuestion = (index) => {
    setSettings(prev => ({
      ...prev,
      custom_questions: prev.custom_questions.filter((_, i) => i !== index)
    }));
  };

  const handleQuestionRequiredChange = (index, isRequired) => {
    const updatedQuestions = [...settings.custom_questions];
    updatedQuestions[index].required = isRequired;
    setSettings(prev => ({
      ...prev,
      custom_questions: updatedQuestions
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await axios.put(`/api/guilds/${serverId}/verification`, settings);
      setSaveSuccess(true);
    } catch (error) {
      console.error('Error saving verification settings:', error);
      setError('Failed to save verification settings. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSaveSuccess(false);
  };

  if (loading && !settings.type) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      <Snackbar
        open={saveSuccess}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        message="Verification settings saved successfully!"
      />
      
      <Grid item xs={12}>
        <Typography variant="h4" component="h1" gutterBottom>
          Verification Settings
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" paragraph>
          Configure how users verify themselves when joining your server.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      </Grid>
      
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Basic Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enabled}
                    onChange={handleChange}
                    name="enabled"
                  />
                }
                label="Enable Verification"
              />
              
              <Box mt={2}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="verification-type-label">Verification Type</InputLabel>
                  <Select
                    labelId="verification-type-label"
                    value={settings.type}
                    name="type"
                    label="Verification Type"
                    onChange={handleChange}
                    disabled={!settings.enabled}
                  >
                    <MenuItem value="button">Button (Simple Verification)</MenuItem>
                    <MenuItem value="captcha">Captcha</MenuItem>
                    <MenuItem value="questions">Custom Questions</MenuItem>
                    <MenuItem value="age">Age Verification</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <TextField
                    label="Verification Channel ID"
                    name="channel_id"
                    value={settings.channel_id || ''}
                    onChange={handleChange}
                    disabled={!settings.enabled}
                    placeholder="Enter channel ID"
                    helperText="The channel where the verification message will be posted"
                  />
                </FormControl>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <TextField
                    label="Verified Role ID"
                    name="role_id"
                    value={settings.role_id || ''}
                    onChange={handleChange}
                    disabled={!settings.enabled}
                    placeholder="Enter role ID"
                    helperText="The role to assign after verification"
                  />
                </FormControl>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <TextField
                    label="Log Channel ID"
                    name="log_channel_id"
                    value={settings.log_channel_id || ''}
                    onChange={handleChange}
                    disabled={!settings.enabled}
                    placeholder="Enter channel ID"
                    helperText="The channel where verification attempts will be logged"
                  />
                </FormControl>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <TextField
                    label="Verification Timeout (minutes)"
                    name="timeout_minutes"
                    type="number"
                    value={settings.timeout_minutes || 10}
                    onChange={handleNumberChange}
                    disabled={!settings.enabled}
                    inputProps={{ min: 1, max: 60 }}
                    helperText="How long users have to complete verification"
                  />
                </FormControl>
              </Box>
            </FormGroup>
          </CardContent>
        </Card>
      </Grid>
      
      {settings.type === 'age' && (
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Age Verification Settings
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <TextField
                  label="Minimum Age"
                  name="min_age"
                  type="number"
                  value={settings.min_age || 13}
                  onChange={handleNumberChange}
                  disabled={!settings.enabled}
                  inputProps={{ min: 13, max: 100 }}
                  helperText="Minimum age required to join (typically 13)"
                />
              </FormControl>
            </CardContent>
          </Card>
        </Grid>
      )}
      
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Account Age Requirements
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.require_account_age}
                    onChange={handleChange}
                    name="require_account_age"
                    disabled={!settings.enabled}
                  />
                }
                label="Require Minimum Discord Account Age"
              />
              
              {settings.require_account_age && (
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <TextField
                    label="Minimum Account Age (days)"
                    name="min_account_age_days"
                    type="number"
                    value={settings.min_account_age_days || 7}
                    onChange={handleNumberChange}
                    disabled={!settings.enabled}
                    inputProps={{ min: 1, max: 365 }}
                    helperText="Minimum age of Discord account in days"
                  />
                </FormControl>
              )}
            </FormGroup>
          </CardContent>
        </Card>
      </Grid>
      
      {settings.type === 'questions' && (
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Custom Questions
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Add custom questions that users will need to answer during verification.
                </Typography>
              </Box>
              
              <List>
                {settings.custom_questions.map((q, index) => (
                  <ListItem key={index} component={Paper} sx={{ mb: 1, backgroundColor: '#2f3136' }}>
                    <ListItemText 
                      primary={q.question}
                      secondary={
                        <FormControlLabel
                          control={
                            <Switch
                              checked={q.required}
                              onChange={(e) => handleQuestionRequiredChange(index, e.target.checked)}
                              size="small"
                            />
                          }
                          label="Required"
                        />
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleDeleteQuestion(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
              
              <Box display="flex" mt={2}>
                <TextField
                  fullWidth
                  label="New Question"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  disabled={!settings.enabled}
                  placeholder="Enter a question"
                />
                <IconButton 
                  color="primary" 
                  onClick={handleAddQuestion}
                  disabled={!settings.enabled || !newQuestion.trim()}
                  sx={{ ml: 1 }}
                >
                  <AddIcon />
                </IconButton>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      )}
      
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Welcome Message
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <TextField
                label="Welcome Channel ID"
                name="welcome_channel_id"
                value={settings.welcome_channel_id || ''}
                onChange={handleChange}
                disabled={!settings.enabled}
                placeholder="Enter channel ID"
                helperText="The channel where welcome messages will be sent after verification"
              />
            </FormControl>
            
            <FormControl fullWidth>
              <TextField
                label="Welcome Message"
                name="welcome_message"
                value={settings.welcome_message || ''}
                onChange={handleChange}
                disabled={!settings.enabled}
                multiline
                rows={4}
                placeholder="Enter welcome message"
                helperText="Message to send after successful verification. Use {user} for the user mention."
              />
            </FormControl>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12}>
        <Box display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
} 