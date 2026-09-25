// SAIKO Construction AI v26.9
// Fixes Actual STATUS pie totals, restores saved Actual data after patches,
// keeps the saved link, and reuses the existing 10-second live sync.
(function(){
  const n=v=>{
    if(v==null)return 0;
    const x=Number(String(v).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };

  const CANONICAL=[
    'CEILING WORKS',
    'CABINETRY WORKS',
    'WALL FINISHING WORKS',
    'FLOORING WORKS',
    'ELECTRICAL WORKS',
    'PLUMBING WORKS',
    'GLASS WORKS',
    'GENERAL REQUIREMENTS'
  ];

  const restored=new Set();
  const restoring=new Set();
  const firstSyncDone=new Set();

  function pid(){
    return $('progressProject')?.value||$('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function project(projectId){
    return (cache.projects||[]).find(p=>String(p.id)===String(projectId))||null;
  }

  function canonical(name){
    const s=String(name||'').trim().toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ');
    if(/\bceiling\b/.test(s))return 'CEILING WORKS';
    if(/\b(cabinet|cabinetry|joinery|casework)\b/.test(s))return 'CABINETRY WORKS';
    if(/\b(wall paint|wall cladding|cladding|wall finish|finishing|painting|skimcoat|plaster)\b/.test(s))return 'WALL FINISHING WORKS';
    if(/\b(tile|tiling|flooring|floor finish|spc|vinyl|epoxy)\b/.test(s))return 'FLOORING WORKS';
    if(/\b(electrical|lighting|outlet|wiring|wire|panelboard|panel board)\b/.test(s))return 'ELECTRICAL WORKS';
    if(/\b(plumbing|sanitary|fixture|water line|sewer|sewage|drain)\b/.test(s))return 'PLUMBING WORKS';
    if(/\b(glass|glazing|window|windows|aluminum)\b/.test(s))return 'GLASS WORKS';
    if(/\b(general requirement|mobilization|demobilization|temporary|permit|safety)\b/.test(s))return 'GENERAL REQUIREMENTS';
    return '';
  }

  // Single source for the Actual pie + scope table:
  // the already-validated rows produced by the Actual GSheet parser.
  function exactScopes(projectId){
    const map=new Map(CANONICAL.map(s=>[s,0]));
    for(const r of (cache.progress||[]).filter(x=>String(x.project_id)===String(projectId))){
      const scope=canonical(r.activity);
      if(!scope)continue;
      map.set(scope,Math.max(0,Math.min(100,n(r.actual_percent))));
    }
    return CANONICAL.map(scope=>({scope,status:map.get(scope)||0}));
  }

  function renderExactScopeTable(){
    const tbody=$('actualScopeStatusRows');
    const badge=$('actualScopeStatusBadge');
    if(!tbody)return;

    const rows=exactScopes(pid());
    const hasData=rows.some(r=>r.status>0) || (cache.progress||[]).some(r=>String(r.project_id)===String(pid()));
    if(!hasData){
      tbody.innerHTML='<tr><td colspan="4" class="empty">Sync the Actual Google Sheet to read scope STATUS values.</td></tr>';
      if(badge)badge.textContent='WAITING';
      return;
    }

    tbody.innerHTML=rows.map(r=>`<tr>
      <td><strong>${esc(r.scope)}</strong></td>
      <td>—</td>
      <td><strong>${pct(r.status)}</strong></td>
      <td>—</td>
    </tr>`).join('');

    const total=Math.max(0,Math.min(100,rows.reduce((s,r)=>s+r.status,0)));
    if(badge)badge.textContent=`TOTAL STATUS ${pct(total)}`;
  }

  function renderExactPie(){
    const pie=$('actualStatusPie');
    const legend=$('actualStatusPieLegend');
    const totalEl=$('actualStatusPieTotal');
    const badge=$('actualStatusPieBadge');
    if(!pie||!legend||!totalEl)return;

    const rows=exactScopes(pid());
    const total=Math.max(0,Math.min(100,rows.reduce((s,r)=>s+r.status,0)));
    const remaining=Math.max(0,100-total);
    totalEl.textContent=`${total.toFixed(2)}%`;
    if(badge)badge.textContent=`${pct(total)} ACTUAL`;

    const palette=[
      '#0ea5e9','#14b8a6','#22c55e','#84cc16',
      '#eab308','#f97316','#8b5cf6','#ec4899'
    ];

    let cursor=0;
    const segments=[];
    rows.forEach((r,i)=>{
      if(r.status<=0)return;
      const start=cursor;
      cursor+=r.status;
      segments.push(`${palette[i]} ${start}% ${cursor}%`);
    });
    if(remaining>0)segments.push(`rgba(100,116,139,.16) ${cursor}% 100%`);
    if(!segments.length)segments.push('rgba(100,116,139,.16) 0 100%');

    pie.style.background=`conic-gradient(${segments.join(',')})`;

    legend.innerHTML=rows.map((r,i)=>`
      <div class="actual-status-legend-row">
        <span class="actual-status-dot" style="background:${palette[i]}"></span>
        <span class="actual-status-legend-name">${esc(r.scope)}</span>
        <strong>${pct(r.status)}</strong>
      </div>
    `).join('')+`
      <div class="actual-status-legend-row actual-status-remaining">
        <span class="actual-status-dot"></span>
        <span class="actual-status-legend-name">Remaining</span>
        <strong>${pct(remaining)}</strong>
      </div>`;
  }

  async function hydrateSavedActual(projectId){
    if(!projectId||restored.has(projectId)||restoring.has(projectId))return;
    restoring.add(projectId);

    try{
      const p=project(projectId);
      if(p?.actual_progress_sheet_link && $('actualSheetLink') && document.activeElement!==$('actualSheetLink')){
        $('actualSheetLink').value=p.actual_progress_sheet_link;
      }

      const {data,error}=await sb.from('actual_sheet_snapshots')
        .select('*')
        .eq('project_id',projectId)
        .maybeSingle();

      if(!error && data?.visible_rows){
        window.trackerSheetViews=window.trackerSheetViews||{schedule:{},actual:{}};
        window.trackerSheetViews.actual[String(projectId)]=data.visible_rows;
      }

      restored.add(projectId);

      // Saved link continues automatically after a patch/reload.
      // This is one immediate refresh; the existing 10-sec live loop continues after it.
      if(p?.actual_progress_sheet_link && !firstSyncDone.has(projectId) && typeof window.syncActual==='function'){
        firstSyncDone.add(projectId);
        try{
          await window.syncActual(p,true);
          if($('actualSheetStatus'))$('actualSheetStatus').textContent='Live link saved • auto-save • 10 sec sync';
        }catch(err){
          console.warn('Initial Actual continuation sync',err);
        }
      }

      if(typeof window.renderProgress==='function')setTimeout(()=>window.renderProgress(),0);
      if(typeof window.renderDashboard==='function')setTimeout(()=>window.renderDashboard(),0);
    }finally{
      restoring.delete(projectId);
    }
  }

  // Final wrapper: every existing live sync redraws the exact STATUS table/pie.
  const previousProgress=window.renderProgress;
  window.renderProgress=function(){
    const out=previousProgress.apply(this,arguments);
    renderExactScopeTable();
    renderExactPie();
    hydrateSavedActual(pid());
    return out;
  };

  if($('progressProject')){
    $('progressProject').addEventListener('change',()=>{
      const id=pid();
      renderExactScopeTable();
      renderExactPie();
      hydrateSavedActual(id);
    },{passive:true});
  }

  setTimeout(()=>{
    renderExactScopeTable();
    renderExactPie();
    hydrateSavedActual(pid());
  },650);

  window.renderExactActualScopeStatus=renderExactScopeTable;
  window.renderExactActualStatusPie=renderExactPie;
})();
