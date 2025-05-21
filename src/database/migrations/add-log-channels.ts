import { RunResult } from 'sqlite3';
import { db } from '../sqlite';

export async function up() {
  return new Promise<void>((resolve, reject) => {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS log_channels (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run((err: Error | null) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function down() {
  return new Promise<void>((resolve, reject) => {
    db.prepare('DROP TABLE IF EXISTS log_channels').run((err: Error | null) => {
      if (err) return reject(err);
      resolve();
    });
  });
}
