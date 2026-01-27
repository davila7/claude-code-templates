import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../todos.db');

const db = new sqlite3.Database(dbPath, (err: Error | null) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Initialize database schema
export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, (err: Error | null) => {
      if (err) {
        reject(err);
      } else {
        console.log('Database schema initialized');
        resolve();
      }
    });
  });
};

export default db;
