// SAIKO Construction AI v26.7
// Actual page: live STATUS pie chart instead of Actual S-Curve.
// Reuses the existing 10-second GSheet live sync. No extra timer.
(function(){
  const n=v=>{
    if(v==null)return 0;
    const x=Number(String(v).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9%]+/g,' ').replace(/\s+/g,' ').trim();

  function pid(){
    return $('progressProject')?.value||$('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function scopeNameFromRows(rows, headerRow, descCol){
    for(let r=headerRow-1;r>=Math.max(0,headerRow-5);r--){
      const vals=(rows[r]||[]).slice(Math.max(0,descCol-1),descCol+3).map(clean).filter(Boolean);
      const explicit=vals.find(v=>/\bworks?\b/i.test(v));
      if(explicit)return explicit.toUpperCase();
      const candidate=vals.find(v=>/[A-Za-z]/.test(v) && !/%/.test(v) && !/description|total|status|distribution|balanced|equivalent/i.test(v));
      if(candidate)return candidate.toUpperCase();
    }
    return '';
  }

  function parseStatusScopes(rows){
    const out=[];
    const seen=new Set();

    for(let r=0;r<rows.length;r++){
      const row=rows[r]||[];
      for(let descCol=0;descCol<row.length;descCol++){
        const h=norm(row[descCol]);
        if(!(h==='description'||h.includes('description')))continue;

        let statusCol=-1;
        for(let c=descCol+1;c<Math.min(row.length,descCol+7);c++){
          const hc=norm(row[c]);
          if(statusCol<0 && (hc==='status'||hc.includes('actual')||hc.includes('accomplishment')))statusCol=c;
        }
        if(statusCol<0)continue;

        const scope=scopeNameFromRows(rows,r,descCol);
        if(!scope)continue;

        let overall=null;
        for(let rr=r+1;rr<Math.min(rows.length,r+15);rr++){
          const d=clean((rows[rr]||[])[descCol]);
          if(!d)continue;
          if(/overall.*(accomplishment|status|progress|percentage)/i.test(d) || /overall\s*status/i.test(d)){
            overall=rows[rr]||[];
            break;
          }
          if(rr>r+1 && /^description$/i.test(d))break;
        }
        if(!overall)continue;

        const key=scope.replace(/\s+/g,' ').trim();
        if(seen.has(key))continue;
        seen.add(key);

        out.push({
          scope:key,
          status:Math.max(0,n(overall[statusCol]))
        });
      }
    }
    return out;
  }

  function fallbackScopes(projectId){
    return (cache.progress||[])
      .filter(r=>String(r.project_id)===String(projectId))
      .map(r=>({scope:String(r.activity||'').toUpperCase(),status:Math.max(0,n(r.actual_percent))}));
  }

  function renderActualStatusPie(){
    const projectId=pid();
    const pie=$('actualStatusPie');
    const legend=$('actualStatusPieLegend');
    const totalEl=$('actualStatusPieTotal');
    const badge=$('actualStatusPieBadge');
    if(!pie||!legend||!totalEl)return;

    const raw=window.trackerSheetViews?.actual?.[String(projectId)]||[];
    let scopes=parseStatusScopes(raw);
    if(!scopes.length)scopes=fallbackScopes(projectId);

    // Remove zero-only scopes from slices but keep a clean empty state if nothing progressed yet.
    const positive=scopes.filter(s=>s.status>0);
    const total=Math.max(0,Math.min(100,scopes.reduce((sum,s)=>sum+s.status,0)));
    const remaining=Math.max(0,100-total);

    totalEl.textContent=`${total.toFixed(2)}%`;

    if(!positive.length && remaining>=100){
      pie.style.background='conic-gradient(rgba(100,116,139,.16) 0 100%)';
      legend.innerHTML='<div class="empty">No STATUS accomplishment yet.</div>';
      if(badge)badge.textContent='0.00% ACTUAL';
      return;
    }

    const palette=[
      '#0ea5e9','#14b8a6','#22c55e','#84cc16',
      '#eab308','#f97316','#8b5cf6','#ec4899'
    ];

    let cursor=0;
    const segments=[];
    positive.forEach((s,i)=>{
      const start=cursor;
      cursor+=s.status;
      segments.push(`${palette[i%palette.length]} ${start}% ${cursor}%`);
    });
    if(remaining>0){
      segments.push(`rgba(100,116,139,.16) ${cursor}% 100%`);
    }
    pie.style.background=`conic-gradient(${segments.join(',')})`;

    legend.innerHTML=positive.map((s,i)=>`
      <div class="actual-status-legend-row">
        <span class="actual-status-dot" style="background:${palette[i%palette.length]}"></span>
        <span class="actual-status-legend-name">${esc(s.scope)}</span>
        <strong>${pct(s.status)}</strong>
      </div>
    `).join('') + (remaining>0?`
      <div class="actual-status-legend-row actual-status-remaining">
        <span class="actual-status-dot"></span>
        <span class="actual-status-legend-name">Remaining</span>
        <strong>${pct(remaining)}</strong>
      </div>`:'');

    if(badge)badge.textContent=`${pct(total)} ACTUAL`;
  }

  // Existing Actual live sync calls renderProgress every 10 seconds.
  // Wrap once so the pie updates immediately with the latest synced STATUS.
  const oldProgress=window.renderProgress;
  window.renderProgress=function(){
    const out=oldProgress.apply(this,arguments);
    renderActualStatusPie();
    return out;
  };

  if($('progressProject')){
    $('progressProject').addEventListener('change',()=>setTimeout(renderActualStatusPie,10),{passive:true});
  }

  setTimeout(renderActualStatusPie,400);
  window.renderActualStatusPie=renderActualStatusPie;
})();
