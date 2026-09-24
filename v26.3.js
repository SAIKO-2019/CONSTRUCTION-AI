// SAIKO Construction AI v26.3
// Projected = uploaded Excel file.
// Actual = linked Google Sheet with 10-second live sync.
// Both are view-only in the UI; calculations are internal.
(function(){
  const n=v=>{
    if(v==null)return 0;
    const x=Number(String(v).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };
  const clean=v=>String(v??'').trim();

  window.trackerSheetViews=window.trackerSheetViews||{schedule:{},actual:{}};

  function pid(){
    return $('scheduleProject')?.value||$('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function pctVal(v){
    const s=clean(v);
    if(!s)return null;
    if(s.includes('%'))return n(s);
    const x=Number(s.replace(/,/g,''));
    if(!Number.isFinite(x))return null;
    return x>=0&&x<=1 ? x*100 : x;
  }

  function parseDate(v){
    if(v instanceof Date && !Number.isNaN(v.getTime())){
      return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
    }
    if(typeof v==='number' && v>20000 && v<80000){
      const d=new Date(Date.UTC(1899,11,30)+Math.round(v*86400000));
      return d.toISOString().slice(0,10);
    }
    const s=clean(v);
    if(!s)return null;
    if(/^\d+(\.\d+)?$/.test(s)){
      const serial=Number(s);
      if(serial>20000&&serial<80000){
        const d=new Date(Date.UTC(1899,11,30)+Math.round(serial*86400000));
        return d.toISOString().slice(0,10);
      }
    }
    const d=new Date(s);
    if(Number.isNaN(d.getTime()))return null;
    const y=d.getFullYear();
    if(y<2000||y>2100)return null;
    return `${y}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function scoreProjectedSheet(name,rows){
    const text=[name,...rows.slice(0,120).flat()].join(' ').toLowerCase();
    let score=0;
    if(/revise timeline|timeline/.test(name.toLowerCase()))score+=8;
    if(/projected accumulative accomplishment/.test(text))score+=10;
    if(/work item description/.test(text))score+=6;
    if(/total projected cost/.test(text))score+=4;
    if(/start date/.test(text)&&/end date/.test(text))score+=3;
    return score;
  }

  function visibleRowsFromSheet(ws){
    const range=XLSX.utils.decode_range(ws['!ref']||'A1:A1');
    const hiddenRows=ws['!rows']||[];
    const hiddenCols=ws['!cols']||[];
    const visibleCols=[];
    for(let c=range.s.c;c<=range.e.c;c++){
      if(!hiddenCols[c]?.hidden)visibleCols.push(c);
    }

    const rows=[];
    for(let r=range.s.r;r<=range.e.r;r++){
      if(hiddenRows[r]?.hidden)continue;
      const row=[];
      let has=false;
      for(const c of visibleCols){
        const cell=ws[XLSX.utils.encode_cell({r,c})];
        let value='';
        if(cell){
          value=XLSX.utils.format_cell(cell);
          if(value==null)value='';
          if(String(value).trim()!=='')has=true;
        }
        row.push(String(value));
      }
      if(has)rows.push(row);
    }
    return rows;
  }

  function rawRowsFromSheet(ws){
    return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
  }

  function findProjectedSeries(rows){
    const norm=s=>clean(s).toLowerCase().replace(/[^a-z0-9%]+/g,' ').replace(/\s+/g,' ').trim();

    let targetR=-1,targetC=-1;
    for(let r=0;r<rows.length;r++){
      for(let c=0;c<(rows[r]||[]).length;c++){
        const h=norm(rows[r][c]);
        if(h.includes('projected accumulative accomplishment') && (h.includes('%')||h.includes('age')||h.includes('percentage'))){
          targetR=r;targetC=c;break;
        }
      }
      if(targetR>=0)break;
    }
    if(targetR<0)return [];

    let dateR=-1;
    for(let r=targetR-1;r>=Math.max(0,targetR-100);r--){
      let hits=0;
      for(let c=targetC+1;c<(rows[r]||[]).length;c++)if(parseDate(rows[r][c]))hits++;
      if(hits>=2){dateR=r;break;}
    }
    if(dateR<0)return [];

    const out=[];
    const width=Math.max((rows[dateR]||[]).length,(rows[targetR]||[]).length);
    for(let c=targetC+1;c<width;c++){
      const d=parseDate((rows[dateR]||[])[c]);
      const p=pctVal((rows[targetR]||[])[c]);
      if(!d||p==null)continue;
      out.push({progress_date:d,cumulative_percent:Math.max(0,Math.min(100,p))});
    }
    const map=new Map();
    out.forEach(x=>map.set(x.progress_date,x));
    return [...map.values()].sort((a,b)=>a.progress_date.localeCompare(b.progress_date));
  }

  function findActivityRows(rows){
    const norm=s=>clean(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
    let hr=-1,dc=-1,sc=-1,ec=-1,tc=-1;
    for(let r=0;r<Math.min(rows.length,150);r++){
      const h=(rows[r]||[]).map(norm);
      const d=h.findIndex(x=>x.includes('work item description'));
      const st=h.findIndex(x=>x==='start date'||x.includes('start date'));
      const en=h.findIndex(x=>x==='end date'||x.includes('end date'));
      const ta=h.findIndex(x=>x==='total amount'||x.includes('total amount'));
      if(d>=0&&st>=0&&en>=0&&ta>=0){hr=r;dc=d;sc=st;ec=en;tc=ta;break;}
    }
    if(hr<0)return [];

    const raw=[];
    for(let r=hr+1;r<rows.length;r++){
      const row=rows[r]||[];
      const activity=clean(row[dc]);
      if(!activity)continue;
      if(/^\d+(st|nd|rd|th)\s*floor$/i.test(activity))continue;
      if(/\b(total projected|projected accomplishment|projected accumulative|grand total|subtotal|billing|remaining)\b/i.test(activity))continue;
      const start=parseDate(row[sc]),end=parseDate(row[ec]),amount=Math.max(0,n(row[tc]));
      if(!start||!end||amount<=0)continue;
      raw.push({activity,start_date:start,end_date:end,total_amount:amount});
    }
    if(!raw.length)return [];
    const total=raw.reduce((sum,x)=>sum+x.total_amount,0)||1;
    return raw.map(x=>({...x,weight:x.total_amount/total*100}));
  }

  function plannedAt(series,date){
    let v=0;
    for(const r of series){
      if(r.progress_date<=date)v=r.cumulative_percent;
      else break;
    }
    return v;
  }

  async function persistProjected(projectId,sheetName,visibleRows,series,activities){
    const snap=await sb.from('projected_sheet_snapshots').upsert([{
      project_id:projectId,
      sheet_name:sheetName,
      visible_rows:visibleRows,
      uploaded_at:new Date().toISOString()
    }],{onConflict:'project_id'}).select();
    if(snap.error)throw snap.error;

    const delSeries=await sb.from('projected_progress_series').delete().eq('project_id',projectId);
    if(delSeries.error)throw delSeries.error;

    if(series.length){
      const rows=series.map(x=>({
        project_id:projectId,
        progress_date:x.progress_date,
        cumulative_percent:x.cumulative_percent,
        source_label:'PROJECTED ACCUMULATIVE ACCOMPLISHMENT %AGE',
        synced_at:new Date().toISOString()
      }));
      const ins=await sb.from('projected_progress_series').upsert(rows,{onConflict:'project_id,progress_date'}).select();
      if(ins.error)throw ins.error;
      cache.projectedSeries=(cache.projectedSeries||[]).filter(x=>String(x.project_id)!==String(projectId)).concat(ins.data||rows);
    }else{
      cache.projectedSeries=(cache.projectedSeries||[]).filter(x=>String(x.project_id)!==String(projectId));
    }

    const delSchedule=await sb.from('schedule_items').delete().eq('project_id',projectId);
    if(delSchedule.error)throw delSchedule.error;
    if(activities.length){
      const rows=activities.map(x=>({
        project_id:projectId,
        activity:x.activity,
        start_date:x.start_date,
        end_date:x.end_date,
        weight:x.weight,
        created_by:currentUser.id
      }));
      const ins=await sb.from('schedule_items').insert(rows).select();
      if(ins.error)throw ins.error;
      cache.schedule=(cache.schedule||[]).filter(x=>String(x.project_id)!==String(projectId)).concat(ins.data||rows);
    }else{
      cache.schedule=(cache.schedule||[]).filter(x=>String(x.project_id)!==String(projectId));
    }

    window.trackerSheetViews.schedule[String(projectId)]=visibleRows;
  }

  async function loadSnapshot(projectId){
    if(!projectId)return;
    const {data,error}=await sb.from('projected_sheet_snapshots').select('*').eq('project_id',projectId).maybeSingle();
    if(error){
      console.warn('projected snapshot',error);
      return;
    }
    if(data?.visible_rows){
      window.trackerSheetViews.schedule[String(projectId)]=data.visible_rows;
      if($('projectedFileStatus'))$('projectedFileStatus').textContent=`${data.sheet_name||'Projected'} • uploaded ${new Date(data.uploaded_at).toLocaleString()}`;
    }else if($('projectedFileStatus')){
      $('projectedFileStatus').textContent='No uploaded file';
    }
    renderProjectedMirror();
    renderProjectedSummaryAndGuidance();
  }

  function renderProjectedMirror(){
    const projectId=pid();
    const target=$('scheduleSheetMirror');
    const badge=$('scheduleMirrorStatus');
    if(!target)return;

    const rows=window.trackerSheetViews.schedule[String(projectId)]||[];
    if(!rows.length){
      target.innerHTML='<div class="empty">Upload a Projected Excel file.</div>';
      if(badge)badge.textContent='NO FILE';
      return;
    }
    const width=Math.max(...rows.map(r=>r.length),0);
    const colHeads=Array.from({length:width},(_,i)=>`<th class="sheet-col-letter">${colLetter(i+1)}</th>`).join('');
    const body=rows.map((row,ri)=>{
      const cells=Array.from({length:width},(_,ci)=>`<td class="sheet-mirror-cell">${esc(String(row[ci]??''))}</td>`).join('');
      return `<tr><th class="sheet-row-number">${ri+1}</th>${cells}</tr>`;
    }).join('');
    target.innerHTML=`<div class="sheet-mirror-scroll"><table class="sheet-mirror-table"><thead><tr><th class="sheet-corner"></th>${colHeads}</tr></thead><tbody>${body}</tbody></table></div>`;
    if(badge)badge.textContent=`FILE • ${rows.length} VISIBLE ROWS`;
  }

  function colLetter(n){
    let s='';
    while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}
    return s;
  }

  function currentActual(pid){
    if(typeof actualForProject==='function')return Math.max(0,n(actualForProject(pid)));
    const rows=(cache.progress||[]).filter(x=>String(x.project_id)===String(pid));
    return rows.reduce((sum,x)=>sum+n(x.actual_percent),0);
  }

  function latestActualDate(pid){
    const rows=(cache.actualSeries||[]).filter(x=>String(x.project_id)===String(pid)).sort((a,b)=>String(a.progress_date).localeCompare(String(b.progress_date)));
    return rows.length?String(rows[rows.length-1].progress_date).slice(0,10):new Date().toISOString().slice(0,10);
  }

  function methodology(variance){
    if(variance<=-8){
      return `<div class="recovery-item"><strong>Major Slippage Recovery</strong><p>Prioritize critical delayed activities, increase manpower on bottleneck scopes, secure material deliveries ahead of need, run parallel work fronts where safe, and review recovery targets daily.</p></div>
      <div class="recovery-item"><strong>Control</strong><p>Set daily measurable targets per trade and compare actual accomplishment against the recovery curve every day.</p></div>`;
    }
    if(variance<=-3){
      return `<div class="recovery-item"><strong>Slippage Recovery</strong><p>Increase resources on behind activities, remove access/material constraints, use selective overtime where practical, and review the next 7-day look-ahead daily.</p></div>`;
    }
    if(variance<0){
      return `<div class="recovery-item"><strong>Minor Slippage</strong><p>Maintain crews, resolve small constraints immediately, and monitor the next critical activities closely to prevent further delay.</p></div>`;
    }
    if(variance<=3){
      return `<div class="recovery-item"><strong>On Track</strong><p>Maintain current productivity, manpower and material flow. Protect upcoming critical activities from access and procurement delays.</p></div>`;
    }
    return `<div class="recovery-item"><strong>Ahead of Plan</strong><p>Maintain the current pace without compromising quality or safety. Use the gain as schedule buffer for upcoming critical works.</p></div>`;
  }

  function renderProjectedSummaryAndGuidance(){
    const projectId=pid();
    if(!projectId)return;

    const series=(cache.projectedSeries||[]).filter(x=>String(x.project_id)===String(projectId)).map(x=>({
      progress_date:String(x.progress_date).slice(0,10),
      cumulative_percent:n(x.cumulative_percent)
    })).sort((a,b)=>a.progress_date.localeCompare(b.progress_date));

    const compareDate=latestActualDate(projectId);
    const planned=plannedAt(series,compareDate);
    const actual=currentActual(projectId);
    const variance=actual-planned;
    const status=variance<-0.25?'SLIPPAGE':variance>0.25?'AHEAD':'ON TRACK';

    if($('scheduleSummary')){
      $('scheduleSummary').innerHTML=[
        ['Projected',pct(planned)],
        ['Actual',pct(actual)],
        ['Variance',pct(variance)],
        ['Status',status]
      ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    }

    if($('scheduleHealthBadge'))$('scheduleHealthBadge').textContent=status;
    if($('recoveryPlan'))$('recoveryPlan').innerHTML=methodology(variance);

    renderProjectedCurve(series,actual,compareDate);
  }

  function renderProjectedCurve(series,actual,compareDate){
    const box=$('sCurveChart');
    if(!box)return;
    if(!series.length){
      box.innerHTML='<div class="empty">Upload the Projected Excel file to generate the S-Curve.</div>';
      return;
    }

    const W=900,H=250,pL=42,pR=18,pT=16,pB=38;
    const x=i=>series.length===1?(pL+(W-pL-pR)/2):pL+i*(W-pL-pR)/(series.length-1);
    const y=v=>H-pB-Math.max(0,Math.min(100,v))*(H-pT-pB)/100;
    const pts=series.map((r,i)=>`${x(i)},${y(r.cumulative_percent)}`).join(' ');
    let ai=0;
    for(let i=0;i<series.length;i++)if(series[i].progress_date<=compareDate)ai=i;
    const grid=[0,25,50,75,100].map(v=>`<line x1="${pL}" y1="${y(v)}" x2="${W-pR}" y2="${y(v)}" stroke="rgba(100,116,139,.18)"/><text x="3" y="${y(v)+4}" font-size="10" fill="#64748b">${v}%</text>`).join('');
    box.innerHTML=`<svg class="scurve-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pts}"/><circle cx="${x(ai)}" cy="${y(actual)}" r="5" fill="#16a34a"/></svg><div class="chart-legend"><span><i class="legend-dot" style="background:#2563eb"></i>Projected cumulative</span><span><i class="legend-dot" style="background:#16a34a"></i>Actual as of ${compareDate}</span></div>`;
  }

  async function handleProjectedUpload(){
    const projectId=pid();
    const input=$('projectedFileUpload');
    const file=input?.files?.[0];
    if(!projectId)return alert('Select a project first.');
    if(!file)return alert('Choose the Projected Excel file first.');

    const btn=$('uploadProjectedFileBtn');
    btn.disabled=true;
    if($('projectedFileStatus'))$('projectedFileStatus').textContent='Reading file...';

    try{
      const data=await file.arrayBuffer();
      const wb=XLSX.read(data,{type:'array',cellStyles:true,cellDates:true});

      let best=null;
      for(const name of wb.SheetNames){
        const ws=wb.Sheets[name];
        const visible=visibleRowsFromSheet(ws);
        const score=scoreProjectedSheet(name,visible);
        if(!best||score>best.score)best={name,ws,visible,score};
      }
      if(!best||best.score<=0)throw new Error('Could not detect the Projected / REVISE TIMELINE sheet.');

      const raw=rawRowsFromSheet(best.ws);
      const series=findProjectedSeries(raw);
      if(!series.length)throw new Error('Could not find PROJECTED ACCUMULATIVE ACCOMPLISHMENT %AGE with its date row.');

      const activities=findActivityRows(raw);

      await persistProjected(projectId,best.name,best.visible,series,activities);
      if($('projectedFileStatus'))$('projectedFileStatus').textContent=`${file.name} • ${best.name} • ${series.length} projected points`;
      renderProjectedMirror();
      renderProjectedSummaryAndGuidance();
      if(typeof renderDashboard==='function')renderDashboard();
      toast('Projected file uploaded and S-Curve computed.');
    }catch(err){
      alert(err.message||'Could not process Projected file.');
      if($('projectedFileStatus'))$('projectedFileStatus').textContent='Upload failed';
    }finally{
      btn.disabled=false;
    }
  }

  if($('uploadProjectedFileBtn'))$('uploadProjectedFileBtn').onclick=handleProjectedUpload;

  if($('scheduleProject')){
    $('scheduleProject').addEventListener('change',()=>{
      loadSnapshot(pid());
      setTimeout(renderProjectedSummaryAndGuidance,50);
    },{passive:true});
  }

  // Override the Projected renderer from older schedule-link versions.
  window.renderSchedule=function(){
    renderProjectedMirror();
    renderProjectedSummaryAndGuidance();
  };

  // Keep Dashboard comparison fresh after Actual live sync.
  const oldDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    const out=oldDashboard.apply(this,arguments);
    renderProjectedSummaryAndGuidance();
    return out;
  };

  setTimeout(()=>loadSnapshot(pid()),600);
})();
