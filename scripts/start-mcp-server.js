#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if TypeScript is compiled
const distPath = path.join(__dirname, '..', 'dist', 'mcp', 'discord-bot-mcp-server.js');
const srcPath = path.join(__dirname, '..', 'src', 'mcp', 'discord-bot-mcp-server.ts');

if (!fs.existsSync(distPath)) {
  console.log('Compiling TypeScript...');
  const tsc = spawn('npx', ['tsc'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  tsc.on('close', (code) => {
    if (code === 0) {
      console.log('TypeScript compiled successfully');
      startMCPServer();
    } else {
      console.error('TypeScript compilation failed');
      process.exit(1);
    }
  });
} else {
  startMCPServer();
}

function startMCPServer() {
  console.log('Starting Discord Bot MCP Server...');
  
  // Load environment variables
  require('dotenv').config();
  
  const serverProcess = spawn('node', [distPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`MCP Server: ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`MCP Server Error: ${data.toString().trim()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`MCP Server exited with code ${code}`);
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start MCP Server:', error);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down MCP Server...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down MCP Server...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
}