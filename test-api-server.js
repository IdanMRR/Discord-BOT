const axios = require('axios');

async function testApiServer() {
  console.log('🧪 Testing API server on port 3001...');
  
  try {
    // Test basic endpoint
    console.log('Testing basic endpoint...');
    const response = await axios.get('http://localhost:3001/', {
      timeout: 5000
    });
    console.log('✅ Basic endpoint response:', response.status, response.data);
  } catch (error) {
    console.log('❌ Basic endpoint failed:', error.message);
  }
  
  try {
    // Test simple-dashboard test endpoint
    console.log('\nTesting simple-dashboard test endpoint...');
    const response = await axios.get('http://localhost:3001/api/simple-dashboard/test', {
      timeout: 5000
    });
    console.log('✅ Test endpoint response:', response.status, response.data);
  } catch (error) {
    console.log('❌ Test endpoint failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
  
  try {
    // Test logs endpoint
    console.log('\nTesting logs endpoint...');
    const response = await axios.get('http://localhost:3001/api/simple-dashboard/logs', {
      params: { guild_id: '1365777891333374022' },
      timeout: 10000
    });
    console.log('✅ Logs endpoint response:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Logs endpoint failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

testApiServer();