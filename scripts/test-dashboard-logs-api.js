#!/usr/bin/env node

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

console.log('🧪 Testing Dashboard Logs API...');

async function testAPI() {
  try {
    // Test 1: Get dashboard logs
    console.log('\n1. Testing GET /api/dashboard-logs');
    try {
      const response = await axios.get(`${BASE_URL}/api/dashboard-logs?limit=5`);
      if (response.status === 200) {
        console.log('✅ GET /api/dashboard-logs - SUCCESS');
        console.log(`   Found ${response.data?.data?.logs?.length || 0} logs`);
        console.log(`   Total: ${response.data?.data?.pagination?.total || 0}`);
      } else {
        console.log(`❌ GET /api/dashboard-logs - FAILED (Status: ${response.status})`);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('❌ Cannot connect to server. Make sure the server is running on port 3001');
        console.log('   Run: npm run server');
        return false;
      } else if (error.response) {
        console.log(`❌ GET /api/dashboard-logs - FAILED (Status: ${error.response.status})`);
        console.log(`   Error: ${error.response.data?.error || error.response.statusText}`);
      } else {
        console.log(`❌ GET /api/dashboard-logs - FAILED: ${error.message}`);
      }
    }

    // Test 2: Create a test log entry
    console.log('\n2. Testing POST /api/dashboard-logs/test');
    try {
      const response = await axios.post(`${BASE_URL}/api/dashboard-logs/test`);
      if (response.status === 200) {
        console.log('✅ POST /api/dashboard-logs/test - SUCCESS');
        console.log('   Test log entry created');
      } else {
        console.log(`❌ POST /api/dashboard-logs/test - FAILED (Status: ${response.status})`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`❌ POST /api/dashboard-logs/test - FAILED (Status: ${error.response.status})`);
        console.log(`   Error: ${error.response.data?.error || error.response.statusText}`);
      } else {
        console.log(`❌ POST /api/dashboard-logs/test - FAILED: ${error.message}`);
      }
    }

    // Test 3: Test HTML viewer
    console.log('\n3. Testing GET /api/dashboard-logs/viewer');
    try {
      const response = await axios.get(`${BASE_URL}/api/dashboard-logs/viewer`);
      if (response.status === 200 && response.headers['content-type']?.includes('text/html')) {
        console.log('✅ GET /api/dashboard-logs/viewer - SUCCESS');
        console.log('   HTML viewer returned successfully');
      } else {
        console.log(`❌ GET /api/dashboard-logs/viewer - FAILED (Status: ${response.status})`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`❌ GET /api/dashboard-logs/viewer - FAILED (Status: ${error.response.status})`);
        console.log(`   Error: ${error.response.data?.error || error.response.statusText}`);
      } else {
        console.log(`❌ GET /api/dashboard-logs/viewer - FAILED: ${error.message}`);
      }
    }

    // Test 4: Get stats
    console.log('\n4. Testing GET /api/dashboard-logs/stats');
    try {
      const response = await axios.get(`${BASE_URL}/api/dashboard-logs/stats`);
      if (response.status === 200) {
        console.log('✅ GET /api/dashboard-logs/stats - SUCCESS');
        const stats = response.data?.data;
        if (stats) {
          console.log(`   Total Actions: ${stats.totalActions || 0}`);
          console.log(`   Unique Users: ${stats.uniqueUsers || 0}`);
          console.log(`   Success Rate: ${stats.successRate || 0}%`);
        }
      } else {
        console.log(`❌ GET /api/dashboard-logs/stats - FAILED (Status: ${response.status})`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`❌ GET /api/dashboard-logs/stats - FAILED (Status: ${error.response.status})`);
        console.log(`   Error: ${error.response.data?.error || error.response.statusText}`);
      } else {
        console.log(`❌ GET /api/dashboard-logs/stats - FAILED: ${error.message}`);
      }
    }

    return true;
  } catch (error) {
    console.log(`❌ General test error: ${error.message}`);
    return false;
  }
}

// Run the tests
testAPI().then(success => {
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('🎉 Dashboard Logs API testing completed!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Check the frontend Dashboard Activity Logs page');
    console.log('2. Try the HTML viewer at: ' + BASE_URL + '/api/dashboard-logs/viewer');
    console.log('3. Verify that user activities are being logged properly');
  } else {
    console.log('❌ Dashboard Logs API testing failed');
    console.log('');
    console.log('Troubleshooting:');
    console.log('1. Make sure the server is running: npm run server');
    console.log('2. Check if the database was created properly');
    console.log('3. Verify the dashboard-logs table exists');
  }
}).catch(error => {
  console.error('❌ Test script failed:', error.message);
});