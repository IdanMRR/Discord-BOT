const axios = require('axios');

async function testLogsFormat() {
  try {
    console.log('🧪 Testing logs endpoint with time format...');
    
    const response = await axios.get('http://localhost:3001/api/simple-dashboard/logs', {
      params: { guild_id: '1365777891333374022' },
      timeout: 10000
    });
    
    console.log('✅ Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Check if there are any logs with the new time format
    if (response.data.success && response.data.data.length > 0) {
      console.log('\n📅 Time format check:');
      response.data.data.forEach((log, index) => {
        console.log(`Log ${index + 1}: ${log.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testLogsFormat();