import { db } from './sqlite';
import { logInfo, logError } from '../utils/logger';

/**
 * Connect to the SQLite database
 * This is a placeholder function for API compatibility with the previous code
 * SQLite is already initialized when the db is imported
 */
export async function connectToDatabase(): Promise<void> {
  try {
    // SQLite is already initialized when imported
    // Just run a simple query to verify the connection
    const result = db.prepare('SELECT 1').get();
    
    if (result) {
      logInfo('Database', 'Connected to SQLite database successfully');
      return Promise.resolve();
    } else {
      const error = new Error('Failed to connect to SQLite database');
      logError('Database', error);
      return Promise.reject(error);
    }
  } catch (error) {
    logError('Database', error);
    return Promise.reject(error);
  }
}

/**
 * Disconnect from the database
 * This is a placeholder function for API compatibility with the previous code
 */
export async function disconnectFromDatabase(): Promise<void> {
  try {
    // SQLite doesn't require explicit disconnection
    // The connection will be closed when the process exits
    logInfo('Database', 'Disconnected from SQLite database successfully');
    return Promise.resolve();
  } catch (error) {
    logError('Database', error);
    return Promise.reject(error);
  }
}

/**
 * Get the SQLite database instance
 */
export function getDatabase() {
  return db;
}

// Export the getDatabase function as default
export default getDatabase;
