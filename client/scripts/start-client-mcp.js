#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if TypeScript is compiled
const distPath = path.join(__dirname, '..', 'dist', 'mcp', 'simple-client-mcp-server.js');
const srcPath = path.join(__dirname, '..', 'src', 'mcp', 'simple-client-mcp-server.ts');

if (!fs.existsSync(distPath)) {
  console.log('Compiling TypeScript...');
  const tsc = spawn('npx', ['tsc', srcPath, '--outDir', path.join(__dirname, '..', 'dist', 'mcp'), '--target', 'es2020', '--module', 'commonjs'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  tsc.on('close', (code) => {
    if (code === 0) {
      console.log('TypeScript compiled successfully');
      startClientMCPServer();
    } else {
      console.error('TypeScript compilation failed');
      process.exit(1);
    }
  });
} else {
  startClientMCPServer();
}

function startClientMCPServer() {
  console.log('Starting Client Dashboard MCP Server...');
  
  const serverProcess = spawn('node', [distPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'http://localhost:3001'
    }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Client MCP Server: ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Client MCP Server Error: ${data.toString().trim()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Client MCP Server exited with code ${code}`);
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start Client MCP Server:', error);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down Client MCP Server...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down Client MCP Server...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
}