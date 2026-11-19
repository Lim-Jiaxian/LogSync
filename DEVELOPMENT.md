# Running LogSync

## Local development

Requires Node 22 or later. No database install is needed.

```bash
npm install
npm run server   # API on http://localhost:3000 (restarts when server files change)
npm run dev      # app on http://localhost:5173, with /api forwarded to the server
```

Without `DATABASE_URL`, the server uses **PGlite** (PostgreSQL compiled to WebAssembly), stored in `db/pglite/`. The first start creates the schema from `db/init_db.sql` and loads the demo data from `db/seed.sql`. Every account uses the password `demo1234`: the demo staff, for example `Aaron Fernandez` (SC) or `Grace Low` (IC), and the project team's own accounts at Sengkang (`user_id` 1–6). Only the rota on duty today can edit. The header shows which rota that is.

To use a real Postgres instead, set `DATABASE_URL` before `npm run server`. For a public Railway URL, append `?sslmode=no-verify`.

| Command | What it does |
| --- | --- |
| `npm run db:seed` | Reset to the demo data. Keeps accounts with `user_id < 100`, and adds the team accounts if they're missing. |
| `npm run db:migrate` | Create any missing tables without touching data. |
| `npm run build` then `npm start` | Run the production build: one server for the app and the API, on `PORT` (default 3000). |

## Deployment (Railway)

The app runs as one service (`railway.json`) next to a Railway Postgres:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (required; the server refuses to start on Railway without it) |
| `SEED_DEMO` | `false` to stop demo data loading into an empty database |
| `DEMO_LOGINS` | `false` to hide the one-tap demo accounts on the login page |

The health check is `GET /api/health`, which also checks the database connection.

## Progressive Web App

`vite-plugin-pwa` generates the service worker and manifest at build time (`vite.config.js`). Here's how the pieces work:

- **Precaching:** the service worker precaches the app shell. It never caches `/api` responses.
- **Offline:** the app keeps its own snapshot of the signed-in user's last data, and shows it read-only when offline. The snapshot is removed at logout.
- **Updates:** a new deploy installs in the background, and users get a "new version" bar rather than a surprise reload.
- **Icons:** they're in `public/`. The store-style screenshots in `public/screenshots/` appear in Chrome and Edge's install dialog.
