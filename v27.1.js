// SAIKO Construction AI v27.1
// Fixed Projected schedule support for workbooks with:
// - Projected Summary
// - Schedule Data
// - Daily Accomplishment
//
// Upload once. The full Planned curve is stored by date.
// Each day, the system automatically reads the correct Planned % from that fixed curve.
// Actual remains live-synced independently.
(function(){
  const n=v=>{
    if(v==null)return 0;
    const x=Number(String(v).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).toUpperCase().replace(/[^A-Z0-9%]+/g,' ').replace(/\s+/g,' ').trim();

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
    return $('scheduleProject')?.value||$('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function isoDate(v){
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

  function pct(v){
    const x=n(v);
    if(String(v??'').includes('%'))return x;
    return x>=0&&x<=1 ? x*100 : x;
  }

  function visibleRows(ws){
    const range=XLSX.utils.decode_range(ws['!ref']||'A1:A1');
    const hiddenRows=ws['!rows']||[];
    const hiddenCols=ws['!cols']||[];
    const cols=[];
    for(let c=range.s.c;c<=range.e.c;c++)if(!hiddenCols[c]?.hidden)cols.push(c);

    const rows=[];
    for(let r=range.s.r;r<=range.e.r;r++){
      if(hiddenRows[r]?.hidden)continue;
      const row=[];
      let any=false;
      for(const c of cols){
        const cell=ws[XLSX.utils.encode_cell({r,c})];
        const value=cell?XLSX.utils.format_cell(cell):'';
        row.push(value??'');
        if(clean(value)!=='')any=true;
      }
      if(any){
        // v27.3: Projected page must remain Planned-only.
        // Do not show source rows explicitly labeled ACTUAL.
        const isActualRow=row.some(v=>norm(v)==='ACTUAL');
        if(!isActualRow)rows.push(row);
      }
    }
    return rows;
  }

  function rawRows(ws){
    return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
  }

  function sheetByName(wb,name){
    const key=wb.SheetNames.find(n=>norm(n)===norm(name));
    return key?wb.Sheets[key]:null;
  }

  function parseDailyCurve(wb){
    const ws=sheetByName(wb,'Daily Accomplishment');
    if(!ws)return [];

    const rows=rawRows(ws);
    let header=-1,dateCol=-1,runCol=-1;

    for(let r=0;r<Math.min(rows.length,30);r++){
      const h=(rows[r]||[]).map(norm);
      const dc=h.findIndex(x=>x==='DATE');
      const rc=h.findIndex(x=>x.includes('RUNNING ACCOMPLISHMENT'));
      if(dc>=0&&rc>=0){
        header=r;dateCol=dc;runCol=rc;break;
      }
    }
    if(header<0)return [];

    const points=[];
    for(let r=header+1;r<rows.length;r++){
      const row=rows[r]||[];
      const date=isoDate(row[dateCol]);
      if(!date)continue;
      const value=Math.max(0,Math.min(100,pct(row[runCol])));
      points.push({progress_date:date,cumulative_percent:value});
    }

    const dedup=new Map();
    points.forEach(x=>dedup.set(x.progress_date,x));
    return [...dedup.values()].sort((a,b)=>a.progress_date.localeCompare(b.progress_date));
  }

  function canonicalScope(v){
    const s=norm(v);
    if(s.includes('CEILING'))return 'CEILING WORKS';
    if(s.includes('CABINET'))return 'CABINETRY WORKS';
    if(s.includes('WALL')&&s.includes('FINISH'))return 'WALL FINISHING WORKS';
    if(s.includes('FLOORING'))return 'FLOORING WORKS';
    if(s.includes('ELECTRICAL'))return 'ELECTRICAL WORKS';
    if(s.includes('PLUMBING'))return 'PLUMBING WORKS';
    if(s.includes('GLASS'))return 'GLASS WORKS';
    if(s.includes('GENERAL REQUIREMENT'))return 'GENERAL REQUIREMENTS';
    return '';
  }

  function parseProjectedSummary(wb){
    const ws=sheetByName(wb,'Projected Summary');
    if(!ws)return {date:null,scopes:[],overall:null};

    const rows=rawRows(ws);
    let asOfDate=null;
    const scopes=[];
    const seen=new Set();
    let overall=null;

    // "AS OF DATE" cell pair.
    for(let r=0;r<Math.min(rows.length,10);r++){
      const row=rows[r]||[];
      for(let c=0;c<row.length;c++){
        if(norm(row[c])==='AS OF DATE'){
          for(let cc=c+1;cc<Math.min(row.length,c+5);cc++){
            const d=isoDate(row[cc]);
            if(d){asOfDate=d;break;}
          }
        }
        if(asOfDate)break;
      }
      if(asOfDate)break;
    }

    // Explicit scope blocks. Find a scope title, then the OVERALL row in its local column block.
    for(let r=0;r<rows.length;r++){
      const row=rows[r]||[];
      for(let c=0;c<row.length;c++){
        const scope=canonicalScope(row[c]);
        if(!scope||seen.has(scope))continue;

        let headerR=-1,descCol=-1,totalCol=-1,statusCol=-1,balanceCol=-1;
        for(let rr=r;rr<Math.min(rows.length,r+5);rr++){
          const hrow=rows[rr]||[];
          for(let dc=Math.max(0,c-1);dc<Math.min(hrow.length,c+3);dc++){
            if(!norm(hrow[dc]).includes('DESCRIPTION'))continue;
            let tc=-1,sc=-1,bc=-1;
            for(let cc=dc+1;cc<Math.min(hrow.length,dc+8);cc++){
              const h=norm(hrow[cc]);
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

        let overallRow=null;
        for(let rr=headerR+1;rr<Math.min(rows.length,headerR+14);rr++){
          const d=norm((rows[rr]||[])[descCol]);
          if(d.includes('OVERALL')&&d.includes('ACCOMPLISHMENT')){
            overallRow=rows[rr]||[];break;
          }
        }
        if(!overallRow)continue;

        const total=totalCol>=0?Math.max(0,pct(overallRow[totalCol])):0;
        const status=Math.max(0,Math.min(100,pct(overallRow[statusCol])));
        const balance=balanceCol>=0?Math.max(0,pct(overallRow[balanceCol])):Math.max(0,total-status);

        scopes.push({scope,total,status,balance});
        seen.add(scope);
      }
    }

    // Overall Status Accomplishment row.
    for(let r=0;r<rows.length;r++){
      const row=rows[r]||[];
      for(let c=0;c<row.length;c++){
        if(norm(row[c]).includes('OVERALL STATUS ACCOMPLISHMENT')){
          for(let cc=c+1;cc<Math.min(row.length,c+6);cc++){
            const x=pct(row[cc]);
            if(x>0&&x<=100){overall=x;break;}
          }
        }
        if(overall!=null)break;
      }
      if(overall!=null)break;
    }

    return {date:asOfDate,scopes,overall};
  }

  function plannedAt(series,date){
    let value=0;
    for(const r of series){
      if(r.progress_date<=date)value=r.cumulative_percent;
      else break;
    }
    return value;
  }

  async function persistFixedPlan(projectId,fileName,mirrorRows,curve,summary){
    // The user explicitly uploaded a new fixed baseline file:
    // replace only this project's Planned baseline, not Actual data/history.
    const del=await sb.from('projected_progress_series').delete().eq('project_id',projectId);
    if(del.error)throw del.error;

    const rows=curve.map(x=>({
      project_id:projectId,
      progress_date:x.progress_date,
      cumulative_percent:x.cumulative_percent,
      source_label:'FIXED DAILY PROJECTED CURVE',
      synced_at:new Date().toISOString()
    }));
    if(rows.length){
      const ins=await sb.from('projected_progress_series')
        .upsert(rows,{onConflict:'project_id,progress_date'}).select();
      if(ins.error)throw ins.error;
      cache.projectedSeries=(cache.projectedSeries||[])
        .filter(r=>String(r.project_id)!==String(projectId))
        .concat(ins.data||rows);
    }

    if(summary.scopes.length){
      const delScopes=await sb.from('projected_scope_series').delete().eq('project_id',projectId);
      if(delScopes.error)throw delScopes.error;

      const scopeDate=summary.date||curve[curve.length-1]?.progress_date;
      const scopeRows=summary.scopes.map(s=>({
        project_id:projectId,
        progress_date:scopeDate,
        scope_name:s.scope,
        cumulative_percent:s.status,
        synced_at:new Date().toISOString()
      }));

      const insScopes=await sb.from('projected_scope_series')
        .upsert(scopeRows,{onConflict:'project_id,progress_date,scope_name'}).select();
      if(insScopes.error)throw insScopes.error;

      cache.projectedScopeSeries=(cache.projectedScopeSeries||[])
        .filter(r=>String(r.project_id)!==String(projectId))
        .concat(insScopes.data||scopeRows);

      window.v268PlannedScopes=window.v268PlannedScopes||{};
      window.v268PlannedScopes[String(projectId)]={
        date:scopeDate,
        scopes:summary.scopes
      };
    }

    const snap=await sb.from('projected_sheet_snapshots').upsert([{
      project_id:projectId,
      sheet_name:fileName,
      visible_rows:mirrorRows,
      uploaded_at:new Date().toISOString()
    }],{onConflict:'project_id'}).select();
    if(snap.error)throw snap.error;

    window.trackerSheetViews=window.trackerSheetViews||{schedule:{},actual:{}};
    window.trackerSheetViews.schedule[String(projectId)]=mirrorRows;
  }

  async function uploadFixedExcel(file){
    const projectId=pid();
    if(!projectId)throw new Error('Select a project first.');

    const bytes=await file.arrayBuffer();
    const wb=XLSX.read(bytes,{type:'array',cellStyles:true,cellDates:true});

    const curve=parseDailyCurve(wb);
    if(!curve.length){
      throw new Error('Daily Accomplishment sheet not found or the DATE / RUNNING ACCOMPLISHMENT % columns could not be read.');
    }

    const summary=parseProjectedSummary(wb);
    const summaryWs=sheetByName(wb,'Projected Summary');
    const dailyWs=sheetByName(wb,'Daily Accomplishment');

    // Mirror Projected Summary first; append a compact Daily Accomplishment excerpt header.
    const mirror=summaryWs?visibleRows(summaryWs):[];
    if(dailyWs){
      mirror.push([]);
      mirror.push(['DAILY ACCOMPLISHMENT CURVE LOADED', `${curve.length} planned date points`]);
      mirror.push(['START', curve[0].progress_date, 'END', curve[curve.length-1].progress_date]);
    }

    await persistFixedPlan(projectId,file.name,mirror,curve,summary);

    const today=new Date();
    const todayIso=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const plannedToday=plannedAt(curve,todayIso);

    return {
      curveCount:curve.length,
      start:curve[0].progress_date,
      end:curve[curve.length-1].progress_date,
      plannedToday,
      summary
    };
  }

  // Override only Excel uploads. PDF path remains handled by v26.8.
  const previous=$('uploadProjectedFileBtn')?.onclick||null;
  if($('uploadProjectedFileBtn')){
    $('uploadProjectedFileBtn').onclick=async()=>{
      const file=$('projectedFileUpload')?.files?.[0];
      if(!file)return alert('Choose the fixed Projected schedule file first.');

      if(/\.pdf$/i.test(file.name)){
        if(previous)return previous();
        return;
      }

      if(!/\.(xlsx|xls|xlsm)$/i.test(file.name)){
        return alert('Use Excel or PDF for the Projected schedule.');
      }

      const btn=$('uploadProjectedFileBtn');
      btn.disabled=true;
      if($('projectedFileStatus'))$('projectedFileStatus').textContent='Reading complete fixed Projected curve...';

      try{
        const result=await uploadFixedExcel(file);
        if($('projectedFileStatus')){
          $('projectedFileStatus').textContent=
            `${file.name} • fixed baseline saved • ${result.curveCount} dates • ${pct(result.plannedToday)} planned today`;
        }

        if(typeof renderSchedule==='function')renderSchedule();
        if(typeof renderDashboard==='function')renderDashboard();
        if(typeof toast==='function')toast('Fixed Projected schedule saved. Daily Planned % will now follow the stored curve automatically.');
      }catch(err){
        alert(err?.message||'Could not read the fixed Projected schedule.');
        if($('projectedFileStatus'))$('projectedFileStatus').textContent='Projected schedule read failed';
      }finally{
        btn.disabled=false;
      }
    };
  }

  // Daily Planned lookup helper for Dashboard / reports.
  window.fixedProjectedAtDate=function(projectId,date){
    const rows=(cache.projectedSeries||[])
      .filter(r=>String(r.project_id)===String(projectId))
      .map(r=>({
        progress_date:String(r.progress_date).slice(0,10),
        cumulative_percent:n(r.cumulative_percent)
      }))
      .sort((a,b)=>a.progress_date.localeCompare(b.progress_date));
    return plannedAt(rows,date);
  };
})();
