// SAIKO Construction AI v27.2
// Align Actual history to the fixed Projected schedule start date.
// - Planned line starts from the first Daily Accomplishment date.
// - Actual line uses a 0% project-start baseline, then continues with saved daily STATUS history.
// - Existing 10-second live sync keeps updating today's Actual point.
// - No invented backdated daily Actual values are created.
(function(){
  const n=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };

  const baselineDone=new Set();

  function projectSeries(cacheKey,pid){
    return (cache[cacheKey]||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({
        date:String(r.progress_date).slice(0,10),
        value:Math.max(0,Math.min(100,n(r.cumulative_percent))),
        source:r.source_label||''
      }))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }

  function projectedStart(pid){
    const rows=projectSeries('projectedSeries',pid);
    return rows.length?rows[0].date:null;
  }

  function alignedActualSeries(pid){
    const start=projectedStart(pid);
    let rows=projectSeries('actualSeries',pid);

    if(!start)return rows;

    // Never plot Actual before the fixed Projected baseline start.
    rows=rows.filter(r=>r.date>=start);

    // If there is no true Actual point on project start, add only a 0% start baseline.
    // We deliberately do not generate fake historical daily Actual percentages.
    if(!rows.length || rows[0].date>start){
      rows=[{date:start,value:0,source:'PROJECT START BASELINE'},...rows];
    }

    return rows;
  }

  async function persistStartBaseline(pid,start){
    if(!pid||!start||baselineDone.has(String(pid)))return;
    baselineDone.add(String(pid));

    try{
      const current=(cache.actualSeries||[])
        .filter(r=>String(r.project_id)===String(pid))
        .sort((a,b)=>String(a.progress_date).localeCompare(String(b.progress_date)));

      // If a real Actual point already exists on/before Projected start, do not overwrite it.
      const earliest=current[0];
      if(earliest && String(earliest.progress_date).slice(0,10)<=start)return;

      // Remove only an older synthetic baseline if the fixed Projected baseline changed.
      const del=await sb.from('actual_progress_series')
        .delete()
        .eq('project_id',pid)
        .eq('source_label','PROJECT START BASELINE');
      if(del.error)console.warn('baseline cleanup',del.error);

      const row={
        project_id:pid,
        progress_date:start,
        cumulative_percent:0,
        source_label:'PROJECT START BASELINE',
        synced_at:new Date().toISOString()
      };

      const ins=await sb.from('actual_progress_series')
        .upsert([row],{onConflict:'project_id,progress_date'})
        .select();

      if(ins.error){
        console.warn('baseline save',ins.error);
        return;
      }

      cache.actualSeries=(cache.actualSeries||[])
        .filter(r=>!(String(r.project_id)===String(pid)&&String(r.progress_date).slice(0,10)===start))
        .concat(ins.data||[row]);
    }catch(err){
      console.warn('persistStartBaseline',err);
    }
  }

  async function ensureAllProjectBaselines(){
    const grouped=new Map();
    for(const r of (cache.projectedSeries||[])){
      const pid=String(r.project_id);
      const date=String(r.progress_date).slice(0,10);
      const old=grouped.get(pid);
      if(!old||date<old)grouped.set(pid,date);
    }

    for(const [pid,start] of grouped){
      await persistStartBaseline(pid,start);
    }

    if(typeof renderDashboard==='function')renderDashboard();
  }

  // When a fixed Projected schedule is uploaded/re-uploaded, v27.1 stores the complete
  // Planned curve first. After that render cycle, persist the matching Actual start baseline.
  const uploadBtn=$('uploadProjectedFileBtn');
  if(uploadBtn && !uploadBtn.dataset.v272Aligned){
    uploadBtn.dataset.v272Aligned='1';
    uploadBtn.addEventListener('click',()=>{
      setTimeout(async()=>{
        const pid=$('scheduleProject')?.value||$('workspaceProject')?.value||'';
        const start=projectedStart(pid);
        if(start){
          baselineDone.delete(String(pid));
          await persistStartBaseline(pid,start);
          if(typeof renderDashboard==='function')renderDashboard();
        }
      },1200);
    });
  }

  // Replace the Dashboard per-project curve renderer with an aligned version.
  function moneylessPct(v){return `${n(v).toFixed(2)}%`}

  function plannedAt(rows,date){
    let v=0;
    for(const r of rows){
      if(r.date<=date)v=r.value;
      else break;
    }
    return v;
  }

  function alignedProjectCard(project){
    const p=projectSeries('projectedSeries',project.id);
    const a=alignedActualSeries(project.id);

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
    const latestActual=a.length?a[a.length-1].date:start;
    const planned=plannedAt(p,latestActual);
    const actual=a.length?a[a.length-1].value:0;
    const variance=actual-planned;
    const condition=variance<-0.25?'SLIPPAGE':variance>0.25?'AHEAD':'ON TRACK';

    const dates=[...new Set([...p.map(x=>x.date),...a.map(x=>x.date)])]
      .filter(d=>d>=start)
      .sort();

    let pv=0,av=null;
    const pmap=new Map(p.map(x=>[x.date,x.value]));
    const amap=new Map(a.map(x=>[x.date,x.value]));
    const pts=dates.map(date=>{
      if(pmap.has(date))pv=pmap.get(date);
      if(amap.has(date))av=amap.get(date);
      return {date,p:pv,a:av};
    });

    const W=420,H=150,L=28,R=10,T=10,B=26;
    const xx=i=>pts.length===1?(L+(W-L-R)/2):L+i*(W-L-R)/(pts.length-1);
    const yy=v=>H-B-Math.max(0,Math.min(100,v))*(H-T-B)/100;
    const pp=pts.map((r,i)=>`${xx(i)},${yy(r.p)}`).join(' ');
    const actualPts=pts.map((r,i)=>r.a==null?null:{i,v:r.a}).filter(Boolean);
    const ap=actualPts.map(o=>`${xx(o.i)},${yy(o.v)}`).join(' ');

    return `<article class="project-curve-card">
      <div class="project-curve-head">
        <div>
          <h3>${esc(project.project_name)}</h3>
          <small>Start ${start} • Actual as of ${latestActual}</small>
        </div>
        <span class="project-health ${condition==='SLIPPAGE'?'behind':condition==='AHEAD'?'ahead':'track'}">${condition}</span>
      </div>
      <div class="project-curve-kpis">
        <div><span>Planned</span><strong>${moneylessPct(planned)}</strong></div>
        <div><span>Actual</span><strong>${moneylessPct(actual)}</strong></div>
        <div><span>Variance</span><strong class="${variance<0?'negative':'positive'}">${moneylessPct(variance)}</strong></div>
      </div>
      <svg class="project-mini-scurve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <line x1="${L}" y1="${yy(0)}" x2="${W-R}" y2="${yy(0)}" stroke="rgba(100,116,139,.18)"/>
        <line x1="${L}" y1="${yy(50)}" x2="${W-R}" y2="${yy(50)}" stroke="rgba(100,116,139,.12)"/>
        <line x1="${L}" y1="${yy(100)}" x2="${W-R}" y2="${yy(100)}" stroke="rgba(100,116,139,.18)"/>
        <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pp}"/>
        ${ap?`<polyline fill="none" stroke="#16a34a" stroke-width="3" points="${ap}"/>`:''}
        ${actualPts.map(o=>`<circle cx="${xx(o.i)}" cy="${yy(o.v)}" r="2.8" fill="#16a34a"/>`).join('')}
      </svg>
      <div class="project-curve-legend">
        <span><i class="planned-dot"></i>Planned fixed daily curve</span>
        <span><i class="actual-dot"></i>Actual saved STATUS history</span>
      </div>
    </article>`;
  }

  function renderAlignedCurves(){
    const host=$('dashboardProjectCurves');
    if(!host)return;
    const projects=(cache.projects||[]).filter(p=>p.status!=='Completed');
    host.innerHTML=projects.length
      ?projects.map(alignedProjectCard).join('')
      :'<div class="empty">No ongoing projects.</div>';
  }

  const oldDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    let out;
    try{out=oldDashboard.apply(this,arguments)}catch(err){console.warn('legacy dashboard',err)}
    renderAlignedCurves();
    return out;
  };

  // Existing Actual 10-second live sync updates today's database point.
  // Dashboard then redraws the Actual line while keeping the same Projected start date.
  setTimeout(ensureAllProjectBaselines,900);

  window.alignedActualSeries=alignedActualSeries;
  window.renderAlignedProjectCurves=renderAlignedCurves;
})();
