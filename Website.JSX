import { useState, useEffect, useRef, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── LOAD EXTERNAL ASSETS ─────────────────────────────────────────────────────
function useLeaflet(onReady) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Load CSS
    if (!document.getElementById("lf-css")) {
      const l = document.createElement("link");
      l.id = "lf-css"; l.rel = "stylesheet";
      l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(l);
    }
    // Load JS
    if (window.L) { setReady(true); return; }
    if (document.getElementById("lf-js")) return;
    const s = document.createElement("script");
    s.id = "lf-js";
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  useEffect(() => { if (ready && onReady) onReady(); }, [ready]);
  return ready;
}

function useFonts() {
  useEffect(() => {
    if (document.getElementById("gf-axis")) return;
    const l = document.createElement("link");
    l.id = "gf-axis"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&family=Barlow:wght@400;500&display=swap";
    document.head.appendChild(l);
  }, []);
}

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#05080f", surface:"#090e1a", card:"#0d1422", border:"#162236",
  borderBright:"#1e3050", text:"#c8d8ea", muted:"#4a6280", bright:"#e8f2ff",
  iran:"#f97316", coalition:"#3b82f6", critical:"#ef4444", major:"#f97316", minor:"#eab308",
};
const strikerColor = s => s === "Iran" ? C.iran : s === "US/Israel" ? C.coalition : C.muted;
const sevColor = s => s === 3 ? C.critical : s === 2 ? C.major : C.minor;
const sevLabel = s => s === 3 ? "CRITICAL" : s === 2 ? "MAJOR" : "MINOR";
const fmtDate = d => { const [y,m,day] = d.split("-"); return new Date(y,m-1,day).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };

// ─── ATTACK DATA ──────────────────────────────────────────────────────────────
// docUrl: paste your Google Doc "share" link here for each attack.
// Leave as null if no article yet — the button won't appear.
// To get your Google Doc URL: File → Share → Copy link (set to "Anyone with link can view")
const ATTACKS = [
  {
    id:"ras-tanura-refinery", shortName:"Ras Tanura Refinery", name:"Ras Tanura Oil Refinery",
    date:"2026-03-02", time:"~00:00 PST", country:"Saudi Arabia", countryCode:"KSA",
    lat:26.71, lng:50.02,
    striker:"Iran", weapon:"Shahed-136 drone", targetType:"Refinery",
    operator:"Saudi Aramco", capacity:"550,000 bpd",
    status:"Minor damage — ops stopped", casualties:"None reported",
    confirmed:true, severity:3,
    docUrl: null, // ← paste Google Doc URL here
    summary:"Iranian Shahed-136 drones struck Saudi Aramco's Ras Tanura refinery on March 2 at approximately 00:00 PST, triggering a fire. Aramco halted all operations. It remains unclear whether the strike damaged refining infrastructure, export infrastructure, or both.\n\nRas Tanura's refinery processes 550,000 barrels per day. The Eastern Province hosts the world's most concentrated oil infrastructure cluster.",
    sources:[
      {title:"Reuters: Saudi Aramco shuts Ras Tanura refinery after drone strike", url:"https://www.reuters.com/business/energy/saudi-aramco-shuts-ras-tanura-refinery-after-drone-strike-sources"},
      {title:"The National: Aramco shuts Ras Tanura following drone attack", url:"https://www.thenationalnews.com/business/2026/03/02/saudi-aramco-shuts-down-ras-tanura-refinery-following-drone-attack/"},
    ]
  },
  {
    id:"ras-tanura-terminal", shortName:"Ras Tanura Export Terminal", name:"Ras Tanura Oil Export Terminal",
    date:"2026-03-02", time:"~00:00 PST", country:"Saudi Arabia", countryCode:"KSA",
    lat:26.688, lng:50.038,
    striker:"Iran", weapon:"Shahed-136 drone", targetType:"Export Terminal",
    operator:"Saudi Aramco", capacity:"6,000,000 bpd capacity — 7% of world oil demand; 90% of KSA hydrocarbon exports",
    status:"Minor damage — ops stopped", casualties:"None reported",
    confirmed:true, severity:3,
    docUrl: null,
    summary:"The Ras Tanura export terminal — one of the world's largest crude export terminals — was targeted in the same barrage. It handles approximately 90% of Saudi Arabia's hydrocarbon exports and ~7% of total global oil demand. Any prolonged shutdown cascades immediately into Asian supply chains.",
    sources:[
      {title:"Reuters: Saudi Aramco shuts Ras Tanura", url:"https://www.reuters.com/business/energy/saudi-aramco-shuts-ras-tanura-refinery-after-drone-strike-sources"},
    ]
  },
  {
    id:"ahvaz-pipeline", shortName:"Ahvaz Oil Pipeline", name:"Ahvaz Oil Pipeline, Khuzestan Province",
    date:"2026-03-02", time:"00:20 PST", country:"Iran", countryCode:"IRAN",
    lat:31.32, lng:48.67,
    striker:"US/Israel", weapon:"Coalition airstrike", targetType:"Pipeline",
    operator:"NIOC", capacity:"94,000–750,000 bpd (range est.)",
    status:"On fire — ops stopped", casualties:"Unknown",
    confirmed:true, severity:3,
    docUrl: null,
    summary:"The Ahvaz oil pipeline in Iran's Khuzestan province was struck at approximately 00:20 PST on March 2. Multiple sources confirmed the pipeline was on fire following a series of attacks. Khuzestan is Iran's primary oil-producing province.\n\nVideo footage confirmed large fires. The pipeline capacity range reflects uncertainty about which segment was targeted.",
    sources:[
      {title:"MilitaryNewsUA / X: Ahvaz oil pipeline on fire", url:"https://x.com"},
      {title:"Business Upturn: Ahwaz oil pipeline reportedly struck", url:"https://www.businessupturn.com/world/ahwaz-oil-pipeline-reportedly-struck-in-suspected-u-s-airstrike/"},
    ]
  },
  {
    id:"mina-ahmadi", shortName:"Mina al-Ahmadi Refinery", name:"Mina al-Ahmadi Refinery, Kuwait",
    date:"2026-03-02", time:"13:29 PST", country:"Kuwait", countryCode:"KUW",
    lat:29.069, lng:48.143,
    striker:"Iran", weapon:"Falling debris from interception", targetType:"Refinery",
    operator:"Kuwait National Petroleum Company (KNPC)", capacity:"346,000 bpd",
    status:"No damage — ops unaffected", casualties:"2 workers injured (shrapnel)",
    confirmed:true, severity:1,
    docUrl: null,
    summary:"The Mina al-Ahmadi refinery was struck by falling debris from the interception of Iranian missiles on March 2 at 13:29 PST. Two workers were injured by shrapnel. Operations continued normally — no production disruption. Mina al-Ahmadi is Kuwait's primary refinery.",
    sources:[
      {title:"UNN: Kuwaiti refinery hit by debris", url:"https://unn.ua/en/news/saudi-aramco-refinery-in-saudi-arabia-hit-by-suspected-drone-strike-kuwaiti-refinery-by-debris-media"},
    ]
  },
  {
    id:"juaymah-lpg", shortName:"Juaymah LPG Terminal", name:"Juaymah LPG Export Terminal",
    date:"2026-02-23", time:"—", country:"Saudi Arabia", countryCode:"KSA",
    lat:26.774, lng:49.98,
    striker:"Unknown", weapon:"Structural damage — cause under evaluation", targetType:"Export Terminal",
    operator:"Saudi Aramco", capacity:"450,000+ tons/month LPG — world's 7th largest LPG exporter",
    status:"Major damage — ops stopped", casualties:"None",
    confirmed:true, severity:2,
    docUrl: null,
    summary:"Saudi Aramco's Juaymah LPG terminal suffered structural damage to its offshore delivery system in late February, halting all exports. India absorbs ~60% of Juaymah's exports. Up to 10 March delivery cargoes were cancelled (400,000+ tons).",
    sources:[
      {title:"Reuters: Aramco halts Juaymah LPG exports", url:"https://www.reuters.com"},
    ]
  },
  {
    id:"mt-skylight", shortName:"MT Skylight (tanker)", name:"Oil Tanker MT Skylight — Palau-Flagged",
    date:"2026-03-02", time:"—", country:"Oman", countryCode:"OMAN",
    lat:22.1, lng:59.4,
    striker:"US/Israel", weapon:"Likely coalition strike", targetType:"Oil Tanker",
    operator:"Unknown (accused shadow fleet)", capacity:"Crude oil tanker",
    status:"Sinking", casualties:"Unknown",
    confirmed:true, severity:2,
    docUrl: null,
    summary:"Palau-flagged MT Skylight was targeted ~5nm north of Duqm and confirmed sinking per Oman's Maritime Security Centre. Accused Iran-linked shadow fleet vessel — used to circumvent oil sanctions. First confirmed shadow fleet loss of the conflict.",
    sources:[
      {title:"Wikipedia: 2026 US-Israeli strikes on Iran", url:"https://en.wikipedia.org/wiki/2026_Israeli%E2%80%93United_States_strikes_on_Iran"},
    ]
  },
  {
    id:"mkd-vyom", shortName:"MT MKD VYOM (tanker)", name:"Product Tanker MKD VYOM — Marshall Islands-Flagged",
    date:"2026-03-02", time:"—", country:"Oman", countryCode:"OMAN",
    lat:21.75, lng:59.65,
    striker:"Unknown", weapon:"Unknown", targetType:"Product Tanker",
    operator:"Mixed crew — 5 Iranian nationals, 15 Indian nationals", capacity:"Product tanker (refined fuel)",
    status:"Major damage — ops stopped", casualties:"1 killed; 4 injured",
    confirmed:true, severity:2,
    docUrl: null,
    summary:"Marshall Islands-flagged MKD VYOM was attacked near the Oman coast. One crew member was killed and four injured. The mixed crew has diplomatic implications given India's attempts to maintain neutrality in the conflict.",
    sources:[
      {title:"The Print: Oil tanker with 15 Indian nationals attacked near Oman", url:"https://theprint.in"},
    ]
  },
  {
    id:"uae-oil-rig", shortName:"UAE Offshore Oil Rig", name:"UAE Offshore Oil Rig — Persian Gulf",
    date:"2026-03-02", time:"00:21 PST", country:"UAE", countryCode:"UAE",
    lat:24.85, lng:53.5,
    striker:"Iran", weapon:"Shahed-136 drone", targetType:"Offshore Oil Rig",
    operator:"UAE / US-linked operator (per IRGC claim)", capacity:"Unknown",
    status:"Struck", casualties:"Unknown",
    confirmed:true, severity:2,
    docUrl: null,
    summary:"A Shahed-136 drone targeted an unnamed Emirati offshore oil rig at 00:21 PST. The IRGC claimed the rig was 'operating on behalf of the United States and Israel.' The specific rig and its operator have not been publicly identified.",
    sources:[
      {title:"X: IRGC claim — Shahed-136 targeted UAE oil rig", url:"https://x.com"},
    ]
  },
  {
    id:"south-pars", shortName:"South Pars Gasfield", name:"South Pars Gasfield (Iranian Sector)",
    date:"2026-02-28", time:"—", country:"Iran", countryCode:"IRAN",
    lat:27.5, lng:52.0,
    striker:"US/Israel", weapon:"Israeli IAF airstrike", targetType:"Offshore Gasfield",
    operator:"Pars Oil and Gas Company (NIOC)", capacity:"World's largest natural gas reserve",
    status:"Struck", casualties:"Unknown",
    confirmed:true, severity:3,
    docUrl: null,
    summary:"Israel struck the Iranian sector of South Pars on February 28 as part of the opening wave of Operation Roaring Lion. South Pars is the world's largest natural gas reserve, shared with Qatar (North Dome field). Due to sanctions, Iran uses it almost entirely for domestic supply.",
    sources:[
      {title:"Al Jazeera: Iran's oil and gas sites attacked by Israel", url:"https://www.aljazeera.com/news/2025/6/17/mapping-irans-oil-and-gas-sites-and-those-attacked-by-israel"},
    ]
  },
  {
    id:"fajr-jam", shortName:"Fajr Jam Gas Plant", name:"Fajr Jam Gas Processing Plant, Bushehr Province",
    date:"2026-02-28", time:"—", country:"Iran", countryCode:"IRAN",
    lat:27.8, lng:52.6,
    striker:"US/Israel", weapon:"Israeli airstrike", targetType:"Gas Processing Plant",
    operator:"Pars Oil and Gas Company", capacity:"Major domestic gas hub — Bushehr Province",
    status:"Struck", casualties:"Unknown",
    confirmed:true, severity:2,
    docUrl: null,
    summary:"Fajr Jam gas processing plant in Bushehr province struck on February 28. Combined with South Pars, severely degrades Iran's ability to process and distribute domestic gas to southern and central regions.",
    sources:[{title:"Al Jazeera: Iran's oil and gas sites", url:"https://www.aljazeera.com/news/2025/6/17/mapping-irans-oil-and-gas-sites-and-those-attacked-by-israel"}]
  },
  {
    id:"shahr-rey", shortName:"Shahr Rey Refinery", name:"Shahr Rey Oil Refinery, Tehran",
    date:"2026-02-28", time:"—", country:"Iran", countryCode:"IRAN",
    lat:35.55, lng:51.5,
    striker:"US/Israel", weapon:"Israeli airstrike", targetType:"Refinery",
    operator:"NIOC", capacity:"Capital region crude processing",
    status:"Struck", casualties:"Unknown",
    confirmed:true, severity:2,
    docUrl: null,
    summary:"Tehran's Shahr Rey refinery struck on February 28. Part of the coordinated campaign targeting Iran's fuel supply in the capital region (16 million people).",
    sources:[{title:"Al Jazeera: Iran's oil and gas sites", url:"https://www.aljazeera.com/news/2025/6/17/mapping-irans-oil-and-gas-sites-and-those-attacked-by-israel"}]
  },
  {
    id:"shahran-depot", shortName:"Shahran Oil Depot", name:"Shahran Oil Storage Depot, Tehran",
    date:"2026-02-28", time:"—", country:"Iran", countryCode:"IRAN",
    lat:35.78, lng:51.28,
    striker:"US/Israel", weapon:"Israeli airstrike", targetType:"Oil Storage",
    operator:"NIOC", capacity:"Strategic petroleum reserve, capital region",
    status:"Struck", casualties:"Unknown",
    confirmed:true, severity:1,
    docUrl: null,
    summary:"Shahran oil storage facility northwest of Tehran struck on February 28 alongside adjacent fuel depots, degrading Tehran's strategic fuel reserves.",
    sources:[{title:"Al Jazeera: Iran's oil and gas sites", url:"https://www.aljazeera.com/news/2025/6/17/mapping-irans-oil-and-gas-sites-and-those-attacked-by-israel"}]
  },
  {
    id:"tehran-depots", shortName:"Tehran Fuel Depots", name:"Tehran Fuel Depots (Multiple)",
    date:"2026-02-28", time:"—", country:"Iran", countryCode:"IRAN",
    lat:35.7, lng:51.43,
    striker:"US/Israel", weapon:"Israeli airstrike", targetType:"Fuel Storage",
    operator:"NIOC", capacity:"Capital city fuel distribution network",
    status:"Struck", casualties:"Unknown",
    confirmed:true, severity:1,
    docUrl: null,
    summary:"Multiple fuel storage depots across Tehran struck on February 28 in coordination with the Shahran depot and Shahr Rey refinery strikes.",
    sources:[{title:"Al Jazeera: Iran's oil and gas sites", url:"https://www.aljazeera.com/news/2025/6/17/mapping-irans-oil-and-gas-sites-and-those-attacked-by-israel"}]
  },
  {
    id:"jebel-ali", shortName:"Jebel Ali Port", name:"Jebel Ali Port, Dubai",
    date:"2026-03-01", time:"—", country:"UAE", countryCode:"UAE",
    lat:25.01, lng:55.07,
    striker:"Iran", weapon:"Interceptor debris", targetType:"Commercial Port",
    operator:"DP World", capacity:"World's 9th busiest container port",
    status:"Fire at one berth — partial disruption", casualties:"None reported",
    confirmed:true, severity:1,
    docUrl: null,
    summary:"A berth at Jebel Ali caught fire from debris produced by aerial interception of Iranian missiles over Dubai. Fire was controlled; limited operational impact.",
    sources:[{title:"CNBC: US-Iran live updates", url:"https://www.cnbc.com/2026/03/01/us-iran-live-updates-khamenei-death-trump-gulf-strikes.html"}]
  },
  {
    id:"duqm-port", shortName:"Port of Duqm", name:"Port of Duqm, Oman",
    date:"2026-03-01", time:"—", country:"Oman", countryCode:"OMAN",
    lat:19.67, lng:57.71,
    striker:"Iran", weapon:"Shahed drone (×2)", targetType:"Energy Port",
    operator:"SEZAD", capacity:"Duqm Refinery 230,000 bpd; strategic naval hub",
    status:"Hit — minor damage", casualties:"1 foreign worker injured",
    confirmed:true, severity:1,
    docUrl: null,
    summary:"Two Iranian drones struck Duqm port on Oman's Arabian Sea coast. Significant because Oman has historically been Iran's diplomatic backchannel to the West — targeting it signals Iran's willingness to abandon that relationship.",
    sources:[{title:"Al Jazeera: Death toll tracker", url:"https://www.aljazeera.com/news/2026/3/1/us-israel-attacks-on-iran-death-toll-and-injuries-live-tracker"}]
  },
];

// ─── BRENT CRUDE DATA ─────────────────────────────────────────────────────────
function makeBrent() {
  const rng = n => { let x = Math.sin(n*9301+49297)*233280; return x-Math.floor(x); };
  // Year: 365 daily points, Mar 2025 → Mar 2 2026
  const yearPrices = [...Array(60)].map((_,i)=>+(73-(i*0.05)+(rng(i*3)-.5)*1.2).toFixed(2))
    .concat([...Array(20)].map((_,i)=>+(70+(rng((i+60)*5)-.5)*1).toFixed(2)))
    .concat([...Array(20)].map((_,i)=>+(67+i*.15+(rng((i+80)*7)-.5)*.8).toFixed(2)))
    // Jun 2025 twelve-day war spike
    .concat([75,77,80,82,81,79,77,75,74,73,72,71,72,73,74,73,72,71,70,71])
    .concat([...Array(120)].map((_,i)=>+(71.5+(rng((i+120)*11)-.5)*1.5).toFixed(2)))
    .concat([...Array(60)].map((_,i)=>+(72+(i*.015)+(rng((i+240)*13)-.4)*.8).toFixed(2)))
    // Feb 28 2026 escalation
    .concat([73,73.5,74,74.5,75,76,77.5,79,80,80]);
  const yDates=[]; const yStart=new Date("2025-03-02");
  for(let i=0;i<yearPrices.length;i++){const d=new Date(yStart);d.setDate(d.getDate()+i);yDates.push(d.toLocaleDateString("en-US",{month:"short",day:"numeric"}));}
  const year=yearPrices.slice(0,365).map((p,i)=>({t:yDates[i],p}));

  // Month: 30 daily Feb 1–Mar 2
  const mBase=[74,73.5,73.8,74.1,74,73.7,73.5,73.2,73,72.8,72.5,72.8,73,73.2,73.5,73.8,74,74.2,74,73.8,73.5,73.2,73,73.5,74,74.5,75,76.5,79,80];
  const month=mBase.map((p,i)=>{const d=new Date("2026-02-01");d.setDate(d.getDate()+i);return{t:d.toLocaleDateString("en-US",{month:"short",day:"numeric"}),p:+(p+(rng(i*7)-.5)*.4).toFixed(2)};});

  // 72h: hourly Mar 1 00:00 – Mar 2 23:00
  let hp=73.5; const h72=[];
  for(let i=0;i<72;i++){
    if(i===0)hp=73.5; else if(i===12)hp=75.2; else if(i===24)hp=77.8;
    else if(i===36)hp=78.5; else if(i===48)hp=79.2; else if(i===60)hp=80.1;
    else hp+=(rng(i*17)-.35)*0.35; hp=Math.max(72,Math.min(82,hp));
    const d=new Date("2026-03-01T00:00:00");d.setHours(i);
    h72.push({t:`${["Mar 1","Mar 2"][Math.floor(i/24)]} ${d.getHours().toString().padStart(2,"0")}:00`,p:+hp.toFixed(2),isEvent:i===12||i===60});
  }

  // 24h: hourly Mar 2
  let hp2=78.8; const h24=[];
  for(let i=0;i<24;i++){
    if(i===3)hp2=79.5; else if(i===6)hp2=80.2; else hp2+=(rng(i*31)-.35)*.25;
    hp2=Math.max(78,Math.min(82,hp2));
    h24.push({t:`${i.toString().padStart(2,"0")}:00`,p:+hp2.toFixed(2),isEvent:i===3||i===6});
  }

  return {year, month, h72, h24};
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function Tag({color,children}){
  return <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,padding:"2px 6px",borderRadius:2,background:`${color}22`,color,letterSpacing:1,border:`1px solid ${color}44`,display:"inline-block",lineHeight:1.4}}>{children}</span>;
}

function SectionHead({children}){
  return <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:700,letterSpacing:2,color:C.muted}}>{children}</div>;
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
function DetailPanel({attack,onClose}){
  if(!attack) return null;
  const typeColor = {
    "Refinery":"#8b5cf6","Export Terminal":"#06b6d4","Pipeline":"#10b981",
    "Oil Tanker":"#f59e0b","Product Tanker":"#f59e0b","Offshore Oil Rig":"#f97316",
    "Gas Processing Plant":"#10b981","Offshore Gasfield":"#10b981",
    "Fuel Storage":"#64748b","Oil Storage":"#64748b","Energy Port":"#06b6d4","Commercial Port":"#06b6d4",
  }[attack.targetType] || C.muted;

  return (
    <div style={{position:"fixed",top:0,right:0,width:500,height:"100vh",background:C.surface,borderLeft:`1px solid ${C.borderBright}`,zIndex:200,overflowY:"auto"}}>
      {/* Sticky header */}
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.surface,zIndex:10,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
            <Tag color={strikerColor(attack.striker)}>{attack.striker}</Tag>
            <Tag color={sevColor(attack.severity)}>{sevLabel(attack.severity)}</Tag>
            <Tag color={typeColor}>{attack.targetType}</Tag>
            {!attack.confirmed && <Tag color={C.muted}>UNCONFIRMED</Tag>}
          </div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:21,fontWeight:800,color:C.bright,lineHeight:1.2}}>{attack.name}</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.muted,marginTop:5}}>
            {attack.countryCode} · {fmtDate(attack.date)}{attack.time && attack.time !== "—" ? ` · ${attack.time}` : ""}
          </div>

          {/* Google Doc live article button */}
          {attack.docUrl && (
            <a href={attack.docUrl} target="_blank" rel="noopener noreferrer"
              style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:12,padding:"8px 14px",background:"rgba(59,130,246,0.1)",border:`1px solid ${C.coalition}66`,borderRadius:4,textDecoration:"none",color:C.coalition,fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1}}>
              <span>📄</span>
              <span>LIVE ARTICLE  ↗</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:`${C.coalition}88`,fontWeight:400}}>Google Doc</span>
            </a>
          )}
          {!attack.docUrl && (
            <div style={{marginTop:12,padding:"7px 12px",background:"rgba(74,98,128,0.1)",border:`1px dashed ${C.muted}44`,borderRadius:4,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted}}>
              NO ARTICLE YET — add docUrl in the ATTACKS data to link a Google Doc
            </div>
          )}
        </div>
        <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",borderRadius:4,padding:"4px 10px",fontSize:16,flexShrink:0}}>✕</button>
      </div>

      {/* Metadata table */}
      <div style={{margin:"16px 20px 0",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden"}}>
        {[
          ["TARGET TYPE", attack.targetType],
          ["OPERATOR",    attack.operator],
          ["CAPACITY",    attack.capacity],
          ["STATUS",      attack.status],
          ["WEAPON",      attack.weapon],
          ["CASUALTIES",  attack.casualties],
          ["COORDINATES", `${attack.lat.toFixed(4)}°N, ${attack.lng.toFixed(4)}°E`],
        ].map(([k,v],i,arr)=>(
          <div key={k} style={{display:"flex",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted,padding:"8px 12px",width:120,flexShrink:0,borderRight:`1px solid ${C.border}`,background:`${C.surface}88`}}>{k}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:"8px 12px",color:C.text,flex:1,wordBreak:"break-word"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{padding:"16px 20px"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:C.muted,marginBottom:10}}>ASSESSMENT</div>
        {attack.summary.split("\n\n").map((p,i)=>(
          <p key={i} style={{fontSize:14,lineHeight:1.72,color:C.text,margin:"0 0 12px",fontFamily:"'Barlow',sans-serif"}}>{p}</p>
        ))}
      </div>

      {/* Sources */}
      <div style={{padding:"0 20px 28px"}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:C.muted,marginBottom:10}}>SOURCES</div>
        {attack.sources.map((s,i)=>(
          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
            style={{display:"flex",alignItems:"flex-start",gap:8,padding:"9px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:4,marginBottom:6,textDecoration:"none",color:C.coalition,fontSize:12,fontFamily:"'Barlow',sans-serif",lineHeight:1.5}}>
            <span style={{flexShrink:0,marginTop:2,fontSize:10}}>↗</span><span>{s.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── ATTACK ROW ───────────────────────────────────────────────────────────────
function AttackRow({attack,onSelect,selected}){
  const [hov,setHov]=useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={()=>onSelect(attack)}
      style={{padding:"11px 16px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",transition:"background .12s",display:"flex",alignItems:"flex-start",gap:12,
        background:selected?"rgba(59,130,246,0.07)":hov?"rgba(255,255,255,0.015)":"transparent",
        borderLeft:selected?`3px solid ${C.coalition}`:"3px solid transparent"}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:sevColor(attack.severity),flexShrink:0,boxShadow:`0 0 5px ${sevColor(attack.severity)}88`,marginTop:5}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:700,color:C.bright}}>{attack.shortName}</span>
          {attack.docUrl && <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.coalition,opacity:.7}}>📄</span>}
          {!attack.confirmed && <Tag color={C.muted}>UNCONF.</Tag>}
        </div>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted,marginTop:4,display:"flex",gap:8,flexWrap:"wrap"}}>
          <span>{attack.countryCode}</span><span>·</span><span>{fmtDate(attack.date)}</span>
          {attack.time && attack.time !== "—" && <><span>·</span><span>{attack.time}</span></>}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
        <Tag color={strikerColor(attack.striker)}>{attack.striker}</Tag>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:sevColor(attack.severity)}}>{sevLabel(attack.severity)}</span>
      </div>
    </div>
  );
}

// ─── LEAFLET MAP ──────────────────────────────────────────────────────────────
// Uses real OpenStreetMap tiles via CartoDB Dark Matter (free, no API key needed).
// Dots are placed exactly by lat/lng coordinates from each attack's data fields.
// Blue = US/Israel coalition strikes. Orange/red = Iranian strikes.
function MapPanel({attacks,onSelect,selected}){
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"

  const lfReady = useLeaflet();

  // Initialize map once Leaflet loads
  useEffect(()=>{
    if(!lfReady || !mapContainerRef.current || mapRef.current) return;
    const L = window.L;
    try {
      const map = L.map(mapContainerRef.current, {
        center: [27, 51],
        zoom: 5,
        zoomControl: true,
        attributionControl: true,
      });

      // CartoDB Dark Matter tiles — dark aesthetic, free, no key required
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setStatus("ready");
    } catch(e) {
      setStatus("error");
    }
    return () => {
      if(mapRef.current){ mapRef.current.remove(); mapRef.current = null; }
    };
  }, [lfReady]);

  // Add / update markers whenever attacks or map changes
  useEffect(()=>{
    if(!mapRef.current || status !== "ready") return;
    const L = window.L;

    // Remove old markers
    Object.values(markersRef.current).forEach(m => { try{ m.remove(); }catch(e){} });
    markersRef.current = {};

    attacks.forEach(a => {
      const col = strikerColor(a.striker);
      const isSelected = selected?.id === a.id;
      const radius = (a.severity === 3 ? 11 : a.severity === 2 ? 8 : 6) * (isSelected ? 1.4 : 1);

      const marker = L.circleMarker([a.lat, a.lng], {
        radius,
        fillColor: col,
        color: "#000",
        weight: isSelected ? 3 : 1.5,
        opacity: 0.9,
        fillOpacity: a.confirmed ? 0.82 : 0.32,
        dashArray: a.confirmed ? null : "4 3",
      }).addTo(mapRef.current);

      marker.bindTooltip(
        `<div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:#e8f2ff;background:#0d1422;border:1px solid #1e3050;border-radius:4px;padding:4px 8px;">${a.shortName}<br><span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#4a6280;">${a.countryCode} · ${a.striker}</span></div>`,
        { direction:"top", offset:[0,-6], opacity:1, className:"lf-tt" }
      );
      marker.on("click", () => onSelect(a));
      markersRef.current[a.id] = marker;
    });
  }, [lfReady, status, attacks, selected]);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Map container */}
      <div style={{position:"relative",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden"}}>
        <SectionHead>
          STRIKE MAP — REAL COORDINATES &nbsp;
          <span style={{fontWeight:400,letterSpacing:0}}>
            <span style={{color:C.iran}}>●</span><span style={{fontSize:9,color:C.muted}}> IRAN &nbsp;</span>
            <span style={{color:C.coalition}}>●</span><span style={{fontSize:9,color:C.muted}}> COALITION &nbsp;</span>
            <span style={{color:C.muted,opacity:.5}}>◌</span><span style={{fontSize:9,color:C.muted}}> UNCONFIRMED</span>
          </span>
        </SectionHead>

        {/* Loading overlay */}
        {status === "loading" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:C.card,zIndex:10,gap:10}}>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.muted}}>LOADING MAP TILES…</span>
          </div>
        )}

        <div
          ref={mapContainerRef}
          style={{height:460,width:"100%"}}
        />

        {/* Leaflet tooltip custom styles */}
        <style>{`
          .lf-tt { background:transparent!important; border:none!important; box-shadow:none!important; padding:0!important; }
          .lf-tt .leaflet-tooltip-content { padding:0!important; }
          .leaflet-tooltip-top.lf-tt::before { border-top-color:#1e3050!important; }
          .leaflet-control-attribution { background:rgba(5,8,15,0.7)!important; color:#4a6280!important; font-size:9px!important; }
          .leaflet-control-attribution a { color:#3b82f6!important; }
          .leaflet-control-zoom a { background:#0d1422!important; color:#c8d8ea!important; border-color:#162236!important; }
        `}</style>
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:16,flexWrap:"wrap",padding:"2px 4px"}}>
        {[{c:C.critical,l:"CRITICAL (r=11)"},{c:C.major,l:"MAJOR (r=8)"},{c:C.minor,l:"MINOR (r=6)"}].map(({c,l})=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:c}}/><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted}}>{l}</span>
          </div>
        ))}
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted,marginLeft:"auto"}}>
          Powered by CartoDB + OpenStreetMap · Coordinates in ATTACKS data
        </div>
      </div>
    </div>
  );
}

// ─── BRENT CRUDE CHART ────────────────────────────────────────────────────────
const RANGES = [{id:"24h",l:"24H"},{id:"72h",l:"72H"},{id:"1m",l:"1M"},{id:"1y",l:"1Y"}];

function BrentChart({data}){
  const [range,setRange] = useState("72h");
  const pts = useMemo(()=> range==="24h"?data.h24:range==="72h"?data.h72:range==="1m"?data.month:data.year,[range,data]);
  const cur=pts[pts.length-1]?.p||80, prev=pts[0]?.p||73;
  const chg=+(cur-prev).toFixed(2), pct=+((chg/prev)*100).toFixed(2);
  const isUp=chg>=0;
  const minP=Math.min(...pts.map(p=>p.p)), maxP=Math.max(...pts.map(p=>p.p));

  const Tip=({active,payload})=>{
    if(!active||!payload?.length) return null;
    return <div style={{background:C.card,border:`1px solid ${C.borderBright}`,borderRadius:4,padding:"8px 12px"}}>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted}}>{payload[0]?.payload?.t}</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800,color:C.bright}}>${payload[0]?.value?.toFixed(2)}</div>
    </div>;
  };

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden",marginBottom:20}}>
      <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:C.muted,marginBottom:4}}>BRENT CRUDE — ICE FUTURES (MODELED)</div>
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:36,fontWeight:800,color:C.bright,lineHeight:1}}>${cur.toFixed(2)}</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:isUp?"#10b981":"#ef4444"}}>{isUp?"▲":"▼"} ${Math.abs(chg)} ({isUp?"+":""}{pct}%)</span>
          </div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted,marginTop:4}}>RANGE ${minP.toFixed(2)} – ${maxP.toFixed(2)}</div>
        </div>
        <div style={{display:"flex",gap:3}}>
          {RANGES.map(r=>(
            <button key={r.id} onClick={()=>setRange(r.id)}
              style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,padding:"5px 12px",border:`1px solid ${range===r.id?C.borderBright:C.border}`,borderRadius:3,background:range===r.id?C.borderBright:"transparent",color:range===r.id?C.bright:C.muted,cursor:"pointer"}}>
              {r.l}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"12px 12px 8px",height:210}}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pts} margin={{top:4,right:8,bottom:0,left:0}}>
            <defs>
              <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isUp?"#10b981":"#ef4444"} stopOpacity={0.25}/>
                <stop offset="95%" stopColor={isUp?"#10b981":"#ef4444"} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,fill:C.muted}} axisLine={{stroke:C.border}} tickLine={false} interval={range==="24h"?3:range==="72h"?11:range==="1m"?4:30}/>
            <YAxis domain={[Math.floor(minP)-1,Math.ceil(maxP)+1]} tick={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,fill:C.muted}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`} width={36}/>
            <Tooltip content={<Tip/>}/>
            <Area type="monotone" dataKey="p" stroke={isUp?"#10b981":"#ef4444"} strokeWidth={1.5} fill="url(#bg)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{padding:"4px 20px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:`${C.muted}99`}}>
        ⚠ CHART USES MODELED/SYNTHETIC DATA ANCHORED TO KNOWN EVENTS — NOT A LIVE PRICE FEED · For live data connect Alpha Vantage or Quandl API
      </div>
    </div>
  );
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────
function Timeline({attacks,onSelect,selected}){
  const sorted=[...attacks].sort((a,b)=>b.date.localeCompare(a.date)||(a.shortName.localeCompare(b.shortName)));
  return (
    <div style={{maxWidth:740,margin:"0 auto"}}>
      {sorted.map((a,i)=>(
        <div key={a.id} style={{display:"flex",gap:0}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:44,flexShrink:0}}>
            <div style={{width:11,height:11,borderRadius:"50%",background:strikerColor(a.striker),marginTop:17,flexShrink:0,boxShadow:`0 0 7px ${strikerColor(a.striker)}99`}}/>
            {i<sorted.length-1 && <div style={{width:1,flex:1,background:C.border,minHeight:20}}/>}
          </div>
          <div style={{flex:1,paddingBottom:12}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted,marginBottom:5,marginTop:14}}>
              {fmtDate(a.date).toUpperCase()}{a.time && a.time!=="—"?` · ${a.time}`:""}
            </div>
            <div onClick={()=>onSelect(a)} style={{background:selected?.id===a.id?"rgba(59,130,246,0.07)":C.card,border:`1px solid ${selected?.id===a.id?C.coalition:C.border}`,borderRadius:6,padding:"12px 15px",cursor:"pointer",transition:"border .15s"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:C.bright,marginBottom:6}}>{a.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
                <Tag color={strikerColor(a.striker)}>{a.striker}</Tag>
                <Tag color={sevColor(a.severity)}>{sevLabel(a.severity)}</Tag>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted}}>{a.countryCode} · {a.targetType}</span>
                {a.docUrl && <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.coalition}}>📄 ARTICLE</span>}
              </div>
              <p style={{fontSize:13,color:"#6a88aa",lineHeight:1.65,margin:0}}>{a.summary.split("\n\n")[0].slice(0,180)}…</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── COUNTRY VIEW ─────────────────────────────────────────────────────────────
function CountryView({attacks,onSelect,selected}){
  const countries=[...new Set(attacks.map(a=>a.countryCode))].sort();
  const [active,setActive]=useState(countries[0]);
  const filtered=attacks.filter(a=>a.countryCode===active);
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {countries.map(c=>(
          <button key={c} onClick={()=>setActive(c)}
            style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,padding:"6px 14px",border:`1px solid ${active===c?C.borderBright:C.border}`,borderRadius:4,cursor:"pointer",background:active===c?C.card:"transparent",color:active===c?C.bright:C.muted,transition:"all .15s"}}>
            {c} <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:active===c?C.coalition:C.muted}}>{attacks.filter(a=>a.countryCode===c).length}</span>
          </button>
        ))}
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6}}>
        <SectionHead>{active} — {filtered.length} INCIDENT{filtered.length!==1?"S":""}</SectionHead>
        {filtered.sort((a,b)=>b.date.localeCompare(a.date)).map(a=>(
          <AttackRow key={a.id} attack={a} onSelect={onSelect} selected={selected?.id===a.id}/>
        ))}
      </div>
    </div>
  );
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function Overview({attacks,onSelect,selected,brentData}){
  const byCt=attacks.reduce((a,x)=>{a[x.countryCode]=(a[x.countryCode]||0)+1;return a;},{});
  return (
    <div>
      <BrentChart data={brentData}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:20,alignItems:"start"}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6}}>
          <SectionHead>ALL INCIDENTS — MOST RECENT FIRST</SectionHead>
          {[...attacks].sort((a,b)=>b.date.localeCompare(a.date)||(a.shortName.localeCompare(b.shortName))).map(a=>(
            <AttackRow key={a.id} attack={a} onSelect={onSelect} selected={selected?.id===a.id}/>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6}}>
            <SectionHead>BY COUNTRY</SectionHead>
            {Object.entries(byCt).sort((a,b)=>b[1]-a[1]).map(([c,n])=>(
              <div key={c} style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:600}}>{c}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:C.bright}}>{n}</span>
              </div>
            ))}
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6}}>
            <SectionHead>BY ACTOR</SectionHead>
            {[["Iran",C.iran],["US/Israel",C.coalition],["Unknown",C.muted]].map(([s,col])=>{
              const n=attacks.filter(a=>a.striker===s).length; if(!n) return null;
              return (
                <div key={s} style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:7,height:7,borderRadius:"50%",background:col}}/><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:600}}>{s}</span></div>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:col}}>{n}</span>
                </div>
              );
            })}
          </div>
          {/* Google Doc how-to */}
          <div style={{background:"#060f1a",border:`1px solid ${C.coalition}33`,borderRadius:6,padding:"14px 16px"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:C.coalition,marginBottom:8}}>📄 HOW TO ADD GOOGLE DOC ARTICLES</div>
            <ol style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:"#6a8aaa",lineHeight:1.9,paddingLeft:16}}>
              <li>Create a Google Doc for an attack</li>
              <li>File → Share → <strong style={{color:C.text}}>Copy link</strong><br/>(set to "Anyone with link can view")</li>
              <li>Find that attack in the <code style={{background:C.card,padding:"1px 4px",borderRadius:2,color:C.coalition,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>ATTACKS</code> array in the code</li>
              <li>Replace <code style={{background:C.card,padding:"1px 4px",borderRadius:2,color:"#f59e0b",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>docUrl: null</code> with <code style={{background:C.card,padding:"1px 4px",borderRadius:2,color:"#10b981",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>docUrl: "YOUR_URL"</code></li>
            </ol>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted,marginTop:8}}>📄 icon appears in the list when an article is linked</div>
          </div>
          <div style={{background:C.card,border:`1px solid #f9731633`,borderRadius:6,padding:"14px 16px"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:C.iran,marginBottom:8}}>⚠ STRAIT OF HORMUZ</div>
            <p style={{fontSize:12,color:"#7a8fa0",lineHeight:1.65,margin:0}}>IRGC transmitting VHF: "no ship authorized to pass." ~150 vessels stalled. ~20% of global oil supply at acute risk. Kharg Island (1.5M bpd) undeclared wildcard.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App(){
  useFonts();
  const [tab,setTab] = useState("overview");
  const [selected,setSelected] = useState(null);
  const brentData = useMemo(()=>makeBrent(),[]);

  const tabs=[{id:"overview",l:"OVERVIEW"},{id:"map",l:"MAP"},{id:"timeline",l:"TIMELINE"},{id:"countries",l:"COUNTRIES"}];
  const stats=[
    {n:ATTACKS.length, l:"INCIDENTS", c:C.bright},
    {n:ATTACKS.filter(a=>a.confirmed).length, l:"CONFIRMED", c:"#10b981"},
    {n:ATTACKS.filter(a=>a.severity===3).length, l:"CRITICAL", c:C.critical},
    {n:ATTACKS.filter(a=>a.striker==="Iran").length, l:"IRAN OUTBOUND", c:C.iran},
    {n:ATTACKS.filter(a=>a.striker==="US/Israel").length, l:"COALITION ON IRAN", c:C.coalition},
    {n:ATTACKS.filter(a=>a.docUrl).length, l:"ARTICLES LINKED", c:"#8b5cf6"},
  ];

  return (
    <>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:6px;background:#090e1a} ::-webkit-scrollbar-thumb{background:#162236;border-radius:3px} a:hover{opacity:.8}`}</style>
      <div style={{fontFamily:"'Barlow',sans-serif",background:C.bg,minHeight:"100vh",color:C.text}}>

        {/* Header */}
        <div style={{borderBottom:`1px solid ${C.border}`,padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:C.bg,zIndex:100}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,letterSpacing:2,color:C.bright,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:24,height:24,background:C.iran,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>⚡</div>
              AXIS ENERGY
            </div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.muted,letterSpacing:1,marginTop:2}}>WAR INFRASTRUCTURE TRACKER · IRAN CONFLICT 2026</div>
          </div>
          <div style={{display:"flex",gap:2}}>
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:600,letterSpacing:1.5,padding:"7px 16px",border:"none",cursor:"pointer",borderRadius:3,background:tab===t.id?C.coalition:"transparent",color:tab===t.id?"#fff":C.muted,transition:"all .2s"}}>
                {t.l}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.surface}}>
          {stats.map(s=>(
            <div key={s.l} style={{padding:"10px 20px",borderRight:`1px solid ${C.border}`,flex:1}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,color:s.c,lineHeight:1.1}}>{s.n}</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted,letterSpacing:.8,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{padding:"20px 24px"}}>
          {tab==="overview" && <Overview attacks={ATTACKS} onSelect={setSelected} selected={selected} brentData={brentData}/>}
          {tab==="map" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:20,alignItems:"start"}}>
              <MapPanel attacks={ATTACKS} onSelect={setSelected} selected={selected}/>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6}}>
                <SectionHead>CLICK A MARKER FOR DETAILS</SectionHead>
                {[...ATTACKS].sort((a,b)=>b.date.localeCompare(a.date)).map(a=>(
                  <AttackRow key={a.id} attack={a} onSelect={setSelected} selected={selected?.id===a.id}/>
                ))}
              </div>
            </div>
          )}
          {tab==="timeline" && <Timeline attacks={ATTACKS} onSelect={setSelected} selected={selected}/>}
          {tab==="countries" && <CountryView attacks={ATTACKS} onSelect={setSelected} selected={selected}/>}
        </div>

        {/* Detail panel */}
        {selected && (
          <>
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:190}} onClick={()=>setSelected(null)}/>
            <DetailPanel attack={selected} onClose={()=>setSelected(null)}/>
          </>
        )}
      </div>
    </>
  );
}