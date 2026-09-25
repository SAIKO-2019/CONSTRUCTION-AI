// SAIKO Construction AI v27.4
// Actual curve is date-driven and stops at the latest real Actual day.
// It never extends to the Projected finish date.
// Existing 10-second Actual live sync creates/updates today's point automatically.
(function(){
  const n=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };

  function todayIso(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function t(date){
    const d=new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime())?0:d.getTime();
  }

  function series(key,pid){
    return (cache[key]||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({
        date:String(r.progress_date).slice(0,10),
        value:Math.max(0,Math.min(100,n(r.cumulative_percent))),
        source:r.source_label||''
      }))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }

  function plannedAt(rows,date){
    let v=0;
    for(const r of rows){
      if(r.date<=date)v=r.value;
      else break;
    }
    return v;
  }

  function xForDate(date,start,end,L,W,R){
    const s=t(start),e=t(end),x=t(date);
    if(e<=s)return L+(W-L-R)/2;
    return L+((x-s)/(e-s))*(W-L-R);
  }

  function smoothPath(points){
    if(!points.length)return '';
    if(points.length===1)return `M ${points[0].x} ${points[0].y}`;

    if(points.length===2){
      const [a,b]=points;
      const dx=b.x-a.x;
      return `M ${a.x} ${a.y} C ${a.x+dx*0.30} ${a.y}, ${a.x+dx*0.70} ${b.y}, ${b.x} ${b.y}`;
    }

    let d=`M ${points[0].x} ${points[0].y}`;
    for(let i=0;i<points.length-1;i++){
      const p0=points[i-1]||points[i];
      const p1=points[i];
      const p2=points[i+1];
      const p3=points[i+2]||p2;

      const cp1x=p1.x+(p2.x-p0.x)/6;
      const cp1y=p1.y+(p2.y-p0.y)/6;
      const cp2x=p2.x-(p3.x-p1.x)/6;
      const cp2y=p2.y-(p3.y-p1.y)/6;

      d+=` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  function alignedActual(pid,start){
    let rows=(typeof window.alignedActualSeries==='function')
      ? window.alignedActualSeries(pid)
      : series('actualSeries',pid);

    const today=todayIso();

    // Date-driven Actual:
    // 1) nothing before project start
    // 2) nothing after today
    // 3) no extension to Projected finish
    rows=rows
      .map(r=>({date:String(r.date||r.progress_date).slice(0,10),value:n(r.value??r.cumulative_percent)}))
      .filter(r=>r.date>=start && r.date<=today)
      .sort((a,b)=>a.date.localeCompare(b.date));

    if(!rows.length || rows[0].date>start){
      rows=[{date:start,value:0},...rows];
    }

    return rows;
  }

  function card(project){
    const p=series('projectedSeries',project.id);
    if(!p.length){
      return `<article class="project-curve-card">
        <div class="project-curve-head">
          <div><h3>${esc(project.project_name)}</h3><small>${esc(project.status||'')}</small></div>
          <span class="project-health neutral">NO PLAN</span>
        </div>
        <div class="empty">Upload the fixed Projected schedule.</div>
      </article>`;
    }

    const start=p[0].date;
    const finish=p[p.length-1].date;
    const today=todayIso();
    const actualRows=alignedActual(project.id,start);

    // Actual stops at its latest saved date, capped at today.
    const latestActual=actualRows.length
      ? actualRows[actualRows.length-1].date
      : start;

    const actual=actualRows.length
      ? actualRows[actualRows.length-1].value
      : 0;

    // Compare Planned to the SAME Actual date, not Projected finish.
    const planned=plannedAt(p,latestActual);
    const variance=actual-planned;
    const condition=variance<-0.25?'SLIPPAGE':variance>0.25?'AHEAD':'ON TRACK';

    const W=420,H=150,L=28,R=10,T=10,B=26;
    const y=v=>H-B-Math.max(0,Math.min(100,v))*(H-T-B)/100;

    // Planned always shows the full official schedule to finish.
    const pPts=p.map(r=>({
      x:xForDate(r.date,start,finish,L,W,R),
      y:y(r.value)
    }));
    const pLine=pPts.map(o=>`${o.x},${o.y}`).join(' ');

    // Actual x-position is based on its real calendar date on the SAME project axis.
    // It does not continue beyond latestActual.
    const aPts=actualRows.map(r=>({
      x:xForDate(r.date,start,finish,L,W,R),
      y:y(r.value),
      date:r.date,
      value:r.value
    }));
    const aPath=smoothPath(aPts);

    // Today marker uses same calendar axis, but only if today is inside the project.
    const todayInside=today>=start&&today<=finish;
    const tx=todayInside?xForDate(today,start,finish,L,W,R):null;

    return `<article class="project-curve-card">
      <div class="project-curve-head">
        <div>
          <h3>${esc(project.project_name)}</h3>
          <small>Plan ${start} → ${finish} • Actual through ${latestActual}</small>
        </div>
        <span class="project-health ${condition==='SLIPPAGE'?'behind':condition==='AHEAD'?'ahead':'track'}">${condition}</span>
      </div>
      <div class="project-curve-kpis">
        <div><span>Planned @ Actual Date</span><strong>${planned.toFixed(2)}%</strong></div>
        <div><span>Actual</span><strong>${actual.toFixed(2)}%</strong></div>
        <div><span>Variance</span><strong class="${variance<0?'negative':'positive'}">${variance.toFixed(2)}%</strong></div>
      </div>
      <svg class="project-mini-scurve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <line x1="${L}" y1="${y(0)}" x2="${W-R}" y2="${y(0)}" stroke="rgba(100,116,139,.18)"/>
        <line x1="${L}" y1="${y(50)}" x2="${W-R}" y2="${y(50)}" stroke="rgba(100,116,139,.12)"/>
        <line x1="${L}" y1="${y(100)}" x2="${W-R}" y2="${y(100)}" stroke="rgba(100,116,139,.18)"/>

        <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pLine}"/>

        ${todayInside?`
          <line x1="${tx}" y1="${T}" x2="${tx}" y2="${H-B}" stroke="rgba(15,118,110,.22)" stroke-dasharray="4 4"/>
          <text x="${tx}" y="${T+9}" text-anchor="middle" font-size="8" fill="#0f766e">TODAY</text>
        `:''}

        ${aPath?`<path d="${aPath}" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`:''}

        ${aPts.map(o=>`<circle cx="${o.x}" cy="${o.y}" r="2.8" fill="#16a34a"/>`).join('')}
      </svg>
      <div class="project-curve-legend">
        <span><i class="planned-dot"></i>Planned fixed schedule</span>
        <span><i class="actual-dot"></i>Actual by saved date only</span>
      </div>
    </article>`;
  }

  function renderDateDrivenCurves(){
    const host=$('dashboardProjectCurves');
    if(!host)return;

    const projects=(cache.projects||[]).filter(p=>p.status!=='Completed');
    host.innerHTML=projects.length
      ?projects.map(card).join('')
      :'<div class="empty">No ongoing projects.</div>';
  }

  // Final dashboard renderer for this release.
  const oldDash=window.renderDashboard;
  window.renderDashboard=function(){
    let out;
    try{out=oldDash.apply(this,arguments)}catch(err){console.warn('dashboard render',err)}
    renderDateDrivenCurves();
    return out;
  };

  // Existing Actual 10-second live sync already saves today's STATUS point.
  // This renderer therefore moves the Actual line forward automatically day by day.
  setTimeout(renderDateDrivenCurves,500);

  window.renderDateDrivenProjectCurves=renderDateDrivenCurves;
})();
