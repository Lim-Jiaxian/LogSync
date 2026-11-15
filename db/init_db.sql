PRAGMA foreign_keys = ON;

CREATE TABLE stations (
  id       INTEGER PRIMARY KEY,
  division INTEGER NOT NULL,
  name     TEXT NOT NULL
);

CREATE TABLE users (
  user_id    INTEGER PRIMARY KEY,           -- replace with pseudonymous Singpass ref
  station_id INTEGER NOT NULL REFERENCES stations(id),
  username   TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'FF' CHECK (role IN ('FF','SC','IC')),
  rota       INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appliances (
  callsign   TEXT PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES stations(id),
  type       TEXT NOT NULL                  -- PL, LF, FMV, FB... not exhaustive, so no CHECK
);

CREATE TABLE equipment (
  equipment_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_number TEXT UNIQUE,                -- nullable: NA allowed
  name          TEXT NOT NULL,
  station_id    INTEGER NOT NULL REFERENCES stations(id),
  appliance     TEXT REFERENCES appliances(callsign),
  status        TEXT NOT NULL CHECK (status IN
                ('ON_APPLIANCE','STORE','SERVICING','LOANED_OUT','MISSING','OTHER')),
  notes         TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  CHECK ((status = 'ON_APPLIANCE') = (appliance IS NOT NULL))
);

CREATE TABLE equipment_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  from_status  TEXT,
  to_status    TEXT NOT NULL,
  changed_by   INTEGER NOT NULL REFERENCES users(user_id),
  changed_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  note         TEXT
);

CREATE TABLE checklist_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  appliance     TEXT NOT NULL REFERENCES appliances(callsign),
  label         TEXT NOT NULL,
  what_to_check TEXT,
  expected_qty  INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE hoto_records (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  appliance    TEXT NOT NULL REFERENCES appliances(callsign),
  rota         INTEGER NOT NULL,            -- rota taking over
  completed_by INTEGER NOT NULL REFERENCES users(user_id),
  completed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id      INTEGER NOT NULL REFERENCES equipment(id),
  requested_by      INTEGER NOT NULL REFERENCES users(user_id),
  fault_description TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'SUBMITTED',
  submitted_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hoto_results (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id          INTEGER NOT NULL REFERENCES hoto_records(id),
  item_id            INTEGER NOT NULL REFERENCES checklist_items(id),
  equipment_id       INTEGER REFERENCES equipment(id),
  result             TEXT NOT NULL CHECK (result IN ('OK','MISSING','FAULTY','QTY_MISMATCH')),
  note               TEXT,
  service_request_id INTEGER REFERENCES service_requests(id)
);