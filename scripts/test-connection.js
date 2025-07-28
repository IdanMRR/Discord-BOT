#!/usr/bin/env node

const axios = require('axios');

console.log('🔍 Testing API server connectivity...');

async function testPorts() {
  const ports = [3001, 3002, 3003, 8080, 5000];
  
  for (const port of ports) {
    console.log(`\n🔌 Testing port ${port}...`);
    
    try {
      // Test status endpoint
      const statusResponse = await axios.get(`http://localhost:${port}/api/status`, {
        timeout: 3000
      });
      
      if (statusResponse.status === 200) {
        console.log(`✅ Port ${port} - Status endpoint working`);
        console.log(`   Response:`, statusResponse.data);
        
        // Test dashboard logs endpoint
        try {
          const logsResponse = await axios.get(`http://localhost:${port}/api/dashboard-logs?limit=1`, {
            timeout: 3000
          });
          
          if (logsResponse.status === 200) {
            console.log(`✅ Port ${port} - Dashboard logs endpoint working`);
            console.log(`   Found ${logsResponse.data?.data?.logs?.length || 0} logs`);
            console.log(`🎉 WORKING SERVER FOUND ON PORT ${port}!`);
            
            console.log('\n' + '='.repeat(50));
            console.log(`✅ Your server is running on: http://localhost:${port}`);
            console.log(`✅ Dashboard logs API: http://localhost:${port}/api/dashboard-logs`);
            console.log(`✅ HTML viewer: http://localhost:${port}/api/dashboard-logs/viewer`);
            console.log('\n📋 To fix the frontend:');
            console.log(`1. Update REACT_APP_API_URL to http://localhost:${port}`);
            console.log(`2. Or restart frontend to match the server port`);
            return port;
          } else {
            console.log(`❌ Port ${port} - Dashboard logs endpoint failed (${logsResponse.status})`);
          }
        } catch (logError) {
          console.log(`❌ Port ${port} - Dashboard logs endpoint failed: ${logError.message}`);
        }
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ Port ${port} - No server running`);
      } else if (error.code === 'ENOTFOUND') {
        console.log(`❌ Port ${port} - Host not found`);
      } else {
        console.log(`❌ Port ${port} - Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n❌ No working server found on any tested port');
  console.log('\n🔧 Troubleshooting steps:');
  console.log('1. Make sure the server is running: npm run server or npm start');
  console.log('2. Check if the server is running on a different port');
  console.log('3. Look at the server startup logs to see which port it\'s using');
  
  return null;
}

testPorts().catch(error => {
  console.error('❌ Test failed:', error.message);
});