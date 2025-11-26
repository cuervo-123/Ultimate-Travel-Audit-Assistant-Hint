// Travel Audit Assistant — PDF & Logo Hotfix

if (!window.__TAA_INITIALIZED__) {
  window.__TAA_INITIALIZED__ = true;

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

  function toast(msg){
    const d = document.createElement('div');
    Object.assign(d.style,{position:'fixed',bottom:'18px',right:'18px',background:'rgba(15,28,62,.9)',border:'1px solid #3b6db3',padding:'10px 12px',borderRadius:'12px',color:'#e8f0ff',boxShadow:'0 6px 20px rgba(0,0,0,.35)',zIndex:9999});
    d.textContent = msg; document.body.appendChild(d); setTimeout(()=>d.remove(), 2300);
  }

  async function getLogoPngDataURL(){
    try{
      const res = await fetch('assets/logo.svg', {cache:'no-store'});
      if(!res.ok) throw new Error('logo missing');
      const svgText = await res.text();
      const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      return await new Promise((resolve)=>{
        img.onload = () => {
          const c = document.createElement('canvas');
          const size = 96;
          c.width = size; c.height = size;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, size, size);
          resolve(c.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
        img.src = svgUrl;
      });
    }catch(e){
      return null;
    }
  }

  (async function ensurePageLogo(){
    try{
      const img = document.querySelector('.logo');
      if(!img) return;
      const res = await fetch(img.getAttribute('src') || 'assets/logo.svg', {cache:'no-store'});
      if(!res.ok){
        const span = document.createElement('span');
        span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 320 320">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#1f8bff"/>
      <stop offset="100%" stop-color="#4ac3ff"/>
    </linearGradient>
    <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#cfe6ff"/>
      <stop offset="100%" stop-color="#e9f5ff"/>
    </linearGradient>
  </defs>
  <rect x="16" y="16" rx="56" ry="56" width="288" height="288" fill="url(#g)" />
  <g transform="translate(160,170)">
    <path d="M-70,60 L0,-100 L70,60" fill="none" stroke="url(#g2)" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="-20" y1="10" x2="20" y2="10" stroke="#e9f5ff" stroke-width="18" stroke-linecap="round"/>
  </g>
</svg>`;
        span.className = 'logo';
        img.replaceWith(span);
      }
    }catch(_){}
  })();

  document.getElementById('btn-pdf')?.addEventListener('click', async ()=>{
    try{
      if(!window.jspdf || !window.jspdf.jsPDF){
        throw new Error("jsPDF not loaded. Check the <script> CDN URL and order.");
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      const title = (document.getElementById('report-title')?.value || 'Report').toString();
      doc.setFontSize(16);
      doc.text(title, 14, 18);

      try{
        const logo = await getLogoPngDataURL();
        if(logo){ doc.addImage(logo, 'PNG', 170, 8, 24, 24); }
      }catch(_){}

      doc.setFontSize(12);
      const total = document.getElementById('kpi-total')?.textContent || '—';
      const comp  = document.getElementById('kpi-compliance')?.textContent || '—';
      const fnum  = document.getElementById('kpi-findings')?.textContent || '—';
      const risk  = document.getElementById('kpi-risk')?.textContent || '—';
      doc.text(`Total spend: ${total}`, 14, 30);
      doc.text(`% Compliance: ${comp}`, 14, 38);
      doc.text(`# Findings: ${fnum}`, 14, 46);
      doc.text(`Risk score: ${risk}`, 14, 54);

      let y = 66;
      doc.setFont(undefined,'bold');
      doc.text('Findings (first 20)',14,y); y+=6;
      doc.setFont(undefined,'normal');
      try{
        const rows = Array.from(document.querySelectorAll('#tbl-findings tbody tr')).slice(0,20);
        if(rows.length === 0){ doc.text('No findings to display.', 14, y); }
        else{
          rows.forEach((tr,i)=>{
            const tds = tr.querySelectorAll('td');
            const detail = tds[2]?.textContent || '';
            const sev = tds[1]?.textContent || '';
            const rule = tds[3]?.textContent || '';
            const line = `${i+1}. [${sev.toUpperCase()}] ${rule} — ${detail}`;
            const split = doc.splitTextToSize(line, 180);
            doc.text(split,14,y);
            y += (split.length * 6);
            if(y>280){ doc.addPage(); y=20; }
          });
        }
      }catch(_){}

      doc.save('travel_audit_report.pdf');
      toast('PDF generated.');
    }catch(err){
      console.error(err);
      alert("PDF could not be generated. Check console for details. Likely cause: jsPDF CDN not loaded or blocked.");
    }
  });
}

