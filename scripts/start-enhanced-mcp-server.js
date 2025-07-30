#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if TypeScript is compiled
const distPath = path.join(__dirname, '..', 'dist', 'mcp', 'enhanced-discord-bot-mcp-server.js');
const srcPath = path.join(__dirname, '..', 'src', 'mcp', 'enhanced-discord-bot-mcp-server.ts');

if (!fs.existsSync(distPath)) {
  console.log('Compiling TypeScript...');
  const tsc = spawn('npx', ['tsc'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  tsc.on('close', (code) => {
    if (code === 0) {
      console.log('TypeScript compiled successfully');
      startEnhancedMCPServer();
    } else {
      console.error('TypeScript compilation failed');
      process.exit(1);
    }
  });
} else {
  startEnhancedMCPServer();
}

function startEnhancedMCPServer() {
  console.log('Starting Enhanced Discord Bot MCP Server...');
  
  // Load environment variables
  require('dotenv').config();
  
  const serverProcess = spawn('node', [distPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001'
    }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Enhanced MCP Server: ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Enhanced MCP Server Error: ${data.toString().trim()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Enhanced MCP Server exited with code ${code}`);
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start Enhanced MCP Server:', error);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down Enhanced MCP Server...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down Enhanced MCP Server...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
}