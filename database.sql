-- Lyrixa Database Schema
-- Categories and User Uploads Extension

-- Categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#c8451a',
    icon VARCHAR(20) DEFAULT '♪',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User uploaded lyrics
CREATE TABLE user_lyrics (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    filename VARCHAR(255),
    file_size INTEGER,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT true,
    created_by VARCHAR(100),
    is_favorite BOOLEAN DEFAULT false,
    INDEX idx_category (category_id),
    INDEX idx_title (title),
    INDEX idx_upload_date (upload_date),
    INDEX idx_favorite (is_favorite)
);

-- Insert default categories
INSERT INTO categories (name, color, icon) VALUES
('Pop', '#ff6b6b', 'music-note'),
('Jazz', '#4ecdc4', 'trumpet'),
('R&B', '#95e1d3', 'microphone'),
('Rap', '#f38181', 'mic-vocal'),
('Techno', '#a29bfe', 'piano');

-- API search cache (optional for performance)
CREATE TABLE api_cache (
    id SERIAL PRIMARY KEY,
    query_hash VARCHAR(64) UNIQUE NOT NULL,
    api_response JSONB,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hash (query_hash),
    INDEX idx_expires (expires_at)
);
