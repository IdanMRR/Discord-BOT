import React, { useState, useEffect } from 'react';

function CorsTest() {
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to fetch from our CORS test endpoint
      const response = await fetch('http://localhost:3001/api/cors-test', {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-api-key': 'f8e7d6c5b4a3928170615243cba98765'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setTestResult(data);
    } catch (err) {
      console.error('CORS Test Error:', err);
      setError(err.message || 'Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  // Run the test once when the component mounts
  useEffect(() => {
    runTest();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>API Connection Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={runTest} 
          disabled={loading}
          style={{
            padding: '10px 15px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test API Connection'}
        </button>
      </div>

      {error && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#ffebee', 
          border: '1px solid #f44336',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: '#d32f2f', margin: '0 0 10px 0' }}>Error</h3>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {testResult && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#e8f5e9', 
          border: '1px solid #4caf50',
          borderRadius: '4px'
        }}>
          <h3 style={{ color: '#2e7d32', margin: '0 0 10px 0' }}>Success!</h3>
          <p><strong>Message:</strong> {testResult.message}</p>
          <p><strong>Timestamp:</strong> {testResult.timestamp}</p>
          <p>The API connection is working correctly.</p>
        </div>
      )}

      <div style={{ marginTop: '30px' }}>
        <h2>Troubleshooting Tips</h2>
        <ul>
          <li>Make sure the bot is running on port 3000</li>
          <li>Check that CORS is properly configured in the API server</li>
          <li>Verify that the API key is correct</li>
          <li>Check the browser console for detailed error messages</li>
        </ul>
      </div>
    </div>
  );
}

export default CorsTest;
