import express from "express";
import Database from "better-sqlite3";
import cors from "cors";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "../db/temp.db"));
db.pragma("foreign_keys = ON");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- duty rota (decided by the server, so it can't be faked) ---------- */
const ROTA_ANCHOR = { date: "2026-11-18", rota: 3 }; // from 08:00 on this date
const ROTA_COUNT = 3, HANDOVER_HOUR = 8, UTC_OFFSET = 8; // Singapore = UTC+8
const dutyRota = (now = Date.now()) => {
  const t = new Date(now + (UTC_OFFSET - HANDOVER_HOUR) * 36e5);
  const [y, m, d] = ROTA_ANCHOR.date.split("-").map(Number);
  const days = Math.round((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - Date.UTC(y, m - 1, d)) / 864e5);
  return ((ROTA_ANCHOR.rota - 1 - days) % ROTA_COUNT + ROTA_COUNT) % ROTA_COUNT + 1;
};

/* ---------- sessions and permissions ---------- */
const sessions = new Map(); // token -> user_id (cleared when the server restarts)

const auth = (req, res, next) => {
  const id = sessions.get((req.headers.authorization || "").replace("Bearer ", ""));
  const user = id && db.prepare("SELECT user_id, username, role, station_id, rota FROM users WHERE user_id = ?").get(id);
  if (!user) return res.status(401).json({ message: "Please log in again." });
  req.user = user;
  next();
};
const needRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: "Your role can’t do this." });
const needDuty = (req, res, next) =>
  req.user.rota === dutyRota() ? next() : res.status(403).json({ message: "Editing is open only on your rota’s duty day." });

const h = (fn) => (req, res) => {
  try { fn(req, res); }
  catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    if (String(e.code).includes("UNIQUE")) return res.status(409).json({ message: "That serial number is already registered." });
    console.error(e);
    res.status(400).json({ message: e.message });
  }
};
const fail = (status, message) => Object.assign(new Error(message), { status });
const ownEquipment = (id, user) => {
  const eq = db.prepare("SELECT * FROM equipment WHERE equipment_id = ? AND station_id = ?").get(id, user.station_id);
  if (!eq) throw fail(404, "Equipment not found at your station.");
  return eq;
};
const logChange = (eid, from, to, by, note) =>
  db.prepare("INSERT INTO equipment_log (equipment_id, from_status, to_status, changed_by, note) VALUES (?,?,?,?,?)").run(eid, from, to, by, note || null);

/* ---------- login ---------- */
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username) return res.status(400).json({ success: false, message: "Please enter your username." });
  const user = db.prepare("SELECT user_id, username, role, station_id, rota, password FROM users WHERE username = ?").get(username.trim());
  if (!user) return res.status(401).json({ success: false, message: "Username not found." });
  if ((password ?? "") !== (user.password ?? "")) return res.status(401).json({ success: false, message: "Incorrect password." });
  const token = crypto.randomUUID();
  sessions.set(token, user.user_id);
  const { password: _omit, ...safe } = user;
  res.json({ success: true, message: "Login successful!", token, user: safe });
});

/* ---------- everything the screen needs, for the user's own station ---------- */
app.get("/api/data", auth, h((req, res) => {
  const q = (sql) => db.prepare(sql).all(req.user.station_id);
  res.json({
    me: req.user,
    dutyRota: dutyRota(),
    stations: q("SELECT id, division, name FROM stations WHERE id = ?"),
    users: q("SELECT user_id, username, role, rota FROM users WHERE station_id = ?"),
    appliances: q("SELECT callsign, station_id, type FROM appliances WHERE station_id = ?"),
    equipment: q("SELECT equipment_id, serial_number, name, station_id, appliance, status, notes FROM equipment WHERE station_id = ? ORDER BY name"),
    checklist: q(`SELECT c.id, c.appliance, c.label, c.what_to_check, c.expected_qty FROM checklist_items c
                  JOIN appliances a ON a.callsign = c.appliance WHERE a.station_id = ? ORDER BY c.sort_order, c.id`),
    log: q(`SELECT l.id, l.equipment_id, l.from_status, l.to_status, l.changed_by, l.note,
                   datetime(l.changed_at, '+8 hours') AS changed_at
            FROM equipment_log l JOIN equipment e ON e.equipment_id = l.equipment_id WHERE e.station_id = ? ORDER BY l.id`),
    hoto: q(`SELECT r.id, r.appliance, r.rota, r.completed_by, datetime(r.completed_at, '+8 hours') AS completed_at
             FROM hoto_records r JOIN appliances a ON a.callsign = r.appliance WHERE a.station_id = ? ORDER BY r.id`),
    service: q(`SELECT s.id, s.equipment_id, s.requested_by, s.fault_description, s.status,
                       datetime(s.submitted_at, '+8 hours') AS submitted_at
                FROM service_requests s JOIN equipment e ON e.equipment_id = s.equipment_id WHERE e.station_id = ? ORDER BY s.id`),
  });
}));

/* ---------- FF, SC, IC (duty day only) ---------- */
app.post("/api/hoto", auth, needDuty, h((req, res) => {
  const { appliance, results } = req.body;
  const ok = db.prepare("SELECT 1 FROM appliances WHERE callsign = ? AND station_id = ?").get(appliance, req.user.station_id);
  if (!ok) throw fail(404, "Appliance not found at your station.");
  db.transaction(() => {
    const rec = db.prepare("INSERT INTO hoto_records (appliance, rota, completed_by) VALUES (?,?,?)").run(appliance, req.user.rota, req.user.user_id);
    for (const r of results) {
      const item = db.prepare("SELECT id FROM checklist_items WHERE id = ? AND appliance = ?").get(r.item_id, appliance);
      if (!item) throw fail(400, "Checklist item doesn’t belong to this appliance.");
      db.prepare("INSERT INTO hoto_results (record_id, item_id, result, note) VALUES (?,?,?,?)").run(rec.lastInsertRowid, r.item_id, r.result, r.note || null);
    }
  })();
  res.json({ success: true });
}));

app.post("/api/equipment/:id/status", auth, needDuty, h((req, res) => {
  const eq = ownEquipment(+req.params.id, req.user);
  const { to_status, note } = req.body;
  let appliance = null;
  if (to_status === "ON_APPLIANCE") {
    appliance = eq.appliance || db.prepare("SELECT callsign FROM appliances WHERE station_id = ? LIMIT 1").get(req.user.station_id)?.callsign;
    if (!appliance) throw fail(400, "This station has no appliance to put it on.");
  }
  db.transaction(() => {
    logChange(eq.equipment_id, eq.status, to_status, req.user.user_id, note);
    db.prepare("UPDATE equipment SET status = ?, appliance = ? WHERE equipment_id = ?").run(to_status, appliance, eq.equipment_id);
  })();
  res.json({ success: true });
}));

/* ---------- SC and IC ---------- */
app.post("/api/service", auth, needRole("SC", "IC"), h((req, res) => {
  const eq = ownEquipment(+req.body.equipment_id, req.user);
  const fault = (req.body.fault_description || "").trim();
  if (!fault) throw fail(400, "Please describe the fault.");
  db.transaction(() => {
    db.prepare("INSERT INTO service_requests (equipment_id, requested_by, fault_description) VALUES (?,?,?)").run(eq.equipment_id, req.user.user_id, fault);
    logChange(eq.equipment_id, eq.status, "SERVICING", req.user.user_id, "Service request: " + fault);
    db.prepare("UPDATE equipment SET status = 'SERVICING', appliance = NULL WHERE equipment_id = ?").run(eq.equipment_id);
  })();
  res.json({ success: true });
}));

/* ---------- IC only ---------- */
app.post("/api/equipment", auth, needRole("IC"), h((req, res) => {
  const { serial_number, name, status, appliance, notes } = req.body;
  if (!name?.trim()) throw fail(400, "Name is required.");
  if (appliance && !db.prepare("SELECT 1 FROM appliances WHERE callsign = ? AND station_id = ?").get(appliance, req.user.station_id))
    throw fail(400, "Appliance not found at your station.");
  db.transaction(() => {
    const r = db.prepare("INSERT INTO equipment (serial_number, name, station_id, appliance, status, notes) VALUES (?,?,?,?,?,?)")
      .run(serial_number || null, name.trim(), req.user.station_id, appliance || null, status, notes || null);
    logChange(r.lastInsertRowid, null, status, req.user.user_id, "Initialised");
  })();
  res.json({ success: true });
}));

app.listen(3000, () => console.log("LogSync API running at http://localhost:3000"));
