import { useState, useEffect, createElement } from 'react';
import htm from 'htm';
import { SEED } from './data.js';
const html = htm.bind(createElement);
const STATUSES=['ON_APPLIANCE','STORE','SERVICING','LOANED_OUT','MISSING','OTHER'];
const RESULTS=['OK','MISSING','FAULTY','QTY_MISMATCH'];
const lbl=s=>s.replace(/_/g,' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
const now=()=>new Date().toISOString().slice(0,16).replace('T',' ');
// One known reference day (from 08:00 onwards). Every other time is calculated from it.
const ROTA_ANCHOR = { date: '2026-11-18', rota: 3 };
const ROTA_COUNT = 3;
const HANDOVER_HOUR = 8; // the duty day changes over at 08:00

// Rotas run 3, 2, 1, 3, 2, 1... one duty day = 08:00 to 08:00
// 18/11 before 08:00 = R1, from 08:00 = R3 | 19/11 before 08:00 = R3, from 08:00 = R2
const rotaOn = (when = new Date()) => {
  // Shift back by the handover hour so 00:00-07:59 still counts as the previous duty day
  const shifted = new Date(when.getTime() - HANDOVER_HOUR * 36e5);
  const [y, m, d] = ROTA_ANCHOR.date.split('-').map(Number);
  const anchor = Date.UTC(y, m - 1, d);
  const today = Date.UTC(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
  const days = Math.round((today - anchor) / 864e5);
  return ((ROTA_ANCHOR.rota - 1 - days) % ROTA_COUNT + ROTA_COUNT) % ROTA_COUNT + 1;
};
const rotaToday = () => rotaOn();


function App(){
 const [db,setDb]=useState(SEED);
 const [uid,setUid]=useState(null);
 const [tab,setTab]=useState('armoury');
 const [toast,setToast]=useState('');
 const [duty,setDuty]=useState(rotaToday());
 const user=db.users.find(u=>u.user_id===uid);
 useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),2600);return()=>clearTimeout(t)}},[toast]);
 const up=fn=>setDb(d=>fn(structuredClone(d)));
 const notify=m=>setToast(m);

 if(!user) return html`<div class="wrap"><div class="who">
  <h1>Station armoury</h1>
  <p class="mute">Choose a sample account. In production this is replaced by Singpass sign-in.</p>
  ${db.users.map(u=>html`<button key=${u.user_id} onClick=${()=>{setUid(u.user_id);setTab('armoury')}}>
   <span><b>${u.username}</b><br/><span class="mute">${db.stations.find(s=>s.id===u.station_id).name}</span></span>
   <span class="mute">Rota ${u.rota}</span></button>`)}
 </div></div>`;

 const station=db.stations.find(s=>s.id===user.station_id);
 const onDuty=user.rota===duty;
 const tabs=[['armoury','Armoury'],['tracker','Equipment & log']];
 if(user.role!=='FF') tabs.push(['service','Send for servicing']);
 if(user.role==='IC') tabs.push(['init','Add equipment']);
 const ctx={db,up,user,station,onDuty,notify};

 return html`<div>
  <header class="bar">
   <div><h1>${station.name}</h1><span style=${{opacity:.75}}>Division ${station.division} · ${user.username}, ${user.role}, rota ${user.rota}</span></div>
   <div class="row">
    ${onDuty?html`<span class="duty">ON DUTY · EDITING OPEN</span>`:html`<span style=${{opacity:.8}}>Off duty (rota ${duty} is on) · view only</span>`}
    <button onClick=${()=>setUid(null)}>Switch user</button>
   </div>
  </header>
  <main class="wrap">
   <div class="panel row" style=${{padding:'8px 14px'}}>
    <span class="mute">Demo: duty rota today</span>
    <select style=${{width:'auto'}} aria-label="Duty rota today" value=${duty} onChange=${e=>setDuty(+e.target.value)}>
     ${[1,2,3].map(r=>html`<option key=${r} value=${r}>Rota ${r}</option>`)}
    </select>
   </div>
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

function Armoury({db,up,user,station,onDuty,notify}){
 const apps=db.appliances.filter(a=>a.station_id===station.id);
 const [cs,setCs]=useState(apps[0]?.callsign);
 const [res,setRes]=useState({});
 const [notes,setNotes]=useState({});
 const items=db.checklist.filter(c=>c.appliance===cs);
 const eq=db.equipment.filter(e=>e.appliance===cs);
 const submit=()=>{
  up(d=>{
   const id=d.hoto.length+1;
   d.hoto.push({id,appliance:cs,rota:user.rota,completed_by:user.user_id,completed_at:now()});
   items.forEach(it=>{
    d.results.push({id:d.results.length+1,record_id:id,item_id:it.id,result:res[it.id]||'OK',note:notes[it.id]||''});
   });
   return d;
  });
  setRes({});setNotes({});notify('HOTO saved for '+cs);
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

function Tracker({db,up,user,station,onDuty,notify}){
 const [q,setQ]=useState('');
 const [f,setF]=useState('ALL');
 const eq=db.equipment.filter(e=>e.station_id===station.id)
  .filter(e=>f==='ALL'||e.status===f)
  .filter(e=>(e.name+' '+(e.serial_number||'')).toLowerCase().includes(q.toLowerCase()));
 const names=Object.fromEntries(db.users.map(u=>[u.user_id,u.username]));
 const change=(e,to)=>{
  if(to==='ON_APPLIANCE'&&!db.appliances.some(a=>a.station_id===station.id)) return;
  const app=to==='ON_APPLIANCE'?(e.appliance||db.appliances.find(a=>a.station_id===station.id).callsign):null;
  const note=prompt('Add a note for this change (optional)')||'';
  up(d=>{
   const x=d.equipment.find(i=>i.equipment_id===e.equipment_id);
   d.log.push({id:d.log.length+1,equipment_id:x.equipment_id,from_status:x.status,to_status:to,changed_by:user.user_id,changed_at:now(),note});
   x.status=to;x.appliance=app;return d;
  });
  notify(e.name+' set to '+lbl(to));
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

function Service({db,up,user,station,onDuty,notify}){
 const eq=db.equipment.filter(e=>e.station_id===station.id&&e.status!=='SERVICING');
 const [id,setId]=useState('');
 const [fault,setFault]=useState('');
 const mine=db.service.filter(s=>db.equipment.find(e=>e.equipment_id===s.equipment_id)?.station_id===station.id);
 const send=()=>{
  up(d=>{
   const x=d.equipment.find(e=>e.equipment_id===+id);
   d.service.push({id:d.service.length+1,equipment_id:x.equipment_id,requested_by:user.user_id,fault_description:fault,status:'SUBMITTED',submitted_at:now()});
   d.log.push({id:d.log.length+1,equipment_id:x.equipment_id,from_status:x.status,to_status:'SERVICING',changed_by:user.user_id,changed_at:now(),note:'Service request: '+fault});
   x.status='SERVICING';x.appliance=null;return d;
  });
  setId('');setFault('');notify('Service request submitted');
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

function Init({db,up,user,station,notify}){
 const blank={serial:'',name:'',status:'STORE',appliance:'',notes:''};
 const [f,setF]=useState(blank);
 const [err,setErr]=useState('');
 const apps=db.appliances.filter(a=>a.station_id===station.id);
 const set=k=>e=>setF({...f,[k]:e.target.value});
 const add=()=>{
  const sn=f.serial.trim();
  if(sn&&db.equipment.some(e=>e.serial_number===sn)){setErr('Serial number '+sn+' is already registered.');return}
  if(f.status==='ON_APPLIANCE'&&!f.appliance){setErr('Choose which appliance this item is on.');return}
  setErr('');
  up(d=>{
   const id=Math.max(0,...d.equipment.map(e=>e.equipment_id))+1;
   d.equipment.push({equipment_id:id,serial_number:sn||null,name:f.name.trim(),station_id:station.id,appliance:f.status==='ON_APPLIANCE'?f.appliance:null,status:f.status,notes:f.notes});
   d.log.push({id:d.log.length+1,equipment_id:id,from_status:null,to_status:f.status,changed_by:user.user_id,changed_at:now(),note:'Initialised'});
   return d;
  });
  setF(blank);notify('Equipment added to '+station.name);
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
