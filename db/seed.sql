-- LogSync demo seed (PostgreSQL). Run on a database that has the schema from init_db.sql.
-- The server runs this automatically when the users table is empty (e.g. a new Railway
-- Postgres), unless SEED_DEMO=false. To reset by hand: npm run db:seed
-- Plaintext passwords below are replaced with bcrypt hashes on each user's first login.
--
-- * Wipes all appliances, equipment, checklists, logs, checks and service requests.
-- * Keeps existing users with user_id < 100 (adds the project team if missing); replaces demo users (user_id >= 100).
-- * DEMO DATA: demo people, passwords and serial numbers are fictional.
--
-- The PL armoury is defined ONCE (temp table pl_armoury) and copied to every PL.
-- Status notes from the live armoury (reminders, expiry, issues, loans) are left out.

-- ------------------------------------------------------------------ clear
TRUNCATE hoto_results, hoto_records, service_requests, equipment_log,
         equipment, checklist_items, appliances
  RESTART IDENTITY;
DELETE FROM users WHERE user_id >= 100;   -- their sessions go too (ON DELETE CASCADE)

-- ------------------------------------------------------------------ stations
-- Upsert (not delete) so existing users' station references stay valid.
INSERT INTO stations (id, division, name) VALUES
  (31, 3, 'Yishun'),
  (32, 3, 'Ang Mo Kio'),
  (33, 3, 'Sengkang'),
  (34, 3, 'Punggol')
ON CONFLICT (id) DO UPDATE SET division = excluded.division, name = excluded.name;

-- ------------------------------------------------------------------ appliances
INSERT INTO appliances (callsign, station_id, type) VALUES
  ('PL311', 31, 'PL'),
  ('PL321', 32, 'PL'),
  ('PL331', 33, 'PL'),
  ('PL341', 34, 'PL');

-- ------------------------------------------------------------------ demo users
-- Per station: FF and SC on each rota, plus one logistics IC. Password for all: demo1234
INSERT INTO users (user_id, station_id, username, password, role, rota) VALUES
  (101, 31, 'Ryan Ong',        'demo1234', 'FF', 1),
  (102, 31, 'Tan Wei Jie',     'demo1234', 'FF', 2),
  (103, 31, 'Arjun Nair',      'demo1234', 'FF', 3),
  (104, 31, 'Daniel Koh',      'demo1234', 'SC', 1),
  (105, 31, 'Hafiz Rahman',    'demo1234', 'SC', 2),
  (106, 31, 'Marcus Lim',      'demo1234', 'SC', 3),
  (107, 31, 'Sarah Ng',        'demo1234', 'IC', 1),

  (111, 32, 'Ethan Chua',      'demo1234', 'FF', 1),
  (112, 32, 'Naveen Kumar',    'demo1234', 'FF', 2),
  (113, 32, 'Zul Hakim',       'demo1234', 'FF', 3),
  (114, 32, 'Benjamin Goh',    'demo1234', 'SC', 1),
  (115, 32, 'Kelvin Yeo',      'demo1234', 'SC', 2),
  (116, 32, 'Ravi Pillai',     'demo1234', 'SC', 3),
  (117, 32, 'Michelle Teo',    'demo1234', 'IC', 1),

  (121, 33, 'Lee Jun Hao',     'demo1234', 'FF', 1),
  (122, 33, 'Imran Yusof',     'demo1234', 'FF', 2),
  (123, 33, 'Bryan Seah',      'demo1234', 'FF', 3),
  (124, 33, 'Darren Ho',       'demo1234', 'SC', 1),
  (125, 33, 'Aaron Fernandez', 'demo1234', 'SC', 2),
  (126, 33, 'Faisal Ismail',   'demo1234', 'SC', 3),
  (127, 33, 'Grace Low',       'demo1234', 'IC', 1),

  (131, 34, 'Shawn Pereira',   'demo1234', 'FF', 1),
  (132, 34, 'Ken Wong',        'demo1234', 'FF', 2),
  (133, 34, 'Amir Hamzah',     'demo1234', 'FF', 3),
  (134, 34, 'Justin Phua',     'demo1234', 'SC', 1),
  (135, 34, 'Vikram Singh',    'demo1234', 'SC', 2),
  (136, 34, 'Gabriel Sim',     'demo1234', 'SC', 3),
  (137, 34, 'Nur Aisyah',      'demo1234', 'IC', 1);

-- ------------------------------------------------------------------ project team
-- The team's own prototype accounts (Sengkang). Added only if missing, so a reset never
-- changes a password someone has already used. Password for all: demo1234
INSERT INTO users (user_id, station_id, username, password, role, rota) VALUES
  (1, 33, 'Akshay Sivaraman', 'demo1234', 'FF', 2),
  (2, 33, 'Gavin Yip',        'demo1234', 'FF', 2),
  (3, 33, 'Kian Hong',        'demo1234', 'SC', 2),
  (4, 33, 'Micheal Ian',      'demo1234', 'SC', 3),
  (5, 33, 'Irfan Affandy',    'demo1234', 'IC', 2),
  (6, 33, 'Tristen',          'demo1234', 'FF', 1)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------ PL armoury
-- Order of rows = order on the checklist. kit NULL = standalone item.
DROP TABLE IF EXISTS pg_temp.pl_armoury;
CREATE TEMP TABLE pl_armoury (
  n integer GENERATED ALWAYS AS IDENTITY,   -- insertion order = checklist order
  locker text, kit text, label text NOT NULL, qty integer NOT NULL, what_to_check text
);

INSERT INTO pl_armoury (locker, kit, label, qty, what_to_check) VALUES
  -- Locker 2
  ('Locker 2', 'Air Lifting Bag', 'Control Unit', 1, NULL),
  ('Locker 2', 'Air Lifting Bag', 'Pressure Reducer', 1, NULL),
  ('Locker 2', 'Air Lifting Bag', '10m Air Hose, Blue', 1, NULL),
  ('Locker 2', 'Air Lifting Bag', '10m Air Hose, Orange', 1, NULL),
  ('Locker 2', 'Air Lifting Bag', 'Lifting Bag (12 Bar/174 psi)', 2, NULL),
  ('Locker 2', 'Air Lifting Bag', 'Shut-off Hose', 2, NULL),
  ('Locker 2', 'eDraulic Ram', 'Battery (Fitted)', 1, NULL),
  ('Locker 2', 'eDraulic Ram', 'Battery (Spare)', 1, NULL),
  ('Locker 2', 'eDraulic Ram', 'Ram Extension', 1, NULL),
  ('Locker 2', 'eDraulic Ram', 'eDraulic Ram', 1, NULL),
  ('Locker 2', NULL, 'Bolt Cutter', 1, NULL),
  ('Locker 2', NULL, 'Compact Chainsaw', 1, NULL),
  ('Locker 2', NULL, 'Crowbar', 1, NULL),
  ('Locker 2', 'Glass Management Kit', 'Air Bag Safety Cover', 1, NULL),
  ('Locker 2', 'Glass Management Kit', 'Clear Rigid Screen Board', 1, NULL),
  ('Locker 2', 'Glass Management Kit', 'GMK Bag', 1, NULL),
  ('Locker 2', 'Glass Management Kit', 'Glass Collection Foldable Bag', 1, NULL),
  ('Locker 2', 'Glass Management Kit', 'Glass Hammer c/w Seat Belt Cutter', 1, NULL),
  ('Locker 2', 'Glass Management Kit', 'Sharp Edge Covers (1800mm x 600mm)', 2, NULL),
  ('Locker 2', 'Glass Management Kit', 'Sharp Edge Covers (600mm x 600mm)', 2, NULL),
  ('Locker 2', 'Glass Management Kit', 'Sharp Wrap', 1, NULL),
  ('Locker 2', 'Glass Management Kit', 'Window Laminated Film (w Penknife)', 1, NULL),
  ('Locker 2', NULL, 'Patient Protection Sheet', 6, NULL),
  ('Locker 2', 'Hydraulic Cutter and Spreader', 'Chain c/w Hook', 2, NULL),
  ('Locker 2', 'Hydraulic Cutter and Spreader', 'High Pressure Twin Hoses', 2, NULL),
  ('Locker 2', 'Hydraulic Cutter and Spreader', 'Hydraulic Cutter', 1, NULL),
  ('Locker 2', 'Hydraulic Cutter and Spreader', 'Hydraulic Hand Pump', 1, NULL),
  ('Locker 2', 'Hydraulic Cutter and Spreader', 'Hydraulic Power Unit', 1, NULL),
  ('Locker 2', 'Hydraulic Cutter and Spreader', 'Hydraulic Rescue Ram c/w Hose', 1, NULL),
  ('Locker 2', 'Hydraulic Cutter and Spreader', 'Hydraulic Spreader', 1, NULL),
  ('Locker 2', 'Hydraulic Cutter and Spreader', 'Shackles c/w Hook', 2, NULL),
  ('Locker 2', 'Hydraulic Forcible Entry Tool (Rabbit Tool)', 'Carrying Bag', 1, NULL),
  ('Locker 2', 'Hydraulic Forcible Entry Tool (Rabbit Tool)', 'Hand Pump', 1, NULL),
  ('Locker 2', 'Hydraulic Forcible Entry Tool (Rabbit Tool)', 'Mallet', 1, NULL),
  ('Locker 2', 'Hydraulic Forcible Entry Tool (Rabbit Tool)', 'Metal Prybar', 1, NULL),
  ('Locker 2', 'Hydraulic Forcible Entry Tool (Rabbit Tool)', 'Rabbit Tool Jaws c/w Hoses', 1, NULL),
  ('Locker 2', 'Manual Forcible Entry Tool (PRT Six Striker)', 'Bull Point', 1, NULL),
  ('Locker 2', 'Manual Forcible Entry Tool (PRT Six Striker)', 'Chisel', 1, NULL),
  ('Locker 2', 'Manual Forcible Entry Tool (PRT Six Striker)', 'Claw', 1, NULL),
  ('Locker 2', 'Manual Forcible Entry Tool (PRT Six Striker)', 'Flat Chisel', 1, NULL),
  ('Locker 2', 'Manual Forcible Entry Tool (PRT Six Striker)', 'Metal Ripper', 1, NULL),
  ('Locker 2', 'Manual Forcible Entry Tool (PRT Six Striker)', 'PRT 6 Striker Bar', 1, NULL),
  ('Locker 2', NULL, 'Portable Pump c/w Detachable Wheels', 1, NULL),
  ('Locker 2', NULL, 'Fire Extinguisher, Dry Chemical Powder, 9kg', 1, NULL),
  ('Locker 2', NULL, 'PV Stop', 1, NULL),
  ('Locker 2', 'Power Saw, Petrol Driven', 'Abrasive-Cutting Discs', 2, NULL),
  ('Locker 2', 'Power Saw, Petrol Driven', 'Concrete-Cutting Disc', 1, NULL),
  ('Locker 2', 'Power Saw, Petrol Driven', 'Multipurpose-Cutting Discs', 2, NULL),
  ('Locker 2', 'Power Saw, Petrol Driven', 'Power Saw', 1, NULL),
  ('Locker 2', 'Power Saw, Petrol Driven', 'T-Bar (for changing of Discs)', 1, NULL),
  ('Locker 2', NULL, 'Shovel', 1, NULL),
  ('Locker 2', 'Battery Operated Reciprocating Saw', 'Abrasive Blade', 1, NULL),
  ('Locker 2', 'Battery Operated Reciprocating Saw', 'Battery (Fitted)', 1, NULL),
  ('Locker 2', 'Battery Operated Reciprocating Saw', 'Battery (Spare)', 1, NULL),
  ('Locker 2', 'Battery Operated Reciprocating Saw', 'Battery Operated Reciprocating Saw', 1, NULL),
  ('Locker 2', 'Battery Operated Reciprocating Saw', 'Metal-Cutting Blade', 2, NULL),
  ('Locker 2', 'Battery Operated Reciprocating Saw', 'Wood-Cutting Blade', 2, NULL),
  ('Locker 2', NULL, 'Sledge Hammer, 5kg', 1, NULL),
  ('Locker 2', 'Step Chokes and Wedges', 'Step Chokes', 2, NULL),
  ('Locker 2', 'Step Chokes and Wedges', 'Log/Cribbing Block (Large)', 2, NULL),
  ('Locker 2', 'Step Chokes and Wedges', 'Log/Cribbing Block (Medium)', 2, NULL),
  ('Locker 2', 'Step Chokes and Wedges', 'Log/Cribbing Block (Small)', 2, NULL),
  ('Locker 2', 'Step Chokes and Wedges', '1" Triangular Wedge', 2, NULL),
  ('Locker 2', 'Step Chokes and Wedges', '2" Triangular Wedge', 2, NULL),

  -- Locker 3
  ('Locker 3', NULL, 'Hose Delivery 125mm (15m) for Triple Pillar Hydrant', 1, NULL),
  ('Locker 3', NULL, 'Hose Delivery 38mm (10m)', 1, NULL),
  ('Locker 3', NULL, 'Hose Delivery 64mm (10m)', 2, NULL),
  ('Locker 3', NULL, 'Hose Delivery 38mm (20m)', 2, NULL),
  ('Locker 3', NULL, 'Hose Delivery 64mm (20m)', 5, NULL),
  ('Locker 3', NULL, '38mm (20m), RACE Pack', 2, NULL),
  ('Locker 3', 'Hydrant Key Complete', '2-pound Hammer', 1, NULL),
  ('Locker 3', 'Hydrant Key Complete', 'Hydrant Adaptor', 1, NULL),
  ('Locker 3', 'Hydrant Key Complete', 'Hydrant Control Adaptor', 1, NULL),
  ('Locker 3', 'Hydrant Key Complete', 'Hydrant Key Bag', 1, NULL),
  ('Locker 3', 'Hydrant Key Complete', 'Hydrant Pit Key', 1, NULL),
  ('Locker 3', 'Hydrant Key Complete', 'Telescopic Hydrant Key (1500mm)', 1, NULL),
  ('Locker 3', 'Hydrant Key Complete', 'Turning Bar c/w Lug Opener', 1, NULL),
  ('Locker 3', NULL, 'Standpipe', 1, NULL),
  ('Locker 3', NULL, 'Piercing Applicator', 1, NULL),

  -- Locker 4
  ('Locker 4', NULL, 'Hose Delivery 38mm (10m)', 1, NULL),
  ('Locker 4', NULL, 'Hose Delivery 38mm (20m)', 2, NULL),
  ('Locker 4', NULL, 'Hose Delivery 64mm (10m)', 2, NULL),
  ('Locker 4', NULL, 'Hose Delivery 64mm (20m)', 6, NULL),
  ('Locker 4', NULL, 'Hose Delivery 100mm (15m) c/w Storz Coupling', 1, NULL),
  ('Locker 4', NULL, '38mm (20m), Flaked with 1 No of Flakehose Carrier', 1, NULL),
  ('Locker 4', NULL, 'Foam Branch, LX50', 2, NULL),
  ('Locker 4', 'Hydrant Key Complete', '2-pound Hammer', 1, NULL),
  ('Locker 4', 'Hydrant Key Complete', 'Hydrant Adaptor', 1, NULL),
  ('Locker 4', 'Hydrant Key Complete', 'Hydrant Control Adaptor', 1, NULL),
  ('Locker 4', 'Hydrant Key Complete', 'Hydrant Key Bag', 1, NULL),
  ('Locker 4', 'Hydrant Key Complete', 'Hydrant Pit Key', 1, NULL),
  ('Locker 4', 'Hydrant Key Complete', 'Telescopic Hydrant Key (1500mm)', 1, NULL),
  ('Locker 4', 'Hydrant Key Complete', 'Turning Bar c/w Lug Opener', 1, NULL),
  ('Locker 4', NULL, 'Suction Adaptor, 140mm (Female Fixed)', 1, NULL),
  ('Locker 4', NULL, '2-Way Collecting Head for Portable Pump', 1, NULL),
  ('Locker 4', 'BA Control Board', 'BA Control Board', 1, NULL),
  ('Locker 4', 'BA Control Board', 'Compartments for 10 BA Tallies', 1, NULL),
  ('Locker 4', 'BA Control Board', 'Easy Adjustable Timer', 1, NULL),
  ('Locker 4', 'BA Control Board', 'Stand', 1, NULL),
  ('Locker 4', 'BA Control Board', 'Time - Air Pressure Conversion Table up to 300 Bars', 1, NULL),
  ('Locker 4', 'BA Control Board', 'Whiteboard Marker (Fine Tip, Erasable)', 1, NULL),
  ('Locker 4', NULL, 'Utility Rope (11mm), 60m c/w Rope Bag', 2, NULL),
  ('Locker 4', NULL, 'BA Guide Line c/w Cylindrical Canvas Carrying Bag', 2, NULL),

  -- Locker 5
  ('Locker 5', NULL, 'Ram Support from eDraulic Ram', 1, NULL),
  ('Locker 5', 'AP4C', 'AP4C', 1, NULL),
  ('Locker 5', 'AP4C', 'Box Ten Sampling Scrapers (Black)', 1, NULL),
  ('Locker 5', 'AP4C', 'Box Ten Test Scrapers (Blue)', 1, NULL),
  ('Locker 5', 'AP4C', 'Buzzer', 1, NULL),
  ('Locker 5', 'AP4C', 'Charger', 1, NULL),
  ('Locker 5', 'AP4C', 'Hydrogen Stocker', 2, NULL),
  ('Locker 5', 'AP4C', 'LSH20 Battery for S4PE', 2, NULL),
  ('Locker 5', 'AP4C', 'Rechargeable NiMH Battery', 1, NULL),
  ('Locker 5', 'AP4C', 'S4PE Persistent Substances Sampling System with Pull Strap', 1, NULL),
  ('Locker 5', 'AP4C', 'Special AP4C Sampling Tube for S4PE', 1, NULL),
  ('Locker 5', 'AP4C', 'Special AP4C Spare Sampling Nozzle', 1, NULL),
  ('Locker 5', 'AP4C', 'Technical Guide', 1, NULL),
  ('Locker 5', 'AP4C', 'Transport Case', 1, NULL),
  ('Locker 5', NULL, 'LCD 3.3', 2, NULL),
  ('Locker 5', NULL, 'CA Bag (Carrying PPEH)', 1, NULL),
  ('Locker 5', NULL, 'Positive Pressure Escape Hood', 4, NULL),
  ('Locker 5', NULL, 'Contamination Monitor (FH40G)', 1, NULL),
  ('Locker 5', NULL, 'Portable Gas Detector (G999 Polytector)', 1, NULL),
  ('Locker 5', 'Hazmat Kit (Drager Tubes)', '1 Set of 10 Tubing (Big)', 3, NULL),
  ('Locker 5', 'Hazmat Kit (Drager Tubes)', '1 Set of 10 Tubing (Small)', 40, NULL),
  ('Locker 5', 'Hazmat Kit (Drager Tubes)', 'Air Current Tubes', 10, NULL),
  ('Locker 5', 'Hazmat Kit (Drager Tubes)', 'Allen Key', 1, NULL),
  ('Locker 5', 'Hazmat Kit (Drager Tubes)', 'Black Box', 1, NULL),
  ('Locker 5', 'Hazmat Kit (Drager Tubes)', 'Hand Pump', 1, NULL),
  ('Locker 5', 'Hazmat Kit (Drager Tubes)', 'Operating Instructions', 1, NULL),
  ('Locker 5', 'Hazmat Kit (Drager Tubes)', 'Rubber Bulb', 1, NULL),
  ('Locker 5', 'Hazmat Kit (Drager Tubes)', 'Rubber Caps', 4, NULL),
  ('Locker 5', 'Hazmat Kit (Drager Tubes)', 'Spare Keys', 3, NULL),
  ('Locker 5', NULL, 'Intensimeter (Surveymeter)', 1, NULL),
  ('Locker 5', 'Sensor Interface Dongle c/w Case', 'LCD 3.3 Connector Cables', 2, NULL),
  ('Locker 5', 'Sensor Interface Dongle c/w Case', 'G999 Connector Cables', 1, NULL),
  ('Locker 5', 'Sensor Interface Dongle c/w Case', 'AP4C Connector Cables', 1, NULL),
  ('Locker 5', 'Sensor Interface Dongle c/w Case', 'Hard Case (Box)', 1, NULL),
  ('Locker 5', NULL, 'Special Combi Filter Canisters', 10, NULL),
  ('Locker 5', NULL, '9 Litre/300 Bar Carbon Composite Cylinder c/w Cylinder Cover & BA Cylinder Vent Plugs', 2, NULL),
  ('Locker 5', NULL, '9 Litre/300 Bar Carbon Composite Cylinder c/w Cylinder Cover & BA Cylinder Vent Plugs (Fitted with NG SCBA Quick Connect Adaptor)', 2, NULL),
  ('Locker 5', 'Hasty Decon Equipment', 'Decon Clothing Cutter (S-Cut)', 2, NULL),
  ('Locker 5', 'Hasty Decon Equipment', 'Non-Soluble Marker', 10, NULL),
  ('Locker 5', 'Hasty Decon Equipment', 'Stretcher Stands', 2, NULL),
  ('Locker 5', 'Hasty Decon Equipment', 'Perforated Stretcher with Detachable Rollers', 2, NULL),
  ('Locker 5', 'Hasty Decon Equipment', 'Light Decon Suit', 5, NULL),
  ('Locker 5', 'Hasty Decon Equipment', 'Directional Arrows (Red)', 20, NULL),
  ('Locker 5', 'Hasty Decon Equipment', 'Directional Arrows (Green)', 20, NULL),
  ('Locker 5', 'Eflare Hazmat Set', 'Eflare Amber c/w Rubber Base', 1, NULL),
  ('Locker 5', 'Eflare Hazmat Set', 'Eflare Red c/w Rubber Base', 1, NULL),
  ('Locker 5', 'Eflare Hazmat Set', 'Eflare White c/w Rubber Base', 1, NULL),
  ('Locker 5', 'Eflare Hazmat Set', 'Yellow Carrying Case', 1, NULL),
  ('Locker 5', NULL, 'Tarpaulin Sheet, Butyl', 1, NULL),
  ('Locker 5', NULL, 'Walking Casualty (Adult Size) Clothing Pack', 15, NULL),
  ('Locker 5', NULL, 'Walking Casualty (Adult Plus Size) Clothing Pack', 6, NULL),
  ('Locker 5', NULL, 'Walking Casualty (Child) Clothing Pack', 2, NULL),
  ('Locker 5', NULL, 'Lying Casualty Clothing Pack', 7, NULL),
  ('Locker 5', 'Hazmat Equipment Set', 'Aqueous Absorbent', 18, NULL),
  ('Locker 5', 'Hazmat Equipment Set', 'Carrying Bag', 1, NULL),
  ('Locker 5', 'Hazmat Equipment Set', 'Chemical Resistance Bag (Large)', 10, NULL),
  ('Locker 5', 'Hazmat Equipment Set', 'Chemical Resistance Bag (Small)', 30, NULL),
  ('Locker 5', 'Hazmat Equipment Set', 'Organic Absorbent', 18, NULL),
  ('Locker 5', NULL, 'Decon Demarcation Lane', 1, NULL),
  ('Locker 5', NULL, 'Hose Ramp/Bridge', 4, NULL),

  -- Locker 6
  ('Locker 6', 'Ultra High Pressure System', 'Nozzle', 1, NULL),
  ('Locker 6', 'Ultra High Pressure System', 'Cutting Agent Container', 1, NULL),
  ('Locker 6', 'Ultra High Pressure System', '60m Recoiling Hose with Handle', 1, NULL),
  ('Locker 6', 'Ultra High Pressure System', 'High Pressure Hose Reel', 1, NULL),
  ('Locker 6', NULL, 'Canvas Bucket', 4, NULL),
  ('Locker 6', NULL, 'Collecting Breeching', 2, NULL),
  ('Locker 6', NULL, 'Control Dividing Breeching', 2, NULL),
  ('Locker 6', NULL, 'Electric Nozzle, 38mm', 2, NULL),
  ('Locker 6', NULL, 'Hose Lashing Strap / Nozzle Sling', 4, NULL),
  ('Locker 6', NULL, 'Hose Sling', 2, NULL),
  ('Locker 6', NULL, 'Nozzle 38mm', 4, NULL),
  ('Locker 6', NULL, 'Nozzle 64mm', 4, NULL),
  ('Locker 6', NULL, 'Straight Tip Nozzle', 1, NULL),
  ('Locker 6', NULL, 'Automatic Nozzle', 1, NULL),
  ('Locker 6', NULL, 'Manifold Water Distribution', 1, NULL),
  ('Locker 6', NULL, 'Sprinkler Shut-off Plug', 10, NULL),
  ('Locker 6', NULL, 'Sprinkler Shut-off Stopper', 4, NULL),
  ('Locker 6', NULL, 'Storz (65mm) Adaptor Fitted with Female Instantaneous Coupling', 2, NULL),
  ('Locker 6', NULL, 'Storz (65mm) Adaptor Fitted with Male Instantaneous Coupling', 2, NULL),
  ('Locker 6', NULL, 'Supply Line Bandage', 5, NULL),
  ('Locker 6', NULL, 'Riser Plug c/w Pouch', 2, 'Placed in transparent box'),
  ('Locker 6', NULL, 'Revolving Nozzle', 1, NULL),
  ('Locker 6', NULL, 'Shut-off Valve Adaptor (SOVA)', 4, NULL),
  ('Locker 6', NULL, '10-Ltr Bio Solvent', 1, NULL),
  ('Locker 6', NULL, 'Portable Ground Monitor c/w Anchoring Chain', 1, NULL),
  ('Locker 6', NULL, 'Hydraulic Ram', 1, NULL);

-- Copy the armoury to every PL. sort_order follows the list above.
INSERT INTO checklist_items (appliance, locker, kit, label, what_to_check, expected_qty, sort_order)
SELECT a.callsign, p.locker, p.kit, p.label, p.what_to_check, p.qty, p.n * 10
FROM appliances a CROSS JOIN pl_armoury p
WHERE a.type = 'PL'
ORDER BY a.callsign, p.n;

DROP TABLE pg_temp.pl_armoury;

-- ------------------------------------------------------------------ equipment
-- Serial-numbered main tools on every PL (kit components have no serials).
-- Serial format: DEMO-<callsign>-<nn>, e.g. DEMO-PL331-09
DROP TABLE IF EXISTS pg_temp.pl_tools;
CREATE TEMP TABLE pl_tools (n integer NOT NULL, name text NOT NULL);
INSERT INTO pl_tools (n, name) VALUES
  (1,  'eDraulic Ram'),
  (2,  'Compact Chainsaw'),
  (3,  'Hydraulic Cutter'),
  (4,  'Hydraulic Spreader'),
  (5,  'Hydraulic Power Unit'),
  (6,  'Hydraulic Rescue Ram c/w Hose'),
  (7,  'Hydraulic Forcible Entry Tool (Rabbit Tool)'),
  (8,  'Portable Pump c/w Detachable Wheels'),
  (9,  'Power Saw'),
  (10, 'Battery Operated Reciprocating Saw'),
  (11, 'AP4C'),
  (12, 'LCD 3.3'),
  (13, 'LCD 3.3'),
  (14, 'Contamination Monitor (FH40G)'),
  (15, 'Portable Gas Detector (G999 Polytector)'),
  (16, 'Intensimeter (Surveymeter)'),
  (17, 'Manifold Water Distribution'),
  (18, 'Portable Ground Monitor c/w Anchoring Chain');

INSERT INTO equipment (serial_number, name, station_id, appliance, status)
SELECT 'DEMO-' || a.callsign || '-' || lpad(t.n::text, 2, '0'), t.name, a.station_id, a.callsign, 'ON_APPLIANCE'
FROM appliances a CROSS JOIN pl_tools t
WHERE a.type = 'PL'
ORDER BY a.callsign, t.n;

DROP TABLE pg_temp.pl_tools;

-- Spares in station stores
INSERT INTO equipment (serial_number, name, station_id, appliance, status, notes) VALUES
  ('DEMO-S33-SPARE-01', 'Power Saw',                                   33, NULL, 'STORE', 'Spare'),
  ('DEMO-S33-SPARE-02', 'Hydraulic Forcible Entry Tool (Rabbit Tool)', 33, NULL, 'STORE', 'Spare'),
  ('DEMO-S34-SPARE-01', 'Power Saw',                                   34, NULL, 'STORE', 'Spare');
