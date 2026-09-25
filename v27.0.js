// SAIKO Construction AI v27.0
// Exact Actual scope/status parser + persistent continuation.
// Pie, KPI and scope table all use the SAME parsed source result.
(function(){
  const n=v=>{
    if(v==null)return 0;
    const x=Number(String(v).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();

  const SCOPES=[
    'CEILING WORKS',
    'CABINETRY WORKS',
    'WALL FINISHING WORKS',
    'FLOORING WORKS',
    'ELECTRICAL WORKS',
    'PLUMBING WORKS',
    'GLASS WORKS',
    'GENERAL REQUIREMENTS'
  ];

  function pid(){
    return $('progressProject')?.value||$('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function canonicalTitle(v){
    const s=norm(v);
    if(s==='CEILING WORKS')return 'CEILING WORKS';
    if(s==='CABINETRY WORKS'||s==='CABINET WORKS')return 'CABINETRY WORKS';
    if(s==='WALL FINISHING WORKS'||s==='WALL FINISH WORKS')return 'WALL FINISHING WORKS';
    if(s==='FLOORING WORKS'||s==='FLOOR FINISHING WORKS')return 'FLOORING WORKS';
    if(s==='ELECTRICAL WORKS')return 'ELECTRICAL WORKS';
    if(s==='PLUMBING WORKS'||s==='SANITARY WORKS')return 'PLUMBING WORKS';
    if(s==='GLASS WORKS'||s==='GLAZING WORKS')return 'GLASS WORKS';
    if(s==='GENERAL REQUIREMENTS'||s==='GENERAL REQUIREMENT')return 'GENERAL REQUIREMENTS';
    return '';
  }

  function parseExactSource(rows){
    if(!Array.isArray(rows)||!rows.length)return [];
    const found=new Map();

    // Detect each block from its explicit title cell, then read its own STATUS column.
    for(let r=0;r<rows.length;r++){
      const row=rows[r]||[];
      for(let c=0;c<row.length;c++){
        const scope=canonicalTitle(row[c]);
        if(!scope||found.has(scope))continue;

        let headerR=-1,descCol=-1,totalCol=-1,statusCol=-1,balanceCol=-1;

        // Header normally sits 1 row under the title, but allow a small range.
        for(let rr=r;rr<Math.min(rows.length,r+5);rr++){
          const candidate=rows[rr]||[];
          for(let dc=Math.max(0,c-2);dc<Math.min(candidate.length,c+5);dc++){
            if(!norm(candidate[dc]).includes('DESCRIPTION'))continue;

            let tc=-1,sc=-1,bc=-1;
            for(let cc=dc+1;cc<Math.min(candidate.length,dc+7);cc++){
              const h=norm(candidate[cc]);
              if(tc<0&&h==='TOTAL')tc=cc;
              if(sc<0&&h==='STATUS')sc=cc;
              if(bc<0&&(h==='BALANCED'||h==='BALANCE'))bc=cc;
            }
            if(sc>=0){
              headerR=rr;descCol=dc;totalCol=tc;statusCol=sc;balanceCol=bc;
              break;
            }
          }
          if(headerR>=0)break;
        }
        if(headerR<0)continue;

        let overall=null;
        for(let rr=headerR+1;rr<Math.min(rows.length,headerR+16);rr++){
          const d=norm((rows[rr]||[])[descCol]);
          if(
            (d.includes('OVERALL')&&d.includes('ACCOMPLISHMENT')) ||
            (d.includes('OVERALL')&&d.includes('STATUS'))
          ){
            overall=rows[rr]||[];
            break;
          }
        }
        if(!overall)continue;

        const total=totalCol>=0?Math.max(0,n(overall[totalCol])):0;
        const status=Math.max(0,Math.min(100,n(overall[statusCol])));
        const balance=balanceCol>=0&&clean(overall[balanceCol])!==''
          ? n(overall[balanceCol])
          : Math.max(0,total-status);

        found.set(scope,{scope,total,status,balance});
      }
    }

    // Keep the exact standard order.
    return SCOPES.map(scope=>found.get(scope)).filter(Boolean);
  }

  function sourceScopes(projectId){
    const raw=window.trackerSheetViews?.actual?.[String(projectId)]||[];
    const exact=parseExactSource(raw);
    if(exact.length)return exact;

    // Fallback only while the raw snapshot is still hydrating.
    const map=new Map();
    for(const r of (cache.progress||[]).filter(x=>String(x.project_id)===String(projectId))){
      const name=canonicalTitle(r.activity);
      if(name)map.set(name,{scope:name,total:0,status:Math.max(0,n(r.actual_percent)),balance:0});
    }
    return SCOPES.map(scope=>map.get(scope)).filter(Boolean);
  }

  function totalStatus(scopes){
    return Math.max(0,Math.min(100,scopes.reduce((sum,s)=>sum+n(s.status),0)));
  }

  function renderAllExactActual(){
    const projectId=pid();
    const scopes=sourceScopes(projectId);
    const total=totalStatus(scopes);
    const remaining=Math.max(0,100-total);

    // KPI — same exact source as the pie.
    if($('progressSummary')){
      $('progressSummary').innerHTML=[
        ['Actual Accomplishment',pct(total)],
        ['Remaining',pct(remaining)],
        ['Scopes Read',scopes.length],
        ['Basis','STATUS']
      ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    }

    // Scope table — same exact source.
    if($('actualScopeStatusRows')){
      $('actualScopeStatusRows').innerHTML=scopes.length?scopes.map(s=>`<tr>
        <td><strong>${esc(s.scope)}</strong></td>
        <td>${s.total?pct(s.total):'—'}</td>
        <td><strong>${pct(s.status)}</strong></td>
        <td>${clean(s.balance)!==''?pct(s.balance):'—'}</td>
      </tr>`).join(''):'<tr><td colspan="4" class="empty">Sync the Actual Google Sheet.</td></tr>';
    }
    if($('actualScopeStatusBadge'))$('actualScopeStatusBadge').textContent=scopes.length?`TOTAL STATUS ${pct(total)}`:'WAITING';

    // Pie — same exact source, never detail rows.
    const pie=$('actualStatusPie'),legend=$('actualStatusPieLegend'),center=$('actualStatusPieTotal');
    if(pie&&legend&&center){
      const palette=['#0ea5e9','#14b8a6','#22c55e','#84cc16','#eab308','#f97316','#8b5cf6','#ec4899'];
      let cursor=0;
      const segments=[];
      scopes.forEach((s,i)=>{
        if(s.status<=0)return;
        const start=cursor;
        cursor+=s.status;
        segments.push(`${palette[i]} ${start}% ${cursor}%`);
      });
      if(remaining>0)segments.push(`rgba(100,116,139,.16) ${cursor}% 100%`);
      if(!segments.length)segments.push('rgba(100,116,139,.16) 0 100%');
      pie.style.background=`conic-gradient(${segments.join(',')})`;
      center.textContent=`${total.toFixed(2)}%`;
      legend.innerHTML=scopes.map((s,i)=>`
        <div class="actual-status-legend-row">
          <span class="actual-status-dot" style="background:${palette[i]}"></span>
          <span class="actual-status-legend-name">${esc(s.scope)}</span>
          <strong>${pct(s.status)}</strong>
        </div>`).join('')+`
        <div class="actual-status-legend-row actual-status-remaining">
          <span class="actual-status-dot"></span>
          <span class="actual-status-legend-name">Remaining</span>
          <strong>${pct(remaining)}</strong>
        </div>`;
    }
    if($('actualStatusPieBadge'))$('actualStatusPieBadge').textContent=`${pct(total)} ACTUAL`;
  }

  async function normalizeCurrentState(projectId){
    const scopes=sourceScopes(projectId);
    if(!scopes.length)return;

    const now=new Date().toISOString();
    const rows=scopes.map(s=>({
      project_id:projectId,
      activity:s.scope,
      weight:100,
      actual_percent:s.status,
      updated_by:currentUser.id,
      updated_at:now
    }));

    const up=await sb.from('actual_progress').upsert(rows,{onConflict:'project_id,activity'}).select();
    if(up.error)throw up.error;

    // Remove only stale/current-state rows that are not one of the canonical top-level scopes.
    // Historical curve data in actual_progress_series is never deleted.
    const current=(cache.progress||[]).filter(x=>String(x.project_id)===String(projectId));
    const staleIds=current.filter(x=>!SCOPES.includes(canonicalTitle(x.activity))).map(x=>x.id).filter(Boolean);
    if(staleIds.length){
      const del=await sb.from('actual_progress').delete().in('id',staleIds);
      if(del.error)console.warn('stale Actual cleanup',del.error);
    }

    cache.progress=(cache.progress||[])
      .filter(x=>String(x.project_id)!==String(projectId))
      .concat(up.data||rows);

    // Correct today's history point from the exact same source result.
    const d=new Date();
    const today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const histRow={
      project_id:projectId,
      progress_date:today,
      cumulative_percent:totalStatus(scopes),
      source_label:'EXACT TOP-LEVEL STATUS TOTAL',
      synced_at:now
    };
    const hist=await sb.from('actual_progress_series').upsert([histRow],{onConflict:'project_id,progress_date'}).select();
    if(!hist.error){
      cache.actualSeries=(cache.actualSeries||[])
        .filter(x=>!(String(x.project_id)===String(projectId)&&String(x.progress_date).slice(0,10)===today))
        .concat(hist.data||[histRow]);
    }
  }

  // Wrap the live/manual sync. Every re-pasted/saved link is freshly read by the
  // existing sync first, then normalized from that new source snapshot.
  const baseSync=window.syncActual;
  if(typeof baseSync==='function'){
    window.syncActual=async function(p,silent=false){
      const out=await baseSync(p,silent);
      await normalizeCurrentState(p.id);
      renderAllExactActual();
      return out;
    };
  }

  // Make project KPI consumers use the same exact source result.
  window.actualForProject=function(projectId){
    return totalStatus(sourceScopes(projectId));
  };

  const prevProgress=window.renderProgress;
  window.renderProgress=function(){
    const out=prevProgress.apply(this,arguments);
    renderAllExactActual();
    return out;
  };

  if($('progressProject')){
    $('progressProject').addEventListener('change',()=>setTimeout(renderAllExactActual,20),{passive:true});
  }

  setTimeout(renderAllExactActual,500);
  window.renderExactActualV270=renderAllExactActual;
})();
