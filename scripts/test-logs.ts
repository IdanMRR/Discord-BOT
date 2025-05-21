import * as path from 'path';
import * as fs from 'fs';
import { Database } from 'better-sqlite3';

// Set test environment variables
process.env.NODE_ENV = 'test';
const TEST_DB_PATH = path.join(__dirname, '../data/test-db.sqlite');

// Ensure the test database directory exists
const testDataDir = path.join(__dirname, '../data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Create a mock ServerLogService for testing
class MockServerLogService {
  private db: Database;
  private logs: any[] = [];
  private nextId = 1;

  constructor(db: Database) {
    this.db = db;
  }

  async createLog(logData: any): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO server_logs (
        guild_id, action_type, user_id, channel_id, 
        message_id, target_id, reason, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const details = logData.details ? JSON.stringify(logData.details) : null;
    
    const result = stmt.run(
      logData.guild_id,
      logData.action_type,
      logData.user_id || null,
      logData.channel_id || null,
      logData.message_id || null,
      logData.target_id || null,
      logData.reason || null,
      details
    );

    return Number((result as any).lastInsertRowid);
  }

  getLogById(id: number): any | null {
    const stmt = this.db.prepare('SELECT * FROM server_logs WHERE id = ?');
    const log = stmt.get(id) as any;
    
    if (!log) return null;
    
    // Parse JSON details if they exist
    let parsedDetails = null;
    if (log.details) {
      try {
        parsedDetails = JSON.parse(log.details as string);
      } catch (e) {
        console.error('Error parsing log details:', e);
        parsedDetails = log.details;
      }
    }
    
    return {
      ...log,
      details: parsedDetails
    };
  }

  async getLogs(guildId: string, options: any = {}): Promise<{
    data: any[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM server_logs WHERE guild_id = ?';
    const params: any[] = [guildId];

    if (options.actionType) {
      query += ' AND action_type = ?';
      params.push(options.actionType);
    }

    if (options.userId) {
      query += ' AND user_id = ?';
      params.push(options.userId);
    }

    if (options.channelId) {
      query += ' AND channel_id = ?';
      params.push(options.channelId);
    }

    if (options.search) {
      query += ' AND (reason LIKE ? OR details LIKE ?)';
      const searchTerm = `%${options.search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Get total count for pagination
    const countStmt = this.db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as count'));
    const countResult = countStmt.get(...params) as { count: number } | undefined;
    const total = countResult?.count || 0;

    // Add sorting and pagination
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const logs = stmt.all(...params);

    // Parse JSON details if they exist
    const parsedLogs = logs.map((log: any) => {
      let parsedDetails = null;
      
      if (log.details) {
        try {
          parsedDetails = JSON.parse(log.details);
        } catch (e) {
          console.error('Error parsing log details:', e);
          parsedDetails = log.details;
        }
      }
      
      return {
        ...log,
        details: parsedDetails
      };
    });

    return {
      data: parsedLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

// Initialize test database
async function initializeTestDatabase() {
  const testDb = new (require('better-sqlite3'))(TEST_DB_PATH);
  
  try {
    // Enable foreign keys
    testDb.pragma('foreign_keys = ON');

    // Create the server_logs table
    const migrationPath = path.join(__dirname, '../src/database/migrations/001_create_logs_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL.split(';').filter(statement => statement.trim() !== '');
    for (const statement of statements) {
      if (statement.trim()) {
        testDb.prepare(statement).run();
      }
    }
    
    console.log('✅ Test database initialized successfully');
    return testDb;
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error);
    testDb.close();
    throw error;
  }
}

async function testLogs(db: Database) {
  // Create an instance of our mock service
  const logService = new MockServerLogService(db);
  
  try {
    console.log('Starting log service tests...');
    
    // Test 1: Create a log entry
    console.log('\nTest 1: Creating log entry...');
    const testLogData = {
      guild_id: 'test-guild-1',
      action_type: 'MESSAGE_DELETED',
      user_id: 'test-user-1',
      channel_id: 'test-channel-1',
      message_id: 'test-message-1',
      target_id: 'test-target-1',
      reason: 'Testing log creation',
      details: { 
        content: 'This is a test message',
        timestamp: new Date().toISOString()
      }
    };
    
    const logId = await logService.createLog(testLogData);
    console.log(`✅ Created log entry with ID: ${logId}`);

    // Test 2: Retrieve the log entry by ID
    console.log('\nTest 2: Retrieving log entry by ID...');
    const log = logService.getLogById(logId);
    if (!log) {
      throw new Error('Failed to retrieve log entry');
    }
    console.log('✅ Retrieved log entry:', JSON.stringify(log, null, 2));

    // Test 3: Retrieve logs with pagination
    console.log('\nTest 3: Retrieving logs with pagination...');
    const logs = await logService.getLogs('test-guild-1', {
      page: 1,
      limit: 10
    });
    
    if (logs.data.length === 0) {
      throw new Error('No logs found');
    }
    
    console.log(`✅ Retrieved ${logs.data.length} log(s)`);
    console.log('Pagination info:', JSON.stringify({
      page: logs.pagination.page,
      limit: logs.pagination.limit,
      total: logs.pagination.total,
      totalPages: logs.pagination.totalPages
    }, null, 2));

    // Test 4: Search logs
    console.log('\nTest 4: Searching logs...');
    const searchResults = await logService.getLogs('test-guild-1', {
      search: 'test',
      page: 1,
      limit: 5
    });
    
    console.log(`✅ Found ${searchResults.data.length} matching log(s)`);
    
    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Error testing logs:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the tests
async function runTests() {
  console.log('🚀 Starting test suite...');
  
  // Initialize test database
  const testDb = await initializeTestDatabase();
  
  if (!testDb) {
    console.error('❌ Failed to initialize test database');
    process.exit(1);
  }
  
  try {
    // Run the tests with the test database
    await testLogs(testDb);
    console.log('✨ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test suite failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    // Close the test database connection
    testDb.close();
    console.log('✅ Test database connection closed');
  }
}

// Start the tests
runTests();
