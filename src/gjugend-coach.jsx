import { useState, useEffect, useRef } from "react";
import { BookOpen, Users, CalendarDays, Settings, Plus, Search, X, Edit2, Trash2, Download, Upload, User, Shield, Shuffle, Filter, ChevronDown, Star, Clock, Package, Tag, Info } from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// CONSTANTS & THEME
// ─────────────────────────────────────────────────────────────────
const APP_VERSION = "1.0.0";
const APP_NAME = "G-Jugend Coach";

const CATS = {
  aufwaermen:   { label: "Aufwärmen",    emoji: "🔥", color: "#ea580c", bg: "#fff7ed" },
  koordination: { label: "Koordination", emoji: "🎯", color: "#7c3aed", bg: "#f5f3ff" },
  technik:      { label: "Technik",      emoji: "⚽", color: "#2563eb", bg: "#eff6ff" },
  spielform:    { label: "Spielform",    emoji: "🏆", color: "#16a34a", bg: "#f0fdf4" },
  abschluss:    { label: "Abschluss",   emoji: "🌅", color: "#db2777", bg: "#fdf2f8" },
};

const PRESET_TAGS = [
  "Dribbeln","Passspiel","Torschuss","Zweikampf","Koordination",
  "Gleichgewicht","Reaktion","Schnelligkeit","Ausdauer","Teamwork",
  "Spaß","Kreativität","Wettkampf","Funino","Motorik","Raumgefühl"
];

const PRESET_MAT = [
  "Hütchen","Bälle","Minitore","Leibchen","Stangen",
  "Reifen","Pylonen","Markierungsscheiben","Seilchen","Tore (groß)"
];

const STR = {
  1: { label:"Entdecker",  emoji:"🌱", color:"#16a34a", light:"#dcfce7", desc:"Findet den Ball, läuft hinterher – noch kein gezieltes Dribbeln" },
  2: { label:"Entwickler", emoji:"🌟", color:"#b45309", light:"#fef3c7", desc:"Ball unter Kontrolle, einfaches Dribbling – spielt manchmal mit Team" },
  3: { label:"Spieler",    emoji:"⭐", color:"#dc2626", light:"#fee2e2", desc:"Gezieltes Passspiel, Torabschluss – liest einfache Spielsituationen" },
  4: { label:"Antreiber",  emoji:"🏆", color:"#1d4ed8", light:"#dbeafe", desc:"Konstant stark, sucht aktiv den Ball – motiviert und hilft Mitspielern" },
};

const ROLES = { head:"Cheftrainer", assistant:"Co-Trainer", helper:"Helfer" };

const C = {
  nav:"#0f2419", primary:"#166534", accent:"#22c55e", accentL:"#dcfce7",
  bg:"#f0f4f0", card:"#ffffff", border:"#e2e8f0", text:"#1e293b", muted:"#64748b",
};

// ─────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const now = () => new Date().toISOString();
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}) : "";
const todayISO = () => new Date().toISOString().split("T")[0];

const dlJson = (obj, name) => {
  const blob = new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=name; a.click();
  URL.revokeObjectURL(url);
};

const dlCsv = (rows, cols, name) => {
  const csv = [cols.join(","), ...rows.map(r=>cols.map(c=>`"${String(r[c]??"").replace(/"/g,'""')}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=name; a.click();
  URL.revokeObjectURL(url);
};

const readText = (file) => new Promise((res,rej)=>{
  const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsText(file);
});
const readDataURL = (file) => new Promise((res,rej)=>{
  const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsDataURL(file);
});

const parseCsvPlayers = (text) => {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h=>h.replace(/"/g,"").trim().toLowerCase());
  return lines.slice(1).map(line=>{
    const vals = line.split(",").map(v=>v.replace(/"/g,"").trim());
    const obj = {};
    headers.forEach((h,i)=>obj[h]=vals[i]??"");
    return {
      id: uid(), createdAt: now(),
      name: obj.name||"Unbekannt",
      birthYear: Number(obj.birthyear||obj.jahrgang||2019),
      strength: Math.min(4,Math.max(1,Number(obj.strength||obj.staerke||1))),
      active: obj.active!=="false"&&obj.aktiv!=="false",
      jersey: obj.jersey||obj.trikot||"",
      notes: obj.notes||obj.notizen||""
    };
  }).filter(p=>p.name&&p.name!=="Unbekannt");
};

function buildTeams(players, perTeam, mode) {
  if (!players.length || !perTeam) return [];
  const n = Math.max(1, Math.floor(players.length / perTeam));
  const teams = Array.from({length:n},(_,i)=>({id:uid(), name:`Team ${i+1}`, players:[]}));
  const rest = players.length % perTeam;

  if (mode==="balanced") {
    const sorted = [...players].sort((a,b)=>b.strength-a.strength);
    sorted.forEach((p,i)=>{
      const round = Math.floor(i/n);
      const pos = round%2===0 ? i%n : n-1-(i%n);
      teams[pos].players.push(p);
    });
  } else if (mode==="mixed") {
    [4,3,2,1].forEach(s=>{
      players.filter(p=>p.strength===s).forEach((p,i)=>teams[i%n].players.push(p));
    });
  } else if (mode==="challenge") {
    const sorted = [...players].sort((a,b)=>b.strength-a.strength);
    const half = Math.ceil(sorted.length/n);
    sorted.forEach((p,i)=>teams[Math.min(n-1,Math.floor(i/half))].players.push(p));
  } else {
    [...players].sort(()=>Math.random()-0.5).forEach((p,i)=>teams[i%n].players.push(p));
  }
  return teams;
}

// ─────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────
function useStorage(key, def) {
  const [data, setData] = useState(def);
  const [ready, setReady] = useState(false);
  useEffect(()=>{
    (async()=>{
      try{ const r=await window.storage.get(key); if(r) setData(JSON.parse(r.value)); }catch{}
      setReady(true);
    })();
  },[key]);
  const save = async(next)=>{ setData(next); try{await window.storage.set(key,JSON.stringify(next));}catch{} };
  return [data, save, ready];
}

function useToast() {
  const [list,setList]=useState([]);
  const toast=(msg,type="ok")=>{ const id=uid(); setList(p=>[...p,{id,msg,type}]); setTimeout(()=>setList(p=>p.filter(t=>t.id!==id)),3000); };
  const Toasts=()=>(
    <div style={{position:"fixed",top:16,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {list.map(t=>(
        <div key={t.id} style={{padding:"10px 18px",borderRadius:10,fontSize:14,fontWeight:700,color:"white",background:t.type==="err"?"#ef4444":t.type==="warn"?"#f59e0b":"#16a34a",boxShadow:"0 4px 16px rgba(0,0,0,.2)"}}>
          {t.msg}
        </div>
      ))}
    </div>
  );
  return {toast, Toasts};
}

// ─────────────────────────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────
const Modal=({title,onClose,children,wide})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
    <div style={{background:C.card,borderRadius:18,width:"100%",maxWidth:wide?760:540,maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 28px 80px rgba(0,0,0,.35)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <h2 style={{margin:0,fontSize:18,fontWeight:800,color:C.text}}>{title}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,padding:6,borderRadius:8,display:"flex",alignItems:"center",fontSize:18,lineHeight:1}}>✕</button>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:24}}>{children}</div>
    </div>
  </div>
);

const CatBadge=({cat,small})=>{
  const c=CATS[cat]; if(!c) return null;
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:small?11:12,fontWeight:700,padding:small?"2px 8px":"3px 10px",borderRadius:20,background:c.bg,color:c.color,whiteSpace:"nowrap"}}>{c.emoji} {c.label}</span>;
};

const Stars=({value,onChange,readonly})=>(
  <div style={{display:"flex",gap:2}}>
    {[1,2,3,4,5].map(n=>(
      <span key={n} onClick={()=>!readonly&&onChange?.(n)}
        style={{cursor:readonly?"default":"pointer",fontSize:readonly?14:18,color:n<=value?"#f59e0b":"#e2e8f0",lineHeight:1}}>★</span>
    ))}
  </div>
);

const StrBadge=({level,small})=>{
  const s=STR[level]; if(!s) return null;
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:small?11:12,fontWeight:700,padding:"2px 10px",borderRadius:20,background:s.light,color:s.color}}>{s.emoji} {s.label}</span>;
};

const Inp=({label,style:st,...props})=>(
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>{label}</label>}
    <input {...props} style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,color:C.text,background:"white",outline:"none",boxSizing:"border-box",...st}} />
  </div>
);

const Txta=({label,...props})=>(
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>{label}</label>}
    <textarea {...props} style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,color:C.text,background:"white",outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}} />
  </div>
);

const Sel=({label,children,...props})=>(
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>{label}</label>}
    <select {...props} style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,color:C.text,background:"white",outline:"none",boxSizing:"border-box"}}>
      {children}
    </select>
  </div>
);

const Btn=({children,variant="primary",sm,...props})=>(
  <button {...props} style={{
    padding:sm?"6px 14px":"9px 18px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,
    fontSize:sm?13:14,fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6,
    transition:"opacity .15s, transform .1s",
    ...(variant==="primary"?{background:C.primary,color:"white"}:
        variant==="accent"?{background:C.accent,color:"#0f2419"}:
        variant==="danger"?{background:"#ef4444",color:"white"}:
        {background:"white",color:C.text,border:`1.5px solid ${C.border}`}),
    ...props.style
  }}>{children}</button>
);

const Row=({children,gap=12})=><div style={{display:"flex",gap,flexWrap:"wrap"}}>{children}</div>;
const Col=({children,flex=1})=><div style={{flex}}>{children}</div>;
const Divider=()=><div style={{borderTop:`1px solid ${C.border}`,margin:"20px 0"}} />;

const EmptyState=({icon,title,sub,onAdd,addLabel})=>(
  <div style={{textAlign:"center",padding:"60px 24px",color:C.muted}}>
    <div style={{fontSize:48,marginBottom:16}}>{icon}</div>
    <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:8}}>{title}</div>
    {sub&&<div style={{fontSize:14,marginBottom:24}}>{sub}</div>}
    {onAdd&&<Btn onClick={onAdd}><Plus size={16}/> {addLabel}</Btn>}
  </div>
);

// ─────────────────────────────────────────────────────────────────
// EXERCISE FORM
// ─────────────────────────────────────────────────────────────────
function ExerciseForm({exercise, onSave, onClose}) {
  const isEdit=!!exercise?.id;
  const [form,setForm]=useState({
    title:"",category:"technik",description:"",setup:"",material:[],
    minPlayers:4,maxPlayers:12,duration:10,rating:3,tags:[],
    imageUrl:"",source:"",notes:"",
    ...exercise
  });
  const [matInput,setMatInput]=useState("");
  const imgRef=useRef();

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const addMat=(m)=>{
    if(!m.trim()) return;
    const item=m.trim();
    if(!form.material.includes(item)) set("material",[...form.material,item]);
    setMatInput("");
  };

  const toggleTag=(t)=>set("tags",form.tags.includes(t)?form.tags.filter(x=>x!==t):[...form.tags,t]);

  const handleImage=async(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const url=await readDataURL(file); set("imageUrl",url);
  };

  const handleSave=()=>{
    if(!form.title.trim()) return;
    onSave({...form, id:form.id||uid(), createdAt:form.createdAt||now(), updatedAt:now()});
  };

  const chipStyle=(active)=>({
    padding:"4px 10px",borderRadius:20,border:`1.5px solid ${active?C.primary:C.border}`,
    background:active?C.accentL:"white",color:active?C.primary:C.muted,
    cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"
  });

  return (
    <div>
      <Inp label="Titel *" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Name der Übung" />
      <Sel label="Kategorie" value={form.category} onChange={e=>set("category",e.target.value)}>
        {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
      </Sel>

      <Txta label="Ablauf / Beschreibung" value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Wie läuft die Übung ab? Schritt für Schritt..." rows={4} />
      <Txta label="Aufbau" value={form.setup} onChange={e=>set("setup",e.target.value)} placeholder="Wie wird das Feld aufgebaut? Abstände, Hütchen, Tore..." rows={3} />

      {/* Material */}
      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Material</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
          {PRESET_MAT.map(m=><button key={m} onClick={()=>addMat(m)} style={chipStyle(form.material.includes(m))}>{m}</button>)}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={matInput} onChange={e=>setMatInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addMat(matInput)}
            placeholder="Eigenes Material + Menge (z.B. Hütchen 8x)..."
            style={{flex:1,padding:"8px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit"}} />
          <Btn sm onClick={()=>addMat(matInput)}>+</Btn>
        </div>
        {form.material.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
            {form.material.map(m=>(
              <span key={m} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,background:C.accentL,color:C.primary,fontSize:12,fontWeight:700}}>
                📦 {m}
                <button onClick={()=>set("material",form.material.filter(x=>x!==m))} style={{background:"none",border:"none",cursor:"pointer",color:C.primary,padding:0,fontSize:13,lineHeight:1}}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Players + Duration */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        <Inp label="Min. Kinder" type="number" value={form.minPlayers} onChange={e=>set("minPlayers",Number(e.target.value))} min={1} style={{marginBottom:0}} />
        <Inp label="Max. Kinder" type="number" value={form.maxPlayers} onChange={e=>set("maxPlayers",Number(e.target.value))} min={1} style={{marginBottom:0}} />
        <Inp label="Dauer (Min)" type="number" value={form.duration} onChange={e=>set("duration",Number(e.target.value))} min={1} style={{marginBottom:0}} />
      </div>

      {/* Rating */}
      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Bewertung</label>
        <Stars value={form.rating} onChange={v=>set("rating",v)} />
      </div>

      {/* Tags */}
      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Tags</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {PRESET_TAGS.map(t=><button key={t} onClick={()=>toggleTag(t)} style={chipStyle(form.tags.includes(t))}>{t}</button>)}
        </div>
      </div>

      {/* Image */}
      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Skizze / Foto</label>
        {form.imageUrl
          ?<div style={{position:"relative",display:"inline-block"}}>
            <img src={form.imageUrl} alt="" style={{maxWidth:"100%",maxHeight:180,borderRadius:8,objectFit:"cover",border:`1px solid ${C.border}`}} />
            <button onClick={()=>set("imageUrl","")} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,.6)",color:"white",border:"none",borderRadius:6,cursor:"pointer",padding:"3px 8px",fontSize:12}}>✕</button>
          </div>
          :<button onClick={()=>imgRef.current.click()} style={{padding:"10px 16px",border:`1.5px dashed ${C.border}`,borderRadius:8,cursor:"pointer",background:"white",color:C.muted,fontSize:13,fontFamily:"inherit"}}>
            📷 Bild hochladen
          </button>
        }
        <input ref={imgRef} type="file" accept="image/*" onChange={handleImage} style={{display:"none"}} />
      </div>

      <Inp label="Quelle" value={form.source} onChange={e=>set("source",e.target.value)} placeholder="z.B. DFB Übungssammlung, eigene Idee..." />
      <Txta label="Notizen & Varianten" value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Erfahrungen, Tipps, Varianten..." rows={2} />

      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
        <Btn onClick={onClose} variant="secondary">Abbrechen</Btn>
        <Btn onClick={handleSave} variant="primary">{isEdit?"Speichern":"Erstellen"}</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EXERCISE DETAIL
// ─────────────────────────────────────────────────────────────────
function ExerciseDetail({exercise, onEdit, onDelete, onClose}) {
  const ex=exercise;
  return (
    <div>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
        <CatBadge cat={ex.category} />
        <Stars value={ex.rating} readonly />
        <span style={{color:C.muted,fontSize:13,marginLeft:"auto"}}>
          <Clock size={13} style={{verticalAlign:"middle",marginRight:3}} />
          {ex.duration} Min &nbsp;·&nbsp;
          <span>👥 {ex.minPlayers}–{ex.maxPlayers} Kinder</span>
        </span>
      </div>

      {ex.imageUrl&&<img src={ex.imageUrl} alt="" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:10,marginBottom:16,border:`1px solid ${C.border}`}} />}

      {ex.setup&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>📐 Aufbau</div>
          <div style={{fontSize:14,color:C.text,lineHeight:1.6,background:"#f8fafc",borderRadius:8,padding:"12px 14px",border:`1px solid ${C.border}`}}>{ex.setup}</div>
        </div>
      )}

      {ex.description&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>🎯 Ablauf</div>
          <div style={{fontSize:14,color:C.text,lineHeight:1.6,background:"#f8fafc",borderRadius:8,padding:"12px 14px",border:`1px solid ${C.border}`}}>{ex.description}</div>
        </div>
      )}

      {ex.material?.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>📦 Material</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {ex.material.map(m=>(
              <span key={m} style={{padding:"4px 10px",borderRadius:20,background:C.accentL,color:C.primary,fontSize:12,fontWeight:700}}>📦 {m}</span>
            ))}
          </div>
        </div>
      )}

      {ex.tags?.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>🏷️ Tags</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {ex.tags.map(t=><span key={t} style={{padding:"3px 10px",borderRadius:20,background:"#f1f5f9",color:C.muted,fontSize:12,fontWeight:600}}>{t}</span>)}
          </div>
        </div>
      )}

      {ex.notes&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>💬 Notizen</div>
          <div style={{fontSize:14,color:C.text,lineHeight:1.6,fontStyle:"italic"}}>{ex.notes}</div>
        </div>
      )}

      {ex.source&&<div style={{fontSize:12,color:C.muted,marginBottom:8}}>Quelle: {ex.source}</div>}
      <div style={{fontSize:11,color:"#cbd5e1"}}>Erstellt: {fmtDate(ex.createdAt)}{ex.updatedAt!==ex.createdAt?` · Bearbeitet: ${fmtDate(ex.updatedAt)}`:""}</div>

      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
        <Btn onClick={()=>{onDelete(ex.id);onClose();}} variant="danger" sm><Trash2 size={14}/> Löschen</Btn>
        <Btn onClick={onEdit} variant="secondary" sm><Edit2 size={14}/> Bearbeiten</Btn>
        <Btn onClick={onClose} sm>Schließen</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EXERCISE CARD
// ─────────────────────────────────────────────────────────────────
function ExCard({exercise, onClick}) {
  const ex=exercise;
  const cat=CATS[ex.category];
  return (
    <div onClick={onClick} style={{background:C.card,borderRadius:12,border:`1.5px solid ${C.border}`,padding:"14px 16px",cursor:"pointer",transition:"box-shadow .15s, transform .1s",display:"flex",flexDirection:"column",gap:8}}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.1)";e.currentTarget.style.transform="translateY(-1px)"}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateY(0)"}}>
      {ex.imageUrl&&<img src={ex.imageUrl} alt="" style={{width:"100%",height:100,objectFit:"cover",borderRadius:8,marginBottom:4}} />}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
        <CatBadge cat={ex.category} small />
        <Stars value={ex.rating} readonly />
      </div>
      <div style={{fontWeight:800,fontSize:15,color:C.text,lineHeight:1.3}}>{ex.title}</div>
      <div style={{display:"flex",gap:10,color:C.muted,fontSize:12,fontWeight:600,flexWrap:"wrap"}}>
        <span>⏱ {ex.duration} Min</span>
        <span>👥 {ex.minPlayers}–{ex.maxPlayers}</span>
        {ex.material?.length>0&&<span>📦 {ex.material.length}x</span>}
      </div>
      {ex.tags?.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {ex.tags.slice(0,3).map(t=><span key={t} style={{padding:"2px 8px",borderRadius:20,background:"#f1f5f9",color:C.muted,fontSize:11,fontWeight:600}}>{t}</span>)}
          {ex.tags.length>3&&<span style={{padding:"2px 8px",borderRadius:20,background:"#f1f5f9",color:C.muted,fontSize:11,fontWeight:600}}>+{ex.tags.length-3}</span>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LIBRARY PAGE
// ─────────────────────────────────────────────────────────────────
function LibraryPage({exercises, onSave, onDelete}) {
  const [search,setSearch]=useState("");
  const [filterCat,setFilterCat]=useState("");
  const [filterTag,setFilterTag]=useState("");
  const [filterRating,setFilterRating]=useState(0);
  const [showFilter,setShowFilter]=useState(false);
  const [modal,setModal]=useState(null); // {type:"form"|"detail", exercise}

  const filtered=exercises.filter(ex=>{
    if(search&&!ex.title.toLowerCase().includes(search.toLowerCase())&&!ex.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if(filterCat&&ex.category!==filterCat) return false;
    if(filterTag&&!ex.tags?.includes(filterTag)) return false;
    if(filterRating&&ex.rating<filterRating) return false;
    return true;
  });

  const allTags=[...new Set(exercises.flatMap(e=>e.tags||[]))].sort();

  const handleSave=(ex)=>{
    onSave(ex);
    setModal(null);
  };

  const handleDelete=(id)=>{ onDelete(id); };

  return (
    <div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Übungsbibliothek</h1>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>{exercises.length} Übungen</div>
        </div>
        <Btn onClick={()=>setModal({type:"form",exercise:null})}><Plus size={16}/> Neue Übung</Btn>
      </div>

      {/* Search + Filter */}
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200,position:"relative"}}>
          <Search size={15} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.muted}} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen..."
            style={{width:"100%",padding:"9px 12px 9px 36px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}} />
        </div>
        <Btn onClick={()=>setShowFilter(f=>!f)} variant="secondary" sm>
          <Filter size={14}/> Filter {(filterCat||filterTag||filterRating)?`(${[filterCat,filterTag,filterRating>0].filter(Boolean).length})`:""}
        </Btn>
      </div>

      {showFilter&&(
        <div style={{background:C.card,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:14,display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{flex:1,minWidth:140}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:4}}>KATEGORIE</label>
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{width:"100%",padding:"7px 10px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none"}}>
              <option value="">Alle</option>
              {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
          </div>
          <div style={{flex:1,minWidth:140}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:4}}>TAG</label>
            <select value={filterTag} onChange={e=>setFilterTag(e.target.value)} style={{width:"100%",padding:"7px 10px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none"}}>
              <option value="">Alle</option>
              {allTags.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{flex:1,minWidth:140}}>
            <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:4}}>MIN. BEWERTUNG</label>
            <select value={filterRating} onChange={e=>setFilterRating(Number(e.target.value))} style={{width:"100%",padding:"7px 10px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:13,outline:"none"}}>
              <option value={0}>Alle</option>
              {[1,2,3,4,5].map(n=><option key={n} value={n}>{'★'.repeat(n)+' +}'}</option>)}
            </select>
          </div>
          <Btn sm variant="secondary" onClick={()=>{setFilterCat("");setFilterTag("");setFilterRating(0);setShowFilter(false);}}>Zurücksetzen</Btn>
        </div>
      )}

      {/* Category tabs */}
      <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        <button onClick={()=>setFilterCat("")} style={{padding:"5px 14px",borderRadius:20,border:`1.5px solid ${filterCat===""?C.primary:C.border}`,background:filterCat===""?C.accentL:"white",color:filterCat===""?C.primary:C.muted,cursor:"pointer",fontSize:13,fontWeight:700,whiteSpace:"nowrap",fontFamily:"inherit"}}>
          Alle ({exercises.length})
        </button>
        {Object.entries(CATS).map(([k,v])=>{
          const count=exercises.filter(e=>e.category===k).length;
          return <button key={k} onClick={()=>setFilterCat(k===filterCat?"":k)}
            style={{padding:"5px 14px",borderRadius:20,border:`1.5px solid ${filterCat===k?v.color:C.border}`,background:filterCat===k?v.bg:"white",color:filterCat===k?v.color:C.muted,cursor:"pointer",fontSize:13,fontWeight:700,whiteSpace:"nowrap",fontFamily:"inherit"}}>
            {v.emoji} {v.label} ({count})
          </button>;
        })}
      </div>

      {/* Grid */}
      {filtered.length===0
        ?<EmptyState icon="📚" title={exercises.length===0?"Noch keine Übungen":"Nichts gefunden"}
          sub={exercises.length===0?"Lege deine erste Übung an.":"Andere Suchbegriffe oder Filter versuchen."}
          onAdd={exercises.length===0?()=>setModal({type:"form",exercise:null}):undefined} addLabel="Erste Übung erstellen" />
        :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
          {filtered.map(ex=>(
            <ExCard key={ex.id} exercise={ex} onClick={()=>setModal({type:"detail",exercise:ex})} />
          ))}
        </div>
      }

      {/* Modals */}
      {modal?.type==="form"&&(
        <Modal title={modal.exercise?"Übung bearbeiten":"Neue Übung"} onClose={()=>setModal(null)} wide>
          <ExerciseForm exercise={modal.exercise} onSave={handleSave} onClose={()=>setModal(null)} />
        </Modal>
      )}
      {modal?.type==="detail"&&(
        <Modal title={modal.exercise.title} onClose={()=>setModal(null)} wide>
          <ExerciseDetail exercise={modal.exercise}
            onEdit={()=>setModal({type:"form",exercise:modal.exercise})}
            onDelete={handleDelete} onClose={()=>setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PLAYER FORM
// ─────────────────────────────────────────────────────────────────
function PlayerForm({player, onSave, onClose}) {
  const [form,setForm]=useState({name:"",birthYear:2019,strength:1,active:true,jersey:"",notes:"",...player});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const handleSave=()=>{ if(!form.name.trim()) return; onSave({...form,id:form.id||uid(),createdAt:form.createdAt||now()}); };

  return (
    <div>
      <Inp label="Name *" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Vorname des Kindes" />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <Inp label="Jahrgang" type="number" value={form.birthYear} onChange={e=>set("birthYear",Number(e.target.value))} min={2010} max={2025} style={{marginBottom:0}} />
        <Inp label="Trikot #" type="text" value={form.jersey} onChange={e=>set("jersey",e.target.value)} placeholder="z.B. 7" style={{marginBottom:0}} />
      </div>

      {/* Strength */}
      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:.6}}>Stärke</label>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[1,2,3,4].map(n=>{
            const s=STR[n];
            return (
              <button key={n} onClick={()=>set("strength",n)}
                style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 14px",borderRadius:10,border:`2px solid ${form.strength===n?s.color:C.border}`,background:form.strength===n?s.light:"white",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
                <span style={{fontSize:20,lineHeight:1}}>{s.emoji}</span>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:form.strength===n?s.color:C.text}}>{s.label}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:2}}>{s.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <input type="checkbox" id="active" checked={form.active} onChange={e=>set("active",e.target.checked)} style={{width:16,height:16,cursor:"pointer"}} />
        <label htmlFor="active" style={{fontSize:14,fontWeight:600,color:C.text,cursor:"pointer"}}>Aktiv (nimmt am Training teil)</label>
      </div>

      <Txta label="Notizen" value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Besonderheiten, Verletzungen, Anmerkungen..." rows={2} />

      <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:`1px solid ${C.border}`}}>
        <Btn onClick={onClose} variant="secondary">Abbrechen</Btn>
        <Btn onClick={handleSave}>{player?.id?"Speichern":"Erstellen"}</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COACH FORM
// ─────────────────────────────────────────────────────────────────
function CoachForm({coach, onSave, onClose}) {
  const [form,setForm]=useState({name:"",role:"assistant",phone:"",active:true,notes:"",...coach});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const handleSave=()=>{ if(!form.name.trim()) return; onSave({...form,id:form.id||uid(),createdAt:form.createdAt||now()}); };
  return (
    <div>
      <Inp label="Name *" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Name des Trainers" />
      <Sel label="Rolle" value={form.role} onChange={e=>set("role",e.target.value)}>
        {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
      </Sel>
      <Inp label="Telefon" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="+49..." />
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <input type="checkbox" id="cactive" checked={form.active} onChange={e=>set("active",e.target.checked)} style={{width:16,height:16}} />
        <label htmlFor="cactive" style={{fontSize:14,fontWeight:600,color:C.text,cursor:"pointer"}}>Aktiv</label>
      </div>
      <Txta label="Notizen" value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} />
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:`1px solid ${C.border}`}}>
        <Btn onClick={onClose} variant="secondary">Abbrechen</Btn>
        <Btn onClick={handleSave}>{coach?.id?"Speichern":"Erstellen"}</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TEAM PAGE
// ─────────────────────────────────────────────────────────────────
function TeamPage({players, coaches, onSavePlayer, onDeletePlayer, onSaveCoach, onDeleteCoach}) {
  const [tab,setTab]=useState("players");
  const [modal,setModal]=useState(null);
  const [confirmDel,setConfirmDel]=useState(null);

  const handleDelPlayer=(id)=>{ onDeletePlayer(id); setConfirmDel(null); };
  const handleDelCoach=(id)=>{ onDeleteCoach(id); setConfirmDel(null); };

  const strGroups={4:[],3:[],2:[],1:[]};
  players.forEach(p=>strGroups[p.strength]?.push(p));

  const tabBtn=(key,label,count)=>(
    <button onClick={()=>setTab(key)} style={{padding:"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"inherit",background:tab===key?C.primary:"transparent",color:tab===key?"white":C.muted}}>
      {label} <span style={{fontSize:12,opacity:.7}}>({count})</span>
    </button>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Team</h1>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>{players.filter(p=>p.active).length} aktive Spieler · {coaches.filter(c=>c.active).length} Trainer</div>
        </div>
        <Btn onClick={()=>setModal({type:tab==="players"?"playerForm":"coachForm",data:null})}>
          <Plus size={16}/> {tab==="players"?"Spieler":"Trainer"} hinzufügen
        </Btn>
      </div>

      <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:10,padding:4,marginBottom:20,width:"fit-content"}}>
        {tabBtn("players","Spieler",players.length)}
        {tabBtn("coaches","Trainer",coaches.length)}
      </div>

      {tab==="players"&&(
        <div>
          {players.length===0
            ?<EmptyState icon="👦" title="Noch keine Spieler" sub="Füge die Kinder deiner Mannschaft hinzu." onAdd={()=>setModal({type:"playerForm",data:null})} addLabel="Ersten Spieler anlegen" />
            :<div>
              {[4,3,2,1].map(s=>{
                const group=strGroups[s];
                if(!group.length) return null;
                return (
                  <div key={s} style={{marginBottom:20}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <StrBadge level={s} />
                      <span style={{fontSize:13,color:C.muted}}>{group.length} Spieler</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
                      {group.map(p=>(
                        <div key={p.id} style={{background:C.card,borderRadius:10,border:`1.5px solid ${p.active?C.border:"#e2e8f0"}`,padding:"12px 14px",opacity:p.active?1:.6}}>
                          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:6}}>
                            <div>
                              <div style={{fontWeight:800,fontSize:15,color:C.text}}>{p.name}</div>
                              {p.jersey&&<div style={{fontSize:12,color:C.muted}}>Trikot #{p.jersey}</div>}
                              {!p.active&&<div style={{fontSize:11,color:"#f59e0b",fontWeight:700}}>Inaktiv</div>}
                            </div>
                            <div style={{display:"flex",gap:4}}>
                              <button onClick={()=>setModal({type:"playerForm",data:p})} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,padding:4,borderRadius:6}}><Edit2 size={14}/></button>
                              <button onClick={()=>setConfirmDel({type:"player",id:p.id,name:p.name})} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",padding:4,borderRadius:6}}><Trash2 size={14}/></button>
                            </div>
                          </div>
                          {p.notes&&<div style={{fontSize:12,color:C.muted,marginTop:6,fontStyle:"italic"}}>{p.notes}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>
      )}

      {tab==="coaches"&&(
        <div>
          {coaches.length===0
            ?<EmptyState icon="🧑‍🏫" title="Noch keine Trainer" onAdd={()=>setModal({type:"coachForm",data:null})} addLabel="Ersten Trainer anlegen" />
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
              {coaches.map(c=>(
                <div key={c.id} style={{background:C.card,borderRadius:10,border:`1.5px solid ${C.border}`,padding:"14px 16px",opacity:c.active?1:.6}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontWeight:800,fontSize:15,color:C.text}}>{c.name}</div>
                      <div style={{fontSize:12,color:C.muted,marginTop:2}}>{ROLES[c.role]}</div>
                      {c.phone&&<div style={{fontSize:12,color:C.muted}}>{c.phone}</div>}
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>setModal({type:"coachForm",data:c})} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,padding:4}}><Edit2 size={14}/></button>
                      <button onClick={()=>setConfirmDel({type:"coach",id:c.id,name:c.name})} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",padding:4}}><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel&&(
        <Modal title="Löschen bestätigen" onClose={()=>setConfirmDel(null)}>
          <p style={{color:C.text,marginTop:0}}>„<strong>{confirmDel.name}</strong>" wirklich löschen? Das kann nicht rückgängig gemacht werden.</p>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn onClick={()=>setConfirmDel(null)} variant="secondary">Abbrechen</Btn>
            <Btn onClick={()=>confirmDel.type==="player"?handleDelPlayer(confirmDel.id):handleDelCoach(confirmDel.id)} variant="danger"><Trash2 size={14}/> Löschen</Btn>
          </div>
        </Modal>
      )}

      {modal?.type==="playerForm"&&(
        <Modal title={modal.data?"Spieler bearbeiten":"Neuer Spieler"} onClose={()=>setModal(null)}>
          <PlayerForm player={modal.data} onSave={(p)=>{onSavePlayer(p);setModal(null);}} onClose={()=>setModal(null)} />
        </Modal>
      )}
      {modal?.type==="coachForm"&&(
        <Modal title={modal.data?"Trainer bearbeiten":"Neuer Trainer"} onClose={()=>setModal(null)}>
          <CoachForm coach={modal.data} onSave={(c)=>{onSaveCoach(c);setModal(null);}} onClose={()=>setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TEAM BUILDER MODAL
// ─────────────────────────────────────────────────────────────────
function TeamBuilderModal({availablePlayers, onSaveTeams, onClose}) {
  const [perTeam,setPerTeam]=useState(3);
  const [mode,setMode]=useState("balanced");
  const [teams,setTeams]=useState([]);
  const [selectedIds,setSelectedIds]=useState(availablePlayers.filter(p=>p.active).map(p=>p.id));

  const selected=availablePlayers.filter(p=>selectedIds.includes(p.id));

  const togglePlayer=(id)=>setSelectedIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  const generate=()=>setTeams(buildTeams(selected,perTeam,mode));

  const modeBtn=(key,label,desc)=>(
    <button onClick={()=>setMode(key)} style={{flex:1,padding:"8px 10px",borderRadius:8,border:`2px solid ${mode===key?C.primary:C.border}`,background:mode===key?C.accentL:"white",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
      <div style={{fontWeight:700,fontSize:13,color:mode===key?C.primary:C.text}}>{label}</div>
      <div style={{fontSize:11,color:C.muted}}>{desc}</div>
    </button>
  );

  return (
    <div>
      {/* Player selection */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>Spieler auswählen ({selected.length})</label>
          <div style={{display:"flex",gap:6}}>
            <Btn sm variant="secondary" onClick={()=>setSelectedIds(availablePlayers.filter(p=>p.active).map(p=>p.id))}>Alle aktiven</Btn>
            <Btn sm variant="secondary" onClick={()=>setSelectedIds([])}>Keine</Btn>
          </div>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:10,background:"#f8fafc",borderRadius:8,border:`1.5px solid ${C.border}`}}>
          {availablePlayers.map(p=>(
            <button key={p.id} onClick={()=>togglePlayer(p.id)}
              style={{padding:"4px 12px",borderRadius:20,border:`2px solid ${selectedIds.includes(p.id)?STR[p.strength].color:C.border}`,
              background:selectedIds.includes(p.id)?STR[p.strength].light:"white",
              color:selectedIds.includes(p.id)?STR[p.strength].color:C.muted,
              cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>
              {STR[p.strength].emoji} {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Config */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12,marginBottom:14}}>
        <div>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Spieler / Team</label>
          <input type="number" value={perTeam} onChange={e=>setPerTeam(Number(e.target.value))} min={2} max={8}
            style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:15,fontWeight:700,textAlign:"center",outline:"none",boxSizing:"border-box"}} />
          <div style={{fontSize:11,color:C.muted,marginTop:4}}>→ {Math.floor(selected.length/perTeam)} Teams, {selected.length%perTeam} übrig</div>
        </div>
        <div>
          <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Modus</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {modeBtn("balanced","⚖️ Ausgeglichen","Stärken gleichmäßig verteilt")}
            {modeBtn("mixed","🎨 Durchmischt","Jedes Team hat alle Level")}
            {modeBtn("challenge","⚡ Herausforderung","Stark vs. Schwach")}
            {modeBtn("random","🎲 Zufällig","Komplett zufällig")}
          </div>
        </div>
      </div>

      <Btn onClick={generate} style={{width:"100%",justifyContent:"center",marginBottom:16}}>
        <Shuffle size={16}/> Teams generieren
      </Btn>

      {/* Teams */}
      {teams.length>0&&(
        <div>
          <Divider />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
            {teams.map((team,i)=>(
              <div key={team.id} style={{background:C.card,borderRadius:10,border:`2px solid ${C.accent}`,padding:"12px 14px"}}>
                <div style={{fontWeight:800,fontSize:14,color:C.primary,marginBottom:8}}>{team.name}</div>
                {team.players.map(p=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}>
                    <span style={{fontSize:14}}>{STR[p.strength].emoji}</span>
                    <span style={{fontSize:13,fontWeight:600,color:C.text}}>{p.name}</span>
                  </div>
                ))}
                <div style={{fontSize:11,color:C.muted,marginTop:6}}>Ø {(team.players.reduce((s,p)=>s+p.strength,0)/team.players.length||0).toFixed(1)} Stärke</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
            <Btn onClick={()=>onSaveTeams(teams)}><Star size={14}/> Teams übernehmen</Btn>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        <Btn onClick={onClose} variant="secondary">Schließen</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SESSION FORM
// ─────────────────────────────────────────────────────────────────
function SessionForm({session, players, coaches, exercises, onSave, onClose}) {
  const [form,setForm]=useState({
    date:todayISO(),duration:60,location:"",weather:"",
    coachIds:[],playerIds:[],exerciseIds:[],teams:[],notes:"",
    ...session
  });
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const toggleArr=(k,id)=>set(k,form[k].includes(id)?form[k].filter(x=>x!==id):[...form[k],id]);

  const selectAll=()=>set("playerIds",players.filter(p=>p.active).map(p=>p.id));
  const clearAll=()=>set("playerIds",[]);

  const handleSave=()=>{ onSave({...form,id:form.id||uid(),createdAt:form.createdAt||now()}); };

  const multiSelect=(items,selectedIds,toggle,label,renderItem)=>(
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.6}}>{label}</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:10,background:"#f8fafc",borderRadius:8,border:`1.5px solid ${C.border}`,maxHeight:120,overflowY:"auto"}}>
        {items.map(item=>(
          <button key={item.id} onClick={()=>toggle(item.id)}
            style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${selectedIds.includes(item.id)?C.primary:C.border}`,background:selectedIds.includes(item.id)?C.accentL:"white",color:selectedIds.includes(item.id)?C.primary:C.muted,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>
            {renderItem(item)}
          </button>
        ))}
        {items.length===0&&<span style={{color:C.muted,fontSize:13}}>Keine vorhanden</span>}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Inp label="Datum" type="date" value={form.date} onChange={e=>set("date",e.target.value)} />
        <Inp label="Dauer (Min)" type="number" value={form.duration} onChange={e=>set("duration",Number(e.target.value))} min={15} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Inp label="Ort" value={form.location} onChange={e=>set("location",e.target.value)} placeholder="Sportplatz..." />
        <Inp label="Wetter" value={form.weather} onChange={e=>set("weather",e.target.value)} placeholder="Sonnig, 18°C..." />
      </div>

      {multiSelect(coaches.filter(c=>c.active),form.coachIds,(id)=>toggleArr("coachIds",id),"Trainer",c=>`${ROLES[c.role][0]}. ${c.name}`)}

      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>Spieler anwesend ({form.playerIds.length})</label>
          <div style={{display:"flex",gap:6}}>
            <Btn sm variant="secondary" onClick={selectAll}>Alle</Btn>
            <Btn sm variant="secondary" onClick={clearAll}>Keine</Btn>
          </div>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:10,background:"#f8fafc",borderRadius:8,border:`1.5px solid ${C.border}`,maxHeight:130,overflowY:"auto"}}>
          {players.filter(p=>p.active).map(p=>(
            <button key={p.id} onClick={()=>toggleArr("playerIds",p.id)}
              style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${form.playerIds.includes(p.id)?STR[p.strength].color:C.border}`,background:form.playerIds.includes(p.id)?STR[p.strength].light:"white",color:form.playerIds.includes(p.id)?STR[p.strength].color:C.muted,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>
              {STR[p.strength].emoji} {p.name}
            </button>
          ))}
        </div>
      </div>

      {multiSelect(exercises,form.exerciseIds,(id)=>toggleArr("exerciseIds",id),"Verwendete Übungen",e=>`${CATS[e.category]?.emoji} ${e.title}`)}

      <Txta label="Notizen" value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Wie lief das Training? Besonderheiten..." rows={3} />

      <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:`1px solid ${C.border}`}}>
        <Btn onClick={onClose} variant="secondary">Abbrechen</Btn>
        <Btn onClick={handleSave}>{session?.id?"Speichern":"Erstellen"}</Btn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TRAINING PAGE
// ─────────────────────────────────────────────────────────────────
function TrainingPage({sessions, players, coaches, exercises, onSaveSession, onDeleteSession}) {
  const [tab,setTab]=useState("history");
  const [modal,setModal]=useState(null);

  const sorted=[...sessions].sort((a,b)=>new Date(b.date)-new Date(a.date));

  const getPlayer=(id)=>players.find(p=>p.id===id);
  const getCoach=(id)=>coaches.find(c=>c.id===id);
  const getExercise=(id)=>exercises.find(e=>e.id===id);

  const tabBtn=(key,label)=>(
    <button onClick={()=>setTab(key)} style={{padding:"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"inherit",background:tab===key?C.primary:"transparent",color:tab===key?"white":C.muted}}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Training</h1>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>{sessions.length} Einheiten gesamt</div>
        </div>
        <Btn onClick={()=>setModal({type:"session",data:null})}><Plus size={16}/> Neues Training</Btn>
      </div>

      <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:10,padding:4,marginBottom:20,width:"fit-content"}}>
        {tabBtn("history","Verlauf")}
        {tabBtn("teams","Teambildung")}
      </div>

      {tab==="history"&&(
        <div>
          {sorted.length===0
            ?<EmptyState icon="📅" title="Noch kein Training" sub="Plane deine erste Einheit." onAdd={()=>setModal({type:"session",data:null})} addLabel="Training planen" />
            :<div style={{display:"flex",flexDirection:"column",gap:12}}>
              {sorted.map(s=>{
                const present=s.playerIds?.map(getPlayer).filter(Boolean)||[];
                const trainers=s.coachIds?.map(getCoach).filter(Boolean)||[];
                const exUsed=s.exerciseIds?.map(getExercise).filter(Boolean)||[];
                return (
                  <div key={s.id} style={{background:C.card,borderRadius:12,border:`1.5px solid ${C.border}`,padding:"16px 20px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontWeight:800,fontSize:16,color:C.text}}>{fmtDate(s.date)}</div>
                        <div style={{display:"flex",gap:12,color:C.muted,fontSize:13,marginTop:4,flexWrap:"wrap"}}>
                          <span>⏱ {s.duration} Min</span>
                          {s.location&&<span>📍 {s.location}</span>}
                          {s.weather&&<span>🌤 {s.weather}</span>}
                          <span>👥 {present.length} Kinder</span>
                          {trainers.length>0&&<span>🧑‍🏫 {trainers.map(c=>c.name).join(", ")}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <Btn sm variant="secondary" onClick={()=>setModal({type:"teamBuilder",data:{session:s,players:present}})}>
                          <Shuffle size={13}/> Teams
                        </Btn>
                        <Btn sm variant="secondary" onClick={()=>setModal({type:"session",data:s})}><Edit2 size={13}/></Btn>
                        <Btn sm variant="danger" onClick={()=>onDeleteSession(s.id)}><Trash2 size={13}/></Btn>
                      </div>
                    </div>

                    {present.length>0&&(
                      <div style={{marginTop:10}}>
                        <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Anwesend</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                          {present.map(p=><span key={p.id} style={{fontSize:12,padding:"2px 8px",borderRadius:20,background:STR[p.strength].light,color:STR[p.strength].color,fontWeight:600}}>{STR[p.strength].emoji} {p.name}</span>)}
                        </div>
                      </div>
                    )}

                    {exUsed.length>0&&(
                      <div style={{marginTop:10}}>
                        <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Übungen</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                          {exUsed.map(e=><span key={e.id} style={{fontSize:12,padding:"2px 8px",borderRadius:20,background:"#f1f5f9",color:C.muted,fontWeight:600}}>{CATS[e.category]?.emoji} {e.title}</span>)}
                        </div>
                      </div>
                    )}

                    {s.teams?.length>0&&(
                      <div style={{marginTop:10}}>
                        <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Teams</div>
                        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                          {s.teams.map(t=>(
                            <div key={t.id} style={{padding:"6px 12px",borderRadius:8,background:C.accentL,border:`1px solid ${C.accent}`}}>
                              <div style={{fontSize:12,fontWeight:700,color:C.primary,marginBottom:2}}>{t.name}</div>
                              <div style={{fontSize:11,color:C.muted}}>{t.players.map(p=>p.name).join(", ")}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {s.notes&&<div style={{marginTop:10,fontSize:13,color:C.muted,fontStyle:"italic"}}>💬 {s.notes}</div>}
                  </div>
                );
              })}
            </div>
          }
        </div>
      )}

      {tab==="teams"&&(
        <div>
          <div style={{background:C.card,borderRadius:12,border:`1.5px solid ${C.border}`,padding:20}}>
            <h2 style={{margin:"0 0 6px",fontSize:18,fontWeight:800,color:C.text}}>Schnelle Teambildung</h2>
            <p style={{margin:"0 0 16px",color:C.muted,fontSize:14}}>Bilde direkt Teams aus deinen aktiven Spielern, ohne ein Training zu protokollieren.</p>
            <Btn onClick={()=>setModal({type:"teamBuilder",data:{session:null,players:players.filter(p=>p.active)}})}>
              <Shuffle size={16}/> Teams zusammenstellen
            </Btn>
          </div>
        </div>
      )}

      {modal?.type==="session"&&(
        <Modal title={modal.data?"Training bearbeiten":"Neues Training"} onClose={()=>setModal(null)} wide>
          <SessionForm session={modal.data} players={players} coaches={coaches} exercises={exercises}
            onSave={(s)=>{onSaveSession(s);setModal(null);}} onClose={()=>setModal(null)} />
        </Modal>
      )}

      {modal?.type==="teamBuilder"&&(
        <Modal title="Teambildung" onClose={()=>setModal(null)} wide>
          <TeamBuilderModal availablePlayers={modal.data.players.length?modal.data.players:players.filter(p=>p.active)}
            onSaveTeams={(teams)=>{
              if(modal.data.session) {
                const updated={...modal.data.session,teams};
                onSaveSession(updated);
              }
              setModal(null);
            }}
            onClose={()=>setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────
function SettingsPage({exercises, players, coaches, sessions, onImport, toast}) {
  const importRef=useRef();
  const [importMode,setImportMode]=useState("merge");

  const handleExportAll=()=>{
    dlJson({
      version:APP_VERSION, exportDate:new Date().toISOString(), type:"full",
      exercises, players, coaches, sessions
    }, `gjugend_backup_${todayISO()}.json`);
    toast("Vollständiges Backup exportiert");
  };

  const handleExportTeam=()=>{
    dlJson({
      version:APP_VERSION, exportDate:new Date().toISOString(), type:"team",
      players, coaches
    }, `gjugend_team_${todayISO()}.json`);
    toast("Team exportiert");
  };

  const handleExportExercises=()=>{
    dlJson({
      version:APP_VERSION, exportDate:new Date().toISOString(), type:"exercises",
      exercises
    }, `gjugend_uebungen_${todayISO()}.json`);
    toast("Übungen exportiert");
  };

  const handleExportPlayersCsv=()=>{
    dlCsv(players,["name","birthYear","strength","active","jersey","notes"],`gjugend_spieler_${todayISO()}.csv`);
    toast("Spieler als CSV exportiert");
  };

  const handleImport=async(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    try{
      let data;
      if(file.name.endsWith(".csv")) {
        const text=await readText(file);
        const newPlayers=parseCsvPlayers(text);
        onImport({players:newPlayers},importMode==="replace"?"replace_players":"merge_players");
        toast(`${newPlayers.length} Spieler importiert`);
      } else {
        const text=await readText(file);
        data=JSON.parse(text);
        onImport(data,importMode);
        toast("Import erfolgreich");
      }
    }catch(err){
      toast("Import fehlgeschlagen: "+err.message,"err");
    }
    e.target.value="";
  };

  const Section=({title,children})=>(
    <div style={{marginBottom:28}}>
      <h2 style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:14,paddingBottom:8,borderBottom:`2px solid ${C.accentL}`}}>{title}</h2>
      {children}
    </div>
  );

  const ExportCard=({icon,title,desc,onClick,sub})=>(
    <div style={{background:C.card,borderRadius:10,border:`1.5px solid ${C.border}`,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
      <div>
        <div style={{fontWeight:700,fontSize:14,color:C.text}}>{icon} {title}</div>
        <div style={{fontSize:12,color:C.muted,marginTop:2}}>{desc}</div>
        {sub&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{sub}</div>}
      </div>
      <Btn sm onClick={onClick}><Download size={13}/> Exportieren</Btn>
    </div>
  );

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Einstellungen</h1>
        <div style={{fontSize:13,color:C.muted,marginTop:2}}>{APP_NAME} · Version {APP_VERSION}</div>
      </div>

      <Section title="📤 Exportieren">
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <ExportCard icon="💾" title="Vollständiges Backup" desc="Alle Daten: Übungen, Spieler, Trainer, Trainingsverlauf" sub={`${exercises.length} Übungen · ${players.length} Spieler · ${sessions.length} Trainings`} onClick={handleExportAll} />
          <ExportCard icon="📚" title="Nur Übungen" desc="Bibliothek exportieren – ideal zum Teilen mit anderen Trainern" sub={`${exercises.length} Übungen`} onClick={handleExportExercises} />
          <ExportCard icon="👥" title="Team (JSON)" desc="Spieler & Trainer als JSON" sub={`${players.length} Spieler · ${coaches.length} Trainer`} onClick={handleExportTeam} />
          <ExportCard icon="📊" title="Spieler (CSV)" desc="Spielerliste als CSV für Excel & Google Sheets" sub={`${players.length} Spieler`} onClick={handleExportPlayersCsv} />
        </div>
      </Section>

      <Section title="📥 Importieren">
        <div style={{background:C.card,borderRadius:10,border:`1.5px solid ${C.border}`,padding:"16px 18px"}}>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6,display:"block",marginBottom:6}}>Import-Modus</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[["merge","Zusammenführen (empfohlen)"],["replace","Ersetzen (Vorsicht!)"]].map(([k,l])=>(
                <button key={k} onClick={()=>setImportMode(k)}
                  style={{padding:"6px 14px",borderRadius:8,border:`2px solid ${importMode===k?C.primary:C.border}`,background:importMode===k?C.accentL:"white",color:importMode===k?C.primary:C.muted,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:6}}>
              {importMode==="merge"?"Neue Einträge werden hinzugefügt, bestehende bleiben erhalten.":"⚠️ Alle bestehenden Daten werden durch den Import ersetzt."}
            </div>
          </div>
          <div style={{background:"#f8fafc",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:C.muted}}>
            <strong>Unterstützte Formate:</strong><br/>
            · JSON Backup (vollständig oder Teilexporte)<br/>
            · CSV (Spieler: name, birthYear, strength, active, jersey, notes)
          </div>
          <Btn onClick={()=>importRef.current.click()}><Upload size={14}/> Datei auswählen</Btn>
          <input ref={importRef} type="file" accept=".json,.csv" onChange={handleImport} style={{display:"none"}} />
        </div>
      </Section>

      <Section title="🤖 KI-Integration (Build 2)">
        <div style={{background:"#f8fafc",borderRadius:10,border:`1.5px dashed ${C.border}`,padding:"16px 18px",opacity:.6}}>
          <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:4}}>Claude API Key</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:10}}>Für KI-gestützte Trainingsplanung und automatischen Übungsimport aus Texten/PDFs. Kommt in Build 2.</div>
          <input disabled placeholder="sk-ant-..." style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:8,fontSize:14,background:"white",outline:"none",boxSizing:"border-box",color:"#94a3b8"}} />
        </div>
      </Section>

      <div style={{textAlign:"center",padding:"20px 0",color:"#cbd5e1",fontSize:12}}>
        {APP_NAME} v{APP_VERSION} · Made with ⚽ for G-Jugend Trainer
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────
function Nav({page, setPage, counts}) {
  const items=[
    {key:"library", icon:BookOpen, label:"Bibliothek", count:counts.exercises},
    {key:"team",    icon:Users,    label:"Team",        count:counts.players},
    {key:"training",icon:CalendarDays,label:"Training", count:counts.sessions},
    {key:"settings",icon:Settings, label:"Einstellungen"},
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <div style={{position:"fixed",left:0,top:0,bottom:0,width:200,background:C.nav,display:"flex",flexDirection:"column",zIndex:100,padding:"0 12px 20px"}}>
        <div style={{padding:"24px 8px 20px",borderBottom:"1px solid rgba(255,255,255,.1)",marginBottom:12}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,.4)",letterSpacing:2,fontWeight:700}}>G-JUGEND</div>
          <div style={{fontSize:18,fontWeight:900,color:"white",marginTop:2}}>⚽ Coach</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:2}}>v{APP_VERSION}</div>
        </div>
        {items.map(({key,icon:Icon,label,count})=>(
          <button key={key} onClick={()=>setPage(key)}
            style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",marginBottom:4,width:"100%",textAlign:"left",fontFamily:"inherit",
              background:page===key?"rgba(34,197,94,.2)":"transparent",color:page===key?"#4ade80":"rgba(255,255,255,.6)",transition:"all .15s"}}>
            <Icon size={18} strokeWidth={page===key?2.5:1.8} />
            <span style={{fontSize:14,fontWeight:700,flex:1}}>{label}</span>
            {count!==undefined&&<span style={{fontSize:11,background:"rgba(255,255,255,.1)",borderRadius:20,padding:"1px 7px",color:"rgba(255,255,255,.5)"}}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Mobile bottom nav */}
      <style>{`
        @media(max-width:600px){
          .desktop-nav{display:none!important}
          .mobile-nav{display:flex!important}
          .main-content{margin-left:0!important;padding-bottom:72px!important}
        }
        @media(min-width:601px){.mobile-nav{display:none!important}}
      `}</style>
      <div className="desktop-nav" />
      <div className="mobile-nav" style={{display:"none",position:"fixed",bottom:0,left:0,right:0,background:C.nav,zIndex:100,borderTop:"1px solid rgba(255,255,255,.1)"}}>
        {items.map(({key,icon:Icon,label})=>(
          <button key={key} onClick={()=>setPage(key)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"10px 4px",border:"none",cursor:"pointer",background:"transparent",color:page===key?"#4ade80":"rgba(255,255,255,.5)",fontFamily:"inherit"}}>
            <Icon size={20} strokeWidth={page===key?2.5:1.8} />
            <span style={{fontSize:10,fontWeight:700}}>{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("library");
  const [exercises, setExercises, exReady] = useStorage("exercises", []);
  const [players,   setPlayers,   plReady] = useStorage("players",   []);
  const [coaches,   setCoaches,   coReady] = useStorage("coaches",   []);
  const [sessions,  setSessions,  seReady] = useStorage("sessions",  []);
  const {toast, Toasts} = useToast();

  const ready = exReady && plReady && coReady && seReady;

  // ── Exercise handlers
  const saveExercise=(ex)=>{
    const exists=exercises.find(e=>e.id===ex.id);
    if(exists) { setExercises(exercises.map(e=>e.id===ex.id?ex:e)); toast("Übung gespeichert"); }
    else        { setExercises([...exercises,ex]); toast("Übung erstellt"); }
  };
  const deleteExercise=(id)=>{ setExercises(exercises.filter(e=>e.id!==id)); toast("Übung gelöscht"); };

  // ── Player handlers
  const savePlayer=(p)=>{
    const exists=players.find(x=>x.id===p.id);
    if(exists) { setPlayers(players.map(x=>x.id===p.id?p:x)); toast("Spieler gespeichert"); }
    else        { setPlayers([...players,p]); toast("Spieler hinzugefügt"); }
  };
  const deletePlayer=(id)=>{ setPlayers(players.filter(p=>p.id!==id)); toast("Spieler gelöscht"); };

  // ── Coach handlers
  const saveCoach=(c)=>{
    const exists=coaches.find(x=>x.id===c.id);
    if(exists) { setCoaches(coaches.map(x=>x.id===c.id?c:x)); toast("Trainer gespeichert"); }
    else        { setCoaches([...coaches,c]); toast("Trainer hinzugefügt"); }
  };
  const deleteCoach=(id)=>{ setCoaches(coaches.filter(c=>c.id!==id)); toast("Trainer gelöscht"); };

  // ── Session handlers
  const saveSession=(s)=>{
    const exists=sessions.find(x=>x.id===s.id);
    if(exists) { setSessions(sessions.map(x=>x.id===s.id?s:x)); toast("Training gespeichert"); }
    else        { setSessions([...sessions,s]); toast("Training protokolliert"); }
  };
  const deleteSession=(id)=>{ setSessions(sessions.filter(s=>s.id!==id)); toast("Training gelöscht"); };

  // ── Import handler
  const handleImport=(data, mode)=>{
    if(mode==="merge"||!mode) {
      const mergeArr=(existing,incoming,key="id")=>{
        const map=Object.fromEntries(existing.map(e=>[e[key],e]));
        incoming?.forEach(item=>{ if(!map[item[key]]) map[item[key]]=item; });
        return Object.values(map);
      };
      if(data.exercises) setExercises(mergeArr(exercises,data.exercises));
      if(data.players)   setPlayers(mergeArr(players,data.players));
      if(data.coaches)   setCoaches(mergeArr(coaches,data.coaches));
      if(data.sessions)  setSessions(mergeArr(sessions,data.sessions));
    } else if(mode==="replace") {
      if(data.exercises) setExercises(data.exercises);
      if(data.players)   setPlayers(data.players);
      if(data.coaches)   setCoaches(data.coaches);
      if(data.sessions)  setSessions(data.sessions);
    } else if(mode==="merge_players") {
      const map=Object.fromEntries(players.map(p=>[p.id,p]));
      data.players?.forEach(p=>{ if(!map[p.id]) map[p.id]=p; });
      setPlayers(Object.values(map));
    } else if(mode==="replace_players") {
      setPlayers(data.players||[]);
    }
  };

  if(!ready) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,fontFamily:"system-ui"}}>
      <div style={{textAlign:"center",color:C.muted}}>
        <div style={{fontSize:40,marginBottom:12}}>⚽</div>
        <div style={{fontWeight:700}}>Lade Daten...</div>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"system-ui,-apple-system,sans-serif",background:C.bg,minHeight:"100vh"}}>
      <style>{`
        *{box-sizing:border-box}
        body{margin:0}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
      `}</style>

      <Toasts />
      <Nav page={page} setPage={setPage} counts={{exercises:exercises.length, players:players.filter(p=>p.active).length, sessions:sessions.length}} />

      <main className="main-content" style={{marginLeft:200,padding:28,maxWidth:1100}}>
        {page==="library"  && <LibraryPage exercises={exercises} onSave={saveExercise} onDelete={deleteExercise} />}
        {page==="team"     && <TeamPage players={players} coaches={coaches} onSavePlayer={savePlayer} onDeletePlayer={deletePlayer} onSaveCoach={saveCoach} onDeleteCoach={deleteCoach} />}
        {page==="training" && <TrainingPage sessions={sessions} players={players} coaches={coaches} exercises={exercises} onSaveSession={saveSession} onDeleteSession={deleteSession} />}
        {page==="settings" && <SettingsPage exercises={exercises} players={players} coaches={coaches} sessions={sessions} onImport={handleImport} toast={toast} />}
      </main>
    </div>
  );
}
