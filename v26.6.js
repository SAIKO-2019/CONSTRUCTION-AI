// SAIKO Construction AI v26.6
// Actual live S-Curve uses existing 10-second Actual Google Sheet sync.
// No additional timer: renderProgress is called by the existing live sync.
(function(){
  const n=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };

  function currentPid(){
    return $('progressProject')?.value||$('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function actualHistory(pid){
    return (cache.actualSeries||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({
        date:String(r.progress_date).slice(0,10),
        value:Math.max(0,Math.min(100,n(r.cumulative_percent)))
      }))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }

  function renderActualSCurve(){
    const box=$('actualSCurveChart');
    const badge=$('actualSCurveBadge');
    if(!box)return;

    const pid=currentPid();
    const rows=actualHistory(pid);

    if(!rows.length){
      box.innerHTML='<div class="empty">Sync the Actual Google Sheet to create the first Actual S-Curve point.</div>';
      if(badge)badge.textContent='WAITING';
      return;
    }

    const W=900,H=260,pL=44,pR=18,pT=18,pB=42;
    const x=i=>rows.length===1?(pL+(W-pL-pR)/2):pL+i*(W-pL-pR)/(rows.length-1);
    const y=v=>H-pB-Math.max(0,Math.min(100,v))*(H-pT-pB)/100;

    const grid=[0,25,50,75,100].map(v=>
      `<line x1="${pL}" y1="${y(v)}" x2="${W-pR}" y2="${y(v)}" stroke="rgba(100,116,139,.18)"/>
       <text x="4" y="${y(v)+4}" font-size="10" fill="#64748b">${v}%</text>`
    ).join('');

    const pts=rows.map((r,i)=>`${x(i)},${y(r.value)}`).join(' ');
    const labelStep=Math.max(1,Math.ceil(rows.length/8));
    const labels=rows.map((r,i)=>
      (i%labelStep===0||i===rows.length-1)
        ? `<text x="${x(i)}" y="${H-13}" text-anchor="middle" font-size="9" fill="#64748b">${r.date.slice(5)}</text>`
        : ''
    ).join('');

    box.innerHTML=`
      <svg class="scurve-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${grid}
        ${rows.length>1?`<polyline fill="none" stroke="#16a34a" stroke-width="3" points="${pts}"/>`:''}
        ${rows.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.value)}" r="4" fill="#16a34a"/>`).join('')}
        ${labels}
      </svg>
      <div class="chart-legend">
        <span><i class="legend-dot" style="background:#16a34a"></i>Actual cumulative STATUS</span>
        <span>Latest: ${rows[rows.length-1].value.toFixed(2)}% • ${rows[rows.length-1].date}</span>
      </div>`;

    if(badge)badge.textContent=`LIVE • ${rows.length} POINT${rows.length===1?'':'S'}`;
  }

  // Existing 10-second Actual live sync already calls renderProgress().
  // Wrap it once so the S-Curve updates immediately after every live sync.
  const oldProgress=window.renderProgress;
  window.renderProgress=function(){
    const out=oldProgress.apply(this,arguments);
    renderActualSCurve();
    return out;
  };

  if($('progressProject')){
    $('progressProject').addEventListener('change',()=>setTimeout(renderActualSCurve,10),{passive:true});
  }

  setTimeout(renderActualSCurve,400);
  window.renderActualSCurve=renderActualSCurve;
})();
