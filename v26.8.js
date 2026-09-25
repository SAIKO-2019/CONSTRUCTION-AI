// SAIKO Construction AI v26.8
// Planned/Projected PDF support using the same scope/status format as Actual.
// Dashboard is cleaned and shows one Planned-vs-Actual S-Curve card per project.
(function(){
  const num=v=>{
    if(v==null)return 0;
    const x=Number(String(v).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9%]+/g,' ').replace(/\s+/g,' ').trim();

  function projectId(){
    return $('scheduleProject')?.value||$('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function dateIso(d){
    const y=d.getFullYear();
    return `${y}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function parsePercent(v){
    const s=clean(v);
    if(!s)return 0;
    const x=num(s);
    if(s.includes('%'))return x;
    return x>=0&&x<=1?x*100:x;
  }

  function canonicalScope(name){
    const s=norm(name);
    if(/\bceiling\b/.test(s))return 'CEILING WORKS';
    if(/\b(cabinet|cabinetry|joinery|casework)\b/.test(s))return 'CABINETRY WORKS';
    if(/\b(wall paint|wall cladding|cladding|wall finish|finishing|painting|skimcoat|plaster)\b/.test(s))return 'WALL FINISHING WORKS';
    if(/\b(tile|tiling|flooring|floor finish|spc|vinyl|epoxy)\b/.test(s))return 'FLOORING WORKS';
    if(/\b(electrical|lighting|outlet|wiring|wire|panelboard|panel board)\b/.test(s))return 'ELECTRICAL WORKS';
    if(/\b(plumbing|sanitary|fixture|water line|sewer|sewage|drain)\b/.test(s))return 'PLUMBING WORKS';
    if(/\b(glass|glazing|window|windows|aluminum|door|doors)\b/.test(s))return 'GLASS WORKS';
    if(/\b(general requirement|mobilization|demobilization|temporary|permit|safety)\b/.test(s))return 'GENERAL REQUIREMENTS';
    return clean(name).toUpperCase();
  }

  // ---------- PDF extraction ----------
  async function readPdf(file){
    if(!window.pdfjsLib)throw new Error('PDF reader did not load. Refresh the page and try again.');

    const bytes=await file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
    const pages=[];
    const allLines=[];

    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p);
      const tc=await page.getTextContent();
      const items=(tc.items||[]).map(it=>({
        text:clean(it.str),
        x:Number(it.transform?.[4]||0),
        y:Number(it.transform?.[5]||0),
        width:Number(it.width||0)
      })).filter(it=>it.text);

      // Group by visual Y coordinate, then order left-to-right.
      const buckets=[];
      for(const item of items.sort((a,b)=>b.y-a.y||a.x-b.x)){
        let row=buckets.find(r=>Math.abs(r.y-item.y)<=3.2);
        if(!row){
          row={y:item.y,items:[]};
          buckets.push(row);
        }
        row.items.push(item);
      }
      buckets.sort((a,b)=>b.y-a.y);
      buckets.forEach(r=>r.items.sort((a,b)=>a.x-b.x));

      pages.push({page:p,rows:buckets});
      for(const r of buckets){
        allLines.push({
          page:p,
          y:r.y,
          items:r.items,
          text:r.items.map(i=>i.text).join(' ')
        });
      }
    }
    return {pages,lines:allLines};
  }

  function findNearestNumeric(items,x,minX,maxX){
    const candidates=items
      .filter(i=>i.x>=minX&&i.x<maxX)
      .map(i=>({i,d:Math.abs(i.x-x)}))
      .filter(o=>/[-+]?\d[\d,.]*%?/.test(o.i.text))
      .sort((a,b)=>a.d-b.d);
    return candidates.length?parsePercent(candidates[0].i.text):0;
  }

  function parsePdfScopeStatus(pdfData){
    const out=[];
    const seen=new Set();

    for(const page of pdfData.pages){
      const rows=page.rows;
      for(let ri=0;ri<rows.length;ri++){
        const row=rows[ri];
        const descHeaders=row.items.filter(i=>norm(i.text)==='description'||norm(i.text).includes('description'));
        if(!descHeaders.length)continue;

        for(let di=0;di<descHeaders.length;di++){
          const desc=descHeaders[di];
          const nextDescX=di+1<descHeaders.length?descHeaders[di+1].x:Infinity;
          const local=row.items.filter(i=>i.x>=desc.x&&i.x<nextDescX);

          const total=local.find(i=>norm(i.text)==='total');
          const status=local.find(i=>norm(i.text)==='status'||norm(i.text).includes('planned')||norm(i.text).includes('projected'));
          const balance=local.find(i=>norm(i.text).includes('balance'));
          if(!status)continue;

          let scope='';
          for(let up=ri-1;up>=Math.max(0,ri-6);up--){
            const candidates=rows[up].items.filter(i=>Math.abs(i.x-desc.x)<180 && /[A-Za-z]/.test(i.text));
            const explicit=candidates.find(i=>/\bworks?\b/i.test(i.text));
            const chosen=explicit||candidates.sort((a,b)=>b.text.length-a.text.length)[0];
            if(chosen && !/description|total|status|balance|distribution|accomplishment/i.test(chosen.text)){
              scope=canonicalScope(chosen.text);
              break;
            }
          }
          if(!scope)continue;

          let overall=null;
          for(let down=ri+1;down<Math.min(rows.length,ri+18);down++){
            const candidates=rows[down].items.filter(i=>i.x>=desc.x-20&&i.x<nextDescX);
            const joined=candidates.map(i=>i.text).join(' ');
            if(/overall.*(accomplishment|status|progress|percentage)/i.test(joined) || /overall\s*status/i.test(joined)){
              overall=rows[down];
              break;
            }
          }
          if(!overall)continue;

          const key=scope;
          if(seen.has(key))continue;
          seen.add(key);

          const minX=desc.x;
          const maxX=nextDescX;
          const totalVal=total?findNearestNumeric(overall.items,total.x,minX,maxX):0;
          const statusVal=findNearestNumeric(overall.items,status.x,minX,maxX);
          const balanceVal=balance?findNearestNumeric(overall.items,balance.x,minX,maxX):Math.max(0,totalVal-statusVal);

          out.push({
            scope:key,
            total:Math.max(0,totalVal),
            status:Math.max(0,statusVal),
            balance:Math.max(0,balanceVal)
          });
        }
      }
    }

    return out;
  }

  function detectPdfDate(pdfData){
    const month='(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
    const patterns=[
      new RegExp(`\\b${month}\\s+\\d{1,2},\\s*20\\d{2}\\b`,'i'),
      /\b\d{1,2}[\/-]\d{1,2}[\/-]20\d{2}\b/,
      /\b20\d{2}[\/-]\d{1,2}[\/-]\d{1,2}\b/
    ];
    const dateLines=pdfData.lines.filter(l=>/\bdate\b/i.test(l.text)).concat(pdfData.lines);
    for(const line of dateLines){
      for(const pat of patterns){
        const m=line.text.match(pat);
        if(m){
          const d=new Date(m[0]);
          if(!Number.isNaN(d.getTime()))return dateIso(d);
        }
      }
    }
    return dateIso(new Date());
  }

  function pdfRowsForMirror(pdfData){
    return pdfData.lines.map(l=>[l.text]);
  }

  // ---------- Persist PDF planned snapshot ----------
  async function savePdfPlan(pid,file,rows,scopes,snapshotDate){
    const total=Math.max(0,Math.min(100,scopes.reduce((s,x)=>s+x.status,0)));

    const snap=await sb.from('projected_sheet_snapshots').upsert([{
      project_id:pid,
      sheet_name:file.name,
      visible_rows:rows,
      uploaded_at:new Date().toISOString()
    }],{onConflict:'project_id'}).select();
    if(snap.error)throw snap.error;

    const overallRow={
      project_id:pid,
      progress_date:snapshotDate,
      cumulative_percent:total,
      source_label:'PLANNED PDF STATUS TOTAL',
      synced_at:new Date().toISOString()
    };
    const overall=await sb.from('projected_progress_series').upsert([overallRow],{onConflict:'project_id,progress_date'}).select();
    if(overall.error)throw overall.error;

    const scopeRows=scopes.map(s=>({
      project_id:pid,
      progress_date:snapshotDate,
      scope_name:s.scope,
      cumulative_percent:s.status,
      synced_at:new Date().toISOString()
    }));
    if(scopeRows.length){
      const scoped=await sb.from('projected_scope_series').upsert(scopeRows,{onConflict:'project_id,progress_date,scope_name'}).select();
      if(scoped.error)throw scoped.error;

      cache.projectedScopeSeries=(cache.projectedScopeSeries||[])
        .filter(r=>!(String(r.project_id)===String(pid)&&String(r.progress_date).slice(0,10)===snapshotDate))
        .concat(scoped.data||scopeRows);
    }

    cache.projectedSeries=(cache.projectedSeries||[])
      .filter(r=>!(String(r.project_id)===String(pid)&&String(r.progress_date).slice(0,10)===snapshotDate))
      .concat(overall.data||[overallRow]);

    window.trackerSheetViews=window.trackerSheetViews||{schedule:{},actual:{}};
    window.trackerSheetViews.schedule[String(pid)]=rows;
    window.v268PlannedScopes=window.v268PlannedScopes||{};
    window.v268PlannedScopes[String(pid)]={date:snapshotDate,scopes};
  }

  // ---------- Planned scope UI ----------
  function latestPlannedScopeRows(pid){
    const local=window.v268PlannedScopes?.[String(pid)];
    if(local)return local;

    const rows=(cache.projectedScopeSeries||[])
      .filter(r=>String(r.project_id)===String(pid))
      .sort((a,b)=>String(a.progress_date).localeCompare(String(b.progress_date)));
    if(!rows.length)return null;

    const latest=String(rows[rows.length-1].progress_date).slice(0,10);
    return {
      date:latest,
      scopes:rows.filter(r=>String(r.progress_date).slice(0,10)===latest).map(r=>({
        scope:r.scope_name,total:0,status:num(r.cumulative_percent),balance:0
      }))
    };
  }

  function renderPlannedScopes(){
    const tbody=$('projectedPdfScopeRows');
    const badge=$('projectedPdfScopeBadge');
    if(!tbody)return;
    const pid=projectId();
    const data=latestPlannedScopeRows(pid);

    if(!data?.scopes?.length){
      tbody.innerHTML='<tr><td colspan="4" class="empty">Upload the Planned PDF.</td></tr>';
      if(badge)badge.textContent='WAITING';
      return;
    }

    tbody.innerHTML=data.scopes.map(s=>`<tr>
      <td><strong>${esc(s.scope)}</strong></td>
      <td>${pct(s.total)}</td>
      <td><strong>${pct(s.status)}</strong></td>
      <td>${pct(s.balance)}</td>
    </tr>`).join('');

    const total=Math.min(100,data.scopes.reduce((sum,s)=>sum+num(s.status),0));
    if(badge)badge.textContent=`${pct(total)} • ${data.date}`;
  }

  // ---------- Upload override ----------
  const oldUpload=$('uploadProjectedFileBtn')?.onclick||null;
  if($('uploadProjectedFileBtn')){
    $('uploadProjectedFileBtn').onclick=async()=>{
      const input=$('projectedFileUpload');
      const file=input?.files?.[0];
      const pid=projectId();
      if(!pid)return alert('Select a project first.');
      if(!file)return alert('Choose the Planned file first.');

      if(!/\.pdf$/i.test(file.name)){
        if(oldUpload)return oldUpload();
        return alert('Please upload a PDF or Excel file.');
      }

      const btn=$('uploadProjectedFileBtn');
      btn.disabled=true;
      if($('projectedFileStatus'))$('projectedFileStatus').textContent='Reading Planned PDF...';

      try{
        const pdfData=await readPdf(file);
        const scopes=parsePdfScopeStatus(pdfData);
        if(!scopes.length){
          throw new Error('Could not detect the Scope / TOTAL / STATUS format in the Planned PDF.');
        }
        const snapshotDate=detectPdfDate(pdfData);
        const mirrorRows=pdfRowsForMirror(pdfData);

        await savePdfPlan(pid,file,mirrorRows,scopes,snapshotDate);

        if($('projectedFileStatus')){
          $('projectedFileStatus').textContent=`${file.name} • ${scopes.length} scopes • ${snapshotDate}`;
        }

        if(typeof renderSchedule==='function')renderSchedule();
        renderPlannedScopes();
        if(typeof renderDashboard==='function')renderDashboard();
        if(typeof toast==='function')toast('Planned PDF read and saved.');
      }catch(err){
        alert(err?.message||'Could not read Planned PDF.');
        if($('projectedFileStatus'))$('projectedFileStatus').textContent='PDF read failed';
      }finally{
        btn.disabled=false;
      }
    };
  }

  // ---------- Dashboard clean project curves ----------
  function seriesFor(cacheKey,pid){
    return (cache[cacheKey]||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({date:String(r.progress_date).slice(0,10),value:Math.max(0,Math.min(100,num(r.cumulative_percent)))}))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }

  function latestValue(rows){
    return rows.length?rows[rows.length-1].value:0;
  }

  function plannedAt(rows,date){
    let v=0;
    for(const r of rows){
      if(r.date<=date)v=r.value;
      else break;
    }
    return v;
  }

  function miniCurve(project){
    const p=seriesFor('projectedSeries',project.id);
    const a=seriesFor('actualSeries',project.id);

    const latestDate=a.length?a[a.length-1].date:(p.length?p[p.length-1].date:dateIso(new Date()));
    const actual=latestValue(a);
    const planned=plannedAt(p,latestDate);
    const variance=actual-planned;
    const condition=variance<-0.25?'SLIPPAGE':variance>0.25?'AHEAD':'ON TRACK';

    const dates=[...new Set([...p.map(x=>x.date),...a.map(x=>x.date)])].sort();
    if(!dates.length){
      return `<article class="project-curve-card">
        <div class="project-curve-head"><div><h3>${esc(project.project_name)}</h3><small>${esc(project.status||'')}</small></div><span class="project-health neutral">NO DATA</span></div>
        <div class="empty">Upload Planned PDF and sync Actual GSheet.</div>
      </article>`;
    }

    let pv=0,av=null;
    const pmap=new Map(p.map(x=>[x.date,x.value]));
    const amap=new Map(a.map(x=>[x.date,x.value]));
    const pts=dates.map(date=>{
      if(pmap.has(date))pv=pmap.get(date);
      if(amap.has(date))av=amap.get(date);
      return {date,p:pv,a:av};
    });

    const W=420,H=145,L=28,R=10,T=10,B=24;
    const xx=i=>pts.length===1?(L+(W-L-R)/2):L+i*(W-L-R)/(pts.length-1);
    const yy=v=>H-B-Math.max(0,Math.min(100,v))*(H-T-B)/100;
    const pp=pts.map((r,i)=>`${xx(i)},${yy(r.p)}`).join(' ');
    const ap=pts.map((r,i)=>r.a==null?null:`${xx(i)},${yy(r.a)}`).filter(Boolean).join(' ');

    return `<article class="project-curve-card">
      <div class="project-curve-head">
        <div><h3>${esc(project.project_name)}</h3><small>${latestDate}</small></div>
        <span class="project-health ${condition==='SLIPPAGE'?'behind':condition==='AHEAD'?'ahead':'track'}">${condition}</span>
      </div>
      <div class="project-curve-kpis">
        <div><span>Planned</span><strong>${pct(planned)}</strong></div>
        <div><span>Actual</span><strong>${pct(actual)}</strong></div>
        <div><span>Variance</span><strong class="${variance<0?'negative':'positive'}">${pct(variance)}</strong></div>
      </div>
      <svg class="project-mini-scurve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <line x1="${L}" y1="${yy(0)}" x2="${W-R}" y2="${yy(0)}" stroke="rgba(100,116,139,.18)"/>
        <line x1="${L}" y1="${yy(50)}" x2="${W-R}" y2="${yy(50)}" stroke="rgba(100,116,139,.12)"/>
        <line x1="${L}" y1="${yy(100)}" x2="${W-R}" y2="${yy(100)}" stroke="rgba(100,116,139,.18)"/>
        <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pp}"/>
        ${ap?`<polyline fill="none" stroke="#16a34a" stroke-width="3" points="${ap}"/>`:''}
      </svg>
      <div class="project-curve-legend"><span><i class="planned-dot"></i>Planned</span><span><i class="actual-dot"></i>Actual</span></div>
    </article>`;
  }

  function renderProjectCurves(){
    const host=$('dashboardProjectCurves');
    if(!host)return;
    const projects=(cache.projects||[]).filter(p=>p.status!=='Completed');
    host.innerHTML=projects.length?projects.map(miniCurve).join(''):'<div class="empty">No ongoing projects.</div>';
  }

  const oldDash=window.renderDashboard;
  window.renderDashboard=function(){
    let out;
    try{out=oldDash.apply(this,arguments)}catch(err){console.warn('legacy dashboard',err)}
    renderProjectCurves();
    return out;
  };

  const oldSchedule=window.renderSchedule;
  window.renderSchedule=function(){
    const out=oldSchedule.apply(this,arguments);
    renderPlannedScopes();
    return out;
  };

  if($('scheduleProject'))$('scheduleProject').addEventListener('change',()=>setTimeout(renderPlannedScopes,10),{passive:true});
  setTimeout(()=>{
    renderPlannedScopes();
    renderProjectCurves();
  },500);
})();
