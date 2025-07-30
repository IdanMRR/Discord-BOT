const axios = require('axios');

async function testLogsEndpoint() {
  console.log('🧪 Testing logs endpoint...');
  
  try {
    const response = await axios.get('http://localhost:3002/api/simple-dashboard/logs', {
      params: {
        guild_id: '1365777891333374022',
        page: '1',
        limit: '10'
      },
      headers: {
        'Authorization': 'Bearer test-token',
        'x-user-id': 'test-user'
      },
      timeout: 10000
    });
    
    console.log('✅ Logs endpoint test successful!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Logs endpoint test failed:');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testLogsEndpoint();