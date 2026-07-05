# Cortex

A full-stack knowledge workspace app with an Express API, React client, PostgreSQL persistence, JWT auth, workspace management, document ingestion, and usage-limit groundwork for AI queries.

## Team Workflow

If multiple people are working on this repo, keep `main` stable and use task branches plus pull requests for all changes. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full 2-person workflow, branch rules, issue usage, PR checklist, and recommended GitHub branch protection settings.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 15 or newer
- Google Cloud OAuth credentials for Google login

On Windows, `psql` may not be on your PATH after installing PostgreSQL. If PowerShell says `psql` is not recognized, use the full binary path:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" "postgresql://postgres:<password>@localhost:5432/cortex_db"
```

## Project Structure

```text
cortex/
|-- server/
|   |-- src/
|   |   |-- config/
|   |   |   |-- db.js
|   |   |   |-- limits.js
|   |   |   |-- passport.js
|   |   |   `-- validateEnv.js
|   |   |-- controllers/
|   |   |-- middleware/
|   |   |-- routes/
|   |   |-- schemas/
|   |   |-- services/
|   |   |-- utils/
|   |   `-- app.js
|   `-- package.json
|-- client/
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   |-- pages/
|   |   |-- App.jsx
|   |   `-- main.jsx
|   `-- package.json
|-- .gitignore
`-- README.md
```

## Environment Variables

Create `server/.env`.

| Variable | Description | Example |
| --- | --- | --- |
| `PORT` | Port used by the Express API | `5000` |
| `DATABASE_URL` | PostgreSQL connection string for `cortex_db` | `postgresql://user:password@localhost:5432/cortex_db` |
| `NODE_ENV` | Runtime environment. Use `development` locally. | `development` |
| `CLIENT_URL` | React dev server origin allowed by CORS and OAuth redirects | `http://localhost:5173` |
| `ACCESS_TOKEN_SECRET` | Secret used to sign short-lived access JWTs | `replace-with-a-long-random-access-token-secret` |
| `REFRESH_TOKEN_SECRET` | Secret used to hash refresh tokens before storage | `replace-with-a-long-random-refresh-token-secret` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Number of days before refresh tokens expire | `7` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `your-google-client-id` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `your-google-client-secret` |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL registered in Google Cloud | `http://localhost:5000/api/auth/google/callback` |
| `OPENAI_API_KEY` | OpenAI API key used to create embeddings | `your_openai_key` |
| `QDRANT_URL` | Qdrant Cloud cluster URL | `https://your-cluster.qdrant.io` |
| `QDRANT_API_KEY` | Qdrant API key used for vector storage | `your_qdrant_api_key` |
| `QDRANT_COLLECTION` | Qdrant collection for document chunk vectors | `cortex_chunks` |
| `EMBEDDING_MODEL` | OpenAI embedding model name | `text-embedding-3-small` |
| `EMBEDDING_DIMENSION` | Vector size for the embedding model | `1536` |

Create `client/.env`.

| Variable | Description | Example |
| --- | --- | --- |
| `VITE_API_URL` | Base URL for API requests from React | `http://localhost:5000/api` |

For local Google OAuth, configure the Google Cloud OAuth client with:

| Google Cloud field | Value |
| --- | --- |
| Authorized JavaScript origins | `http://localhost:5173` |
| Authorized redirect URIs | `http://localhost:5000/api/auth/google/callback` |

## Database Setup

Create and connect to the database:

```sql
CREATE DATABASE cortex_db;
\c cortex_db
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Run the current manual schema:

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

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_plan_check;

ALTER TABLE users
  ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'pro'));

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS document_count INTEGER DEFAULT 0;

ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_mode_check;

ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_mode_check
  CHECK (mode IN ('general', 'developer', 'creative'));

CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  page_count INTEGER,
  chunk_count INTEGER DEFAULT 0,
  embedded_chunk_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT documents_status_check
    CHECK (status IN ('pending', 'processing', 'ready', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_documents_workspace_id ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  page_number INTEGER,
  is_embedded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_workspace_id ON chunks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_chunks_is_embedded ON chunks(is_embedded);

CREATE TABLE IF NOT EXISTS user_query_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  query_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_user_query_usage_user_date
  ON user_query_usage(user_id, usage_date);
```

`ON DELETE CASCADE` keeps child data from becoming orphaned. For example, deleting a user removes that user's workspaces, documents, chunks, refresh tokens, and query-usage rows.

## Server Setup

```bash
cd server
npm install
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

Run server tests:

```bash
cd server
npm test
```

## Client Setup

```bash
cd client
npm install
npm run dev
```

The React app runs at `http://localhost:5173`.

Build the client:

```bash
cd client
npm run build
```

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

## Auth API

Access tokens are returned in JSON and kept in client memory. Refresh tokens are stored only as httpOnly cookies, and only an HMAC-SHA256 hash of each refresh token is stored in PostgreSQL.

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

## Workspace API

All workspace routes require `Authorization: Bearer <accessToken>`.

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/workspaces` | Create a workspace |
| `GET` | `/api/workspaces` | List current user's workspaces |
| `GET` | `/api/workspaces/:id` | Get one workspace owned by the current user |
| `PATCH` | `/api/workspaces/:id` | Rename or update a workspace |
| `DELETE` | `/api/workspaces/:id` | Delete a workspace |

Workspace `mode` must be one of `general`, `developer`, or `creative`. Cross-user access returns `404` so the API does not reveal whether another user's workspace exists.

## Document API

All document routes require `Authorization: Bearer <accessToken>`.

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/workspaces/:workspaceId/documents` | Upload one PDF and start async ingestion |
| `GET` | `/api/workspaces/:workspaceId/documents` | List documents in a workspace |
| `GET` | `/api/workspaces/:workspaceId/documents/:id` | Poll one document status |
| `DELETE` | `/api/workspaces/:workspaceId/documents/:id` | Delete one document |

Upload constraints:

- PDF only
- One file per request
- 10 MB maximum file size
- Optional multipart field: `name`

Example upload:

```bash
curl -X POST http://localhost:5000/api/workspaces/<workspaceId>/documents \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@/path/to/test.pdf" \
  -F "name=Test Document"
```

The upload route returns `202 Accepted` immediately:

```json
{
  "documentId": "document-uuid",
  "status": "pending",
  "message": "Document received, processing started"
}
```

Poll until the document status becomes `ready` or `failed`:

```bash
curl http://localhost:5000/api/workspaces/<workspaceId>/documents/<documentId> \
  -H "Authorization: Bearer <accessToken>"
```

Verify stored chunks with `psql`:

```sql
SELECT
  chunk_index,
  token_count,
  is_embedded,
  LEFT(content, 80) as content_preview
FROM chunks
WHERE document_id = '<documentId>'
ORDER BY chunk_index;
```

## Usage Limits

AI query limits are enforced per user per day from PostgreSQL. Use `consumeDailyQueryQuota(userId)` in server code immediately before any Claude API call, or mount `checkQueryLimit` before an AI route handler. When the daily limit is exceeded, the API returns `429 Too Many Requests`.

Current hard limits:

| Plan | Queries per day | Documents per month | Chunks per document |
| --- | ---: | ---: | ---: |
| `free` | 10 | 5 | 100 |
| `pro` | 100 | 50 | 500 |

Set a hard spending cap in the Anthropic dashboard during development. A small cap, such as `$20/month`, protects the project from accidental high-volume API usage.

## Client Pages

- `/` shows API/database health.
- `/register` creates an account and moves to the dashboard.
- `/login` authenticates with email/password or Google OAuth.
- `/dashboard` manages workspaces and uploads/list documents.

The client keeps access tokens in React state and uses the httpOnly refresh cookie for refresh-token rotation. Do not store tokens in `localStorage`.
