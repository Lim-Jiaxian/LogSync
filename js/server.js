import express from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { connect, migrate, ROOT } from "./db.js";

/* ---------- config (Railway sets PORT and, via a reference variable, DATABASE_URL) ---------- */
const PORT = Number(process.env.PORT) || 3000;
const DIST = path.join(ROOT, "dist");

/* ---------- database: create the schema, seed demo data into an empty database ---------- */
const db = await connect();
const { seeded } = await migrate(db, { seed: process.env.SEED_DEMO === "false" ? "never" : "if-empty" });
console.log(`Database: ${db.kind}${seeded ? " (empty, so demo data from db/seed.sql was loaded)" : ""}`);

/* ---------- constants ---------- */
const STATUSES = ["ON_APPLIANCE", "STORE", "SERVICING", "LOANED_OUT", "MISSING", "OTHER"];
const RESULTS = ["OK", "MISSING", "FAULTY", "QTY_MISMATCH"];
const SESSION_MS = 24 * 36e5; // one duty day
const REMEMBER_MS = 30 * 864e5; // "Remember me" (and the installed app)
const MAX_FILE = 10 * 1024 * 1024;

/* ---------- duty rota (decided by the server, so it can't be faked) ---------- */
// Rotas run in descending order: 3, 2, 1, 3, ... from the anchor date.
const ROTA_ANCHOR = { date: "2026-11-18", rota: 3 }; // from 08:00 on this date
const ROTA_COUNT = 3,
  HANDOVER_HOUR = 8,
  UTC_OFFSET = 8; // Singapore = UTC+8
const dutyRota = (now = Date.now()) => {
  const t = new Date(now + (UTC_OFFSET - HANDOVER_HOUR) * 36e5);
  const [y, m, d] = ROTA_ANCHOR.date.split("-").map(Number);
  const days = Math.round(
    (Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - Date.UTC(y, m - 1, d)) / 864e5,
  );
  return ((((ROTA_ANCHOR.rota - 1 - days) % ROTA_COUNT) + ROTA_COUNT) % ROTA_COUNT) + 1;
};

/* ---------- helpers ---------- */
const fail = (status, message) => Object.assign(new Error(message), { status });
const str = (v) => (typeof v === "string" ? v.trim() : "");
const opt = (v) => str(v) || null;
const intId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
};
const sha = (s) => crypto.createHash("sha256").update(s).digest();
const tokenHash = (t) => sha(t).toString("hex");
const bearer = (req) => (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
const rows = async (q, sql, params) => (await q.query(sql, params)).rows;
const row = async (q, sql, params) => (await q.query(sql, params)).rows[0];
// Timestamps are stored in UTC; the screens show Singapore time as "YYYY-MM-DD HH:MM:SS".
const sgt = (col) => `to_char((${col} AT TIME ZONE 'UTC') + interval '8 hours', 'YYYY-MM-DD HH24:MI:SS')`;

// Map database errors (by Postgres SQLSTATE) to messages people can act on.
const dbError = (e) => {
  if (e.code === "23505") {
    if (e.constraint === "service_requests_one_open") return [409, "This item is already out for servicing."];
    if (e.constraint === "equipment_serial_number_key") return [409, "That serial number is already registered."];
    return [409, "That already exists."];
  }
  if (String(e.code).startsWith("23")) return [400, "That change isn’t allowed."];
  if (String(e.code).startsWith("22")) return [400, "Some of the values entered aren’t valid."];
  return null;
};

// Wrap a handler: known errors become clean messages, the rest are logged and hidden.
const h = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    const mapped = dbError(e);
    if (!mapped || mapped[0] >= 500) console.error(e);
    const [status, message] = mapped || [500, "Something went wrong on the server."];
    res.status(status).json({ message });
  }
};

// Equipment at the user's station. forUpdate locks the row until the transaction ends,
// so two people changing the same item at once can't overwrite each other.
const ownEquipment = async (q, id, user, forUpdate = false) => {
  const eid = intId(id);
  const eq =
    eid &&
    (await row(
      q,
      `SELECT * FROM equipment WHERE equipment_id = $1 AND station_id = $2${forUpdate ? " FOR UPDATE" : ""}`,
      [eid, user.station_id],
    ));
  if (!eq) throw fail(404, "Equipment not found at your station.");
  return eq;
};
const ownAppliance = async (q, callsign, user) => {
  if (!callsign || !(await row(q, "SELECT 1 FROM appliances WHERE callsign = $1 AND station_id = $2", [callsign, user.station_id])))
    throw fail(400, "Appliance not found at your station.");
  return callsign;
};
const logChange = (q, eid, from, to, by, note) =>
  q.query(
    "INSERT INTO equipment_log (equipment_id, from_status, to_status, changed_by, note) VALUES ($1,$2,$3,$4,$5)",
    [eid, from, to, by, note || null],
  );

/* ---------- sessions and permissions ---------- */
const auth = h(async (req, res, next) => {
  const token = bearer(req);
  const user =
    token &&
    (await row(
      db,
      `SELECT u.user_id, u.username, u.role, u.station_id, u.rota
       FROM sessions s JOIN users u ON u.user_id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash(token)],
    ));
  if (!user) return res.status(401).json({ message: "Please log in again." });
  req.user = user;
  next();
});
const needRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role) ? next() : res.status(403).json({ message: "Your role can’t do this." });
const needDuty = (req, res, next) =>
  req.user.rota === dutyRota()
    ? next()
    : res.status(403).json({ message: "Editing is open only on your rota’s duty day." });

/* ---------- uploads ---------- */
const ALLOWED_TYPES = {
  pv_fault: ["image/jpeg", "image/png", "video/mp4", "video/quicktime"],
  l_d: ["image/jpeg", "image/png", "application/pdf"],
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE, files: 2 },
  fileFilter: (req, file, cb) =>
    ALLOWED_TYPES[file.fieldname]?.includes(file.mimetype)
      ? cb(null, true)
      : cb(fail(400, "Unsupported file format.")),
});
const serviceUpload = (req, res, next) =>
  upload.fields([
    { name: "pv_fault", maxCount: 1 },
    { name: "l_d", maxCount: 1 },
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError)
      return res.status(400).json({
        message: err.code === "LIMIT_FILE_SIZE" ? "Each attachment must not exceed 10 MB." : err.message,
      });
    if (err) return res.status(err.status || 400).json({ message: err.message });
    next();
  });

/* ---------- app ---------- */
const app = express();
app.disable("x-powered-by");
app.use(express.json());

app.get(
  "/api/health",
  h(async (req, res) => {
    await db.query("SELECT 1");
    res.json({ ok: true });
  }),
);

/* ---------- login / logout ---------- */
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
const isBcrypt = (s) => /^\$2[aby]\$\d{2}\$/.test(s);

app.post(
  "/api/login",
  h(async (req, res) => {
    const { username, password, remember } = req.body ?? {};
    const name = str(username);
    const pass = typeof password === "string" ? password : "";
    if (!name || !pass) throw fail(400, "Please enter your username and password.");

    const user = await row(
      db,
      "SELECT user_id, username, role, station_id, rota, password FROM users WHERE username = $1",
      [name],
    );
    const stored = user?.password || "";
    let ok = false;
    if (isBcrypt(stored)) {
      ok = await bcrypt.compare(pass, stored);
    } else if (stored) {
      // Plaintext from seed data: compare in constant time, then replace it with a hash.
      ok = crypto.timingSafeEqual(sha(pass), sha(stored));
      if (ok) await db.query("UPDATE users SET password = $1 WHERE user_id = $2", [await bcrypt.hash(pass, 10), user.user_id]);
    } else {
      await bcrypt.compare(pass, DUMMY_HASH); // same work as a real check, so timing doesn't reveal unknown users
    }
    // One message for both cases, so the response doesn't reveal which usernames exist.
    if (!ok) throw fail(401, "Invalid username or password.");

    await db.query("DELETE FROM sessions WHERE expires_at <= now()");
    const token = crypto.randomBytes(32).toString("base64url");
    await db.query(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + $3::double precision * interval '1 millisecond')",
      [tokenHash(token), user.user_id, remember ? REMEMBER_MS : SESSION_MS],
    );
    const { password: _omit, ...safe } = user;
    res.json({ success: true, message: "Login successful!", token, user: safe });
  }),
);

app.post(
  "/api/logout",
  h(async (req, res) => {
    const token = bearer(req);
    if (token) await db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
    res.json({ success: true });
  }),
);

/* ---------- everything the screen needs, for the user's own station ---------- */
const DATA_QUERIES = {
  stations: "SELECT id, division, name FROM stations WHERE id = $1",
  users: "SELECT user_id, username, role, rota FROM users WHERE station_id = $1 ORDER BY username",
  appliances: "SELECT callsign, station_id, type FROM appliances WHERE station_id = $1 ORDER BY callsign",
  equipment:
    "SELECT equipment_id, serial_number, name, station_id, appliance, status, notes FROM equipment WHERE station_id = $1 ORDER BY name, equipment_id",
  checklist:
    "SELECT c.id, c.appliance, c.locker, c.kit, c.label, c.what_to_check, c.expected_qty FROM checklist_items c JOIN appliances a ON a.callsign = c.appliance WHERE a.station_id = $1 ORDER BY c.sort_order, c.id",
  log: `SELECT l.id, l.equipment_id, l.from_status, l.to_status, l.changed_by, l.note, ${sgt("l.changed_at")} AS changed_at FROM equipment_log l JOIN equipment e ON e.equipment_id = l.equipment_id WHERE e.station_id = $1 ORDER BY l.id`,
  hoto: `SELECT r.id, r.appliance, r.rota, r.completed_by, ${sgt("r.completed_at")} AS completed_at FROM hoto_records r JOIN appliances a ON a.callsign = r.appliance WHERE a.station_id = $1 ORDER BY r.id`,
  service: `SELECT s.id, s.equipment_id, s.requested_by, s.fault_description, s.status, s.serial_number, s.material_number, s.fixed_asset_id, s.ats_id, s.nsf_id, s.sto_number, s.is_number, ${sgt("s.submitted_at")} AS submitted_at, ${sgt("s.closed_at")} AS closed_at FROM service_requests s JOIN equipment e ON e.equipment_id = s.equipment_id WHERE e.station_id = $1 ORDER BY s.id`,
};

app.get(
  "/api/data",
  auth,
  h(async (req, res) => {
    const keys = Object.keys(DATA_QUERIES);
    const results = await Promise.all(keys.map((k) => rows(db, DATA_QUERIES[k], [req.user.station_id])));
    res.set("Cache-Control", "no-store");
    res.json({ me: req.user, dutyRota: dutyRota(), ...Object.fromEntries(keys.map((k, i) => [k, results[i]])) });
  }),
);

/* ---------- FF, SC, IC (duty day only) ---------- */
app.post(
  "/api/hoto",
  auth,
  needDuty,
  h(async (req, res) => {
    const { appliance, results } = req.body ?? {};
    await ownAppliance(db, appliance, req.user);
    if (!Array.isArray(results)) throw fail(400, "Checklist results are missing.");

    const expected = new Set(
      (await rows(db, "SELECT id FROM checklist_items WHERE appliance = $1", [appliance])).map((r) => r.id),
    );
    if (!expected.size) throw fail(400, "This appliance has no checklist.");
    const seen = new Set();
    for (const r of results) {
      const id = intId(r?.item_id);
      if (!expected.has(id)) throw fail(400, "Checklist item doesn’t belong to this appliance.");
      if (seen.has(id)) throw fail(400, "A checklist item was answered twice.");
      if (!RESULTS.includes(r.result)) throw fail(400, "Unknown checklist result.");
      seen.add(id);
    }
    if (seen.size !== expected.size)
      throw fail(400, "Every checklist item needs a result. The checklist may have changed: reload and try again.");

    await db.tx(async (t) => {
      const rec = await row(
        t,
        "INSERT INTO hoto_records (appliance, rota, completed_by) VALUES ($1,$2,$3) RETURNING id",
        [appliance, req.user.rota, req.user.user_id],
      );
      // One statement for the whole checklist instead of one round trip per item.
      await t.query(
        `INSERT INTO hoto_results (record_id, item_id, result, note)
         SELECT $1, u.item_id, u.result, u.note FROM unnest($2::int[], $3::text[], $4::text[]) AS u(item_id, result, note)`,
        [rec.id, results.map((r) => intId(r.item_id)), results.map((r) => r.result), results.map((r) => opt(r.note))],
      );
    });
    res.json({ success: true });
  }),
);

app.post(
  "/api/equipment/:id/status",
  auth,
  needDuty,
  h(async (req, res) => {
    const { to_status, appliance: wanted, note } = req.body ?? {};
    if (!STATUSES.includes(to_status)) throw fail(400, "Unknown status.");
    if (to_status === "SERVICING") throw fail(400, "Use “Send for servicing” so the fault is recorded.");

    await db.tx(async (t) => {
      const eq = await ownEquipment(t, req.params.id, req.user, true);
      const appliance = to_status === "ON_APPLIANCE" ? await ownAppliance(t, str(wanted) || eq.appliance, req.user) : null;
      if (to_status === eq.status && appliance === eq.appliance) throw fail(400, "Nothing to change.");

      const where = appliance && appliance !== eq.appliance ? "On " + appliance : "";
      await logChange(t, eq.equipment_id, eq.status, to_status, req.user.user_id, [where, str(note)].filter(Boolean).join(": "));
      await t.query("UPDATE equipment SET status = $1, appliance = $2 WHERE equipment_id = $3", [
        to_status,
        appliance,
        eq.equipment_id,
      ]);
      // Leaving SERVICING means the item is back (or written off): close its open request.
      if (eq.status === "SERVICING")
        await t.query(
          "UPDATE service_requests SET status = 'CLOSED', closed_at = now() WHERE equipment_id = $1 AND status = 'SUBMITTED'",
          [eq.equipment_id],
        );
    });
    res.json({ success: true });
  }),
);

/* ---------- SC and IC (duty day only, like every other status change) ---------- */
app.post(
  "/api/service",
  auth,
  needRole("SC", "IC"),
  needDuty,
  serviceUpload,
  h(async (req, res) => {
    const b = req.body ?? {};
    const fault = str(b.fault_description);
    if (!fault) throw fail(400, "Please describe the fault.");
    if (!str(b.fixed_asset_id)) throw fail(400, "Fixed Asset ID is required.");
    if (!str(b.ats_id)) throw fail(400, "AS ID is required.");
    const pvFault = req.files?.pv_fault?.[0] || null;
    const ldFile = req.files?.l_d?.[0] || null;

    await db.tx(async (t) => {
      const eq = await ownEquipment(t, b.equipment_id, req.user, true);
      if (eq.status === "SERVICING") throw fail(409, "This item is already out for servicing.");
      await t.query(
        `INSERT INTO service_requests (
          equipment_id, requested_by, fault_description,
          serial_number, material_number, fixed_asset_id, ats_id, nsf_id, sto_number, is_number,
          pv_fault, l_d, pv_fault_type, l_d_type
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          eq.equipment_id,
          req.user.user_id,
          fault,
          opt(b.serial_number),
          opt(b.material_number),
          str(b.fixed_asset_id),
          str(b.ats_id),
          opt(b.nsf_id),
          opt(b.sto_number),
          opt(b.is_number),
          pvFault?.buffer ?? null,
          ldFile?.buffer ?? null,
          pvFault?.mimetype ?? null,
          ldFile?.mimetype ?? null,
        ],
      );
      await logChange(t, eq.equipment_id, eq.status, "SERVICING", req.user.user_id, "Service request: " + fault);
      await t.query("UPDATE equipment SET status = 'SERVICING', appliance = NULL WHERE equipment_id = $1", [eq.equipment_id]);
    });
    res.json({ success: true });
  }),
);

/* ---------- IC only (registering stock isn't tied to the duty day) ---------- */
app.post(
  "/api/equipment",
  auth,
  needRole("IC"),
  h(async (req, res) => {
    const { serial_number, name, status, appliance, notes } = req.body ?? {};
    if (!str(name)) throw fail(400, "Name is required.");
    if (!STATUSES.includes(status)) throw fail(400, "Unknown status.");
    if (status === "SERVICING")
      throw fail(400, "Add it with another status, then use “Send for servicing” so the fault is recorded.");
    if (status === "ON_APPLIANCE" && !str(appliance)) throw fail(400, "Choose which appliance this item is on.");

    await db.tx(async (t) => {
      const onAppliance = status === "ON_APPLIANCE" ? await ownAppliance(t, str(appliance), req.user) : null;
      const r = await row(
        t,
        "INSERT INTO equipment (serial_number, name, station_id, appliance, status, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING equipment_id",
        [opt(serial_number), str(name), req.user.station_id, onAppliance, status, opt(notes)],
      );
      await logChange(t, r.equipment_id, null, status, req.user.user_id, "Initialised");
    });
    res.json({ success: true });
  }),
);

app.use("/api", (req, res) => res.status(404).json({ message: "Not found." }));

/* ---------- the built frontend (npm run build), served from the same origin ---------- */
if (fs.existsSync(DIST)) {
  // Vite fingerprints everything in /assets, so it can be cached forever.
  app.use("/assets", express.static(path.join(DIST, "assets"), { immutable: true, maxAge: "1y" }));
  // index.html, the manifest, icons and the service worker are revalidated on every load,
  // so a new deploy reaches installed apps promptly.
  app.use(express.static(DIST, { index: false, maxAge: 0 }));
  // Page routes (no file extension) get the app; missing files get a real 404.
  app.use((req, res, next) =>
    (req.method === "GET" || req.method === "HEAD") && !path.extname(req.path)
      ? res.set("Cache-Control", "no-cache").sendFile(path.join(DIST, "index.html"))
      : next(),
  );
}

// Malformed JSON and anything else that escaped a handler.
app.use((err, req, res, next) => {
  if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ message: "Invalid request." });
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

const server = app.listen(PORT, () => console.log(`LogSync running on port ${PORT}`));

// Railway sends SIGTERM on redeploy: finish in-flight requests, then close the database cleanly.
const shutdown = () =>
  server.close(async () => {
    await db.close().catch(() => {});
    process.exit(0);
  });
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
