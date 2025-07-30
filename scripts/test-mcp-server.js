#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Testing Discord Bot MCP Server...');

// Check if the compiled server exists
const distPath = path.join(__dirname, '..', 'dist', 'mcp', 'discord-bot-mcp-server.js');
if (!fs.existsSync(distPath)) {
  console.log('Compiling TypeScript first...');
  const tsc = spawn('npx', ['tsc'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  tsc.on('close', (code) => {
    if (code === 0) {
      console.log('Compilation successful, running tests...');
      runTests();
    } else {
      console.error('Compilation failed');
      process.exit(1);
    }
  });
} else {
  runTests();
}

function runTests() {
  console.log('Starting MCP server for testing...');
  
  // Load environment variables
  require('dotenv').config();
  
  const serverProcess = spawn('node', [distPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });

  let serverReady = false;
  let testResults = [];

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`Server: ${output}`);
    
    if (output.includes('Database connected successfully') || output.includes('Discord client logged in successfully')) {
      serverReady = true;
      console.log('Server is ready for testing');
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const error = data.toString().trim();
    console.error(`Server Error: ${error}`);
    
    if (error.includes('Failed to connect to database') || error.includes('Failed to login to Discord')) {
      testResults.push({
        test: 'Server Initialization',
        status: 'FAILED',
        error: error
      });
    }
  });

  // Test the server after a short delay
  setTimeout(() => {
    if (serverReady) {
      console.log('Running MCP server tests...');
      
      // Test basic functionality
      testResults.push({
        test: 'Server Initialization',
        status: 'PASSED',
        message: 'Server started successfully'
      });

      // Test database connection
      if (fs.existsSync(path.join(__dirname, '..', 'data', 'discord-bot.db'))) {
        testResults.push({
          test: 'Database Connection',
          status: 'PASSED',
          message: 'Database file exists'
        });
      } else {
        testResults.push({
          test: 'Database Connection',
          status: 'WARNING',
          message: 'Database file not found - some tools may not work'
        });
      }

      // Test environment variables
      if (process.env.DISCORD_TOKEN) {
        testResults.push({
          test: 'Environment Variables',
          status: 'PASSED',
          message: 'Discord token is set'
        });
      } else {
        testResults.push({
          test: 'Environment Variables',
          status: 'WARNING',
          message: 'Discord token not set - some tools may not work'
        });
      }

      // Print test results
      console.log('\n=== MCP Server Test Results ===');
      testResults.forEach(result => {
        const status = result.status === 'PASSED' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
        console.log(`${status} ${result.test}: ${result.message || result.error}`);
      });

      const passedTests = testResults.filter(r => r.status === 'PASSED').length;
      const totalTests = testResults.length;
      
      console.log(`\nTest Summary: ${passedTests}/${totalTests} tests passed`);
      
      if (passedTests === totalTests) {
        console.log('🎉 All tests passed! MCP server is ready to use.');
      } else {
        console.log('⚠️ Some tests failed or have warnings. Check the output above.');
      }
    } else {
      console.log('❌ Server failed to start properly');
    }

    // Clean up
    serverProcess.kill('SIGINT');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }, 5000);

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start server process:', error);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down test...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });
}