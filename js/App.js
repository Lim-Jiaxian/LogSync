import { useState, useEffect, createElement } from 'react';
import htm from 'htm';
import { api, getToken, logout } from './api.js';
const html = htm.bind(createElement);
const STATUSES=['ON_APPLIANCE','STORE','SERVICING','LOANED_OUT','MISSING','OTHER'];
const RESULTS=['OK','MISSING','FAULTY','QTY_MISMATCH'];
const lbl=s=>s.replace(/_/g,' ').toLowerCase().replace(/^./,c=>c.toUpperCase());


function App(){
 const [db,setDb]=useState(null);
 const [tab,setTab]=useState('armoury');
 const [toast,setToast]=useState('');
 const [error,setError]=useState('');
 const load=()=>api('/api/data').then(setDb).catch(e=>setError(e.message));
 useEffect(()=>{ if(!getToken()){window.location.href='/';return} load(); },[]);
 useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),2600);return()=>clearTimeout(t)}},[toast]);
 const notify=m=>setToast(m);
 // Send a change to the server, reload the data, show a message. Returns true if it worked.
 const run=async(fn,ok)=>{
  try{await fn();await load();notify(ok);return true}
  catch(e){notify(e.message);return false}
 };

 if(error) return html`<div class="wrap"><p role="alert">${error}</p><button onClick=${logout}>Back to login</button></div>`;
 if(!db) return html`<div class="wrap"><p class="mute">Loading…</p></div>`;

 const user=db.me;
 const station=db.stations[0];
 const onDuty=user.rota===db.dutyRota;
 const tabs=[['armoury','Armoury'],['tracker','Equipment & log']];
 if(user.role!=='FF') tabs.push(['service','Send for servicing']);
 if(user.role==='IC') tabs.push(['init','Add equipment']);
 const ctx={db,run,user,station,onDuty};

 return html`<div>
  <header class="bar">
   <div><h1>${station.name}</h1><span style=${{opacity:.75}}>Division ${station.division} · ${user.username}, ${user.role}, rota ${user.rota}</span></div>
   <div class="row">
    ${onDuty?html`<span class="duty">ON DUTY · EDITING OPEN</span>`:html`<span style=${{opacity:.8}}>Off duty (rota ${db.dutyRota} is on) · view only</span>`}
    <button onClick=${logout}>Log out</button>
   </div>
  </header>
  <main class="wrap">
   <div class="tabs" role="tablist">
    ${tabs.map(([k,t])=>html`<button key=${k} role="tab" aria-selected=${tab===k} onClick=${()=>setTab(k)}>${t}</button>`)}
   </div>
   ${tab==='armoury'&&html`<${Armoury} ...${ctx}/>`}
   ${tab==='tracker'&&html`<${Tracker} ...${ctx}/>`}
   ${tab==='service'&&user.role!=='FF'&&html`<${Service} ...${ctx}/>`}
   ${tab==='init'&&user.role==='IC'&&html`<${Init} ...${ctx}/>`}
  </main>
  ${toast&&html`<div class="toast" role="status">${toast}</div>`}
 </div>`;
}

const Lock=()=>html`<div class="lock">Editing is open only on your rota’s duty day. You can still view everything.</div>`;
const Pill=({s})=>html`<span class=${'pill '+s}>${lbl(s)}</span>`;

function Armoury({db,run,user,station,onDuty}){
 const apps=db.appliances.filter(a=>a.station_id===station.id);
 const [cs,setCs]=useState(apps[0]?.callsign);
 const [res,setRes]=useState({});
 const [notes,setNotes]=useState({});
 const items=db.checklist.filter(c=>c.appliance===cs);
 const eq=db.equipment.filter(e=>e.appliance===cs);
 const submit=()=>{
  run(()=>api('/api/hoto','POST',{appliance:cs,results:items.map(it=>({item_id:it.id,result:res[it.id]||'OK',note:notes[it.id]||''}))}),'HOTO saved for '+cs);
  setRes({});setNotes({});
 };
 const last=[...db.hoto].reverse().find(h=>h.appliance===cs);
 if(!apps.length) return html`<div class="panel">No appliances registered at this station yet.</div>`;
 return html`<div>
  <div class="row" style=${{marginBottom:12}}>
   ${apps.map(a=>html`<button key=${a.callsign} class=${cs===a.callsign?'primary':''} onClick=${()=>{setCs(a.callsign);setRes({});}}>${a.callsign} · ${a.type}</button>`)}
  </div>
  ${!onDuty&&html`<${Lock}/>`}
  <div class="panel">
   <h2>${cs} handover/takeover checklist</h2>
   <p class="mute" style=${{marginTop:0}}>${last?`Last HOTO: rota ${last.rota}, ${last.completed_at}`:'No HOTO recorded yet.'}</p>
   <div class="scroll"><table>
    <thead><tr><th>Item</th><th>What to check</th><th>Qty</th><th>Result</th><th>Note</th></tr></thead>
    <tbody>${items.map(it=>html`<tr key=${it.id}>
     <td><b>${it.label}</b></td><td>${it.what_to_check}</td><td>${it.expected_qty}</td>
     <td><select disabled=${!onDuty} aria-label=${'Result for '+it.label} value=${res[it.id]||'OK'} onChange=${e=>setRes({...res,[it.id]:e.target.value})}>
      ${RESULTS.map(r=>html`<option key=${r} value=${r}>${lbl(r)}</option>`)}</select></td>
     <td><input disabled=${!onDuty} aria-label=${'Note for '+it.label} value=${notes[it.id]||''} onChange=${e=>setNotes({...notes,[it.id]:e.target.value})}/></td></tr>`)}</tbody>
   </table></div>
   <div style=${{marginTop:12}}><button class="primary" disabled=${!onDuty||!items.length} onClick=${submit}>Complete HOTO</button></div>
  </div>
  <div class="panel">
   <h3>Equipment on ${cs}</h3>
   <div class="grid" style=${{marginTop:10}}>
    ${eq.map(e=>html`<div key=${e.equipment_id} style=${{border:'1px solid var(--line)',padding:10,borderRadius:4}}>
     <b>${e.name}</b><br/><span class="mute">${e.serial_number||'No serial number'}</span></div>`)}
    ${!eq.length&&html`<span class="mute">Nothing assigned to this appliance.</span>`}
   </div>
  </div>
 </div>`;
}

function Tracker({db,run,user,station,onDuty}){
 const [q,setQ]=useState('');
 const [f,setF]=useState('ALL');
 const eq=db.equipment.filter(e=>e.station_id===station.id)
  .filter(e=>f==='ALL'||e.status===f)
  .filter(e=>(e.name+' '+(e.serial_number||'')).toLowerCase().includes(q.toLowerCase()));
 const names=Object.fromEntries(db.users.map(u=>[u.user_id,u.username]));
 const change=(e,to)=>{
  const note=prompt('Add a note for this change (optional)')||'';
  run(()=>api('/api/equipment/'+e.equipment_id+'/status','POST',{to_status:to,note}),e.name+' set to '+lbl(to));
 };
 const log=db.log.filter(l=>db.equipment.find(e=>e.equipment_id===l.equipment_id)?.station_id===station.id).slice().reverse();
 return html`<div>
  ${!onDuty&&html`<${Lock}/>`}
  <div class="panel">
   <h2>Equipment</h2>
   <div class="row" style=${{marginBottom:10}}>
    <input style=${{maxWidth:260}} placeholder="Search name or serial number" aria-label="Search equipment" value=${q} onInput=${e=>setQ(e.target.value)}/>
    <select style=${{width:'auto'}} aria-label="Filter by status" value=${f} onChange=${e=>setF(e.target.value)}>
     <option value="ALL">All statuses</option>${STATUSES.map(s=>html`<option key=${s} value=${s}>${lbl(s)}</option>`)}</select>
   </div>
   <div class="scroll"><table>
    <thead><tr><th>Name</th><th>Serial no.</th><th>Location</th><th>Status</th><th>Change status</th></tr></thead>
    <tbody>${eq.map(e=>html`<tr key=${e.equipment_id}>
     <td><b>${e.name}</b>${e.notes&&html`<br/><span class="mute">${e.notes}</span>`}</td>
     <td>${e.serial_number||'NA'}</td><td>${e.appliance||'Store'}</td><td><${Pill} s=${e.status}/></td>
     <td><select disabled=${!onDuty} aria-label=${'Change status of '+e.name} value=${e.status} onChange=${ev=>change(e,ev.target.value)}>
      ${STATUSES.map(s=>html`<option key=${s} value=${s}>${lbl(s)}</option>`)}</select></td></tr>`)}</tbody>
   </table></div>
   ${!eq.length&&html`<p class="mute">No equipment matches.</p>`}
  </div>
  <div class="panel">
   <h2>Change log</h2>
   ${!log.length?html`<p class="mute">No changes recorded yet. Status changes made above appear here.</p>`:html`<div class="scroll"><table>
    <thead><tr><th>When</th><th>Equipment</th><th>Change</th><th>By</th><th>Note</th></tr></thead>
    <tbody>${log.map(l=>html`<tr key=${l.id}><td>${l.changed_at}</td>
     <td>${db.equipment.find(e=>e.equipment_id===l.equipment_id).name}</td>
     <td>${lbl(l.from_status)} → ${lbl(l.to_status)}</td><td>${names[l.changed_by]}</td><td>${l.note}</td></tr>`)}</tbody></table></div>`}
  </div>
 </div>`;
}

function Service({db,run,user,station}){
 const eq=db.equipment.filter(e=>e.station_id===station.id&&e.status!=='SERVICING');
 const [id,setId]=useState('');
 const [fault,setFault]=useState('');
 const mine=db.service.filter(s=>db.equipment.find(e=>e.equipment_id===s.equipment_id)?.station_id===station.id);
 const send=()=>{
  run(()=>api('/api/service','POST',{equipment_id:+id,fault_description:fault.trim()}),'Service request submitted')
   .then(ok=>{if(ok){setId('');setFault('')}});
 };
 return html`<div>
  <div class="panel">
   <h2>Send equipment for servicing</h2>
   <label for="se">Equipment</label>
   <select id="se" value=${id} onChange=${e=>setId(e.target.value)}>
    <option value="">Choose equipment</option>
    ${eq.map(e=>html`<option key=${e.equipment_id} value=${e.equipment_id}>${e.name} (${e.serial_number||'no serial'})</option>`)}</select>
   <label for="fd">Fault description</label>
   <textarea id="fd" rows="3" value=${fault} onChange=${e=>setFault(e.target.value)}></textarea>
   <div style=${{marginTop:12}}><button class="primary" disabled=${!id||!fault.trim()} onClick=${send}>Submit service request</button></div>
   <p class="mute">Submitting marks the item as Servicing and records it in the change log.</p>
  </div>
  <div class="panel"><h3>Requests from this station</h3>
   ${!mine.length?html`<p class="mute">No service requests yet.</p>`:html`<div class="scroll"><table><thead><tr><th>Submitted</th><th>Equipment</th><th>Fault</th><th>Status</th></tr></thead>
   <tbody>${mine.slice().reverse().map(s=>html`<tr key=${s.id}><td>${s.submitted_at}</td><td>${db.equipment.find(e=>e.equipment_id===s.equipment_id).name}</td><td>${s.fault_description}</td><td>${lbl(s.status)}</td></tr>`)}</tbody></table></div>`}
  </div>
 </div>`;
}

function Init({db,run,station}){
 const blank={serial:'',name:'',status:'STORE',appliance:'',notes:''};
 const [f,setF]=useState(blank);
 const [err,setErr]=useState('');
 const apps=db.appliances.filter(a=>a.station_id===station.id);
 const set=k=>e=>setF({...f,[k]:e.target.value});
 const add=()=>{
  if(f.status==='ON_APPLIANCE'&&!f.appliance){setErr('Choose which appliance this item is on.');return}
  setErr('');
  run(()=>api('/api/equipment','POST',{serial_number:f.serial.trim()||null,name:f.name.trim(),status:f.status,appliance:f.status==='ON_APPLIANCE'?f.appliance:null,notes:f.notes}),'Equipment added to '+station.name)
   .then(ok=>{if(ok)setF(blank)});
 };
 return html`<div class="panel">
  <h2>Add equipment to ${station.name}</h2>
  <label for="sn">Serial number or barcode</label>
  <input id="sn" autoFocus placeholder="Scan or type. Leave empty if the item has none." value=${f.serial} onChange=${set('serial')}/>
  <label for="nm">Name</label><input id="nm" value=${f.name} onChange=${set('name')}/>
  <div class="grid">
   <div><label for="st">Status</label><select id="st" value=${f.status} onChange=${set('status')}>${STATUSES.map(s=>html`<option key=${s} value=${s}>${lbl(s)}</option>`)}</select></div>
   ${f.status==='ON_APPLIANCE'&&html`<div><label for="ap">Appliance</label><select id="ap" value=${f.appliance} onChange=${set('appliance')}>
    <option value="">Choose appliance</option>${apps.map(a=>html`<option key=${a.callsign} value=${a.callsign}>${a.callsign}</option>`)}</select></div>`}
  </div>
  <label for="nt">Notes</label><input id="nt" value=${f.notes} onChange=${set('notes')}/>
  ${err&&html`<p style=${{color:'var(--bad)'}} role="alert">${err}</p>`}
  <div style=${{marginTop:12}}><button class="primary" disabled=${!f.name.trim()} onClick=${add}>Add equipment</button></div>
 </div>`;
}

export default App;
