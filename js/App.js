import { useState, useEffect, useRef, createElement, Fragment } from "react";
import htm from "htm";
import { api, getToken, logout, saveSnapshot, loadSnapshot } from "./api.js";
import { UpdateBanner, InstallButton } from "../src/PwaUI.jsx";
const html = htm.bind(createElement);
const STATUSES = [
  "ON_APPLIANCE",
  "STORE",
  "SERVICING",
  "LOANED_OUT",
  "MISSING",
  "OTHER",
];
const RESULTS = ["OK", "MISSING", "FAULTY", "QTY_MISMATCH"];
const MAX_FILE = 10 * 1024 * 1024;
const lbl = (s) =>
  s === "OK"
    ? "OK"
    : s
    ? s
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())
    : "";
const when = (ms) =>
  new Date(ms).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const initialTab = () => new URLSearchParams(window.location.search).get("tab") || "armoury";

function App() {
  const [db, setDb] = useState(null);
  const [tab, setTabState] = useState(initialTab);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  // When set, the screen is showing saved data from this time because the server can't be reached.
  const [savedAt, setSavedAt] = useState(null);
  const busyRef = useRef(false); // guards double taps before the re-render disables buttons
  const lastFetch = useRef(0);

  const fetchData = async () => {
    const data = await api("/api/data");
    lastFetch.current = Date.now();
    setDb(data);
    setSavedAt(null);
    saveSnapshot(data);
    return data;
  };
  // A network failure: keep what's on screen (or the saved snapshot) and say how old it is.
  const goStale = (e, haveData) => {
    if (!e.offline) return false;
    if (haveData) {
      setSavedAt((s) => s ?? lastFetch.current);
      return true;
    }
    const snap = loadSnapshot();
    if (!snap) return false;
    setDb(snap.data);
    setSavedAt(snap.savedAt);
    return true;
  };
  const refresh = () => fetchData().catch((e) => goStale(e, true));

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/";
      return;
    }
    fetchData().catch((e) => {
      if (!goStale(e, false)) setError(e.message);
    });
    const goOnline = () => {
      setOnline(true);
      refresh();
    };
    const goOffline = () => setOnline(false);
    // An installed app can sit in the background for hours: refresh when it's brought back.
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch.current > 60_000) refresh();
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  // While showing saved data, keep trying quietly: the phone may report "online" on Wi-Fi with no
  // internet, or the server may be restarting during a deploy, so the online event alone isn't enough.
  useEffect(() => {
    if (savedAt === null) return;
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [savedAt]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3200);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const notify = (m) => setToast(m);
  // Send a change to the server, reload the data, show a message. Returns true if the change was saved.
  const run = async (fn, ok) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      try {
        await fn();
      } catch (e) {
        if (e.offline) goStale(e, true);
        notify(e.message);
        return false;
      }
      // The change is saved even if the refresh fails; keep showing the last data rather than an error screen.
      await fetchData().catch(() => {});
      notify(ok);
      return true;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const setTab = (k) => {
    setTabState(k);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", k);
    window.history.replaceState(null, "", url);
  };

  if (error)
    return html`<div className="wrap page-top">
      <p role="alert">${error}</p>
      <div className="row">
        <button onClick=${() => window.location.reload()}>Try again</button>
        <button onClick=${logout}>Back to login</button>
      </div>
    </div>`;
  if (!db) return html`<div className="wrap page-top"><p className="mute">Loading…</p></div>`;

  const user = db.me;
  const station = db.stations[0];
  if (!station)
    return html`<div className="wrap page-top">
      <p role="alert">Your account isn’t linked to a station. Ask your administrator to fix it.</p>
      <button onClick=${logout}>Back to login</button>
    </div>`;
  const offline = !online || savedAt !== null;
  const onDuty = user.rota === db.dutyRota;
  const canEdit = onDuty && !offline;
  const tabs = [
    ["armoury", "Armoury"],
    ["tracker", "Equipment & log"],
  ];
  if (user.role !== "FF") tabs.push(["service", "Send for servicing"]);
  if (user.role === "IC") tabs.push(["init", "Add equipment"]);
  const current = tabs.some(([k]) => k === tab) ? tab : "armoury";
  const ctx = { db, run, busy, user, station, onDuty, canEdit, offline };

  return html`<div>
    <header className="bar">
      <div className="brand">
        <img src="/favicon.svg" alt="" />
        <div style=${{ minWidth: 0 }}>
          <h1>${station.name}</h1>
          <div className="sub">
            Division ${station.division} · ${user.username}, ${user.role}, rota ${user.rota}
          </div>
        </div>
      </div>
      <div className="row" style=${{ gap: 10 }}>
        ${onDuty
          ? html`<span className="duty">ON DUTY · EDITING OPEN</span>`
          : html`<span style=${{ opacity: 0.8 }}>Off duty (rota ${db.dutyRota} is on) · view only</span>`}
        <${InstallButton} />
        <button onClick=${logout}>Log out</button>
      </div>
    </header>
    <${UpdateBanner} />
    ${offline &&
    html`<div className="notice offline" role="status">
      <span>
        ${online ? "Can’t reach the server." : "You’re offline."} Showing data from
        ${" " + when(savedAt ?? lastFetch.current)}. Changes are paused until you reconnect.
      </span>
      <button onClick=${refresh}>Retry</button>
    </div>`}
    <main className="wrap">
      <div className="tabs" role="tablist">
        ${tabs.map(
          ([k, t]) =>
            html`<button
              key=${k}
              role="tab"
              aria-selected=${current === k}
              onClick=${() => setTab(k)}
            >
              ${t}
            </button>`,
        )}
      </div>
      ${current === "armoury" && html`<${Armoury} ...${ctx} />`}
      ${current === "tracker" && html`<${Tracker} ...${ctx} />`}
      ${current === "service" && html`<${Service} ...${ctx} />`}
      ${current === "init" && html`<${Init} ...${ctx} />`}
    </main>
    ${toast && html`<div className="toast" role="status">${toast}</div>`}
  </div>`;
}

const Lock = () =>
  html`<div className="lock">
    Editing is open only on your rota’s duty day. You can still view everything.
  </div>`;
const Pill = ({ s }) => html`<span className=${"pill " + s}>${lbl(s)}</span>`;

function Armoury({ db, run, busy, station, onDuty, canEdit }) {
  const apps = db.appliances.filter((a) => a.station_id === station.id);
  const [cs, setCs] = useState(apps[0]?.callsign);
  const [res, setRes] = useState({});
  const [notes, setNotes] = useState({});
  const items = db.checklist.filter((c) => c.appliance === cs);
  const eq = db.equipment.filter((e) => e.appliance === cs);
  const flagged = items.filter((it) => (res[it.id] || "OK") !== "OK").length;
  const pick = (callsign) => {
    setCs(callsign);
    setRes({});
    setNotes({});
  };
  const submit = async () => {
    const ok = await run(
      () =>
        api("/api/hoto", "POST", {
          appliance: cs,
          results: items.map((it) => ({
            item_id: it.id,
            result: res[it.id] || "OK",
            note: notes[it.id] || "",
          })),
        }),
      "HOTO saved for " + cs,
    );
    // Only clear once it's saved, so a failed submit doesn't lose what was entered.
    if (ok) {
      setRes({});
      setNotes({});
    }
  };
  const last = [...db.hoto].reverse().find((h) => h.appliance === cs);
  const lockerCount = items.reduce((m, it) => ((m[it.locker] = (m[it.locker] || 0) + 1), m), {});
  if (!apps.length)
    return html`<div className="panel">
      No appliances registered at this station yet.
    </div>`;
  return html`<div>
    <div className="row" style=${{ marginBottom: 12 }}>
      ${apps.map(
        (a) =>
          html`<button
            key=${a.callsign}
            className=${cs === a.callsign ? "primary" : ""}
            onClick=${() => pick(a.callsign)}
          >
            ${a.callsign} · ${a.type}
          </button>`,
      )}
    </div>
    ${!onDuty && html`<${Lock} />`}
    <div className="panel">
      <h2>${cs} handover/takeover checklist</h2>
      <p className="mute" style=${{ marginTop: 0 }}>
        ${last
          ? `Last HOTO: rota ${last.rota}, ${last.completed_at}`
          : "No HOTO recorded yet."}
        ${items.length ? ` · ${items.length} items` : ""}
      </p>
      <div className="scroll">
        <table className="cards">
          <thead>
            <tr>
              <th>Item</th>
              <th>What to check</th>
              <th>Qty</th>
              <th>Result</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, i) => {
              const result = res[it.id] || "OK";
              const newLocker = it.locker && it.locker !== items[i - 1]?.locker;
              return html`<${Fragment} key=${it.id}>
                ${newLocker &&
                html`<tr className="group">
                  <th colSpan="5">${it.locker}<span className="mute">${lockerCount[it.locker]} items</span></th>
                </tr>`}
                <tr>
                  <td className="full">
                    <b>${it.label}</b>${it.expected_qty > 1 && html`<span className="qty-badge">×${it.expected_qty}</span>`}
                    ${it.kit && html`<div className="kit">${it.kit}</div>`}
                  </td>
                  <td className="full">${it.what_to_check}</td>
                  <td className="hide-sm">${it.expected_qty}</td>
                  <td className=${result !== "OK" ? "flag" : ""}>
                    <select
                      disabled=${!canEdit}
                      aria-label=${"Result for " + it.label}
                      value=${result}
                      onChange=${(e) => setRes({ ...res, [it.id]: e.target.value })}
                    >
                      ${RESULTS.map((r) => html`<option key=${r} value=${r}>${lbl(r)}</option>`)}
                    </select>
                  </td>
                  <td>
                    <input
                      disabled=${!canEdit}
                      placeholder="Note"
                      aria-label=${"Note for " + it.label}
                      value=${notes[it.id] || ""}
                      onChange=${(e) => setNotes({ ...notes, [it.id]: e.target.value })}
                    />
                  </td>
                </tr>
              <//>`;
            })}
          </tbody>
        </table>
      </div>
      ${!items.length && html`<p className="mute">No checklist set up for ${cs} yet.</p>`}
      ${items.length > 0 &&
      html`<div className="sticky-actions">
        <span className=${flagged ? "bad" : "mute"}>
          ${flagged ? `${flagged} item${flagged > 1 ? "s" : ""} flagged` : "All items marked OK"}
        </span>
        <button className="primary" disabled=${!canEdit || busy} onClick=${submit}>
          ${busy ? "Saving…" : "Complete HOTO"}
        </button>
      </div>`}
    </div>
    <div className="panel">
      <h3>Equipment on ${cs}</h3>
      <div className="grid" style=${{ marginTop: 10 }}>
        ${eq.map(
          (e) =>
            html`<div
              key=${e.equipment_id}
              style=${{
                border: "1px solid var(--line)",
                padding: 10,
                borderRadius: 4,
              }}
            >
              <b>${e.name}</b><br /><span className="mute"
                >${e.serial_number || "No serial number"}</span
              >
            </div>`,
        )}
        ${!eq.length &&
        html`<span className="mute">Nothing assigned to this appliance.</span>`}
      </div>
    </div>
  </div>`;
}

function Tracker({ db, run, busy, station, onDuty, canEdit }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState("ALL");
  // The status change being edited: { id, to, appliance, note }. Replaces prompt(), which
  // can't choose an appliance and is unreliable in an installed (standalone) web app.
  const [edit, setEdit] = useState(null);
  const apps = db.appliances.filter((a) => a.station_id === station.id);
  const eq = db.equipment
    .filter((e) => e.station_id === station.id)
    .filter((e) => f === "ALL" || e.status === f)
    .filter((e) =>
      (e.name + " " + (e.serial_number || ""))
        .toLowerCase()
        .includes(q.toLowerCase()),
    );
  const names = Object.fromEntries(db.users.map((u) => [u.user_id, u.username]));
  const byId = Object.fromEntries(db.equipment.map((e) => [e.equipment_id, e]));

  const start = (e, to) => {
    if (to === e.status) return setEdit(null);
    setEdit({
      id: e.equipment_id,
      to,
      // Back onto an appliance: suggest the only one, otherwise make the user choose.
      appliance: to === "ON_APPLIANCE" && apps.length === 1 ? apps[0].callsign : "",
      note: "",
    });
  };
  const save = async (e) => {
    const ok = await run(
      () =>
        api("/api/equipment/" + e.equipment_id + "/status", "POST", {
          to_status: edit.to,
          appliance: edit.to === "ON_APPLIANCE" ? edit.appliance : undefined,
          note: edit.note,
        }),
      e.name + " set to " + lbl(edit.to),
    );
    if (ok) setEdit(null);
  };

  const log = db.log
    .filter((l) => byId[l.equipment_id]?.station_id === station.id)
    .slice()
    .reverse();
  return html`<div>
    ${!onDuty && html`<${Lock} />`}
    <div className="panel">
      <h2>Equipment</h2>
      <div className="row" style=${{ marginBottom: 10, gap: 8 }}>
        <input
          type="search"
          style=${{ flex: "1 1 220px", maxWidth: 320 }}
          placeholder="Search name or serial number"
          aria-label="Search equipment"
          value=${q}
          onInput=${(e) => setQ(e.target.value)}
        />
        <select
          style=${{ width: "auto", flex: "0 1 auto" }}
          aria-label="Filter by status"
          value=${f}
          onChange=${(e) => setF(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          ${STATUSES.map((s) => html`<option key=${s} value=${s}>${lbl(s)}</option>`)}
        </select>
      </div>
      <div className="scroll">
        <table className="cards">
          <thead>
            <tr>
              <th>Name</th>
              <th>Serial no.</th>
              <th>Location</th>
              <th>Status</th>
              <th>Change status</th>
            </tr>
          </thead>
          <tbody>
            ${eq.map((e) => {
              const editing = edit?.id === e.equipment_id;
              return html`<${Fragment} key=${e.equipment_id}>
                <tr>
                  <td className="full">
                    <b>${e.name}</b>${e.notes && html`<div className="mute">${e.notes}</div>`}
                  </td>
                  <td data-label="Serial no.">${e.serial_number || "NA"}</td>
                  <td data-label="Location">${e.appliance || "Store"}</td>
                  <td><${Pill} s=${e.status} /></td>
                  <td>
                    <select
                      disabled=${!canEdit || busy}
                      aria-label=${"Change status of " + e.name}
                      value=${editing ? edit.to : e.status}
                      onChange=${(ev) => start(e, ev.target.value)}
                    >
                      ${STATUSES.map(
                        (s) =>
                          html`<option
                            key=${s}
                            value=${s}
                            disabled=${s === "SERVICING" && e.status !== "SERVICING"}
                          >
                            ${s === "SERVICING" && e.status !== "SERVICING"
                              ? "Servicing (use Send for servicing)"
                              : lbl(s)}
                          </option>`,
                      )}
                    </select>
                  </td>
                </tr>
                ${editing &&
                html`<tr className="edit-row">
                  <td colSpan="5" className="full">
                    <div className="row" style=${{ gap: 8 }}>
                      <span className="mute" style=${{ flex: "0 0 auto" }}>
                        ${lbl(e.status)} → <b>${lbl(edit.to)}</b>
                      </span>
                      ${edit.to === "ON_APPLIANCE" &&
                      html`<select
                        style=${{ width: "auto" }}
                        aria-label=${"Appliance for " + e.name}
                        value=${edit.appliance}
                        onChange=${(ev) => setEdit({ ...edit, appliance: ev.target.value })}
                      >
                        <option value="">Choose appliance</option>
                        ${apps.map(
                          (a) => html`<option key=${a.callsign} value=${a.callsign}>${a.callsign}</option>`,
                        )}
                      </select>`}
                      <input
                        style=${{ flex: 1, minWidth: 180 }}
                        placeholder="Note for this change (optional)"
                        aria-label=${"Note for " + e.name}
                        value=${edit.note}
                        onInput=${(ev) => setEdit({ ...edit, note: ev.target.value })}
                      />
                      <button
                        className="primary"
                        disabled=${busy || !canEdit || (edit.to === "ON_APPLIANCE" && !edit.appliance)}
                        onClick=${() => save(e)}
                      >
                        Save
                      </button>
                      <button disabled=${busy} onClick=${() => setEdit(null)}>Cancel</button>
                    </div>
                  </td>
                </tr>`}
              <//>`;
            })}
          </tbody>
        </table>
      </div>
      ${!eq.length && html`<p className="mute">No equipment matches.</p>`}
    </div>
    <div className="panel">
      <h2>Change log</h2>
      ${!log.length
        ? html`<p className="mute">
            No changes recorded yet. Status changes made above appear here.
          </p>`
        : html`<div className="scroll">
            <table className="cards">
              <thead>
                <tr>
                  <th>When</th>
                  <th>By</th>
                  <th>Equipment</th>
                  <th>Change</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                ${log.map(
                  (l) =>
                    html`<tr key=${l.id}>
                      <td data-label="When">${l.changed_at}</td>
                      <td data-label="By">${names[l.changed_by] || "Unknown user"}</td>
                      <td className="full"><b>${byId[l.equipment_id]?.name}</b></td>
                      <td className="full">
                        ${l.from_status
                          ? `${lbl(l.from_status)} → ${lbl(l.to_status)}`
                          : `Registered as ${lbl(l.to_status)}`}
                      </td>
                      <td className="full mute">${l.note}</td>
                    </tr>`,
                )}
              </tbody>
            </table>
          </div>`}
    </div>
  </div>`;
}

function Service({ db, run, busy, station, onDuty, canEdit }) {
  const eq = db.equipment.filter(
    (e) => e.station_id === station.id && e.status !== "SERVICING",
  );

  const blank = {
    equipment_id: "",
    serial_number: "",
    material_number: "",
    fixed_asset_id: "",
    ats_id: "",
    nsf_id: "",
    sto_number: "",
    is_number: "",
    fault_description: "",
  };

  const [f, setF] = useState(blank);
  const [pvFault, setPvFault] = useState(null);
  const [ldFile, setLdFile] = useState(null);
  const [err, setErr] = useState("");
  // Bumped after a successful submit to remount (and so clear) the file inputs.
  const [fileKey, setFileKey] = useState(0);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Prefill the serial number from the equipment record; the officer can still edit it.
  const selectEquipment = (e) => {
    const item = eq.find((x) => String(x.equipment_id) === e.target.value);
    setF({
      ...f,
      equipment_id: e.target.value,
      serial_number: item?.serial_number || "",
    });
  };

  const send = async () => {
    if (!f.equipment_id) return setErr("Please select an equipment.");
    if (!f.fixed_asset_id.trim()) return setErr("Please enter Fixed Asset ID or NA.");
    if (!f.ats_id.trim()) return setErr("Please enter AS ID or NA.");
    if (!f.fault_description.trim()) return setErr("Please describe the equipment fault.");
    setErr("");

    const formData = new FormData();
    for (const [k, v] of Object.entries(f)) formData.append(k, v.trim());
    if (pvFault) formData.append("pv_fault", pvFault);
    if (ldFile) formData.append("l_d", ldFile);

    const ok = await run(
      () => api("/api/service", "POST", formData),
      "Service request submitted successfully",
    );
    if (ok) {
      setF(blank);
      setPvFault(null);
      setLdFile(null);
      setFileKey((k) => k + 1);
    }
  };

  const mine = db.service.filter(
    (s) =>
      db.equipment.find((e) => e.equipment_id === s.equipment_id)
        ?.station_id === station.id,
  );

  const field = (label, key, placeholder = "", required = false) => {
    return html`
      <div className="form-group">
        <label htmlFor=${"service-" + key}>
          ${label}${required ? " *" : ""}
        </label>
        <input
          id=${"service-" + key}
          type="text"
          placeholder=${placeholder}
          value=${f[key]}
          onInput=${set(key)}
        />
      </div>
    `;
  };

  // Reject an oversize file and clear any earlier pick, so what's sent always matches what's shown.
  const pickFile = (setter, what) => (e) => {
    const file = e.target.files[0] || null;
    if (file && file.size > MAX_FILE) {
      setErr(what + " must not exceed 10 MB.");
      e.target.value = "";
      setter(null);
      return;
    }
    setErr("");
    setter(file);
  };

  return html`
    <div>
      ${!onDuty && html`<${Lock} />`}
      <div className="panel">
        <h2>Equipment Fault Report</h2>
        <p className="mute" style=${{ marginTop: 0 }}>Estimated time to complete this form: 5 minutes</p>

        <div className="form-group">
          <label htmlFor="service-equipment">1. Equipment Name *</label>
          <ul className="instruction-list">
            <li>Select the equipment you wish to report.</li>
            <li>Only equipment not currently under servicing is shown.</li>
          </ul>

          <select
            id="service-equipment"
            value=${f.equipment_id}
            onChange=${selectEquipment}
          >
            <option value="">Select an option</option>
            ${eq.map(
              (e) => html`
                <option key=${e.equipment_id} value=${e.equipment_id}>
                  ${e.name}${e.serial_number ? ` (${e.serial_number})` : ""}
                </option>
              `,
            )}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="service-serial_number">2. Equipment Serial Number</label>
          <ul className="instruction-list">
            <li>Filled in from the equipment record. Key NA if it is not applicable.</li>
          </ul>
          <input
            id="service-serial_number"
            value=${f.serial_number}
            onInput=${set("serial_number")}
            placeholder="Enter equipment serial number"
          />
        </div>

        ${field("3. Material Number", "material_number", "Enter material number or NA")}
        ${field("4. Fixed Asset ID", "fixed_asset_id", "Enter Fixed Asset ID or NA", true)}
        ${field("5. AS ID", "ats_id", "Enter AS ID or NA", true)}
        ${field("6. NSF ID", "nsf_id", "Enter NSF ID or NA")}
        ${field("7. STO Number", "sto_number", "For STL use only")}
        ${field("8. IS Number", "is_number", "For STL use only")}

        <div className="form-group">
          <label htmlFor="service-fault">9. Fault Description *</label>

          <ul className="instruction-list">
            <li>
              Please provide a DETAILED description of equipment faults and/or
              damages.
            </li>
            <li>
              Example: The chainsaw can start but cannot idle. Revving the
              engine does not help. There is enough fuel in the tank.
            </li>
            <li>
              Keywords you can use: Unable To Start, Chain Jammed, Recoil
              Starter Faulty, Trigger Faulty, Throttle Faulty, Engine No Power,
              Engine Stalling, Loose Belt, Fuel Tank Leak, Starter Rope Snap, No
              Display/Image On Screen, Switch Faulty, Battery Faulty, Loose
              Connection, Tank Leak, Unable To Couple, Unable To On, Unable To
              Analyze, Battery Cannot Turn On, Self-Test Fail, Screen Crack,
              Front Panel Faulty, Body Crack, Missing Screw, Buckle Strap
              Faulty, Lever Faulty, Leaking, Calibration, Blurred Screen, No
              Connection, Maintenance Error, Clutch Faulty, Steering Faulty,
              Gear Cannot Engage, Printer Faulty, Unable To Charge, Unable To
              Convert, Torn Cushion, Wheel Jammed, Cylinder Jammed, Hydrotest.
            </li>
          </ul>

          <textarea
            id="service-fault"
            rows="6"
            placeholder="Describe the equipment fault or damage..."
            value=${f.fault_description}
            onInput=${set("fault_description")}
          ></textarea>
        </div>
        <div className="form-group">
          <label htmlFor="service-pv-fault">10. Photo / Video of Fault</label>
          <ul className="instruction-list">
            <li>Upload a photo (JPG, PNG) or video (MP4, MOV) showing the fault.</li>
            <li>Maximum file size: 10 MB.</li>
          </ul>
          <input
            key=${"pv-" + fileKey}
            id="service-pv-fault"
            type="file"
            accept="image/png,image/jpeg,video/mp4,video/quicktime"
            onChange=${pickFile(setPvFault, "Photo/video")}
          />
          ${pvFault && html`<small>Selected: ${pvFault.name}</small>`}
        </div>

        <div className="form-group">
          <label htmlFor="service-ld">11. L&D Attachment</label>
          <ul className="instruction-list">
            <li>Upload the relevant L&D document (PDF, JPG or PNG).</li>
            <li>Maximum file size: 10 MB.</li>
          </ul>
          <input
            key=${"ld-" + fileKey}
            id="service-ld"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange=${pickFile(setLdFile, "L&D attachment")}
          />
          ${ldFile && html`<small>Selected: ${ldFile.name}</small>`}
        </div>
        <p className="mute">* Required fields</p>
        ${err && html`<p style=${{ color: "var(--bad)" }} role="alert">${err}</p>`}

        <div style=${{ marginTop: 16 }}>
          <button
            className="primary"
            disabled=${!canEdit || !eq.length || busy}
            onClick=${send}
          >
            ${busy ? "Submitting…" : "Submit Fault Report"}
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Requests from this station</h3>

        ${!mine.length
          ? html`<p className="mute">No service requests yet.</p>`
          : html`
              <div className="scroll" style=${{ marginTop: 10 }}>
                <table className="cards">
                  <thead>
                    <tr>
                      <th>Submitted</th>
                      <th>Equipment</th>
                      <th>Serial Number</th>
                      <th>Fault</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${mine
                      .slice()
                      .reverse()
                      .map((s) => {
                        const equipment = db.equipment.find(
                          (e) => e.equipment_id === s.equipment_id,
                        );
                        return html`
                          <tr key=${s.id}>
                            <td data-label="Submitted">${s.submitted_at}</td>
                            <td className="full"><b>${equipment?.name || "Unknown"}</b></td>
                            <td data-label="Serial no.">${s.serial_number || "NA"}</td>
                            <td className="full">${s.fault_description}</td>
                            <td data-label="Status">
                              ${lbl(s.status)}${s.closed_at &&
                              html`<div className="mute">${s.closed_at}</div>`}
                            </td>
                          </tr>
                        `;
                      })}
                  </tbody>
                </table>
              </div>
            `}
      </div>
    </div>
  `;
}

function Init({ db, run, busy, station, offline }) {
  const blank = {
    serial: "",
    name: "",
    status: "STORE",
    appliance: "",
    notes: "",
  };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  const apps = db.appliances.filter((a) => a.station_id === station.id);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = async () => {
    if (f.status === "ON_APPLIANCE" && !f.appliance) {
      setErr("Choose which appliance this item is on.");
      return;
    }
    setErr("");
    const ok = await run(
      () =>
        api("/api/equipment", "POST", {
          serial_number: f.serial.trim() || null,
          name: f.name.trim(),
          status: f.status,
          appliance: f.status === "ON_APPLIANCE" ? f.appliance : null,
          notes: f.notes.trim(),
        }),
      "Equipment added to " + station.name,
    );
    if (ok) setF(blank);
  };
  return html`<div className="panel">
    <h2>Add equipment to ${station.name}</h2>
    <label htmlFor="sn">Serial number or barcode</label>
    <input
      id="sn"
      autoFocus
      placeholder="Scan or type. Leave empty if the item has none."
      value=${f.serial}
      onChange=${set("serial")}
    />
    <label htmlFor="nm">Name</label
    ><input id="nm" value=${f.name} onChange=${set("name")} />
    <div className="grid">
      <div>
        <label htmlFor="st">Status</label
        ><select id="st" value=${f.status} onChange=${set("status")}>
          ${STATUSES.filter((s) => s !== "SERVICING").map(
            (s) => html`<option key=${s} value=${s}>${lbl(s)}</option>`,
          )}
        </select>
      </div>
      ${f.status === "ON_APPLIANCE" &&
      html`<div>
        <label htmlFor="ap">Appliance</label
        ><select id="ap" value=${f.appliance} onChange=${set("appliance")}>
          <option value="">Choose appliance</option>
          ${apps.map(
            (a) =>
              html`<option key=${a.callsign} value=${a.callsign}>
                ${a.callsign}
              </option>`,
          )}
        </select>
      </div>`}
    </div>
    <label htmlFor="nt">Notes</label
    ><input id="nt" value=${f.notes} onChange=${set("notes")} />
    <p className="mute">To send a new item for servicing, add it first, then use Send for servicing.</p>
    ${err && html`<p style=${{ color: "var(--bad)" }} role="alert">${err}</p>`}
    <div style=${{ marginTop: 12 }}>
      <button
        className="primary"
        disabled=${!f.name.trim() || busy || offline}
        onClick=${add}
      >
        Add equipment
      </button>
    </div>
  </div>`;
}

export default App;
