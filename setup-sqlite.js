#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Create SQLite database and initialize with schema
const db = new sqlite3.Database('./lyrixa_dev.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }

  console.log('✅ SQLite database created successfully');

  // Create tables
  const schema = `
    -- Categories table
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#c8451a',
      icon TEXT DEFAULT '♪',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- User uploaded lyrics
    CREATE TABLE IF NOT EXISTS user_lyrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category_id INTEGER,
      filename TEXT,
      file_size INTEGER,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_public BOOLEAN DEFAULT 1,
      created_by TEXT DEFAULT 'Erkan Aydogan',
      is_favorite INTEGER DEFAULT 0
    );

    -- Insert default categories
    INSERT OR IGNORE INTO categories (name, color, icon) VALUES
      ('Pop', '#ff6b6b', 'music-note'),
      ('Jazz', '#4ecdc4', 'trumpet'),
      ('R&B', '#95e1d3', 'microphone'),
      ('Rap', '#f38181', 'mic-vocal'),
      ('Techno', '#a29bfe', 'piano');
  `;

  db.exec(schema, (err) => {
    if (err) {
      console.error('Error creating tables:', err.message);
      process.exit(1);
    }

    console.log('✅ Database tables created successfully');
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
        process.exit(1);
      }
      console.log('✅ SQLite database setup complete!');
    });
  });
});
