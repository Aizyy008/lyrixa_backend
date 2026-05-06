# Lyrixa Backend

Express.js backend API for Lyrixa lyrics search application.

## Features

- RESTful API endpoints
- PostgreSQL (production) / SQLite (development)
- File upload support (.txt lyrics)
- Category management
- Combined search (API + user uploads)

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Database

```bash
# Initialize SQLite database
node setup-sqlite.js
```

### 3. Configure Environment

```bash
# .env file is already created
# Edit if needed
```

### 4. Start Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server runs on: http://localhost:3000

## Deployment to Render

### 1. Create PostgreSQL Database

1. Go to https://dashboard.render.com/
2. Click "New" → "PostgreSQL"
3. Configure:
   - **Name**: `lyrixa-db`
   - **Database**: `lyrixa_prod`
   - **User**: `lyrixa_user`
   - **Region**: Choose closest
   - **Plan**: Free or Starter
4. Click "Create Database"
5. **Copy the Internal Database URL**

### 2. Initialize Database Schema

```bash
# Connect to Render PostgreSQL
psql <your-internal-database-url>

# Run schema
\i database.sql

# Verify
\dt

# Exit
\q
```

### 3. Deploy Backend

1. Push this folder to GitHub
2. In Render Dashboard, click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `lyrixa-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free or Starter

5. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = (paste your PostgreSQL Internal URL)
   - `FRONTEND_URL` = `https://your-vercel-app.vercel.app`
   - `PORT` = `3000`

6. Click "Create Web Service"

### 4. Get Your Backend URL

After deployment completes, your backend URL will be:
```
https://lyrixa-api.onrender.com
```

Copy this URL and update it in your frontend's `index.html`.

## API Endpoints

### Categories
```bash
GET /api/categories
```

### Search
```bash
GET /api/search?q=song&category=Pop&source=all
```

### User Lyrics
```bash
GET /api/user-lyrics?category=Jazz&search=love
```

### Upload
```bash
POST /api/upload
Content-Type: multipart/form-data

Fields:
- lyrics: .txt file
- title: string (optional)
- category: string (optional)
- createdBy: string (optional)
```

## Environment Variables

| Variable | Development | Production | Description |
|----------|-------------|------------|-------------|
| `NODE_ENV` | `development` | `production` | Environment mode |
| `DATABASE_URL` | (auto SQLite) | PostgreSQL URL | Database connection |
| `FRONTEND_URL` | `http://localhost:3000` | Vercel URL | CORS origin |
| `PORT` | `3000` | `3000` | Server port |

## Database

- **Development**: SQLite (`lyrixa_dev.db`)
- **Production**: PostgreSQL (Render)

The server automatically switches based on `NODE_ENV`.

## Files

- `server.js` - Express server
- `package.json` - Dependencies
- `database.sql` - PostgreSQL schema
- `setup-sqlite.js` - SQLite setup script
- `render.yaml` - Render configuration
- `.env.example` - Environment template
- `.env` - Local environment (not committed)
