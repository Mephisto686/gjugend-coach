import { useState, useEffect, useRef } from "react";
import Dexie from "dexie";
import { BookOpen, Users, CalendarDays, Settings, Plus, Search, Edit2, Trash2, Download, Upload, Shuffle, Filter, Clock, Trophy, Bot, RefreshCw, CheckSquare, Square, Dices, ListChecks, Wallet, Phone, MapPin, AlertTriangle, ShieldCheck } from "lucide-react";

// ── DEXIE DB ──────────────────────────────────────────────────────
const db = new Dexie('GJugendCoachDB');
db.version(1).stores({ kv: 'key' });

const APP_VERSION = "2.9.6";
const BUILTIN_CATS = {
  aufwaermen:   { label:"Aufwärmen",    emoji:"🔥", color:"#ea580c", bg:"#fff7ed", builtin:true },
  koordination: { label:"Koordination", emoji:"🎯", color:"#7c3aed", bg:"#f5f3ff", builtin:true },
  technik:      { label:"Technik",      emoji:"⚽", color:"#2563eb", bg:"#eff6ff", builtin:true },
  spielform:    { label:"Spielform",    emoji:"🏆", color:"#16a34a", bg:"#f0fdf4", builtin:true },
  abschluss:    { label:"Abschluss",   emoji:"🌅", color:"#db2777", bg:"#fdf2f8", builtin:true },
};
// Will be overwritten at runtime with merged builtin+custom cats
let CATS = {...BUILTIN_CATS};
const CUSTOM_CAT_PALETTE = [
  {color:"#0891b2",bg:"#ecfeff"},{color:"#65a30d",bg:"#f7fee7"},
  {color:"#9333ea",bg:"#faf5ff"},{color:"#e11d48",bg:"#fff1f2"},
  {color:"#0369a1",bg:"#f0f9ff"},{color:"#b45309",bg:"#fffbeb"},
];
const PTAGS = ["Dribbeln","Passspiel","Torschuss","Zweikampf","Koordination","Gleichgewicht","Reaktion","Schnelligkeit","Ausdauer","Teamwork","Spaß","Kreativität","Wettkampf","Funino","Motorik","Raumgefühl"];
const PMAT  = ["Hütchen","Bälle","Minitore","Leibchen","Stangen","Reifen","Pylonen","Markierungsscheiben","Seilchen","Tore (groß)"];
const STR = {
  1:{label:"Entdecker", emoji:"🌱",color:"#16a34a",light:"#dcfce7",desc:"Findet den Ball, läuft hinterher – noch kein gezieltes Dribbeln"},
  2:{label:"Entwickler",emoji:"🌟",color:"#b45309",light:"#fef3c7",desc:"Ball unter Kontrolle, einfaches Dribbling – spielt manchmal mit Team"},
  3:{label:"Spieler",   emoji:"⭐",color:"#dc2626",light:"#fee2e2",desc:"Gezieltes Passspiel, Torabschluss – liest einfache Spielsituationen"},
  4:{label:"Antreiber", emoji:"🏆",color:"#1d4ed8",light:"#dbeafe",desc:"Konstant stark, sucht aktiv den Ball – motiviert Mitspieler"},
};
const ROLES = {head:"Cheftrainer",assistant:"Co-Trainer",helper:"Helfer"};
const TCOLORS = ["#ef4444","#3b82f6","#22c55e","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316"];
const C = {nav:"#0f2419",primary:"#166534",accent:"#22c55e",accentL:"#dcfce7",bg:"#f0f4f0",card:"#fff",border:"#e2e8f0",text:"#1e293b",muted:"#64748b"};

// ── UTILITIES ─────────────────────────────────────────────────────
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2);
const now = () => new Date().toISOString();
const fmtDate = s => s?new Date(s).toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}):"";
const todayISO = () => new Date().toISOString().split("T")[0];
// ── SAVE FILE mit Dialog (Android/Desktop: zeigt "Speichern unter") ──
// ── DEBUG EXPORT LOG ──────────────────────────────────────────────
const _dbg = [];
const dbgLog = (msg) => { _dbg.push(`${new Date().toISOString().slice(11,23)} ${msg}`); console.log('[EXPORT]', msg); };
window._getExportLog = () => _dbg.join('\n');

// Synchroner Download-Kern – muss direkt im Click-Handler aufgerufen werden
// bevor irgendein await den User-Gesture-Context zerstört
function saveFileSync(content, filename, mimeType) {
  const mime = mimeType || 'application/json;charset=utf-8';
  dbgLog(`saveFileSync called: ${filename} (${content.length} chars, mime=${mime})`);
  dbgLog(`showSaveFilePicker=${!!window.showSaveFilePicker} userAgent=${navigator.userAgent.slice(0,80)}`);
  // Versuch 1: Blob URL
  try {
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    dbgLog('Blob URL created, calling a.click()...');
    a.click();
    dbgLog('a.click() returned (blob)');
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
    return 'blob';
  } catch(e) { dbgLog(`Blob method failed: ${e.name}: ${e.message}`); }
  // Versuch 2: data: URI
  try {
    const dataUri = 'data:' + mime + ',' + encodeURIComponent(content);
    dbgLog(`data: URI length=${dataUri.length}`);
    const a = document.createElement('a');
    a.href = dataUri; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    dbgLog('Calling a.click() (data: URI)...');
    a.click();
    dbgLog('a.click() returned (datauri)');
    setTimeout(() => document.body.removeChild(a), 500);
    return 'datauri';
  } catch(e) { dbgLog(`data: URI method failed: ${e.name}: ${e.message}`); }
  dbgLog('All sync methods failed');
  return null;
}

const saveFile = async (content, filename, mimeType) => {
  dbgLog(`saveFile async called: ${filename}`);
  // Desktop Chrome/Edge: zeige echten Speichern-Dialog
  if (window.showSaveFilePicker) {
    try {
      const ext = filename.split('.').pop();
      const types = {
        json: [{description:'JSON Datei', accept:{'application/json':['.json']}}],
        csv:  [{description:'CSV Datei',  accept:{'text/csv':['.csv']}}],
      };
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: types[ext] || [{description:'Datei', accept:{'*/*':['.' + ext]}}],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      dbgLog(`picker success: ${handle.name}`);
      return {ok:true, method:'picker', filename: handle.name};
    } catch(e) {
      dbgLog(`picker failed: ${e.name}: ${e.message}`);
      if (e.name === 'AbortError') return {ok:false, method:'cancelled'};
    }
  }
  return {ok:true, method:'sync', filename};
};
// Helper: führt Export durch und zeigt passenden Toast
const doExport = async (content, filename, mimeType, toast) => {
  const syncResult = saveFileSync(content, filename, mimeType);
  if (syncResult) { if(toast) toast(`📥 ${filename} → Downloads`); return; }
  const r = await saveFile(content, filename, mimeType);
  if (!r.ok && r.method === 'cancelled') return;
  if (!r.ok) { toast?.('Export fehlgeschlagen', 'err'); return; }
  if (r.method === 'picker') toast?.(`✅ Gespeichert: ${r.filename}`);
  else toast?.(`📥 ${r.filename} → Downloads`);
};

const dlJson = async (o, n, toast) => {
  const content = JSON.stringify(o, null, 2);
  const mime = 'application/json;charset=utf-8';
  dbgLog(`dlJson called: ${n} (${content.length} chars)`);
  // Sofort synchron auslösen (User-Gesture-Context noch aktiv)
  const syncResult = saveFileSync(content, n, mime); // immer sync zuerst, picker nur als Desktop-Upgrade
  dbgLog(`dlJson syncResult: ${syncResult}`);
  if (syncResult) { if(toast) toast(`📥 ${n} → Downloads`); return {ok:true,method:syncResult,filename:n}; }
  // Desktop: async Picker
  const r = await saveFile(content, n, mime);
  if (!toast || !r) return r;
  if (!r.ok && r.method === 'cancelled') return r;
  if (!r.ok) toast('Export fehlgeschlagen', 'err');
  else if (r.method === 'picker') toast(`✅ Gespeichert: ${r.filename}`);
  else toast(`📥 ${r.filename} → Downloads`);
  return r;
};
const dlCsv = async (rows, cols, n, toast) => {
  const csv = [cols.join(','), ...rows.map(x => cols.map(k => `"${String(x[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const content = '\uFEFF' + csv;
  const mime = 'text/csv;charset=utf-8';
  const syncResult = saveFileSync(content, n, mime);
  if (syncResult) { if(toast) toast(`📥 ${n} → Downloads`); return {ok:true,method:syncResult,filename:n}; }
  const r = await saveFile(content, n, mime);
  if (!toast || !r) return r;
  if (!r.ok && r.method === 'cancelled') return r;
  if (!r.ok) toast('Export fehlgeschlagen', 'err');
  else if (r.method === 'picker') toast(`✅ Gespeichert: ${r.filename}`);
  else toast(`📥 ${r.filename} → Downloads`);
  return r;
};
const exportExJson = (ex) => dlJson(
  {version:APP_VERSION, exportDate:now(), type:'exercises', exercises:[ex]},
  `uebung_${ex.title.replace(/[^a-z0-9]/gi,'_')}_${todayISO()}.json`
);

const buildExHtml = (ex) => {
  const cat=CATS[ex.category]||{};
  const stars='★'.repeat(ex.rating||0)+'☆'.repeat(5-(ex.rating||0));
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>${ex.title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:780px;margin:40px auto;padding:20px 28px;color:#1e293b}h1{font-size:26px;margin:0 0 8px}
.badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:700;background:${cat.bg||'#f1f5f9'};color:${cat.color||'#64748b'}}
.meta{color:#64748b;font-size:14px;margin:10px 0 20px}.stars{color:#f59e0b;font-size:16px;letter-spacing:2px}
.sec{margin:18px 0}.sec h2{font-size:13px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin:0 0 8px}
.box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;font-size:15px;line-height:1.7;white-space:pre-wrap}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600}
.mat{background:#dcfce7;color:#166534}.tag{background:#f1f5f9;color:#64748b}
img{width:100%;max-height:280px;object-fit:cover;border-radius:8px;margin-bottom:18px}
.footer{margin-top:40px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8}
.btns{display:flex;gap:10px;justify-content:flex-end;margin-bottom:20px}
.btn{padding:8px 18px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700}
@media print{body{margin:0;padding:16px}.btns{display:none}}</style></head>
<body>
<div class="btns">
  <button class="btn" style="background:#e2e8f0;color:#1e293b" onclick="window.close()">✕ Schließen</button>
  <button class="btn" style="background:#166534;color:white" onclick="window.print()">🖨 Drucken / PDF speichern</button>
</div>
<h1>${ex.title}</h1>
<span class="badge">${cat.emoji||''} ${cat.label||ex.category}</span>
<div class="meta"><span class="stars">${stars}</span> &nbsp;·&nbsp; ⏱ ${ex.duration} Min &nbsp;·&nbsp; 👥 ${ex.minPlayers}–${ex.maxPlayers} Kinder${ex.source?' &nbsp;·&nbsp; Quelle: '+ex.source:''}</div>
${ex.imageUrl?`<img src="${ex.imageUrl}" alt=""/>`:''} 
${ex.setup?`<div class="sec"><h2>📐 Aufbau</h2><div class="box">${ex.setup}</div></div>`:''}
${ex.description?`<div class="sec"><h2>🎯 Ablauf</h2><div class="box">${ex.description}</div></div>`:''}
${ex.material?.length?`<div class="sec"><h2>📦 Material</h2><div class="chips">${ex.material.map(m=>`<span class="chip mat">📦 ${m}</span>`).join('')}</div></div>`:''}
${ex.tags?.length?`<div class="sec"><h2>🏷️ Tags</h2><div class="chips">${ex.tags.map(t=>`<span class="chip tag">${t}</span>`).join('')}</div></div>`:''}
${ex.notes?`<div class="sec"><h2>💬 Notizen & Varianten</h2><div class="box" style="font-style:italic">${ex.notes}</div></div>`:''}
<div class="footer">G-Jugend Coach v${APP_VERSION} · Erstellt: ${new Date().toLocaleDateString('de-DE')}</div>
</body></html>`;
};

// HTML: In neuem Tab öffnen + als Datei speichern
const exportExHtml = async (ex) => {
  const html = buildExHtml(ex);
  const filename = `uebung_${ex.title.replace(/[^a-z0-9]/gi,'_')}_${todayISO()}.html`;
  // Versuche zuerst Speicherdialog
  const saved = await saveFile(html, filename, 'text/html');
  // Öffne zusätzlich im Browser zum direkten Drucken
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
};

const readText    = f=>new Promise((r,j)=>{const x=new FileReader();x.onload=e=>r(e.target.result);x.onerror=j;x.readAsText(f);});
const readDataURL = f=>new Promise((r,j)=>{const x=new FileReader();x.onload=e=>r(e.target.result);x.onerror=j;x.readAsDataURL(f);});
const parseJsonSafe = t=>{ try{return JSON.parse(t.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim());}catch{return null;} };
const parseCsvPlayers = text=>{ const ls=text.trim().split("\n");if(ls.length<2)return[];const hs=ls[0].split(",").map(h=>h.replace(/"/g,"").trim().toLowerCase());return ls.slice(1).map(l=>{const vs=l.split(",").map(v=>v.replace(/"/g,"").trim()),o={};hs.forEach((h,i)=>o[h]=vs[i]??"");return{id:uid(),createdAt:now(),name:o.name||"?",birthYear:Number(o.birthyear||o.jahrgang||2019),strength:Math.min(4,Math.max(1,Number(o.strength||o.staerke||1))),active:o.active!=="false",jersey:o.jersey||o.trikot||"",notes:o.notes||o.notizen||""};}).filter(p=>p.name&&p.name!=="?"); };

// ── SHUFFLE FIX ───────────────────────────────────────────────────
// Bug vorher: Spieler gleicher Stärke kamen immer in derselben Reihenfolge
// → Fisher-Yates Shuffle löst das
const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

function buildTeams(players,numTeams,mode,skillDist) {
  if(!players.length||!numTeams) return [];
  const n=Math.max(1,numTeams);
  const teams=Array.from({length:n},(_,i)=>({id:uid(),name:`Team ${i+1}`,players:[]}));
  if(mode==="balanced") {
    shuffle(players).sort((a,b)=>b.strength-a.strength).forEach((p,i)=>{ const r=Math.floor(i/n);teams[r%2===0?i%n:n-1-(i%n)].players.push(p); });
  } else if(mode==="mixed") {
    [4,3,2,1].forEach(s=>shuffle(players.filter(p=>p.strength===s)).forEach((p,i)=>teams[i%n].players.push(p)));
  } else if(mode==="challenge") {
    shuffle(players).sort((a,b)=>b.strength-a.strength).forEach((p,i)=>teams[Math.min(n-1,Math.floor(i/Math.ceil(players.length/n)))].players.push(p));
  } else if(mode==="skill"&&skillDist) {
    const strong=shuffle(players.filter(p=>p.strength>=3));
    const weak=shuffle(players.filter(p=>p.strength<=2));
    const {strong:nS=0,weak:nW=0}=skillDist; const nM=n-nS-nW;
    let ti=0;
    for(let i=0;i<nS&&ti<n;i++){const t=teams[ti++];strong.splice(0,Math.max(1,Math.ceil(strong.length/(nS-i)))).forEach(p=>t.players.push(p));}
    for(let i=0;i<nW&&ti<n;i++){const t=teams[ti++];weak.splice(0,Math.max(1,Math.ceil(weak.length/(nW-i)))).forEach(p=>t.players.push(p));}
    const rest=shuffle([...strong,...weak]);
    for(let i=0;i<nM&&ti<n;i++){const t=teams[ti++];rest.splice(0,Math.max(1,Math.ceil(rest.length/(nM-i)))).forEach(p=>t.players.push(p));}
  } else {
    shuffle(players).forEach((p,i)=>teams[i%n].players.push(p));
  }
  return teams;
}

// ── TOURNAMENT HELPERS ────────────────────────────────────────────
const generateRR = teams => {
  const n=teams.length, list=teams.map(t=>t.id);
  if(n%2===1) list.push(null);
  const rounds=[];
  for(let r=0;r<list.length-1;r++){
    const round=[];
    for(let i=0;i<list.length/2;i++){
      const h=list[i],a=list[list.length-1-i];
      if(h&&a) round.push({id:uid(),homeId:h,awayId:a,homeScore:null,awayScore:null,played:false});
    }
    rounds.push(round);
    list.splice(1,0,list.pop());
  }
  return shuffle(rounds).flat();
};
const calcStandings = (teams,matches) => {
  const t=teams.map(x=>({...x,pl:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}));
  matches.filter(m=>m.played).forEach(m=>{ const h=t.find(x=>x.id===m.homeId),a=t.find(x=>x.id===m.awayId);if(!h||!a)return;h.pl++;a.pl++;h.gf+=m.homeScore;h.ga+=m.awayScore;a.gf+=m.awayScore;a.ga+=m.homeScore;if(m.homeScore>m.awayScore){h.w++;h.pts+=3;a.l++;}else if(m.homeScore<m.awayScore){a.w++;a.pts+=3;h.l++;}else{h.d++;h.pts++;a.d++;a.pts++;} });
  return t.sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);
};

// ── CLAUDE API ────────────────────────────────────────────────────
async function callClaude(messages,apiKey,system) {
  const headers={"Content-Type":"application/json","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"};
  if(apiKey) headers["x-api-key"]=apiKey;
  const body={model:"claude-sonnet-4-20250514",max_tokens:messages[0]?.content?.length>500?4000:2000,messages};
  if(system) body.system=system;
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers,body:JSON.stringify(body)});
  if(!res.ok){const e=await res.json();throw new Error(e.error?.message||`Fehler ${res.status}`);}
  return (await res.json()).content[0].text;
}

// ── HOOKS ─────────────────────────────────────────────────────────
function useStorage(key,def) {
  const [data,setData]=useState(def);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    db.kv.get(key)
      .then(row=>{ if(row?.value) setData(JSON.parse(row.value)); setReady(true); })
      .catch(()=>setReady(true));
  },[key]);
  // Supports both direct values AND functional updates (prev=>next)
  // This prevents stale closure bugs when saving rapidly
  const save = (nextOrFn) => {
    setData(prev=>{
      const next = typeof nextOrFn==='function' ? nextOrFn(prev) : nextOrFn;
      db.kv.put({key, value:JSON.stringify(next)}).catch(e=>console.error('DB write error:',e));
      return next;
    });
  };
  return [data,save,ready];
}
function useToast() {
  const [list,setList]=useState([]);
  const toast=(msg,type="ok")=>{const id=uid();setList(p=>[...p,{id,msg,type}]);setTimeout(()=>setList(p=>p.filter(t=>t.id!==id)),3500);};
  const Toasts=()=><div style={{position:"fixed",top:16,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>{list.map(t=><div key={t.id} style={{padding:"10px 18px",borderRadius:10,fontSize:14,fontWeight:700,color:"white",background:t.type==="err"?"#ef4444":t.type==="warn"?"#f59e0b":"#16a34a",boxShadow:"0 4px 16px rgba(0,0,0,.2)"}}>{t.msg}</div>)}</div>;
  return {toast,Toasts};
}

// ── UI PRIMITIVES ─────────────────────────────────────────────────
const Modal=({title,onClose,children,wide})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
    <div style={{background:C.card,borderRadius:18,width:"100%",maxWidth:wide?760:540,maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 28px 80px rgba(0,0,0,.35)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <h2 style={{margin:0,fontSize:18,fontWeight:800,color:C.text}}>{title}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:20,lineHeight:1}}>✕</button>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:24}}>{children}</div>
    </div>
  </div>
);
const CatBadge=({cat,small})=>{const c=CATS[cat];if(!c)return null;return<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:small?11:12,fontWeight:700,padding:small?"2px 8px":"3px 10px",borderRadius:20,background:c.bg,color:c.color,whiteSpace:"nowrap"}}>{c.emoji} {c.label}</span>;};
const Stars=({value,onChange,readonly})=>{
  const v=value||0;
  return<div style={{display:"flex",gap:2,alignItems:"center"}}>
    {[1,2,3,4,5].map(n=><span key={n} onClick={()=>{if(readonly)return;onChange?.(n===v?0:n);}} style={{cursor:readonly?"default":"pointer",fontSize:readonly?14:18,color:n<=v?"#f59e0b":"#e2e8f0",lineHeight:1,userSelect:"none"}}>★</span>)}
    {!readonly&&v>0&&<button onClick={()=>onChange?.(0)} style={{fontSize:10,color:C.muted,background:"none",border:"none",cursor:"pointer",padding:"0 2px",marginLeft:2,fontFamily:"inherit"}}>✕</button>}
    {v===0&&<span style={{fontSize:11,color:C.muted,marginLeft:2,fontStyle:"italic"}}>unbewertet</span>}
  </div>;
};
const StrBadge=({level,small})=>{const s=STR[level];if(!s)return null;return<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:small?11:12,fontWeight:700,padding:"2px 10px",borderRadius:20,background:s.light,color:s.color}}>{s.emoji} {s.label}</span>;};
const Inp=({label,style:st,...p})=><div style={{marginBottom:14}}>{label&&<label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>{label}</label>}<input {...p} style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,color:C.text,background:"white",outline:"none",boxSizing:"border-box",...st}}/></div>;
const Txta=({label,...p})=><div style={{marginBottom:14}}>{label&&<label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>{label}</label>}<textarea {...p} style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,color:C.text,background:"white",outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}}/></div>;
const Sel=({label,children,...p})=><div style={{marginBottom:14}}>{label&&<label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>{label}</label>}<select {...p} style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,color:C.text,background:"white",outline:"none",boxSizing:"border-box"}}>{children}</select></div>;
const Btn=({children,variant="primary",sm,...p})=><button {...p} style={{padding:sm?"6px 14px":"9px 18px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:sm?13:14,fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6,...(variant==="primary"?{background:C.primary,color:"white"}:variant==="danger"?{background:"#ef4444",color:"white"}:variant==="ai"?{background:"#6d28d9",color:"white"}:{background:"white",color:C.text,border:`1.5px solid ${C.border}`}),...p.style}}>{children}</button>;
const Divider=()=><div style={{borderTop:`1px solid ${C.border}`,margin:"20px 0"}}/>;
const Empty=({icon,title,sub,onAdd,addLabel})=><div style={{textAlign:"center",padding:"60px 24px",color:C.muted}}><div style={{fontSize:48,marginBottom:16}}>{icon}</div><div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:8}}>{title}</div>{sub&&<div style={{fontSize:14,marginBottom:24}}>{sub}</div>}{onAdd&&<Btn onClick={onAdd}><Plus size={16}/> {addLabel}</Btn>}</div>;
const Stepper=({value,onChange,min=1,max=99})=>(
  <div style={{display:"flex",alignItems:"center",border:`1.5px solid ${C.border}`,borderRadius:8,overflow:"hidden",background:"white",height:38}}>
    <button onClick={()=>onChange(Math.max(min,value-1))} style={{width:38,height:"100%",border:"none",borderRight:`1px solid ${C.border}`,cursor:"pointer",background:"transparent",fontSize:20,color:value<=min?"#cbd5e1":C.text,lineHeight:1,flexShrink:0}}>−</button>
    <div style={{flex:1,textAlign:"center",fontWeight:800,fontSize:16,color:C.text,minWidth:32}}>{value}</div>
    <button onClick={()=>onChange(Math.min(max,value+1))} style={{width:38,height:"100%",border:"none",borderLeft:`1px solid ${C.border}`,cursor:"pointer",background:"transparent",fontSize:20,color:value>=max?"#cbd5e1":C.text,lineHeight:1,flexShrink:0}}>+</button>
  </div>
);

// ── AI IMPORT ─────────────────────────────────────────────────────
function AIImportModal({onSave,onClose,apiKey}) {
  const [text,setText]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [preview,setPreview]=useState(null);
  const SYS=`Du bist Experte für G-Jugend (U7) Fußballtraining. Extrahiere eine Übung aus dem Text.
Antworte NUR mit JSON, keine Codeblöcke: {"title":"","category":"technik","description":"","setup":"","material":[],"minPlayers":4,"maxPlayers":12,"duration":10,"tags":[],"source":"","notes":""}
category: aufwaermen|koordination|technik|spielform|abschluss`;
  const run=async()=>{ if(!text.trim())return;setLoading(true);setError("");try{const r=await callClaude([{role:"user",content:`Extrahiere diese Übung:\n\n${text}`}],apiKey,SYS);const d=parseJsonSafe(r);if(!d?.title)throw new Error("Keine Übung erkannt");setPreview({...d,id:uid(),createdAt:now(),updatedAt:now(),rating:3,imageUrl:""});}catch(e){setError(e.message);}setLoading(false); };
  if(preview) return(<div>
    <div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",marginBottom:14,border:`1px solid ${C.accent}`,fontSize:13,color:C.primary,fontWeight:600}}>✅ Übung erkannt – bitte prüfen:</div>
    <Inp label="Titel" value={preview.title} onChange={e=>setPreview(p=>({...p,title:e.target.value}))}/>
    <Sel label="Kategorie" value={preview.category} onChange={e=>setPreview(p=>({...p,category:e.target.value}))}>{Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}</Sel>
    <Txta label="Ablauf" value={preview.description} onChange={e=>setPreview(p=>({...p,description:e.target.value}))} rows={3}/>
    <Txta label="Aufbau" value={preview.setup} onChange={e=>setPreview(p=>({...p,setup:e.target.value}))} rows={2}/>
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>{preview.material?.map(m=><span key={m} style={{padding:"3px 10px",borderRadius:20,background:C.accentL,color:C.primary,fontSize:12,fontWeight:700}}>📦 {m}</span>)}</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>{preview.tags?.map(t=><span key={t} style={{padding:"3px 10px",borderRadius:20,background:"#f1f5f9",color:C.muted,fontSize:12,fontWeight:600}}>{t}</span>)}</div>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:`1px solid ${C.border}`}}><Btn onClick={()=>setPreview(null)} variant="secondary">Zurück</Btn><Btn onClick={()=>onSave(preview)}>Speichern</Btn></div>
  </div>);
  return(<div>
    <div style={{background:"#faf5ff",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid #e9d5ff",fontSize:13,color:"#6d28d9"}}>🤖 Text aus Trainingsbuch, DFB-PDF, Website oder eigene Notizen einfügen – KI erkennt automatisch die Übung.</div>
    <Txta label="Text einfügen" value={text} onChange={e=>setText(e.target.value)} placeholder="z.B. 'Hütchendribbeln: Jeder Spieler dribbliert durch eine Gasse aus 6 Hütchen...'" rows={8}/>
    {error&&<div style={{color:"#ef4444",fontSize:13,marginBottom:12,fontWeight:600}}>❌ {error}</div>}
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn onClick={onClose} variant="secondary">Abbrechen</Btn><Btn onClick={run} variant="ai" disabled={loading||!text.trim()}>{loading?<><RefreshCw size={14} style={{animation:"spin 1s linear infinite"}}/> Erkenne...</>:<><Bot size={14}/> Übung erkennen</>}</Btn></div>
  </div>);
}

// ── AI TRAINING PLAN ──────────────────────────────────────────────
function AITrainingModal({players,exercises,onClose,apiKey,onSaveEx,onSaveSession,setup}) {
  const MAT_OPTS=["Bälle","Hütchen","Leibchen","Minitore","Koordinationsleiter","Stangen","Reifen","Pylonen"];
  const [cfg,setCfg]=useState({kids:setup?.kids||players.filter(p=>p.active).length||10,coaches:setup?.coachCount||1,duration:setup?.duration||60,focus:setup?.focus||"",useLib:true,location:setup?.location||"outdoor",material:[...MAT_OPTS]});
  const [loading,setLoading]=useState(false);
  const [plan,setPlan]=useState(null);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState([]);
  const [view,setView]=useState("config"); // config | plan | detail | replace
  const [detailEx,setDetailEx]=useState(null);
  const [replaceTarget,setReplaceTarget]=useState(null); // {phaseIdx,stationIdx,category}
  const [hasDraft,setHasDraft]=useState(false);
  const set=(k,v)=>setCfg(c=>({...c,[k]:v}));
  const togMat=m=>set("material",cfg.material.includes(m)?cfg.material.filter(x=>x!==m):[...cfg.material,m]);

  useEffect(()=>{
    db.kv.get("aiPlanDraft").then(row=>{
      if(row?.value){const d=JSON.parse(row.value);if(d.plan){setPlan(d.plan);setView("plan");setHasDraft(true);}if(d.cfg)setCfg(c=>({...c,...d.cfg}));}
    }).catch(()=>{});
  },[]);

  const saveDraft=(p,c)=>db.kv.put({key:"aiPlanDraft",value:JSON.stringify({plan:p,cfg:c,savedAt:now()})}).catch(()=>{});
  const clearDraft=()=>db.kv.delete("aiPlanDraft").catch(()=>{});

  const SYS=`Du bist erfahrener G-Jugend (U7) Trainer in Hamburg (HFV). Erstelle einen praxistauglichen Trainingsplan als strukturiertes BRIEFING – so klar, dass jeder Trainer sofort weiß was wann zu tun ist.

TRAININGSSTRUKTUR (60 Min, skaliere proportional):
1. ANKOMMEN (10 Min): Freies Spiel, kein Trainer-Input. Trainer nutzen diese Zeit um Stationen aufzubauen. Schreibe explizit: "Trainer bauen in dieser Zeit Station X auf."
2. AUFWÄRMEN (10-15 Min): Alle zusammen, einfaches Bewegungsspiel.
3. HAUPTTEIL (25-30 Min): Stationen/Gruppen/Spielformen.
4. ABSCHLUSS (5-10 Min): Freies Spiel oder kurze Spielform.

HAUPTTEIL – wähle passende Strategie:
A) STATIONEN+ROTATION (≥2 Trainer): Beschreibe exakt: "Team 1 (4 Kinder) → Station A mit Trainer 1. Team 2 (4 Kinder) → Station B mit Trainer 2. Team 3+4 spielen auf Feld C ohne Trainer. Nach 8 Min: Pfiff → Team 1 geht zu B, Team 2 zu C, Team 3+4 zu A."
B) PARALLEL: Teile in zwei Gruppen, jede hat eigene Aufgabe.
C) ALLE ZUSAMMEN: Alle machen gleichzeitig dasselbe.
D) ROUND ROBIN: Kurze Spiele, jeder gegen jeden.

FÜR JEDE PHASE schreibe:
- Was passiert genau (Schritt für Schritt)
- Wer macht was (welches Team, welcher Trainer)
- Wann und wie rotiert wird (exakte Ansage: "Pfiff nach 8 Min: Team 1 rückt zu Station 2")
- Was Trainer parallel aufbauen sollen
- Wie viele Kinder wo aktiv sind

G-JUGEND: Kein Torwart. Minitore/Hütchentore. 2v2 bis 4v4. Max 3 Sätze Ansage. Spaß > Perfektion. Nie >2 Min Leerlauf.

Nutze Bibliotheksübungen wenn verfügbar. Neue Übungen detailliert unter newExercises mit sketchPrompt.

Antworte NUR mit JSON:
{"title":"","briefing":"Kurze Zusammenfassung des Trainings in 2 Sätzen für alle Trainer","phases":[{"name":"","duration":10,"type":"free|warmup|stations|game|exercise","description":"","setup":"","exerciseTitle":"","material":[],"tips":"","playerDistribution":"","minCoaches":1,"rotationMinutes":0,"rotationInstruction":"z.B. Nach 8 Min Pfiff: Team 1→Station 2, Team 2→Station 3, Team 3→Station 1","trainerTask":"Was Trainer in dieser Phase parallel tun sollen (z.B. Station aufbauen)","stations":[{"label":"","teams":[""],"exercise":"","description":"","setup":"","playerCount":"","trainerNeeded":false,"material":[]}]}],"teams":[{"name":"","size":4}],"totalDuration":60,"generalTips":"","newExercises":[{"title":"","category":"technik","description":"","setup":"","material":[],"minPlayers":4,"maxPlayers":12,"duration":10,"tags":[],"coachingPoints":[],"variante":{"leichter":"","schwerer":""},"playerCount":"","sketchPrompt":""}]}`;

  const generate=async()=>{
    setLoading(true);setError("");
    const lib=cfg.useLib&&exercises.length>0?`\nBibliothek:\n${exercises.slice(0,15).map(e=>`- "${e.title}" (${CATS[e.category]?.label}, ${e.duration}min${e.material?.length?`, Mat: ${e.material.join(",")}`:""})` ).join("\n")}`:"";
    const msg=`${cfg.kids} Kinder, ${cfg.coaches} Trainer, ${cfg.duration} Min, ${cfg.location==="indoor"?"Indoor (Halle)":"Outdoor"}. Material: ${cfg.material.join(", ") || "–"}${cfg.focus?`. Schwerpunkt: ${cfg.focus}`:""}${lib}`;
    try{
      const r=await callClaude([{role:"user",content:msg}],apiKey,SYS);
      const d=parseJsonSafe(r);
      if(!d?.phases)throw new Error("Ungültige Antwort – bitte erneut versuchen");
      setPlan(d);setView("plan");saveDraft(d,cfg);
    }catch(e){setError(e.message);}
    setLoading(false);
  };

  const findLib=title=>exercises.find(e=>e.title?.toLowerCase()===title?.toLowerCase());

  const openDetail=(title,desc,setup,mat,cat,tips)=>{
    const lib=findLib(title);
    setDetailEx(lib||{title:title||"",description:desc||"",setup:setup||"",material:mat||[],category:cat||"technik",tips:tips||"",id:null});
    setView("detail");
  };

  const openReplace=(phaseIdx,stationIdx,category)=>{setReplaceTarget({phaseIdx,stationIdx,category});setView("replace");};

  const doReplace=ex=>{
    if(!replaceTarget)return;
    const {phaseIdx,stationIdx}=replaceTarget;
    setPlan(p=>{
      const phases=p.phases.map((ph,i)=>{
        if(i!==phaseIdx)return ph;
        if(stationIdx!=null){
          const stations=(ph.stations||[]).map((st,j)=>j!==stationIdx?st:{...st,exercise:ex.title,description:ex.description||"",setup:ex.setup||"",material:ex.material||[]});
          return {...ph,stations};
        }
        return {...ph,exerciseTitle:ex.title,description:ex.description||ph.description,setup:ex.setup||ph.setup,material:ex.material||ph.material};
      });
      const np={...p,phases};saveDraft(np,cfg);return np;
    });
    setView("plan");setReplaceTarget(null);
  };

  const getExIds=()=>{
    const ids=new Set();
    plan?.phases?.forEach(ph=>{
      if(ph.stations){ph.stations.forEach(st=>{const e=findLib(st.exercise);if(e)ids.add(e.id);});}
      else{const e=findLib(ph.exerciseTitle);if(e)ids.add(e.id);}
    });
    return[...ids];
  };

  const saveAsTraining=()=>{
    if(!onSaveSession)return;
    const draft={id:uid(),createdAt:now(),date:setup?.date||todayISO(),duration:cfg.duration,location:cfg.location==="indoor"?"Halle":"",weather:"",participantCount:String(cfg.kids),coachIds:setup?.coachIds||[],playerIds:setup?.playerIds||[],exerciseIds:getExIds(),teams:[],notes:`📋 KI-Entwurf: ${plan.title}${plan.generalTips?'\n💡 '+plan.generalTips:""}`,isDraft:true};
    onSaveSession(draft);clearDraft();onClose();
  };

  const phBg={free:"#f8fafc",warmup:"#fff7ed",stations:"#f0fdf4",game:"#eff6ff",exercise:"#f5f3ff"};
  const phEmoji={free:"⚽",warmup:"🔥",stations:"🔄",game:"🏆",exercise:"🎯"};
  const ReplBtn=({onClick})=><button onClick={onClick} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,cursor:"pointer",fontSize:11,color:C.muted,padding:"2px 8px",fontFamily:"inherit",flexShrink:0,whiteSpace:"nowrap"}}>🔄 Ersetzen</button>;
  const ExLink=({title,desc,setup,mat,cat,tips})=>title?<button onClick={()=>openDetail(title,desc,setup,mat,cat,tips)} style={{fontWeight:700,fontSize:13,color:C.primary,background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit",textDecoration:"underline",textAlign:"left"}}>{title}{findLib(title)?" 📚":""}</button>:null;

  // ── DETAIL VIEW ────────────────────────────────────────────────────
  if(view==="detail"&&detailEx) return(<div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
      <Btn sm variant="secondary" onClick={()=>setView("plan")}>← Plan</Btn>
      {detailEx.category&&<CatBadge cat={detailEx.category}/>}
      {!detailEx.id&&<span style={{fontSize:11,color:C.muted,padding:"2px 8px",background:"#faf5ff",borderRadius:20,border:"1px solid #e9d5ff"}}>🤖 KI-Übung</span>}
    </div>
    <h3 style={{margin:"0 0 14px",fontWeight:800,color:C.text,fontSize:17}}>{detailEx.title}</h3>
    {detailEx.setup&&<div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>📐 Aufbau</div><div style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",fontSize:14,color:C.text,lineHeight:1.6,border:`1px solid ${C.border}`}}>{detailEx.setup}</div></div>}
    {detailEx.description&&<div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>🎯 Ablauf</div><div style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",fontSize:14,color:C.text,lineHeight:1.6,border:`1px solid ${C.border}`}}>{detailEx.description}</div></div>}
    {detailEx.tips&&<div style={{marginBottom:12,background:"#faf5ff",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#6d28d9",border:"1px solid #e9d5ff"}}>💡 {detailEx.tips}</div>}
    {detailEx.material?.length>0&&<div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>📦 Material</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{detailEx.material.map(m=><span key={m} style={{padding:"4px 10px",borderRadius:20,background:C.accentL,color:C.primary,fontSize:12,fontWeight:700}}>📦 {m}</span>)}</div></div>}
    {detailEx.tags?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{detailEx.tags.map(t=><span key={t} style={{padding:"3px 8px",borderRadius:20,background:"#f1f5f9",color:C.muted,fontSize:11,fontWeight:600}}>{t}</span>)}</div>}
    {detailEx.notes&&<div style={{marginTop:12,fontSize:13,color:C.muted,fontStyle:"italic"}}>💬 {detailEx.notes}</div>}
    <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`,display:"flex",gap:8,justifyContent:"flex-end"}}>
      <Btn sm variant="secondary" onClick={()=>setView("plan")}>← Zurück zum Plan</Btn>
    </div>
  </div>);

  // ── REPLACE VIEW ───────────────────────────────────────────────────
  if(view==="replace"&&replaceTarget){
    const cat=replaceTarget.category;
    const pool=exercises.filter(e=>!cat||e.category===cat);
    const all=pool.length>0?pool:exercises;
    return(<div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <Btn sm variant="secondary" onClick={()=>setView("plan")}>← Plan</Btn>
        <span style={{fontWeight:700,color:C.text}}>Übung ersetzen</span>
        {cat&&<CatBadge cat={cat} small/>}
      </div>
      {all.length===0?<div style={{textAlign:"center",padding:"30px 0",color:C.muted,fontSize:14}}>Keine Übungen in der Bibliothek.<br/>Füge zuerst Übungen in der Bibliothek hinzu.</div>:
        <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:420,overflowY:"auto"}}>
          {all.map(ex=><div key={ex.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 14px",borderRadius:8,border:`1.5px solid ${C.border}`,background:"white",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:2}}><span style={{fontWeight:700,fontSize:13,color:C.text}}>{ex.title}</span><CatBadge cat={ex.category} small/></div>
              {ex.description&&<div style={{fontSize:12,color:C.muted,lineHeight:1.4}}>{ex.description.slice(0,90)}{ex.description.length>90?"…":""}</div>}
            </div>
            <Btn sm onClick={()=>doReplace(ex)}>Verwenden</Btn>
          </div>)}
        </div>}
    </div>);
  }

  // ── PLAN VIEW ──────────────────────────────────────────────────────
  if(plan&&view==="plan") return(<div>
    {hasDraft&&<div style={{background:"#fffbeb",borderRadius:8,padding:"8px 12px",marginBottom:12,border:"1px solid #fde68a",fontSize:12,color:"#92400e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span>📋 Entwurf wiederhergestellt</span>
      <button onClick={()=>{setPlan(null);setView("config");clearDraft();setHasDraft(false);}} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>✕ Verwerfen</button>
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <h3 style={{margin:0,fontWeight:800,color:C.text,fontSize:16}}>{plan.title}</h3>
      <span style={{fontSize:13,color:C.muted}}>⏱ {plan.totalDuration} Min · {cfg.location==="indoor"?"🏠 Halle":"☀️ Outdoor"}</span>
    </div>
    {plan.briefing&&<div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",marginBottom:12,border:"1px solid #bbf7d0",fontSize:14,color:"#15803d",fontWeight:600,lineHeight:1.5}}>📋 {plan.briefing}</div>}
    {plan.teams?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
      {plan.teams.map((t,i)=><span key={i} style={{padding:"3px 10px",borderRadius:20,background:TCOLORS[i%TCOLORS.length]+"22",color:TCOLORS[i%TCOLORS.length],fontSize:12,fontWeight:700,border:`1.5px solid ${TCOLORS[i%TCOLORS.length]}55`}}>{t.name} ({t.size}👦)</span>)}
    </div>}
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
      {plan.phases.map((ph,i)=>{
        const bg=phBg[ph.type]||"#f8fafc";
        const em=phEmoji[ph.type]||"📋";
        const catForReplace=ph.type==="warmup"?"aufwaermen":ph.type==="game"?"spielform":ph.type==="exercise"?"technik":null;
        return(<div key={i} style={{borderRadius:10,border:`1.5px solid ${C.border}`,overflow:"hidden"}}>
          <div style={{background:bg,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
            <div style={{fontWeight:800,fontSize:14,color:C.text}}>{em} {ph.name}</div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:12,color:C.muted,fontWeight:600}}>⏱ {ph.duration}m</span>
              {ph.type!=="free"&&ph.type!=="stations"&&<ReplBtn onClick={()=>openReplace(i,null,catForReplace)}/>}
            </div>
          </div>
          <div style={{padding:"10px 14px"}}>
            {ph.exerciseTitle&&<div style={{marginBottom:4}}><ExLink title={ph.exerciseTitle} desc={ph.description} setup={ph.setup} mat={ph.material} cat={ph.type} tips={ph.tips}/></div>}
            {ph.description&&<div style={{fontSize:13,color:C.text,lineHeight:1.6,marginBottom:6,opacity:ph.exerciseTitle?0.7:1}}>{ph.description}</div>}
            {ph.setup&&<div style={{fontSize:12,color:C.muted,background:"#f8fafc",borderRadius:6,padding:"6px 10px",marginBottom:6}}>📐 {ph.setup}</div>}
            {ph.stations?.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:4}}>
              {ph.rotationMinutes>0&&<div style={{fontSize:12,color:"#7c3aed",fontWeight:700}}>🔄 Rotation alle {ph.rotationMinutes} Min</div>}
              {ph.stations.map((st,j)=><div key={j} style={{borderRadius:8,border:`1px solid ${C.border}`,padding:"8px 12px",background:"white"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6,marginBottom:3}}>
                  <div style={{fontWeight:700,fontSize:13,color:C.primary}}>{st.label}</div>
                  <ReplBtn onClick={()=>openReplace(i,j,"technik")}/>
                </div>
                {st.teams?.length>0&&<div style={{fontSize:11,color:C.muted,marginBottom:3}}>👦 {st.teams.join(" · ")}</div>}
                <ExLink title={st.exercise} desc={st.description} setup={st.setup} mat={st.material} cat="technik" tips=""/>
                {st.description&&<div style={{fontSize:12,color:C.muted,lineHeight:1.5,marginTop:2}}>{st.description}</div>}
                {st.playerCount&&<div style={{fontSize:11,color:"#0369a1",fontWeight:700,marginTop:3}}>👥 {st.playerCount}{st.trainerNeeded?" · 🧑‍🏫 Trainer nötig":""}</div>}
                {st.material?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:4}}>{st.material.map(m=><span key={m} style={{fontSize:10,padding:"2px 6px",borderRadius:10,background:C.accentL,color:C.primary,fontWeight:600}}>📦 {m}</span>)}</div>}
              </div>)}
            </div>}
            {ph.material?.length>0&&!ph.stations?.length&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>{ph.material.map(m=><span key={m} style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:C.accentL,color:C.primary,fontWeight:600}}>📦 {m}</span>)}</div>}
            {ph.playerDistribution&&<div style={{fontSize:12,background:"#f0f9ff",borderRadius:6,padding:"5px 10px",marginTop:4,color:"#0369a1",fontWeight:600}}>👥 {ph.playerDistribution}{ph.minCoaches>0?` · 🧑‍🏫 min. ${ph.minCoaches} Trainer`:""}</div>}
            {ph.rotationInstruction&&<div style={{fontSize:12,background:"#fef9c3",borderRadius:6,padding:"6px 10px",marginTop:4,color:"#92400e",fontWeight:600,lineHeight:1.5}}>🔄 {ph.rotationInstruction}</div>}
            {ph.trainerTask&&<div style={{fontSize:12,background:"#faf5ff",borderRadius:6,padding:"5px 10px",marginTop:4,color:"#6d28d9",fontWeight:600}}>🧑‍🏫 Trainer: {ph.trainerTask}</div>}
            {ph.tips&&<div style={{fontSize:12,color:"#7c3aed",fontStyle:"italic",marginTop:4}}>💡 {ph.tips}</div>}
          </div>
        </div>);
      })}
    </div>
    {plan.generalTips&&<div style={{background:"#faf5ff",borderRadius:10,padding:"12px 14px",border:"1px solid #e9d5ff",fontSize:13,color:"#6d28d9",marginBottom:12}}><strong>💡 </strong>{plan.generalTips}</div>}
    {plan.newExercises?.filter(ex=>ex.title).length>0&&<div style={{marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:8}}>🆕 Neue Übungen speichern</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {plan.newExercises.filter(ex=>ex.title).map((ex,i)=>{
          const isSaved=saved.includes(i);
          return(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,border:`1.5px solid ${isSaved?"#22c55e":C.border}`,background:isSaved?"#f0fdf4":"white",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontWeight:700,fontSize:13,color:C.text}}>{ex.title}</span><CatBadge cat={ex.category} small/></div>
              {ex.playerCount&&<div style={{fontSize:11,color:"#0369a1",fontWeight:700,marginTop:2}}>👥 {ex.playerCount}</div>}
            {ex.description&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>{ex.description.slice(0,100)}{ex.description.length>100?"…":""}</div>}
            {ex.coachingPoints?.length>0&&<div style={{fontSize:11,color:"#7c3aed",marginTop:3}}>💡 {ex.coachingPoints[0]}</div>}
            </div>
            {isSaved?<span style={{fontSize:12,color:"#16a34a",fontWeight:700,flexShrink:0}}>✅ Gespeichert</span>:
              onSaveEx&&<Btn sm onClick={async()=>{
  let imageUrl="";
  if(ex.sketchPrompt&&apiKey){
    try{
      const r=await callClaude([{role:"user",content:`Erstelle eine einfache, klare Trainingsskizze als SVG für diese Übung. Nutze: Kreise für Spieler, Dreiecke/Hütchen für Aufbau, Pfeile für Bewegungsrichtungen. Schwarz-weiß. Beschriftung auf Deutsch. Gib NUR valides SVG zurück, kein anderer Text.\n\nÜbung: ${ex.title}\nAufbau: ${ex.sketchPrompt}`}],apiKey);
      const svg=r.match(/<svg[\s\S]*<\/svg>/)?.[0];
      if(svg) imageUrl="data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svg)));
    }catch(e){}
  }
  const notes=[ex.coachingPoints?.length?`💡 Tipps:\n${ex.coachingPoints.map(t=>`• ${t}`).join("\n")}`:"",ex.variante?.leichter?`📉 Leichter: ${ex.variante.leichter}`:"",ex.variante?.schwerer?`📈 Schwerer: ${ex.variante.schwerer}`:""].filter(Boolean).join("\n\n");
  onSaveEx({...ex,id:uid(),createdAt:now(),updatedAt:now(),rating:0,done:false,imageUrl,source:"KI-Trainingsplan",notes});
  setSaved(s=>[...s,i]);
}}><Plus size={12}/> Speichern{ex.sketchPrompt?" + Skizze":""}</Btn>}
          </div>);
        })}
      </div>
    </div>}
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap",paddingTop:14,borderTop:`1px solid ${C.border}`}}>
      <Btn onClick={()=>{setPlan(null);setView("config");}} variant="secondary"><RefreshCw size={14}/> Neu generieren</Btn>
      {onSaveSession&&<Btn onClick={saveAsTraining}><CalendarDays size={14}/> Als Entwurf speichern</Btn>}
    </div>
  </div>);

  // ── CONFIG VIEW ────────────────────────────────────────────────────
  return(<div>
    <div style={{background:"#faf5ff",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid #e9d5ff",fontSize:13,color:"#6d28d9"}}>🤖 KI plant Stationen, Rotation und Spielzeit – optimiert für Trainer- und Kinderzahl. Plan wird automatisch als Entwurf gespeichert.</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
      <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Kinder</label><Stepper value={cfg.kids} onChange={v=>set("kids",v)} min={4} max={30}/></div>
      <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Trainer</label><Stepper value={cfg.coaches} onChange={v=>set("coaches",v)} min={1} max={6}/></div>
      <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Minuten</label><Stepper value={cfg.duration} onChange={v=>set("duration",v)} min={20} max={120}/></div>
    </div>
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Ort</label>
      <div style={{display:"flex",gap:8}}>
        {[["outdoor","☀️ Outdoor"],["indoor","🏠 Indoor (Halle)"]].map(([k,l])=><button key={k} onClick={()=>set("location",k)} style={{flex:1,padding:"8px",borderRadius:8,border:`2px solid ${cfg.location===k?C.primary:C.border}`,background:cfg.location===k?C.accentL:"white",color:cfg.location===k?C.primary:C.muted,cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit"}}>{l}</button>)}
      </div>
    </div>
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Verfügbares Material <span style={{fontSize:11,fontWeight:400,textTransform:"none"}}>– abwählen was fehlt</span></label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {MAT_OPTS.map(m=>{const on=cfg.material.includes(m);return<button key={m} onClick={()=>togMat(m)} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${on?C.primary:C.border}`,background:on?C.accentL:"white",color:on?C.primary:C.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>📦 {m}</button>;})}
      </div>
    </div>
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Schwerpunkt (optional)</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
        {["Dribbeln","Passspiel","Torschuss","Koordination","Zweikampf","Spaß & Spiel","Schnelligkeit","Teamwork","Raumgefühl","Funino"].map(s=>{const active=cfg.focus===s;return<button key={s} onClick={()=>set("focus",active?"":s)} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${active?C.primary:C.border}`,background:active?C.accentL:"white",color:active?C.primary:C.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{s}</button>;})}
      </div>
      <input value={cfg.focus} onChange={e=>set("focus",e.target.value)} placeholder="Oder eigenen Schwerpunkt eingeben..." style={{width:"100%",padding:"8px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",color:C.text}}/>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><input type="checkbox" id="ul" checked={cfg.useLib} onChange={e=>set("useLib",e.target.checked)} style={{width:16,height:16}}/><label htmlFor="ul" style={{fontSize:14,color:C.text,cursor:"pointer"}}>Meine Bibliothek berücksichtigen ({exercises.length} Übungen)</label></div>
    {error&&<div style={{color:"#ef4444",fontSize:13,marginBottom:12,fontWeight:600}}>❌ {error}</div>}
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn onClick={onClose} variant="secondary">Abbrechen</Btn><Btn onClick={generate} variant="ai" disabled={loading}>{loading?<><RefreshCw size={14} style={{animation:"spin 1s linear infinite"}}/> Plane...</>:<><Bot size={14}/> Training planen</>}</Btn></div>
  </div>);
}

// ── EXERCISE FORM ─────────────────────────────────────────────────
function ExerciseForm({exercise,onSave,onClose}) {
  const [form,setForm]=useState({title:"",category:"technik",description:"",setup:"",material:[],minPlayers:4,maxPlayers:12,duration:10,rating:0,done:false,tags:[],imageUrl:"",source:"",notes:"",...exercise});
  const [mi,setMi]=useState("");const imgRef=useRef();
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const addMat=m=>{ if(!m.trim())return;if(!form.material.includes(m.trim()))set("material",[...form.material,m.trim()]);setMi(""); };
  const chip=a=>({padding:"4px 10px",borderRadius:20,border:`1.5px solid ${a?C.primary:C.border}`,background:a?C.accentL:"white",color:a?C.primary:C.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"});
  return(<div>
    <Inp label="Titel *" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Name der Übung"/>
    <Sel label="Kategorie" value={form.category} onChange={e=>set("category",e.target.value)}>{Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}</Sel>
    <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center"}}>
      <div style={{flex:1}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Status</label>
        <div style={{display:"flex",gap:8}}>
          {[[false,"⏳ Noch nicht gemacht","#f1f5f9",C.muted],[true,"✅ Schon gemacht","#dcfce7","#16a34a"]].map(([v,l,bg,col])=>
            <button key={String(v)} onClick={()=>set("done",v)} style={{flex:1,padding:"7px 10px",borderRadius:8,border:`2px solid ${form.done===v?col:C.border}`,background:form.done===v?bg:"white",color:form.done===v?col:C.muted,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit"}}>{l}</button>)}
        </div>
      </div>
    </div>
    <Txta label="Ablauf / Beschreibung" value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Wie läuft die Übung ab?" rows={4}/>
    <Txta label="Aufbau" value={form.setup} onChange={e=>set("setup",e.target.value)} placeholder="Wie wird das Feld aufgebaut?" rows={3}/>
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Material</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>{PMAT.map(m=><button key={m} onClick={()=>addMat(m)} style={chip(form.material.includes(m))}>{m}</button>)}</div>
      <div style={{display:"flex",gap:8}}><input value={mi} onChange={e=>setMi(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMat(mi)} placeholder="Eigenes Material..." style={{flex:1,padding:"8px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit"}}/><Btn sm onClick={()=>addMat(mi)}>+</Btn></div>
      {form.material.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>{form.material.map(m=><span key={m} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,background:C.accentL,color:C.primary,fontSize:12,fontWeight:700}}>📦 {m}<button onClick={()=>set("material",form.material.filter(x=>x!==m))} style={{background:"none",border:"none",cursor:"pointer",color:C.primary,padding:0,fontSize:13}}>✕</button></span>)}</div>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
      <Inp label="Min. Kinder" type="number" value={form.minPlayers} onChange={e=>set("minPlayers",Number(e.target.value))} min={1} style={{marginBottom:0}}/>
      <Inp label="Max. Kinder" type="number" value={form.maxPlayers} onChange={e=>set("maxPlayers",Number(e.target.value))} min={1} style={{marginBottom:0}}/>
      <Inp label="Dauer (Min)" type="number" value={form.duration} onChange={e=>set("duration",Number(e.target.value))} min={1} style={{marginBottom:0}}/>
    </div>
    <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Bewertung</label><Stars value={form.rating} onChange={v=>set("rating",v)}/></div>
    <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Tags</label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{PTAGS.map(t=><button key={t} onClick={()=>set("tags",form.tags.includes(t)?form.tags.filter(x=>x!==t):[...form.tags,t])} style={chip(form.tags.includes(t))}>{t}</button>)}</div></div>
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Skizze / Foto</label>
      {form.imageUrl?<div style={{position:"relative",display:"inline-block"}}><img src={form.imageUrl} alt="" style={{maxWidth:"100%",maxHeight:180,borderRadius:8,objectFit:"cover",border:`1px solid ${C.border}`}}/><button onClick={()=>set("imageUrl","")} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,.6)",color:"white",border:"none",borderRadius:6,cursor:"pointer",padding:"3px 8px",fontSize:12}}>✕</button></div>:<button onClick={()=>imgRef.current.click()} style={{padding:"10px 16px",border:`1.5px dashed ${C.border}`,borderRadius:8,cursor:"pointer",background:"white",color:C.muted,fontSize:13,fontFamily:"inherit"}}>📷 Bild hochladen</button>}
      <input ref={imgRef} type="file" accept="image/*" onChange={async e=>{const f=e.target.files?.[0];if(f)set("imageUrl",await readDataURL(f));}} style={{display:"none"}}/>
    </div>
    <Inp label="Quelle" value={form.source} onChange={e=>set("source",e.target.value)} placeholder="DFB Übungssammlung, eigene Idee..."/>
    <Txta label="Notizen & Varianten" value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2}/>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
      <Btn onClick={onClose} variant="secondary">Abbrechen</Btn>
      {!exercise?.id&&<Btn variant="secondary" onClick={()=>{
        if(!form.title.trim())return;
        onSave({...form,id:uid(),createdAt:now(),updatedAt:now()},true);
        setForm({title:"",category:form.category,description:"",setup:"",material:[],minPlayers:4,maxPlayers:12,duration:10,rating:3,tags:[],imageUrl:"",source:"",notes:""});
      }}>+ Weiteren anlegen</Btn>}
      <Btn onClick={()=>{if(!form.title.trim())return;onSave({...form,id:form.id||uid(),createdAt:form.createdAt||now(),updatedAt:now()});}}>{exercise?.id?"Speichern":"Erstellen"}</Btn>
    </div>
  </div>);
}

// ── EXERCISE DETAIL ───────────────────────────────────────────────
function ExDetail({exercise:ex,onEdit,onDelete,onClose}) {
  return(<div>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
      <CatBadge cat={ex.category}/>
      <span style={{color:C.muted,fontSize:13,marginLeft:"auto"}}>⏱ {ex.duration} Min · 👥 {ex.minPlayers}–{ex.maxPlayers}</span>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center",background:"#f8fafc",borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`,flexWrap:"wrap"}}>
      <button onClick={()=>onEdit({...ex,done:!ex.done})} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${ex.done?"#22c55e":C.border}`,background:ex.done?"#dcfce7":"white",color:ex.done?"#15803d":C.muted,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",flexShrink:0}}>{ex.done?"✅ Gemacht":"⏳ Noch nicht"}</button>
      <div style={{display:"flex",gap:3,alignItems:"center",marginLeft:4}}>
        {[1,2,3,4,5].map(n=><button key={n} onClick={()=>onEdit({...ex,rating:ex.rating===n?0:n})} style={{width:30,height:30,borderRadius:6,border:"none",background:"transparent",fontSize:20,cursor:"pointer",color:n<=(ex.rating||0)?"#f59e0b":"#d1d5db",padding:0,lineHeight:1}}>★</button>)}
        {!(ex.rating>0)&&<span style={{fontSize:11,color:C.muted,marginLeft:2,fontStyle:"italic"}}>Tippen zum Bewerten</span>}
      </div>
    </div>
    {ex.imageUrl&&<img src={ex.imageUrl} alt="" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:10,marginBottom:16,border:`1px solid ${C.border}`}}/>}
    {ex.setup&&<div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>📐 Aufbau</div><div style={{fontSize:14,color:C.text,lineHeight:1.6,background:"#f8fafc",borderRadius:8,padding:"12px 14px",border:`1px solid ${C.border}`}}>{ex.setup}</div></div>}
    {ex.description&&<div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>🎯 Ablauf</div><div style={{fontSize:14,color:C.text,lineHeight:1.6,background:"#f8fafc",borderRadius:8,padding:"12px 14px",border:`1px solid ${C.border}`}}>{ex.description}</div></div>}
    {ex.material?.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>📦 Material</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{ex.material.map(m=><span key={m} style={{padding:"4px 10px",borderRadius:20,background:C.accentL,color:C.primary,fontSize:12,fontWeight:700}}>📦 {m}</span>)}</div></div>}
    {ex.tags?.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>🏷️ Tags</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{ex.tags.map(t=><span key={t} style={{padding:"3px 10px",borderRadius:20,background:"#f1f5f9",color:C.muted,fontSize:12,fontWeight:600}}>{t}</span>)}</div></div>}
    {ex.notes&&<div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>💬 Notizen</div><div style={{fontSize:14,color:C.text,fontStyle:"italic"}}>{ex.notes}</div></div>}
    {ex.source&&<div style={{fontSize:12,color:C.muted,marginBottom:8}}>Quelle: {ex.source}</div>}
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
      <Btn onClick={()=>{onDelete(ex.id);onClose();}} variant="danger" sm><Trash2 size={14}/> Löschen</Btn>
      <Btn onClick={onEdit} variant="secondary" sm><Edit2 size={14}/> Bearbeiten</Btn>
      <Btn onClick={()=>exportExJson(ex)} variant="secondary" sm><Download size={14}/> JSON</Btn>
      <Btn onClick={()=>exportExHtml(ex)} variant="secondary" sm>🖨 HTML/PDF</Btn>
      <Btn onClick={onClose} sm>Schließen</Btn>
    </div>
  </div>);
}

// ── LIBRARY PAGE ──────────────────────────────────────────────────
function LibraryPage({exercises,onSave,onDelete,apiKey,toast}) {
  const [search,setSearch]=useState("");
  const [fCat,setFCat]=useState("");
  const [fTag,setFTag]=useState("");
  const [fRat,setFRat]=useState(0);
  const [showF,setShowF]=useState(false);
  const [modal,setModal]=useState(null);
  const [selMode,setSelMode]=useState(false);
  const [selIds,setSelIds]=useState([]);
  const [collapsed,setCollapsed]=useState({});
  const toggleCat=cat=>setCollapsed(c=>({...c,[cat]:!c[cat]}));
  const importRef=useRef();
  const toggleSel=id=>setSelIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const bulkExport=()=>{
    const sel=exercises.filter(e=>selIds.includes(e.id));
    dlJson({version:APP_VERSION,exportDate:now(),type:"exercises",exercises:sel},`uebungen_auswahl_${todayISO()}.json`,toast);
  };

  const handleImportJson=async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try{
      const data=JSON.parse(await readText(f));
      const list=data.exercises||( Array.isArray(data)?data:null);
      if(!list) throw new Error("Keine Übungen gefunden");
      const valid=list.map(ex=>({rating:3,minPlayers:4,maxPlayers:12,duration:10,tags:[],material:[],imageUrl:"",source:"",notes:"",description:"",setup:"",...ex,id:uid(),createdAt:now(),updatedAt:now()})).filter(ex=>ex.title&&ex.category);
      valid.forEach(ex=>onSave(ex,true));
      toast(`${valid.length} Übungen importiert ✓`);
    }catch(err){toast("Import fehlgeschlagen: "+err.message,"err");}
    e.target.value="";
  };

  const filtered=exercises.filter(ex=>{
    if(search&&!ex.title.toLowerCase().includes(search.toLowerCase())&&!ex.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if(fCat&&ex.category!==fCat) return false;
    if(fTag&&!ex.tags?.includes(fTag)) return false;
    if(fRat&&ex.rating<fRat) return false;
    return true;
  });
  const allTags=[...new Set(exercises.flatMap(e=>e.tags||[]))].sort();
  return(<div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div><h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Übungsbibliothek</h1><div style={{fontSize:13,color:C.muted,marginTop:2}}>{exercises.length} Übungen</div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {selMode
          ?<><Btn sm variant="secondary" onClick={()=>setSelIds(filtered.map(e=>e.id))}>Alle</Btn>
            <Btn sm variant="secondary" onClick={()=>setSelIds([])}>Keine</Btn>
            {selIds.length>0&&<Btn sm onClick={bulkExport}><Download size={13}/> {selIds.length} exportieren</Btn>}
            <Btn sm variant="secondary" onClick={()=>{setSelMode(false);setSelIds([]);}}>✕ Auswahl</Btn></>
          :<><Btn onClick={()=>setSelMode(true)} variant="secondary" sm><CheckSquare size={14}/> Auswahl</Btn>
            <Btn onClick={()=>importRef.current.click()} variant="secondary" sm><Upload size={14}/> Import</Btn>
            <input ref={importRef} type="file" accept=".json" onChange={handleImportJson} style={{display:"none"}}/>
            <Btn onClick={()=>setModal({type:"ai"})} variant="ai" sm><Bot size={14}/> KI</Btn>
            <Btn onClick={()=>setModal({type:"form",ex:null})}><Plus size={16}/> Neu</Btn></>}
      </div>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:200,position:"relative"}}>
        <Search size={15} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen..." style={{width:"100%",padding:"9px 12px 9px 36px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
      </div>
      <Btn onClick={()=>setShowF(f=>!f)} variant="secondary" sm><Filter size={14}/> Filter {(fCat||fTag||fRat)?"(aktiv)":""}</Btn>
    </div>
    {showF&&<div style={{background:C.card,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:14,display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
      <div style={{flex:1,minWidth:130}}><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:4}}>KATEGORIE</label><select value={fCat} onChange={e=>setFCat(e.target.value)} style={{width:"100%",padding:"7px 10px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none"}}><option value="">Alle</option>{Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}</select></div>
      <div style={{flex:1,minWidth:130}}><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:4}}>TAG</label><select value={fTag} onChange={e=>setFTag(e.target.value)} style={{width:"100%",padding:"7px 10px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none"}}><option value="">Alle</option>{allTags.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
      <div style={{flex:1,minWidth:130}}><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:4}}>MIN. BEWERTUNG</label><select value={fRat} onChange={e=>setFRat(Number(e.target.value))} style={{width:"100%",padding:"7px 10px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none"}}><option value={0}>Alle</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{"★".repeat(n)} +</option>)}</select></div>
      <Btn sm variant="secondary" onClick={()=>{setFCat("");setFTag("");setFRat(0);setShowF(false);}}>Reset</Btn>
    </div>}
    <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
      {[["","Alle",exercises.length],...Object.entries(CATS).map(([k,v])=>[k,`${v.emoji} ${v.label}`,exercises.filter(e=>e.category===k).length])].map(([k,l,n])=>(
        <button key={k} onClick={()=>setFCat(k)} style={{padding:"5px 14px",borderRadius:20,border:`1.5px solid ${fCat===k?(k?CATS[k].color:C.primary):C.border}`,background:fCat===k?(k?CATS[k].bg:C.accentL):"white",color:fCat===k?(k?CATS[k].color:C.primary):C.muted,cursor:"pointer",fontSize:13,fontWeight:700,whiteSpace:"nowrap",fontFamily:"inherit"}}>{l} ({n})</button>
      ))}
    </div>
    {exercises.length===0?<Empty icon="📚" title="Noch keine Übungen" sub="Lege deine erste Übung an oder nutze KI-Import." onAdd={()=>setModal({type:"form",ex:null})} addLabel="Erste Übung erstellen"/>
    :filtered.length===0?<div style={{textAlign:"center",padding:"40px 0",color:C.muted,fontSize:14}}>Keine Übungen für diese Suche / diesen Filter.</div>
    :<div style={{display:"flex",flexDirection:"column",gap:16}}>
      {Object.entries(CATS).map(([cat,catInfo])=>{
        const catExs=filtered.filter(e=>e.category===cat);
        if(!catExs.length)return null;
        const isOpen=collapsed[cat]!==true;
        return(<div key={cat}>
          <button onClick={()=>toggleCat(cat)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${catInfo.color}44`,background:catInfo.bg,cursor:"pointer",fontFamily:"inherit",marginBottom:isOpen?10:0}}>
            <span style={{fontSize:16}}>{catInfo.emoji}</span>
            <span style={{fontWeight:800,fontSize:15,color:catInfo.color,flex:1,textAlign:"left"}}>{catInfo.label}</span>
            <span style={{fontSize:12,fontWeight:700,color:catInfo.color,padding:"2px 8px",borderRadius:20,background:catInfo.color+"22"}}>{catExs.length}</span>
            <span style={{fontSize:12,color:catInfo.color,marginLeft:4}}>{isOpen?"▲":"▼"}</span>
          </button>
          {isOpen&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
            {catExs.map(ex=>{
              const isSel=selIds.includes(ex.id);
              return(<div key={ex.id} onClick={()=>selMode?toggleSel(ex.id):setModal({type:"detail",ex})}
                style={{background:C.card,borderRadius:12,border:`2px solid ${selMode&&isSel?C.primary:C.border}`,padding:"14px 16px",cursor:"pointer",display:"flex",flexDirection:"column",gap:8,transition:"box-shadow .15s",position:"relative",opacity:selMode&&!isSel?.7:1}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.1)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                {selMode&&<div style={{position:"absolute",top:10,right:10,color:isSel?C.primary:C.muted}}>{isSel?<CheckSquare size={18}/>:<Square size={18}/>}</div>}
                {ex.imageUrl&&<img src={ex.imageUrl} alt="" style={{width:"100%",height:100,objectFit:"cover",borderRadius:8}}/>}
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                <CatBadge cat={ex.category} small/>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  {ex.done&&<span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:10,background:"#dcfce7",color:"#16a34a"}}>✅</span>}
                  <Stars value={ex.rating} readonly/>
                </div>
              </div>
                <div style={{fontWeight:800,fontSize:15,color:C.text}}>{ex.title}</div>
                <div style={{display:"flex",gap:10,color:C.muted,fontSize:12,fontWeight:600,flexWrap:"wrap"}}><span>⏱ {ex.duration} Min</span><span>👥 {ex.minPlayers}–{ex.maxPlayers}</span>{ex.material?.length>0&&<span>📦 {ex.material.length}x</span>}</div>
                {ex.tags?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{ex.tags.slice(0,3).map(t=><span key={t} style={{padding:"2px 8px",borderRadius:20,background:"#f1f5f9",color:C.muted,fontSize:11,fontWeight:600}}>{t}</span>)}{ex.tags.length>3&&<span style={{padding:"2px 8px",borderRadius:20,background:"#f1f5f9",color:C.muted,fontSize:11}}>+{ex.tags.length-3}</span>}</div>}
              </div>);
            })}
          </div>}
        </div>);
      })}
    </div>}
    {modal?.type==="ai"&&<Modal title="🤖 KI-Import" onClose={()=>setModal(null)} wide><AIImportModal apiKey={apiKey} onSave={ex=>{onSave(ex);setModal(null);}} onClose={()=>setModal(null)}/></Modal>}
    {modal?.type==="form"&&<Modal title={modal.ex?"Übung bearbeiten":"Neue Übung"} onClose={()=>setModal(null)} wide><ExerciseForm exercise={modal.ex} onSave={(ex,andAdd)=>{onSave(ex);if(!andAdd)setModal(null);}} onClose={()=>setModal(null)}/></Modal>}
    {modal?.type==="detail"&&<Modal title={modal.ex.title} onClose={()=>setModal(null)} wide><ExDetail exercise={modal.ex} onEdit={()=>setModal({type:"form",ex:modal.ex})} onDelete={onDelete} onClose={()=>setModal(null)}/></Modal>}
  </div>);
}

// ── PLAYER FORM ───────────────────────────────────────────────────
const EMPTY_PLAYER = {name:"",birthYear:2019,strength:1,active:true,jersey:"",notes:"",vereinsmitglied:false,spielerpass:false,contacts:[]};
const EMPTY_CONTACT = {name:"",relation:"Mutter",phone:"",email:"",address:""};
const RELATIONS = ["Mutter","Vater","Elternteil","Großelternteil","Geschwister","Sonstiges"];

function ContactsEditor({contacts,onChange}) {
  const [editIdx,setEditIdx]=useState(null);
  const [form,setForm]=useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const startAdd=()=>{setForm({...EMPTY_CONTACT,id:uid()});setEditIdx(-1);};
  const startEdit=(i)=>{setForm({...contacts[i]});setEditIdx(i);};
  const save=()=>{if(!form.name.trim())return;if(editIdx===-1)onChange([...contacts,form]);else onChange(contacts.map((c,i)=>i===editIdx?form:c));setForm(null);setEditIdx(null);};
  const remove=(i)=>onChange(contacts.filter((_,j)=>j!==i));
  if(form) return(
    <div style={{background:"#f8fafc",borderRadius:10,border:`1.5px solid ${C.border}`,padding:"14px 16px",marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:12}}>{editIdx===-1?"Kontakt hinzufügen":"Kontakt bearbeiten"}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="Name *" value={form.name} onChange={e=>set("name",e.target.value)} style={{marginBottom:0}}/><Sel label="Beziehung" value={form.relation} onChange={e=>set("relation",e.target.value)} style={{marginBottom:0}}>{RELATIONS.map(r=><option key={r} value={r}>{r}</option>)}</Sel></div>
      <Inp label="Telefon" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="+49 ..."/>
      <Inp label="E-Mail" type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="email@beispiel.de"/>
      <Txta label="Adresse" value={form.address} onChange={e=>set("address",e.target.value)} rows={2} placeholder="Straße, PLZ Ort"/>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn sm variant="secondary" onClick={()=>{setForm(null);setEditIdx(null);}}>Abbrechen</Btn><Btn sm onClick={save}>Speichern</Btn></div>
    </div>);
  return(<div style={{marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>Kontaktpersonen ({contacts.length})</label><Btn sm onClick={startAdd}><Plus size={12}/> Hinzufügen</Btn></div>
    {contacts.length===0&&<div style={{fontSize:13,color:C.muted,padding:"6px 0"}}>Noch keine Kontaktperson eingetragen.</div>}
    {contacts.map((c,i)=><div key={c.id||i} style={{background:"#f8fafc",borderRadius:8,border:`1px solid ${C.border}`,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
      <div><div style={{fontWeight:700,fontSize:14,color:C.text}}>{c.name} <span style={{fontSize:12,color:C.muted,fontWeight:400}}>({c.relation})</span></div>{c.phone&&<div style={{fontSize:13,color:C.muted,marginTop:2}}>📞 {c.phone}</div>}{c.email&&<div style={{fontSize:13,color:C.muted}}>✉️ {c.email}</div>}{c.address&&<div style={{fontSize:12,color:C.muted}}>📍 {c.address}</div>}</div>
      <div style={{display:"flex",gap:4,flexShrink:0}}><button onClick={()=>startEdit(i)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,padding:4}}><Edit2 size={13}/></button><button onClick={()=>remove(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",padding:4}}><Trash2 size={13}/></button></div>
    </div>)}
  </div>);
}
function PlayerForm({player,onSave,onClose}) {
  const [form,setForm]=useState({...EMPTY_PLAYER,...player,contacts:player?.contacts||[]});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const doSave=(andAdd)=>{
    if(!form.name.trim())return;
    onSave({...form,id:form.id||uid(),createdAt:form.createdAt||now()});
    if(andAdd) setForm({...EMPTY_PLAYER,contacts:[]});
  };
  return(<div>
    <Inp label="Name *" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Vorname"/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}><Inp label="Jahrgang" type="number" value={form.birthYear} onChange={e=>set("birthYear",Number(e.target.value))} style={{marginBottom:0}}/><Inp label="Trikot #" value={form.jersey} onChange={e=>set("jersey",e.target.value)} placeholder="z.B. 7" style={{marginBottom:0}}/></div>
    <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.6}}>Stärke</label><div style={{display:"flex",flexDirection:"column",gap:8}}>{[1,2,3,4].map(n=>{const s=STR[n];return(<button key={n} onClick={()=>set("strength",n)} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 14px",borderRadius:10,border:`2px solid ${form.strength===n?s.color:C.border}`,background:form.strength===n?s.light:"white",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}><span style={{fontSize:20,lineHeight:1}}>{s.emoji}</span><div><div style={{fontWeight:700,fontSize:14,color:form.strength===n?s.color:C.text}}>{s.label}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{s.desc}</div></div></button>);})}</div></div>
    <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap"}}>
      <label style={{display:"flex",gap:8,alignItems:"center",cursor:"pointer"}}><input type="checkbox" checked={form.active} onChange={e=>set("active",e.target.checked)} style={{width:16,height:16}}/><span style={{fontSize:14,fontWeight:600,color:C.text}}>Aktiv</span></label>
      <label style={{display:"flex",gap:8,alignItems:"center",cursor:"pointer"}}><input type="checkbox" checked={!!form.vereinsmitglied} onChange={e=>set("vereinsmitglied",e.target.checked)} style={{width:16,height:16}}/><span style={{fontSize:14,fontWeight:600,color:C.text}}>Vereinsmitglied</span></label>
      <label style={{display:"flex",gap:8,alignItems:"center",cursor:"pointer"}}><input type="checkbox" checked={!!form.spielerpass} onChange={e=>set("spielerpass",e.target.checked)} style={{width:16,height:16}}/><span style={{fontSize:14,fontWeight:600,color:C.text}}>Spielerpass ✓</span></label>
    </div>
    <Txta label="Notizen" value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2}/>
    <ContactsEditor contacts={form.contacts||[]} onChange={v=>set("contacts",v)}/>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
      <Btn onClick={onClose} variant="secondary">Abbrechen</Btn>
      {!player?.id&&<Btn variant="secondary" onClick={()=>doSave(true)}>+ Weiteren anlegen</Btn>}
      <Btn onClick={()=>doSave(false)}>{player?.id?"Speichern":"Erstellen"}</Btn>
    </div>
  </div>);
}

// ── COACH FORM ────────────────────────────────────────────────────
const EMPTY_COACH = {name:"",role:"assistant",phone:"",active:true,notes:""};
function CoachForm({coach,onSave,onClose}) {
  const [form,setForm]=useState({...EMPTY_COACH,...coach});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const doSave=(andAdd)=>{
    if(!form.name.trim())return;
    onSave({...form,id:form.id||uid(),createdAt:form.createdAt||now()});
    if(andAdd) setForm(EMPTY_COACH);
  };
  return(<div>
    <Inp label="Name *" value={form.name} onChange={e=>set("name",e.target.value)}/>
    <Sel label="Rolle" value={form.role} onChange={e=>set("role",e.target.value)}>{Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Sel>
    <Inp label="Telefon" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="+49..."/>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><input type="checkbox" id="ca" checked={form.active} onChange={e=>set("active",e.target.checked)} style={{width:16,height:16}}/><label htmlFor="ca" style={{fontSize:14,fontWeight:600,color:C.text,cursor:"pointer"}}>Aktiv</label></div>
    <Txta label="Notizen" value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2}/>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
      <Btn onClick={onClose} variant="secondary">Abbrechen</Btn>
      {!coach?.id&&<Btn variant="secondary" onClick={()=>doSave(true)}>+ Weiteren anlegen</Btn>}
      <Btn onClick={()=>doSave(false)}>{coach?.id?"Speichern":"Erstellen"}</Btn>
    </div>
  </div>);
}

// ── TEAM PAGE ─────────────────────────────────────────────────────
function TeamPage({players,coaches,onSavePlayer,onDeletePlayer,onSaveCoach,onDeleteCoach,toast,onAddToTraining}) {
  const [tab,setTab]=useState("players");
  const [modal,setModal]=useState(null);
  const [del,setDel]=useState(null);
  const [kontakteSearch,setKontakteSearch]=useState("");
  const playerImportRef=useRef();
  const coachImportRef=useRef();

  const handleImportPlayers=async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try{
      const data=JSON.parse(await readText(f));
      const list=data.players||(Array.isArray(data)?data:null);
      if(!list) throw new Error("Keine Spieler gefunden");
      list.forEach(p=>onSavePlayer({...p,id:uid(),createdAt:now()}));
      toast(`${list.length} Spieler importiert ✓`);
    }catch(err){toast("Fehler: "+err.message,"err");}
    e.target.value="";
  };
  const handleImportCoaches=async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try{
      const data=JSON.parse(await readText(f));
      const list=data.coaches||(Array.isArray(data)?data:null);
      if(!list) throw new Error("Keine Trainer gefunden");
      list.forEach(c=>onSaveCoach({...c,id:uid(),createdAt:now()}));
      toast(`${list.length} Trainer importiert ✓`);
    }catch(err){toast("Fehler: "+err.message,"err");}
    e.target.value="";
  };

  const [selPlayers,setSelPlayers]=useState([]);
  const [selCoaches,setSelCoaches]=useState([]);
  const grp={4:[],3:[],2:[],1:[]};players.forEach(p=>grp[p.strength]?.push(p));
  const tb=(k,l,n)=><button onClick={()=>setTab(k)} style={{padding:"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"inherit",background:tab===k?C.primary:"transparent",color:tab===k?"white":C.muted}}>{l} <span style={{fontSize:12,opacity:.7}}>({n})</span></button>;
  const totalSel=selPlayers.length+selCoaches.length;
  return(<div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div><h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Team</h1><div style={{fontSize:13,color:C.muted,marginTop:2}}>{players.filter(p=>p.active).length} aktive Spieler · {coaches.filter(c=>c.active).length} Trainer</div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {tab==="players"&&<><Btn onClick={()=>playerImportRef.current.click()} variant="secondary" sm><Upload size={14}/> Spieler importieren</Btn><input ref={playerImportRef} type="file" accept=".json,.csv" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.name.endsWith(".csv")){const p=parseCsvPlayers(await readText(f));p.forEach(x=>onSavePlayer(x));toast(`${p.length} Spieler importiert`);} else handleImportPlayers(e); e.target.value="";}} style={{display:"none"}}/></>}
        {tab==="coaches"&&<><Btn onClick={()=>coachImportRef.current.click()} variant="secondary" sm><Upload size={14}/> Trainer importieren</Btn><input ref={coachImportRef} type="file" accept=".json" onChange={handleImportCoaches} style={{display:"none"}}/></>}
        {(tab==="players"||tab==="coaches")&&<Btn onClick={()=>setModal({type:tab==="players"?"pf":"cf",data:null})}><Plus size={16}/> {tab==="players"?"Spieler":"Trainer"} hinzufügen</Btn>}
      </div>
    </div>
    <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:10,padding:4,marginBottom:12,width:"fit-content"}}>{tb("players","Spieler",players.length)}{tb("coaches","Trainer",coaches.length)}{tb("kontakte","Kontakte",players.filter(p=>(p.contacts||[]).length>0).length)}</div>
    {totalSel>0&&<div style={{background:C.accentL,border:`1.5px solid ${C.accent}`,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <span style={{fontWeight:700,color:C.primary,fontSize:14}}>✓ {totalSel} ausgewählt</span>
      <Btn sm onClick={()=>setModal({type:"quickTraining"})}><CalendarDays size={13}/> Zum Training hinzufügen</Btn>
      <Btn sm variant="secondary" onClick={()=>{setSelPlayers([]);setSelCoaches([]);}}>Auswahl leeren</Btn>
    </div>}
    {tab==="players"&&(players.length===0?<Empty icon="👦" title="Noch keine Spieler" onAdd={()=>setModal({type:"pf",data:null})} addLabel="Ersten Spieler anlegen"/>:
      <div>{[4,3,2,1].map(s=>{const g=grp[s];if(!g.length)return null;return(<div key={s} style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><StrBadge level={s}/><span style={{fontSize:13,color:C.muted}}>{g.length} Spieler</span></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          {g.map(p=>{const isSel=selPlayers.includes(p.id);return(<div key={p.id} style={{background:C.card,borderRadius:10,border:`2px solid ${isSel?C.primary:C.border}`,padding:"12px 14px",opacity:p.active?1:.6,cursor:"pointer"}} onClick={()=>setSelPlayers(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])}>
            <div style={{display:"flex",justifyContent:"space-between",gap:6}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                <div style={{color:isSel?C.primary:C.muted,marginTop:2,flexShrink:0}}>{isSel?<CheckSquare size={16}/>:<Square size={16}/>}</div>
                <div><div style={{fontWeight:800,fontSize:15,color:C.text}}>{p.name}</div>{p.jersey&&<div style={{fontSize:12,color:C.muted}}>#{p.jersey}</div>}{!p.active&&<div style={{fontSize:11,color:"#f59e0b",fontWeight:700}}>Inaktiv</div>}</div>
              </div>
              <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}><button onClick={()=>setModal({type:"pf",data:p})} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,padding:4}}><Edit2 size={14}/></button><button onClick={()=>setDel({type:"player",id:p.id,name:p.name})} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",padding:4}}><Trash2 size={14}/></button></div>
            </div>
            {p.notes&&<div style={{fontSize:12,color:C.muted,marginTop:6,fontStyle:"italic"}}>{p.notes}</div>}
          </div>);})}
        </div>
      </div>);})}
    </div>)}
    {tab==="coaches"&&(coaches.length===0?<Empty icon="🧑‍🏫" title="Noch keine Trainer" onAdd={()=>setModal({type:"cf",data:null})} addLabel="Ersten Trainer anlegen"/>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
        {coaches.map(c=>{const isSel=selCoaches.includes(c.id);return(<div key={c.id} style={{background:C.card,borderRadius:10,border:`2px solid ${isSel?C.primary:C.border}`,padding:"14px 16px",opacity:c.active?1:.6,cursor:"pointer"}} onClick={()=>setSelCoaches(prev=>prev.includes(c.id)?prev.filter(x=>x!==c.id):[...prev,c.id])}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
              <div style={{color:isSel?C.primary:C.muted,marginTop:2}}>{isSel?<CheckSquare size={16}/>:<Square size={16}/>}</div>
              <div><div style={{fontWeight:800,fontSize:15,color:C.text}}>{c.name}</div><div style={{fontSize:12,color:C.muted}}>{ROLES[c.role]}</div>{c.phone&&<div style={{fontSize:12,color:C.muted}}>{c.phone}</div>}</div>
            </div>
            <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}><button onClick={()=>setModal({type:"cf",data:c})} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,padding:4}}><Edit2 size={14}/></button><button onClick={()=>setDel({type:"coach",id:c.id,name:c.name})} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",padding:4}}><Trash2 size={14}/></button></div>
          </div>
        </div>);})}
      </div>)}
    {tab==="kontakte"&&(<div>
      <div style={{position:"relative",marginBottom:16}}>
        <Search size={15} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
        <input value={kontakteSearch} onChange={e=>setKontakteSearch(e.target.value)} placeholder="Spieler oder Kontakt suchen..." style={{width:"100%",padding:"9px 12px 9px 36px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
      </div>
      {players.length===0?<Empty icon="👥" title="Noch keine Spieler" sub="Lege zuerst Spieler im Tab ‚Spieler' an." onAdd={()=>setTab("players")} addLabel="Zu Spieler"/>:
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {players.filter(p=>{const q=kontakteSearch.toLowerCase();if(!q)return true;if(p.name.toLowerCase().includes(q))return true;return (p.contacts||[]).some(c=>c.name.toLowerCase().includes(q)||c.phone?.includes(q));}).map(p=>{
            const contacts=p.contacts||[];
            return(<div key={p.id} style={{background:C.card,borderRadius:12,border:`1.5px solid ${C.border}`,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",background:"#f8fafc",borderBottom:contacts.length?`1px solid ${C.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:STR[p.strength].light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{STR[p.strength].emoji}</div>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,color:C.text}}>{p.name}</div>
                    <div style={{display:"flex",gap:8,marginTop:2}}>
                      {p.jersey&&<span style={{fontSize:11,color:C.muted}}>#{p.jersey}</span>}
                      <span style={{fontSize:11,padding:"1px 6px",borderRadius:10,background:p.vereinsmitglied?"#dcfce7":"#f1f5f9",color:p.vereinsmitglied?"#16a34a":C.muted,fontWeight:700}}>{p.vereinsmitglied?"✓ Mitglied":"○ Kein Mitglied"}</span>
                      <span style={{fontSize:11,padding:"1px 6px",borderRadius:10,background:p.spielerpass?"#dbeafe":"#f1f5f9",color:p.spielerpass?"#1d4ed8":C.muted,fontWeight:700}}>{p.spielerpass?"✓ Pass":"○ Kein Pass"}</span>
                    </div>
                  </div>
                </div>
                <button onClick={()=>setModal({type:"pf",data:p})} style={{background:"none",border:`1.5px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.muted,padding:"6px 10px",display:"flex",alignItems:"center",gap:4,fontFamily:"inherit",fontSize:12,fontWeight:700}}><Edit2 size={12}/> Bearbeiten</button>
              </div>
              {contacts.length===0&&<div style={{padding:"10px 16px",fontSize:13,color:C.muted,fontStyle:"italic"}}>Keine Kontaktperson – <button onClick={()=>setModal({type:"pf",data:p})} style={{background:"none",border:"none",cursor:"pointer",color:C.primary,fontWeight:700,fontSize:13,padding:0,fontFamily:"inherit"}}>jetzt hinzufügen</button></div>}
              {contacts.map((c,i)=><div key={i} style={{padding:"10px 16px",borderTop:i>0?`1px solid ${C.border}`:"none",display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{fontSize:20,marginTop:2,flexShrink:0}}>{c.relation==="Mutter"?"👩":c.relation==="Vater"?"👨":"👤"}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:C.text}}>{c.name} <span style={{fontWeight:400,fontSize:12,color:C.muted}}>({c.relation})</span></div>
                  {c.phone&&<a href={`tel:${c.phone}`} style={{display:"flex",alignItems:"center",gap:4,fontSize:13,color:"#2563eb",textDecoration:"none",marginTop:2}}><Phone size={12}/> {c.phone}</a>}
                  {c.email&&<div style={{fontSize:12,color:C.muted,marginTop:1}}>✉️ {c.email}</div>}
                  {c.address&&<div style={{display:"flex",alignItems:"flex-start",gap:4,fontSize:12,color:C.muted,marginTop:1}}><MapPin size={11} style={{marginTop:2,flexShrink:0}}/>{c.address}</div>}
                </div>
              </div>)}
            </div>);
          })}
        </div>}
    </div>)}
    {del&&<Modal title="Löschen?" onClose={()=>setDel(null)}><p style={{color:C.text,marginTop:0}}>„<strong>{del.name}</strong>" wirklich löschen?</p><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn onClick={()=>setDel(null)} variant="secondary">Abbrechen</Btn><Btn onClick={()=>{del.type==="player"?onDeletePlayer(del.id):onDeleteCoach(del.id);setDel(null);}} variant="danger"><Trash2 size={14}/> Löschen</Btn></div></Modal>}
    {modal?.type==="pf"&&<Modal title={modal.data?"Spieler bearbeiten":"Neuer Spieler"} onClose={()=>setModal(null)}><PlayerForm player={modal.data} onSave={(p,andAdd)=>{onSavePlayer(p);if(!andAdd)setModal(null);}} onClose={()=>setModal(null)}/></Modal>}
    {modal?.type==="cf"&&<Modal title={modal.data?"Trainer bearbeiten":"Neuer Trainer"} onClose={()=>setModal(null)}><CoachForm coach={modal.data} onSave={(c,andAdd)=>{onSaveCoach(c);if(!andAdd)setModal(null);}} onClose={()=>setModal(null)}/></Modal>}
    {modal?.type==="quickTraining"&&onAddToTraining&&<Modal title="Zum Training hinzufügen" onClose={()=>setModal(null)}>
      <p style={{color:C.muted,fontSize:14,margin:"0 0 16px"}}>Diese Auswahl wird einem neuen Training zugeordnet:</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
        {selPlayers.map(id=>{const p=players.find(x=>x.id===id);return p?<span key={id} style={{padding:"4px 10px",borderRadius:20,background:STR[p.strength].light,color:STR[p.strength].color,fontSize:13,fontWeight:700}}>{STR[p.strength].emoji} {p.name}</span>:null;})}
        {selCoaches.map(id=>{const c=coaches.find(x=>x.id===id);return c?<span key={id} style={{padding:"4px 10px",borderRadius:20,background:C.accentL,color:C.primary,fontSize:13,fontWeight:700}}>🧑‍🏫 {c.name}</span>:null;})}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <Btn onClick={()=>setModal(null)} variant="secondary">Abbrechen</Btn>
        <Btn onClick={()=>{onAddToTraining({playerIds:selPlayers,coachIds:selCoaches});setSelPlayers([]);setSelCoaches([]);setModal(null);}}>Training erstellen</Btn>
      </div>
    </Modal>}
  </div>);
}

// ── TEAM BUILDER ──────────────────────────────────────────────────
function TeamBuilderModal({availablePlayers,onSaveTeams,onClose}) {
  const activeDef=availablePlayers.filter(p=>p.active);
  const defTeams=Math.max(2,Math.round(activeDef.length/3));
  const [numTeams,setNumTeams]=useState(defTeams);
  const [mode,setMode]=useState("balanced");
  const [skillDist,setSkillDist]=useState({strong:0,weak:0});
  const [teams,setTeams]=useState([]);
  const [selIds,setSelIds]=useState(activeDef.map(p=>p.id));
  const sel=availablePlayers.filter(p=>selIds.includes(p.id));
  const perTeam=sel.length?Math.round(sel.length/numTeams):3;
  const generate=()=>setTeams(buildTeams(sel,numTeams,mode,skillDist));
  const mb=(k,l,d)=><button onClick={()=>setMode(k)} style={{flex:1,minWidth:110,padding:"8px 10px",borderRadius:8,border:`2px solid ${mode===k?C.primary:C.border}`,background:mode===k?C.accentL:"white",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}><div style={{fontWeight:700,fontSize:13,color:mode===k?C.primary:C.text}}>{l}</div><div style={{fontSize:11,color:C.muted}}>{d}</div></button>;
  return(<div>
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>Spieler ({sel.length})</label><div style={{display:"flex",gap:6}}><Btn sm variant="secondary" onClick={()=>setSelIds(availablePlayers.filter(p=>p.active).map(p=>p.id))}>Alle</Btn><Btn sm variant="secondary" onClick={()=>setSelIds([])}>Keine</Btn></div></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:10,background:"#f8fafc",borderRadius:8,border:`1.5px solid ${C.border}`}}>
        {availablePlayers.map(p=><button key={p.id} onClick={()=>setSelIds(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])} style={{padding:"4px 12px",borderRadius:20,border:`2px solid ${selIds.includes(p.id)?STR[p.strength].color:C.border}`,background:selIds.includes(p.id)?STR[p.strength].light:"white",color:selIds.includes(p.id)?STR[p.strength].color:C.muted,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>{STR[p.strength].emoji} {p.name}</button>)}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
      <div>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Anzahl Teams</label>
        <Stepper value={numTeams} onChange={setNumTeams} min={2} max={12}/>
        <div style={{fontSize:11,color:C.muted,marginTop:4}}>≈ {perTeam} Spieler/Team</div>
      </div>
      <div>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Modus</label>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {[["balanced","⚖️ Ausgeglichen","Stärken gleichmäßig verteilt"],["skill","📊 Stärke-Gruppen","Ich bestimme wie viele stark/schwach"],["mixed","🎨 Durchmischt","Alle Level in jedem Team"],["challenge","⚡ Herausforderung","Stark vs. Schwach"],["random","🎲 Zufällig","Komplett zufällig"]].map(([k,l,d])=><button key={k} onClick={()=>setMode(k)} style={{padding:"6px 10px",borderRadius:7,border:`2px solid ${mode===k?C.primary:C.border}`,background:mode===k?C.accentL:"white",cursor:"pointer",textAlign:"left",fontFamily:"inherit",display:"flex",gap:8,alignItems:"center"}}><div style={{flex:1}}><span style={{fontWeight:700,fontSize:12,color:mode===k?C.primary:C.text}}>{l}</span><span style={{fontSize:11,color:C.muted,marginLeft:4}}>{d}</span></div></button>)}
        </div>
      </div>
    </div>
    {mode==="skill"&&<div style={{background:"#f0f9ff",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid #bae6fd"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#0369a1",marginBottom:10}}>📊 Stärke-Verteilung ({numTeams} Teams gesamt)</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        {[["strong","💪 Starke Teams","#dc2626","#fee2e2"],["mid","➖ Gemischte Teams","#d97706","#fef3c7"],["weak","🌱 Schwache Teams","#16a34a","#dcfce7"]].map(([k,l,col,bg])=>{
          const val=k==="mid"?numTeams-skillDist.strong-skillDist.weak:skillDist[k]||0;
          const setVal=v=>{if(k==="mid")return;const other=k==="strong"?"weak":"strong";const max=numTeams-(skillDist[other]||0);setSkillDist(d=>({...d,[k]:Math.min(Math.max(0,v),max)}));};
          return(<div key={k} style={{textAlign:"center",padding:"8px",borderRadius:8,background:bg,border:`1.5px solid ${col}33`}}>
            <div style={{fontSize:11,fontWeight:700,color:col,marginBottom:6}}>{l}</div>
            {k==="mid"?<div style={{fontWeight:900,fontSize:22,color:col}}>{val}</div>:<Stepper value={val} onChange={setVal} min={0} max={numTeams-1}/>}
          </div>);
        })}
      </div>
      <div style={{fontSize:11,color:C.muted,marginTop:8}}>Starke Teams spielen gegen starke, schwache gegen schwache → fairer Spaß für alle</div>
    </div>}
    <Btn onClick={generate} style={{width:"100%",justifyContent:"center",marginBottom:16}}><Shuffle size={16}/> Teams generieren</Btn>
    {teams.length>0&&(<><Divider/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
        {teams.map(t=><div key={t.id} style={{background:C.card,borderRadius:10,border:`2px solid ${C.accent}`,padding:"12px 14px"}}>
          <div style={{fontWeight:800,fontSize:14,color:C.primary,marginBottom:8}}>{t.name}</div>
          {t.players.map(p=><div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}><span>{STR[p.strength].emoji}</span><span style={{fontSize:13,fontWeight:600,color:C.text}}>{p.name}</span></div>)}
          <div style={{fontSize:11,color:C.muted,marginTop:6}}>Ø {(t.players.reduce((s,p)=>s+p.strength,0)/(t.players.length||1)).toFixed(1)}</div>
        </div>)}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
        <Btn onClick={generate} variant="secondary"><RefreshCw size={14}/> Neu mischen</Btn>
        <Btn onClick={()=>onSaveTeams(teams)}>Teams übernehmen</Btn>
      </div>
    </>)}
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}><Btn onClick={onClose} variant="secondary">Schließen</Btn></div>
  </div>);
}

// ── NOTFALL-PLAN ──────────────────────────────────────────────────
function NotfallModal({exercises,onClose}) {
  const [kids,setKids]=useState(10);
  const [minutes,setMinutes]=useState(10);
  const [mat,setMat]=useState([]);
  const [results,setResults]=useState(null);
  const toggleMat=m=>setMat(prev=>prev.includes(m)?prev.filter(x=>x!==m):[...prev,m]);
  const find=()=>{
    const scored=exercises.filter(ex=>{
      if((ex.duration||10)>minutes+3)return false;
      if(kids<(ex.minPlayers||0))return false;
      if(kids>(ex.maxPlayers||99))return false;
      return true;
    }).map(ex=>{
      let score=0;
      const exMat=ex.material||[];
      if(exMat.length===0)score+=3;
      else{const ok=exMat.filter(m=>mat.includes(m)).length;score+=(ok/exMat.length)*3;}
      score+=Math.max(0,1-(Math.abs((ex.duration||10)-minutes)/(minutes+1)))*2;
      score+=(ex.rating||3)*0.2;
      return{...ex,score};
    }).sort((a,b)=>b.score-a.score).slice(0,3);
    setResults(scored);
  };
  if(results) return(<div>
    <div style={{background:"#fef2f2",borderRadius:10,padding:"10px 14px",marginBottom:14,border:"1px solid #fecaca",fontSize:13,color:"#dc2626",fontWeight:600}}>🚨 Alternativen für {kids} Kinder · {minutes} Min übrig</div>
    {results.length===0?<div style={{textAlign:"center",padding:"30px 0",color:C.muted}}><div style={{fontSize:36,marginBottom:8}}>😕</div><div style={{fontWeight:700,color:C.text}}>Keine passenden Übungen gefunden</div><div style={{fontSize:13,marginTop:4}}>Mehr Material wählen oder Zeit erhöhen</div></div>:
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
        {results.map((ex,i)=><div key={ex.id} style={{background:C.card,borderRadius:10,border:`2px solid ${i===0?C.accent:C.border}`,padding:"12px 16px"}}>
          {i===0&&<div style={{fontSize:11,fontWeight:800,color:C.primary,marginBottom:6}}>⭐ BESTE OPTION</div>}
          <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}><CatBadge cat={ex.category} small/><span style={{fontSize:12,color:C.muted,marginLeft:"auto"}}>⏱ {ex.duration} Min · 👥 {ex.minPlayers}–{ex.maxPlayers}</span></div>
          <div style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:4}}>{ex.title}</div>
          {ex.description&&<div style={{fontSize:13,color:C.muted,lineHeight:1.5,marginBottom:6}}>{ex.description.slice(0,120)}{ex.description.length>120?"…":""}</div>}
          {ex.material?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{ex.material.map(m=><span key={m} style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:mat.includes(m)?C.accentL:"#f1f5f9",color:mat.includes(m)?C.primary:C.muted,fontWeight:600}}>📦 {m}</span>)}</div>}
        </div>)}
      </div>}
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn onClick={()=>setResults(null)} variant="secondary">Zurück</Btn><Btn onClick={onClose}>Schließen</Btn></div>
  </div>);
  return(<div>
    <div style={{background:"#fef2f2",borderRadius:10,padding:"12px 14px",marginBottom:16,border:"1px solid #fecaca",fontSize:13,color:"#dc2626",fontWeight:700}}>🚨 Übung funktioniert nicht – sofort Alternativen finden</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
      <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Kinder am Platz</label><input type="number" min={2} max={20} value={kids} onChange={e=>setKids(Number(e.target.value))} style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:18,fontWeight:800,textAlign:"center",outline:"none",boxSizing:"border-box"}}/></div>
      <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Zeit übrig</label><div style={{display:"flex",gap:6}}>{[5,10,15,20].map(m=><button key={m} onClick={()=>setMinutes(m)} style={{flex:1,padding:"9px 4px",borderRadius:8,border:`2px solid ${minutes===m?"#dc2626":C.border}`,background:minutes===m?"#fee2e2":"white",color:minutes===m?"#dc2626":C.muted,cursor:"pointer",fontWeight:800,fontSize:14,fontFamily:"inherit"}}>{m}'</button>)}</div></div>
    </div>
    <div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.6}}>Verfügbares Material (optional)</label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{PMAT.map(m=><button key={m} onClick={()=>toggleMat(m)} style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${mat.includes(m)?C.primary:C.border}`,background:mat.includes(m)?C.accentL:"white",color:mat.includes(m)?C.primary:C.muted,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{m}</button>)}</div></div>
    {exercises.length===0&&<div style={{background:"#fffbeb",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#92400e",border:"1px solid #fde68a"}}>⚠️ Noch keine Übungen in der Bibliothek.</div>}
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn onClick={onClose} variant="secondary">Abbrechen</Btn><Btn onClick={find} style={{background:"#dc2626",color:"white"}} disabled={exercises.length===0}><AlertTriangle size={14}/> Alternativen finden</Btn></div>
  </div>);
}

// ── SESSION FORM ──────────────────────────────────────────────────
function SessionForm({session,players,coaches,exercises,onSave,onClose}) {
  const [form,setForm]=useState({date:todayISO(),duration:60,location:"",weather:"",participantCount:"",coachIds:[],playerIds:[],exerciseIds:[],teams:[],notes:"",...session});
  const [showPlayers,setShowPlayers]=useState((session?.playerIds||[]).length>0);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const tog=(k,id)=>set(k,form[k].includes(id)?form[k].filter(x=>x!==id):[...form[k],id]);
  const ms=(items,sel,toggle,label,render)=><div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>{label}</label><div style={{display:"flex",flexWrap:"wrap",gap:6,padding:10,background:"#f8fafc",borderRadius:8,border:`1.5px solid ${C.border}`,maxHeight:120,overflowY:"auto"}}>{items.map(item=><button key={item.id} onClick={()=>toggle(item.id)} style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${sel.includes(item.id)?C.primary:C.border}`,background:sel.includes(item.id)?C.accentL:"white",color:sel.includes(item.id)?C.primary:C.muted,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{render(item)}</button>)}{items.length===0&&<span style={{color:C.muted,fontSize:13}}>Keine vorhanden</span>}</div></div>;
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="Datum" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/><Inp label="Dauer (Min)" type="number" value={form.duration} onChange={e=>set("duration",Number(e.target.value))} min={15}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Inp label="Ort" value={form.location} onChange={e=>set("location",e.target.value)} placeholder="Sportplatz..."/><Inp label="Wetter" value={form.weather} onChange={e=>set("weather",e.target.value)} placeholder="Sonnig, 18°C..."/></div>
    <div style={{marginBottom:14}}>
      <div style={{background:"#fffbeb",borderRadius:8,border:"1px solid #fde68a",padding:"10px 14px",display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:140}}><label style={{display:"block",fontSize:12,fontWeight:700,color:"#92400e",marginBottom:4}}>ANZAHL KINDER (schnell)</label><input type="number" min={0} value={form.participantCount} onChange={e=>set("participantCount",e.target.value)} placeholder="z.B. 12" style={{width:"100%",padding:"7px 10px",border:"1.5px solid #fde68a",borderRadius:8,fontSize:15,fontWeight:700,outline:"none",boxSizing:"border-box"}}/></div>
        <div style={{fontSize:12,color:"#92400e"}}>Oder spezifische<br/>Spieler unten wählen</div>
      </div>
    </div>
    {ms(coaches.filter(c=>c.active!==false),form.coachIds,id=>tog("coachIds",id),"Trainer",c=>c.name)}
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>Spieler ({form.playerIds.length}) <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>– optional</span></label>
        <div style={{display:"flex",gap:6}}>
          <Btn sm variant="secondary" onClick={()=>setShowPlayers(v=>!v)}>{showPlayers?"▲ Einklappen":"▼ Ausklappen"}</Btn>
          {showPlayers&&<><Btn sm variant="secondary" onClick={()=>set("playerIds",players.filter(p=>p.active).map(p=>p.id))}>Alle</Btn><Btn sm variant="secondary" onClick={()=>set("playerIds",[])}>Keine</Btn></>}
        </div>
      </div>
      {showPlayers&&<div style={{display:"flex",flexWrap:"wrap",gap:6,padding:10,background:"#f8fafc",borderRadius:8,border:`1.5px solid ${C.border}`,maxHeight:130,overflowY:"auto"}}>
        {players.filter(p=>p.active).map(p=><button key={p.id} onClick={()=>tog("playerIds",p.id)} style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${form.playerIds.includes(p.id)?STR[p.strength].color:C.border}`,background:form.playerIds.includes(p.id)?STR[p.strength].light:"white",color:form.playerIds.includes(p.id)?STR[p.strength].color:C.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{STR[p.strength].emoji} {p.name}</button>)}
      </div>}
    </div>
    {ms(exercises,form.exerciseIds,id=>tog("exerciseIds",id),"Verwendete Übungen",e=>`${CATS[e.category]?.emoji} ${e.title}`)}
    <Txta label="Notizen" value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3}/>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:`1px solid ${C.border}`}}><Btn onClick={onClose} variant="secondary">Abbrechen</Btn><Btn onClick={()=>onSave({...form,id:form.id||uid(),createdAt:form.createdAt||now()})}>{session?.id?"Speichern":"Erstellen"}</Btn></div>
  </div>);
}


// ── MANUAL TRAINING PLANNER ──────────────────────────────────────
const BLOCKS = [
  {key:"aufwaermen",  label:"Aufwärmen",        emoji:"🔥", cat:"aufwaermen",                defaultMin:10},
  {key:"mittel1",     label:"Mittelblock 1",     emoji:"🎯", cat:"koordination",              defaultMin:15},
  {key:"mittel2",     label:"Mittelblock 2",     emoji:"⚽", cat:"technik",                   defaultMin:12},
  {key:"spielform",   label:"Spielform / Funino",emoji:"🏆", cat:"spielform",                 defaultMin:20},
  {key:"abschluss",   label:"Abschluss",         emoji:"🌅", cat:"abschluss",                 defaultMin:5},
];

function ManualTrainingPlanner({exercises,players,onClose,onSaveSession,apiKey,toast,setup}) {
  const activeCount=players.filter(p=>p.active).length;
  const [kids,setKids]=useState(setup?.kids||activeCount||10);
  const [coaches,setCoaches]=useState(setup?.coachCount||1);
  const [totalMin,setTotalMin]=useState(setup?.duration||60);
  const [blocks,setBlocks]=useState(BLOCKS.map(b=>({...b,active:b.key!=="mittel2",parallel:false,stations:2,pick:"random",exerciseId:null,minutes:b.defaultMin})));
  const [plan,setPlan]=useState(null);

  const setBlock=(key,field,val)=>setBlocks(bs=>bs.map(b=>b.key===key?{...b,[field]:val}:b));
  const activeBlocks=blocks.filter(b=>b.active);
  const usedMin=activeBlocks.reduce((s,b)=>s+b.minutes,0);
  const remaining=totalMin-usedMin;

  const pickExercise=(cat,excludeId)=>{
    const pool=exercises.filter(e=>e.category===cat&&e.id!==excludeId);
    return pool.length?pool[Math.floor(Math.random()*pool.length)]:null;
  };

  const generate=()=>{
    const phases=activeBlocks.map(b=>{
      let ex=null;
      if(b.pick==="random") ex=pickExercise(b.cat,null);
      else if(b.pick==="manual"&&b.exerciseId) ex=exercises.find(e=>e.id===b.exerciseId);

      const kidsPerStation=b.parallel?Math.floor(kids/b.stations):kids;
      const stations=b.parallel?Array.from({length:b.stations},(_,i)=>({
        label:`Station ${i+1}`,
        exercise:pickExercise(b.cat, ex?.id)||ex,
        kids:kidsPerStation,
      })):null;

      return {
        block:b,
        exercise:ex,
        stations,
        kids:b.parallel?`${kidsPerStation}/Station (${b.stations} Stationen parallel)`:kids,
        minutes:b.minutes,
      };
    });
    setPlan({phases,kids,coaches,totalMin});
  };

  const phCol={aufwaermen:"#fff7ed",koordination:"#f5f3ff",technik:"#eff6ff",spielform:"#f0fdf4",abschluss:"#fdf2f8"};

  if(plan) return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h3 style={{margin:0,fontWeight:800,color:C.text}}>Trainingsplan</h3>
        <span style={{fontSize:13,color:C.muted}}>⏱ {plan.totalMin} Min · 👥 {plan.kids} Kinder · 🧑‍🏫 {plan.coaches} Trainer</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
        {plan.phases.map((ph,i)=>{
          const bg=phCol[ph.block.cat]||"#f8fafc";
          return(<div key={i} style={{borderRadius:10,border:`1.5px solid ${C.border}`,overflow:"hidden"}}>
            <div style={{background:bg,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontWeight:800,fontSize:14}}>{ph.block.emoji} {ph.block.label}</div>
              <div style={{fontSize:12,color:C.muted,display:"flex",gap:10}}><span>⏱ {ph.minutes} Min</span><span>👥 {ph.kids}</span></div>
            </div>
            <div style={{padding:"10px 14px"}}>
              {ph.stations
                ?<div>
                  <div style={{fontSize:12,color:"#7c3aed",fontWeight:700,marginBottom:8}}>⚡ Parallelbetrieb – {ph.block.stations} Stationen gleichzeitig</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {ph.stations.map((st,j)=><div key={j} style={{padding:"8px 12px",background:"#f8fafc",borderRadius:8,border:`1px solid ${C.border}`}}>
                      <div style={{fontWeight:700,fontSize:13,color:C.primary,marginBottom:2}}>{st.label} · {st.kids} Kinder</div>
                      {st.exercise?<div style={{fontSize:13,color:C.text}}>{st.exercise.title} <span style={{color:C.muted}}>·</span> <CatBadge cat={st.exercise.category} small/></div>:<div style={{fontSize:13,color:C.muted,fontStyle:"italic"}}>Keine passende Übung in Bibliothek</div>}
                      {st.exercise?.material?.length>0&&<div style={{fontSize:11,color:C.muted,marginTop:3}}>📦 {st.exercise.material.join(", ")}</div>}
                    </div>)}
                    <div style={{fontSize:12,color:"#7c3aed",fontStyle:"italic"}}>Kinder rotieren nach {Math.floor(ph.minutes/2)} Min oder spielen durch</div>
                  </div>
                </div>
                :<div>
                  {ph.exercise?<><div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:4}}>{ph.exercise.title} <CatBadge cat={ph.exercise.category} small/></div>
                    {ph.exercise.description&&<div style={{fontSize:13,color:C.muted,lineHeight:1.5,marginBottom:ph.exercise.material?.length?6:0}}>{ph.exercise.description.slice(0,150)}{ph.exercise.description.length>150?"…":""}</div>}
                    {ph.exercise.material?.length>0&&<div style={{fontSize:12,color:C.muted}}>📦 {ph.exercise.material.join(", ")}</div>}</>
                  :<div style={{fontSize:14,color:C.muted,fontStyle:"italic"}}>Keine passende Übung in der Bibliothek – eigene wählen oder ergänzen.</div>}
                </div>}
            </div>
          </div>);
        })}
      </div>
      {remaining!==0&&<div style={{padding:"8px 14px",borderRadius:8,background:remaining>0?"#f0fdf4":"#fef2f2",border:`1px solid ${remaining>0?"#86efac":"#fca5a5"}`,fontSize:13,color:remaining>0?"#166534":"#991b1b",marginBottom:12}}>
        {remaining>0?`⏰ ${remaining} Min Puffer übrig – ideal für Übergänge und Erklärungen`:`⚠️ ${Math.abs(remaining)} Min zu viel geplant – Blöcke kürzen`}
      </div>}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
        <Btn onClick={()=>setPlan(null)} variant="secondary"><RefreshCw size={14}/> Neu generieren</Btn>
        <Btn onClick={()=>{
          const exIds=[...new Set(plan.phases.flatMap(ph=>ph.stations?ph.stations.map(s=>s.exercise?.id).filter(Boolean):[ph.exercise?.id].filter(Boolean)))];
          onSaveSession({id:uid(),createdAt:now(),date:todayISO(),duration:plan.totalMin,location:"",weather:"",participantCount:String(plan.kids),coachIds:[],playerIds:[],exerciseIds:exIds,teams:[],notes:`Automatisch geplant: ${plan.phases.map(ph=>ph.block.label).join(" → ")}`});
          toast("Training gespeichert ✓");
          onClose();
        }}><CalendarDays size={14}/> Als Training speichern</Btn>
      </div>
    </div>
  );

  return(<div>
    <div style={{background:"#f0f9ff",borderRadius:10,padding:"10px 14px",marginBottom:16,border:"1px solid #bae6fd",fontSize:13,color:"#0369a1"}}>
      📋 Wähle Blöcke, Dauer und Anzahl – der Planer sucht passende Übungen aus deiner Bibliothek. Blöcke können parallel laufen (Kinder rotieren zwischen Stationen).
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
      <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Kinder</label><Stepper value={kids} onChange={setKids} min={4} max={30}/></div>
      <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Trainer</label><Stepper value={coaches} onChange={setCoaches} min={1} max={6}/></div>
      <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Gesamt (Min)</label><Stepper value={totalMin} onChange={setTotalMin} min={20} max={120}/></div>
    </div>

    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
      {blocks.map(b=><div key={b.key} style={{borderRadius:10,border:`1.5px solid ${b.active?C.primary:C.border}`,overflow:"hidden",opacity:b.active?1:.6}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:b.active?C.accentL:"#f8fafc",cursor:"pointer"}} onClick={()=>setBlock(b.key,"active",!b.active)}>
          <div style={{color:b.active?C.primary:C.muted}}>{b.active?<CheckSquare size={18}/>:<Square size={18}/>}</div>
          <span style={{fontSize:15,fontWeight:700,color:b.active?C.primary:C.text,flex:1}}>{b.emoji} {b.label}</span>
          <div onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{display:"flex",alignItems:"center",border:`1.5px solid ${C.border}`,borderRadius:6,overflow:"hidden",height:30}}>
              <button onClick={()=>setBlock(b.key,"minutes",Math.max(3,b.minutes-1))} style={{width:24,height:"100%",border:"none",cursor:"pointer",background:"#f1f5f9",fontSize:13,color:C.muted}}>−</button>
              <div style={{width:36,textAlign:"center",fontWeight:800,fontSize:13,color:C.text}}>{b.minutes}</div>
              <button onClick={()=>setBlock(b.key,"minutes",Math.min(60,b.minutes+1))} style={{width:24,height:"100%",border:"none",cursor:"pointer",background:"#f1f5f9",fontSize:13,color:C.text}}>+</button>
            </div>
            <span style={{fontSize:12,color:C.muted}}>Min</span>
          </div>
        </div>
        {b.active&&<div style={{padding:"10px 14px",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",gap:6}}>
            {[["random","🎲 Zufällig"],["manual","📋 Manuell"]].map(([v,l])=>(
              <button key={v} onClick={()=>setBlock(b.key,"pick",v)} style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${b.pick===v?C.primary:C.border}`,background:b.pick===v?C.accentL:"white",color:b.pick===v?C.primary:C.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>
          {b.pick==="manual"&&<select value={b.exerciseId||""} onChange={e=>setBlock(b.key,"exerciseId",e.target.value)} style={{flex:1,minWidth:140,padding:"5px 10px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none"}}>
            <option value="">-- Übung wählen --</option>
            {exercises.filter(e=>e.category===b.cat).map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
          </select>}
          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
            <input type="checkbox" id={`par${b.key}`} checked={b.parallel} onChange={e=>setBlock(b.key,"parallel",e.target.checked)} style={{width:15,height:15}}/>
            <label htmlFor={`par${b.key}`} style={{fontSize:12,fontWeight:700,color:C.muted,cursor:"pointer"}}>Parallel</label>
            {b.parallel&&<><span style={{fontSize:12,color:C.muted}}>Stationen:</span>
            <div style={{display:"flex",alignItems:"center",border:`1.5px solid ${C.border}`,borderRadius:6,overflow:"hidden",height:28}}>
              <button onClick={()=>setBlock(b.key,"stations",Math.max(2,b.stations-1))} style={{width:22,height:"100%",border:"none",cursor:"pointer",background:"#f1f5f9",fontSize:12,color:C.muted}}>−</button>
              <div style={{width:28,textAlign:"center",fontWeight:800,fontSize:13,color:C.text}}>{b.stations}</div>
              <button onClick={()=>setBlock(b.key,"stations",Math.min(6,b.stations+1))} style={{width:22,height:"100%",border:"none",cursor:"pointer",background:"#f1f5f9",fontSize:12,color:C.text}}>+</button>
            </div></>}
          </div>
        </div>}
      </div>)}
    </div>

    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:8,background:remaining>=0?"#f0fdf4":"#fef2f2",border:`1px solid ${remaining>=0?"#86efac":"#fca5a5"}`,marginBottom:16}}>
      <span style={{fontSize:13,fontWeight:700,color:remaining>=0?"#166534":"#991b1b"}}>
        {remaining>=0?`✓ ${usedMin} von ${totalMin} Min geplant (${remaining} Min Puffer)`:`⚠️ ${Math.abs(remaining)} Min zu viel – Blöcke kürzen`}
      </span>
    </div>

    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <Btn onClick={onClose} variant="secondary">Abbrechen</Btn>
      <Btn onClick={generate} disabled={activeBlocks.length===0}><Dices size={14}/> Plan generieren</Btn>
    </div>
  </div>);
}
function SessionDetailView({s,players,coaches,exercises,onEdit,onDelete,onClose,onSaveSession}) {
  const gP=id=>players.find(p=>p.id===id);
  const gC=id=>coaches.find(c=>c.id===id);
  const gE=id=>exercises.find(e=>e.id===id);
  const pr=(s.playerIds||[]).map(gP).filter(Boolean);
  const tr=(s.coachIds||[]).map(gC).filter(Boolean);
  const ex=(s.exerciseIds||[]).map(gE).filter(Boolean);
  const kids=s.participantCount?Number(s.participantCount):pr.length;
  const [selEx,setSelEx]=useState(null);
  return(<div>
    {/* Header meta */}
    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
      {s.isDraft&&<span style={{fontSize:12,fontWeight:700,padding:"2px 10px",borderRadius:20,background:"#fef9c3",color:"#854d0e",border:"1px solid #fde047"}}>📋 Entwurf</span>}
      <span style={{fontSize:13,color:C.muted,marginLeft:"auto"}}>{fmtDate(s.date)}</span>
    </div>
    {/* Quick stats */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
      {[["⏱",`${s.duration} Min`,"Dauer"],["👥",`${kids}`,"Kinder"],["🧑‍🏫",`${tr.length||"–"}`,"Trainer"]].map(([icon,val,lbl])=>(
        <div key={lbl} style={{textAlign:"center",padding:"10px 8px",background:"#f8fafc",borderRadius:10,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:18,marginBottom:2}}>{icon}</div>
          <div style={{fontWeight:900,fontSize:18,color:C.text,lineHeight:1}}>{val}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{lbl}</div>
        </div>
      ))}
    </div>
    {/* Location + weather */}
    {(s.location||s.weather)&&<div style={{display:"flex",gap:10,marginBottom:14,fontSize:13,color:C.muted}}>
      {s.location&&<span>📍 {s.location}</span>}
      {s.weather&&<span>🌤 {s.weather}</span>}
    </div>}
    {/* Trainer */}
    {tr.length>0&&<div style={{marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>Trainer</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{tr.map(c=><span key={c.id} style={{fontSize:13,padding:"3px 10px",borderRadius:20,background:C.accentL,color:C.primary,fontWeight:700}}>🧑‍🏫 {c.name}</span>)}</div>
    </div>}
    {/* Players */}
    {pr.length>0&&<div style={{marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>Anwesend ({pr.length})</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{pr.map(p=><span key={p.id} style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:STR[p.strength]?.light||"#f1f5f9",color:STR[p.strength]?.color||C.muted,fontWeight:600}}>{STR[p.strength]?.emoji} {p.name}</span>)}</div>
    </div>}
    {/* Exercises */}
    {ex.length>0&&<div style={{marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>Übungen ({ex.length})</div>
      {selEx?(<div style={{background:"#f8fafc",borderRadius:10,border:`1.5px solid ${C.border}`,overflow:"hidden",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:`1px solid ${C.border}`,background:"white"}}>
          <CatBadge cat={selEx.category} small/>
          <span style={{fontWeight:800,fontSize:14,color:C.text,flex:1}}>{selEx.title}</span>
          <button onClick={()=>setSelEx(null)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:18,lineHeight:1}}>✕</button>
        </div>
        <div style={{padding:"12px 14px"}}>
          {selEx.setup&&<div style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>📐 Aufbau</div><div style={{fontSize:13,lineHeight:1.6,color:C.text}}>{selEx.setup}</div></div>}
          {selEx.description&&<div style={{marginBottom:10}}><div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:4}}>🎯 Ablauf</div><div style={{fontSize:13,lineHeight:1.6,color:C.text}}>{selEx.description}</div></div>}
          {selEx.material?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{selEx.material.map(m=><span key={m} style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:C.accentL,color:C.primary,fontWeight:600}}>📦 {m}</span>)}</div>}
        </div>
      </div>):(
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {ex.map(e=><button key={e.id} onClick={()=>setSelEx(e)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,background:"white",border:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <span style={{fontSize:16}}>{CATS[e.category]?.emoji||"📋"}</span>
            <span style={{fontWeight:700,fontSize:13,color:C.text,flex:1}}>{e.title}</span>
            <span style={{fontSize:11,color:C.muted}}>⏱ {e.duration} Min →</span>
          </button>)}
        </div>
      )}
    </div>}
    {/* Teams */}
    {s.teams?.length>0&&<div style={{marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>Teams ({s.teams.length})</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{s.teams.map(tm=><div key={tm.id} style={{padding:"8px 12px",borderRadius:8,background:C.accentL,border:`1px solid ${C.accent}`,minWidth:100}}>
        <div style={{fontSize:12,fontWeight:800,color:C.primary,marginBottom:4}}>{tm.name}</div>
        <div style={{fontSize:11,color:C.muted,lineHeight:1.5}}>{tm.players?.map(p=>p.name).join(", ")||"–"}</div>
      </div>)}</div>
    </div>}
    {/* Notes */}
    {s.notes&&<div style={{marginBottom:14,padding:"10px 14px",background:"#fffbeb",borderRadius:8,border:"1px solid #fde68a",fontSize:13,color:C.text,lineHeight:1.6}}>💬 {s.notes}</div>}
    {/* Actions */}
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:14,borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
      <Btn sm variant="danger" onClick={()=>{if(confirm("Training löschen?"))onDelete();}}><Trash2 size={13}/> Löschen</Btn>
      <Btn sm variant="secondary" onClick={onEdit}><Edit2 size={13}/> Bearbeiten</Btn>
      <Btn sm onClick={onClose}>Schließen</Btn>
    </div>
  </div>);
}


// ── TRAINING PAGE ─────────────────────────────────────────────────
function TrainingPage({sessions,players,coaches,exercises,onSaveSession,onDeleteSession,apiKey,toast,onSaveExercise}) {
  const [tab,setTab]=useState("history");
  const [modal,setModal]=useState(null);
  const sorted=[...sessions].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const gP=id=>players.find(p=>p.id===id),gC=id=>coaches.find(c=>c.id===id),gE=id=>exercises.find(e=>e.id===id);
  const tb=(k,l)=><button onClick={()=>setTab(k)} style={{padding:"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"inherit",background:tab===k?C.primary:"transparent",color:tab===k?"white":C.muted}}>{l}</button>;
  return(<div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div><h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Training</h1><div style={{fontSize:13,color:C.muted,marginTop:2}}>{sessions.length} Einheiten</div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn onClick={()=>setModal({type:"notfall"})} style={{background:"#dc2626",color:"white"}} sm><AlertTriangle size={14}/> SOS</Btn>
        <Btn onClick={()=>setModal({type:"session",data:null})} variant="secondary" sm><Plus size={14}/> Eintragen</Btn>
        <Btn onClick={()=>setModal({type:"setup"})}><CalendarDays size={16}/> Training planen</Btn>
      </div>
    </div>
    <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:10,padding:4,marginBottom:20,width:"fit-content"}}>{tb("history","Verlauf")}{tb("teams","Teambildung")}</div>
    {tab==="history"&&(sorted.length===0?<Empty icon="📅" title="Noch kein Training" onAdd={()=>setModal({type:"session",data:null})} addLabel="Training planen"/>:
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {sorted.map(s=>{
          const pr=(s.playerIds||[]).map(gP).filter(Boolean),tr=(s.coachIds||[]).map(gC).filter(Boolean),ex=(s.exerciseIds||[]).map(gE).filter(Boolean);
          const kids=s.participantCount?Number(s.participantCount):pr.length;
          return(<div key={s.id} onClick={()=>setModal({type:"sessionDetail",data:s})} style={{background:C.card,borderRadius:12,border:`1.5px solid ${s.isDraft?"#fde047":C.border}`,padding:"14px 16px",cursor:"pointer",transition:"box-shadow .15s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.1)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{fontWeight:800,fontSize:15,color:C.text}}>{fmtDate(s.date)}</span>
                  {s.isDraft&&<span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"#fef9c3",color:"#854d0e",border:"1px solid #fde047"}}>📋 Entwurf</span>}
                </div>
                <div style={{display:"flex",gap:10,color:C.muted,fontSize:13,flexWrap:"wrap"}}>
                  <span>⏱ {s.duration} Min</span>
                  {kids>0&&<span>👥 {kids} Kinder</span>}
                  {tr.length>0&&<span>🧑‍🏫 {tr.map(c=>c.name).join(", ")}</span>}
                  {s.location&&<span>📍 {s.location}</span>}
                  {ex.length>0&&<span>{ex.slice(0,2).map(e=>CATS[e.category]?.emoji||"").join("")} {ex.length} Übung{ex.length!==1?"en":""}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                <button title="Teams bilden" onClick={()=>setModal({type:"tb",data:{session:s,players:pr.length?pr:players.filter(p=>p.active)}})} style={{padding:"5px 8px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.muted}}><Shuffle size={13}/></button>
                <button title="Bearbeiten" onClick={()=>setModal({type:"session",data:s})} style={{padding:"5px 8px",borderRadius:7,border:`1px solid ${C.border}`,background:"white",cursor:"pointer",color:C.muted}}><Edit2 size={13}/></button>
                <button title="Löschen" onClick={()=>{if(confirm("Training löschen?"))onDeleteSession(s.id);}} style={{padding:"5px 8px",borderRadius:7,border:"1px solid #fca5a5",background:"#fff5f5",cursor:"pointer",color:"#ef4444"}}><Trash2 size={13}/></button>
              </div>
            </div>
          </div>);
        })}
      </div>)}
    {tab==="teams"&&<div style={{background:C.card,borderRadius:12,border:`1.5px solid ${C.border}`,padding:20}}><h2 style={{margin:"0 0 6px",fontSize:18,fontWeight:800}}>Schnelle Teambildung</h2><p style={{margin:"0 0 16px",color:C.muted,fontSize:14}}>Teams bilden ohne Training zu protokollieren.</p><Btn onClick={()=>setModal({type:"tb",data:{session:null,players:players.filter(p=>p.active)}})}><Shuffle size={16}/> Teams zusammenstellen</Btn></div>}
    {modal?.type==="notfall"&&<Modal title="🚨 Notfall-Plan" onClose={()=>setModal(null)} wide><NotfallModal exercises={exercises} onClose={()=>setModal(null)}/></Modal>}
    {modal?.type==="setup"&&<Modal title="Training planen" onClose={()=>setModal(null)} wide><TrainingSetupModal players={players} coaches={coaches} onClose={()=>setModal(null)} onPlanManual={setup=>setModal({type:"manual",setup})} onPlanKI={setup=>setModal({type:"ai",setup})}/></Modal>}
    {modal?.type==="manual"&&<Modal title="📋 Manuell planen" onClose={()=>setModal(null)} wide><ManualTrainingPlanner exercises={exercises} players={players} setup={modal.setup} onClose={()=>setModal(null)} onSaveSession={s=>{onSaveSession(s);setModal(null);}} apiKey={apiKey} toast={toast}/></Modal>}
    {modal?.type==="ai"&&<Modal title="🤖 KI-Trainingsplan" onClose={()=>setModal(null)} wide><AITrainingModal players={players} exercises={exercises} apiKey={apiKey} setup={modal.setup} onClose={()=>setModal(null)} onSaveEx={onSaveExercise} onSaveSession={s=>{onSaveSession(s);toast("Training gespeichert ✓");}}/></Modal>}
    {modal?.type==="session"&&<Modal title={modal.data?"Training bearbeiten":"Neues Training"} onClose={()=>setModal(null)} wide><SessionForm session={modal.data} players={players} coaches={coaches} exercises={exercises} onSave={s=>{onSaveSession(s);setModal(null);}} onClose={()=>setModal(null)}/></Modal>}
    {modal?.type==="tb"&&<Modal title="Teambildung" onClose={()=>setModal(null)} wide><TeamBuilderModal availablePlayers={modal.data.players} onSaveTeams={teams=>{if(modal.data.session)onSaveSession({...modal.data.session,teams});setModal(null);}} onClose={()=>setModal(null)}/></Modal>}
    {modal?.type==="sessionDetail"&&modal.data&&<Modal title={fmtDate(modal.data.date)} onClose={()=>setModal(null)} wide><SessionDetailView s={modal.data} players={players} coaches={coaches} exercises={exercises} onEdit={()=>setModal({type:"session",data:modal.data})} onDelete={()=>{onDeleteSession(modal.data.id);setModal(null);}} onClose={()=>setModal(null)} onSaveSession={onSaveSession}/></Modal>}
    {modal?.type==="exDetail"&&modal.data&&<Modal title="Übungsdetail" onClose={()=>setModal(null)}><div><div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}><CatBadge cat={modal.data.category}/><Stars value={modal.data.rating} readonly/><span style={{fontSize:13,color:C.muted,marginLeft:"auto"}}>⏱ {modal.data.duration} Min</span></div>{modal.data.setup&&<div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>📐 Aufbau</div><div style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",fontSize:14,lineHeight:1.6,border:`1px solid ${C.border}`}}>{modal.data.setup}</div></div>}{modal.data.description&&<div style={{marginBottom:12}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>🎯 Ablauf</div><div style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",fontSize:14,lineHeight:1.6,border:`1px solid ${C.border}`}}>{modal.data.description}</div></div>}{modal.data.material?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>{modal.data.material.map(m=><span key={m} style={{padding:"3px 10px",borderRadius:20,background:C.accentL,color:C.primary,fontSize:12,fontWeight:700}}>📦 {m}</span>)}</div>}{modal.data.notes&&<div style={{fontSize:13,color:C.muted,fontStyle:"italic"}}>💬 {modal.data.notes}</div>}</div></Modal>}
  </div>);
}

// ── TRAINING SETUP MODAL ─────────────────────────────────────────
function TrainingSetupModal({players,coaches,onPlanManual,onPlanKI,onClose}) {
  const activeP=players.filter(p=>p.active);
  const [setup,setSetup]=useState({kids:activeP.length||10,coachCount:1,duration:60,location:"outdoor",date:todayISO(),playerIds:[],coachIds:[],focus:""});
  const [showPlayers,setShowPlayers]=useState(false);
  const [showCoaches,setShowCoaches]=useState(false);
  const s=(k,v)=>setSetup(x=>({...x,[k]:v}));
  const togP=id=>s("playerIds",setup.playerIds.includes(id)?setup.playerIds.filter(x=>x!==id):[...setup.playerIds,id]);
  const togC=id=>s("coachIds",setup.coachIds.includes(id)?setup.coachIds.filter(x=>x!==id):[...setup.coachIds,id]);
  return(<div>
    <div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",marginBottom:16,border:"1px solid #bbf7d0",fontSize:13,color:"#15803d"}}>Gib die Eckdaten ein – dann wähle Manuell oder KI-Plan.</div>
    <div style={{marginBottom:14}}>
      <Inp label="Datum" type="date" value={setup.date} onChange={e=>s("date",e.target.value)}/>
      <div>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Ort</label>
        <div style={{display:"flex",gap:8}}>
          {[["outdoor","☀️ Outdoor"],["indoor","🏠 Halle"]].map(([k,l])=><button key={k} onClick={()=>s("location",k)} style={{flex:1,padding:"9px 8px",borderRadius:8,border:`2px solid ${setup.location===k?C.primary:C.border}`,background:setup.location===k?C.accentL:"white",color:setup.location===k?C.primary:C.muted,cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit"}}>{l}</button>)}
        </div>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
      <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Kinder</label><Stepper value={setup.kids} onChange={v=>s("kids",v)} min={2} max={30}/></div>
      <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Trainer</label><Stepper value={setup.coachCount} onChange={v=>s("coachCount",v)} min={1} max={6}/></div>
      <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Minuten</label><Stepper value={setup.duration} onChange={v=>s("duration",v)} min={20} max={120}/></div>
    </div>
    {activeP.length>0&&<div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>Spieler <span style={{fontWeight:400,textTransform:"none"}}>(optional – {setup.playerIds.length} ausgewählt)</span></label>
        <Btn sm variant="secondary" onClick={()=>setShowPlayers(v=>!v)}>{showPlayers?"▲ Einklappen":"▼ Auswählen"}</Btn>
      </div>
      {showPlayers&&<div style={{display:"flex",flexWrap:"wrap",gap:6,padding:10,background:"#f8fafc",borderRadius:8,border:`1.5px solid ${C.border}`,maxHeight:120,overflowY:"auto"}}>
        {activeP.map(p=><button key={p.id} onClick={()=>togP(p.id)} style={{padding:"4px 10px",borderRadius:20,border:`1.5px solid ${setup.playerIds.includes(p.id)?STR[p.strength].color:C.border}`,background:setup.playerIds.includes(p.id)?STR[p.strength].light:"white",color:setup.playerIds.includes(p.id)?STR[p.strength].color:C.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{STR[p.strength].emoji} {p.name}</button>)}
      </div>}
    </div>}
    {coaches.length>0&&<div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>Trainer <span style={{fontWeight:400,textTransform:"none"}}>(optional – {setup.coachIds.length} ausgewählt)</span></label>
        <Btn sm variant="secondary" onClick={()=>setShowCoaches(v=>!v)}>{showCoaches?"▲ Einklappen":"▼ Auswählen"}</Btn>
      </div>
      {showCoaches&&<div style={{display:"flex",flexWrap:"wrap",gap:6,padding:10,background:"#f8fafc",borderRadius:8,border:`1.5px solid ${C.border}`}}>
        {coaches.filter(c=>c.active!==false).map(c=><button key={c.id} onClick={()=>togC(c.id)} style={{padding:"4px 10px",borderRadius:20,border:`1.5px solid ${setup.coachIds.includes(c.id)?C.primary:C.border}`,background:setup.coachIds.includes(c.id)?C.accentL:"white",color:setup.coachIds.includes(c.id)?C.primary:C.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{c.name}</button>)}
      </div>}
    </div>}
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Schwerpunkt (optional)</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
        {["Dribbeln","Passspiel","Torschuss","Koordination","Zweikampf","Spaß & Spiel","Schnelligkeit","Teamwork","Funino"].map(f=>{const a=setup.focus===f;return<button key={f} onClick={()=>s("focus",a?"":f)} style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${a?C.primary:C.border}`,background:a?C.accentL:"white",color:a?C.primary:C.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{f}</button>;})}
      </div>
    </div>
    <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16,display:"flex",gap:10,flexWrap:"wrap"}}>
      <Btn onClick={onClose} variant="secondary">Abbrechen</Btn>
      <div style={{flex:1}}/>
      <Btn onClick={()=>onPlanManual(setup)} variant="secondary"><ListChecks size={14}/> Manuell planen</Btn>
      <Btn onClick={()=>onPlanKI(setup)} variant="ai"><Bot size={14}/> KI-Plan</Btn>
    </div>
  </div>);
}


// ── TURNIER PAGE ──────────────────────────────────────────────────
function TournamentForm({onSave,onClose}) {
  const [form,setForm]=useState({name:"",date:todayISO(),matchDuration:8,fields:1,notes:""});
  const [teams,setTeams]=useState([{id:uid(),name:"Team 1",color:TCOLORS[0]},{id:uid(),name:"Team 2",color:TCOLORS[1]}]);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const addTeam=()=>setTeams(t=>[...t,{id:uid(),name:`Team ${t.length+1}`,color:TCOLORS[t.length%TCOLORS.length]}]);
  return(<div>
    <Inp label="Turniername *" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="z.B. Herbstturnier"/>
    <div style={{marginBottom:14}}>
      <Inp label="Datum" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Spieldauer (Min)</label><Stepper value={form.matchDuration} onChange={v=>set("matchDuration",v)} min={3} max={30}/></div>
        <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>Felder</label><Stepper value={form.fields} onChange={v=>set("fields",v)} min={1} max={6}/></div>
      </div>
    </div>
    <div style={{marginTop:14,marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.6}}>Teams ({teams.length})</label>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
        {teams.map(t=><div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:"#f8fafc",border:`1.5px solid ${C.border}`}}>
          <div style={{width:16,height:16,borderRadius:"50%",background:t.color,flexShrink:0}}/>
          <input value={t.name} onChange={e=>setTeams(ts=>ts.map(x=>x.id===t.id?{...x,name:e.target.value}:x))} style={{flex:1,border:"none",background:"transparent",fontSize:14,fontWeight:600,color:C.text,outline:"none"}}/>
          {teams.length>2&&<button onClick={()=>setTeams(ts=>ts.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",padding:2}}>✕</button>}
        </div>)}
      </div>
      <Btn sm onClick={addTeam}><Plus size={13}/> Team hinzufügen</Btn>
      <div style={{fontSize:12,color:C.muted,marginTop:6}}>→ {teams.length*(teams.length-1)/2} Spiele (Round Robin)</div>
    </div>
    <Txta label="Notizen" value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2}/>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:`1px solid ${C.border}`}}><Btn onClick={onClose} variant="secondary">Abbrechen</Btn><Btn onClick={()=>{if(!form.name.trim()||teams.length<2)return;onSave({...form,id:uid(),createdAt:now(),teams,matches:generateRR(teams)});}} disabled={!form.name.trim()||teams.length<2}>Turnier erstellen</Btn></div>
  </div>);
}

function TournamentDetail({tournament:t,onUpdate,onBack,coaches=[]}) {
  const [tab,setTab]=useState("plan");
  const [sc,setSc]=useState(Object.fromEntries(t.matches.map(m=>[m.id,{h:m.homeScore??0,a:m.awayScore??0}])));
  const [startTime,setStartTime]=useState("10:00");
  const [pauseMin,setPauseMin]=useState(2);
  const gt=id=>t.teams.find(x=>x.id===id);
  const fields=t.fields||1;
  const adjScore=(mId,side,delta)=>setSc(s=>({...s,[mId]:{...s[mId],[side]:Math.max(0,(s[mId]?.[side]||0)+delta)}}));
  const save=mId=>{ const s=sc[mId],h=Number(s.h),a=Number(s.a);if(isNaN(h)||isNaN(a))return;onUpdate({...t,matches:t.matches.map(m=>m.id===mId?{...m,homeScore:h,awayScore:a,played:true}:m)}); };
  const standings=calcStandings(t.teams,t.matches);
  const played=t.matches.filter(m=>m.played).length;
  const buildSchedule=()=>{
    const [h,m]=startTime.split(":").map(Number);
    const startMin=h*60+m;
    const fieldQ=Array.from({length:fields},()=>[]);
    t.matches.forEach((m,i)=>fieldQ[i%fields].push(m));
    const slots=[];
    fieldQ.forEach((q,fi)=>q.forEach((m,ri)=>{
      const t0=startMin+ri*(t.matchDuration+pauseMin);
      slots.push({match:m,field:fi+1,startMin:t0});
    }));
    return slots.sort((a,b)=>a.startMin-b.startMin||a.field-b.field);
  };
  const fmtTime=m=>{const hh=Math.floor(m/60),mm=m%60;return`${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;};
  const [expandedField,setExpandedField]=useState(null);
  const [coachAssign,setCoachAssign]=useState({}); // fieldIdx → coachId
  const assignCoach=(fi,cid)=>setCoachAssign(a=>({...a,[fi]:cid}));
  const tb=(k,l)=><button onClick={()=>setTab(k)} style={{padding:"7px 16px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit",background:tab===k?C.primary:"transparent",color:tab===k?"white":C.muted}}>{l}</button>;
  return(<div>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
      <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:14,display:"flex",alignItems:"center",gap:4}}>← Zurück</button>
      <div><h2 style={{margin:0,fontSize:20,fontWeight:900,color:C.text}}>{t.name}</h2><div style={{fontSize:13,color:C.muted}}>{fmtDate(t.date)} · {t.teams.length} Teams · {played}/{t.matches.length} Spiele · {t.matchDuration} Min/Spiel</div></div>
    </div>
    <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:10,padding:4,marginBottom:20,width:"fit-content",flexWrap:"wrap"}}>{tb("plan","Spielplan")}{tb("teams","Teams")}{tb("schedule","Zeitplan")}{tb("uebersicht","Übersicht")}{tb("table","Tabelle")}</div>
    {tab==="plan"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
      {t.matches.map((m,i)=>{ const field=(i%fields)+1; const h=gt(m.homeId),a=gt(m.awayId);if(!h||!a)return null;return(<div key={m.id} style={{background:C.card,borderRadius:10,border:`1.5px solid ${m.played?"#22c55e":C.border}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{fontSize:12,color:C.muted,fontWeight:600,minWidth:60}}>#{i+1}{fields>1&&` · F${field}`}</div>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1,justifyContent:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,fontWeight:700,fontSize:15}}><div style={{width:12,height:12,borderRadius:"50%",background:h.color}}/>{h.name}</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{display:"flex",alignItems:"center",border:`1.5px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
              <button onClick={()=>adjScore(m.id,"h",-1)} style={{width:28,height:32,border:"none",cursor:"pointer",background:"#f1f5f9",fontSize:14,color:C.muted,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
              <div style={{width:32,textAlign:"center",fontWeight:800,fontSize:16,color:C.text}}>{sc[m.id]?.h??0}</div>
              <button onClick={()=>adjScore(m.id,"h",1)} style={{width:28,height:32,border:"none",cursor:"pointer",background:"#f1f5f9",fontSize:14,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
            </div>
            <span style={{fontWeight:700,color:C.muted,fontSize:18}}>:</span>
            <div style={{display:"flex",alignItems:"center",border:`1.5px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
              <button onClick={()=>adjScore(m.id,"a",-1)} style={{width:28,height:32,border:"none",cursor:"pointer",background:"#f1f5f9",fontSize:14,color:C.muted,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
              <div style={{width:32,textAlign:"center",fontWeight:800,fontSize:16,color:C.text}}>{sc[m.id]?.a??0}</div>
              <button onClick={()=>adjScore(m.id,"a",1)} style={{width:28,height:32,border:"none",cursor:"pointer",background:"#f1f5f9",fontSize:14,color:C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,fontWeight:700,fontSize:15}}>{a.name}<div style={{width:12,height:12,borderRadius:"50%",background:a.color}}/></div>
        </div>
        <Btn sm onClick={()=>save(m.id)}>{m.played?"✓ Update":"Eintragen"}</Btn>
      </div>);})}
    </div>}
    {tab==="teams"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
      {t.teams.map(team=>{
        const tm=t.matches.filter(m=>m.homeId===team.id||m.awayId===team.id);
        const schedule=buildSchedule();
        return(<div key={team.id} style={{background:C.card,borderRadius:12,border:`2px solid ${team.color}55`,overflow:"hidden"}}>
          <div style={{padding:"10px 16px",background:team.color+"18",borderBottom:`1px solid ${team.color}33`,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:14,height:14,borderRadius:"50%",background:team.color,flexShrink:0}}/>
            <span style={{fontWeight:800,fontSize:15,color:C.text}}>{team.name}</span>
            <span style={{fontSize:12,color:C.muted,marginLeft:"auto"}}>{tm.filter(m=>m.played).length}/{tm.length} Spiele</span>
          </div>
          <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
            {tm.length===0?<div style={{fontSize:13,color:C.muted}}>Keine Spiele</div>:
              tm.map((m,i)=>{
                const isHome=m.homeId===team.id;
                const opp=gt(isHome?m.awayId:m.homeId);
                const slot=schedule.find(s=>s.match.id===m.id);
                const myScore=isHome?m.homeScore:m.awayScore;
                const oppScore=isHome?m.awayScore:m.homeScore;
                const result=m.played?(myScore>oppScore?"🏆":myScore===oppScore?"🤝":"❌"):null;
                return(<div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",borderRadius:8,background:m.played?"#f8fafc":"white",border:`1px solid ${C.border}`,flexWrap:"wrap"}}>
                  {slot&&<span style={{fontSize:11,fontWeight:700,color:C.muted,minWidth:40}}>{fmtTime(slot.startMin)}</span>}
                  {fields>1&&slot&&<span style={{fontSize:11,color:C.muted}}>F{slot.field}</span>}
                  <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:opp?.color,flexShrink:0}}/>
                    <span style={{fontWeight:600,fontSize:13,color:C.text}}>vs. {opp?.name}</span>
                  </div>
                  {m.played?<span style={{fontSize:13,fontWeight:800,color:C.text}}>{result} {myScore}:{oppScore}</span>:<span style={{fontSize:12,color:C.muted}}>offen</span>}
                </div>);
              })}
          </div>
        </div>);
      })}
    </div>}
    {tab==="schedule"&&<div>
      <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:16,flexWrap:"wrap"}}>
        <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.6}}>Startzeit</label><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} style={{padding:"8px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",fontFamily:"inherit"}}/></div>
        <div><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.6}}>Pause zw. Spielen (Min)</label><Stepper value={pauseMin} onChange={setPauseMin} min={0} max={15}/></div>
        <div style={{fontSize:13,color:C.muted,alignSelf:"center",paddingBottom:2}}>Spieldauer: {t.matchDuration} Min · {fields} Feld{fields>1?"er":""}</div>
      </div>
      {fields>1&&<div style={{display:"grid",gridTemplateColumns:Array.from({length:fields},(_,fi)=>expandedField===fi?"2.5fr":"1fr").join(" "),gap:10,marginBottom:16,transition:"grid-template-columns .25s"}}>
        {Array.from({length:fields},(_,fi)=>{
          const fieldSlots=buildSchedule().filter(s=>s.field===fi+1);
          return(<div key={fi} style={{background:C.card,borderRadius:10,border:`1.5px solid ${C.border}`,overflow:"hidden"}}>
            <button onClick={()=>setExpandedField(expandedField===fi?null:fi)} style={{display:"block",width:"100%",textAlign:"left",padding:"8px 12px",background:TCOLORS[fi]+"22",borderBottom:`1px solid ${C.border}`,fontWeight:800,fontSize:13,color:C.text,border:"none",cursor:"pointer",fontFamily:"inherit"}}>⚽ Feld {fi+1}{expandedField===fi?" ↙":" ↔"}</button>
            <div style={{padding:"8px 10px",display:"flex",flexDirection:"column",gap:4}}>
              {fieldSlots.map((sl,i)=>{const h=gt(sl.match.homeId),a=gt(sl.match.awayId);return(<div key={i} style={{fontSize:12,padding:"4px 8px",borderRadius:6,background:sl.match.played?"#f0fdf4":"#f8fafc",border:`1px solid ${C.border}`}}>
                <div style={{fontWeight:700,color:C.muted,marginBottom:2}}>{fmtTime(sl.startMin)}</div>
                <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}><span style={{width:8,height:8,borderRadius:"50%",background:h?.color,display:"inline-block",flexShrink:0}}/><span style={{fontWeight:700,fontSize:12,wordBreak:"break-word"}}>{h?.name}</span></div>
                  <div style={{fontSize:10,color:C.muted,fontWeight:700,paddingLeft:12}}>vs.</div>
                  <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}><span style={{width:8,height:8,borderRadius:"50%",background:a?.color,display:"inline-block",flexShrink:0}}/><span style={{fontWeight:700,fontSize:12,wordBreak:"break-word"}}>{a?.name}</span></div>
                </div>
                {sl.match.played&&<div style={{fontSize:11,color:"#16a34a",fontWeight:700}}>{sl.match.homeScore}:{sl.match.awayScore} ✓</div>}
              </div>);})}
            </div>
          </div>);
        })}
      </div>}
      {fields===1&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
        {buildSchedule().map((sl,i)=>{const h=gt(sl.match.homeId),a=gt(sl.match.awayId);return(<div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,background:sl.match.played?"#f0fdf4":C.card,border:`1.5px solid ${sl.match.played?"#22c55e":C.border}`,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:800,color:C.muted,minWidth:44}}>{fmtTime(sl.startMin)}</span>
          <div style={{display:"flex",alignItems:"center",gap:8,flex:1,justifyContent:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}><div style={{width:10,height:10,borderRadius:"50%",background:h?.color,flexShrink:0}}/><span style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h?.name}</span></div>
            {sl.match.played?<span style={{fontWeight:800,fontSize:15,color:C.text,flexShrink:0}}>{sl.match.homeScore}:{sl.match.awayScore}</span>:<span style={{color:C.muted,flexShrink:0}}>vs.</span>}
            <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0,justifyContent:"flex-end"}}><span style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a?.name}</span><div style={{width:10,height:10,borderRadius:"50%",background:a?.color,flexShrink:0}}/></div>
          </div>
          <span style={{fontSize:12,color:C.muted}}>⏱ {t.matchDuration} Min</span>
        </div>);})}
      </div>}
    </div>}
    {tab==="uebersicht"&&<div>
      <div style={{background:"#f0f9ff",borderRadius:10,padding:"10px 14px",marginBottom:16,border:"1px solid #bae6fd",fontSize:13,color:"#0369a1"}}>
        Zeigt welche Teams gleichzeitig spielen und wie viele Kinder pro Feld aktiv sind. Weise optional Trainer den Feldern zu.
      </div>
      {/* Trainer-Zuweisung */}
      {coaches.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:8}}>Trainer-Zuweisung pro Feld</div>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(fields,3)},1fr)`,gap:8}}>
          {Array.from({length:fields},(_,fi)=>(
            <div key={fi} style={{padding:"8px 12px",borderRadius:8,background:TCOLORS[fi]+"18",border:`1.5px solid ${TCOLORS[fi]}44`}}>
              <div style={{fontWeight:700,fontSize:12,color:C.text,marginBottom:6}}>⚽ Feld {fi+1}</div>
              <select value={coachAssign[fi]||""} onChange={e=>assignCoach(fi,e.target.value)} style={{width:"100%",padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,outline:"none",background:"white"}}>
                <option value="">– kein Trainer –</option>
                {coaches.filter(c=>c.active!==false).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>}
      {/* Zeitstrahl */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {buildSchedule().reduce((rows,sl)=>{
          const last=rows[rows.length-1];
          if(!last||last.startMin!==sl.startMin) rows.push({startMin:sl.startMin,slots:[]});
          rows[rows.length-1].slots.push(sl);
          return rows;
        },[]).map((row,ri)=>{
          const allTeamIds=[...new Set(row.slots.flatMap(sl=>[sl.match.homeId,sl.match.awayId]))];
          const allTeams=allTeamIds.map(gt).filter(Boolean);
          const kidCount=allTeams.reduce((s,tm)=>{
            const sz=t.teamSizes?.[tm.id]||tm.players?.length||4;
            return s+sz;
          },0);
          const activeCoaches=row.slots.map((sl,i)=>coachAssign[sl.field-1]).filter(Boolean);
          const uniqueCoaches=[...new Set(activeCoaches)];
          return(<div key={ri} style={{borderRadius:10,border:`1.5px solid ${C.border}`,overflow:"hidden",background:C.card}}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#f8fafc",borderBottom:`1px solid ${C.border}`,flexWrap:"wrap"}}>
              <span style={{fontWeight:800,fontSize:14,color:C.text,minWidth:44}}>{fmtTime(row.startMin)}</span>
              <span style={{fontSize:12,color:C.muted}}>⏱ {t.matchDuration} Min</span>
              <div style={{display:"flex",gap:8,marginLeft:"auto",flexWrap:"wrap"}}>
                <span style={{fontSize:12,fontWeight:700,padding:"2px 10px",borderRadius:20,background:"#dbeafe",color:"#1d4ed8"}}>👥 {kidCount} Kinder aktiv</span>
                {uniqueCoaches.length>0&&<span style={{fontSize:12,fontWeight:700,padding:"2px 10px",borderRadius:20,background:"#dcfce7",color:"#15803d"}}>🧑‍🏫 {uniqueCoaches.map(id=>coaches.find(c=>c.id===id)?.name||"").join(", ")}</span>}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(row.slots.length,fields)},1fr)`,gap:0}}>
              {row.slots.map((sl,si)=>{
                const h=gt(sl.match.homeId),a=gt(sl.match.awayId);
                const coach=coachAssign[sl.field-1]?coaches.find(c=>c.id===coachAssign[sl.field-1]):null;
                const hSize=t.teamSizes?.[sl.match.homeId]||h?.players?.length||4;
                const aSize=t.teamSizes?.[sl.match.awayId]||a?.players?.length||4;
                return(<div key={si} style={{padding:"10px 12px",borderRight:si<row.slots.length-1?`1px solid ${C.border}`:"none"}}>
                  <div style={{fontSize:11,fontWeight:800,color:C.muted,marginBottom:6}}>⚽ Feld {sl.field}{coach?` · 🧑‍🏫 ${coach.name}`:""}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:"50%",background:h?.color,flexShrink:0}}/><span style={{fontWeight:700,fontSize:13,color:C.text,flex:1}}>{h?.name}</span><span style={{fontSize:11,color:C.muted}}>{hSize}👦</span></div>
                    <div style={{fontSize:10,color:C.muted,fontWeight:700,paddingLeft:16}}>vs.</div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:10,height:10,borderRadius:"50%",background:a?.color,flexShrink:0}}/><span style={{fontWeight:700,fontSize:13,color:C.text,flex:1}}>{a?.name}</span><span style={{fontSize:11,color:C.muted}}>{aSize}👦</span></div>
                  </div>
                  {sl.match.played&&<div style={{fontSize:11,color:"#16a34a",fontWeight:700,marginTop:6}}>{sl.match.homeScore}:{sl.match.awayScore} ✓</div>}
                </div>);
              })}
            </div>
          </div>);
        })}
      </div>
    </div>}
    {tab==="table"&&<div>
      <div style={{background:C.card,borderRadius:12,border:`1.5px solid ${C.border}`,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 2fr"}}>
          {["Team","Sp","S","U","N","Tore","Pkt"].map(h=><div key={h} style={{padding:"10px 12px",background:"#f8fafc",fontSize:11,fontWeight:800,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{h}</div>)}
          {standings.map((s,i)=>[
            <div key={`${s.id}n`} style={{padding:"12px",display:"flex",alignItems:"center",gap:8,borderBottom:`1px solid ${C.border}`}}><span style={{fontWeight:800,color:i===0?"#f59e0b":i===1?"#94a3b8":"#b45309",minWidth:20}}>{i+1}.</span><div style={{width:12,height:12,borderRadius:"50%",background:s.color,flexShrink:0}}/><span style={{fontWeight:700,color:C.text}}>{s.name}</span></div>,
            ...[s.pl,s.w,s.d,s.l,`${s.gf}:${s.ga}`].map((v,j)=><div key={`${s.id}v${j}`} style={{padding:"12px",textAlign:"center",fontSize:14,fontWeight:600,color:C.muted,borderBottom:`1px solid ${C.border}`}}>{v}</div>),
            <div key={`${s.id}p`} style={{padding:"12px",textAlign:"center",fontSize:16,fontWeight:900,color:C.primary,borderBottom:`1px solid ${C.border}`}}>{s.pts}</div>
          ])}
        </div>
      </div>
      <div style={{fontSize:12,color:C.muted,marginTop:8,textAlign:"center"}}>{played}/{t.matches.length} Spiele</div>
    </div>}
  </div>);
}

function TurnierPage({tournaments,onSaveTournament,onDeleteTournament,coaches=[]}) {
  const [modal,setModal]=useState(null);
  const [open,setOpen]=useState(null);
  if(open){const t=tournaments.find(x=>x.id===open);if(!t){setOpen(null);return null;}return<TournamentDetail tournament={t} onUpdate={onSaveTournament} onBack={()=>setOpen(null)} coaches={coaches}/>;}
  return(<div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div><h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Turnier</h1><div style={{fontSize:13,color:C.muted,marginTop:2}}>{tournaments.length} Turniere</div></div>
      <Btn onClick={()=>setModal({type:"create"})}><Plus size={16}/> Neues Turnier</Btn>
    </div>
    {tournaments.length===0?<Empty icon="🏆" title="Noch kein Turnier" sub="Plane ein Rundenturnier – intern oder mit externen Teams." onAdd={()=>setModal({type:"create"})} addLabel="Turnier erstellen"/>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {[...tournaments].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t=>{
          const pl=t.matches.filter(m=>m.played).length,done=pl===t.matches.length,leader=done?calcStandings(t.teams,t.matches)[0]:null;
          return(<div key={t.id} style={{background:C.card,borderRadius:12,border:`1.5px solid ${done?"#22c55e":C.border}`,padding:"16px 18px",cursor:"pointer"}} onClick={()=>setOpen(t.id)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><div style={{fontWeight:800,fontSize:16,color:C.text}}>{t.name}</div><button onClick={e=>{e.stopPropagation();if(confirm(`"${t.name}" löschen?`))onDeleteTournament(t.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",padding:4}}><Trash2 size={14}/></button></div>
            <div style={{fontSize:13,color:C.muted,marginBottom:10}}>{fmtDate(t.date)} · {t.teams.length} Teams · {t.matchDuration} Min/Spiel</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>{t.teams.map(tm=><span key={tm.id} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"#f1f5f9",color:C.text}}><span style={{width:8,height:8,borderRadius:"50%",background:tm.color,display:"inline-block"}}/>{tm.name}</span>)}</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontSize:12,color:C.muted}}>{pl}/{t.matches.length} Spiele {done?"✅":""}</div>{leader&&<div style={{fontSize:12,fontWeight:700,color:C.primary}}>🥇 {leader.name}</div>}</div>
            <div style={{height:4,borderRadius:2,background:"#f1f5f9",marginTop:8,overflow:"hidden"}}><div style={{height:"100%",borderRadius:2,background:C.accent,width:`${t.matches.length?pl/t.matches.length*100:0}%`,transition:"width .3s"}}/></div>
          </div>);
        })}
      </div>}
    {modal?.type==="create"&&<Modal title="Neues Turnier" onClose={()=>setModal(null)} wide><TournamentForm onSave={t=>{onSaveTournament(t);setModal(null);}} onClose={()=>setModal(null)}/></Modal>}
  </div>);
}

// ── KASSE PAGE ────────────────────────────────────────────────────
const KASSE_CATS_EIN = ["Elternbeitrag","Vereinszuschuss","Turnier-Einnahme","Sponsoring","Sonstiges"];
const KASSE_CATS_AUS = ["Material","Turnierbeitrag","Ausrüstung","Verpflegung","Sonstiges"];

function KasseForm({entry,onSave,onClose}) {
  const [form,setForm]=useState({date:todayISO(),description:"",amount:"",type:"ein",category:"Sonstiges",...entry});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const cats=form.type==="ein"?KASSE_CATS_EIN:KASSE_CATS_AUS;
  const doSave=()=>{
    if(!form.description.trim()||!form.amount)return;
    onSave({...form,id:form.id||uid(),amount:parseFloat(form.amount)||0,createdAt:form.createdAt||now()});
  };
  return(<div>
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      {[["ein","💰 Einnahme","#16a34a","#dcfce7"],["aus","💸 Ausgabe","#dc2626","#fee2e2"]].map(([k,l,col,bg])=>
        <button key={k} onClick={()=>{set("type",k);set("category","Sonstiges");}} style={{flex:1,padding:"10px",borderRadius:10,border:`2px solid ${form.type===k?col:C.border}`,background:form.type===k?bg:"white",color:form.type===k?col:C.muted,cursor:"pointer",fontWeight:800,fontSize:14,fontFamily:"inherit"}}>{l}</button>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Inp label="Datum" type="date" value={form.date} onChange={e=>set("date",e.target.value)} style={{marginBottom:0}}/>
      <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Betrag (€)</label><input type="number" min="0" step="0.01" value={form.amount} onChange={e=>set("amount",e.target.value)} placeholder="0,00" style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",boxSizing:"border-box"}}/></div>
    </div>
    <Inp label="Beschreibung *" value={form.description} onChange={e=>set("description",e.target.value)} placeholder="z.B. Trikots, Turnieranmeldung..."/>
    <Sel label="Kategorie" value={form.category} onChange={e=>set("category",e.target.value)}>{cats.map(c=><option key={c} value={c}>{c}</option>)}</Sel>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:`1px solid ${C.border}`}}>
      <Btn onClick={onClose} variant="secondary">Abbrechen</Btn>
      <Btn onClick={doSave}>{entry?.id?"Speichern":"Eintragen"}</Btn>
    </div>
  </div>);
}

function KassePage({kassenbuch,onSave,onDelete,toast}) {
  const [modal,setModal]=useState(null);
  const [filter,setFilter]=useState("");
  const sorted=[...kassenbuch].sort((a,b)=>new Date(b.date)-new Date(a.date)||(new Date(b.createdAt)-new Date(a.createdAt)));
  const filtered=filter?sorted.filter(k=>k.type===filter):sorted;
  const ein=kassenbuch.filter(k=>k.type==="ein").reduce((s,k)=>s+k.amount,0);
  const aus=kassenbuch.filter(k=>k.type==="aus").reduce((s,k)=>s+k.amount,0);
  const balance=ein-aus;
  const fmt=n=>n.toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
  return(<div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div><h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Mannschaftskasse</h1><div style={{fontSize:13,color:C.muted,marginTop:2}}>{kassenbuch.length} Einträge</div></div>
      <Btn onClick={()=>setModal({type:"form",data:null})}><Plus size={16}/> Eintrag</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
      <div style={{background:"#dcfce7",borderRadius:12,padding:"16px 18px",border:"1.5px solid #86efac"}}>
        <div style={{fontSize:11,fontWeight:800,color:"#15803d",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Einnahmen</div>
        <div style={{fontSize:20,fontWeight:900,color:"#15803d"}}>+{fmt(ein)} €</div>
      </div>
      <div style={{background:"#fee2e2",borderRadius:12,padding:"16px 18px",border:"1.5px solid #fca5a5"}}>
        <div style={{fontSize:11,fontWeight:800,color:"#dc2626",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Ausgaben</div>
        <div style={{fontSize:20,fontWeight:900,color:"#dc2626"}}>-{fmt(aus)} €</div>
      </div>
      <div style={{background:balance>=0?"#eff6ff":"#fef2f2",borderRadius:12,padding:"16px 18px",border:`1.5px solid ${balance>=0?"#93c5fd":"#fca5a5"}`}}>
        <div style={{fontSize:11,fontWeight:800,color:balance>=0?"#1d4ed8":"#dc2626",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Kontostand</div>
        <div style={{fontSize:20,fontWeight:900,color:balance>=0?"#1d4ed8":"#dc2626"}}>{balance>=0?"+":""}{fmt(balance)} €</div>
      </div>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:16}}>
      {[["","Alle"],["ein","💰 Einnahmen"],["aus","💸 Ausgaben"]].map(([k,l])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${filter===k?C.primary:C.border}`,background:filter===k?C.accentL:"white",color:filter===k?C.primary:C.muted,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>{l}</button>)}
    </div>
    {kassenbuch.length===0?<Empty icon="💰" title="Noch kein Eintrag" sub="Buche Einnahmen und Ausgaben der Mannschaftskasse." onAdd={()=>setModal({type:"form",data:null})} addLabel="Ersten Eintrag erstellen"/>:
      filtered.length===0?<div style={{textAlign:"center",padding:"40px",color:C.muted,fontSize:14}}>Keine Einträge für diesen Filter.</div>:
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(k=><div key={k.id} style={{background:C.card,borderRadius:10,border:`1.5px solid ${C.border}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,background:k.type==="ein"?"#dcfce7":"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{k.type==="ein"?"💰":"💸"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,color:C.text}}>{k.description}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{fmtDate(k.date)} · {k.category}</div>
          </div>
          <div style={{fontWeight:900,fontSize:16,color:k.type==="ein"?"#16a34a":"#dc2626",flexShrink:0}}>{k.type==="ein"?"+":"-"}{fmt(k.amount)} €</div>
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={()=>setModal({type:"form",data:k})} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,padding:4}}><Edit2 size={14}/></button>
            <button onClick={()=>{if(confirm(`"${k.description}" löschen?`)){onDelete(k.id);toast("Eintrag gelöscht");}}} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",padding:4}}><Trash2 size={14}/></button>
          </div>
        </div>)}
      </div>}
    {modal?.type==="form"&&<Modal title={modal.data?"Eintrag bearbeiten":"Neuer Eintrag"} onClose={()=>setModal(null)}><KasseForm entry={modal.data} onSave={e=>{onSave(e);setModal(null);toast("Eintrag gespeichert");}} onClose={()=>setModal(null)}/></Modal>}
  </div>);
}

// ── SETTINGS PAGE ─────────────────────────────────────────────────
function DebugExportPanel({toast}) {
  const [log,setLog]=useState("");
  const refresh=()=>setLog(window._getExportLog()||"(noch kein Export versucht)");
  const copyLog=()=>{
    const txt=window._getExportLog()||"(leer)";
    if(navigator.clipboard) navigator.clipboard.writeText(txt).then(()=>toast("Log kopiert ✓"));
    else { const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast("Log kopiert ✓"); }
  };

  const runTest=(label,content,filename)=>{
    dbgLog(`=== ${label} ===`);
    dbgLog(`Dateigröße: ${content.length} Zeichen`);
    dbgLog(`showSaveFilePicker: ${!!window.showSaveFilePicker}`);
    // Test 1: Blob
    try {
      const blob = new Blob([content],{type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href=url; a.download=filename; a.style.display='none';
      document.body.appendChild(a); a.click();
      setTimeout(()=>{URL.revokeObjectURL(url);document.body.removeChild(a);},1000);
      dbgLog('Methode 1 (Blob+click): ausgelöst – prüfe Downloads-Ordner');
    } catch(e){ dbgLog(`Methode 1 Fehler: ${e.message}`); }
    // Test 2: data: URI
    try {
      const uri='data:application/json;charset=utf-8,'+encodeURIComponent(content);
      const a2=document.createElement('a');
      a2.href=uri; a2.download=filename+'_v2'; a2.style.display='none';
      document.body.appendChild(a2); a2.click();
      setTimeout(()=>document.body.removeChild(a2),500);
      dbgLog('Methode 2 (data:URI+click): ausgelöst');
    } catch(e){ dbgLog(`Methode 2 Fehler: ${e.message}`); }
    // Test 3: window.open
    try {
      const uri3='data:application/json;charset=utf-8,'+encodeURIComponent(content);
      const w=window.open(uri3,'_blank');
      dbgLog(`Methode 3 (window.open): ${w?'Fenster geöffnet':'geblockt (null)'}`);
    } catch(e){ dbgLog(`Methode 3 Fehler: ${e.message}`); }
    refresh();
  };

  return(<div>
    <div style={{fontSize:13,color:C.muted,marginBottom:12}}>Teste alle Download-Methoden direkt. Nach jedem Test: prüfe Downloads-Ordner auf neue Dateien.</div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
      <Btn sm onClick={()=>runTest("KLEIN (20 Bytes)",'{"test":1}','debug_klein.json')}>🧪 Klein (20 B)</Btn>
      <Btn sm onClick={()=>runTest("GROSS (50 KB)",JSON.stringify({data:'x'.repeat(50000)}),'debug_gross.json')}>🧪 Groß (50 KB)</Btn>
      <Btn sm variant="secondary" onClick={refresh}>🔄 Aktualisieren</Btn>
      <Btn sm variant="secondary" onClick={copyLog}>📋 Log kopieren</Btn>
    </div>
    <div style={{fontSize:12,color:"#854d0e",background:"#fef9c3",borderRadius:8,padding:"8px 12px",marginBottom:10,border:"1px solid #fde047"}}>
      Nach jedem Test: Öffne Dateien-App → Downloads → schau ob debug_klein.json oder debug_gross.json da ist. Das zeigt welche Methode klappt.
    </div>
    {log&&<pre style={{background:"#0f172a",color:"#94a3b8",borderRadius:8,padding:"10px 12px",fontSize:11,lineHeight:1.6,overflowX:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all",maxHeight:300,overflowY:"auto",fontFamily:"monospace"}}>{log}</pre>}
  </div>);
}

function AddCatForm({onAdd}) {
  const EMOJIS=["🌀","💡","🎪","🏃","🤸","🎭","🧩","⚡","🎈","🦁","🦊","🐬","🔴","🟠","🟡","🟢","🔵","🟣"];
  const [label,setLabel]=useState("");const [emoji,setEmoji]=useState("🌀");
  const add=()=>{if(!label.trim())return;const idx=Math.floor(Math.random()*6);const pal=CUSTOM_CAT_PALETTE[idx];onAdd({label:label.trim(),emoji,color:pal.color,bg:pal.bg,builtin:false});setLabel("");};
  return(<div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
    <select value={emoji} onChange={e=>setEmoji(e.target.value)} style={{padding:"8px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:16,background:"white",cursor:"pointer",outline:"none"}}>{EMOJIS.map(e=><option key={e} value={e}>{e}</option>)}</select>
    <input value={label} onChange={e=>setLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Kategoriename..." style={{flex:1,minWidth:120,padding:"8px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
    <Btn sm onClick={add}><Plus size={13}/> Hinzufügen</Btn>
  </div>);
}
function SettingsPage({exercises,players,coaches,sessions,tournaments,kassenbuch,onImport,toast,apiKey,onSaveApiKey,customCats,onSaveCustomCats}) {
  const ref=useRef();const [mode,setMode]=useState("merge");const [ki,setKi]=useState(apiKey||"");const [kv,setKv]=useState(false);
  const doImport=async e=>{ const f=e.target.files?.[0];if(!f)return;try{if(f.name.endsWith(".csv")){const p=parseCsvPlayers(await readText(f));onImport({players:p},mode==="replace"?"replace_players":"merge_players");toast(`${p.length} Spieler importiert`);}else{const d=JSON.parse(await readText(f));onImport(d,mode);toast("Import erfolgreich");}}catch(er){toast("Fehler: "+er.message,"err");}e.target.value=""; };
  const EC=({icon,title,desc,sub,fn})=><div style={{background:C.card,borderRadius:10,border:`1.5px solid ${C.border}`,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><div style={{fontWeight:700,fontSize:14,color:C.text}}>{icon} {title}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{desc}</div>{sub&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{sub}</div>}</div><Btn sm onClick={fn}><Download size={13}/> Export</Btn></div>;
  const Sec=({title,ch})=><div style={{marginBottom:28}}><h2 style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:14,paddingBottom:8,borderBottom:`2px solid ${C.accentL}`}}>{title}</h2>{ch}</div>;
  return(<div>
    <div style={{marginBottom:20}}><h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Einstellungen</h1><div style={{fontSize:13,color:C.muted,marginTop:2}}>G-Jugend Coach · v{APP_VERSION}</div></div>
    <Sec title="🤖 Claude API" ch={<div style={{background:C.card,borderRadius:10,border:`1.5px solid ${C.border}`,padding:"16px 18px"}}>
      <div style={{fontSize:13,color:C.muted,marginBottom:10}}>API-Key von <a href="https://console.anthropic.com" target="_blank" style={{color:C.primary}}>console.anthropic.com</a> – wird nur lokal gespeichert.</div>
      <div style={{display:"flex",gap:8}}><input type={kv?"text":"password"} value={ki} onChange={e=>setKi(e.target.value)} placeholder="sk-ant-..." style={{flex:1,padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",fontFamily:"monospace"}}/><Btn sm variant="secondary" onClick={()=>setKv(v=>!v)}>{kv?"🙈":"👁️"}</Btn><Btn sm onClick={()=>{onSaveApiKey(ki.trim());toast(ki.trim()?"API-Key gespeichert":"API-Key entfernt");}}>Speichern</Btn></div>
      {apiKey&&<div style={{marginTop:8,fontSize:12,color:"#16a34a",fontWeight:600}}>✅ API-Key aktiv – KI-Funktionen verfügbar</div>}
    </div>}/>
    <Sec title="📤 Exportieren" ch={<div style={{display:"flex",flexDirection:"column",gap:10}}>
      <EC icon="💾" title="Vollständiges Backup" desc="Alle Daten inkl. Turniere & Kasse" sub={`${exercises.length} Übungen · ${players.length} Spieler · ${sessions.length} Trainings · ${tournaments.length} Turniere · ${kassenbuch.length} Kassenbucheinträge`} fn={async()=>dlJson({version:APP_VERSION,exportDate:new Date().toISOString(),type:"full",exercises,players,coaches,sessions,tournaments,kassenbuch},`gjugend_backup_${todayISO()}.json`,toast)}/>
      <EC icon="📚" title="Nur Übungen" desc="Bibliothek teilen" sub={`${exercises.length} Übungen`} fn={async()=>dlJson({version:APP_VERSION,exportDate:new Date().toISOString(),type:"exercises",exercises},`gjugend_uebungen_${todayISO()}.json`,toast)}/>
      <EC icon="👥" title="Team" desc="Spieler & Trainer" sub={`${players.length} Spieler · ${coaches.length} Trainer`} fn={async()=>dlJson({version:APP_VERSION,exportDate:new Date().toISOString(),type:"team",players,coaches},`gjugend_team_${todayISO()}.json`,toast)}/>
      <EC icon="📊" title="Spieler (CSV)" desc="Für Excel & Google Sheets" sub={`${players.length} Spieler`} fn={async()=>dlCsv(players,["name","birthYear","strength","active","jersey","notes"],`gjugend_spieler_${todayISO()}.csv`,toast)}/>
      <EC icon="📅" title="Training" desc="Alle Trainingseinheiten" sub={`${sessions.length} Einheiten`} fn={async()=>dlJson({version:APP_VERSION,exportDate:new Date().toISOString(),type:"sessions",sessions},`gjugend_training_${todayISO()}.json`,toast)}/>
      <EC icon="🏆" title="Turniere" desc="Alle Turniere & Ergebnisse" sub={`${tournaments.length} Turniere`} fn={async()=>dlJson({version:APP_VERSION,exportDate:new Date().toISOString(),type:"tournaments",tournaments},`gjugend_turniere_${todayISO()}.json`,toast)}/>
      <EC icon="💰" title="Kassenbuch" desc="Einnahmen & Ausgaben" sub={`${kassenbuch.length} Einträge`} fn={async()=>dlJson({version:APP_VERSION,exportDate:new Date().toISOString(),type:"kassenbuch",kassenbuch},`gjugend_kasse_${todayISO()}.json`,toast)}/>
      <EC icon="📋" title="Kassenbuch (CSV)" desc="Für Excel & Steuer" sub={`${kassenbuch.length} Einträge`} fn={async()=>dlCsv(kassenbuch,["date","description","amount","type","category"],`gjugend_kasse_${todayISO()}.csv`,toast)}/>
    </div>}/>
    <Sec title="📥 Importieren" ch={<div style={{background:C.card,borderRadius:10,border:`1.5px solid ${C.border}`,padding:"16px 18px"}}>
      <div style={{marginBottom:12}}><label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>Modus</label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[["merge","Zusammenführen"],["replace","Ersetzen ⚠️"]].map(([k,l])=><button key={k} onClick={()=>setMode(k)} style={{padding:"6px 14px",borderRadius:8,border:`2px solid ${mode===k?C.primary:C.border}`,background:mode===k?C.accentL:"white",color:mode===k?C.primary:C.muted,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>{l}</button>)}</div></div>
      <div style={{background:"#f8fafc",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:C.muted}}>Unterstützt: JSON Backup · Übungen · Team · Training · Turniere · Kassenbuch · Spieler-CSV</div>
      <Btn onClick={()=>ref.current.click()}><Upload size={14}/> Datei auswählen</Btn>
      <input ref={ref} type="file" accept=".json,.csv" onChange={doImport} style={{display:"none"}}/>
    </div>}/>
    <Sec title="🏷️ Eigene Kategorien" ch={<div>
      <div style={{fontSize:13,color:C.muted,marginBottom:12}}>Füge eigene Trainings-Kategorien hinzu. Sie erscheinen in der Bibliothek und bei der Planung.</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {(customCats||[]).map((cc,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,background:"#f8fafc",border:`1.5px solid ${C.border}`}}>
          <span style={{fontSize:18}}>{cc.emoji}</span>
          <span style={{fontWeight:700,fontSize:14,color:cc.color,flex:1}}>{cc.label}</span>
          <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:cc.bg,color:cc.color,fontWeight:700}}>Vorschau</span>
          <button onClick={()=>onSaveCustomCats((customCats||[]).filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",padding:4,fontSize:16}}>✕</button>
        </div>)}
      </div>
      <AddCatForm onAdd={cc=>onSaveCustomCats([...(customCats||[]),cc])}/>
    </div>}/>
    <Sec title="🐛 Export Debug" ch={<DebugExportPanel toast={toast}/>}/>
    <div style={{textAlign:"center",padding:"20px 0",color:"#cbd5e1",fontSize:12}}>G-Jugend Coach v{APP_VERSION} · Made with ⚽ for G-Jugend Hamburg</div>
  </div>);
}

// ── NAV ───────────────────────────────────────────────────────────
function Nav({page,setPage,counts}) {
  const items=[{key:"library",icon:BookOpen,label:"Bibliothek",count:counts.exercises},{key:"team",icon:Users,label:"Team",count:counts.players},{key:"training",icon:CalendarDays,label:"Training",count:counts.sessions},{key:"turnier",icon:Trophy,label:"Turnier",count:counts.tournaments},{key:"kasse",icon:Wallet,label:"Kasse"},{key:"settings",icon:Settings,label:"Einstellungen"}];
  return(<>
    <style>{`.gn{position:fixed;left:0;top:0;bottom:0;width:200px;background:${C.nav};display:flex;flex-direction:column;z-index:100;padding:0 12px 20px}.gm{display:flex;margin-left:200px;padding:28px;max-width:1100px}.gb{display:none;position:fixed;bottom:0;left:0;right:0;background:${C.nav};z-index:100;border-top:1px solid rgba(255,255,255,.1)}@media(max-width:640px){.gn{display:none}.gb{display:flex}.gm{margin-left:0!important;padding:16px;padding-bottom:80px}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <div className="gn">
      <div style={{padding:"24px 8px 20px",borderBottom:"1px solid rgba(255,255,255,.1)",marginBottom:12}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,.4)",letterSpacing:2,fontWeight:700}}>G-JUGEND</div>
        <div style={{fontSize:18,fontWeight:900,color:"white",marginTop:2}}>⚽ Coach</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:2}}>v{APP_VERSION}</div>
      </div>
      {items.map(({key,icon:Icon,label,count})=><button key={key} onClick={()=>setPage(key)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",marginBottom:4,width:"100%",textAlign:"left",fontFamily:"inherit",background:page===key?"rgba(34,197,94,.2)":"transparent",color:page===key?"#4ade80":"rgba(255,255,255,.6)"}}><Icon size={18} strokeWidth={page===key?2.5:1.8}/><span style={{fontSize:14,fontWeight:700,flex:1}}>{label}</span>{count!==undefined&&<span style={{fontSize:11,background:"rgba(255,255,255,.1)",borderRadius:20,padding:"1px 7px",color:"rgba(255,255,255,.5)"}}>{count}</span>}</button>)}
    </div>
    <div className="gb">{items.map(({key,icon:Icon,label})=><button key={key} onClick={()=>setPage(key)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"8px 4px",border:"none",cursor:"pointer",background:"transparent",color:page===key?"#4ade80":"rgba(255,255,255,.5)",fontFamily:"inherit"}}><Icon size={18} strokeWidth={page===key?2.5:1.8}/><span style={{fontSize:9,fontWeight:700}}>{label}</span></button>)}</div>
  </>);
}

// ── APP ───────────────────────────────────────────────────────────
export default function App() {
  const [page,setPage]=useState("library");
  const [exercises,  setExercises,  er]=useStorage("exercises",  []);
  const [players,    setPlayers,    pr]=useStorage("players",    []);
  const [coaches,    setCoaches,    cr]=useStorage("coaches",    []);
  const [sessions,   setSessions,   sr]=useStorage("sessions",   []);
  const [tournaments,setTournaments,tr]=useStorage("tournaments",[]);
  const [kassenbuch, setKassenbuch, kr]=useStorage("kassenbuch", []);
  const [apiKey,     setApiKey,     ar]=useStorage("apiKey",     "");
  const [customCats, setCustomCats    ]=useStorage("customCats", []);
  // Sync CATS global whenever customCats changes
  useEffect(()=>{
    const merged={...BUILTIN_CATS};
    (customCats||[]).forEach((cc,i)=>{ merged['custom_'+i]={...cc}; });
    Object.keys(CATS).forEach(k=>{if(k.startsWith('custom_'))delete CATS[k];});
    Object.assign(CATS,merged);
  },[customCats]);
  const {toast,Toasts}=useToast();
  // Functional update helpers - prevent stale closure bugs
  const mergeArr=(inc)=>prev=>{ const m=Object.fromEntries(prev.map(e=>[e.id,e]));inc?.forEach(i=>{if(!m[i.id])m[i.id]=i;});return Object.values(m); };
  const upsert=(x)=>prev=>prev.find(e=>e.id===x.id)?prev.map(e=>e.id===x.id?x:e):[...prev,x];

  const saveEx=x=>{ setExercises(upsert(x));toast('Übung gespeichert'); };
  const savePl=x=>{ setPlayers(upsert(x));toast('Spieler gespeichert'); };
  const saveCo=x=>{ setCoaches(upsert(x));toast('Trainer gespeichert'); };
  const saveSe=x=>{ setSessions(upsert(x));toast('Training gespeichert'); };
  const saveTo=x=>{ setTournaments(upsert(x)); };
  const saveKa=x=>{ setKassenbuch(upsert(x)); };

  const doImport=(data,mode)=>{
    if(mode==='merge'){
      if(data.exercises)setExercises(mergeArr(data.exercises));
      if(data.players)setPlayers(mergeArr(data.players));
      if(data.coaches)setCoaches(mergeArr(data.coaches));
      if(data.sessions)setSessions(mergeArr(data.sessions));
      if(data.tournaments)setTournaments(mergeArr(data.tournaments));
      if(data.kassenbuch)setKassenbuch(mergeArr(data.kassenbuch));
    } else if(mode==='replace'){
      if(data.exercises)setExercises(data.exercises);
      if(data.players)setPlayers(data.players);
      if(data.coaches)setCoaches(data.coaches);
      if(data.sessions)setSessions(data.sessions);
      if(data.tournaments)setTournaments(data.tournaments);
      if(data.kassenbuch)setKassenbuch(data.kassenbuch);
    } else if(mode==='merge_players') setPlayers(mergeArr(data.players));
    else if(mode==='replace_players') setPlayers(data.players||[]);
  };
  if(!er||!pr||!cr||!sr||!tr||!kr||!ar) return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg}}><div style={{textAlign:"center",color:C.muted}}><div style={{fontSize:40,marginBottom:12}}>⚽</div><div style={{fontWeight:700}}>Lade...</div></div></div>;
  return(<div style={{fontFamily:"system-ui,-apple-system,sans-serif",background:C.bg,minHeight:"100vh"}}>
    <style>{`*{box-sizing:border-box}body{margin:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}`}</style>
    <Toasts/>
    <Nav page={page} setPage={setPage} counts={{exercises:exercises.length,players:players.filter(p=>p.active).length,sessions:sessions.length,tournaments:tournaments.length}}/>
    <main className="gm" style={{display:"block"}}>
      {page==="library"  &&<LibraryPage  exercises={exercises} onSave={saveEx} onDelete={id=>{setExercises(prev=>prev.filter(e=>e.id!==id));toast("Übung gelöscht");}} apiKey={apiKey} toast={toast}/>}
      {page==="team"     &&<TeamPage     players={players} coaches={coaches} onSavePlayer={savePl} onDeletePlayer={id=>{setPlayers(prev=>prev.filter(p=>p.id!==id));toast("Spieler gelöscht");}} onSaveCoach={saveCo} onDeleteCoach={id=>{setCoaches(prev=>prev.filter(c=>c.id!==id));toast("Trainer gelöscht");}} toast={toast} onAddToTraining={({playerIds,coachIds})=>{setSessions(prev=>[...prev,{id:uid(),createdAt:now(),date:todayISO(),duration:60,location:"",weather:"",participantCount:"",coachIds,playerIds,exerciseIds:[],teams:[],notes:""}]);setPage("training");toast("Training angelegt ✓");}}/>}
      {page==="training" &&<TrainingPage sessions={sessions} players={players} coaches={coaches} exercises={exercises} onSaveSession={saveSe} onDeleteSession={id=>{setSessions(prev=>prev.filter(s=>s.id!==id));toast("Training gelöscht");}} apiKey={apiKey} toast={toast} onSaveExercise={saveEx}/>}
      {page==="turnier"  &&<TurnierPage  tournaments={tournaments} onSaveTournament={saveTo} onDeleteTournament={id=>{setTournaments(prev=>prev.filter(t=>t.id!==id));toast("Turnier gelöscht");}} coaches={coaches}/>}
      {page==="kasse"    &&<KassePage    kassenbuch={kassenbuch} onSave={saveKa} onDelete={id=>{setKassenbuch(prev=>prev.filter(k=>k.id!==id));}} toast={toast}/>}
      {page==="settings" &&<SettingsPage exercises={exercises} players={players} coaches={coaches} sessions={sessions} tournaments={tournaments} kassenbuch={kassenbuch} onImport={doImport} toast={toast} apiKey={apiKey} onSaveApiKey={k=>setApiKey(k)} customCats={customCats} onSaveCustomCats={setCustomCats}/>}
    </main>
  </div>);
}
