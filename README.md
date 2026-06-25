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
| `ACCESS_TOKEN_SECRET` | Secret used to sign short-lived access JWTs | `replace-with-a-long-random-access-token-secret` |
| `REFRESH_TOKEN_SECRET` | Secret used to hash refresh tokens before storage | `replace-with-a-long-random-refresh-token-secret` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Number of days before refresh tokens expire | `7` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `your-google-client-id` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `your-google-client-secret` |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL registered in Google Cloud | `http://localhost:5000/api/auth/google/callback` |

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

Assignment 2 adds refresh token rotation support:

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id
  ON users(google_id);
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

## Auth API

Access tokens are returned in JSON and should be kept in memory by the client. Refresh tokens are stored only as httpOnly cookies, and only an HMAC-SHA256 hash of each refresh token is stored in PostgreSQL.

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a user, set refresh cookie, return access token |
| `POST` | `/api/auth/login` | Verify credentials, set refresh cookie, return access token |
| `POST` | `/api/auth/refresh` | Rotate refresh token and return a new access token |
| `POST` | `/api/auth/logout` | Delete the current refresh token and clear the cookie |
| `POST` | `/api/auth/logout-all` | Protected route that deletes all refresh tokens for the user |
| `GET` | `/api/auth/me` | Protected route that returns the current user |
| `GET` | `/api/auth/google` | Start Google OAuth |
| `GET` | `/api/auth/google/callback` | Google OAuth callback |

## Usage Limits

AI query limits are enforced per user per day from PostgreSQL. Use `consumeDailyQueryQuota(userId)` in server code immediately before any Claude API call, or mount `checkQueryLimit` before an AI route handler. When the daily limit is exceeded, the API returns `429 Too Many Requests`.

Current hard limits:

| Plan | Queries per day | Documents per month | Chunks per document |
| --- | ---: | ---: | ---: |
| `free` | 10 | 5 | 100 |
| `pro` | 100 | 50 | 500 |

## Client Setup

```bash
cd client
npm install
npm run dev
```

The React app runs at `http://localhost:5173`.

The home page calls `GET /api/health` through `src/api/axiosInstance.js` and shows a green indicator when the API and database are connected, or red when unavailable.

Auth pages:

- `/register` creates an account and moves to the dashboard.
- `/login` authenticates with email/password or Google OAuth.
- `/dashboard` calls `/api/auth/me` with the in-memory access token and attempts `/api/auth/refresh` if needed.

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
