import { Router, Request, Response } from 'express';
import { getClient, isClientReady } from '../utils/client-utils';
import { db } from '../database/sqlite';
import { logInfo, logError } from '../utils/logger';

const router = Router();

interface SystemMetrics {
  uptime: string;
  memoryUsage: {
    used: string;
    total: string;
    percentage: number;
  };
  apiLatency: string;
  databaseSize: string;
  guildCount: number;
  totalUsers: number;
  commandsExecuted: number;
  messagesProcessed: number;
  systemLoad: {
    cpu: number;
    memory: number;
  };
  lastRestart: string;
  nodeVersion: string;
  discordJsVersion: string;
}

// Get comprehensive system metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Get bot client
    const client = getClient();
    
    // Calculate uptime
    const uptimeMs = process.uptime() * 1000;
    const uptimeFormatted = formatUptime(uptimeMs);
    
    // Get memory usage
    const memUsage = process.memoryUsage();
    const memoryUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const memoryTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
    const memoryPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    
    // Get database metrics
    const dbStats = await getDatabaseStats();
    
    // Get guild and user counts
    let guildCount = 0;
    let totalUsers = 0;
    
    if (client && isClientReady()) {
      guildCount = client.guilds.cache.size;
      totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    }
    
    // Get command execution count
    const commandsExecuted = await getCommandExecutionCount();
    
    // Get messages processed count
    const messagesProcessed = await getMessagesProcessedCount();
    
    // Calculate API latency
    const apiLatency = Date.now() - startTime;
    
    const metrics: SystemMetrics = {
      uptime: uptimeFormatted,
      memoryUsage: {
        used: `${memoryUsed} MB`,
        total: `${memoryTotal} MB`,
        percentage: memoryPercentage
      },
      apiLatency: `${apiLatency}ms`,
      databaseSize: dbStats.size,
      guildCount,
      totalUsers,
      commandsExecuted,
      messagesProcessed,
      systemLoad: {
        cpu: await getCPUUsage(),
        memory: memoryPercentage
      },
      lastRestart: getLastRestartTime(),
      nodeVersion: process.version,
      discordJsVersion: getDiscordJsVersion()
    };
    
    res.json({
      success: true,
      data: metrics
    });
    
  } catch (error) {
    logError('System Metrics', `Error getting system metrics: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get system metrics'
    });
  }
});

// Get API health status
router.get('/health', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Test database connection
    const dbHealthy = await testDatabaseConnection();
    
    // Test Discord client connection
    const client = getClient();
    const discordHealthy = client && isClientReady();
    
    const responseTime = Date.now() - startTime;
    
    const health = {
      status: dbHealthy && discordHealthy ? 'healthy' : 'unhealthy',
      database: dbHealthy ? 'connected' : 'disconnected',
      discord: discordHealthy ? 'connected' : 'disconnected',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: health
    });
    
  } catch (error) {
    logError('System Health', `Error checking system health: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

// Helper functions
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m ${seconds % 60}s`;
  }
}

async function getDatabaseStats() {
  try {
    // Get database file size
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.join(process.cwd(), 'data', 'discord-bot.db');
    
    let size = '0 MB';
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
      size = `${sizeInMB} MB`;
    }
    
    return { size };
  } catch (error) {
    return { size: 'Unknown' };
  }
}

async function getCommandExecutionCount(): Promise<number> {
  try {
    // Get count from analytics or dashboard_logs
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM dashboard_logs 
      WHERE action_type LIKE '%command%' 
      AND created_at > datetime('now', '-24 hours')
    `);
    const result = stmt.get() as { count: number };
    return result.count || 0;
  } catch (error) {
    return 0;
  }
}

async function getMessagesProcessedCount(): Promise<number> {
  try {
    // Get from analytics if available
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM dashboard_logs 
      WHERE action_type = 'message_create' 
      AND created_at > datetime('now', '-24 hours')
    `);
    const result = stmt.get() as { count: number };
    return result.count || 0;
  } catch (error) {
    return 0;
  }
}

async function getCPUUsage(): Promise<number> {
  try {
    const usage = process.cpuUsage();
    const totalUsage = usage.user + usage.system;
    const percentage = Math.round((totalUsage / 1000000) * 100) / 100; // Convert to percentage
    return Math.min(percentage, 100); // Cap at 100%
  } catch (error) {
    return 0;
  }
}

function getLastRestartTime(): string {
  const startTime = Date.now() - (process.uptime() * 1000);
  return new Date(startTime).toISOString();
}

function getDiscordJsVersion(): string {
  try {
    const packageJson = require('../../package.json');
    return packageJson.dependencies['discord.js'] || 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

async function testDatabaseConnection(): Promise<boolean> {
  try {
    const stmt = db.prepare('SELECT 1');
    stmt.get();
    return true;
  } catch (error) {
    return false;
  }
}

export default router;