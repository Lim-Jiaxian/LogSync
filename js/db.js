// Database access. One small interface over two engines:
//   * DATABASE_URL set   -> PostgreSQL via node-postgres (Railway, or any Postgres you run)
//   * DATABASE_URL unset -> PGlite, real Postgres compiled to WebAssembly, stored in db/pglite/
//                           so local development needs no database install.
// Both speak the same SQL, so the app code never needs to know which one it is talking to.
//
//   db.query(sql, params) -> { rows }      db.exec(multiStatementSql)
//   db.tx(async (t) => { await t.query(...) })   commits, or rolls back if fn throws
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_PROJECT_ID);

export async function connect() {
  const url = process.env.DATABASE_URL;
  if (url) return connectPostgres(url);
  if (onRailway || process.env.NODE_ENV === "production")
    // Never fall back to a local file in production: it would be wiped on every redeploy.
    throw new Error("DATABASE_URL is not set. On Railway, add a variable DATABASE_URL = ${{Postgres.DATABASE_URL}}.");
  return connectPglite(process.env.PGLITE_DIR || path.join(ROOT, "db/pglite"));
}

function connectPostgres(url) {
  // For a public Railway URL from your own machine, append ?sslmode=no-verify.
  const pool = new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 });
  pool.on("error", (e) => console.error("Postgres connection error:", e.message));
  const client = (c) => ({ query: (sql, params) => c.query(sql, params), exec: (sql) => c.query(sql) });
  return {
    kind: "PostgreSQL",
    query: (sql, params) => pool.query(sql, params),
    exec: (sql) => pool.query(sql),
    tx: async (fn) => {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const result = await fn(client(c));
        await c.query("COMMIT");
        return result;
      } catch (e) {
        await c.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    },
    close: () => pool.end(),
  };
}

async function connectPglite(dir) {
  const { PGlite } = await import("@electric-sql/pglite"); // dev dependency, only loaded locally
  const inMemory = dir === "memory";
  if (!inMemory) fs.mkdirSync(dir, { recursive: true });
  const db = await PGlite.create(inMemory ? undefined : dir);
  return {
    kind: `PGlite (${inMemory ? "in memory" : path.relative(ROOT, dir) || dir})`,
    query: (sql, params) => db.query(sql, params),
    exec: (sql) => db.exec(sql),
    tx: (fn) => db.transaction((t) => fn({ query: (sql, params) => t.query(sql, params), exec: (sql) => t.exec(sql) })),
    close: () => db.close(),
  };
}

const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

// Create the schema (idempotent) and, when asked or when there are no users yet, load the demo seed.
// The advisory lock stops two instances racing during a rolling deploy.
export async function migrate(db, { seed = "if-empty" } = {}) {
  return db.tx(async (t) => {
    await t.query("SELECT pg_advisory_xact_lock(727274)");
    await t.exec(read("db/init_db.sql"));
    const empty = !(await t.query("SELECT 1 FROM users LIMIT 1")).rows.length;
    const run = seed === "always" || (seed === "if-empty" && empty);
    if (run) await t.exec(read("db/seed.sql"));
    return { seeded: run };
  });
}
