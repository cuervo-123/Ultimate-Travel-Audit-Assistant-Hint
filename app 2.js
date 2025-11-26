// Travel Audit Assistant — Tech Blue+ (English) with robust contextual Help overlay

let state = {
  expenses: [],
  trips: [],
  findings: [],
  rules: {
    HOTEL_CAP: { enabled: true, category: "hotel", usdPerNight: 180 },
    FLIGHT_CLASS: { enabled: true, allowed: ["Y","M","ECONOMY"] },
    DUPLICATE_INVOICE: { enabled: true }
  }
};

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(s => s.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
  });
});

// Theme
const root = document.documentElement;
const themeSwitch = document.getElementById('theme-switch');
function loadTheme(){
  const t = localStorage.getItem('taa_theme') || 'dark';
  root.setAttribute('data-theme', t);
  themeSwitch.checked = (t === 'dark-plus');
}
function setTheme(mode){
  root.setAttribute('data-theme', mode);
  localStorage.setItem('taa_theme', mode);
}
themeSwitch.addEventListener('change', ()=> setTheme(themeSwitch.checked ? 'dark-plus' : 'dark'));
loadTheme();

// Local storage
function saveLocal(){
  localStorage.setItem('taa_state', JSON.stringify(state));
  toast('Data saved.');
}
function loadLocal(){
  const raw = localStorage.getItem('taa_state');
  if(raw){ try { state = JSON.parse(raw); } catch(e){} }
}
function toast(msg){
  const d = document.createElement('div');
  Object.assign(d.style,{position:'fixed',bottom:'18px',right:'18px',background:'rgba(15,28,62,.9)',border:'1px solid #3b6db3',padding:'10px 12px',borderRadius:'12px',color:'#e8f0ff',boxShadow:'0 6px 20px rgba(0,0,0,.35)',zIndex:9999});
  d.textContent = msg; document.body.appendChild(d); setTimeout(()=>d.remove(), 2200);
}

// CSV parsing
function parseCSV(file){
  return new Promise((resolve,reject)=>{
    Papa.parse(file, { header:true, skipEmptyLines:true, complete: r=>resolve(r.data), error: e=>reject(e) });
  });
}

// Upload handlers
document.getElementById('file-expenses').addEventListener('change', async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  state.expenses = await parseCSV(f);
  document.getElementById('ingest-result').textContent = `Expenses loaded: ${state.expenses.length}`;
  recalcAll();
});
document.getElementById('file-trips').addEventListener('change', async (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  state.trips = await parseCSV(f);
  document.getElementById('ingest-result').textContent = `Trips loaded: ${state.trips.length}`;
  recalcAll();
});

// Sample CSV download
function download(filename, content){
  const blob = new Blob([content], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
document.getElementById('btn-sample-expenses').addEventListener('click', ()=>{
  const csv = [
    "id,trip_id,category,amount,currency,date,vendor,invoice_id,justification_url,approved,nights,flight_class",
    "1,501,hotel,420,USD,2025-10-12,Blue Hotel,INV-1001,,false,2,",
    "2,501,flight,380,USD,2025-10-10,AirX,,https://approvals/501-1,false,,Y",
    "3,502,hotel,220,USD,2025-10-15,Central Hotel,INV-1002,,true,1,",
    "4,503,ground,60,USD,2025-10-16,City Taxi,INV-1003,,true,,",
    "5,501,hotel,500,USD,2025-10-13,Blue Hotel,INV-1001,,false,2,"
  ].join("\n");
  download("expenses.csv", csv);
});
document.getElementById('btn-sample-trips').addEventListener('click', ()=>{
  const csv = [
    "id,employee,destination,start_date,end_date,flight_class,booked_fare",
    "501,Ana Gomez,Bogota,2025-10-10,2025-10-14,Y,380",
    "502,Carlos Ruiz,Medellin,2025-10-15,2025-10-16,M,120",
    "503,Luisa Perez,Cali,2025-10-16,2025-10-17,Y,0"
  ].join("\n");
  download("trips.csv", csv);
});

// Rules UI
const rulesTA = document.getElementById('rules-json');
function refreshRulesText(){ rulesTA.value = JSON.stringify(state.rules, null, 2); }
document.getElementById('btn-reset-rules').addEventListener('click', ()=>{
  state.rules = { HOTEL_CAP:{enabled:true,category:'hotel',usdPerNight:180}, FLIGHT_CLASS:{enabled:true,allowed:['Y','M','ECONOMY']}, DUPLICATE_INVOICE:{enabled:true} };
  refreshRulesText(); recalcAll();
});
document.getElementById('btn-apply-rules').addEventListener('click', ()=>{
  try{ state.rules = JSON.parse(rulesTA.value); recalcAll(); toast('Rules applied.'); } catch(e){ toast('Invalid JSON.'); }
});

// Findings & KPIs
function toUSD(row){
  const amt = parseFloat(row.amount ?? row.monto ?? row.amount_usd ?? row.monto_usd ?? 0) || 0;
  return amt;
}
function getCategory(row){
  const cat = (row.category ?? row.rubro ?? '').toString().toLowerCase();
  return cat;
}
function getBool(v){
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}
function detectFindings(){
  const F = [];
  const rules = state.rules || {};
  const exps = state.expenses || [];

  if(rules.HOTEL_CAP?.enabled){
    for(const g of exps){
      if(getCategory(g) === 'hotel'){
        const nights = parseFloat(g.nights ?? g.noches ?? '1') || 1;
        const perNight = toUSD(g) / Math.max(nights,1);
        if(perNight > (rules.HOTEL_CAP.usdPerNight||180)){
          F.push({ id:g.id||'—', severity:'medium', detail:`Hotel USD/night ${perNight.toFixed(2)} > cap ${rules.HOTEL_CAP.usdPerNight}`, rule:'HOTEL_CAP', entity:'expense' });
        }
      }
    }
  }
  if(rules.FLIGHT_CLASS?.enabled){
    for(const g of exps){
      const cat = getCategory(g);
      const hasFlight = (cat === 'flight') || (g.flight_class || g.clase_vuelo);
      if(hasFlight){
        const approved = getBool(g.approved ?? g.aprobado);
        const cls = (g.flight_class ?? g.clase_vuelo ?? '').toString().toUpperCase();
        const allowed = (rules.FLIGHT_CLASS.allowed || []).map(x=>String(x).toUpperCase());
        if(!approved && cls && !allowed.includes(cls)){
          F.push({ id:g.id||'—', severity:'high', detail:`Flight class ${cls} not allowed without approval`, rule:'FLIGHT_CLASS', entity:'expense' });
        }
      }
    }
  }
  if(rules.DUPLICATE_INVOICE?.enabled){
    const seen = new Map();
    for(const g of exps){
      const inv = (g.invoice_id ?? g.factura_id ?? '').toString().trim();
      if(!inv) continue;
      if(seen.has(inv)){
        F.push({ id:g.id||'—', severity:'high', detail:`Duplicate invoice: ${inv}`, rule:'DUPLICATE_INVOICE', entity:'expense' });
      }
      seen.set(inv,true);
    }
  }
  return F;
}
function recalcAll(){
  state.findings = detectFindings();
  refreshRulesText(); renderFindings(); renderKPIs();
}
function renderFindings(){
  const tbody = document.querySelector('#tbl-findings tbody'); tbody.innerHTML='';
  for(const f of state.findings){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${f.id}</td><td>${f.severity}</td><td>${f.detail}</td><td>${f.rule}</td><td>${f.entity}</td>`;
    tbody.appendChild(tr);
  }
}
function renderKPIs(){
  const total = (state.expenses||[]).reduce((a,g)=>a+toUSD(g),0);
  const findings = state.findings.length;
  const totalRows = (state.expenses||[]).length || 1;
  const compliance = Math.max(0, 100 - (findings/totalRows*100));
  const high = state.findings.filter(f=>f.severity==='high').length;
  const risk = Math.min(100, Math.round( (high*15) + (findings*5) ));
  document.getElementById('kpi-total').textContent = `$${total.toFixed(2)}`;
  document.getElementById('kpi-compliance').textContent = `${compliance.toFixed(1)}%`;
  document.getElementById('kpi-findings').textContent = `${findings}`;
  document.getElementById('kpi-risk').textContent = `${risk}`;
}

// Contextual Help
const HELP = {
  dashboard: {
    title: "Dashboard — Overview",
    html: `
      <p>At a glance KPIs based on your currently loaded data:</p>
      <ul>
        <li><strong>Total Spend</strong>: sum of all amounts (assumed USD).</li>
        <li><strong>% Compliance</strong>: 100 − (#findings / #rows * 100).</li>
        <li><strong>Risk Score</strong>: simple composite of High/total findings.</li>
      </ul>
      <p>Use <em>Ingestion</em> to upload CSVs, then return here for KPIs.</p>
    `
  },
  ingest: {
    title: "Data Ingestion — How to",
    html: `
      <p>Upload your data into the app (local only):</p>
      <ul>
        <li><strong>Expenses (CSV)</strong>: <code>id,trip_id,category,amount,currency,date,vendor,invoice_id,justification_url,approved,nights,flight_class</code></li>
        <li><strong>Trips (CSV, optional)</strong>: <code>id,employee,destination,start_date,end_date,flight_class,booked_fare</code></li>
        <li>Use the <em>Download sample</em> buttons to get example files.</li>
        <li>After upload, a small status appears below (e.g., “Expenses loaded: 50”).</li>
        <li><em>Save in this browser</em> keeps your data via localStorage.</li>
        <li><em>Clear local data</em> removes saved data.</li>
      </ul>
    `
  },
  findings: {
    title: "Findings — Interpreting results",
    html: `
      <p>Each row is a rule violation detected on your expenses:</p>
      <ul>
        <li><strong>HOTEL_CAP</strong>: nightly cost &gt; configured cap.</li>
        <li><strong>FLIGHT_CLASS</strong>: disallowed flight class without approval.</li>
        <li><strong>DUPLICATE_INVOICE</strong>: repeated invoice_id.</li>
      </ul>
      <p>Tip: adjust rules under the <em>Rules</em> tab and re-apply.</p>
    `
  },
  rules: {
    title: "Rules — Configure JSON",
    html: `
      <p>Current defaults:</p>
      <pre><code>{
  "HOTEL_CAP": { "enabled": true, "category": "hotel", "usdPerNight": 180 },
  "FLIGHT_CLASS": { "enabled": true, "allowed": ["Y","M","ECONOMY"] },
  "DUPLICATE_INVOICE": { "enabled": true }
}</code></pre>
      <ul>
        <li>Edit JSON and click <em>Apply rules</em> to recompute findings.</li>
        <li>Click <em>Reset</em> to restore defaults.</li>
      </ul>
    `
  },
  reports: {
    title: "Reports — Export PDF",
    html: `
      <p>Generate a one-click PDF report:</p>
      <ul>
        <li>Choose a title, then click <em>Generate PDF</em>.</li>
        <li>The file includes KPIs and the first 20 findings.</li>
      </ul>
      <p>Note: PDF is created fully in-browser via jsPDF.</p>
    `
  }
};

// --- HELP OVERLAY FIX (class-based toggle) ---
const overlay     = document.getElementById('help-overlay');
const helpTitle   = document.getElementById('help-title');
const helpContent = document.getElementById('help-content');
const helpClose   = document.getElementById('help-close');
const helpOk      = document.getElementById('help-ok');

document.querySelectorAll('.help-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.getAttribute('data-help');
    const h = HELP[key];
    if (!h) return;
    helpTitle.textContent = h.title;
    helpContent.innerHTML = h.html;
    overlay.classList.add('active'); // show
  });
});

function closeHelp(){ overlay.classList.remove('active'); } // hide
helpClose.addEventListener('click', closeHelp);
helpOk.addEventListener('click', closeHelp);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeHelp(); });
// ensure starts hidden
overlay.classList.remove('active');

// Save/Clear
document.getElementById('btn-save').addEventListener('click', saveLocal);
document.getElementById('btn-clear').addEventListener('click', ()=>{
  localStorage.removeItem('taa_state');
  state = { expenses: [], trips: [], findings: [], rules: state.rules };
  recalcAll(); toast('Local data cleared.');
});

// Recalc + init
function recalcAll(){
  state.findings = detectFindings();
  refreshRulesText(); renderFindings(); renderKPIs();
}
loadLocal();
recalcAll();
recalcAll();
