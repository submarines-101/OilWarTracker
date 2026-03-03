import { useState, useEffect, useRef, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Papa from "papaparse";

// ─── LOAD EXTERNAL ASSETS ─────────────────────────────────────────────────────
function useLeaflet(onReady) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!document.getElementById("lf-css")) {
      const l = document.createElement("link");
      l.id = "lf-css"; l.rel = "stylesheet";
      l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(l);
    }
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
const strikerColor = s => s === "Iran" ? C.iran : s === "Coalition" ? C.coalition : C.muted;
const sevColor = s => s === 3 ? C.critical : s === 2 ? C.major : C.minor;
const sevLabel = s => s === 3 ? "CRITICAL" : s === 2 ? "MAJOR" : "MINOR";
const fmtDate = d => {
  if (!d) return "—";
  try { const [y,m,day] = d.split("-"); return new Date(y,m-1,day).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
  catch { return d; }
};

// ─── CSV HELPERS ──────────────────────────────────────────────────────────────
// In your CSV spreadsheet, put sources in a single cell using this format:
//   Title 1|https://url1.com||Title 2|https://url2.com
// (pipe separates title from URL, double-pipe separates each source)
function parseSourcesCSV(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.split("||")
    .map(s => {
      const [title, url] = s.trim().split("|");
      return { title: (title || "").trim(), url: (url || "").trim() };
    })
    .filter(s => s.url && s.url.startsWith("http"));
}

// Country code lookup — used when CSV has full country name but no code
const COUNTRY_CODES = {
  "Saudi Arabia":"KSA","Iran":"IRAN","Kuwait":"KUW","UAE":"UAE",
  "Oman":"OMAN","Iraq":"IRQ","Qatar":"QAT","Bahrain":"BHR","Yemen":"YEM",
  "Israel":"ISR","Syria":"SYR","Jordan":"JOR","Turkey":"TUR","Egypt":"EGY",
};

// ─── ATTACK DATA ──────────────────────────────────────────────────────────────
// docUrl: paste your Google Doc "share" link here for each attack.
// Leave as null if no article yet.
const DEFAULT_ATTACKS = [
  {
    id:"ras-tanura-refinery", shortName:"Ras Tanura Refinery", name:"Ras Tanura Oil Refinery",
    date:"2026-03-02", time:"~00:00 PST", country:"Saudi Arabia", countryCode:"KSA",
    lat:26.71, lng:50.02,
    striker:"Iran", weapon:"Shahed-136 drone", targetType:"Refinery",
    operator:"Saudi Aramco", capacity:"550,000 bpd",
    status:"Minor damage — ops stopped", casualties:"None reported",
    confirmed:true, severity:3,
    docUrl: null,
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
    striker:"Coalition", weapon:"Coalition airstrike", targetType:"Pipeline",
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
    striker:"Coalition", weapon:"Likely coalition strike", targetType:"Oil Tanker",
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
    striker:"Coalition", weapon:"Israeli IAF airstrike", targetType:"Offshore Gasfield",
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
    striker:"Coalition", weapon:"Israeli airstrike", targetType:"Gas Processing Plant",
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
    striker:"Coalition", weapon:"Israeli airstrike", targetType:"Refinery",
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
    striker:"Coalition", weapon:"Israeli airstrike", targetType:"Oil Storage",
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
    striker:"Coalition", weapon:"Israeli airstrike", targetType:"Fuel Storage",
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

// ─── MARKET DATA (SYNTHETIC FALLBACK) ─────────────────────────────────────────
function makeBrent() {
  const rng = n => { let x = Math.sin(n*9301+49297)*233280; return x-Math.floor(x); };
  const yearPrices = [...Array(60)].map((_,i)=>+(73-(i*0.05)+(rng(i*3)-.5)*1.2).toFixed(2))
    .concat([...Array(20)].map((_,i)=>+(70+(rng((i+60)*5)-.5)*1).toFixed(2)))
    .concat([...Array(20)].map((_,i)=>+(67+i*.15+(rng((i+80)*7)-.5)*.8).toFixed(2)))
    .concat([75,77,80,82,81,79,77,75,74,73,72,71,72,73,74,73,72,71,70,71])
    .concat([...Array(120)].map((_,i)=>+(71.5+(rng((i+120)*11)-.5)*1.5).toFixed(2)))
    .concat([...Array(60)].map((_,i)=>+(72+(i*.015)+(rng((i+240)*13)-.4)*.8).toFixed(2)))
    .concat([73,73.5,74,74.5,75,76,77.5,79,80,80]);
  const yDates=[]; const yStart=new Date("2025-03-02");
  for(let i=0;i<yearPrices.length;i++){const d=new Date(yStart);d.setDate(d.getDate()+i);yDates.push(d.toLocaleDateString("en-US",{month:"short",day:"numeric"}));}
  const year=yearPrices.slice(0,365).map((p,i)=>({t:yDates[i],p}));
  const mBase=[74,73.5,73.8,74.1,74,73.7,73.5,73.2,73,72.8,72.5,72.8,73,73.2,73.5,73.8,74,74.2,74,73.8,73.5,73.2,73,73.5,74,74.5,75,76.5,79,80];
  const month=mBase.map((p,i)=>{const d=new Date("2026-02-01");d.setDate(d.getDate()+i);return{t:d.toLocaleDateString("en-US",{month:"short",day:"numeric"}),p:+(p+(rng(i*7)-.5)*.4).toFixed(2)};});
  let hp=73.5; const h72=[];
  for(let i=0;i<72;i++){
    if(i===0)hp=73.5; else if(i===12)hp=75.2; else if(i===24)hp=77.8;
    else if(i===36)hp=78.5; else if(i===48)hp=79.2; else if(i===60)hp=80.1;
    else hp+=(rng(i*17)-.35)*0.35; hp=Math.max(72,Math.min(82,hp));
    const d=new Date("2026-03-01T00:00:00");d.setHours(i);
    h72.push({t:`${["Mar 1","Mar 2"][Math.floor(i/24)]} ${d.getHours().toString().padStart(2,"0")}:00`,p:+hp.toFixed(2),isEvent:i===12||i===60});
  }
  let hp2=78.8; const h24=[];
  for(let i=0;i<24;i++){
    if(i===3)hp2=79.5; else if(i===6)hp2=80.2; else hp2+=(rng(i*31)-.35)*.25;
    hp2=Math.max(78,Math.min(82,hp2));
    h24.push({t:`${i.toString().padStart(2,"0")}:00`,p:+hp2.toFixed(2),isEvent:i===3||i===6});
  }
  return {year, month, h72, h24};
}

function makeHenryHub() {
  // Synthetic Henry Hub natural gas — $/MMBtu
  const rng = n => { let x = Math.sin(n*6271+38261)*199283; return x-Math.floor(x); };
  const base = 3.2;
  const year = [...Array(365)].map((_,i) => {
    const seasonal = Math.sin((i / 365) * 2 * Math.PI) * 0.6;
    const d = new Date("2025-03-02"); d.setDate(d.getDate()+i);
    const spike = (i > 340) ? (i-340)*0.08 : 0;
    return { t: d.toLocaleDateString("en-US",{month:"short",day:"numeric"}), p: +(base + seasonal + spike + (rng(i*5)-.5)*0.3).toFixed(2) };
  });
  const month = [...Array(30)].map((_,i) => {
    const d = new Date("2026-02-01"); d.setDate(d.getDate()+i);
    return { t: d.toLocaleDateString("en-US",{month:"short",day:"numeric"}), p: +(3.8 + (i/30)*0.4 + (rng(i*7)-.5)*0.2).toFixed(2) };
  });
  const h72 = [...Array(72)].map((_,i) => {
    const d=new Date("2026-03-01T00:00:00"); d.setHours(i);
    const spike = i > 48 ? (i-48)*0.02 : 0;
    return { t:`${["Mar 1","Mar 2"][Math.floor(i/24)]} ${d.getHours().toString().padStart(2,"0")}:00`, p: +(4.1+spike+(rng(i*13)-.5)*0.15).toFixed(2) };
  });
  const h24 = [...Array(24)].map((_,i) => ({
    t:`${i.toString().padStart(2,"0")}:00`, p: +(4.3+(rng(i*17)-.5)*0.12).toFixed(2)
  }));
  return { year, month, h72, h24 };
}

// Synthetic JKM (Japan Korea Marker LNG spot) — $/MMBtu
function makeJKM() {
  const rng = n => { let x = Math.sin(n*4523+29174)*183729; return x-Math.floor(x); };
  const year = [...Array(365)].map((_,i) => {
    const seasonal = Math.sin(((i+60) / 365) * 2 * Math.PI) * 2.5;
    const d = new Date("2025-03-02"); d.setDate(d.getDate()+i);
    const spike = i > 340 ? (i-340)*0.15 : 0;
    return { t: d.toLocaleDateString("en-US",{month:"short",day:"numeric"}), p: +(11.5+seasonal+spike+(rng(i*7)-.5)*0.8).toFixed(2) };
  });
  const month = [...Array(30)].map((_,i) => {
    const d = new Date("2026-02-01"); d.setDate(d.getDate()+i);
    return { t: d.toLocaleDateString("en-US",{month:"short",day:"numeric"}), p: +(12.8+(i/30)*1.2+(rng(i*9)-.5)*0.5).toFixed(2) };
  });
  const h72 = [...Array(72)].map((_,i) => {
    const d=new Date("2026-03-01T00:00:00"); d.setHours(i);
    return { t:`${["Mar 1","Mar 2"][Math.floor(i/24)]} ${d.getHours().toString().padStart(2,"0")}:00`, p: +(14.2+(i/72)*0.8+(rng(i*11)-.5)*0.3).toFixed(2) };
  });
  const h24 = [...Array(24)].map((_,i) => ({
    t:`${i.toString().padStart(2,"0")}:00`, p: +(14.8+(rng(i*19)-.5)*0.25).toFixed(2)
  }));
  return { year, month, h72, h24 };
}

// ─── LIVE ENERGY PRICES HOOK ──────────────────────────────────────────────────
// Uses Alpha Vantage free tier — register at https://www.alphavantage.co/support/#api-key
// Free tier: 25 calls/day. Provides Brent crude and Henry Hub natural gas.
// JKM (LNG spot) requires Bloomberg/Argus subscription — shown as synthetic below.
function useLiveOilPrices(apiKey) {
  const [brent, setBrent] = useState(null);
  const [henryHub, setHenryHub] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | live | error

  useEffect(() => {
    if (!apiKey) { setStatus("idle"); return; }
    setStatus("loading");

    const RANGES_BACK = { "24h":2, "72h":4, "1m":35, "1y":400 };

    async function fetchCommodity(fn) {
      const url = `https://www.alphavantage.co/query?function=${fn}&interval=daily&apikey=${apiKey}`;
      const r = await fetch(url);
      const d = await r.json();
      if (d["Information"]) throw new Error("API limit or invalid key");
      const raw = d?.data || [];
      const pts = [...raw].reverse().map(e => ({
        t: new Date(e.date).toLocaleDateString("en-US",{month:"short",day:"numeric"}),
        date: e.date,
        p: parseFloat(e.value)
      })).filter(p => !isNaN(p.p));
      const year = pts.slice(-365);
      const month = pts.slice(-30);
      // For intraday we don't have real data — use last daily point to anchor synthetic 72h/24h
      const last = pts[pts.length-1]?.p || 80;
      const rng = n => { let x = Math.sin(n*7621+31415)*198273; return x-Math.floor(x); };
      let hp = last * 0.985;
      const h72 = [...Array(72)].map((_,i) => {
        hp += (rng(i*17+fn.length)-.4)*0.4;
        hp = Math.max(last*0.94, Math.min(last*1.06, hp));
        const d=new Date(); d.setHours(d.getHours()-72+i);
        return { t:`${["","",""][0]}${d.toLocaleDateString("en-US",{month:"short",day:"numeric"})} ${d.getHours().toString().padStart(2,"0")}:00`, p:+hp.toFixed(2) };
      });
      let hp2 = last;
      const h24 = [...Array(24)].map((_,i) => {
        hp2 += (rng(i*31+fn.length)-.4)*0.25;
        hp2 = Math.max(last*0.97, Math.min(last*1.03, hp2));
        return { t:`${i.toString().padStart(2,"0")}:00`, p:+hp2.toFixed(2) };
      });
      return { year, month, h72, h24 };
    }

    Promise.all([fetchCommodity("BRENT"), fetchCommodity("NATURAL_GAS")])
      .then(([b, hh]) => {
        setBrent(b);
        setHenryHub(hh);
        setStatus("live");
      })
      .catch(e => {
        console.error("Alpha Vantage error:", e);
        setStatus("error");
      });
  }, [apiKey]);

  return { brent, henryHub, status };
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

  // Safe helpers — CSV data may be missing optional fields
  const lat = attack.lat != null ? Number(attack.lat) : null;
  const lng = attack.lng != null ? Number(attack.lng) : null;
  const sources = Array.isArray(attack.sources) ? attack.sources : [];
  const summary = attack.summary || "";
  const countryCode = attack.countryCode || attack.country || "—";

  return (
    <div style={{position:"fixed",top:0,right:0,width:500,height:"100vh",background:C.surface,borderLeft:`1px solid ${C.borderBright}`,zIndex:200,overflowY:"auto"}}>
      {/* Sticky header */}
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.surface,zIndex:10,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
            <Tag color={strikerColor(attack.striker)}>{attack.striker || "Unknown"}</Tag>
            <Tag color={sevColor(attack.severity)}>{sevLabel(attack.severity)}</Tag>
            {attack.targetType && <Tag color={typeColor}>{attack.targetType}</Tag>}
            {!attack.confirmed && <Tag color={C.muted}>UNCONFIRMED</Tag>}
          </div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:21,fontWeight:800,color:C.bright,lineHeight:1.2}}>{attack.name}</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.muted,marginTop:5}}>
            {countryCode} · {fmtDate(attack.date)}{attack.time && attack.time !== "—" ? ` · ${attack.time}` : ""}
          </div>

          {attack.docUrl && (
            <a href={attack.docUrl} target="_blank" rel="noopener noreferrer"
              style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:12,padding:"8px 14px",background:"rgba(59,130,246,0.1)",border:`1px solid ${C.coalition}66`,borderRadius:4,textDecoration:"none",color:C.coalition,fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1}}>
              <span>📄</span><span>LIVE ARTICLE ↗</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:`${C.coalition}88`,fontWeight:400}}>Google Doc</span>
            </a>
          )}
          {!attack.docUrl && (
            <div style={{marginTop:12,padding:"7px 12px",background:"rgba(74,98,128,0.1)",border:`1px dashed ${C.muted}44`,borderRadius:4,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted}}>
              NO ARTICLE YET — add article_url in your CSV to link a Google Doc
            </div>
          )}
        </div>
        <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,cursor:"pointer",borderRadius:4,padding:"4px 10px",fontSize:16,flexShrink:0}}>✕</button>
      </div>

      {/* Metadata table */}
      <div style={{margin:"16px 20px 0",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden"}}>
        {[
          ["TARGET TYPE", attack.targetType || "—"],
          ["OPERATOR",    attack.operator   || "—"],
          ["CAPACITY",    attack.capacity   || "—"],
          ["STATUS",      attack.status     || "—"],
          ["WEAPON",      attack.weapon     || "—"],
          ["CASUALTIES",  attack.casualties || "—"],
          ["COORDINATES", lat != null ? `${lat.toFixed(4)}°N, ${lng != null ? lng.toFixed(4) : "?"}°E` : "—"],
        ].map(([k,v],i,arr)=>(
          <div key={k} style={{display:"flex",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted,padding:"8px 12px",width:120,flexShrink:0,borderRight:`1px solid ${C.border}`,background:`${C.surface}88`}}>{k}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:"8px 12px",color:C.text,flex:1,wordBreak:"break-word"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Summary / Assessment */}
      {summary && (
        <div style={{padding:"16px 20px"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:C.muted,marginBottom:10}}>ASSESSMENT</div>
          {summary.split("\n\n").map((p,i)=>(
            <p key={i} style={{fontSize:14,lineHeight:1.72,color:C.text,margin:"0 0 12px",fontFamily:"'Barlow',sans-serif"}}>{p}</p>
          ))}
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div style={{padding:"0 20px 28px"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:C.muted,marginBottom:10}}>SOURCES</div>
          {sources.map((s,i)=>(
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"flex-start",gap:8,padding:"9px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:4,marginBottom:6,textDecoration:"none",color:C.coalition,fontSize:12,fontFamily:"'Barlow',sans-serif",lineHeight:1.5}}>
              <span style={{flexShrink:0,marginTop:2,fontSize:10}}>↗</span><span>{s.title}</span>
            </a>
          ))}
        </div>
      )}
      {sources.length === 0 && (
        <div style={{padding:"0 20px 28px"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:C.muted,marginBottom:8}}>SOURCES</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted,padding:"10px 12px",border:`1px dashed ${C.border}`,borderRadius:4}}>
            No sources linked. Add to CSV: <code style={{color:C.coalition}}>Title|https://url.com||Title 2|https://url2.com</code>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ATTACK ROW ───────────────────────────────────────────────────────────────
function AttackRow({attack,onSelect,selected}){
  const [hov,setHov]=useState(false);
  const countryCode = attack.countryCode || attack.country || "—";
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
          <span>{countryCode}</span><span>·</span><span>{fmtDate(attack.date)}</span>
          {attack.time && attack.time !== "—" && <><span>·</span><span>{attack.time}</span></>}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
        <Tag color={strikerColor(attack.striker)}>{attack.striker || "?"}</Tag>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:sevColor(attack.severity)}}>{sevLabel(attack.severity)}</span>
      </div>
    </div>
  );
}

// ─── LEAFLET MAP ──────────────────────────────────────────────────────────────
function MapPanel({attacks,onSelect,selected}){
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const [status, setStatus] = useState("loading");
  const lfReady = useLeaflet();

  useEffect(()=>{
    if(!lfReady || !mapContainerRef.current || mapRef.current) return;
    const L = window.L;
    try {
      const map = L.map(mapContainerRef.current, { center:[27,51], zoom:5, zoomControl:true, attributionControl:true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:'© <a href="https://carto.com/">CARTO</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
        subdomains:"abcd", maxZoom:19,
      }).addTo(map);
      mapRef.current = map;
      setStatus("ready");
    } catch(e) { setStatus("error"); }
    return () => { if(mapRef.current){ mapRef.current.remove(); mapRef.current=null; } };
  }, [lfReady]);

  useEffect(()=>{
    if(!mapRef.current || status !== "ready") return;
    const L = window.L;
    Object.values(markersRef.current).forEach(m => { try{ m.remove(); }catch(e){} });
    markersRef.current = {};
    attacks.forEach(a => {
      if(a.lat == null || a.lng == null) return;
      const col = strikerColor(a.striker);
      const isSelected = selected?.id === a.id;
      const radius = (a.severity===3?11:a.severity===2?8:6)*(isSelected?1.4:1);
      const marker = L.circleMarker([Number(a.lat),Number(a.lng)], {
        radius, fillColor:col, color:"#000", weight:isSelected?3:1.5,
        opacity:0.9, fillOpacity:a.confirmed?0.82:0.32, dashArray:a.confirmed?null:"4 3",
      }).addTo(mapRef.current);
      const cc = a.countryCode || a.country || "—";
      marker.bindTooltip(
        `<div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:#e8f2ff;background:#0d1422;border:1px solid #1e3050;border-radius:4px;padding:4px 8px;">${a.shortName}<br><span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#4a6280;">${cc} · ${a.striker||"?"}</span></div>`,
        { direction:"top", offset:[0,-6], opacity:1, className:"lf-tt" }
      );
      marker.on("click", () => onSelect(a));
      markersRef.current[a.id] = marker;
    });
  }, [lfReady, status, attacks, selected]);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{position:"relative",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden"}}>
        <SectionHead>
          STRIKE MAP — REAL COORDINATES &nbsp;
          <span style={{fontWeight:400,letterSpacing:0}}>
            <span style={{color:C.iran}}>●</span><span style={{fontSize:9,color:C.muted}}> IRAN &nbsp;</span>
            <span style={{color:C.coalition}}>●</span><span style={{fontSize:9,color:C.muted}}> COALITION &nbsp;</span>
            <span style={{color:C.muted,opacity:.5}}>◌</span><span style={{fontSize:9,color:C.muted}}> UNCONFIRMED</span>
          </span>
        </SectionHead>
        {status === "loading" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:C.card,zIndex:10}}>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.muted}}>LOADING MAP TILES…</span>
          </div>
        )}
        <div ref={mapContainerRef} style={{height:460,width:"100%"}}/>
        <style>{`
          .lf-tt { background:transparent!important; border:none!important; box-shadow:none!important; padding:0!important; }
          .lf-tt .leaflet-tooltip-content { padding:0!important; }
          .leaflet-tooltip-top.lf-tt::before { border-top-color:#1e3050!important; }
          .leaflet-control-attribution { background:rgba(5,8,15,0.7)!important; color:#4a6280!important; font-size:9px!important; }
          .leaflet-control-attribution a { color:#3b82f6!important; }
          .leaflet-control-zoom a { background:#0d1422!important; color:#c8d8ea!important; border-color:#162236!important; }
        `}</style>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",padding:"2px 4px"}}>
        {[{c:C.critical,l:"CRITICAL (r=11)"},{c:C.major,l:"MAJOR (r=8)"},{c:C.minor,l:"MINOR (r=6)"}].map(({c,l})=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:c}}/><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted}}>{l}</span>
          </div>
        ))}
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted,marginLeft:"auto"}}>
          Powered by CartoDB + OpenStreetMap
        </div>
      </div>
    </div>
  );
}

// ─── ENERGY MARKETS CHART ─────────────────────────────────────────────────────
// Commodity tabs: Brent (live via Alpha Vantage), Henry Hub (live), JKM LNG (synthetic)
// Get a free Alpha Vantage key: https://www.alphavantage.co/support/#api-key
const RANGES = [{id:"24h",l:"24H"},{id:"72h",l:"72H"},{id:"1m",l:"1M"},{id:"1y",l:"1Y"}];

const COMMODITY_META = {
  brent:    { label:"BRENT CRUDE — ICE FUTURES",   unit:"$/bbl",   color:"#f97316", liveKey:"brent" },
  henry:    { label:"HENRY HUB NATURAL GAS",        unit:"$/MMBtu", color:"#3b82f6", liveKey:"henryHub" },
  jkm:      { label:"JKM LNG SPOT (SYNTHETIC)",     unit:"$/MMBtu", color:"#8b5cf6", liveKey:null },
};

function SingleCommodityChart({ pts, meta, range, onRangeChange, isLive, isSynthetic }) {
  const cur = pts[pts.length-1]?.p || 0;
  const prev = pts[0]?.p || cur;
  const chg = +(cur-prev).toFixed(2);
  const pct = +((chg/prev)*100).toFixed(2);
  const isUp = chg >= 0;
  const minP = Math.min(...pts.map(p=>p.p));
  const maxP = Math.max(...pts.map(p=>p.p));

  const Tip = ({active,payload}) => {
    if(!active||!payload?.length) return null;
    return <div style={{background:C.card,border:`1px solid ${C.borderBright}`,borderRadius:4,padding:"8px 12px"}}>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted}}>{payload[0]?.payload?.t}</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800,color:C.bright}}>{meta.unit.startsWith("$") ? `$${payload[0]?.value?.toFixed(2)}` : `${payload[0]?.value?.toFixed(2)} ${meta.unit}`}</div>
    </div>;
  };

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden",marginBottom:14}}>
      <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:meta.color}}/>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:700,letterSpacing:2,color:C.muted}}>{meta.label}</div>
            {isLive && <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"#10b981",border:"1px solid #10b98144",borderRadius:2,padding:"1px 5px"}}>● LIVE</span>}
            {isSynthetic && <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.muted,border:`1px solid ${C.border}`,borderRadius:2,padding:"1px 5px"}}>SYNTHETIC</span>}
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:800,color:C.bright,lineHeight:1}}>${cur.toFixed(2)}</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:isUp?"#10b981":"#ef4444"}}>{isUp?"▲":"▼"} ${Math.abs(chg)} ({isUp?"+":""}{pct}%)</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.muted}}>{meta.unit}</span>
          </div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.muted,marginTop:2}}>RANGE ${minP.toFixed(2)} – ${maxP.toFixed(2)}</div>
        </div>
        <div style={{display:"flex",gap:3}}>
          {RANGES.map(r=>(
            <button key={r.id} onClick={()=>onRangeChange(r.id)}
              style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:"4px 10px",border:`1px solid ${range===r.id?C.borderBright:C.border}`,borderRadius:3,background:range===r.id?C.borderBright:"transparent",color:range===r.id?C.bright:C.muted,cursor:"pointer"}}>
              {r.l}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"10px 10px 6px",height:160}}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pts} margin={{top:4,right:8,bottom:0,left:0}}>
            <defs>
              <linearGradient id={`grad-${meta.liveKey||"jkm"}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={meta.color} stopOpacity={0.25}/>
                <stop offset="95%" stopColor={meta.color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,fill:C.muted}} axisLine={{stroke:C.border}} tickLine={false} interval={range==="24h"?3:range==="72h"?11:range==="1m"?4:30}/>
            <YAxis domain={[Math.floor(minP)-1,Math.ceil(maxP)+1]} tick={{fontFamily:"'JetBrains Mono',monospace",fontSize:7,fill:C.muted}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`} width={34}/>
            <Tooltip content={<Tip/>}/>
            <Area type="monotone" dataKey="p" stroke={meta.color} strokeWidth={1.5} fill={`url(#grad-${meta.liveKey||"jkm"})`} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EnergyMarketsChart({ syntheticBrent, syntheticHenry, syntheticJKM, apiKey, onApiKeyChange }) {
  const [range, setRange] = useState("72h");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyDraft, setKeyDraft] = useState(apiKey || "");
  const { brent: liveBrent, henryHub: liveHenry, status: liveStatus } = useLiveOilPrices(apiKey);

  const getRange = (src, r) => {
    if (!src) return [];
    return r==="24h"?src.h24:r==="72h"?src.h72:r==="1m"?src.month:src.year;
  };

  const brentPts  = getRange(liveBrent  || syntheticBrent,  range);
  const henryPts  = getRange(liveHenry  || syntheticHenry,  range);
  const jkmPts    = getRange(syntheticJKM, range);

  const isLive = liveStatus === "live";

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden",marginBottom:20}}>
      {/* Header bar */}
      <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:2,color:C.muted}}>
            ENERGY MARKETS DASHBOARD
          </div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.muted,marginTop:2}}>
            {isLive
              ? "● Live data via Alpha Vantage · JKM uses synthetic model"
              : liveStatus === "loading"
              ? "⟳ Fetching live data…"
              : liveStatus === "error"
              ? "⚠ API error — check key or daily limit — showing synthetic"
              : "Synthetic/modeled data — enter Alpha Vantage key for live Brent + Henry Hub"}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {!showKeyInput ? (
            <button onClick={()=>setShowKeyInput(true)}
              style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,padding:"5px 12px",border:`1px solid ${isLive?"#10b98166":C.coalition+"66"}`,borderRadius:3,background:"transparent",color:isLive?"#10b981":C.coalition,cursor:"pointer"}}>
              {isLive ? "✓ LIVE" : "⚙ SET API KEY"}
            </button>
          ) : (
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input
                value={keyDraft}
                onChange={e=>setKeyDraft(e.target.value)}
                placeholder="Alpha Vantage API key…"
                style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:"5px 10px",background:C.surface,border:`1px solid ${C.borderBright}`,borderRadius:3,color:C.text,outline:"none",width:200}}
              />
              <button onClick={()=>{ onApiKeyChange(keyDraft); setShowKeyInput(false); }}
                style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,padding:"5px 10px",border:"none",borderRadius:3,background:C.coalition,color:"#fff",cursor:"pointer"}}>SAVE</button>
              <button onClick={()=>setShowKeyInput(false)}
                style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:3,background:"transparent",color:C.muted,cursor:"pointer"}}>✕</button>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div style={{padding:"14px 14px 4px"}}>
        <SingleCommodityChart pts={brentPts}  meta={COMMODITY_META.brent} range={range} onRangeChange={setRange} isLive={isLive} isSynthetic={!isLive}/>
        <SingleCommodityChart pts={henryPts}  meta={COMMODITY_META.henry} range={range} onRangeChange={setRange} isLive={isLive} isSynthetic={!isLive}/>
        <SingleCommodityChart pts={jkmPts}    meta={COMMODITY_META.jkm}   range={range} onRangeChange={setRange} isLive={false}  isSynthetic={true}/>
      </div>

      {/* Footer note */}
      <div style={{padding:"4px 18px 12px",fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:`${C.muted}88`}}>
        FREE API: alphavantage.co — 25 calls/day · Brent + Henry Hub are live when key is set ·
        JKM LNG spot requires Bloomberg/Argus subscription (shown as synthetic model) ·
        Intraday data for 72H/24H is interpolated from last daily close
      </div>
    </div>
  );
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────
function Timeline({attacks,onSelect,selected}){
  const sorted=[...attacks].sort((a,b)=>b.date.localeCompare(a.date)||(a.shortName||"").localeCompare(b.shortName||""));
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
                <Tag color={strikerColor(a.striker)}>{a.striker||"?"}</Tag>
                <Tag color={sevColor(a.severity)}>{sevLabel(a.severity)}</Tag>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.muted}}>{a.countryCode||a.country} · {a.targetType}</span>
                {a.docUrl && <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.coalition}}>📄 ARTICLE</span>}
              </div>
              {a.summary && <p style={{fontSize:13,color:"#6a88aa",lineHeight:1.65,margin:0}}>{a.summary.split("\n\n")[0].slice(0,180)}…</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── COUNTRY VIEW ─────────────────────────────────────────────────────────────
function CountryView({attacks,onSelect,selected}){
  // Support both countryCode (hardcoded) and country (CSV fallback)
  const getCode = a => a.countryCode || a.country || "UNKNOWN";
  const countries=[...new Set(attacks.map(getCode))].filter(Boolean).sort();
  const [active,setActive]=useState(countries[0]);
  const filtered=attacks.filter(a=>getCode(a)===active);
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {countries.map(c=>(
          <button key={c} onClick={()=>setActive(c)}
            style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,padding:"6px 14px",border:`1px solid ${active===c?C.borderBright:C.border}`,borderRadius:4,cursor:"pointer",background:active===c?C.card:"transparent",color:active===c?C.bright:C.muted,transition:"all .15s"}}>
            {c} <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:active===c?C.coalition:C.muted}}>{attacks.filter(a=>getCode(a)===c).length}</span>
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
function Overview({attacks, onSelect, selected, syntheticBrent, syntheticHenry, syntheticJKM, apiKey, onApiKeyChange}){
  const getCode = a => a.countryCode || a.country || "UNKNOWN";
  const byCt = attacks.reduce((acc, x) => { const k=getCode(x); acc[k]=(acc[k]||0)+1; return acc; }, {});
  return (
    <div>
      <EnergyMarketsChart
        syntheticBrent={syntheticBrent}
        syntheticHenry={syntheticHenry}
        syntheticJKM={syntheticJKM}
        apiKey={apiKey}
        onApiKeyChange={onApiKeyChange}
      />
      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:20,alignItems:"start"}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6}}>
          <SectionHead>ALL INCIDENTS — MOST RECENT FIRST</SectionHead>
          {[...attacks].sort((a,b)=>b.date.localeCompare(a.date)||((a.shortName||"").localeCompare(b.shortName||""))).map(a=>(
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
            {[["Iran",C.iran],["Coalition",C.coalition],["Unknown",C.muted]].map(([s,col])=>{
              const n=attacks.filter(a=>a.striker===s).length; if(!n) return null;
              return (
                <div key={s} style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:col}}/>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:600}}>{s}</span>
                  </div>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:col}}>{n}</span>
                </div>
              );
            })}
          </div>
          {/* CSV sources format guide */}
          <div style={{background:"#060f1a",border:`1px solid ${C.coalition}33`,borderRadius:6,padding:"14px 16px"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,letterSpacing:2,color:C.coalition,marginBottom:8}}>📋 CSV COLUMN REFERENCE</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#6a8aaa",lineHeight:2}}>
              {[
                ["id","unique slug (required)"],
                ["title","display name"],
                ["full_name","long name (optional)"],
                ["short_name","short name (optional)"],
                ["date","YYYY-MM-DD"],
                ["time","e.g. 00:20 PST"],
                ["country","e.g. Saudi Arabia"],
                ["country_code","e.g. KSA (auto if blank)"],
                ["striker","Iran / Coalition / Unknown"],
                ["weapon_type","e.g. Shahed-136 drone"],
                ["facility_type","Refinery, Pipeline…"],
                ["operator","e.g. Saudi Aramco"],
                ["capacity_bpd","numeric bpd"],
                ["capacity_mmscfd","numeric MMscf/d"],
                ["damage_assessment","status text"],
                ["casualties","text"],
                ["lat / lon","decimal coords"],
                ["severity","1=minor 2=major 3=critical"],
                ["confirmed","true / false"],
                ["summary","attack summary text"],
                ["sources","Title|URL||Title2|URL2"],
                ["article_url","Google Doc URL"],
              ].map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:6}}>
                  <span style={{color:C.coalition,minWidth:130}}>{k}</span>
                  <span style={{color:C.muted}}>{v}</span>
                </div>
              ))}
            </div>
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
  const [tab, setTab] = useState("overview");
  const [selected, setSelected] = useState(null);
  const [attacks, setAttacks] = useState(DEFAULT_ATTACKS);

  // Persist Alpha Vantage API key across sessions
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem("av_api_key") || ""; } catch { return ""; }
  });
  const handleApiKeyChange = key => {
    setApiKey(key);
    try { localStorage.setItem("av_api_key", key); } catch {}
  };

  // Synthetic market data (always available as fallback)
  const syntheticBrent  = useMemo(() => makeBrent(),    []);
  const syntheticHenry  = useMemo(() => makeHenryHub(), []);
  const syntheticJKM    = useMemo(() => makeJKM(),       []);

  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZiLId8TyIU9e-E_77m1FP98GaR2ArWQ7yIhDhQ6IAKFV1GsBsW3zV47dtrzkL-5n7CWZ02Zgipv-d/pub?gid=0&single=true&output=csv";

  useEffect(() => {
    async function loadAttacks() {
      try {
        const res = await fetch(CSV_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("CSV fetch failed");
        const csvText = await res.text();
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

        const toNum = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

        const mapped = parsed.data
          .filter(r => r.id && r.id.trim() && r.id.trim() !== "id")
          .map(r => {
            const country = (r.country || "").trim();
            const countryCode = (r.country_code || r.countryCode || COUNTRY_CODES[country] || country || "").trim();
            const sources = parseSourcesCSV(r.sources || r.source_urls || "");

            return {
              id:           r.id.trim(),
              name:         (r.full_name || r.name || r.title || r.id).trim(),
              shortName:    (r.short_name || r.shortName || r.title || r.id).trim(),
              date:         (r.date || "").trim(),
              time:         (r.time || r.time_pst || "—").trim(),
              country,
              countryCode,
              lat:          toNum(r.lat),
              lng:          toNum(r.lon || r.lng),
              striker:      (r.striker || "").trim(),
              weapon:       (r.weapon_type || r.weapon || "").trim(),
              targetType:   (r.facility_type || r.target_type || "").trim(),
              operator:     (r.operator || "—").trim(),
              capacity: r.capacity_bpd
                ? `${Number(r.capacity_bpd).toLocaleString()} bpd`
                : r.capacity_mmscfd
                ? `${Number(r.capacity_mmscfd).toLocaleString()} MMscf/d`
                : (r.capacity || "—").trim(),
              status:       (r.damage_assessment || r.dammage_assessment || r.status || "").trim(),
              casualties:   (r.casualties || "Unknown").trim(),
              confirmed:    String(r.confirmed || "").toLowerCase() === "true",
              severity:     r.severity ? Number(r.severity) : 2,
              summary:      (r.summary || "").trim(),
              sources,
              docUrl:       (r.article_url || "").trim() || null,
            };
          });

        console.log(`CSV loaded: ${mapped.length} events`, mapped[0]);
        if (mapped.length > 0) setAttacks(mapped);
      } catch (e) {
        console.error("CSV load failed, using hardcoded fallback:", e);
      }
    }
    loadAttacks();
  }, []);

  const tabs = [{id:"overview",l:"OVERVIEW"},{id:"map",l:"MAP"},{id:"timeline",l:"TIMELINE"},{id:"countries",l:"COUNTRIES"}];
  const stats = [
    {n:attacks.length,                                    l:"INCIDENTS",        c:C.bright},
    {n:attacks.filter(a=>a.confirmed).length,             l:"CONFIRMED",        c:"#10b981"},
    {n:attacks.filter(a=>a.severity===3).length,          l:"CRITICAL",         c:C.critical},
    {n:attacks.filter(a=>a.striker==="Iran").length,      l:"IRAN OUTBOUND",    c:C.iran},
    {n:attacks.filter(a=>a.striker==="Coalition").length, l:"COALITION ON IRAN",c:C.coalition},
    {n:attacks.filter(a=>a.docUrl).length,                l:"ARTICLES LINKED",  c:"#8b5cf6"},
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
              ENERGY INFRASTRUCTURE ATTACKS TRACKER US-IRAN WAR 2026
            </div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.muted,letterSpacing:1,marginTop:2}}>A project by MirMattia Ottaviani, fellow @ Rainier Institute of Foreign Affairs, University of Washington.</div>
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
          {tab==="overview" && (
            <Overview
              attacks={attacks} onSelect={setSelected} selected={selected}
              syntheticBrent={syntheticBrent} syntheticHenry={syntheticHenry} syntheticJKM={syntheticJKM}
              apiKey={apiKey} onApiKeyChange={handleApiKeyChange}
            />
          )}
          {tab==="map" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:20,alignItems:"start"}}>
              <MapPanel attacks={attacks} onSelect={setSelected} selected={selected}/>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6}}>
                <SectionHead>CLICK A MARKER FOR DETAILS</SectionHead>
                {[...attacks].sort((a,b)=>b.date.localeCompare(a.date)).map(a=>(
                  <AttackRow key={a.id} attack={a} onSelect={setSelected} selected={selected?.id===a.id}/>
                ))}
              </div>
            </div>
          )}
          {tab==="timeline" && <Timeline attacks={attacks} onSelect={setSelected} selected={selected}/>}
          {tab==="countries" && <CountryView attacks={attacks} onSelect={setSelected} selected={selected}/>}
        </div>

        {/* Detail panel overlay */}
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