// Environment configuration for the Discord Bot Dashboard
export const environment = {
  // API Configuration
  API_URL: 'http://localhost:3001', // Back to 3001 as requested
  WS_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:3001',
  
  // Auto-detection fallback ports (in order of preference)
  FALLBACK_PORTS: [3001, 3002, 3003],
  
  // Development settings
  isDevelopment: process.env.NODE_ENV === 'development',
  
  // Feature flags
  features: {
    enableWebSocket: true,
    enableAutoDetection: true, // Enable auto-detection to find correct port
    enableLogging: process.env.NODE_ENV === 'development'
  }
};

export const currentConfig = environment.isDevelopment ? {
  apiUrl: environment.API_URL,
  wsUrl: environment.WS_URL,
  fallbackPorts: environment.FALLBACK_PORTS
} : {
  apiUrl: environment.API_URL,
  wsUrl: environment.WS_URL,
  fallbackPorts: [] // No fallback in production
};

// Auto-detect available API port in development
export const detectApiUrl = async (): Promise<string> => {
  if (!environment.isDevelopment) {
    return environment.API_URL;
  }

  for (const port of environment.FALLBACK_PORTS) {
    try {
      const testUrl = `http://localhost:${port}/api/status`;
      const response = await fetch(testUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      
      // Check if response is OK AND contains the expected API response structure
      if (response.ok) {
        const data = await response.json();
        // Verify it's actually our API by checking for expected fields
        if (data && data.success === true && data.status === 'online' && data.port) {
          console.log(`✅ Found API server running on port ${port}`);
          return `http://localhost:${port}`;
        } else {
          console.log(`❌ Port ${port} returned response but not our API server`);
        }
      }
    } catch (error) {
      console.log(`❌ Port ${port} not available:`, error);
    }
  }

  console.warn('⚠️ No API server found on any fallback port, using default');
  return environment.API_URL;
};

export default currentConfig; 