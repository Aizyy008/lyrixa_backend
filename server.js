const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection - environment based
const isDevelopment = process.env.NODE_ENV === 'development';

// SQLite for development, PostgreSQL for production (Render)
let pool;
let dbType;

if (isDevelopment) {
  // SQLite setup for local development
  const sqlite3 = require('sqlite3').verbose();
  pool = new sqlite3.Database('./lyrixa_dev.db', (err) => {
    if (err) {
      console.error('SQLite connection error:', err.message);
      process.exit(1);
    }
    console.log('✅ SQLite database connected for development');
  });
  dbType = 'sqlite';
} else {
  // PostgreSQL setup for production (Render)
  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_PROD;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }
  
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  dbType = 'postgres';
  console.log('✅ PostgreSQL database connected for production');
}

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost on any port for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow configured frontend URL for production
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    
    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

// File upload configuration
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'), false);
    }
  }
});

// Helper function to execute queries for both DB types
function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'postgres') {
      // Convert ? placeholders to $1, $2, etc for PostgreSQL
      let pgSql = sql;
      let pgParams = params;
      if (sql.includes('?')) {
        let index = 1;
        pgSql = sql.replace(/\?/g, () => `$${index++}`);
      }
      pool.query(pgSql, pgParams)
        .then(result => resolve(result))
        .catch(err => reject(err));
    } else {
      // SQLite
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        pool.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      } else {
        pool.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ rows: [{ id: this.lastID }], rowCount: this.changes });
        });
      }
    }
  });
}

// Initialize database
async function initDB() {
  try {
    if (dbType === 'postgres') {
      // PostgreSQL initialization
      await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) UNIQUE NOT NULL,
          color VARCHAR(7) DEFAULT '#c8451a',
          icon VARCHAR(20) DEFAULT 'music-note',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_lyrics (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          category_id INTEGER REFERENCES categories(id),
          filename VARCHAR(255),
          file_size INTEGER,
          upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_public BOOLEAN DEFAULT true,
          created_by VARCHAR(100)
        )
      `);

      // Insert default categories if they don't exist
      const categories = [
        { name: 'Pop', color: '#ff6b6b', icon: 'music-note' },
        { name: 'Jazz', color: '#4ecdc4', icon: 'trumpet' },
        { name: 'R&B', color: '#95e1d3', icon: 'microphone' },
        { name: 'Rap', color: '#f38181', icon: 'mic-vocal' },
        { name: 'Techno', color: '#a29bfe', icon: 'piano' }
      ];

      for (const cat of categories) {
        await pool.query(
          'INSERT INTO categories (name, color, icon) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
          [cat.name, cat.color, cat.icon]
        );
      }

      console.log('✅ PostgreSQL database initialized successfully');
    } else {
      // SQLite is already initialized by setup-sqlite.js
      console.log('✅ SQLite database ready (initialized by setup script)');
    }
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// API Routes

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await dbQuery('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user uploaded lyrics
app.get('/api/user-lyrics', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT ul.id, ul.title, ul.content, ul.category_id, ul.filename, ul.file_size, ul.upload_date, ul.created_by, c.name as category_name, c.color as category_color, c.icon as icon FROM user_lyrics ul LEFT JOIN categories c ON ul.category_id = c.id WHERE ul.is_public = 1';
    const params = [];

    if (category) {
      query += ' AND c.name = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (ul.title LIKE ? OR ul.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY ul.upload_date DESC';

    const result = await dbQuery(query, params);
    
    // Map to consistent format
    const formatted = result.rows.map(row => ({
      id: row.id,
      trackName: row.title,
      artistName: row.created_by || 'Unknown Artist',
      albumName: row.filename || 'User Upload',
      plainLyrics: row.content,
      syncedLyrics: null,
      instrumental: false,
      source: 'upload',
      category_name: row.category_name,
      category_color: row.category_color,
      icon: row.icon,
      duration: null,
      upload_date: row.upload_date
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload lyrics
app.post('/api/upload', upload.single('lyrics'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, category, createdBy } = req.body;
    const content = fs.readFileSync(req.file.path, 'utf8');
    
    console.log('📤 Upload received:', {
      title,
      category,
      contentLength: content.length,
      filename: req.file.originalname
    });
    
    // Auto-detect title from filename if not provided
    const finalTitle = title || path.parse(req.file.originalname).name.replace('.txt', '');

    // Get category ID
    let categoryId = null;
    if (category) {
      const catResult = await dbQuery('SELECT id FROM categories WHERE name = ?', [category]);
      if (catResult.rows.length > 0) {
        categoryId = catResult.rows[0].id;
      }
    }

    const result = await dbQuery(
      'INSERT INTO user_lyrics (title, content, category_id, filename, file_size, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [finalTitle, content, categoryId, req.file.originalname, req.file.size, createdBy || 'Anonymous']
    );

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Get the inserted ID (works for both SQLite and PostgreSQL)
    const insertedId = result.rows[0].id;
    
    // Return the inserted record with full details
    const inserted = await dbQuery(
      'SELECT ul.*, c.name as category_name, c.color as category_color, c.icon as icon FROM user_lyrics ul LEFT JOIN categories c ON ul.category_id = c.id WHERE ul.id = ?', 
      [insertedId]
    );
    
    console.log('✅ Upload successful:', inserted.rows[0]);
    res.json(inserted.rows[0]);
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search combined (API + user uploads)
app.get('/api/search', async (req, res) => {
  try {
    const { q, category, source } = req.query;
    const results = [];

    console.log('🔍 Search request:', { q, category, source });

    // Search user uploads
    if (!source || source === 'uploads' || source === 'all') {
      let uploadQuery = 'SELECT ul.id, ul.title, ul.content, ul.category_id, ul.filename, ul.file_size, ul.upload_date, ul.created_by, c.name as category_name, c.color as category_color, c.icon as icon FROM user_lyrics ul LEFT JOIN categories c ON ul.category_id = c.id WHERE ul.is_public = 1';
      const uploadParams = [];

      if (q && q.trim()) {
        uploadQuery += ' AND (ul.title LIKE ? OR ul.content LIKE ?)';
        uploadParams.push(`%${q}%`, `%${q}%`);
      }

      if (category && category.trim()) {
        uploadQuery += ' AND c.name = ?';
        uploadParams.push(category);
      }

      uploadQuery += ' ORDER BY ul.upload_date DESC LIMIT 20';

      const uploadResults = await dbQuery(uploadQuery, uploadParams);
      
      // Map database fields to match API format
      uploadResults.rows.forEach(row => {
        results.push({
          id: row.id,
          trackName: row.title,
          artistName: row.created_by || 'Unknown Artist',
          albumName: row.filename || 'User Upload',
          plainLyrics: row.content,
          syncedLyrics: null,
          instrumental: false,
          source: 'upload',
          category_name: row.category_name,
          category_color: row.category_color,
          icon: row.icon,
          duration: null
        });
      });
      
      console.log(`✅ Found ${uploadResults.rows.length} uploads`);
    }

    // Search LRCLIB API
    if (!source || source === 'api' || source === 'all') {
      if (q && q.trim()) {
        try {
          const lrclibResponse = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
          if (lrclibResponse.ok) {
            const apiResults = await lrclibResponse.json();
            if (Array.isArray(apiResults)) {
              apiResults.forEach(item => {
                results.push({
                  ...item,
                  source: 'api',
                  category_name: null,
                  category_color: null,
                  icon: null
                });
              });
            }
            console.log(`✅ Found ${apiResults.length} API results`);
          }
        } catch (apiError) {
          console.error('LRCLIB API error:', apiError);
        }
      }
    }

    console.log(`📊 Total results: ${results.length}`);
    res.json(results.slice(0, 20)); // Limit total results
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Server running on port ${PORT}`);
});
