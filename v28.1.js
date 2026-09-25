// SAIKO Construction AI v28.1
// - Projected baseline delete
// - Dark split login style behavior
// - Stronger useful Home control center
// - Final Projected page = Planned-only
// No MutationObserver and no new recurring timer.
(function(){
  const n=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };
  const peso=v=>'₱'+n(v).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=v=>`${n(v).toFixed(2)}%`;
  const safe=v=>esc(String(v??''));

  function currentProject(){
    const pid=$('workspaceProject')?.value||$('scheduleProject')?.value||'';
    return (cache.projects||[]).find(p=>String(p.id)===String(pid)) || (cache.projects||[])[0] || null;
  }
  function projectById(pid){
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }
  function series(key,pid){
    return (cache[key]||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({
        date:String(r.progress_date).slice(0,10),
        value:Math.max(0,Math.min(100,n(r.cumulative_percent)))
      }))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }
  function plannedAt(rows,date){
    let out=0;
    for(const r of rows){
      if(r.date<=date)out=r.value;
      else break;
    }
    return out;
  }
  function actualPoint(pid){
    const a=series('actualSeries',pid);
    if(a.length)return a[a.length-1];
    const v=typeof window.actualForProject==='function'?n(window.actualForProject(pid)):0;
    return {date:new Date().toISOString().slice(0,10),value:v};
  }
  function projectPosition(pid){
    const a=actualPoint(pid);
    const p=series('projectedSeries',pid);
    const planned=plannedAt(p,a.date);
    const actual=a.value;
    return {date:a.date,planned,actual,variance:actual-planned,plan:p};
  }

  // -------------------------------------------------------
  // Login behavior: show the real sign-in form directly.
  // Existing auth/reCAPTCHA code still owns the controls.
  // -------------------------------------------------------
  function openDirectLogin(){
    if(currentUser)return;
    const overlay=document.querySelector('.auth-overlay');
    if(!overlay || overlay.classList.contains('hidden'))return;
    const landing=$('authLanding');
    const form=$('loginForm');
    if(landing && !landing.classList.contains('hidden') && $('openSignInBtn')){
      try{$('openSignInBtn').click()}catch(_){}
    }else if(landing && form){
      landing.classList.add('hidden');
      form.classList.remove('hidden');
    }
  }
  setTimeout(openDirectLogin,300);

  // -------------------------------------------------------
  // Projected: explicit delete removes only the selected
  // project's Planned baseline/snapshot. Actual history stays.
  // -------------------------------------------------------
  async function deleteProjectedFile(){
    const pid=$('scheduleProject')?.value||$('workspaceProject')?.value||'';
    const p=projectById(pid);
    if(!p)return alert('Select a project first.');

    const hasPlan=(cache.projectedSeries||[]).some(r=>String(r.project_id)===String(pid))
      || !!window.trackerSheetViews?.schedule?.[String(pid)];

    if(!hasPlan)return alert('There is no uploaded Planned file for this project.');

    if(!confirm(`Delete the uploaded Planned file and Projected curve for "${p.project_name}"?\n\nActual data and Actual history will NOT be deleted.`))return;

    const btn=$('deleteProjectedFileBtn');
    if(btn){btn.disabled=true;btn.textContent='Deleting…'}

    try{
      const calls=await Promise.all([
        sb.from('projected_sheet_snapshots').delete().eq('project_id',pid),
        sb.from('projected_progress_series').delete().eq('project_id',pid),
        sb.from('projected_scope_series').delete().eq('project_id',pid),
        sb.from('schedule_items').delete().eq('project_id',pid),
        sb.from('actual_progress_series')
          .delete()
          .eq('project_id',pid)
          .eq('source_label','PROJECT START BASELINE')
      ]);

      const err=calls.find(x=>x.error)?.error;
      if(err)throw err;

      cache.projectedSeries=(cache.projectedSeries||[]).filter(r=>String(r.project_id)!==String(pid));
      cache.projectedScopeSeries=(cache.projectedScopeSeries||[]).filter(r=>String(r.project_id)!==String(pid));
      cache.schedule=(cache.schedule||[]).filter(r=>String(r.project_id)!==String(pid));
      cache.actualSeries=(cache.actualSeries||[]).filter(r=>!(
        String(r.project_id)===String(pid) && String(r.source_label||'')==='PROJECT START BASELINE'
      ));

      if(window.trackerSheetViews?.schedule)delete window.trackerSheetViews.schedule[String(pid)];
      if(window.v268PlannedScopes)delete window.v268PlannedScopes[String(pid)];

      if($('projectedFileUpload'))$('projectedFileUpload').value='';
      if($('projectedFileStatus'))$('projectedFileStatus').textContent='No uploaded file';

      try{
        await sb.from('activity_log').insert({
          project_id:pid,
          module:'projected',
          record_id:String(pid),
          action:'planned_baseline_deleted',
          details:{project_name:p.project_name},
          created_by:currentUser.id
        });
      }catch(_){}

      if(typeof renderSchedule==='function')renderSchedule();
      if(typeof renderDashboard==='function')renderDashboard();
      renderHomeV281();
      if(typeof toast==='function')toast('Planned file deleted. Actual data was kept.');
    }catch(err){
      alert(err?.message||'Could not delete the Planned file.');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Delete File'}
    }
  }

  if($('deleteProjectedFileBtn'))$('deleteProjectedFileBtn').onclick=deleteProjectedFile;

  // -------------------------------------------------------
  // Final Projected page: Planned-only.
  // This reasserts the display after any older wrapper renders.
  // -------------------------------------------------------
  function renderProjectedOnly(){
    const pid=$('scheduleProject')?.value||$('workspaceProject')?.value||'';
    const rows=series('projectedSeries',pid);
    const summary=$('scheduleSummary');
    const chart=$('sCurveChart');
    const guide=$('recoveryPlan');
    const badge=$('scheduleHealthBadge');

    if(!rows.length){
      if(summary)summary.innerHTML=[
        ['Projected Today','0.00%'],['Remaining Plan','100.00%'],['Plan Start','—'],['Plan Finish','—']
      ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
      if(chart)chart.innerHTML='<div class="empty">Upload the fixed Planned schedule to generate the Projected curve.</div>';
      if(guide)guide.innerHTML='<div class="empty">No fixed Planned baseline loaded.</div>';
      if(badge)badge.textContent='WAITING';
      return;
    }

    const today=new Date().toISOString().slice(0,10);
    const planned=plannedAt(rows,today);
    const start=rows[0].date,finish=rows[rows.length-1].date;

    if(summary)summary.innerHTML=[
      ['Projected Today',pct(planned)],
      ['Remaining Plan',pct(Math.max(0,100-planned))],
      ['Plan Start',start],
      ['Plan Finish',finish]
    ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

    if(badge)badge.textContent='FIXED PLAN';
    if(guide)guide.innerHTML=`
      <div class="recovery-item"><strong>Fixed Planned Baseline</strong>
        <p>The uploaded file is the official Planned curve. The system automatically reads the correct cumulative Planned percentage for each calendar date.</p>
      </div>
      <div class="recovery-item"><strong>Comparison Location</strong>
        <p>Actual is intentionally excluded here. Planned vs Actual is shown only on the project Dashboard.</p>
      </div>`;

    if(chart){
      const W=900,H=250,L=42,R=18,T=16,B=38;
      const x=i=>rows.length===1?(L+(W-L-R)/2):L+i*(W-L-R)/(rows.length-1);
      const y=v=>H-B-Math.max(0,Math.min(100,v))*(H-T-B)/100;
      const points=rows.map((r,i)=>`${x(i)},${y(r.value)}`).join(' ');
      const grid=[0,25,50,75,100].map(v=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="rgba(100,116,139,.16)"/><text x="3" y="${y(v)+4}" font-size="10" fill="#718087">${v}%</text>`).join('');
      chart.innerHTML=`<svg class="scurve-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<polyline fill="none" stroke="var(--v28-accent)" stroke-width="3" points="${points}"/></svg><div class="chart-legend"><span><i class="legend-dot" style="background:var(--v28-accent)"></i>Projected fixed daily curve</span></div>`;
    }
  }

  const oldSchedule=window.renderSchedule;
  window.renderSchedule=function(){
    let out;
    try{out=oldSchedule.apply(this,arguments)}catch(err){console.warn('projected legacy render',err)}
    renderProjectedOnly();
    return out;
  };

  // -------------------------------------------------------
  // Home control center
  // -------------------------------------------------------
  function miniCurve(pid){
    const p=series('projectedSeries',pid);
    const a=series('actualSeries',pid);
    if(!p.length)return '<div class="empty">Upload the Planned schedule to activate the project pulse.</div>';

    const start=p[0].date,finish=p[p.length-1].date;
    const W=520,H=170,L=28,R=12,T=14,B=24;
    const tt=d=>new Date(`${d}T00:00:00`).getTime();
    const s=tt(start),e=tt(finish);
    const x=d=>L+((tt(d)-s)/Math.max(1,e-s))*(W-L-R);
    const y=v=>H-B-Math.max(0,Math.min(100,v))*(H-T-B)/100;
    const pp=p.map(r=>`${x(r.date)},${y(r.value)}`).join(' ');
    const aa=a.filter(r=>r.date>=start&&r.date<=finish);
    let ap='';
    if(aa.length){
      ap=`M ${x(aa[0].date)} ${y(aa[0].value)}`;
      for(let i=1;i<aa.length;i++){
        const prev=aa[i-1],cur=aa[i],dx=x(cur.date)-x(prev.date);
        ap+=` C ${x(prev.date)+dx*.33} ${y(prev.value)}, ${x(prev.date)+dx*.67} ${y(cur.value)}, ${x(cur.date)} ${y(cur.value)}`;
      }
    }
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="${L}" y1="${y(0)}" x2="${W-R}" y2="${y(0)}" stroke="rgba(255,255,255,.18)"/><line x1="${L}" y1="${y(50)}" x2="${W-R}" y2="${y(50)}" stroke="rgba(255,255,255,.10)"/><polyline fill="none" stroke="rgba(255,255,255,.96)" stroke-width="3" points="${pp}"/>${ap?`<path d="${ap}" fill="none" stroke="#86efac" stroke-width="3" stroke-linecap="round"/>`:''}</svg>`;
  }

  function attentionItems(){
    const items=[];

    for(const p of (cache.projects||[]).filter(p=>String(p.status||'').toLowerCase()!=='completed')){
      const pos=projectPosition(p.id);
      if(pos.plan.length && pos.variance < -0.25){
        items.push({
          level:'critical',
          title:`${p.project_name} is behind`,
          detail:`${pct(Math.abs(pos.variance))} slippage as of ${pos.date}`,
          view:'dashboard',
          pid:p.id
        });
      }
    }

    const unpaid=(cache.billings||[]).filter(b=>{
      const gross=n(b.gross_amount||b.amount);
      const paid=n(b.received_amount||b.paid_amount);
      return gross>0 && paid<gross;
    });
    if(unpaid.length){
      const total=unpaid.reduce((s,b)=>s+Math.max(0,n(b.gross_amount||b.amount)-n(b.received_amount||b.paid_amount)),0);
      items.push({level:'money',title:`${unpaid.length} billing item${unpaid.length===1?'':'s'} outstanding`,detail:`Open balance ${peso(total)}`,view:'billing'});
    }

    const q=(cache.quotationProjects||[]).filter(x=>String(x.status||'').toLowerCase()==='pending');
    if(q.length)items.push({level:'quote',title:`${q.length} quotation${q.length===1?'':'s'} pending`,detail:'Review quotation deadlines and follow-ups.',view:'quotation'});

    return items.slice(0,6);
  }

  function workfront(pid){
    const today=new Date().toISOString().slice(0,10);
    return (cache.schedule||[])
      .filter(r=>String(r.project_id)===String(pid))
      .filter(r=>{
        const s=String(r.start_date||'').slice(0,10),e=String(r.end_date||'').slice(0,10);
        return s && e && s<=today && e>=today;
      })
      .slice(0,8);
  }

  function renderHomeV281(){
    const p=currentProject();
    if(!p)return;

    const pos=projectPosition(p.id);
    const varianceClass=pos.variance<0?'negative':'positive';

    if($('v281HeroProjectName'))$('v281HeroProjectName').textContent=p.project_name||'Project';
    if($('v281HeroProjectMeta'))$('v281HeroProjectMeta').textContent=[p.location,p.status].filter(Boolean).join(' • ')||'Selected project';
    if($('v281HeroPlanned'))$('v281HeroPlanned').textContent=pct(pos.planned);
    if($('v281HeroActual'))$('v281HeroActual').textContent=pct(pos.actual);
    if($('v281HeroVariance')){
      $('v281HeroVariance').textContent=(pos.variance>0?'+':'')+pct(pos.variance);
      $('v281HeroVariance').className=varianceClass;
    }

    if($('v281HomePulse')){
      const label=pos.variance<-0.25?'SLIPPAGE':pos.variance>0.25?'AHEAD':'ON TRACK';
      $('v281HomePulse').innerHTML=`
        <div class="v281-pulse-head">
          <div><strong>${safe(p.project_name)}</strong><span>${safe(pos.date)}</span></div>
          <span class="v281-pulse-badge ${label==='SLIPPAGE'?'behind':label==='AHEAD'?'ahead':'track'}">${label}</span>
        </div>
        <div class="v281-pulse-kpis">
          <div><span>Planned</span><strong>${pct(pos.planned)}</strong></div>
          <div><span>Actual</span><strong>${pct(pos.actual)}</strong></div>
          <div><span>Variance</span><strong class="${varianceClass}">${pos.variance>0?'+':''}${pct(pos.variance)}</strong></div>
        </div>
        <div class="v281-pulse-chart">${miniCurve(p.id)}</div>`;
    }

    const attention=attentionItems();
    if($('v281HomeAttention')){
      $('v281HomeAttention').innerHTML=attention.length?attention.map((x,i)=>`
        <button type="button" class="v281-attention-row ${x.level}" data-v281-attention="${i}">
          <strong>${safe(x.title)}</strong><span>${safe(x.detail)}</span>
        </button>`).join(''):'<div class="v281-all-clear"><strong>All clear</strong><span>No urgent shared items detected right now.</span></div>';
      $('v281HomeAttention')._items=attention;
    }

    const work=workfront(p.id);
    if($('v281HomeWorkfront')){
      $('v281HomeWorkfront').innerHTML=work.length?work.map(r=>`
        <div class="v28-feed-item">
          <strong>${safe(r.activity||'Scheduled activity')}</strong>
          <span>${safe(String(r.start_date||'').slice(0,10))} → ${safe(String(r.end_date||'').slice(0,10))}${r.weight!=null?` • ${pct(r.weight)} weight`:''}</span>
        </div>`).join(''):'<div class="empty">No scheduled activities active today for this project.</div>';
    }
  }

  if($('v281HomeAttention')){
    $('v281HomeAttention').addEventListener('click',e=>{
      const row=e.target.closest('[data-v281-attention]');
      if(!row)return;
      const item=$('v281HomeAttention')._items?.[Number(row.dataset.v281Attention)];
      if(!item)return;
      if(item.pid && $('workspaceProject')){
        $('workspaceProject').value=item.pid;
        $('workspaceProject').dispatchEvent(new Event('change',{bubbles:true}));
      }
      if(item.view && $(item.view))show(item.view);
    });
  }

  // Reuse v28 Home render, then fill v28.1 control center.
  const oldHome=window.renderSaikoHome;
  window.renderSaikoHome=function(){
    try{if(typeof oldHome==='function')oldHome()}catch(err){console.warn('home base render',err)}
    // v28.0 did not export its Home renderer, so directly invoke its public refresh hook if needed.
    renderHomeV281();
  };

  // Patch navigation renders so Home always has fresh shared data.
  const oldShow=window.show;
  window.show=function(view){
    const out=oldShow(view);
    if(view==='home')setTimeout(renderHomeV281,0);
    if(view==='schedule')setTimeout(renderProjectedOnly,0);
    return out;
  };

  if($('workspaceProject')){
    $('workspaceProject').addEventListener('change',()=>{
      renderHomeV281();
      if(document.querySelector('#schedule.active-view'))renderProjectedOnly();
    },{passive:true});
  }

  // Shared Realtime calls this when Home is visible.
  window.renderSaikoHome=()=>{
    // Let v28.0 refresh the existing Home pieces through its normal refresh path where possible.
    renderHomeV281();
  };

  // Profile hook for v27.5 Realtime.
  window.renderSaikoProfile=()=>{
    if(document.querySelector('#profile.active-view') && typeof window.renderProfile==='function'){
      try{window.renderProfile()}catch(_){}
    }
  };

  // Keep Home pieces updated after normal dashboard/shared refresh.
  const oldDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    let out;
    try{out=oldDashboard.apply(this,arguments)}catch(err){console.warn('dashboard render',err)}
    renderHomeV281();
    return out;
  };

  setTimeout(()=>{
    renderHomeV281();
    renderProjectedOnly();
  },700);
})();
