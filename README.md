# Cortex

A clean Express, React, and PostgreSQL scaffold with a database-backed health check.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 15 or newer

## Project Structure

```text
cortex/
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── routes/
│   │   │   └── health.js
│   │   ├── middleware/
│   │   │   └── errorHandler.js
│   │   └── app.js
│   ├── .env
│   ├── .env.example
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   └── Home.jsx
│   │   ├── api/
│   │   │   └── axiosInstance.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   └── package.json
├── .gitignore
└── README.md
```

## Environment Variables

### Server

Create `server/.env` from `server/.env.example`.

| Variable | Description | Example |
| --- | --- | --- |
| `PORT` | Port used by the Express API | `5000` |
| `DATABASE_URL` | PostgreSQL connection string for `cortex_db` | `postgresql://user:password@localhost:5432/cortex_db` |
| `NODE_ENV` | Runtime environment. Use `development` locally. | `development` |
| `CLIENT_URL` | React dev server origin allowed by CORS | `http://localhost:5173` |

### Client

Create `client/.env`.

| Variable | Description | Example |
| --- | --- | --- |
| `VITE_API_URL` | Base URL for API requests from React | `http://localhost:5000/api` |

## Database Setup

Create the database:

```sql
CREATE DATABASE cortex_db;
```

Connect to `cortex_db`, then run the schema:

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255),
  google_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

If `gen_random_uuid()` is unavailable in your PostgreSQL install, enable `pgcrypto` inside `cortex_db`:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

`ON DELETE CASCADE` means deleting a user automatically deletes that user's workspaces, preventing orphaned workspace records.

## Server Setup

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

The API runs at `http://localhost:5000`.

Health check:

```bash
curl http://localhost:5000/api/health
```

Expected connected response:

```json
{
  "status": "ok",
  "timestamp": "2026-06-25T00:00:00.000Z",
  "db": "connected"
}
```

If PostgreSQL becomes unreachable after startup, `/api/health` returns status code `503` with `db: "disconnected"`.

If `DATABASE_URL` is wrong at startup, the server exits with code `1`.

## Client Setup

```bash
cd client
npm install
npm run dev
```

The React app runs at `http://localhost:5173`.

The home page calls `GET /api/health` through `src/api/axiosInstance.js` and shows a green indicator when the API and database are connected, or red when unavailable.

## Run Both Concurrently

Use two terminals:

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

On Windows PowerShell, you can also start both from the project root:

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd client; npm run dev"
```
