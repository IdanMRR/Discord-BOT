// API-based database service that fetches real data from our backend

const API_URL = 'http://localhost:3001/api';
const API_KEY = 'f8e7d6c5b4a3928170615243cba98765';

// Helper function to make API requests
async function fetchApi(endpoint) {
  try {
    console.log(`Fetching from: ${API_URL}${endpoint}`);
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit', // Changed from 'include' to avoid CORS issues
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': API_KEY // Add the API key from .env
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API request failed: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Response from ${endpoint}:`, data); // Log the response data
    return data;
  } catch (error) {
    console.error(`Error fetching from ${endpoint}:`, error.message || error);
    // Return a default response for debugging
    if (endpoint === '/servers') {
      console.log('Returning fallback server data for debugging');
      return {
        servers: [
          {
            guild_id: '123456789',
            guild_name: 'Test Server',
            memberCount: 100,
            welcome_channel_name: 'welcome',
            logs_channel_name: 'logs',
            stats: {
              tickets: 5,
              warnings: 10,
              commands: 50
            }
          }
        ],
        stats: {
          serverCount: 1,
          activeTickets: 5,
          activeWarnings: 10,
          commandsUsed: 50
        }
      };
    }
    return null;
  }
}

// Server settings functions
export const ServerSettings = {
  getAll: async () => {
    console.log('Fetching all servers from API');
    const response = await fetchApi('/servers');
    
    // Handle the new response format which includes servers and stats
    if (response && response.servers) {
      return response.servers || [];
    }
    
    // Fallback to the old format if needed
    return response || [];
  },
  
  get: async (guildId) => {
    if (!guildId || guildId === 'undefined') {
      console.error('Invalid guild ID provided to ServerSettings.get');
      return null;
    }
    
    console.log(`Fetching server with ID: ${guildId} from API`);
    try {
      const data = await fetchApi(`/servers/${guildId}`);
      return data;
    } catch (error) {
      console.error(`Error fetching server ${guildId}:`, error);
      return null;
    }
  },
  
  update: async (guildId, settings) => {
    console.log(`Updating server ${guildId} with settings:`, settings);
    
    try {
      const response = await fetch(`${API_URL}/servers/${guildId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error updating server ${guildId}:`, error);
      return null;
    }
  }
};

// Warnings functions
export const Warnings = {
  getAll: async (guildId, userId = null, activeOnly = false) => {
    console.log(`Fetching warnings for guild ${guildId} from API`);
    
    let endpoint = `/servers/${guildId}/warnings`;
    const params = new URLSearchParams();
    
    if (userId) {
      params.append('userId', userId);
    }
    
    if (activeOnly) {
      params.append('active', 'true');
    }
    
    const queryString = params.toString();
    if (queryString) {
      endpoint += `?${queryString}`;
    }
    
    const data = await fetchApi(endpoint);
    return data || [];
  },
  
  add: async (guildId, userId, moderatorId, reason) => {
    console.log(`Adding warning for user ${userId} in guild ${guildId}`);
    
    try {
      const response = await fetch(`${API_URL}/servers/${guildId}/warnings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          moderatorId,
          reason
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error(`Error adding warning for user ${userId} in guild ${guildId}:`, error);
      return null;
    }
  },
  
  /**
   * Remove a warning
   * @param {number} warningId - The ID of the warning to remove
   * @param {string|null} guildId - The guild ID (optional)
   * @returns {Promise<boolean>} - Whether removal was successful
   */
  remove: async (warningId, guildId = null) => {
    console.log(`Removing warning with ID ${warningId}`);
    
    try {
      let targetGuildId = guildId;
      
      // If guildId is not provided, try to get it from the warning
      if (!targetGuildId) {
        const warningsList = await Warnings.getAll('1365777891333374022');
        const warning = warningsList.find(w => w.id === warningId);
        
        if (!warning) {
          throw new Error(`Warning with ID ${warningId} not found`);
        }
        
        targetGuildId = warning.guild_id;
      }
      
      const response = await fetch(`${API_URL}/servers/${targetGuildId}/warnings/${warningId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          removal_reason: 'Removed via dashboard'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error removing warning ${warningId}:`, error);
      return false;
    }
  }
};

// Tickets functions
export const Tickets = {
  getAll: async (guildId, status = null, userId = null) => {
    console.log(`Fetching tickets for guild ${guildId} from API`);
    
    let endpoint = `/servers/${guildId}/tickets`;
    const params = new URLSearchParams();
    
    if (status) {
      params.append('status', status);
    }
    
    if (userId) {
      params.append('userId', userId);
    }
    
    const queryString = params.toString();
    if (queryString) {
      endpoint += `?${queryString}`;
    }
    
    const data = await fetchApi(endpoint);
    return data || [];
  },
  
  get: async (ticketId) => {
    console.log(`Fetching ticket with ID ${ticketId} from API`);
    return await fetchApi(`/tickets/${ticketId}`);
  },
  
  closeTicket: async (ticketId, guildId = '1365777891333374022') => {
    console.log(`Closing ticket with ID ${ticketId} in guild ${guildId}`);
    
    try {
      const response = await fetch(`${API_URL}/servers/${guildId}/tickets/${ticketId}/close`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Server error when closing ticket: ${JSON.stringify(errorData)}`);
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData.error || ''}`);
      }
      
      const result = await response.json();
      console.log(`Close ticket response: ${JSON.stringify(result)}`);
      return result.success;
    } catch (error) {
      console.error(`Error closing ticket ${ticketId}:`, error);
      return false;
    }
  },
  
  reopenTicket: async (ticketId, reason = '', guildId = '1365777891333374022') => {
    console.log(`Reopening ticket with ID ${ticketId} in guild ${guildId}`);
    
    try {
      const response = await fetch(`${API_URL}/servers/${guildId}/tickets/${ticketId}/reopen`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData.error || ''}`);
      }
      
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error(`Error reopening ticket ${ticketId}:`, error);
      return false;
    }
  }
};

// Commands functions
export const Commands = {
  getAll: async (guildId) => {
    console.log(`Fetching command history for guild ${guildId} from API`);
    
    const data = await fetchApi(`/servers/${guildId}/commands`);
    return data || [];
  }
};

// Logs functions
export const Logs = {
  getAll: async (guildId, type = 'general') => {
    console.log(`Fetching logs for guild ${guildId} from API with type ${type}`);
    
    let endpoint = `/servers/${guildId}/logs`;
    const params = new URLSearchParams();
    
    if (type) {
      params.append('type', type);
    }
    
    const queryString = params.toString();
    if (queryString) {
      endpoint += `?${queryString}`;
    }
    
    const data = await fetchApi(endpoint);
    return data || [];
  }
};

// Create a named object before exporting
const DatabaseService = {
  ServerSettings,
  Warnings,
  Tickets,
  Commands,
  Logs
};

export default DatabaseService;
